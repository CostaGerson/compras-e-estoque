// v555 — casamento NF de venda ↔ pedido em andamento, feito pelo operador (movimento fiscal ou lista da Produção).
// Regras: NF só atende um pedido; as peças da NF não podem passar das peças CONCLUÍDAS na expedição (PCP) que ainda não foram
// faturadas — peça em andamento não é faturada. O casamento grava a NF em nfsFaturadas do pedido (saldo em valor e peças),
// fatura o pedido quando completa (FATURADO com contas lançadas; senão "NF sem contas") e marca a nota com o pedido.
import { prisma } from "@/lib/prisma";
import { faseDe } from "@/lib/producaoGestao";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const so = (s) => String(s || "").replace(/\D/g, "");
const semZ = (n) => String(n || "").trim().replace(/^0+(?=\d)/, "");
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const palavras = (s) => sem(s).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["LTDA", "EIRELI", "S/A", "SA", "ME", "EPP", "DE", "DA", "DO"].includes(w));
const nomeParecido = (a, b) => { const A = palavras(a), B = new Set(palavras(b)); if (!A.length || !B.size) return 0; return A.filter((w) => B.has(w)).length / A.length; };
const normOc = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+/, "");
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// peças do pedido: total, concluídas na expedição (PCP), já faturadas e livres para faturar
export async function pecasDoPedidoInfo(p) {
  const { pecasDoPedido } = await import("@/lib/pedidos");
  const ci = (Array.isArray(p.cronoItens) ? p.cronoItens : []).filter((i) => !i.complemento);
  const emPcp = ci.length > 0;
  const concluidas = ci.filter((i) => faseDe(i.situacao, i.etapa) === "CONCLUIDO").reduce((a, i) => a + (Number(i.pecas ?? i.qtd) || 0), 0);
  const nfs = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
  const faturadas = nfs.reduce((a, n) => a + (Number(n.pecas) || 0), 0);
  const total = pecasDoPedido(p);
  return { total, emPcp, concluidas, faturadas, livres: emPcp ? Math.max(0, concluidas - faturadas) : null, valorFaturado: r2(nfs.reduce((a, n) => a + (Number(n.valor) || 0), 0)) };
}

// dados da NF para casar (do movimento fiscal)
async function nfDe(fn) {
  const { lerNfItens } = await import("@/lib/pedidos");
  const x = fn.xml ? lerNfItens(fn.xml) : null;
  return { id: fn.id, numero: semZ(fn.numero), chave: fn.chave || fn.chaveRegistro, emissao: fn.emissao ? new Date(fn.emissao).toISOString().slice(0, 10) : null,
    documento: so(fn.documento), parceiro: fn.parceiro, valor: r2(fn.valor), pecas: x ? x.itens.reduce((a, i) => a + (Number(i.qtd) || 0), 0) : null, oc: x ? x.oc : [], pedidoNumero: fn.pedidoNumero || null };
}

// onde a NF já está casada (outro pedido)
async function pedidoComNf(numero, chave) {
  const n = semZ(numero);
  const l = await prisma.pedidoVenda.findMany({ where: { OR: [{ nfsFaturadas: { array_contains: [{ numero: n }] } }, ...(chave ? [{ nfsFaturadas: { array_contains: [{ chave }] } }] : []), { nfNumero: { contains: n } }] }, select: { numero: true, nfNumero: true, nfsFaturadas: true } });
  return l.find((p) => (Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.some((x) => semZ(x.numero) === n || (chave && x.chave === chave))) || String(p.nfNumero || "").split(/[,\s]+/).map(semZ).includes(n)) || null;
}

