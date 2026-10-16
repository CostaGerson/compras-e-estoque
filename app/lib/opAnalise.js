// v182 — Análises operacionais da produção. Corte: peças processadas por categoria (planilha do sistema de produção),
// custo do setor = pessoal (custo total da folha pela Matriz) + freelancers do corte identificados no mês.
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { freelancerXFolha } from "@/lib/rhPainel";
import { tipoDaPeca } from "@/lib/finOsKm";

export const SETORES_OP = {
  CORTE: { nome: "Corte", setorFolha: "CORTE" },
  PERSONALIZACAO: { nome: "Personalização", sub: "Silk, bordado, DTF e sublimação" },
  COSTURA: { nome: "Costura", setorFolha: "COSTURA" },
  SILK: { nome: "Silk", setorFolha: "SILK" },
  BORDADO: { nome: "Bordado", setorFolha: "BORDADO" },
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
// v183 — expedição (ordem da planilha "Análise Expedição 2026")
export const CATEGORIAS_EXPEDICAO = [
  ["CAMISETA", "Camiseta", 1.5], ["POLO", "Polo", 2.7], ["MOLETOM", "Moletom", 1.5], ["JAQUETA", "Jaqueta", 1.5], ["CAMISA_SOCIAL", "Camisa social", 5.5],
  ["JALECO_OPERACIONAL", "Jaleco operacional", 1.5], ["CALCA_OPERACIONAL", "Calça operacional", 1.5], ["CALCA_JEANS", "Calça jeans", 2.1], ["CALCA_SOCIAL", "Calça social", 2.1],
];
// v254 — costura: camiseta (MC/ML × com/sem faixa ou recorte), moletom (normal/colegial × com/sem), polo (comum/com recorte), demais normais.
// Valor de mercado começa zerado: preencha com o preço da facção para ter o comparativo com terceirizar.
const COM_SEM = (k, n) => [[`${k}_SEM`, `${n} sem faixa/recorte`, 0], [`${k}_COM`, `${n} com faixa/recorte`, 0]];
export const CATEGORIAS_COSTURA = [
  ["PILOTO", "Piloto", 0],
  ...COM_SEM("CAMISETA_MC", "Camiseta MC"), ...COM_SEM("CAMISETA_ML", "Camiseta ML"),
  ["POLO_COMUM", "Polo comum", 0], ["POLO_RECORTE", "Polo com recorte", 0],
  ...COM_SEM("MOLETOM_NORMAL", "Moletom normal"), ...COM_SEM("MOLETOM_COLEGIAL", "Moletom colegial"),
  ["JAQUETA", "Jaqueta", 0], ["CAMISA_SOCIAL", "Camisa social", 0], ["JALECO_OPERACIONAL", "Jaleco operacional", 0],
  ["CALCA_OPERACIONAL", "Calça operacional", 0], ["CALCA_JEANS", "Calça jeans", 0], ["CALCA_SOCIAL", "Calça social", 0], ["AVENTAL", "Avental", 0],
  ["TOUCA", "Touca / máscara", 0],
];
// v254 — personalização: grade peça × nível. Silk = nº de cores (1 a 6); bordado = milheiro de pontos (1 a 10 mil).
// Peças = as mesmas do corte/expedição. O valor de mercado é por nível (coluna), igual para todas as peças.
export const PECAS_PERS = [["CAMISETA", "Camiseta"], ["POLO", "Polo"], ["MOLETOM", "Moletom"], ["JAQUETA", "Jaqueta"], ["CAMISA_SOCIAL", "Camisa social"],
  ["JALECO_OPERACIONAL", "Jaleco operacional"], ["CALCA_OPERACIONAL", "Calça operacional"], ["CALCA_JEANS", "Calça jeans"], ["CALCA_SOCIAL", "Calça social"], ["AVENTAL", "Avental"]];
export const NIVEIS_OP = {
  SILK: { titulo: "Cores", niveis: [1, 2, 3, 4, 5, 6].map((i) => [`C${i}`, `${i} cor${i > 1 ? "es" : ""}`]) },
  BORDADO: { titulo: "Milheiro de pontos", niveis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => [`M${i}`, `${i} mil`]) },
};
const gradeCats = (setor) => PECAS_PERS.flatMap(([k, n]) => NIVEIS_OP[setor].niveis.map(([nk, nn]) => [`${k}__${nk}`, `${n} · ${nn}`, 0]));
export const CATEGORIAS_OP = { CORTE: CATEGORIAS_CORTE, COSTURA: CATEGORIAS_COSTURA, SILK: gradeCats("SILK"), BORDADO: gradeCats("BORDADO"), EXPEDICAO: CATEGORIAS_EXPEDICAO };
export const SETORES_ANALISE = Object.keys(CATEGORIAS_OP);
export const SETORES_MANUAIS = ["COSTURA"];   // sem importação de planilha: preenchida à mão
export const SETORES_GRADE = Object.keys(NIVEIS_OP);
const catsDe = (setor) => CATEGORIAS_OP[setor] || CATEGORIAS_CORTE;
const nivelDe = (k) => String(k).split("__")[1] || null;
// grade: valor de mercado por nível (coluna); demais: por categoria
// v262 — silk: cobra-se R$ 0,80 por cor (coluna de N cores = N × 0,80)
export const SILK_POR_COR = 0.8;
export const mercadoPadrao = (setor) => NIVEIS_OP[setor]
  ? Object.fromEntries(NIVEIS_OP[setor].niveis.map(([k], i) => [k, setor === "SILK" ? r2((i + 1) * SILK_POR_COR) : 0]))
  : Object.fromEntries(catsDe(setor).map(([k, , v]) => [k, v]));
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const chaveCat = (t, setor = "CORTE") => { const k = sa(t); return catsDe(setor).some(([c]) => c === k) ? k : null; };
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

