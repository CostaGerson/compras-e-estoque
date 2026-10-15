// v229 — Capacidade × freelancer (Gestão), pela diária do freelancer de cada área.
// Por setor e mês (meses fechados com peças lançadas nos KPIs; peças produzidas = faturadas):
//   diárias de freelancer = gasto com freelancer ÷ diária da área
//   freelancers por dia   = diárias ÷ dias úteis do mês (seg a sex)
//   equipe equivalente    = pessoas da Matriz + freelancers por dia
//   peças por trabalhador = peças do mês ÷ equipe equivalente
// Meta Y: trabalhadores necessários = Y ÷ peças por trabalhador; o que passa da equipe atual é a necessidade extra.
//   A) manter a equipe: a necessidade extra vira freelancer (por dia) × dias úteis × diária
//   B) recomendado: necessidade acima de 1 freelancer por dia (o mês útil inteiro) vira contratação — risco
//      trabalhista acima da economia do freelancer; a fração restante (< 1 por dia) continua freelancer
import { prisma } from "@/lib/prisma";
import { freelancerXFolha } from "@/lib/rhPainel";
import { mesAtual, somaMes } from "@/lib/finTitulos";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const pct = (free, folha) => (free + folha > 0 ? Math.round((free / (free + folha)) * 10000) / 10000 : null);
export const CHAVE_DIARIAS = "CAPACIDADE|DIARIAS";

import { diasUteis, feriados } from "@/lib/diasUteis";
import { lerSalarios, custoContratacao } from "@/lib/capacidadeSimulacao";
import { mesesFechados } from "@/lib/kpiMetas";
export { diasUteis, feriados };

export async function lerDiarias() {
  const c = await prisma.finConfig.findUnique({ where: { chave: CHAVE_DIARIAS } }).catch(() => null);
  try { return JSON.parse(c?.valor || "{}") || {}; } catch { return {}; }
}
export async function salvarDiarias(d) {
  const limpo = Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [String(k).toUpperCase(), r2(String(v).replace(",", "."))]).filter(([, v]) => v > 0));
  await prisma.finConfig.upsert({ where: { chave: CHAVE_DIARIAS }, create: { chave: CHAVE_DIARIAS, valor: JSON.stringify(limpo) }, update: { valor: JSON.stringify(limpo) } });
  return limpo;
}

