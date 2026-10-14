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
  const margem = num(ka?.metaMargem), ticketMeta = num(ka?.metaTicketMedio), pctFreelancer = num(ka?.metaPctFreelancer);
  if (fatMes == null && pcsMes == null && margem == null) return null;
  const pecas = pcsMes ? Math.round(pcsMes) : null;
  // v215 — resultados anuais saem das metas do ANO (não do mês × 12): ticket = meta de ticket (METAS) ou faturamento ÷ peças do ano
  const ticket = ticketMeta ?? (fatAno != null && pcsAno ? fatAno / pcsAno : fatMes != null && pecas ? fatMes / pecas : null);
  const fonteTicket = ticketMeta != null ? "meta de ticket médio (METAS)" : fatAno != null && pcsAno ? "meta de faturamento ÷ meta de peças do ano" : "meta de faturamento ÷ meta de peças do mês";
  const pcsMedia = pcsAno ? pcsAno / 12 : fatAno != null && ticket ? fatAno / 12 / ticket : pecas;
  return { ano, mes, nomeMes: `${MESES[mes - 1]}/${ano}`, fatAno, fatMes, pcsAno, pcsMes: pecas, pcsMedia,
    ticket, fonteTicket, margem, pctFreelancer };
}

export { aplicarMetas } from "@/lib/matrizMetasCalc";
import { aplicarMetas } from "@/lib/matrizMetasCalc";

export async function dadosComMetas(dados, hoje = new Date()) {
  return aplicarMetas(dados, await metasDaGestao(hoje).catch(() => null));
}
