// v213 — Página de METAS da Gestão: meta anual de cada natureza e a distribuição mês a mês.
// As metas daqui vão para o campo META dos KPIs e para a Matriz oficial (lib/matrizMetas.js).
import { prisma } from "@/lib/prisma";
import { relatorio, anosDisponiveis } from "@/lib/kpi";

// natureza → onde fica a meta do ano (KpiAno), a do mês (KpiMes) e o realizado (linha do relatório)
export const NATUREZAS = [
  { k: "vendasValor", grupo: "Vendas", rotulo: "Vendas (R$)", un: "R$", ano: "metaVendas", mes: "metaVendasValor", real: (l) => l.vendas.atual },
  { k: "vendasPecas", grupo: "Vendas", rotulo: "Vendas (peças)", un: "pc", ano: "metaVendasPecas", mes: "metaVendasPecas", real: (l) => l.vendas.pecas },
  { k: "faturamentoValor", grupo: "Faturamento", rotulo: "Faturamento (R$)", un: "R$", ano: "metaFaturamento", mes: "metaFaturamentoValor", real: (l) => l.faturamento.atual },
  { k: "faturamentoPecas", grupo: "Faturamento", rotulo: "Faturamento (peças faturadas)", un: "pc", ano: "metaPecasFaturadas", mes: "metaFaturamentoPecas", real: (l) => l.faturamento.pecas },
  { k: "receitaValor", grupo: "Receita", rotulo: "Receita (R$)", un: "R$", ano: "metaReceita", mes: "metaReceitaValor", real: (l) => l.receita.total },
  { k: "pecasProduzidas", grupo: "Produção", rotulo: "Peças produzidas", un: "pc", ano: "metaPecasProduzidas", mes: "metaPecasProduzidas", real: (l) => (l.producao.proprio ? l.producao.pecas : null) },
];
const num = (v) => (v == null || v === "" ? null : Number(v));
const r2 = (v) => Math.round(Number(v) * 100) / 100;

// médias mensais do realizado numa janela de anos (mês sem dado em nenhum ano = média dos outros meses)
function medias(porAno, anos) {
  const m = [];
  for (let i = 0; i < 12; i++) {
    const v = anos.map((a) => porAno[a]?.[i]).filter((x) => x != null && x > 0);
    m.push(v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
  }
  const ok = m.filter((x) => x != null);
  if (!ok.length) return null;
  const media = ok.reduce((s, x) => s + x, 0) / ok.length;
  return m.map((x) => r2(x ?? media));
}

export async function metasDoAno(ano) {
  const a = Number(ano);
  const [kAno, kMes, anos] = await Promise.all([
    prisma.kpiAno.findUnique({ where: { ano: a } }),
    prisma.kpiMes.findMany({ where: { ano: a } }),
    anosDisponiveis(),
  ]);
  const passados = anos.filter((x) => x < a).sort((x, y) => y - x);
  const rels = {};
  for (const y of passados) rels[y] = await relatorio(y).catch(() => null);
  const mesDe = (m) => kMes.find((x) => x.mes === m) || {};

  const naturezas = NATUREZAS.map((n) => {
    const anual = num(kAno?.[n.ano]);
    let meses = [...Array(12)].map((_, i) => num(mesDe(i + 1)[n.mes]));
    // como está hoje: mês sem meta própria = ano ÷ 12; peças vendidas e produzidas herdam a meta de peças faturadas (regra antiga do KPI)
    const herda = (n.k === "vendasPecas" || n.k === "pecasProduzidas") && anual == null && meses.every((x) => x == null);
    let alvo = anual, derivado;
    if (herda) {
      const pf = NATUREZAS.find((x) => x.k === "faturamentoPecas");
      alvo = num(kAno?.[pf.ano]);
      const proprios = [...Array(12)].map((_, i) => num(mesDe(i + 1)[pf.mes]));
      derivado = proprios.map((x) => x == null);
      meses = proprios.map((x) => x ?? (alvo != null ? alvo / 12 : null));
    } else {
      derivado = meses.map((x) => x == null);
      meses = meses.map((x) => x ?? (anual != null ? anual / 12 : null));
    }
    meses = meses.map((x) => (x == null ? null : n.un === "pc" ? Math.round(x) : r2(x)));
    // sobra do arredondamento do "ano ÷ 12" vai para o último mês derivado (a soma fecha com a meta do ano)
    if (alvo != null && derivado.some(Boolean) && meses.every((x) => x != null)) {
      const dif = alvo - meses.reduce((s, x) => s + x, 0);
      const ult = derivado.lastIndexOf(true);
      if (Math.abs(dif) >= 0.005) meses[ult] = n.un === "pc" ? Math.round(meses[ult] + dif) : r2(meses[ult] + dif);
    }
    const soma = meses.some((x) => x != null) ? meses.reduce((s, x) => s + (x || 0), 0) : null;

    const porAno = {};
    for (const y of passados) if (rels[y]) porAno[y] = rels[y].linhas.map((l) => { const v = n.real(l); return v == null ? null : Number(v); });
    const comDado = passados.filter((y) => porAno[y]?.some((x) => x != null && x > 0));
    const historico = {
      total: { anos: comDado, medias: medias(porAno, comDado) },
      dois: { anos: comDado.filter((y) => y >= a - 2), medias: medias(porAno, comDado.filter((y) => y >= a - 2)) },
      um: { anos: comDado.filter((y) => y === a - 1), medias: medias(porAno, comDado.filter((y) => y === a - 1)) },
    };
    return { k: n.k, grupo: n.grupo, rotulo: n.rotulo, un: n.un, anual: anual ?? (soma != null ? (n.un === "pc" ? Math.round(soma) : r2(soma)) : null), anualGravado: anual != null, meses, historico };
  });
  return { ano: a, margem: num(kAno?.metaMargem), ticket: num(kAno?.metaTicketMedio), naturezas };
}

// grava: { k: { anual, meses[12] } } e margem (fração)
export async function salvarMetas(ano, metas, margem, quem, ticket) {
  const a = Number(ano);
  const dAno = {};
  if (margem !== undefined) dAno.metaMargem = margem;
  if (ticket !== undefined) dAno.metaTicketMedio = ticket == null ? null : r2(ticket);
  const porMes = [...Array(12)].map(() => ({}));
  for (const n of NATUREZAS) {
    const x = metas?.[n.k];
    if (!x) continue;
    const v = num(x.anual);
    dAno[n.ano] = v == null ? null : n.un === "pc" ? Math.round(v) : r2(v);
    (x.meses || []).slice(0, 12).forEach((mv, i) => {
      const y = num(mv);
      porMes[i][n.mes] = y == null ? null : n.un === "pc" ? Math.round(y) : r2(y);
    });
  }
  await prisma.kpiAno.upsert({ where: { ano: a }, create: { ano: a, ...dAno }, update: dAno });
  for (let i = 0; i < 12; i++) {
    if (!Object.keys(porMes[i]).length) continue;
    const data = { ...porMes[i], atualizadoPorNome: quem || null };
    await prisma.kpiMes.upsert({ where: { ano_mes: { ano: a, mes: i + 1 } }, create: { ano: a, mes: i + 1, ...data }, update: data });
  }
  return metasDoAno(a);
}
