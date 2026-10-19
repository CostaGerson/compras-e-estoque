// v279 — Análise da logística: custo logístico por peça a partir da DRE (extrato identificado).
//   custo = pessoal de logística (custo total dos funcionários pela Matriz) + contas de logística da DRE + freelancer de logística;
//   FRETE ENTREGA é só informativo (a FPP cobra o frete à parte, por volume) — fica fora do custo por peça.
//   peças = peças da análise da expedição (as mesmas do KPI).
//   v284 — divisão: a FOLHA de logística volta para a operação (contribuição à operação = folha ÷ peças);
//   os demais custos (combustível, fretebras, freelancer…) não voltam e são o que a FPP cobra (sem folha e sem frete entrega) ÷ peças.
//   Base de cálculo (v280, mesma regra dos outros setores): últimos 6 meses encerrados (v286), média ponderada (custo ÷ peças).
import { prisma } from "@/lib/prisma";
import { freelancerXFolha } from "@/lib/rhPainel";
import { mesAtual, somaMes } from "@/lib/finTitulos";
import { PLANILHA_LOG } from "@/lib/logisticaPlanilha";
import { JANELA_MESES } from "@/lib/opAnalise";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// [chave, rótulo, códigos da DRE, entra no custo?]
export const CONTAS_LOG = [
  ["COMBUSTIVEL", "Combustível", ["2111100"], true],
  ["MANUTENCAO", "Manutenção (viaturas)", ["2116200"], true],
  ["FRETEBRAS", "Fretebras", ["2111320"], true],
  ["UBER", "Uber", ["2111400"], true],
  ["LALAMOVE", "Lalamove", ["2111310"], true],
  ["VIAGEM", "Despesas de viagem", ["2111340"], true],
  ["PEDAGIO", "Pedágio", ["2111330"], true],
  ["FRETE_COMPRA", "Frete compra", ["2111210"], true],
  ["FREELANCER", "Freelancer de logística", ["2117600"], true],
  ["FRETE_ENTREGA", "Frete entrega", ["2111220"], false],
  ["OUTRAS", "Outras (logística externa/interna, correio)", ["2111200", "2111300", "2111500"], false],
];
const CODIGOS = CONTAS_LOG.flatMap(([, , c]) => c);
export const INICIO_LOG = "2025-06";   // primeiro mês da planilha da logística

async function pecasExp(comps) {
  const rows = await prisma.opAnalise.findMany({ where: { setor: "EXPEDICAO", competencia: { in: comps } } });
  const { calcularCorte } = await import("@/lib/opAnalise");
  return Object.fromEntries(rows.map((a) => [a.competencia, calcularCorte(a, 0, 0).pecas]));
}

export async function logisticaMes(comp, ctx = {}) {
  const contas = ctx.contas || await prisma.finConta.findMany({ where: { codigo: { in: CODIGOS } }, select: { id: true, codigo: true } });
  const codDe = Object.fromEntries(contas.map((c) => [c.id, c.codigo]));
  const [lanc, total, semConta, fx] = await Promise.all([
    contas.length ? prisma.finLancamento.findMany({ where: { competencia: comp, desmembrado: false, substituido: false, contaId: { in: contas.map((c) => c.id) } }, select: { contaId: true, valor: true } }) : [],
    prisma.finLancamento.count({ where: { competencia: comp, desmembrado: false, substituido: false } }),
    prisma.finLancamento.aggregate({ where: { competencia: comp, desmembrado: false, substituido: false, contaId: null }, _count: true, _sum: { valor: true } }),
    freelancerXFolha(comp).catch(() => null),
  ]);
  const porCod = {};
  for (const l of lanc) porCod[codDe[l.contaId]] = (porCod[codDe[l.contaId]] || 0) - Number(l.valor);   // saídas negativas → custo positivo
  const valores = Object.fromEntries(CONTAS_LOG.map(([k, , cods]) => [k, r2(cods.reduce((s, c) => s + (porCod[c] || 0), 0))]));
  const pessoal = r2(fx?.linhas?.find((x) => x.setor === "LOGÍSTICA")?.folha || 0);
  const pecas = ctx.pecas?.[comp] || 0;
  const custo = r2(pessoal + CONTAS_LOG.filter(([, , , entra]) => entra).reduce((s, [k]) => s + valores[k], 0));
  const nSem = semConta._count || 0;
  const identificado = total > 0 && nSem === 0;
  const outros = r2(custo - pessoal);
  return {
    comp, pessoal, outros, valores, custo, pecas,
    porPeca: pecas ? custo / pecas : null,
    contribPeca: pecas ? pessoal / pecas : null,      // volta para a operação
    fppPeca: pecas ? outros / pecas : null,           // cobrado na FPP
    freteEntregaPeca: pecas ? valores.FRETE_ENTREGA / pecas : null,
    comFrete: r2(custo + valores.FRETE_ENTREGA),
    lancamentos: total, semConta: nSem, valorSemConta: r2(-(Number(semConta._sum?.valor) || 0)),
    pctIdentificado: total ? (total - nSem) / total : 0,
    identificado, encerrado: comp < mesAtual(),
    planilha: PLANILHA_LOG[comp] || null,
  };
}

