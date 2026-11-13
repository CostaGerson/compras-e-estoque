// Toda conta da NORT tem o título no padrão "NORT - NOME DA CONTA" (inclusive INSS e FGTS).
// É NORT a conta que: vem de uma recorrência NORT|…, tem rateio em conta-caixa da NORT (grupo NORT da DRE)
// ou traz NORT no título, no fornecedor ou no número do documento.
import { prisma } from "@/lib/prisma";

// v808 — contas da NORT (empresa amiga) não entram em relatórios, atrasados nem nas guias de pagar/receber:
//   ficam só na guia NORT. Toda conta NORT tem o título "NORT - …" (padronizarNort).
// v827 — conta a PAGAR da NORT continua no contas a pagar da Meridian enquanto não for paga; ao ser paga vira empréstimo
//   da Meridian à NORT e passa para a guia NORT (na data do pagamento). Conta a RECEBER da NORT fica só na guia NORT.
export const SEM_NORT = { NOT: { titulo: { startsWith: "NORT - " }, OR: [{ tipo: "RECEBER" }, { status: "PAGO" }] } };
export const SO_NORT = { titulo: { startsWith: "NORT - " } };

const sem = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const temNort = (s) => /(^|[^A-Z])NORT([^A-Z]|$)/.test(sem(s));

export function tituloNort(titulo, extra = "") {
  const t = String(titulo || "").toUpperCase().trim();
  if (/^NORT - \S/.test(t)) return t;
  // tira o NORT de onde estiver e os separadores que sobram
  let base = t.replace(/(^|[^A-ZÀ-Ú])NORT(?=[^A-ZÀ-Ú]|$)/g, "$1").replace(/\s*[—–-]\s*$/, "").replace(/^\s*[—–:\-]\s*/, "").replace(/\s{2,}/g, " ").trim();
  if (!base) {   // título era só "NORT": usa o que o documento diz (INSS, FGTS…)
    const x = sem(extra);
    base = /\bINSS\b/.test(x) ? "INSS" : /\bFGTS\b/.test(x) ? "FGTS" : "CONTA";
  }
  return `NORT - ${base}`.slice(0, 120);
}

export async function contasNort() {
  const { mapaDeContas } = await import("@/lib/finDre");
  const m = await mapaDeContas();
  return new Set(m.filter((c) => c.grupo === "NORT").map((c) => c.id));
}

// Padroniza recorrências e contas em aberto da NORT (roda a cada abertura de contas a pagar/receber)
export async function padronizarNort() {
  const ids = await contasNort();
  const nortRateio = (r) => Array.isArray(r) && r.length && r.every((x) => ids.has(Number(x.contaId)));
  let n = 0;
  const recs = await prisma.finRecorrencia.findMany({ select: { id: true, titulo: true, parceiro: true, rateio: true, chaveOrigem: true } });
  const recNort = new Set();
  for (const r of recs) {
    if (!(String(r.chaveOrigem || "").startsWith("NORT|") || nortRateio(r.rateio) || temNort(r.titulo) || temNort(r.parceiro))) continue;
    recNort.add(r.id);
    const t = tituloNort(r.titulo, r.chaveOrigem);
    if (t !== r.titulo) { await prisma.finRecorrencia.update({ where: { id: r.id }, data: { titulo: t } }); n++; }
  }
  const tits = await prisma.finTitulo.findMany({ where: { status: { not: "CANCELADO" } }, select: { id: true, titulo: true, parceiro: true, numeroDoc: true, rateio: true, recorrenciaId: true } });
  for (const x of tits) {
    if (!(recNort.has(x.recorrenciaId) || nortRateio(x.rateio) || temNort(x.titulo) || temNort(x.parceiro) || temNort(x.numeroDoc))) continue;
    const t = tituloNort(x.titulo, `${x.numeroDoc || ""} ${x.parceiro || ""}`);
    if (t !== x.titulo) { await prisma.finTitulo.update({ where: { id: x.id }, data: { titulo: t } }); n++; }
  }
  return n;
}