function avaliar(p, info, nf) {
  const doc = so(p.cnpj);
  const mesmoCnpj = doc && nf.documento && doc === nf.documento, mesmaEmpresa = doc.length === 14 && nf.documento.length === 14 && doc.slice(0, 8) === nf.documento.slice(0, 8);
  const nome = nomeParecido(p.cliente, nf.parceiro);
  const ocOk = p.oc && (nf.oc || []).some((o) => normOc(o) && (normOc(p.oc).includes(normOc(o)) || normOc(o).includes(normOc(p.oc))));
  const saldo = p.vlEntregar != null ? Number(p.vlEntregar) : Number(p.total) - info.valorFaturado;
  const valorOk = saldo > 0 && nf.valor <= saldo * 1.05 + 0.01;
  const valorExato = saldo > 0 && Math.abs(nf.valor - saldo) <= Math.max(1, saldo * 0.02);
  let cabe = true, motivo = null;
  if (nf.pecas != null && info.emPcp && nf.pecas > info.livres) { cabe = false; motivo = `NF com ${nf.pecas} peça(s); só ${info.livres} concluída(s) na expedição e não faturada(s)`; }
  if (nf.emissao && p.emissao && new Date(p.emissao).toISOString().slice(0, 10) > nf.emissao) { cabe = false; motivo = "pedido emitido depois da NF"; }
  const score = (mesmoCnpj ? 50 : mesmaEmpresa ? 40 : 0) + Math.round(nome * 25) + (ocOk ? 40 : 0) + (valorExato ? 20 : valorOk ? 8 : 0) + (cabe ? 10 : -30);
  return { score, cabe, motivo, mesmoCliente: mesmoCnpj || mesmaEmpresa || nome >= 0.5, ocOk, valorExato };
}
const linhaPedido = (p, info, a) => ({ numero: p.numero, cliente: p.cliente, oc: p.oc || null, total: r2(p.total), saldo: r2(p.vlEntregar != null ? p.vlEntregar : Number(p.total) - info.valorFaturado),
  pecas: info.total, concluidas: info.emPcp ? info.concluidas : null, faturadas: info.faturadas, livres: info.livres, emPcp: info.emPcp, situacaoPcp: p.cronoSituacao || null, ...a });

const SEL = { id: true, numero: true, cliente: true, cnpj: true, oc: true, total: true, vlEntregar: true, qtEntregar: true, qtd: true, emissao: true, cronoItens: true, cronoSituacao: true, nfsFaturadas: true, status: true, interno: true, obs: true, itens: true };

// pedidos em andamento que a NF pode atender (melhores primeiro)
export async function candidatosParaNf(nf0) {
  const nf = { ...nf0, numero: semZ(nf0.numero), documento: so(nf0.documento), valor: r2(nf0.valor) };
  const ps = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false }, select: SEL });
  const out = [];
  for (const p of ps) {
    const info = await pecasDoPedidoInfo(p);
    const a = avaliar(p, info, nf);
    if (!a.mesmoCliente && !a.ocOk) continue;
    out.push(linhaPedido(p, info, a));
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
export async function candidatosParaNota(fiscalNotaId) {
  const fn = await prisma.fiscalNota.findUnique({ where: { id: Number(fiscalNotaId) } });
  if (!fn || fn.tipo !== "SAIDA") return { error: "NF de saída não encontrada." };
  const nf = await nfDe(fn);
  const ja = await pedidoComNf(nf.numero, nf.chave);
  return { nf, casadaCom: ja?.numero || null, candidatos: ja ? [] : await candidatosParaNf(nf) };
}

// NFs de venda do movimento fiscal ainda sem pedido que podem atender o pedido
export async function nfsParaPedido(numero) {
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: String(numero) }, select: SEL });
  if (!p) return { error: "Pedido não encontrado." };
  const info = await pecasDoPedidoInfo(p);
  const desde = new Date((p.emissao ? new Date(p.emissao).getTime() : Date.now() - 365 * 864e5) - 5 * 864e5);
  const doc = so(p.cnpj);
  const fns = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", emissao: { gte: desde }, acao: { not: "CONTABILIDADE" }, OR: [...(doc.length === 14 ? [{ documento: { startsWith: doc.slice(0, 8) } }] : doc ? [{ documento: doc }] : []), { parceiro: { contains: palavras(p.cliente)[0] || "@@" } }] },
    orderBy: { emissao: "desc" }, take: 60 });
  const usados = await prisma.pedidoVenda.findMany({ select: { numero: true, nfNumero: true, nfsFaturadas: true } });
  const ligada = new Map();
  for (const x of usados) { for (const n of Array.isArray(x.nfsFaturadas) ? x.nfsFaturadas : []) ligada.set(semZ(n.numero), x.numero); for (const n of String(x.nfNumero || "").split(/[,\s]+/).filter(Boolean)) ligada.set(semZ(n), x.numero); }
  const out = [];
  for (const fn of fns) {
    if (/CANCELAD/i.test(fn.motivo || "") || (fn.natureza && !/VENDA/i.test(fn.natureza))) continue;
    const nf = await nfDe(fn);
    const dono = ligada.get(nf.numero);
    if (dono && dono !== p.numero) continue;
    const a = avaliar(p, info, nf);
    if (!a.mesmoCliente && !a.ocOk) continue;
    out.push({ ...nf, jaNestePedido: dono === p.numero, ...a, contas: (Array.isArray(fn.parcelas) ? fn.parcelas : []).filter((x) => x.tituloId).length });
  }
  return { pedido: linhaPedido(p, info, {}), nfs: out.sort((a, b) => Number(a.jaNestePedido) - Number(b.jaNestePedido) || b.score - a.score) };
}

