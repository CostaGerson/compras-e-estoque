// v227 — Capacidade × freelancer (Gestão): quanto de mão de obra cada setor precisa para a meta de peças.
// Base: histórico recente da análise folha × freelancer (folha = Matriz; freelancer = DRE/extrato ou contas da semana)
// e as peças faturadas (= produzidas/expedidas) dos KPIs.
// Modelo (por setor, médias mensais da janela):
//   custo de mão de obra por peça = (folha + freelancer) ÷ peças
//   capacidade interna (peças/mês) = peças × folha ÷ (folha + freelancer)   — a parte que a equipe própria entrega
//   peças por pessoa = capacidade interna ÷ pessoas · custo por pessoa = folha ÷ pessoas
//   A) sem aumentar a equipe: freelancer = custo por peça × meta − folha
//   B) mínimo de freelancer: pessoas para cobrir a meta × (1 − folga); o resto vira freelancer
import { prisma } from "@/lib/prisma";
import { freelancerXFolha } from "@/lib/rhPainel";
import { mesAtual, somaMes } from "@/lib/finTitulos";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (free, folha) => (free + folha > 0 ? Math.round((free / (free + folha)) * 10000) / 10000 : null);

export async function analisarCapacidade({ meses = 6, alvo = null, folga = 0.05 } = {}) {
  const n = Math.min(24, Math.max(1, Number(meses) || 6));
  const comps = Array.from({ length: n }, (_, k) => somaMes(mesAtual(), -(k + 1))).reverse();   // meses fechados
  const kpis = await prisma.kpiMes.findMany({ where: { OR: comps.map((c) => ({ ano: Number(c.slice(0, 4)), mes: Number(c.slice(5, 7)) })) } });
  const pecasDe = (c) => { const k = kpis.find((x) => x.ano === Number(c.slice(0, 4)) && x.mes === Number(c.slice(5, 7))); return k?.pecasFaturadas ?? null; };

  const mesesOk = [], porSetor = {};
  for (const c of comps) {
    const pecas = pecasDe(c);
    const fx = await freelancerXFolha(c).catch(() => null);
    const free = fx ? fx.linhas.reduce((s, l) => s + l.freelancer, 0) + (fx.semSetor || 0) : 0;
    mesesOk.push({ comp: c, pecas, folha: r2(fx?.total?.folha || 0), freelancer: r2(free), usado: !!(pecas && fx) });
    if (!pecas || !fx) continue;
    for (const l of fx.linhas) {
      const s = (porSetor[l.setor] ||= { setor: l.setor, folha: 0, freelancer: 0, pessoas: 0, pecas: 0, n: 0 });
      s.folha += l.folha; s.freelancer += l.freelancer; s.pessoas += l.pessoas; s.pecas += pecas; s.n++;
    }
  }
  const usados = mesesOk.filter((m) => m.usado);
  const pecasMedia = usados.length ? usados.reduce((s, m) => s + m.pecas, 0) / usados.length : 0;
  const meta = Number(alvo) > 0 ? Number(alvo) : null;
  const f = Math.min(0.9, Math.max(0, Number(folga) || 0));

  const setores = Object.values(porSetor).map((s) => {
    const folha = s.folha / s.n, free = s.freelancer / s.n, pecas = s.pecas / s.n, pessoas = Math.round((s.pessoas / s.n) * 10) / 10;
    const custoPeca = pecas ? (folha + free) / pecas : 0;
    const capInterna = folha + free > 0 ? pecas * folha / (folha + free) : 0;
    const porPessoa = pessoas ? capInterna / pessoas : null;
    const custoPessoa = pessoas ? folha / pessoas : null;
    const linha = { setor: s.setor, meses: s.n, folha: r2(folha), freelancer: r2(free), pessoas, pecas: Math.round(pecas), pct: pct(free, folha),
      custoPeca: r2(custoPeca), capInterna: Math.round(capInterna), porPessoa: porPessoa != null ? Math.round(porPessoa) : null, custoPessoa: custoPessoa != null ? r2(custoPessoa) : null };
    if (meta) {
      // A — equipe atual: o que passar da capacidade interna vai para freelancer
      const freeA = Math.max(0, custoPeca * meta - folha);
      linha.A = { folha: r2(folha), freelancer: r2(freeA), pessoas, pct: pct(freeA, folha), variacaoFree: r2(freeA - free) };
      // B — mínimo de freelancer: contrata para cobrir (1 − folga) da meta
      if (porPessoa && porPessoa > 0) {
        const nec = Math.ceil((meta * (1 - f)) / porPessoa);
        const novas = Math.max(0, nec - Math.ceil(pessoas));
        const pessoasB = pessoas + novas;
        const folhaB = pessoasB * custoPessoa;
        const freeB = Math.max(0, meta - pessoasB * porPessoa) * custoPeca;
        linha.B = { pessoas: pessoasB, contratar: novas, folha: r2(folhaB), freelancer: r2(freeB), pct: pct(freeB, folhaB), custoTotal: r2(folhaB + freeB), custoA: r2(folha + freeA) };
      } else {
        linha.B = { pessoas: 0, contratar: null, folha: 0, freelancer: r2(freeA), pct: pct(freeA, 0), custoTotal: r2(freeA), custoA: r2(folha + freeA), semEquipe: true };
      }
    }
    return linha;
  }).sort((a, b) => b.folha + b.freelancer - (a.folha + a.freelancer));

  const soma = (k, sub) => r2(setores.reduce((s, l) => s + (sub ? l[sub]?.[k] || 0 : l[k] || 0), 0));
  const total = { folha: soma("folha"), freelancer: soma("freelancer"), pessoas: Math.round(setores.reduce((s, l) => s + l.pessoas, 0) * 10) / 10, pecas: Math.round(pecasMedia) };
  total.pct = pct(total.freelancer, total.folha);
  if (meta) {
    total.A = { folha: soma("folha", "A"), freelancer: soma("freelancer", "A") }; total.A.pct = pct(total.A.freelancer, total.A.folha);
    total.B = { folha: soma("folha", "B"), freelancer: soma("freelancer", "B"), contratar: setores.reduce((s, l) => s + (l.B?.contratar || 0), 0) }; total.B.pct = pct(total.B.freelancer, total.B.folha);
    total.A.custo = r2(total.A.folha + total.A.freelancer); total.B.custo = r2(total.B.folha + total.B.freelancer);
  }
  // meta padrão: a de peças da página Metas (ano ÷ 12)
  const ano = new Date().getFullYear();
  const ka = await prisma.kpiAno.findUnique({ where: { ano } }).catch(() => null);
  const metaMetas = ka?.metaPecasFaturadas ? Math.round(Number(ka.metaPecasFaturadas) / 12) : null;
  return { janela: comps, meses: mesesOk, usados: usados.length, pecasMedia: Math.round(pecasMedia), meta, folga: f, metaMetas, metaFreelancerAtual: ka?.metaPctFreelancer != null ? Number(ka.metaPctFreelancer) : null, setores, total };
}
