// v182 — Análises operacionais da produção. Corte: peças processadas por categoria (planilha do sistema de produção),
// custo do setor = pessoal (custo total da folha pela Matriz) + freelancers do corte identificados no mês.
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { freelancerXFolha } from "@/lib/rhPainel";

export const SETORES_OP = {
  CORTE: { nome: "Corte", setorFolha: "CORTE" },
  PERSONALIZACAO: { nome: "Personalização", sub: "Silk, bordado, DTF e sublimação" },
  COSTURA: { nome: "Costura", setorFolha: "COSTURA" },
  EXPEDICAO: { nome: "Expedição", setorFolha: "EXPEDIÇÃO" },
};

// categorias do corte (ordem da planilha) e valor unitário de mercado padrão
export const CATEGORIAS_CORTE = [
  ["PILOTO", "Piloto", 20], ["ENTRETELA", "Entretela", 0], ["FAIXA", "Faixa", 0], ["CAMISETA", "Camiseta", 0.75], ["POLO", "Polo", 0.9],
  ["MOLETOM", "Moletom", 1], ["JAQUETA", "Jaqueta", 1.5], ["CAMISA_SOCIAL", "Camisa social", 2], ["JALECO_OPERACIONAL", "Jaleco operacional", 1.5],
  ["CALCA_OPERACIONAL", "Calça operacional", 1.5], ["CALCA_JEANS", "Calça jeans", 1.7], ["CALCA_SOCIAL", "Calça social", 1.7],
  ["AVENTAL", "Avental", 0], ["FORRO", "Forro", 0],
];
export const MERCADO_PADRAO = Object.fromEntries(CATEGORIAS_CORTE.map(([k, , v]) => [k, v]));
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const chaveCat = (t) => { const k = sa(t); return CATEGORIAS_CORTE.some(([c]) => c === k) ? k : null; };
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