// casa a NF (do movimento fiscal) com o pedido
export async function casarNf({ pedidoNumero, fiscalNotaId, quem }) {
  const fn = await prisma.fiscalNota.findUnique({ where: { id: Number(fiscalNotaId) } });
  if (!fn || fn.tipo !== "SAIDA") return { error: "NF de saída não encontrada no movimento fiscal." };
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: String(pedidoNumero) }, select: SEL });
  if (!p) return { error: "Pedido não encontrado." };
  if (p.status !== "ANDAMENTO") return { error: `Pedido ${p.numero} não está em andamento (${p.status}).` };
  const nf = await nfDe(fn);
  const ja = await pedidoComNf(nf.numero, nf.chave);
  if (ja) return ja.numero === p.numero ? { ok: true, pedido: p.numero, jaCasada: true } : { error: `A NF ${nf.numero} já está casada com o pedido ${ja.numero}.` };
  const info = await pecasDoPedidoInfo(p);
  const a = avaliar(p, info, nf);
  if (!a.cabe) return { error: `Não dá para casar a NF ${nf.numero} com o pedido ${p.numero}: ${a.motivo}. Peça em andamento não pode ser faturada.` };
  const { faturarOuPendurar } = await import("@/lib/pedidos");
  const lista = [...(Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []), { chave: nf.chave, numero: nf.numero, emissao: nf.emissao, valor: nf.valor, pecas: nf.pecas || 0, modo: "MANUAL", itens: {}, casadoPor: quem || null, casadoEm: new Date().toISOString(), fiscalNotaId: fn.id }];
  const valorFat = r2(lista.reduce((s, x) => s + (Number(x.valor) || 0), 0));
  const pecasFat = lista.reduce((s, x) => s + (Number(x.pecas) || 0), 0);
  const completo = info.total > 0 && pecasFat > 0 ? pecasFat >= info.total : valorFat >= Number(p.total) * 0.98;
  const nums = lista.map((x) => x.numero).join(", ");
  if (completo) {
    await faturarOuPendurar(p.id, p.cnpj, { status: "FATURADO", nfNumero: nums.slice(0, 190), faturadoEm: new Date(`${nf.emissao || new Date().toISOString().slice(0, 10)}T00:00:00Z`), nfsFaturadas: lista, vlEntregar: 0, qtEntregar: 0,
      obs: [p.obs, `FATURADO PELA(S) NF ${nums} — CASADA(S) POR ${quem || "—"}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem || "SISTEMA" }, "CASAMENTO MANUAL");
  } else {
    await prisma.pedidoVenda.update({ where: { id: p.id }, data: { nfsFaturadas: lista, vlEntregar: r2(Math.max(0, Number(p.total) - valorFat)), qtEntregar: info.total ? Math.max(0, info.total - pecasFat) : p.qtEntregar,
      obs: [String(p.obs || "").replace(/ · PARCIALMENTE FATURADO[^·]*/g, ""), `PARCIALMENTE FATURADO: NF ${nums} — ${pecasFat} de ${info.total || "?"} peças, ${brl(valorFat)}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem || "SISTEMA" } });
  }
  await prisma.fiscalNota.update({ where: { id: fn.id }, data: { pedidoNumero: p.numero } }).catch(() => null);
  try { const { efetivarFaturamentos } = await import("@/lib/pedidos"); await efetivarFaturamentos(); } catch {}
  return { ok: true, pedido: p.numero, nf: nf.numero, completo, pecas: nf.pecas, aviso: nf.pecas == null ? "NF sem XML: as peças não foram conferidas com a expedição." : !info.emPcp ? "Pedido fora do PCP: peças não conferidas com a expedição." : null };
}

