// v387 — NF de saída de pedido com entrada: o KM fatura a NF cheia, mas a entrada já está no contas a receber.
// · acha o pedido da NF (NFs do pedido vindas do KM, ou a NF já casada no faturamento)
// · abate das parcelas NOVAS da NF a entrada do pedido (proporcional, mantendo os vencimentos); a entrada é abatida uma vez só,
//   mesmo com faturamento parcial em várias NFs (PedidoVenda.entradaAbatidaNfs)
// · entrada ainda não paga → as contas da NF nascem com crítica; condição com entrada e sem conta de entrada → aviso
import { prisma } from "@/lib/prisma";
import { lerCondicao } from "@/lib/pedidosLer";

const chaveEntrada = (numero) => `PED|${numero}|ENTRADA`;   // igual a pedidos.js
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const semZero = (s) => String(s || "").trim().replace(/^0+(?=\d)/, "");
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function pedidoDaNf(numeroNf, documento) {
  const nf = semZero(numeroNf);
  if (!nf) return null;
  const sel = { id: true, numero: true, condicao: true, interno: true, cnpj: true, kmNfs: true, nfNumero: true, nfsFaturadas: true, entradaAbatidaNfs: true };
  const cands = await prisma.pedidoVenda.findMany({
    where: { OR: [{ kmNfs: { array_contains: [{ numero: nf }] } }, { nfsFaturadas: { array_contains: [{ numero: nf }] } }, { nfNumero: { contains: nf } }] }, select: sel,
  });
  const doc = String(documento || "").replace(/\D/g, "");
  const ok = cands.filter((p) => {
    const naLista = (Array.isArray(p.kmNfs) && p.kmNfs.some((x) => semZero(x.numero) === nf))
      || (Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.some((x) => semZero(x.numero) === nf))
      || String(p.nfNumero || "").split(/[,\s]+/).map(semZero).includes(nf);
    const mesmoCliente = !doc || !p.cnpj || String(p.cnpj).replace(/\D/g, "") === doc;
    return naLista && mesmoCliente;
  });
  return ok.length === 1 ? ok[0] : null;   // NF de mais de um pedido: não mexe (confere à mão)
}

// n: nota da análise do movimento fiscal; parcelas: as parcelas já classificadas (NOVA / LIGAR / JA_LANCADA). Ajusta as NOVAS no lugar.
export async function abaterEntradaNaNf(n, parcelas) {
  if (n.tipo !== "SAIDA") return null;
  const p = await pedidoDaNf(n.numero, n.documento);
  if (!p || p.interno) return null;
  const tits = await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", status: { not: "CANCELADO" }, OR: [{ chaveImport: chaveEntrada(p.numero) }, { titulo: { contains: `PEDIDO ${p.numero}` } }] },
    select: { id: true, valor: true, status: true, valorPago: true },
  });
  if (!tits.length) {
    if (lerCondicao(p.condicao).entradaPct > 0) return { pedido: p.numero, aviso: `PEDIDO ${p.numero}: A CONDIÇÃO (${p.condicao}) TEM ENTRADA, MAS NÃO HÁ CONTA DE ENTRADA — CONFIRA` };
    return null;
  }
  const entrada = r2(tits.reduce((s, t) => s + Number(t.valor), 0));
  const paga = r2(tits.filter((t) => t.status === "PAGO").reduce((s, t) => s + Number(t.valorPago ?? t.valor), 0));
  const nf = semZero(n.numero);
  const outras = r2((Array.isArray(p.entradaAbatidaNfs) ? p.entradaAbatidaNfs : []).filter((x) => semZero(x.nf) !== nf).reduce((s, x) => s + Number(x.valor || 0), 0));
  const novas = parcelas.filter((x) => x.situacao === "NOVA");
  const somaNovas = r2(novas.reduce((s, x) => s + Number(x.valor || 0), 0));
  const abate = r2(Math.min(Math.max(entrada - outras, 0), somaNovas));
  const pagaTudo = paga + 0.009 >= entrada;
  const critica = pagaTudo ? null : `ENTRADA DO PEDIDO ${p.numero} (R$ ${brl(entrada)}) AINDA NÃO ESTÁ PAGA — A NF ${nf} JÁ FOI LANÇADA SEM ELA; CONFIRA O RECEBIMENTO DA ENTRADA`;
  if (!(abate > 0)) return { pedido: p.numero, pedidoId: p.id, entrada, abate: 0, critica: null, aviso: outras > 0 ? `ENTRADA DO PEDIDO ${p.numero} JÁ ABATIDA EM OUTRA NF` : null };
  // proporcional, mantendo os vencimentos; a última parcela fecha a conta
  const fica = r2(somaNovas - abate);
  let acum = 0;
  novas.forEach((x, i) => {
    x.valorNf = r2(x.valor);
    x.valor = i === novas.length - 1 ? r2(fica - acum) : r2((Number(x.valor) / somaNovas) * fica);
    acum = r2(acum + x.valor);
  });
  for (const x of novas.filter((y) => !(y.valor > 0))) x.marcado = false;   // parcela zerada não vira conta
  return {
    pedido: p.numero, pedidoId: p.id, entrada, paga, abate, critica,
    aviso: `ENTRADA DO PEDIDO ${p.numero} ABATIDA: R$ ${brl(abate)} (${pagaTudo ? "PAGA" : "AINDA NÃO PAGA"}) — PARCELAS DA NF SOMAM R$ ${brl(fica)}`,
  };
}