export function lerPlanilhaCorte(buf, nome = "", compPadrao = null, setor = "CORTE") {
  const wb = XLSX.read(buf, { type: "buffer" });
  // v182.1 — aba por mês: aceita nome completo ou abreviado ("Janeiro", "JAN", "Set-26", "CORTE MARÇO 2026", "03/2026")
  const anoArq = (String(nome).match(/20\d{2}/) || [])[0] || String(new Date().getFullYear());
  const mesesAbas = wb.SheetNames.map((n) => ({ n, c: compDaAba(n, anoArq) })).filter((x) => x.c);
  if (mesesAbas.length) {
    const vistos = new Set();
    const analises = mesesAbas.map((x) => lerAbaAnalise(wb.Sheets[x.n], x.c, true, setor))
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
  return { tipo: "MES", analises: [lerAbaAnalise(wb.Sheets[aba], competencia, false, setor)] };
}

// v255 — silk/bordado: exportação do sistema de produção "analise-silk_AAAA-MM-DD_a_AAAA-MM-DD.xlsx"
// aba de resumo (CUSTO DE MERCADO / CUSTO DE TINTA por cor·peça, TERCEIRIZADO) + aba Conferência
// (PEDIDO, CLIENTE, PRODUTO, PEÇAS, CORES, CORES×PEÇAS, ORIGEM, CONCLUÍDO EM). Bordado: coluna PONTOS ou MILHEIRO no lugar de CORES.
const tipoPers = (prod) => (/AVENTAL/.test(sa(prod)) ? "AVENTAL" : tipoDaPeca(prod));
export function lerPlanilhaPers(buf, nome = "", compPadrao = null, setor = "SILK") {
  const wb = XLSX.read(buf, { type: "buffer" });
  const m = String(nome).match(/(\d{4})-(\d{2})-\d{2}/);
  const competencia = m ? `${m[1]}-${m[2]}` : compPadrao;
  const conf = wb.SheetNames.find((n) => sa(n) === "CONFERENCIA");
  if (!conf) throw new Error("Não achei a aba Conferência na planilha.");
  // resumo: rótulo na coluna A, valor na B
  const resumo = {};
  for (const n of wb.SheetNames.filter((x) => x !== conf)) {
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true })) if (r?.[0] && typeof r[1] === "number") resumo[sa(r[0])] = r[1];
  }
  const doResumo = (pref) => { const k = Object.keys(resumo).find((x) => x.startsWith(pref)); return k != null ? resumo[k] : null; };
  const mercadoUnit = doResumo("CUSTO_DE_MERCADO");
  const tintaUnit = doResumo("CUSTO_DE_TINTA_POR");
  const pref = setor === "BORDADO" ? "M" : "C", max = setor === "BORDADO" ? 10 : 6;
  const qtds = {}, detalhe = [], somaNivel = {}, pecasNivel = {};
  let semCategoria = 0, unidades = 0, unidSemCat = 0;
  const terc = { pecas: 0, unidades: 0, fornecedores: {} };
  for (const l of XLSX.utils.sheet_to_json(wb.Sheets[conf], { defval: null })) {
    const g = (...ks) => { for (const k of ks) { const c = Object.keys(l).find((x) => sa(x) === k); if (c != null && l[c] != null && l[c] !== "") return l[c]; } return null; };
    const pecas = Number(g("PECAS", "QTDE")) || 0;
    if (!pecas) continue;
    let nivel = setor === "BORDADO"
      ? (g("MILHEIRO") != null ? Number(g("MILHEIRO")) : Math.ceil((Number(g("PONTOS")) || 0) / 1000))
      : Number(g("CORES")) || 0;
    nivel = Math.max(1, Math.round(nivel || 1));
    const unid = Number(g("CORES_PECAS", "CORESXPECAS", "CORES_X_PECAS")) || nivel * pecas;
    const origem = String(g("ORIGEM") || "Interno");
    const ehTerc = /TERCEIR/i.test(sa(origem));
    const cat = tipoPers(g("PRODUTO"));
    detalhe.push({ pedido: String(g("PEDIDO") || ""), cliente: g("CLIENTE"), produto: g("PRODUTO"), categoria: cat || "SEM_CATEGORIA", qtde: pecas, nivel, unidades: unid, origem, concluido: g("CONCLUIDO_EM") });
    if (ehTerc) {
      terc.pecas += pecas; terc.unidades += unid;
      const forn = origem.split("·")[1]?.trim() || "—";
      terc.fornecedores[forn] = (terc.fornecedores[forn] || 0) + pecas;
      continue;
    }
    if (!cat) { semCategoria += pecas; unidSemCat += unid; continue; }
    const col = `${pref}${Math.min(nivel, max)}`;
    qtds[`${cat}__${col}`] = (qtds[`${cat}__${col}`] || 0) + pecas;
    somaNivel[col] = (somaNivel[col] || 0) + nivel * pecas; pecasNivel[col] = (pecasNivel[col] || 0) + pecas;
    unidades += unid;
  }
  // valor de mercado por nível = nível médio da coluna × mercado por cor·peça (a última coluna junta "6 ou mais")
  let mercado = null;
  if (mercadoUnit) {
    mercado = {};
    for (let i = 1; i <= max; i++) { const c = `${pref}${i}`; const med = pecasNivel[c] ? somaNivel[c] / pecasNivel[c] : i; mercado[c] = r2(med * mercadoUnit); }
  }
  const valorTercPlan = resumo.TERCEIRIZADO ?? null;   // valor pago a terceiros no mês (≠ "TERCEIRIZADO ESTIMADO")
  const extra = {
    unidades, unidSemCat, mercadoUnit, tintaUnit, tinta: tintaUnit != null ? r2(unidades * tintaUnit) : null,
    terceirizado: { pecas: terc.pecas, unidades: terc.unidades, fornecedores: terc.fornecedores,
      valor: valorTercPlan != null ? r2(valorTercPlan) : mercadoUnit ? r2(terc.unidades * mercadoUnit) : null },
  };
  return { tipo: "MES", analises: [{ competencia, qtds, detalhe, semCategoria, total: Object.values(qtds).reduce((a, b) => a + b, 0), mercado, extra }] };
}