// desfaz o casamento
export async function descasarNf({ pedidoNumero, numero, quem }) {
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: String(pedidoNumero) }, select: { ...SEL, faturamentoPendente: true } });
  if (!p) return { error: "Pedido não encontrado." };
  const n = semZ(numero);
  const antes = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
  const sai = antes.find((x) => semZ(x.numero) === n);
  if (!sai) return { error: `A NF ${n} não está casada com o pedido ${p.numero}.` };
  const lista = antes.filter((x) => semZ(x.numero) !== n);
  const { pecasDoPedido } = await import("@/lib/pedidos");
  const total = pecasDoPedido(p);
  const valorFat = r2(lista.reduce((s, x) => s + (Number(x.valor) || 0), 0)), pecasFat = lista.reduce((s, x) => s + (Number(x.pecas) || 0), 0);
  const nums = lista.map((x) => x.numero).join(", ") || null;
  await prisma.pedidoVenda.update({ where: { id: p.id }, data: { status: "ANDAMENTO", nfsFaturadas: lista, nfNumero: nums, faturadoEm: null, faturamentoPendente: null,
    vlEntregar: r2(Math.max(0, Number(p.total) - valorFat)), qtEntregar: total ? Math.max(0, total - pecasFat) : null,
    obs: [String(p.obs || "").split(" · ").filter((x) => !/^(FATURADO PELA|PARCIALMENTE FATURADO|FATURADO:)/.test(x)).join(" · "), `NF ${n} DESCASADA POR ${quem || "—"}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem || null } });
  await prisma.fiscalNota.updateMany({ where: { tipo: "SAIDA", numero: n, pedidoNumero: p.numero }, data: { pedidoNumero: null } }).catch(() => null);
  return { ok: true };
}

// financeiro do pedido: NFs casadas e as contas a receber delas
export async function financeiroPedido(p) {
  const nfs = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
  const out = [];
  for (const n of nfs) {
    const fn = n.fiscalNotaId ? await prisma.fiscalNota.findUnique({ where: { id: n.fiscalNotaId }, select: { id: true, parcelas: true, documento: true } })
      : await prisma.fiscalNota.findFirst({ where: { tipo: "SAIDA", numero: semZ(n.numero), ...(so(p.cnpj).length === 14 ? { documento: { startsWith: so(p.cnpj).slice(0, 8) } } : {}) }, select: { id: true, parcelas: true, documento: true } });
    const ids = (Array.isArray(fn?.parcelas) ? fn.parcelas : []).map((x) => Number(x.tituloId)).filter(Boolean);
    const ts = ids.length ? await prisma.finTitulo.findMany({ where: { id: { in: ids } }, select: { id: true, titulo: true, valor: true, vencimento: true, status: true, dataPagamento: true, valorPago: true, cobranca: true, antecipadoForma: true }, orderBy: { vencimento: "asc" } }) : [];
    out.push({ numero: n.numero, emissao: n.emissao ? String(n.emissao).slice(0, 10) : null, valor: r2(n.valor), pecas: n.pecas || null, modo: n.modo || null, casadoPor: n.casadoPor || null, fiscalNotaId: fn?.id || null,
      contas: ts.map((t) => ({ id: t.id, titulo: t.titulo, valor: r2(t.valor), vencimento: t.vencimento.toISOString().slice(0, 10), status: t.status, dataPagamento: t.dataPagamento ? t.dataPagamento.toISOString().slice(0, 10) : null,
        antecipado: !!t.antecipadoForma || t.cobranca === "DESCONTADO" })) });
  }
  const contas = out.flatMap((n) => n.contas);
  return { nfs: out, contasTotal: r2(contas.reduce((s, c) => s + c.valor, 0)), recebido: r2(contas.filter((c) => c.status === "PAGO").reduce((s, c) => s + c.valor, 0)),
    emAberto: r2(contas.filter((c) => c.status === "ABERTO").reduce((s, c) => s + c.valor, 0)) };
}

// v556 — remove (uma vez) os casamentos NF ↔ pedido feitos pelas regras automáticas (itens, valor, KM, upload) a partir de out/2026.
// Ficam só os manuais (casamento na conferência/Produção e "Incluir faturamento"). Pedido volta para em andamento com o saldo.
const K_REMOVE = "FAT|REMOVE_AUTO_V556";
const MANUAIS = ["CASAMENTO MANUAL", "INCLUIR FATURAMENTO"];
const MARCAS = /^(FATURADO PELA\(S\) NF|FATURADO PELO VALOR DA NF|PARCIALMENTE FATURADO|FATURADO: NF)/;
export async function removerCasamentosAutomaticos({ desde = "2026-10-01" } = {}) {
  if (await prisma.finConfig.findUnique({ where: { chave: K_REMOVE } }).catch(() => null)) return null;
  const { pecasDoPedido, QUEM_KM } = await import("@/lib/pedidos");
  const d0 = new Date(`${desde}T00:00:00-03:00`);
  const l = await prisma.pedidoVenda.findMany({ where: { interno: false, updatedAt: { gte: d0 }, OR: [
    { status: "FATURADO", atualizadoPorNome: { in: ["SISTEMA", QUEM_KM] } }, { NOT: { faturamentoPendente: { equals: null } } }, { NOT: { nfsFaturadas: { equals: null } } }] },
    select: { id: true, numero: true, status: true, total: true, qtd: true, cronoItens: true, qtEntregar: true, obs: true, nfsFaturadas: true, faturamentoPendente: true, nfNumero: true, faturadoEm: true, atualizadoPorNome: true } });
  const log = [];
  for (const p of l) {
    const todas = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
    const manuais = todas.filter((x) => x.modo === "MANUAL");
    const pend = p.faturamentoPendente && !MANUAIS.includes(p.faturamentoPendente.origem) ? p.faturamentoPendente : null;
    const fatAuto = p.status === "FATURADO" && ["SISTEMA", QUEM_KM].includes(p.atualizadoPorNome) && !(manuais.length && /CASADA|INCLU[ÍI]DA|CASAMENTO MANUAL|INCLUIR FATURAMENTO/.test(String(p.obs || "")));
    if (!pend && !fatAuto && manuais.length === todas.length) continue;
    const total = pecasDoPedido(p);
    const vf = r2(manuais.reduce((s, x) => s + (Number(x.valor) || 0), 0)), pf = manuais.reduce((s, x) => s + (Number(x.pecas) || 0), 0);
    await prisma.pedidoVenda.update({ where: { id: p.id }, data: {
      status: "ANDAMENTO", nfsFaturadas: manuais, nfNumero: manuais.map((x) => x.numero).join(", ") || null, faturadoEm: null,
      faturamentoPendente: pend ? null : p.faturamentoPendente, vlEntregar: r2(Math.max(0, Number(p.total) - vf)), qtEntregar: total ? Math.max(0, total - pf) : null,
      obs: String(p.obs || "").split(" · ").filter((x) => !MARCAS.test(x)).join(" · ") || null, atualizadoPorNome: "SISTEMA (V556)" } });
    log.push({ pedido: p.numero, antes: p.status, nfs: todas.filter((x) => x.modo !== "MANUAL").map((x) => x.numero).concat(fatAuto ? String(p.nfNumero || "").split(/[,\s]+/).filter(Boolean) : []), pendente: pend?.nfNumero || null });
  }
  await prisma.finConfig.create({ data: { chave: K_REMOVE, valor: JSON.stringify({ em: new Date().toISOString(), desde, revertidos: log.length, pedidos: log }).slice(0, 60000) } });
  return log;
}
