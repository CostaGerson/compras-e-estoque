// KPIs da Meridian: vendas, faturamento (R$ e peças), peças produzidas e receita por canal.
// Hoje os números são lançados à mão ou importados do Excel; cada campo vira cálculo automático
// conforme o módulo dono dele nascer (pedidos → vendas; NF de saída → faturamento; cobranças → receita).
import { prisma } from "@/lib/prisma";
import { KPI_MESES, KPI_RECEITAS, KPI_ANOS, SEGMENTOS_PADRAO } from "@/lib/kpiSeed";
import { VENDAS_CLIENTES_2026 } from "@/lib/kpiClientes2026";

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
    select: { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true, diretoria: true },
  });
  return u && u.ativo ? u : null;
}
export const ehMaster = (u) => !!(u && (u.isMaster || (u.setor === "FINANCEIRO" && !u.diretoria)));
// v167 — enxerga valores (master ou diretoria)
export const veValores = (u) => ehMaster(u) || !!u?.diretoria;
export const negadoKpi = (msg = "Acesso negado.") => Response.json({ error: msg }, { status: 403 });

const n = (v) => (v === null || v === undefined ? null : Number(v));
const soma = (l) => l.reduce((s, v) => s + (v || 0), 0);
const div = (a, b) => (b ? a / b : null);

// Carrega os números das planilhas na primeira vez (não sobrescreve nada depois).
// Peças vendidas 2026 (histórico): relatório "Posição Geral de Vendas" 01/01–30/09/2026,
// só vendedores IGOR, GERSON e PEDRO, por mês de EMISSÃO do pedido. Mexe só em vendasPecas.
// Fora: JS TÊXTIL e FONTESLOG — remessas, não vendas. Ranking por cliente em lib/kpiClientes2026.js.
export const PECAS_VENDIDAS_2026 = { 1: 4596, 2: 2198, 3: 14854, 4: 5915, 5: 6895, 6: 10520, 7: 16776, 8: 12316, 9: 12853 };
const CHAVE_PECAS_2026 = "AJUSTE|kpi-pecas-vendidas-2026-v102";
export async function importarPecasVendidas2026() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_PECAS_2026 } }).catch(() => null);
  if (ja) return false;
  for (const [mes, pecas] of Object.entries(PECAS_VENDIDAS_2026)) {
    await prisma.kpiMes.upsert({
      where: { ano_mes: { ano: 2026, mes: Number(mes) } },
      create: { ano: 2026, mes: Number(mes), vendasPecas: pecas, atualizadoPorNome: "RELATÓRIO DE VENDAS 2026" },
      update: { vendasPecas: pecas },
    });
  }
  await prisma.kpiVendaCliente.deleteMany({ where: { ano: 2026, origem: "HISTORICO" } });   // inclui o "entregues" da v101, que saiu
  const data = [
    ...VENDAS_CLIENTES_2026.map(([mes, cliente, pecas]) => ({ ano: 2026, mes, kpi: "vendasPecas", cliente, pecas })),
    ...VENDAS_CLIENTES_2026.map(([mes, cliente, pecas, valor]) => ({ ano: 2026, mes, kpi: "vendasValor", cliente, pecas, valor })),
  ].map((x) => ({ ...x, origem: "HISTORICO" }));
  await prisma.kpiVendaCliente.createMany({ data, skipDuplicates: true });
  await prisma.finConfig.upsert({
    where: { chave: CHAVE_PECAS_2026 },
    create: { chave: CHAVE_PECAS_2026, valor: new Date().toISOString() },
    update: { valor: new Date().toISOString() },
  });
  return true;
}

// Top 10 por cliente de cada KPI no mês.
// vendas (peças e R$): tabela KpiVendaCliente (histórico do relatório de vendas);
// receita: planilha de recebimentos; faturamento: NFs de saída do mês (sem remessa, devolução e retorno) —
// ainda sem NFs classificadas, o menu avisa. Peças produzidas não tem ranking até existir o chão de fábrica.
export const KPIS_RANKING = {
  vendasPecas: { unidade: "peças", fonte: "Pedidos emitidos no mês (relatório de vendas)" },
  vendasValor: { unidade: "R$", fonte: "Pedidos emitidos no mês (relatório de vendas)" },
  faturamentoValor: { unidade: "R$", fonte: "NFs de saída emitidas no mês", vazio: "Ainda não há NFs de saída classificadas neste mês." },
  receitaValor: { unidade: "R$", fonte: "Recebimentos do mês (análise financeira)" },
};
const NAO_VENDA = /REMESSA|DEVOLU|RETORNO/;
export async function rankingClientes(ano, mes, kpi = "vendasPecas", limite = 10) {
  const cfg = KPIS_RANKING[kpi];
  if (!cfg) return { error: "KPI inválido." };
  const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  let mapa = new Map();
  const somar = (nome, v) => { const k = String(nome || "NÃO IDENTIFICADO").trim().toUpperCase() || "NÃO IDENTIFICADO"; mapa.set(k, (mapa.get(k) || 0) + Number(v || 0)); };
  if (kpi === "faturamentoValor") {
    const de = new Date(Date.UTC(ano, mes - 1, 1)), ate = new Date(Date.UTC(ano, mes, 1));
    const nfs = await prisma.finNfSaida.findMany({ where: { emissao: { gte: de, lt: ate } }, select: { destNome: true, valor: true, natureza: true } });
    for (const n of nfs) if (!NAO_VENDA.test(n.natureza || "")) somar(n.destNome, n.valor);
  } else if (kpi === "receitaValor") {
    const comp = `${ano}-${String(mes).padStart(2, "0")}`;
    const rec = await prisma.finRecebimento.findMany({ where: { competencia: comp, bloco: { in: ["CREDITO", "BOLETO"] } }, select: { nomePagador: true, valor: true } });
    for (const x of rec) somar(x.nomePagador, x.valor);
  } else {
    const l = await prisma.kpiVendaCliente.findMany({ where: { ano, mes, kpi } });
    for (const x of l) somar(x.cliente, cfg.unidade === "R$" ? x.valor : x.pecas);
  }
  const lista = [...mapa.entries()].map(([cliente, v]) => ({ cliente, valor: cfg.unidade === "R$" ? r2(v) : Math.round(v) }))
    .filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor || a.cliente.localeCompare(b.cliente));
  const total = r2(lista.reduce((s, x) => s + x.valor, 0));
  return { ano, mes, kpi, unidade: cfg.unidade, fonte: cfg.fonte, vazio: cfg.vazio || null, total, clientes: lista.length, top: lista.slice(0, limite) };
}

export async function garantirKpis() {
  const ja = await prisma.kpiMes.count();
  if (ja > 0) { await importarPecasVendidas2026().catch(() => null); return false; }
  await prisma.kpiMes.createMany({ data: KPI_MESES, skipDuplicates: true });
  await prisma.kpiReceita.createMany({ data: KPI_RECEITAS, skipDuplicates: true });
  for (const a of KPI_ANOS) await prisma.kpiAno.upsert({ where: { ano: a.ano }, create: a, update: {} });
  await importarPecasVendidas2026().catch(() => null);
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
    margem: n(cur.metaAno?.metaMargem),
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
      chave: "faturamentoValor", rotulo: "Faturamento", unidade: "R$",
      valor: l.faturamento.atual, meta: metaMes(l.faturamento.metaValor, r.metas.faturamento),
      serie: serie((x) => x.faturamento.atual), metaSerie: serie((x) => metaMes(x.faturamento.metaValor, r.metas.faturamento)),
      fonte: "Lançamento manual — virá das NFs de saída emitidas",
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
