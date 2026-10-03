// KPIs da Meridian: vendas, faturamento (R$ e peças), peças produzidas e receita por canal.
// Hoje os números são lançados à mão ou importados do Excel; cada campo vira cálculo automático
// conforme o módulo dono dele nascer (pedidos → vendas; NF de saída → faturamento; cobranças → receita).
import { prisma } from "@/lib/prisma";
import { KPI_MESES, KPI_RECEITAS, KPI_ANOS, SEGMENTOS_PADRAO } from "@/lib/kpiSeed";

export const MESES_NOME = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export { SEGMENTOS_PADRAO };

// cores do gráfico de canais — ordem validada para daltonismo (não troque a ordem sem revalidar)
export const CORES_SEGMENTO = ["#2E7CD6", "#FF6B1A", "#0E9384", "#C08401", "#DD2590"];

// Qualquer usuário ativo vê os KPIs; só master/FINANCEIRO lança ou corrige números.
export async function usuarioAtivo(id) {
  const uid = Number(id);
  if (!uid) return null;
  const u = await prisma.usuario.findUnique({
    where: { id: uid },
    select: { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true },
  });
  return u && u.ativo ? u : null;
}
export const ehMaster = (u) => !!(u && (u.isMaster || u.setor === "FINANCEIRO"));
export const negadoKpi = (msg = "Acesso negado.") => Response.json({ error: msg }, { status: 403 });

const n = (v) => (v === null || v === undefined ? null : Number(v));
const soma = (l) => l.reduce((s, v) => s + (v || 0), 0);
const div = (a, b) => (b ? a / b : null);

// Carrega os números das planilhas na primeira vez (não sobrescreve nada depois).
export async function garantirKpis() {
  const ja = await prisma.kpiMes.count();
  if (ja > 0) return false;
  await prisma.kpiMes.createMany({ data: KPI_MESES, skipDuplicates: true });
  await prisma.kpiReceita.createMany({ data: KPI_RECEITAS, skipDuplicates: true });
  for (const a of KPI_ANOS) await prisma.kpiAno.upsert({ where: { ano: a.ano }, create: a, update: {} });
  return true;
}

// Meses decorridos e restantes do ano (base do MtG — "quanto por mês falta para bater a meta").
export function calendario(ano, hoje = new Date()) {
  const anoHoje = hoje.getFullYear();
  if (ano < anoHoje) return { decorridos: 12, restantes: 0, fechado: true };
  if (ano > anoHoje) return { decorridos: 0, restantes: 12, fechado: false };
  const fim = new Date(Date.UTC(ano, 11, 31));
  const dias = Math.max(0, Math.round((fim - hoje) / 86400000));
  return { decorridos: hoje.getMonth() + 1, restantes: Math.max(1, Math.round(dias / 30)), fechado: false };
}

async function dadosDoAno(ano) {
  const [meses, receitas, metaAno] = await Promise.all([
    prisma.kpiMes.findMany({ where: { ano }, orderBy: { mes: "asc" } }),
    prisma.kpiReceita.findMany({ where: { ano }, orderBy: [{ mes: "asc" }, { segmento: "asc" }] }),
    prisma.kpiAno.findUnique({ where: { ano } }),
  ]);
  return { meses, receitas, metaAno };
}

