// v382 — Previsto × realizado: painel de previsão salvo (feito no mês C, prevendo M = C+1) × o que aconteceu em M.
// Só pode ser gerado a partir do 1º dia de M+1. Realizado: baixas do contas a pagar/receber em M, títulos previstos que foram
// pagos/recebidos, quitação provável, prioridades, atrasadas pagas, faturamento (NFs de saída) e a DRE do mês.
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const mesSeguinte = (c) => { const [a, m] = c.split("-").map(Number); const d = new Date(Date.UTC(a, m, 1)); return d.toISOString().slice(0, 7); };
const fimDoMes = (c) => { const [a, m] = c.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
export const liberadoEm = (mesPrevisto) => `${mesSeguinte(mesPrevisto)}-01`;

// todos os painéis salvos (todas as competências), com a análise quando houver
export async function listar() {
  const [ps, ans] = await Promise.all([
    prisma.finMesPainel.findMany({ select: { competencia: true, dados: true }, orderBy: { competencia: "desc" } }),
    prisma.finPrevReal.findMany({ select: { id: true, competencia: true, salvoEm: true, linhas: true, geradoEm: true, geradoPorNome: true } }),
  ]);
  const hoje = hojeSP();
  const out = [];
  for (const p of ps) for (const s of (p.dados?.salvos || [])) {
    const M = s.snapshot?.mesPrevisto || mesSeguinte(p.competencia);
    const a = ans.find((x) => x.competencia === p.competencia && x.salvoEm === s.em);
    const ls = Array.isArray(a?.linhas) ? a.linhas : [];
    out.push({ competencia: p.competencia, salvoEm: s.em, por: s.por, mesPrevisto: M, liberadoEm: liberadoEm(M), liberado: hoje >= liberadoEm(M),
      cenarioMes: s.snapshot?.cenarios?.mes ?? null,
      analise: a ? { id: a.id, geradoEm: a.geradoEm, por: a.geradoPorNome, divergentes: ls.filter((l) => l.divergente).length, justificadas: ls.filter((l) => l.divergente && String(l.justificativa || "").trim()).length, linhas: ls.length } : null });
  }
  return out.sort((a, b) => String(b.salvoEm).localeCompare(String(a.salvoEm)));
}

async function snapshotDe(competencia, salvoEm) {
  const p = await prisma.finMesPainel.findUnique({ where: { competencia }, select: { dados: true } });
  const s = (p?.dados?.salvos || []).find((x) => x.em === salvoEm);
  return s ? { em: s.em, por: s.por, ...s.snapshot } : null;
}

export async function abrir(competencia, salvoEm) {
  const s = await snapshotDe(competencia, salvoEm);
  if (!s) return null;
  const a = await prisma.finPrevReal.findUnique({ where: { competencia_salvoEm: { competencia, salvoEm } } });
  return { competencia, salvoEm, por: s.por, mesPrevisto: s.mesPrevisto, liberadoEm: liberadoEm(s.mesPrevisto), liberado: hojeSP() >= liberadoEm(s.mesPrevisto),
    snapshot: s, analise: a ? { id: a.id, linhas: a.linhas, geradoEm: a.geradoEm, por: a.geradoPorNome } : null };
}

export async function analisar(competencia, salvoEm, quem) {
  const s = await snapshotDe(competencia, salvoEm);
  if (!s) throw new Error("Painel salvo não encontrado.");
  const M = s.mesPrevisto;
  if (hojeSP() < liberadoEm(M)) throw new Error(`O realizado de ${M.split("-").reverse().join("/")} só pode ser gerado a partir de ${liberadoEm(M).split("-").reverse().join("/")}.`);
  const ini = dUTC(`${M}-01`), fim = dUTC(fimDoMes(M));
  const pagosMes = await prisma.finTitulo.findMany({ where: { status: "PAGO", dataPagamento: { gte: ini, lte: fim } }, select: { id: true, tipo: true, valor: true, valorPago: true } });
  const v = (t) => Number(t.valorPago ?? t.valor) || 0;
  const pagoIds = new Set(pagosMes.map((t) => t.id));
  const soma = (l) => r2(l.reduce((a, t) => a + v(t), 0));
  const recebido = soma(pagosMes.filter((t) => t.tipo === "RECEBER")), pago = soma(pagosMes.filter((t) => t.tipo === "PAGAR"));
  // títulos de uma lista do painel: valor previsto (como estava) × o que foi baixado em M
  const L = s.listasMes || {};
  const porIds = async (ids) => {
    const l = (ids || []).length ? await prisma.finTitulo.findMany({ where: { id: { in: ids } }, select: { id: true, valor: true, valorPago: true, status: true, dataPagamento: true } }) : [];
    const ok = l.filter((t) => pagoIds.has(t.id));
    return { previsto: r2(l.reduce((a, t) => a + (Number(t.valor) || 0), 0)), realizado: soma(ok), qtd: l.length, qtdOk: ok.length };
  };
  const sel = s.selecionados || {};
  const conf = (lista) => { const l = lista || []; const ok = l.filter((t) => pagoIds.has(t.id)); return { previsto: r2(l.reduce((a, t) => a + (Number(t.valor) || 0), 0)), realizado: r2(ok.reduce((a, t) => a + (Number(t.valor) || 0), 0)), qtd: l.length, qtdOk: ok.length }; };
  const [rm, pm, at] = await Promise.all([porIds(L.receberMesIds), porIds(L.pagarMesIds), L.pagarAtrasadasIds ? porIds(L.pagarAtrasadasIds) : null]);
  const qu = conf(sel.quitacao), pr = conf(sel.prioridade);
  // faturamento: NFs de saída de venda emitidas em M
  const nfs = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", emissao: { gte: ini, lte: fim }, acao: { not: "REGISTRADA" } }, select: { valor: true } }).catch(() => []);
  const faturado = r2(nfs.reduce((a, n) => a + (Number(n.valor) || 0), 0));
  // DRE do mês previsto
  let dre = null; try { const { dre: f } = await import("@/lib/finDre"); dre = await f(M); } catch {}
  // caixa no fim do mês: bancos do painel do mês previsto (feito no começo de M+1) ou saldo final da DRE
  const prox = await prisma.finMesPainel.findUnique({ where: { competencia: M }, select: { dados: true } }).catch(() => null);
  let caixaFim = null;
  if (prox?.dados?.bancos?.length) caixaFim = r2(prox.dados.bancos.reduce((a, b) => a + (Number(b.saldo) || 0), 0));
  else if (dre) caixaFim = dre.saldoFinal;
  const mem = s.cenarios?.memoria || {}, man = s.manual || {};
  const q = (o) => (o ? `${o.qtdOk} de ${o.qtd} título(s) baixado(s) no mês` : null);
  const linhas = [
    { k: "recebido", grupo: "CAIXA DO MÊS", rotulo: "Entradas do mês (baixas do contas a receber)", previsto: mem.entradasMes ?? null, realizado: recebido, detalhe: "previsto: a receber no mês + quitação provável + recebimentos de pedidos + antecipação" },
    { k: "pago", grupo: "CAIXA DO MÊS", rotulo: "Saídas do mês (baixas do contas a pagar)", previsto: mem.saidasMes ?? null, realizado: pago, detalhe: "previsto: a pagar no mês + prioridades de meses anteriores" },
    { k: "resultado", grupo: "CAIXA DO MÊS", rotulo: "Resultado do mês (entradas − saídas)", previsto: mem.entradasMes != null ? r2(mem.entradasMes - (mem.saidasMes || 0)) : null, realizado: r2(recebido - pago) },
    { k: "cenario", grupo: "CAIXA DO MÊS", rotulo: "Cenário do mês × caixa no fim do mês", previsto: s.cenarios?.mes ?? null, realizado: caixaFim, detalhe: prox?.dados?.bancos?.length ? "realizado: saldo dos bancos no painel seguinte" : "realizado: saldo final da DRE" },
    { k: "receberMes", grupo: "TÍTULOS PREVISTOS", rotulo: "A receber no mês (títulos do painel)", previsto: rm.previsto, realizado: rm.realizado, detalhe: q(rm) },
    { k: "pagarMes", grupo: "TÍTULOS PREVISTOS", rotulo: "A pagar no mês (títulos do painel)", previsto: pm.previsto, realizado: pm.realizado, detalhe: q(pm) },
    { k: "quitacao", grupo: "TÍTULOS PREVISTOS", rotulo: "Quitação provável (atrasados a receber escolhidos)", previsto: qu.previsto, realizado: qu.realizado, detalhe: q(qu) },
    { k: "prioridade", grupo: "TÍTULOS PREVISTOS", rotulo: "Prioridades (atrasadas a pagar escolhidas)", previsto: pr.previsto, realizado: pr.realizado, detalhe: q(pr) },
    ...(at ? [{ k: "atrasadas", grupo: "TÍTULOS PREVISTOS", rotulo: "Contas atrasadas a pagar (todas) pagas no mês", previsto: at.previsto, realizado: at.realizado, detalhe: q(at) }] : []),
    { k: "faturamento", grupo: "PEDIDOS", rotulo: "Entregas programadas × faturado (NFs de saída)", previsto: man.entregasMes?.valor ?? man.pedidosEntregar ?? null, realizado: faturado, detalhe: `${nfs.length} NF(s) de venda emitidas no mês` },
    { k: "recPedidos", grupo: "PEDIDOS", rotulo: "Recebimentos programados de pedidos", previsto: man.recebimentosMes?.valor ?? man.recebimentoMes ?? null, realizado: null, detalhe: "entra nas entradas do mês" },
    ...(dre ? [
      { k: "dreReceita", grupo: "DRE DO MÊS", rotulo: "Receita (DRE) × entradas previstas", previsto: mem.entradasMes ?? null, realizado: dre.operacao.receita },
      { k: "dreResultado", grupo: "DRE DO MÊS", rotulo: "Resultado da operação (DRE)", previsto: mem.entradasMes != null ? r2(mem.entradasMes - (mem.saidasMes || 0)) : null, realizado: dre.operacao.resultado },
      { k: "dreSaldo", grupo: "DRE DO MÊS", rotulo: "Saldo final de caixa (DRE)", previsto: s.cenarios?.mes ?? null, realizado: dre.saldoFinal, detalhe: dre.aIdentificar ? `há ${r2(dre.aIdentificar)} a identificar no mês` : null },
    ] : []),
  ].map((l) => {
    const dif = l.previsto != null && l.realizado != null ? r2(l.realizado - l.previsto) : null;
    const tol = Math.max(100, Math.abs(Number(l.previsto) || 0) * 0.02);
    return { ...l, dif, divergente: dif != null && Math.abs(dif) > tol };
  });
  // mantém as justificativas já escritas
  const ant = await prisma.finPrevReal.findUnique({ where: { competencia_salvoEm: { competencia, salvoEm } } });
  const just = Object.fromEntries((Array.isArray(ant?.linhas) ? ant.linhas : []).map((l) => [l.k, l.justificativa || ""]));
  const final = linhas.map((l) => ({ ...l, justificativa: just[l.k] || "" }));
  await prisma.finPrevReal.upsert({ where: { competencia_salvoEm: { competencia, salvoEm } },
    create: { competencia, salvoEm, mesPrevisto: M, linhas: final, geradoPorNome: quem || null },
    update: { mesPrevisto: M, linhas: final, geradoPorNome: quem || null, geradoEm: new Date() } });
  return abrir(competencia, salvoEm);
}

export async function justificar(competencia, salvoEm, k, texto) {
  const a = await prisma.finPrevReal.findUnique({ where: { competencia_salvoEm: { competencia, salvoEm } } });
  if (!a) throw new Error("Gere o realizado antes de justificar.");
  const linhas = (Array.isArray(a.linhas) ? a.linhas : []).map((l) => (l.k === k ? { ...l, justificativa: String(texto || "").slice(0, 2000) } : l));
  await prisma.finPrevReal.update({ where: { id: a.id }, data: { linhas } });
  return { ok: true };
}
