// v450 — fluxo do pedido concluído no PCP do Maycon até a entrega:
//   concluído no PCP → "a faturar" + demanda ADM "FATURAR PEDIDO N" (abre o pedido → Incluir faturamento: XML + PDF)
//   NF com contas lançadas → a FATURAR conclui sozinha (parcial: o saldo segue no PCP; tudo concluído de novo → nova FATURAR)
//   → demanda ADM conforme a forma de entrega (FPP › Logística, ou escolhida na tarefa):
//      PRÓPRIA        → PROGRAMAR ENTREGA PEDIDO N (botão cria a demanda de rota já preenchida)
//      TRANSPORTADORA → ENTREGA POR TRANSPORTADORA PEDIDO N
//      FRETEBRAS      → ENTREGA POR FRETEBRAS PEDIDO N
//      RETIRADA       → PROGRAMAR RETIRADA PEDIDO N + mensagem ao vendedor (sem usuário com o nome: setor COMERCIAL)
import { prisma } from "@/lib/prisma";

export const FORMAS = { PROPRIA: "Própria", TRANSPORTADORA: "Transportadora", FRETEBRAS: "Fretebras", RETIRADA: "Retirada" };
export const TIPOS_ENTREGA = ["PROGRAMAR_ENTREGA", "ENTREGA_TRANSPORTADORA", "ENTREGA_FRETEBRAS", "PROGRAMAR_RETIRADA"];
const TIPO_DA_FORMA = { PROPRIA: "PROGRAMAR_ENTREGA", TRANSPORTADORA: "ENTREGA_TRANSPORTADORA", FRETEBRAS: "ENTREGA_FRETEBRAS", RETIRADA: "PROGRAMAR_RETIRADA" };
const TITULO = { PROGRAMAR_ENTREGA: "PROGRAMAR ENTREGA", ENTREGA_TRANSPORTADORA: "ENTREGA POR TRANSPORTADORA", ENTREGA_FRETEBRAS: "ENTREGA POR FRETEBRAS", PROGRAMAR_RETIRADA: "PROGRAMAR RETIRADA" };
const K_INI = "FLUXO_FAT|INICIO", K_VISTAS = "FLUXO_FAT|VISTAS";
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dig = (s) => String(s || "").replace(/\D/g, "");
const semZ = (n) => String(n || "").trim().replace(/^0+(?=\d)/, "");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
export const refNfs = (ref) => String(ref || "").replace(/^NF:/, "").split(",").map(semZ).filter(Boolean);
const juntaEnd = (o) => [[o.logradouro, o.numero].filter(Boolean).join(", "), o.complemento, o.bairro, [o.municipio, o.uf].filter(Boolean).join(" - "), o.cep ? `CEP ${o.cep}` : null].filter(Boolean).join(", ");

async function cfg(k) { return (await prisma.finConfig.findUnique({ where: { chave: k } }).catch(() => null))?.valor || null; }
const setCfg = (chave, valor) => prisma.finConfig.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });

// mensagem do sistema: sai em nome de um master (como os avisos de NF do KM)
async function avisar(paraIds, texto) {
  const para = [...new Set(paraIds.filter(Boolean))];
  if (!para.length) return;
  const m = await prisma.usuario.findFirst({ where: { ativo: true, isMaster: true }, select: { id: true } });
  await prisma.mensagem.createMany({ data: para.map((paraId) => ({ deId: m?.id || paraId, paraId, texto: String(texto).slice(0, 2000) })) }).catch(() => null);
}
const equipe = async (setor) => (await prisma.usuario.findMany({ where: { ativo: true, setor }, select: { id: true } })).map((x) => x.id);

// vendedor do pedido (nome vindo do KM) → usuário(s) do sistema; sem ninguém com o nome, o setor COMERCIAL
export async function usuariosDoVendedor(nome) {
  const t = sem(nome).split(" ").filter((x) => x.length > 1);
  if (t.length) {
    const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true } });
    const ok = us.filter((u) => {
      const ut = sem(`${u.nome} ${u.sobrenome}`).split(" ").filter((x) => x.length > 1);
      if (!ut.length || ut[0] !== t[0]) return false;
      return t.length === 1 || ut.length === 1 || t.slice(1).some((x) => ut.slice(1).includes(x));
    });
    if (ok.length) return { ids: ok.map((u) => u.id), achou: true };
  }
  return { ids: await equipe("COMERCIAL"), achou: false };
}

