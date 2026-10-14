// v200/v201 — Impostos sobre vendas: previsão mensal pelos RECEBIMENTOS do mês anterior
// (planilha de Recebimentos da análise mensal: blocos Créditos recebidos + Boletos; "A confirmar" fica fora)
//  · ESTADUAL (ICMS e demais estaduais): 2% · vence dia 10
//  · FEDERAL (tributos federais):       5,93% · vence dia 20
// Não é dívida: é a guia do mês. A conta em aberto acompanha os recebimentos até alguém lançar o
// valor da guia (editar a conta marca como ajuste pontual e o sistema não mexe mais nela).
import { prisma } from "@/lib/prisma";
import { r2, mesAtual, somaMes, gerarRecorrencias } from "@/lib/finTitulos";

export const IMPOSTOS_VENDAS = {
  "IMPOSTO|ESTADUAL": { titulo: "ICMS E TRIBUTOS ESTADUAIS SOBRE VENDAS", parceiro: "SECRETARIA DA FAZENDA ESTADUAL", pct: 0.02, dia: 10, conta: "2115110" },
  "IMPOSTO|FEDERAL": { titulo: "TRIBUTOS FEDERAIS SOBRE VENDAS", parceiro: "RECEITA FEDERAL", pct: 0.0593, dia: 20, conta: "2115110" },
};
export const ehImpostoVendas = (k) => !!IMPOSTOS_VENDAS[k];
const CHAVE_CRIADAS = "AJUSTE|impostos-vendas-v200";
const CHAVE_OBS = "AJUSTE|impostos-vendas-recebimentos-v201";
const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const nomeMes = (c) => `${MES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;
const pctTxt = (p) => (p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// recebimentos (planilha de Recebimentos) por competência AAAA-MM — sem planilha = 0
async function recebimentos(comps) {
  const cs = [...new Set(comps)];
  const g = cs.length ? await prisma.finRecebimento.groupBy({
    by: ["competencia"], where: { competencia: { in: cs }, bloco: { in: ["CREDITO", "BOLETO"] } }, _sum: { valor: true },
  }) : [];
  const o = {};
  for (const c of cs) { const x = g.find((y) => y.competencia === c); o[c] = x?._sum?.valor != null ? Number(x._sum.valor) : 0; }
  return o;
}

// Cria as duas recorrências (uma vez — se forem excluídas, não voltam) e recalcula as contas em aberto.
export async function impostosSobreVendas() {
  let criadas = 0;
  if (!(await prisma.finConfig.findUnique({ where: { chave: CHAVE_CRIADAS } }).catch(() => null))) {
    await prisma.finConfig.create({ data: { chave: CHAVE_CRIADAS, valor: new Date().toISOString() } });
    const contas = await prisma.finConta.findMany({ where: { codigo: { in: Object.values(IMPOSTOS_VENDAS).map((x) => x.conta) } } });
    const idC = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
    for (const [chave, g] of Object.entries(IMPOSTOS_VENDAS)) {
      if (await prisma.finRecorrencia.findUnique({ where: { chaveOrigem: chave } })) continue;
      await prisma.finRecorrencia.create({ data: {
        tipo: "PAGAR", titulo: g.titulo, parceiro: g.parceiro, valor: 0, diaVencimento: g.dia, diaUtil: false, periodicidade: 1,
        rateio: idC[g.conta] ? [{ contaId: idC[g.conta], pct: 100 }] : [], inicio: mesAtual(),
        observacao: `PREVISÃO: ${pctTxt(g.pct)} DOS RECEBIMENTOS DO MÊS ANTERIOR (PLANILHA DE RECEBIMENTOS). ATUALIZE COM A GUIA DA CONTABILIDADE.`,
        chaveOrigem: chave, criadoPorNome: "AUTOMÁTICO (IMPOSTOS SOBRE VENDAS)",
      } });
      criadas++;
    }
    if (criadas) await gerarRecorrencias("PAGAR");
  }
  const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: Object.keys(IMPOSTOS_VENDAS) } } });
  if (!recs.length) return { criadas, atualizadas: 0 };
  // v201: a observação da recorrência passa a citar a planilha de recebimentos (uma vez)
  if (!(await prisma.finConfig.findUnique({ where: { chave: CHAVE_OBS } }).catch(() => null))) {
    await prisma.finConfig.create({ data: { chave: CHAVE_OBS, valor: new Date().toISOString() } });
    for (const r of recs) {
      const g = IMPOSTOS_VENDAS[r.chaveOrigem];
      await prisma.finRecorrencia.update({ where: { id: r.id }, data: {
        observacao: `PREVISÃO: ${pctTxt(g.pct)} DOS RECEBIMENTOS DO MÊS ANTERIOR (PLANILHA DE RECEBIMENTOS). ATUALIZE COM A GUIA DA CONTABILIDADE.`,
      } });
    }
  }
  // só as previsões que ninguém ajustou (guia lançada = ajuste pontual ou valor conferido)
  const tits = await prisma.finTitulo.findMany({ where: { recorrenciaId: { in: recs.map((r) => r.id) }, status: "ABERTO", pontual: false, valorConfirmado: false } });
  const fat = await recebimentos(tits.map((t) => somaMes(t.competencia, -1)));
  let atualizadas = 0;
  for (const t of tits) {
    const r = recs.find((x) => x.id === t.recorrenciaId), g = IMPOSTOS_VENDAS[r.chaveOrigem];
    const base = somaMes(t.competencia, -1), f = fat[base] || 0;
    const valor = r2(f * g.pct);
    const observacao = `PREVISÃO: ${pctTxt(g.pct)} × RECEBIMENTOS DE ${nomeMes(base)} (R$ ${brl(f)})${f ? "" : " — PLANILHA DE RECEBIMENTOS DO MÊS SEM VALOR"}. ATUALIZE COM A GUIA DA CONTABILIDADE.`;
    if (Math.abs(Number(t.valor) - valor) < 0.005 && t.observacao === observacao) continue;
    await prisma.finTitulo.update({ where: { id: t.id }, data: { valor, observacao } });
    atualizadas++;
  }
  return { criadas, atualizadas };
}
