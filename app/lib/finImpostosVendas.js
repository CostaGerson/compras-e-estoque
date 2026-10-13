// v200 — Impostos sobre vendas: previsão mensal pelo faturamento do mês anterior (KPIs)
//  · ESTADUAL (ICMS e demais estaduais): 2% · vence dia 10
//  · FEDERAL (tributos federais):       5,93% · vence dia 20
// Não é dívida: é a guia do mês. A conta em aberto acompanha o faturamento dos KPIs até alguém lançar o
// valor da guia (editar a conta marca como ajuste pontual e o sistema não mexe mais nela).
import { prisma } from "@/lib/prisma";
import { r2, mesAtual, somaMes, gerarRecorrencias } from "@/lib/finTitulos";

export const IMPOSTOS_VENDAS = {
  "IMPOSTO|ESTADUAL": { titulo: "ICMS E TRIBUTOS ESTADUAIS SOBRE VENDAS", parceiro: "SECRETARIA DA FAZENDA ESTADUAL", pct: 0.02, dia: 10, conta: "2115110" },
  "IMPOSTO|FEDERAL": { titulo: "TRIBUTOS FEDERAIS SOBRE VENDAS", parceiro: "RECEITA FEDERAL", pct: 0.0593, dia: 20, conta: "2115110" },
};
export const ehImpostoVendas = (k) => !!IMPOSTOS_VENDAS[k];
const CHAVE_CRIADAS = "AJUSTE|impostos-vendas-v200";
const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const nomeMes = (c) => `${MES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;
const pctTxt = (p) => (p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// faturamento (KPIs) de uma competência AAAA-MM — sem lançamento = 0
async function faturamentos(comps) {
  const pares = [...new Set(comps)].map((c) => ({ ano: Number(c.slice(0, 4)), mes: Number(c.slice(5, 7)) }));
  const l = pares.length ? await prisma.kpiMes.findMany({ where: { OR: pares } }) : [];
  const o = {};
  for (const c of new Set(comps)) {
    const k = l.find((x) => x.ano === Number(c.slice(0, 4)) && x.mes === Number(c.slice(5, 7)));
    o[c] = k?.faturamentoValor != null ? Number(k.faturamentoValor) : 0;
  }
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
        observacao: `PREVISÃO: ${pctTxt(g.pct)} DO FATURAMENTO DO MÊS ANTERIOR (KPIS). ATUALIZE COM A GUIA DA CONTABILIDADE.`,
        chaveOrigem: chave, criadoPorNome: "AUTOMÁTICO (IMPOSTOS SOBRE VENDAS)",
      } });
      criadas++;
    }
    if (criadas) await gerarRecorrencias("PAGAR");
  }
  const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: Object.keys(IMPOSTOS_VENDAS) } } });
  if (!recs.length) return { criadas, atualizadas: 0 };
  // só as previsões que ninguém ajustou (guia lançada = ajuste pontual ou valor conferido)
  const tits = await prisma.finTitulo.findMany({ where: { recorrenciaId: { in: recs.map((r) => r.id) }, status: "ABERTO", pontual: false, valorConfirmado: false } });
  const fat = await faturamentos(tits.map((t) => somaMes(t.competencia, -1)));
  let atualizadas = 0;
  for (const t of tits) {
    const r = recs.find((x) => x.id === t.recorrenciaId), g = IMPOSTOS_VENDAS[r.chaveOrigem];
    const base = somaMes(t.competencia, -1), f = fat[base] || 0;
    const valor = r2(f * g.pct);
    const observacao = `PREVISÃO: ${pctTxt(g.pct)} × FATURAMENTO DE ${nomeMes(base)} (R$ ${brl(f)})${f ? "" : " — SEM FATURAMENTO LANÇADO NOS KPIS"}. ATUALIZE COM A GUIA DA CONTABILIDADE.`;
    if (Math.abs(Number(t.valor) - valor) < 0.005 && t.observacao === observacao) continue;
    await prisma.finTitulo.update({ where: { id: t.id }, data: { valor, observacao } });
    atualizadas++;
  }
  return { criadas, atualizadas };
}