// forma de entrega: a do pedido (escolhida antes) ou a da FPP base dos itens (FPP › Logística)
export async function formaDoPedido(p) {
  if (FORMAS[p.formaEntrega]) return p.formaEntrega;
  const ci = await prisma.compraItem.findMany({ where: { pedidoNumero: p.numero, fppId: { not: null } }, select: { fppId: true } });
  if (!ci.length) return null;
  const fs = await prisma.fpp.findMany({ where: { id: { in: [...new Set(ci.map((x) => x.fppId))] } }, select: { entradas: true } });
  const f = fs.map((x) => x.entradas?.formaEntrega).find((x) => FORMAS[x]);
  return f || null;
}

const CAMPOS = { id: true, numero: true, cliente: true, cnpj: true, vendedor: true, status: true, interno: true, total: true, qtd: true, vlEntregar: true, qtEntregar: true,
  cronoConcluido: true, cronoSituacao: true, faturamentoPendente: true, nfsFaturadas: true, kmNfs: true, nfNumero: true, formaEntrega: true, updatedAt: true };

function resumoSaldo(p) {
  const pecas = p.qtEntregar != null ? Number(p.qtEntregar) : null;
  const valor = p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total);
  return { pecas, valor };
}

// cria a demanda de entrega conforme a forma (sem forma: PROGRAMAR ENTREGA com a escolha na tarefa)
async function criarEntrega(p, nfs, forma, parcial) {
  const tipo = TIPO_DA_FORMA[forma] || "PROGRAMAR_ENTREGA";
  const sd = resumoSaldo(p);
  const desc = [`Cliente: ${p.cliente}.`, `NF ${nfs.join(", ")} lançada com contas — faturamento ${parcial ? `PARCIAL (falta${sd.pecas != null ? ` ${sd.pecas} peça(s),` : ""} R$ ${brl(sd.valor)})` : "TOTAL"}.`,
    forma ? `Forma de entrega: ${FORMAS[forma]}.` : "Forma de entrega não definida na FPP: escolha na tarefa.",
    tipo === "PROGRAMAR_ENTREGA" && forma === "PROPRIA" ? "Use \"Criar demanda de rota\" para programar a entrega." : null].filter(Boolean).join(" ");
  const d = await prisma.admDemanda.create({ data: {
    titulo: `${TITULO[tipo]} PEDIDO ${p.numero}`, descricao: desc, tipo, pedidoNumero: p.numero, ref: `NF:${nfs.join(",")}`,
    dados: { forma: forma || null, nfs, parcial, pecasPendentes: parcial ? sd.pecas : 0, valorPendente: parcial ? sd.valor : 0 },
    prazo: dUTC(hoje()), criadoPorNome: "SISTEMA" } });
  await avisar(await equipe("ADMINISTRATIVO"), `NOVA DEMANDA ADM: ${d.titulo} — ${desc} — VER EM ADM › DEMANDAS ADM.`);
  if (tipo === "PROGRAMAR_RETIRADA") await avisarRetirada(p, d);
  return d;
}
async function avisarRetirada(p, d) {
  const { ids, achou } = await usuariosDoVendedor(p.vendedor);
  await avisar(ids, `PROGRAMAR RETIRADA PEDIDO ${p.numero} — ${p.cliente}: pedido faturado, combine a retirada com o cliente${achou ? "" : ` (vendedor no pedido: ${p.vendedor || "não informado"})`}. Tarefa em ADM › Demandas ADM #${d.id}.`);
}