// aba no formato da análise: linha ITEM (categorias) + QTDE; à direita PESSOAL/FREELANCERS/PEÇAS ESTIMADAS/CUSTO ESTIMADO
function lerAbaAnalise(sh, competencia, historico, setor = "CORTE") {
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
  const iItem = rows.findIndex((r) => r && sa(r[0]) === "ITEM");
  const iQtd = rows.findIndex((r) => r && sa(r[0]) === "QTDE");
  const qtds = {};
  // soma todas as linhas entre ITEM e TOTAL POR PEÇA (a planilha lança várias linhas de QTDE no mês)
  const iTot = rows.findIndex((r) => r && sa(r[0]) === "TOTAL_POR_PECA");
  if (iItem >= 0 && iQtd >= 0) {
    for (let i = iItem + 1; i < (iTot > iItem ? iTot : iQtd + 1); i++) {
      rows[iItem].forEach((c, j) => { const k = j > 0 && chaveCat(c, setor); const v = rows[i]?.[j]; if (k && typeof v === "number" && v) qtds[k] = (qtds[k] || 0) + v; });
    }
  }
  // valores à direita: rótulo numa coluna, valor na seguinte
  const ao = (rot) => { for (const r of rows) { const j = (r || []).findIndex((c) => sa(c) === rot); if (j >= 0) { const v = r[j + 1]; return typeof v === "number" ? v : null; } } return null; };
  const texto = (rot) => { for (let i = 0; i < rows.length; i++) { const j = (rows[i] || []).findIndex((c) => sa(c) === rot); if (j >= 0) { const v = rows[i + 1]?.[j]; return v ? String(v).trim() : null; } } return null; };
  const mercado = {};
  const iMerc = rows.findIndex((r) => r && sa(r[0]) === "VALOR_UNIT_MERCADO");
  if (iItem >= 0 && iMerc >= 0) rows[iItem].forEach((c, j) => { const k = j > 0 && chaveCat(c, setor); const v = rows[iMerc][j]; if (k && typeof v === "number") mercado[k] = v; });
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
      ...(a.extra ? { extra: a.extra } : {}),
      ...(a.pessoalManual !== undefined ? { pessoalManual: a.pessoalManual, freelancerManual: a.freelancerManual } : {}),
      ...(a.custoMeta !== undefined ? { custoMeta: a.custoMeta } : {}),
      ...(a.meta ? { meta: a.meta } : {}), ...(a.causas ? { causas: a.causas } : {}), ...(a.providencias ? { providencias: a.providencias } : {}),
    };
    const r = await prisma.opAnalise.upsert({
      where: { setor_competencia: { setor, competencia: a.competencia } },
      update: data,
      create: { setor, competencia: a.competencia, mercado: ant?.mercado || mercadoPadrao(setor), meta: ant?.meta || null, pecasEstimadas: ant?.pecasEstimadas || 13000, custoMeta: ant?.custoMeta ?? null, ...data },
    });
    out.push({ competencia: r.competencia, total: Object.values(a.qtds || {}).reduce((x, y) => x + (Number(y) || 0), 0), semCategoria: a.semCategoria || 0, preservado: !!(historico && atual?.detalhe) });
  }
  return out;
}