export async function analisarCapacidade({ meses = 6, alvo = null, ano: anoRef = null } = {}) {
  const n = Math.min(24, Math.max(1, Number(meses) || 6));
  const comps = Array.from({ length: n }, (_, k) => somaMes(mesAtual(), -(k + 1))).reverse();   // meses fechados
  const [kpis, diarias, salarios, ofm] = await Promise.all([
    prisma.kpiMes.findMany({ where: { OR: comps.map((c) => ({ ano: Number(c.slice(0, 4)), mes: Number(c.slice(5, 7)) })) } }),
    lerDiarias(), lerSalarios(),
    prisma.finMatriz.findFirst({ where: { oficial: true } }).catch(() => null),
  ]);
  const pecasDe = (c) => { const k = kpis.find((x) => x.ano === Number(c.slice(0, 4)) && x.mes === Number(c.slice(5, 7))); return k?.pecasFaturadas ?? null; };

  const mesesOk = [], porSetor = {};
  for (const c of comps) {
    const pecas = pecasDe(c), du = diasUteis(c);
    const fx = await freelancerXFolha(c).catch(() => null);
    const free = fx ? fx.linhas.reduce((s, l) => s + l.freelancer, 0) + (fx.semSetor || 0) : 0;
    mesesOk.push({ comp: c, pecas, diasUteis: du, folha: r2(fx?.total?.folha || 0), freelancer: r2(free), usado: !!(pecas && fx) });
    if (!pecas || !fx) continue;
    for (const l of fx.linhas) {
      const s = (porSetor[l.setor] ||= { setor: l.setor, meses: [] });
      const diaria = diarias[l.setor] || null;
      const freeDia = diaria ? l.freelancer / diaria / du : null;   // freelancers por dia útil
      s.meses.push({ comp: c, pecas, du, folha: l.folha, freelancer: l.freelancer, pessoas: l.pessoas, freeDia });
    }
  }
  const usados = mesesOk.filter((m) => m.usado);
  const meta = Number(alvo) > 0 ? Number(alvo) : null;
  const duMedio = usados.length ? usados.reduce((s, m) => s + m.diasUteis, 0) / usados.length : 21;

  const setores = Object.values(porSetor).map((s) => {
    const k = s.meses.length, diaria = diarias[s.setor] || null;
    const media = (f) => s.meses.reduce((a, m) => a + f(m), 0) / k;
    const folha = media((m) => m.folha), free = media((m) => m.freelancer), pessoas = r1(media((m) => m.pessoas)), pecas = media((m) => m.pecas);
    const custoPessoa = pessoas ? folha / pessoas : null;
    // v234 — contratação: salário previsto do setor com as regras da Matriz (sem ele, salário médio do setor)
    const cc = custoContratacao(ofm?.dados, s.setor, salarios[s.setor]);
    const custoContr = cc?.custo ?? custoPessoa;
    const linha = { setor: s.setor, meses: k, diaria, salarioPrevisto: salarios[s.setor] || null, salarioBase: cc?.salario ?? null, custoContratacao: custoContr != null ? r2(custoContr) : null, folha: r2(folha), freelancer: r2(free), pessoas, pecas: Math.round(pecas), pct: pct(free, folha), custoPessoa: custoPessoa != null ? r2(custoPessoa) : null };
    if (!diaria) return { ...linha, semDiaria: true };
    const freeDia = media((m) => m.freeDia);
    const mesesAcima1 = s.meses.filter((m) => m.freeDia > 1).length;
    // produtividade: peças ÷ (equipe + freelancers por dia), somando os meses
    const trab = s.meses.reduce((a, m) => a + m.pessoas + m.freeDia, 0);
    const porTrab = trab ? s.meses.reduce((a, m) => a + m.pecas, 0) / trab : null;
    Object.assign(linha, { freeDia: r1(freeDia), diariasMes: Math.round(free / diaria), equipeEq: r1(pessoas + freeDia), porTrab: porTrab ? Math.round(porTrab) : null, mesesAcima1,
      jaPrecisa: mesesAcima1 >= 2 || (k === 1 && mesesAcima1 === 1) });
    if (meta && porTrab) {
      const nec = meta / porTrab;
      const extra = Math.max(0, nec - pessoas);
      // A — manter a equipe: tudo o que falta em freelancer
      const freeA = extra * duMedio * diaria;
      linha.A = { necessarios: r1(nec), freeDia: r1(extra), diarias: Math.round(extra * duMedio), freelancer: r2(freeA), folha: r2(folha), pct: pct(freeA, folha), custo: r2(folha + freeA) };
      // B — recomendado: acima de 1 freelancer por dia útil vira contratação
      const contratar = extra > 1 ? Math.floor(extra + 0.01) : 0;
      const resto = Math.max(0, extra - contratar);
      const folhaB = custoPessoa != null ? folha + contratar * (custoContr ?? custoPessoa) : folha;
      const freeB = resto * duMedio * diaria;
      linha.B = { contratar, freeDia: r1(resto), diarias: Math.round(resto * duMedio), freelancer: r2(freeB), folha: r2(folhaB), pct: pct(freeB, folhaB), custo: r2(folhaB + freeB), semCustoPessoa: custoPessoa == null && contratar > 0 };
    }
    return linha;
  }).sort((a, b) => b.folha + b.freelancer - (a.folha + a.freelancer));

  const soma = (k, sub) => r2(setores.reduce((s, l) => s + (sub ? l[sub]?.[k] || 0 : l[k] || 0), 0));
  const total = { folha: soma("folha"), freelancer: soma("freelancer"), pessoas: r1(setores.reduce((s, l) => s + l.pessoas, 0)), freeDia: r1(setores.reduce((s, l) => s + (l.freeDia || 0), 0)),
    pecas: usados.length ? Math.round(usados.reduce((s, m) => s + m.pecas, 0) / usados.length) : 0, semDiaria: setores.filter((l) => l.semDiaria).map((l) => l.setor) };
  total.pct = pct(total.freelancer, total.folha);
  if (meta) {
    for (const c of ["A", "B"]) {
      total[c] = { folha: soma("folha", c), freelancer: soma("freelancer", c), freeDia: r1(setores.reduce((s, l) => s + (l[c]?.freeDia || 0), 0)), diarias: setores.reduce((s, l) => s + (l[c]?.diarias || 0), 0) };
      // setor sem diária entra com o que tem hoje (não dá para projetar)
      for (const l of setores.filter((x) => x.semDiaria)) { total[c].folha = r2(total[c].folha + l.folha); total[c].freelancer = r2(total[c].freelancer + l.freelancer); }
      total[c].pct = pct(total[c].freelancer, total[c].folha); total[c].custo = r2(total[c].folha + total[c].freelancer);
    }
    total.B.contratar = setores.reduce((s, l) => s + (l.B?.contratar || 0), 0);
  }
  const ano = Number(anoRef) || new Date().getFullYear();
  const ka = await prisma.kpiAno.findUnique({ where: { ano } }).catch(() => null);
  const metaMetas = ka?.metaPecasFaturadas ? Math.round(Number(ka.metaPecasFaturadas) / 12) : null;
  // v231.2 — distribuição mês a mês das Metas (peças faturadas) para a capacidade mensal da simulação
  const km = await prisma.kpiMes.findMany({ where: { ano }, select: { mes: true, metaFaturamentoPecas: true } }).catch(() => []);
  const metaMesesPecas = Array.from({ length: 12 }, (_, i) => { const k = km.find((x) => x.mes === i + 1); return k?.metaFaturamentoPecas ?? null; });
  const fechados = await mesesFechados(ano).catch(() => Array(12).fill(false));
  return { janela: comps, selecionados: n, meses: mesesOk, usados: usados.length, diasUteisMedio: r1(duMedio), meta, metaMetas, metaMesesPecas, anoMetas: ano, fechados, diarias, salarios, setores, total };
}