// escolha da forma na tarefa PROGRAMAR ENTREGA (ou troca): grava no pedido e transforma a tarefa
export async function escolherForma(id, forma) {
  if (!FORMAS[forma]) return { error: "Forma de entrega inválida." };
  const d = await prisma.admDemanda.findUnique({ where: { id: Number(id) } });
  if (!d || !TIPOS_ENTREGA.includes(d.tipo)) return { error: "Tarefa de entrega não encontrada." };
  if (d.status === "CONCLUIDA") return { error: "Tarefa já concluída." };
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: d.pedidoNumero }, select: CAMPOS });
  if (p) await prisma.pedidoVenda.update({ where: { id: p.id }, data: { formaEntrega: forma } });
  const tipo = TIPO_DA_FORMA[forma];
  const n = await prisma.admDemanda.update({ where: { id: d.id }, data: { tipo, titulo: `${TITULO[tipo]} PEDIDO ${d.pedidoNumero}`, dados: { ...(d.dados || {}), forma },
    descricao: String(d.descricao || "").replace(/Forma de entrega[^.]*\.( escolha na tarefa\.)?/, `Forma de entrega: ${FORMAS[forma]}.`) } });
  if (tipo === "PROGRAMAR_RETIRADA" && p && d.tipo !== "PROGRAMAR_RETIRADA") await avisarRetirada(p, n);
  return { ok: true, demanda: n };
}

// dados para a demanda de rota de entrega (cliente do pedido, endereço do cadastro)
export async function prefillRota(id) {
  const d = await prisma.admDemanda.findUnique({ where: { id: Number(id) } });
  if (!d?.pedidoNumero) return { error: "Tarefa sem pedido." };
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: d.pedidoNumero }, select: { numero: true, cliente: true, cnpj: true, nfNumero: true, kmNfs: true, nfsFaturadas: true } });
  // v479 — pedido com NF emitida: o número da NF vai no "o que fazer" da rota
  const nfs = [...new Set([p?.nfNumero, ...(Array.isArray(p?.kmNfs) ? p.kmNfs.map((x) => x.numero) : []), ...(Array.isArray(p?.nfsFaturadas) ? p.nfsFaturadas.map((x) => x.numero) : [])].filter(Boolean).map(String))];
  const cn = dig(p?.cnpj);
  let c = null;
  if (cn) {
    const fmt = cn.length === 14 ? cn.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : cn;
    c = await prisma.cliente.findFirst({ where: { ativo: true, OR: [{ cnpj: cn }, { cnpj: fmt }] } });
  }
  if (!c && p?.cliente) c = await prisma.cliente.findFirst({ where: { ativo: true, OR: [{ razaoSocial: { equals: p.cliente, mode: "insensitive" } }, { nomeFantasia: { equals: p.cliente, mode: "insensitive" } }] } });
  return { ok: true, nova: {
    objetivo: "ENTREGA", destinoTipo: c ? "CLIENTE" : "OUTRO", destinoId: c?.id || null, destinoNome: sem(c ? c.nomeFantasia || c.razaoSocial : p?.cliente || ""),
    endereco: c ? juntaEnd(c) : "", contato: c?.preposto || "", telefone: c?.telefones || "", tarefa: `ENTREGA PEDIDO ${d.pedidoNumero}${nfs.length ? ` · NF ${nfs.join(", ")}` : ""}`, admOrigemId: d.id,
  } };
}

// a demanda de rota criada pela tarefa conclui a PROGRAMAR ENTREGA
export async function rotaCriada(admId, rota) {
  const d = await prisma.admDemanda.findUnique({ where: { id: Number(admId) } });
  if (!d || d.status === "CONCLUIDA") return;
  await prisma.admDemanda.update({ where: { id: d.id }, data: { status: "CONCLUIDA", rotaDemandaId: rota.id, concluidaEm: new Date(), concluidaPorNome: "SISTEMA",
    retorno: `DEMANDA DE ROTA #${rota.id} CRIADA PARA ${new Date(rota.data).toISOString().slice(0, 10).split("-").reverse().join("/")}` } });
}