// ---------------- cálculo (mesma mecânica da planilha) ----------------
// insumo estimado: o da planilha importada, ou unidades × custo por unidade (quando a planilha trouxe)
export const insumoAuto = (a, unidades) => a.extra?.tinta ?? (a.extra?.tintaUnit ? (unidades || 0) * a.extra.tintaUnit : 0);
export function calcularCorte(a, pessoal, freelancer) {
  const merc = { ...mercadoPadrao(a.setor), ...(a.mercado || {}) };
  const cats = catsDe(a.setor).map(([k, n]) => ({ k, n, qtd: Number(a.qtds?.[k]) || 0, mercado: Number(merc[k] ?? merc[nivelDe(k)]) || 0 }));
  const pecas = cats.reduce((s, c) => s + c.qtd, 0);
  // v257 — silk/bordado: custo do setor = mão de obra (pessoal + freelancers) + insumo (tinta/linha)
  const grade = !!NIVEIS_OP[a.setor];
  const unidades = grade ? (a.extra?.unidades || cats.reduce((s, c) => s + c.qtd * (Number(String(nivelDe(c.k) || "").slice(1)) || 1), 0)) : 0;
  const insumo = grade ? r2(a.insumoManual ?? insumoAuto(a, unidades)) : 0;
  const maoDeObra = r2(pessoal + freelancer);
  const custoTotal = r2(maoDeObra + insumo);
  const incorrido = pecas ? custoTotal / pecas : 0;                                   // custo incorrido por peça
  const estimado = a.custoMeta != null ? Number(a.custoMeta) : (a.pecasEstimadas ? custoTotal / a.pecasEstimadas : 0);   // custo estimado por peça
  const terceirizado = r2(cats.reduce((s, c) => s + c.qtd * c.mercado, 0));          // quanto custaria terceirizar
  const mediaTerc = pecas ? terceirizado / pecas : 0;
  return {
    pessoal: r2(pessoal), freelancer: r2(freelancer), maoDeObra, insumo, grade, custoTotal, pecas, incorrido, pecasEstimadas: a.pecasEstimadas, estimado,
    resultado: estimado ? incorrido / estimado : 0,
    sobrecusto: estimado ? incorrido / estimado - 1 : 0,
    impacto: r2((estimado - incorrido) * pecas),
    terceirizado, mediaTerc, economiaTerc: r2(terceirizado - custoTotal),
    retornoPct: terceirizado ? (terceirizado - custoTotal) / terceirizado : 0,          // v257 — retorno interno ÷ terceirizado
    // v255 — silk/bordado importados: custo por unidade (cor×peça) e terceirizado do mês
    ...(grade ? { unidades, custoUnid: unidades ? custoTotal / unidades : 0, mercadoUnid: unidades ? terceirizado / unidades : 0 } : {}),
    ...(a.extra ? { extra: a.extra } : {}),
    categorias: cats.map((c) => ({ ...c, concentracao: pecas ? c.qtd / pecas : 0, fator: mediaTerc ? c.mercado / mediaTerc : 0, valorInterno: mediaTerc ? (c.mercado / mediaTerc) * incorrido : 0 })),
    // v254 — grade (silk/bordado): totais por nível e por peça
    ...(NIVEIS_OP[a.setor] ? {
      colunas: NIVEIS_OP[a.setor].niveis.map(([k, n]) => {
        const qtd = cats.filter((c) => nivelDe(c.k) === k).reduce((s2, c) => s2 + c.qtd, 0);
        const mercado = Number(merc[k]) || 0;
        return { k, n, qtd, mercado, concentracao: pecas ? qtd / pecas : 0, fator: mediaTerc ? mercado / mediaTerc : 0, valorInterno: mediaTerc ? (mercado / mediaTerc) * incorrido : 0 };
      }),
      linhas: PECAS_PERS.map(([k, n]) => {
        const qtd = cats.filter((c) => c.k.startsWith(`${k}__`)).reduce((s2, c) => s2 + c.qtd, 0);
        return { k, n, qtd, concentracao: pecas ? qtd / pecas : 0 };
      }),
    } : {}),
  };
}