// v808 — guia NORT: movimento realizado (lançamentos da DRE) + contas NORT em aberto
//   créditos = lançamentos positivos nas contas-caixa do grupo NORT
//   débitos  = lançamentos negativos no grupo NORT + empréstimos concedidos à NORT (2131600; recebimento 1136000 volta como crédito)
const CONTAS_EMPRESTIMO = ["2131600", "1136000"];
export async function movimentoNort({ de, ate } = {}) {
  const { mapaDeContas } = await import("@/lib/finDre");
  const m = await mapaDeContas();
  const nortIds = m.filter((c) => c.grupo === "NORT").map((c) => c.id);
  const empIds = m.filter((c) => CONTAS_EMPRESTIMO.includes(String(c.codigo))).map((c) => c.id);
  const nomeDe = Object.fromEntries(m.map((c) => [c.id, `${c.codigo} · ${c.nome}`]));
  const where = { desmembrado: false, substituido: false, contaId: { in: [...nortIds, ...empIds] }, ...(de || ate ? { competencia: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } } : {}) };
  let lanc = (await prisma.finLancamento.findMany({ where, orderBy: [{ data: "desc" }, { id: "desc" }], select: { id: true, data: true, competencia: true, historico: true, documento: true, identificacao: true, valor: true, contaId: true, banco: true } }))
    // empréstimo concedido entra só quando é da NORT (histórico/identificação citam a NORT)
    .filter((l) => nortIds.includes(l.contaId) || temNort(`${l.historico} ${l.identificacao || ""} ${l.documento || ""}`))
    .map((l) => ({ ...l, valor: Number(l.valor), data: l.data.toISOString().slice(0, 10), conta: nomeDe[l.contaId] || "—", emprestimo: empIds.includes(l.contaId) }));
  // v827 — contas a pagar da NORT pagas pela Meridian = empréstimo à NORT na data do pagamento
  // v829 — paga pela própria NORT (pagoPor NORT) não é empréstimo; sem a marcação (baixa pelo extrato da Meridian, lote…) = Meridian
  const pagas = await prisma.finTitulo.findMany({ where: { ...SO_NORT, tipo: "PAGAR", status: "PAGO", OR: [{ pagoPor: null }, { pagoPor: { not: "NORT" } }], ...(de || ate ? { dataPagamento: { ...(de ? { gte: new Date(`${de}-01T00:00:00Z`) } : {}), ...(ate ? { lt: new Date(Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)), 1)) } : {}) } } : {}) },
    orderBy: [{ dataPagamento: "desc" }, { id: "desc" }], select: { id: true, titulo: true, parceiro: true, valor: true, valorPago: true, dataPagamento: true, lancamentoId: true, rateio: true } });
  const jaNoTitulo = new Set(pagas.map((t) => t.lancamentoId).filter(Boolean));
  // o pagamento já entra pela conta paga: tira o lançamento ligado a ela ou, sem ligação, o de mesmo valor até 3 dias da data paga
  const usadas = new Set();
  for (let i = lanc.length - 1; i >= 0; i--) {
    const l = lanc[i];
    if (jaNoTitulo.has(l.id)) { lanc.splice(i, 1); continue; }
    if (!(l.valor < 0) || !nortIds.includes(l.contaId)) continue;
    const t = pagas.find((x) => !usadas.has(x.id) && !x.lancamentoId && Math.abs(Number(x.valorPago ?? x.valor) + l.valor) < 0.01 && Math.abs(new Date(l.data) - x.dataPagamento) <= 3 * 864e5);
    if (t) { usadas.add(t.id); lanc.splice(i, 1); }
  }
  for (const t of pagas) lanc.push({ id: `T${t.id}`, tituloId: t.id, data: t.dataPagamento.toISOString().slice(0, 10), competencia: t.dataPagamento.toISOString().slice(0, 7),
    historico: `EMPRÉSTIMO À NORT · PAGAMENTO DE ${t.titulo.replace(/^NORT - /, "")}`, identificacao: t.parceiro, valor: -Number(t.valorPago ?? t.valor), conta: (nomeDe[(t.rateio || [])[0]?.contaId] || "conta a pagar NORT"), emprestimo: true, contaPaga: true });
  lanc.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const abertos = (await prisma.finTitulo.findMany({ where: { ...SO_NORT, tipo: "RECEBER", status: { notIn: ["CANCELADO", "PAGO"] } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] }))
    .map((t) => ({ ...t, valor: Number(t.valor), valorPago: t.valorPago != null ? Number(t.valorPago) : null, vencimento: t.vencimento.toISOString().slice(0, 10) }));
  const r2 = (n) => Math.round(n * 100) / 100;
  const creditos = r2(lanc.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0));
  const debitos = r2(lanc.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0));
  return {
    lancamentos: lanc, abertos,
    totais: { creditos, debitos, saldo: r2(creditos + debitos), emprestimos: r2(lanc.filter((l) => l.emprestimo).reduce((s, l) => s + l.valor, 0)),
      aPagar: r2((await prisma.finTitulo.aggregate({ where: { ...SO_NORT, tipo: "PAGAR", status: "ABERTO" }, _sum: { valor: true } }))._sum.valor || 0), aReceber: r2(abertos.filter((t) => t.tipo === "RECEBER").reduce((s, t) => s + t.valor, 0)) },
  };
}