// ---------- rotina (roda após a leitura do PCP, a gravação de NFs e ao abrir as demandas ADM) ----------
let rodando = null;
export async function fluxoFaturamento() {
  if (rodando) return rodando;
  rodando = (async () => {
    const { nfsDoPedido, nfsComContas } = await import("@/lib/pedidos");
    let ini = await cfg(K_INI);
    const primeira = !ini;
    if (primeira) { ini = new Date().toISOString(); await setCfg(K_INI, ini); }
    // FATURADO: só os que mexeram desde o início do fluxo (a entrega de pedidos antigos não é reprogramada)
    const ps = await prisma.pedidoVenda.findMany({ where: { interno: false, OR: [{ status: "ANDAMENTO" }, { status: "FATURADO", updatedAt: { gte: new Date(new Date(ini).getTime() - 864e5) } }] }, select: CAMPOS });
    const dems = await prisma.admDemanda.findMany({ where: { pedidoNumero: { not: null } }, select: { id: true, tipo: true, status: true, pedidoNumero: true, ref: true } });
    const pares = ps.flatMap((p) => nfsDoPedido(p).map((x) => ({ nf: x.nf, cnpj: p.cnpj })));
    const ok = await nfsComContas(pares);
    const comContas = (p) => nfsDoPedido(p).map((x) => semZ(x.nf)).filter((nf) => ok.has(`${nf}|${dig(p.cnpj)}`));
    // 1ª vez: as NFs que já têm contas hoje não geram tarefa de entrega (só o que for faturado daqui em diante)
    let vistas = new Set();
    if (primeira) { for (const p of ps) for (const nf of comContas(p)) vistas.add(`${p.numero}|${nf}`); await setCfg(K_VISTAS, JSON.stringify([...vistas])); }
    else { try { vistas = new Set(JSON.parse((await cfg(K_VISTAS)) || "[]")); } catch {} }
    const res = { faturarCriadas: 0, faturarConcluidas: 0, entregas: 0 };
    for (const p of ps) {
      const cc = comContas(p);
      const minhas = dems.filter((d) => d.pedidoNumero === p.numero);
      // A) FATURAR em aberto conclui quando chega NF nova com contas (ou o pedido fechou)
      for (const f of minhas.filter((d) => d.tipo === "FATURAR" && d.status !== "CONCLUIDA")) {
        const antes = refNfs(f.ref);
        const novas = cc.filter((n) => !antes.includes(n));
        if (!novas.length && p.status !== "FATURADO") continue;
        const parcial = p.status !== "FATURADO";
        const sd = resumoSaldo(p);
        await prisma.admDemanda.update({ where: { id: f.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: "SISTEMA",
          retorno: `NF ${novas.join(", ") || p.nfNumero || "—"} LANÇADA COM CONTAS — FATURAMENTO ${parcial ? `PARCIAL (FALTA${sd.pecas != null ? ` ${sd.pecas} PEÇA(S),` : ""} R$ ${brl(sd.valor)})` : "TOTAL"}` } });
        f.status = "CONCLUIDA"; res.faturarConcluidas++;
      }
      // B) concluído no PCP, sem NF pendente de contas → FATURAR (parcial com tudo concluído de novo → nova FATURAR do saldo)
      if (p.status === "ANDAMENTO" && p.cronoConcluido && !p.faturamentoPendente && !minhas.some((d) => d.tipo === "FATURAR" && d.status !== "CONCLUIDA")) {
        const sd = resumoSaldo(p);
        const parcial = cc.length > 0;
        const d = await prisma.admDemanda.create({ data: {
          titulo: `FATURAR PEDIDO ${p.numero}`, tipo: "FATURAR", pedidoNumero: p.numero, ref: `NF:${cc.join(",")}`, prazo: dUTC(hoje()), criadoPorNome: "SISTEMA",
          dados: { parcial, pecasPendentes: sd.pecas, valorPendente: sd.valor },
          descricao: `Cliente: ${p.cliente}. Pedido concluído na expedição (PCP).${parcial ? ` Saldo do faturamento parcial (NF ${cc.join(", ")} já lançada).` : ""} A faturar: ${sd.pecas != null ? `${sd.pecas} peça(s) · ` : ""}R$ ${brl(sd.valor)}. Abra o pedido e use "Incluir faturamento" (XML e PDF da NF).` } });
        dems.push({ id: d.id, tipo: "FATURAR", status: "A_FAZER", pedidoNumero: p.numero, ref: d.ref });
        await avisar(await equipe("ADMINISTRATIVO"), `NOVA DEMANDA ADM: ${d.titulo} — ${d.descricao} — VER EM ADM › DEMANDAS ADM.`);
        res.faturarCriadas++;
      }
      // C) NF nova com contas → tarefa de entrega (uma por faturamento)
      const jaEnt = new Set(minhas.filter((d) => TIPOS_ENTREGA.includes(d.tipo)).flatMap((d) => refNfs(d.ref)));
      const novasEnt = cc.filter((n) => !jaEnt.has(n) && !vistas.has(`${p.numero}|${n}`));
      if (novasEnt.length) {
        const d = await criarEntrega(p, novasEnt, await formaDoPedido(p), p.status !== "FATURADO");
        dems.push({ id: d.id, tipo: d.tipo, status: d.status, pedidoNumero: p.numero, ref: d.ref });
        res.entregas++;
      }
    }
    return res;
  })();
  try { return await rodando; } finally { rodando = null; }
}