// ---------------- leitura das planilhas ----------------
// (1) exportação do sistema de produção "analise-corte_AAAA-MM-DD_a_AAAA-MM-DD.xlsx": aba Conferência (pedido a pedido) ou aba Análise
// (2) planilha histórica "Análise Corte AAAA.xlsx": uma aba por mês (Janeiro…Dezembro) com QTDE, pessoal, freelancers, metas e causas
const ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
function compDaAba(nomeAba, anoArq) {
  const t = sa(nomeAba);
  if (!t || t === "CONFERENCIA" || t === "ANALISE") return null;
  const partes = t.split("_");
  let mes = -1;
  partes.forEach((p) => { if (mes < 0) { const i = MESES.indexOf(p); const j = ABREV.indexOf(p.slice(0, 3)); if (i >= 0) mes = i; else if (j >= 0 && (p.length === 3 || MESES[j].startsWith(p))) mes = j; } });
  let ano = (t.match(/20\d{2}/) || [])[0];
  if (mes < 0) { const m = t.match(/^(\d{1,2})_(20\d{2}|\d{2})$/); if (m && +m[1] >= 1 && +m[1] <= 12) { mes = +m[1] - 1; ano = m[2].length === 2 ? "20" + m[2] : m[2]; } }
  if (mes < 0) return null;
  if (!ano) { const m2 = t.match(/_(\d{2})$/); ano = m2 ? "20" + m2[1] : anoArq; }
  return `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

export function lerPlanilhaCorte(buf, nome = "", compPadrao = null) {
  const wb = XLSX.read(buf, { type: "buffer" });
  // v182.1 — aba por mês: aceita nome completo ou abreviado ("Janeiro", "JAN", "Set-26", "CORTE MARÇO 2026", "03/2026")
  const anoArq = (String(nome).match(/20\d{2}/) || [])[0] || String(new Date().getFullYear());
  const mesesAbas = wb.SheetNames.map((n) => ({ n, c: compDaAba(n, anoArq) })).filter((x) => x.c);
  if (mesesAbas.length) {
    const vistos = new Set();
    const analises = mesesAbas.map((x) => lerAbaAnalise(wb.Sheets[x.n], x.c, true))
      .filter((a) => a.total > 0 && !vistos.has(a.competencia) && vistos.add(a.competencia));
    if (analises.length) return { tipo: "HISTORICO", analises };
  }
  const m = String(nome).match(/(\d{4})-(\d{2})-\d{2}/);
  const competencia = m ? `${m[1]}-${m[2]}` : compPadrao;
  const conf = wb.SheetNames.find((n) => sa(n) === "CONFERENCIA");
  if (conf) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[conf], { defval: null });
    const qtds = {}, detalhe = [];
    let semCategoria = 0;
    for (const l of linhas) {
      const g = (k) => l[Object.keys(l).find((x) => sa(x) === k)];
      const qtd = Number(g("QTDE")) || 0;
      if (!qtd) continue;
      const cat = chaveCat(g("CATEGORIA"));
      detalhe.push({ pedido: String(g("PEDIDO") || ""), cliente: g("CLIENTE"), produto: g("PRODUTO"), categoria: cat || "SEM_CATEGORIA", qtde: qtd, concluido: g("CONCLUIDO_EM") });
      if (cat) qtds[cat] = (qtds[cat] || 0) + qtd; else semCategoria += qtd;
    }
    return { tipo: "MES", analises: [{ competencia, qtds, detalhe, semCategoria, total: Object.values(qtds).reduce((a, b) => a + b, 0) }] };
  }
  const aba = wb.SheetNames.find((n) => sa(n) === "ANALISE") || wb.SheetNames[0];
  return { tipo: "MES", analises: [lerAbaAnalise(wb.Sheets[aba], competencia, false)] };
}

// aba no formato da análise: linha ITEM (categorias) + QTDE; à direita PESSOAL/FREELANCERS/PEÇAS ESTIMADAS/CUSTO ESTIMADO
function lerAbaAnalise(sh, competencia, historico) {
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
  const iItem = rows.findIndex((r) => r && sa(r[0]) === "ITEM");
  const iQtd = rows.findIndex((r) => r && sa(r[0]) === "QTDE");
  const qtds = {};
  // soma todas as linhas entre ITEM e TOTAL POR PEÇA (a planilha lança várias linhas de QTDE no mês)
  const iTot = rows.findIndex((r) => r && sa(r[0]) === "TOTAL_POR_PECA");
  if (iItem >= 0 && iQtd >= 0) {
    for (let i = iItem + 1; i < (iTot > iItem ? iTot : iQtd + 1); i++) {
      rows[iItem].forEach((c, j) => { const k = j > 0 && chaveCat(c); const v = rows[i]?.[j]; if (k && typeof v === "number" && v) qtds[k] = (qtds[k] || 0) + v; });
    }
  }
  // valores à direita: rótulo numa coluna, valor na seguinte
  const ao = (rot) => { for (const r of rows) { const j = (r || []).findIndex((c) => sa(c) === rot); if (j >= 0) { const v = r[j + 1]; return typeof v === "number" ? v : null; } } return null; };
  const texto = (rot) => { for (let i = 0; i < rows.length; i++) { const j = (rows[i] || []).findIndex((c) => sa(c) === rot); if (j >= 0) { const v = rows[i + 1]?.[j]; return v ? String(v).trim() : null; } } return null; };
  const mercado = {};
  const iMerc = rows.findIndex((r) => r && sa(r[0]) === "VALOR_UNIT_MERCADO");
  if (iItem >= 0 && iMerc >= 0) rows[iItem].forEach((c, j) => { const k = j > 0 && chaveCat(c); const v = rows[iMerc][j]; if (k && typeof v === "number") mercado[k] = v; });
  const pessoal = ao("PESSOAL"), free = ao("FREELANCERS");
  const custoEst = ao("CUSTO_ESTIMADO");
  return {
    competencia, qtds, total: Object.values(qtds).reduce((a, b) => a + b, 0), semCategoria: 0,
    pecasEstimadas: ao("PECAS_ESTIMADAS") || 13000,
    ...(historico ? {
      pessoalManual: pessoal || null, freelancerManual: pessoal ? (free || 0) : null,
      custoMeta: custoEst && Math.abs(custoEst - 1.15) < 0.0001 ? 1.15 : null,
      meta: texto("META_FINANCEIRA"), causas: texto("CAUSAS_MERITO"), providencias: texto("PROVIDENCIA"),
    } : {}),
    mercado: Object.keys(mercado).length ? mercado : null,
  };
}

// ---------------- gravação ----------------
export async function gravarAnalises(setor, analises, { nome, quem, historico = false } = {}) {
  const out = [];
  for (let a of analises) {
    if (!/^\d{4}-\d{2}$/.test(a.competencia || "")) { out.push({ erro: "Mês não identificado: escolha o mês antes de importar." }); continue; }
    const ant = await prisma.opAnalise.findFirst({ where: { setor, competencia: { lt: a.competencia } }, orderBy: { competencia: "desc" } });
    // planilha histórica não sobrescreve as peças de um mês que já veio da exportação do sistema de produção
    const atual = await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor, competencia: a.competencia } } });
    if (historico && atual?.detalhe) a = { ...a, qtds: atual.qtds, detalhe: undefined, semCategoria: atual.semCategoria };
    const data = {
      qtds: a.qtds, detalhe: a.detalhe || undefined, semCategoria: a.semCategoria || 0, arquivoNome: nome || null, atualizadoPorNome: quem || null,
      ...(a.pecasEstimadas ? { pecasEstimadas: a.pecasEstimadas } : {}),
      ...(a.mercado ? { mercado: a.mercado } : {}),
      ...(a.pessoalManual !== undefined ? { pessoalManual: a.pessoalManual, freelancerManual: a.freelancerManual } : {}),
      ...(a.custoMeta !== undefined ? { custoMeta: a.custoMeta } : {}),
      ...(a.meta ? { meta: a.meta } : {}), ...(a.causas ? { causas: a.causas } : {}), ...(a.providencias ? { providencias: a.providencias } : {}),
    };
    const r = await prisma.opAnalise.upsert({
      where: { setor_competencia: { setor, competencia: a.competencia } },
      update: data,
      create: { setor, competencia: a.competencia, mercado: ant?.mercado || MERCADO_PADRAO, meta: ant?.meta || null, pecasEstimadas: ant?.pecasEstimadas || 13000, custoMeta: ant?.custoMeta ?? null, ...data },
    });
    out.push({ competencia: r.competencia, total: Object.values(a.qtds || {}).reduce((x, y) => x + (Number(y) || 0), 0), semCategoria: a.semCategoria || 0, preservado: !!(historico && atual?.detalhe) });
  }
  return out;
}

// ---------------- cálculo (mesma mecânica da planilha) ----------------
export function calcularCorte(a, pessoal, freelancer) {
  const merc = { ...MERCADO_PADRAO, ...(a.mercado || {}) };
  const cats = CATEGORIAS_CORTE.map(([k, n]) => ({ k, n, qtd: Number(a.qtds?.[k]) || 0, mercado: Number(merc[k]) || 0 }));
  const pecas = cats.reduce((s, c) => s + c.qtd, 0);
  const custoTotal = r2(pessoal + freelancer);
  const incorrido = pecas ? custoTotal / pecas : 0;                                   // custo incorrido por peça
  const estimado = a.custoMeta != null ? Number(a.custoMeta) : (a.pecasEstimadas ? custoTotal / a.pecasEstimadas : 0);   // custo estimado por peça
  const terceirizado = r2(cats.reduce((s, c) => s + c.qtd * c.mercado, 0));          // quanto custaria terceirizar
  const mediaTerc = pecas ? terceirizado / pecas : 0;
  return {
    pessoal: r2(pessoal), freelancer: r2(freelancer), custoTotal, pecas, incorrido, pecasEstimadas: a.pecasEstimadas, estimado,
    resultado: estimado ? incorrido / estimado : 0,
    sobrecusto: estimado ? incorrido / estimado - 1 : 0,
    impacto: r2((estimado - incorrido) * pecas),
    terceirizado, mediaTerc, economiaTerc: r2(terceirizado - custoTotal),
    categorias: cats.map((c) => ({ ...c, concentracao: pecas ? c.qtd / pecas : 0, fator: mediaTerc ? c.mercado / mediaTerc : 0, valorInterno: mediaTerc ? (c.mercado / mediaTerc) * incorrido : 0 })),
  };
}

// pessoal (Matriz) e freelancers do setor no mês, identificados no sistema
export async function custoDoSetor(setor, competencia) {
  const f = await freelancerXFolha(competencia).catch(() => null);
  const l = f?.linhas?.find((x) => x.setor === SETORES_OP[setor]?.setorFolha);
  return { pessoal: l?.folha || 0, freelancer: l?.freelancer || 0, fonteFree: l?.fonteFree || "—", pessoas: l?.pessoas || 0 };
}

export async function analiseCorte(competencia) {
  const lista = await prisma.opAnalise.findMany({ where: { setor: "CORTE" }, orderBy: { competencia: "asc" }, select: { competencia: true, qtds: true } });
  const a = competencia ? await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor: "CORTE", competencia } } }) : null;
  const auto = competencia ? await custoDoSetor("CORTE", competencia) : null;
  let calc = null;
  if (a) {
    const pessoal = a.pessoalManual != null ? a.pessoalManual : auto.pessoal;
    const free = a.freelancerManual != null ? a.freelancerManual : auto.freelancer;
    calc = calcularCorte(a, pessoal, free);
  }
  // série do ano para o gráfico: custo incorrido por peça e peças
  const serie = [];
  for (const x of lista.filter((y) => !competencia || y.competencia.slice(0, 4) === competencia.slice(0, 4))) {
    const full = await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor: "CORTE", competencia: x.competencia } } });
    const au = await custoDoSetor("CORTE", x.competencia);
    const free = full.freelancerManual ?? au.freelancer;
    const c = calcularCorte(full, full.pessoalManual ?? au.pessoal, free);
    // v182.2 — confronto: freelancer da planilha/manual × o que o sistema identificou no mês
    serie.push({ competencia: x.competencia, pecas: c.pecas, incorrido: c.incorrido, custoTotal: c.custoTotal, estimado: c.estimado,
      pessoal: full.pessoalManual ?? au.pessoal, fontePessoal: full.pessoalManual != null ? "PLANILHA" : "MATRIZ",
      freelancer: free, freeSistema: au.freelancer, fonteFree: full.freelancerManual != null ? "PLANILHA" : "SISTEMA",
      difFree: full.freelancerManual != null ? Math.round((full.freelancerManual - au.freelancer) * 100) / 100 : 0 });
  }
  return { competencias: lista.map((x) => x.competencia), analise: a, auto, calc, serie, categorias: CATEGORIAS_CORTE.map(([k, n]) => ({ k, n })) };
}