// pessoal (Matriz) e freelancers do setor no mês, identificados no sistema
export async function custoDoSetor(setor, competencia) {
  const f = await freelancerXFolha(competencia).catch(() => null);
  const l = f?.linhas?.find((x) => x.setor === SETORES_OP[setor]?.setorFolha);
  return { pessoal: l?.folha || 0, freelancer: l?.freelancer || 0, fonteFree: l?.fonteFree || "—", pessoas: l?.pessoas || 0 };
}

export async function analiseCorte(competencia, setor = "CORTE") {
  const lista = await prisma.opAnalise.findMany({ where: { setor }, orderBy: { competencia: "asc" }, select: { competencia: true, qtds: true } });
  const a = competencia ? await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor, competencia } } }) : null;
  const auto = competencia ? await custoDoSetor(setor, competencia) : null;
  let calc = null;
  if (a) {
    const pessoal = a.pessoalManual != null ? a.pessoalManual : auto.pessoal;
    const free = a.freelancerManual != null ? a.freelancerManual : auto.freelancer;
    calc = calcularCorte(a, pessoal, free);
  }
  // série do ano para o gráfico: custo incorrido por peça e peças
  const serie = [];
  for (const x of lista.filter((y) => !competencia || y.competencia.slice(0, 4) === competencia.slice(0, 4))) {
    const full = await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor, competencia: x.competencia } } });
    const au = await custoDoSetor(setor, x.competencia);
    const free = full.freelancerManual ?? au.freelancer;
    const c = calcularCorte(full, full.pessoalManual ?? au.pessoal, free);
    // v182.2 — confronto: freelancer da planilha/manual × o que o sistema identificou no mês
    serie.push({ competencia: x.competencia, pecas: c.pecas, incorrido: c.incorrido, custoTotal: c.custoTotal, estimado: c.estimado,
      insumo: c.insumo, mediaTerc: c.mediaTerc, retornoPct: c.retornoPct, custoUnid: c.custoUnid,
      pessoal: full.pessoalManual ?? au.pessoal, fontePessoal: full.pessoalManual != null ? "PLANILHA" : "MATRIZ",
      freelancer: free, freeSistema: au.freelancer, fonteFree: full.freelancerManual != null ? "PLANILHA" : "SISTEMA",
      difFree: full.freelancerManual != null ? Math.round((full.freelancerManual - au.freelancer) * 100) / 100 : 0 });
  }
  if (auto && a && NIVEIS_OP[setor]) auto.insumo = r2(insumoAuto(a, calc?.unidades));
  return { competencias: lista.map((x) => x.competencia), analise: a, auto, calc, serie, setor, categorias: catsDe(setor).map(([k, n]) => ({ k, n })),
    manual: SETORES_MANUAIS.includes(setor), grade: NIVEIS_OP[setor] ? { ...NIVEIS_OP[setor], pecas: PECAS_PERS.map(([k, n]) => ({ k, n })) } : null };
}

