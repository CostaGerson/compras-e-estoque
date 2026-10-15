// v212 — a Matriz oficial puxa as metas do botão METAS da Gestão (as mesmas que vão para o campo META do KPI)
// e mostra o resultado atingindo a meta do mês da análise. Para mudar a meta: METAS da Gestão, ou um cenário (simulação).
import { prisma } from "@/lib/prisma";

const num = (v) => (v == null || v === "" ? null : Number(v));
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// meses do ano: faturamento e peças (realizado nos fechados, meta nos abertos) e o resultado realizado da DRE
export async function projecaoDoAno(ano) {
  const { relatorio } = await import("@/lib/kpi");
  const { mesesFechados, realizadoDosFechados } = await import("@/lib/kpiMetas");
  const { dre } = await import("@/lib/finDre");
  const [rel, kms] = await Promise.all([relatorio(ano).catch(() => null), prisma.kpiMes.findMany({ where: { ano } })]);
  const fech = await mesesFechados(ano, rel);
  const real = realizadoDosFechados(rel, fech);
  const km = (m) => kms.find((x) => x.mes === m) || {};
  const fatMeses = [], pcsMeses = [], realizado = [];
  for (let i = 0; i < 12; i++) {
    fatMeses.push(fech[i] && real.faturamentoValor[i] != null ? real.faturamentoValor[i] : num(km(i + 1).metaFaturamentoValor));
    pcsMeses.push(fech[i] && real.faturamentoPecas[i] != null ? real.faturamentoPecas[i] : num(km(i + 1).metaFaturamentoPecas));
    let r = null;
    if (fech[i]) {
      const d = await dre(`${ano}-${String(i + 1).padStart(2, "0")}`).catch(() => null);
      if (d && d.lancamentos > 0) r = { receita: d.operacao.receita, lucro: d.operacao.lucro, resultado: d.operacao.resultado, margem: d.operacao.margem };
    }
    realizado.push(r);
  }
  return { fechados: fech, fatMeses, pcsMeses, realizado };
}

export async function metasDaGestao(hoje = new Date()) {
  const ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;
  const [ka, km] = await Promise.all([
    prisma.kpiAno.findUnique({ where: { ano } }).catch(() => null),
    prisma.kpiMes.findUnique({ where: { ano_mes: { ano, mes } } }).catch(() => null),
  ]);
  const fatAno = num(ka?.metaFaturamento), pcsAno = num(ka?.metaPecasFaturadas);
  // mesma regra dos cards do KPI: a meta do mês é a lançada; se não houver, a do ano ÷ 12
  const fatMes = num(km?.metaFaturamentoValor) ?? (fatAno != null ? fatAno / 12 : null);
  const pcsMes = num(km?.metaFaturamentoPecas) ?? (pcsAno != null ? pcsAno / 12 : null);
  const margem = num(ka?.metaMargem), ticketMeta = num(ka?.metaTicketMedio), pctFreelancer = num(ka?.metaPctFreelancer);
  if (fatMes == null && pcsMes == null && margem == null) return null;
  const pecas = pcsMes ? Math.round(pcsMes) : null;
  // v215 — resultados anuais saem das metas do ANO (não do mês × 12): ticket = meta de ticket (METAS) ou faturamento ÷ peças do ano
  const ticket = ticketMeta ?? (fatAno != null && pcsAno ? fatAno / pcsAno : fatMes != null && pecas ? fatMes / pecas : null);
  const fonteTicket = ticketMeta != null ? "meta de ticket médio (METAS)" : fatAno != null && pcsAno ? "meta de faturamento ÷ meta de peças do ano" : "meta de faturamento ÷ meta de peças do mês";
  const pcsMedia = pcsAno ? pcsAno / 12 : fatAno != null && ticket ? fatAno / 12 / ticket : pecas;
  // v239 — fechamento do ano: meses fechados com o REALIZADO (KPI + DRE), meses em aberto com a meta (simulados na Matriz)
  const proj = await projecaoDoAno(ano).catch(() => null);
  return { ano, mes, nomeMes: `${MESES[mes - 1]}/${ano}`, fatAno, fatMes, pcsAno, pcsMes: pecas, pcsMedia,
    ticket, fonteTicket, margem, pctFreelancer, ...(proj || {}) };
}

// v249 — FECHAMENTO: a Matriz OFICIAL não usa metas — mostra o histórico do ano.
//   meses fechados = realizado (KPI + DRE); meses em aberto = previsão pela média dos meses apurados
//   ticket médio = faturamento ÷ peças realizados no ano; % freelancer = folha × freelancer realizado no ano (meses fechados)
//   metas ficam nas SIMULAÇÕES (cenários) e na tela de Metas
export async function historicoDoAno(hoje = new Date()) {
  const ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;
  const proj = await projecaoDoAno(ano).catch(() => null);
  if (!proj) return null;
  const fe = proj.fechados || [];
  const idx = fe.map((f, i) => (f && proj.fatMeses[i] != null ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const fatF = idx.reduce((t, i) => t + (Number(proj.fatMeses[i]) || 0), 0);
  const pcsF = idx.reduce((t, i) => t + (Number(proj.pcsMeses[i]) || 0), 0);
  const fatMed = fatF / idx.length, pcsMed = pcsF / idx.length;
  const ticket = pcsF ? fatF / pcsF : null;
  const fatMeses = proj.fatMeses.map((x, i) => (fe[i] ? x : fatMed));
  const pcsMeses = proj.pcsMeses.map((x, i) => (fe[i] ? x : pcsMed));
  const fatAno = fatMeses.reduce((t, x) => t + (Number(x) || 0), 0), pcsAno = pcsMeses.reduce((t, x) => t + (Number(x) || 0), 0);
  // % de freelancer realizado no ano: Σ freelancer ÷ Σ (folha + freelancer) dos meses fechados
  let pctFreelancer = null;
  try {
    const { freelancerXFolha } = await import("@/lib/rhPainel");
    let fr = 0, cu = 0;
    for (const i of idx) { const r = await freelancerXFolha(`${ano}-${String(i + 1).padStart(2, "0")}`).catch(() => null); if (r?.total?.custo) { fr += r.total.freelancer; cu += r.total.custo; } }
    if (cu) pctFreelancer = Math.round((fr / cu) * 10000) / 10000;
  } catch { pctFreelancer = null; }
  const ult = idx[idx.length - 1];
  const periodo = `${MESES[idx[0]]}–${MESES[ult]}/${ano}`;
  return { historico: true, ano, mes, nomeMes: `${MESES[mes - 1]}/${ano}`, periodo, nFechados: idx.length,
    fatAno, fatMes: fatMed, pcsAno, pcsMes: Math.round(pcsMed), pcsMedia: pcsAno / 12,
    ticket, fonteTicket: `realizado ${periodo}: faturamento ÷ peças`, margem: null, pctFreelancer,
    ...proj, fatMeses, pcsMeses };
}
export async function dadosHistoricos(dados, hoje = new Date()) {
  const h = await historicoDoAno(hoje).catch(() => null);
  if (!h) { const { metasGestao, ...resto } = dados || {}; return resto; }
  return aplicarMetas(dados, h);
}

export { aplicarMetas } from "@/lib/matrizMetasCalc";
import { aplicarMetas } from "@/lib/matrizMetasCalc";

export async function dadosComMetas(dados, hoje = new Date()) {
  return aplicarMetas(dados, await metasDaGestao(hoje).catch(() => null));
}