// v450 — "Incluir faturamento" no pedido: NF subida pela tela do pedido e que nenhuma regra ligou a ele → liga a este pedido
export async function vincularNfAoPedido(numeroPedido, n) {
  const { lerNfItens, faturarOuPendurar } = await import("@/lib/pedidos");
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: String(numeroPedido) } });
  if (!p || p.status !== "ANDAMENTO") return null;
  const nf = semZ(n.numero);
  const ligada = await prisma.pedidoVenda.findFirst({ where: { OR: [{ nfsFaturadas: { array_contains: [{ numero: nf }] } }, { nfNumero: { contains: nf } }] }, select: { numero: true } });
  if (ligada) return { pedido: ligada.numero, jaLigada: true };
  const itens = n.xml ? lerNfItens(n.xml).itens : [];
  const pecasNf = itens.reduce((a, i) => a + (Number(i.qtd) || 0), 0);
  const lista = [...(Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []), { chave: n.chave || n.chaveRegistro || `NF|${nf}`, numero: nf, emissao: n.emissao, valor: r2(n.valor), modo: "MANUAL", pecas: pecasNf, itens: {} }];
  const valorFat = r2(lista.reduce((a, x) => a + (Number(x.valor) || 0), 0));
  const pecasFat = lista.reduce((a, x) => a + (Number(x.pecas) || 0), 0);
  const qtdPed = Number(p.qtd) || 0;
  const completo = qtdPed > 0 && pecasFat > 0 ? pecasFat >= qtdPed : valorFat >= Number(p.total) * 0.98;
  const nums = lista.map((x) => x.numero).join(", ");
  if (completo) {
    await faturarOuPendurar(p.id, p.cnpj, { status: "FATURADO", nfNumero: nums.slice(0, 190), faturadoEm: dUTC(n.emissao || hoje()), nfsFaturadas: lista, vlEntregar: 0, qtEntregar: 0,
      obs: [p.obs, `FATURADO PELA(S) NF ${nums} — INCLUÍDA(S) NO PEDIDO`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" }, "INCLUIR FATURAMENTO");
  } else {
    await prisma.pedidoVenda.update({ where: { id: p.id }, data: { nfsFaturadas: lista, vlEntregar: r2(Math.max(0, Number(p.total) - valorFat)), qtEntregar: qtdPed ? Math.max(0, qtdPed - pecasFat) : p.qtEntregar,
      obs: [String(p.obs || "").replace(/ · PARCIALMENTE FATURADO[^·]*/g, ""), `PARCIALMENTE FATURADO: NF ${nums} — ${pecasFat} de ${qtdPed || "?"} peças, R$ ${brl(valorFat)}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" } });
  }
  return { pedido: p.numero, completo };
}