// v264 — resumo da tela de Análises operacionais: quanto volta para a operação por peça, na média dos últimos 3 meses com registro.
// Volta = valor de mercado × quantidade (silk: R$ 0,80 × cores). Corte e expedição: ÷ peças do próprio setor (todas passam por eles).
// Costura e personalização: ÷ peças da produção (expedidas nos mesmos meses) — só parte das peças passa por elas, então o valor por peça é baixo.
export async function resumoVolta(ate = null) {
  const todos = await prisma.opAnalise.findMany({ orderBy: { competencia: "desc" } });
  const porSetor = (setores) => todos.filter((a) => setores.includes(a.setor) && (!ate || a.competencia <= ate));
  const calcMes = (lista) => {
    const meses = {};
    for (const a of lista) {
      const c = calcularCorte(a, 0, 0);
      if (!c.pecas) continue;
      const m = (meses[a.competencia] ||= { volta: 0, pecas: 0 });
      m.volta += c.terceirizado; m.pecas += c.pecas;
    }
    return Object.entries(meses).sort((x, y) => y[0].localeCompare(x[0])).slice(0, 3);
  };
  const expedido = Object.fromEntries(porSetor(["EXPEDICAO"]).map((a) => [a.competencia, calcularCorte(a, 0, 0).pecas]));
  const grupo = (chave, setores, base) => {
    const ms = calcMes(porSetor(setores));
    const volta = ms.reduce((s, [, v]) => s + v.volta, 0), pecas = ms.reduce((s, [, v]) => s + v.pecas, 0);
    const pecasProducao = ms.reduce((s, [k]) => s + (expedido[k] || 0), 0);
    const porPecaSetor = pecas ? volta / pecas : 0;
    const porPecaProducao = pecasProducao ? volta / pecasProducao : 0;
    return { chave, meses: ms.map(([k]) => k).sort(), volta: r2(volta), pecas, pecasProducao, porPecaSetor, porPecaProducao,
      base, valor: base === "SETOR" ? porPecaSetor : porPecaProducao };
  };
  const g = [grupo("CORTE", ["CORTE"], "SETOR"), grupo("PERSONALIZACAO", ["SILK", "BORDADO"], "PRODUCAO"), grupo("COSTURA", ["COSTURA"], "PRODUCAO"), grupo("EXPEDICAO", ["EXPEDICAO"], "SETOR")];
  return { setores: Object.fromEntries(g.map((x) => [x.chave, x])), total: g.reduce((s, x) => s + (x.valor || 0), 0) };
}
