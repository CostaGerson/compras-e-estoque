// v212 — a Matriz oficial puxa as metas do botão METAS da Gestão (as mesmas que vão para o campo META do KPI)
// e mostra o resultado atingindo a meta do mês da análise. Para mudar a meta: METAS da Gestão, ou um cenário (simulação).
import { prisma } from "@/lib/prisma";

const num = (v) => (v == null || v === "" ? null : Number(v));
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

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
  const margem = num(ka?.metaMargem);
  if (fatMes == null && pcsMes == null && margem == null) return null;
  const pecas = pcsMes ? Math.round(pcsMes) : null;
  return { ano, mes, nomeMes: `${MESES[mes - 1]}/${ano}`, fatAno, fatMes, pcsAno, pcsMes: pecas,
    ticket: fatMes != null && pecas ? fatMes / pecas : null, margem };
}

// aplica as metas da Gestão nos dados da Matriz (só na oficial)
export function aplicarMetas(dados, mg) {
  if (!dados || !mg) return dados;
  const pr = { ...(dados.producao || {}) };
  if (mg.pcsMes) pr.metaPecas = mg.pcsMes;
  if (mg.ticket != null) pr.ticketMedio = mg.ticket;   // sem arredondar: peças × ticket = meta do mês exata
  if (mg.margem != null) pr.margemContribuicao = mg.margem;
  return { ...dados, producao: pr, metasGestao: mg };
}

export async function dadosComMetas(dados, hoje = new Date()) {
  return aplicarMetas(dados, await metasDaGestao(hoje).catch(() => null));
}