// Relatório completo do ano, no formato da planilha (com o ano anterior ao lado).
export async function relatorio(ano) {
  const [cur, ant] = await Promise.all([dadosDoAno(ano), dadosDoAno(ano - 1)]);
  const cal = calendario(ano);

  const porMes = (ds) => { const m = {}; ds.meses.forEach((x) => (m[x.mes] = x)); return m; };
  const recPorMes = (ds) => {
    const m = {};
    ds.receitas.forEach((r) => { (m[r.mes] = m[r.mes] || {})[r.segmento] = Number(r.valor); });
    return m;
  };
  const C = porMes(cur), A = porMes(ant), RC = recPorMes(cur), RA = recPorMes(ant);

  const segmentos = [...new Set([...SEGMENTOS_PADRAO, ...cur.receitas.map((r) => r.segmento), ...ant.receitas.map((r) => r.segmento)])];

  let acVendas = 0, acVendasAnt = 0, acFat = 0, acFatAnt = 0;
  const linhas = MESES_NOME.map((nome, i) => {
    const mes = i + 1;
    const c = C[mes] || {}, a = A[mes] || {};
    const vAtual = n(c.vendasValor), vAnt = n(a.vendasValor);
    const fAtual = n(c.faturamentoValor), fAnt = n(a.faturamentoValor);
    acVendas += vAtual || 0; acVendasAnt += vAnt || 0;
    acFat += fAtual || 0; acFatAnt += fAnt || 0;
    const rc = RC[mes] || {}, ra = RA[mes] || {};
    const rcTot = soma(Object.values(rc)), raTot = soma(Object.values(ra));
    return {
      mes, nome,
      vendas: { atual: vAtual, anterior: vAnt, pecas: n(c.vendasPecas), mom: div(vAtual, vAnt), acumulado: div(acVendas, acVendasAnt) },
      // Enquanto o chão de fábrica não existe, as peças produzidas são as mesmas da planilha
      // ("Peças Faturadas"). Assim que o mês tiver número próprio, ele manda.
      producao: {
        pecas: n(c.pecasProduzidas) ?? n(c.pecasFaturadas),
        proprio: n(c.pecasProduzidas) !== null,
        meta: n(c.metaPecasProduzidas) ?? n(c.metaFaturamentoPecas),
      },
      faturamento: {
        atual: fAtual, anterior: fAnt, pecas: n(c.pecasFaturadas), pecasAnterior: n(a.pecasFaturadas),
        metaValor: n(c.metaFaturamentoValor), metaPecas: n(c.metaFaturamentoPecas),
        mom: div(fAtual, fAnt), acumulado: div(acFat, acFatAnt),
      },
      receita: { segmentos: rc, total: rcTot || null, anterior: raTot || null, pop: div(rcTot, raTot) },
      metaVendasValor: n(c.metaVendasValor), metaReceitaValor: n(c.metaReceitaValor),
      observacao: c.observacao || null,
    };
  });

  const T = [0, 1, 2, 3].map((t) => {
    const ls = linhas.slice(t * 3, t * 3 + 3);
    const sv = soma(ls.map((l) => l.vendas.atual)), svA = soma(ls.map((l) => l.vendas.anterior));
    const sf = soma(ls.map((l) => l.faturamento.atual)), sfA = soma(ls.map((l) => l.faturamento.anterior));
    return {
      nome: `T${t + 1}`,
      vendas: { atual: sv, anterior: svA, mom: div(sv, svA) },
      faturamento: {
        atual: sf, anterior: sfA, mom: div(sf, sfA),
        pecas: soma(ls.map((l) => l.faturamento.pecas)),
        metaValor: soma(ls.map((l) => l.faturamento.metaValor)),
        metaPecas: soma(ls.map((l) => l.faturamento.metaPecas)),
      },
      receita: { total: soma(ls.map((l) => l.receita.total)) },
    };
  });

  // "SEM NOTA": valor do ano que não pertence a nenhum mês (como na planilha)
  const semNota = { vendas: n(cur.metaAno?.semNotaVendas) || 0, faturamento: n(cur.metaAno?.semNotaFaturamento) || 0 };
  const totVendas = soma(linhas.map((l) => l.vendas.atual)) + semNota.vendas;
  const totFat = soma(linhas.map((l) => l.faturamento.atual)) + semNota.faturamento;
  const totPecas = soma(linhas.map((l) => l.faturamento.pecas));
  const totProd = soma(linhas.map((l) => l.producao.pecas));
  const totReceita = soma(linhas.map((l) => l.receita.total));
  // médias dividem pelos MESES COM NÚMERO LANÇADO, não pelos meses do calendário
  const baseDe = (f) => linhas.filter((l) => f(l) !== null && f(l) !== undefined).length;
  const bases = {
    vendas: baseDe((l) => l.vendas.atual),
    faturamento: baseDe((l) => l.faturamento.atual),
    pecasFaturadas: baseDe((l) => l.faturamento.pecas),
    pecasProduzidas: baseDe((l) => l.producao.pecas),
    receita: baseDe((l) => l.receita.total),
  };
  const media = (total, b) => (b ? total / b : null);

  const metas = {
    vendas: n(cur.metaAno?.metaVendas),
    faturamento: n(cur.metaAno?.metaFaturamento),
    receita: n(cur.metaAno?.metaReceita),
    pecasFaturadas: n(cur.metaAno?.metaPecasFaturadas),
    pecasProduzidas: n(cur.metaAno?.metaPecasProduzidas),
  };
  const gapMtg = (meta, realizado) => {
    if (!meta) return { gap: null, mtg: null };
    const gap = meta - realizado;
    return { gap, mtg: cal.restantes ? gap / cal.restantes : null };
  };

  return {
    ano, anoAnterior: ano - 1, segmentos, calendario: cal, semNota,
    linhas, trimestres: T,
    totais: { vendas: totVendas, faturamento: totFat, pecasFaturadas: totPecas, pecasProduzidas: totProd, receita: totReceita },
    mediaMensal: {
      vendas: media(totVendas, bases.vendas),
      faturamento: media(totFat, bases.faturamento),
      pecasFaturadas: media(totPecas, bases.pecasFaturadas),
      pecasProduzidas: media(totProd, bases.pecasProduzidas),
      receita: media(totReceita, bases.receita),
      bases,
      base: bases.faturamento,   // compatibilidade
    },
    ticketMedio: div(totFat, totPecas),
    metas,
    gap: {
      vendas: gapMtg(metas.vendas, totVendas),
      faturamento: gapMtg(metas.faturamento, totFat),
      receita: gapMtg(metas.receita, totReceita),
    },
  };
}