export async function analiseLogistica() {
  const fim = somaMes(mesAtual(), -1);
  const ini = somaMes(mesAtual(), -JANELA_MESES);   // v286 — só os últimos 6 meses encerrados
  const comps = [];
  for (let c = ini > INICIO_LOG ? ini : INICIO_LOG; c <= fim; c = somaMes(c, 1)) comps.push(c);
  const contas = await prisma.finConta.findMany({ where: { codigo: { in: CODIGOS } }, select: { id: true, codigo: true } });
  const pecas = await pecasExp(comps);
  const meses = [];
  for (const c of comps) meses.push(await logisticaMes(c, { contas, pecas }));
  const base = meses.filter((m) => m.encerrado && m.pecas > 0);
  const soma = (f) => base.reduce((s, m) => s + f(m), 0);
  const pcs = soma((m) => m.pecas);
  const media = {
    meses: base.map((m) => m.comp),
    custo: r2(soma((m) => m.custo)), pecas: pcs,
    porPeca: pcs ? soma((m) => m.custo) / pcs : null,
    pessoal: r2(soma((m) => m.pessoal)), outros: r2(soma((m) => m.outros)),
    contribPeca: pcs ? soma((m) => m.pessoal) / pcs : null,
    fppPeca: pcs ? soma((m) => m.outros) / pcs : null,
    freteEntregaPeca: pcs ? soma((m) => m.valores.FRETE_ENTREGA) / pcs : null,
  };
  return { contas: CONTAS_LOG.map(([k, n, cods, entra]) => ({ k, n, cods, entra })), meses, media };
}

// número usado pelas outras telas (resumo das Análises, Matriz e FPP)
export async function custoLogisticoPeca() {
  const a = await analiseLogistica();
  return a.media;
}

// FPP: LOGISTICA_BASE (malha e plano) = custos de logística por peça SEM a folha e sem frete entrega (v284), com histórico
export async function atualizarLogisticaFpp(media = null) {
  const m = media || await custoLogisticoPeca();
  if (!m?.fppPeca) return { ok: false, motivo: "sem peças nos últimos 6 meses" };
  const v = r2(m.fppPeca);
  const quem = `SISTEMA · ANÁLISE DA LOGÍSTICA (${m.meses.map((c) => c.slice(5, 7) + "/" + c.slice(2, 4)).join(", ")})`;
  const ps = await prisma.fppParam.findMany({ where: { grupo: "CONST", chave: "LOGISTICA_BASE" } });
  let alterados = 0;
  for (const p of ps) {
    if (Math.abs((Number(p.valor) || 0) - v) <= 0.004) continue;
    await prisma.fppParamHist.create({ data: { paramId: p.id, campo: "valor", deNum: Number(p.valor) || 0, paraNum: v, usuarioNome: quem } }).catch(() => null);
    await prisma.fppParam.update({ where: { id: p.id }, data: { valor: v } });
    alterados++;
  }
  return { ok: true, valor: v, alterados };
}