// depois de gravar a NF: guarda quanto da entrada esta NF abateu (não abate de novo em outra NF)
export async function registrarAbatimento(ent, numeroNf) {
  if (!ent?.pedidoId || !(ent.abate > 0)) return;
  const p = await prisma.pedidoVenda.findUnique({ where: { id: ent.pedidoId }, select: { entradaAbatidaNfs: true } });
  const nf = semZero(numeroNf);
  const lista = (Array.isArray(p?.entradaAbatidaNfs) ? p.entradaAbatidaNfs : []).filter((x) => semZero(x.nf) !== nf);
  lista.push({ nf, valor: ent.abate, em: new Date().toISOString().slice(0, 10) });
  await prisma.pedidoVenda.update({ where: { id: ent.pedidoId }, data: { entradaAbatidaNfs: lista } });
}

// v392 — subir a NF de saída (contas lançadas) é o que fatura o pedido: na hora, sem esperar a próxima listagem
// · pedido ligado à NF pelo KM: fatura quando as NFs do pedido cobrem o total (±2%) e todas têm contas; senão fica parcial/pendente
// · sem ligação pelo KM: a casação pelos itens/valor (faturarPelasNfs) cuida, já exigindo as contas
export async function faturarPeloUpload(n) {
  if (n.tipo !== "SAIDA") return null;
  const { faturarOuPendurar, efetivarFaturamentos, faturarPelasNfs } = await import("@/lib/pedidos");
  let feito = null;
  const { CASAMENTO_AUTOMATICO } = await import("@/lib/pedidos");   // v556 — casamento só manual
  if (!CASAMENTO_AUTOMATICO) { try { await efetivarFaturamentos(); } catch {} return null; }
  const p0 = await pedidoDaNf(n.numero, n.documento);
  if (p0) {
    const p = await prisma.pedidoVenda.findUnique({ where: { id: p0.id }, select: { id: true, status: true, total: true, cnpj: true, kmNfs: true, faturamentoPendente: true } });
    if (p?.status === "ANDAMENTO") {
      const km = Array.isArray(p.kmNfs) ? p.kmNfs : [];
      const nf = semZero(n.numero);
      const nums = [...new Set([...km.map((x) => semZero(x.numero)), ...String(p.faturamentoPendente?.nfNumero || "").split(/[,\s]+/).map(semZero), nf].filter(Boolean))];
      const soma = r2(km.reduce((s, x) => s + Number(x.valor || 0), 0) + (km.some((x) => semZero(x.numero) === nf) ? 0 : Number(n.valor || 0)));
      if (soma >= Number(p.total) * 0.98 || p.faturamentoPendente) {
        const r = await faturarOuPendurar(p.id, p.cnpj, { nfNumero: nums.join(", ").slice(0, 190), faturadoEm: new Date(`${n.emissao}T00:00:00Z`),
          vlEntregar: 0, qtEntregar: 0, atualizadoPorNome: "SISTEMA" }, "NF SUBIDA");
        feito = { pedido: p0.numero, status: r?.status === "FATURADO" ? "FATURADO" : "PENDENTE" };
      }
    }
  }
  try { await efetivarFaturamentos(); await faturarPelasNfs(); } catch (e) { console.log("fiscal/faturar:", e.message); }
  // v450 — NF subida pelo "Incluir faturamento" do pedido e que nenhuma regra ligou: vai para este pedido
  if (n.pedidoNumero && !feito) {
    try { const { vincularNfAoPedido } = await import("@/lib/faturamentoFluxo"); const v = await vincularNfAoPedido(n.pedidoNumero, n); if (v && !v.jaLigada) { await efetivarFaturamentos(); feito = { pedido: v.pedido, status: v.completo ? "FATURADO" : "PARCIAL" }; } }
    catch (e) { console.log("fiscal/vincular:", e.message); }
  }
  return feito;
}