// Meta do mês: a lançada; se não houver, a do ano dividida por 12.
const metaMes = (mensal, anual) => (mensal != null ? mensal : anual != null ? anual / 12 : null);

// Painel da guia Gestão: os 5 KPIs do mês (contra a meta) + os indicadores do ano.
export async function painel(ano, mes) {
  const r = await relatorio(ano);
  const l = r.linhas[mes - 1] || r.linhas[0];
  const serie = (f) => r.linhas.map(f);

  const kpis = [
    {
      chave: "vendasValor", rotulo: "Vendas", unidade: "R$",
      valor: l.vendas.atual, meta: metaMes(l.metaVendasValor, r.metas.vendas),
      serie: serie((x) => x.vendas.atual), metaSerie: serie((x) => metaMes(x.metaVendasValor, r.metas.vendas)),
      fonte: "Lançamento manual — virá dos pedidos lançados no mês",
    },
    {
      chave: "vendasPecas", rotulo: "Vendas", unidade: "peças",
      valor: l.vendas.pecas, meta: l.faturamento.metaPecas,
      serie: serie((x) => x.vendas.pecas), metaSerie: serie((x) => x.faturamento.metaPecas),
      fonte: "Lançamento manual — virá dos pedidos lançados no mês",
    },
    {
      chave: "pecasProduzidas", rotulo: "Peças produzidas", unidade: "peças",
      valor: l.producao.pecas, meta: metaMes(l.producao.meta, r.metas.pecasProduzidas ?? r.metas.pecasFaturadas),
      serie: serie((x) => x.producao.pecas), metaSerie: serie((x) => metaMes(x.producao.meta, r.metas.pecasProduzidas ?? r.metas.pecasFaturadas)),
      derivado: !l.producao.proprio && l.producao.pecas !== null,
      fonte: l.producao.proprio
        ? "Lançamento manual — virá do chão de fábrica"
        : "Mesmo número das peças faturadas (a planilha não separa) — virá do chão de fábrica",
    },
    {
      chave: "faturamentoValor", rotulo: "Faturamento", unidade: "R$",
      valor: l.faturamento.atual, meta: metaMes(l.faturamento.metaValor, r.metas.faturamento),
      serie: serie((x) => x.faturamento.atual), metaSerie: serie((x) => metaMes(x.faturamento.metaValor, r.metas.faturamento)),
      fonte: "Lançamento manual — virá das NFs de saída emitidas",
    },
    {
      chave: "receitaValor", rotulo: "Receita", unidade: "R$",
      valor: l.receita.total, meta: metaMes(l.metaReceitaValor, r.metas.receita),
      serie: serie((x) => x.receita.total), metaSerie: serie((x) => metaMes(x.metaReceitaValor, r.metas.receita)),
      fonte: "Lançamento manual — virá da baixa das cobranças recebidas",
    },
  ];

  const canais = r.segmentos
    .map((s, i) => ({ segmento: s, valor: l.receita.segmentos[s] || 0, cor: CORES_SEGMENTO[i % CORES_SEGMENTO.length] }))
    .filter((c) => c.valor > 0 || r.segmentos.length <= 5);

  const ant = await relatorio(ano - 1).catch(() => null);
  const variacao = (a, b) => (b ? a / b - 1 : null);

  return {
    ano, mes, nomeMes: MESES_NOME[mes - 1], kpis, canais,
    receitaMes: l.receita.total,
    anuais: {
      ticketMedio: r.ticketMedio,
      mediaPecasFaturadas: r.mediaMensal.pecasFaturadas,
      mediaFaturamento: r.mediaMensal.faturamento,
      bases: r.mediaMensal.bases,
      vsAnterior: ant ? {
        ticketMedio: variacao(r.ticketMedio, ant.ticketMedio),
        mediaPecasFaturadas: variacao(r.mediaMensal.pecasFaturadas, ant.mediaMensal.pecasFaturadas),
        mediaFaturamento: variacao(r.mediaMensal.faturamento, ant.mediaMensal.faturamento),
      } : null,
    },
    totais: r.totais, metas: r.metas, gap: r.gap, calendario: r.calendario,
  };
}

// Anos que já têm número lançado (para o seletor do relatório).
export async function anosDisponiveis() {
  const [m, r] = await Promise.all([
    prisma.kpiMes.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
    prisma.kpiReceita.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
  ]);
  const anos = [...new Set([...m.map((x) => x.ano), ...r.map((x) => x.ano), new Date().getFullYear()])];
  return anos.sort((a, b) => b - a);
}
