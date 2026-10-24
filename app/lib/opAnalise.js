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
  ["JAQUETA", "Jaqueta", 0], ["CAMISA_SOCIAL", "Camisa social", 0],
  // v411 — camisa social e jalecos com faixa refletiva; calças operacionais por acabamento, faixa e reforços
  ["CAMISA_SOCIAL_FAIXA_TORAX", "Camisa social c/ faixa refletiva tórax", 0], ["CAMISA_SOCIAL_FAIXA_TORAX_MANGAS", "Camisa social c/ faixa refletiva tórax e mangas", 0],
  ["JALECO_OPERACIONAL", "Jaleco operacional", 0],
  ["JALECO_OPERACIONAL_FAIXA_TORAX", "Jaleco operacional c/ faixa refletiva tórax", 0], ["JALECO_OPERACIONAL_FAIXA_TORAX_MANGAS", "Jaleco operacional c/ faixa refletiva tórax e mangas", 0],
  ["CALCA_OPERACIONAL", "Calça operacional", 0],
  ["CALCA_OPERACIONAL_MEIO_COS", "Calça operacional meio cós", 0], ["CALCA_OPERACIONAL_PASSANTES", "Calça operacional c/ passantes", 0],
  ["CALCA_OPERACIONAL_PASSANTES_PRESSAO", "Calça operacional c/ passantes e botão de pressão", 0], ["CALCA_OPERACIONAL_PASSANTES_FLEXIVEL", "Calça operacional c/ passantes e botão flexível", 0],
  ["CALCA_OPERACIONAL_FAIXA", "Calça operacional c/ faixa refletiva", 0], ["CALCA_OPERACIONAL_REFORCO_ENTREPERNAS", "Calça operacional c/ reforço entrepernas", 0],
  ["CALCA_OPERACIONAL_REFORCO_GOTA", "Calça operacional c/ reforço lateral tipo gota", 0], ["CALCA_OPERACIONAL_REFORCO_JOELHOS", "Calça operacional c/ reforço de joelhos matelado", 0],
  ["CALCA_JEANS", "Calça jeans", 0], ["CALCA_SOCIAL", "Calça social", 0], ["AVENTAL", "Avental", 0],
  ["TOUCA", "Touca / máscara", 0],
];
// v254 — personalização: grade peça × nível. Silk = nº de cores (1 a 6); bordado = milheiro de pontos (1 a 10 mil).
// Peças = as mesmas do corte/expedição. O valor de mercado é por nível (coluna), igual para todas as peças.
export const PECAS_PERS = [["CAMISETA", "Camiseta"], ["POLO", "Polo"], ["MOLETOM", "Moletom"], ["JAQUETA", "Jaqueta"], ["CAMISA_SOCIAL", "Camisa social"],
  ["JALECO_OPERACIONAL", "Jaleco operacional"], ["CALCA_OPERACIONAL", "Calça operacional"], ["CALCA_JEANS", "Calça jeans"], ["CALCA_SOCIAL", "Calça social"], ["AVENTAL", "Avental"]];
export const NIVEIS_OP = {
  SILK: { titulo: "Cores", niveis: [1, 2, 3, 4, 5, 6].map((i) => [`C${i}`, `${i} cor${i > 1 ? "es" : ""}`]) },
};
// v291 — bordado por PEÇA (até termos o custo por bordado/milheiro): peças bordadas dentro por tipo; valor de mercado = valor
//   terceirizado médio da peça na tabela de preços (média ponderada das linhas do mês); custo = folha da Matriz + freelancers + insumo (DRE 2112700)
// v292 — conta FLAT: o bordado não muda por tipo de peça, então tudo vai numa categoria só (valor = terceirizado médio do mês)
export const CATEGORIAS_BORDADO = [["PECA", "Peça bordada", 0]];
export const CONTA_INSUMO_BORDADO = "2112700";
const gradeCats = (setor) => PECAS_PERS.flatMap(([k, n]) => NIVEIS_OP[setor].niveis.map(([nk, nn]) => [`${k}__${nk}`, `${n} · ${nn}`, 0]));
export const CATEGORIAS_OP = { CORTE: CATEGORIAS_CORTE, COSTURA: CATEGORIAS_COSTURA, SILK: gradeCats("SILK"), BORDADO: CATEGORIAS_BORDADO, EXPEDICAO: CATEGORIAS_EXPEDICAO };
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

// v291 — planilha do bordado ("MERIDIAN · BORDADO NA PERSONALIZAÇÃO — SETEMBRO/2026"): detalhe dos itens concluídos no mês com
//   PRODUTO, PEÇAS, QUEM FEZ, R$ / PEÇA (tabela de preços) e VALOR ESTIMADO. Interno → análise; terceiro → informativo.
const MESES_N = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };
export function lerPlanilhaBordado(buf, nome = "", compPadrao = null) {
  const wb = XLSX.read(buf, { type: "buffer" });
  let rows = null, iCab = -1;
  for (const n of wb.SheetNames) {
    const rs = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true });
    const i = rs.findIndex((r) => (r || []).some((c) => sa(c) === "PRODUTO") && (r || []).some((c) => sa(c) === "PECAS"));
    if (i >= 0) { rows = rs; iCab = i; break; }
  }
  if (!rows) throw new Error("Não achei a tabela de itens (colunas PRODUTO e PEÇAS) na planilha do bordado.");
  const cab = rows[iCab].map((c) => sa(c));
  const col = (...ks) => cab.findIndex((c) => ks.some((k) => c === k || c.startsWith(k)));
  const cProd = col("PRODUTO"), cPc = col("PECAS"), cQuem = col("QUEM_FEZ", "ORIGEM"), cPreco = col("R_PECA", "R_POR_PECA", "PRECO"), cValor = col("VALOR_ESTIMADO", "VALOR");
  const cPed = col("PEDIDO"), cCli = col("CLIENTE"), cConc = col("CONCLUIDO"), cBord = col("BORDADO");
  // mês: data de conclusão mais frequente; senão o título (SETEMBRO/2026); senão o mês escolhido na tela
  const dataISO = (v) => {
    if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}` : null; }
    const m = String(v || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}` : null;
  };
  const qtds = {}, somaV = {}, detalhe = [], conta = {};
  const terc = { pecas: 0, valor: 0, fornecedores: {} };
  for (let i = iCab + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const prod = r[cProd];
    if (!prod || sa(prod) === "TOTAL") { if (sa(prod) === "TOTAL") break; continue; }
    const pecas = Number(r[cPc]) || 0;
    if (!pecas) continue;
    const preco = Number(r[cPreco]) || 0;
    const valor = cValor >= 0 && typeof r[cValor] === "number" ? r[cValor] : pecas * preco;
    const quem = String(r[cQuem] ?? "Interno").trim() || "Interno";
    const interno = sa(quem) === "INTERNO" || sa(quem) === "";
    const comp = dataISO(r[cConc]); if (comp) conta[comp] = (conta[comp] || 0) + 1;
    const cat = "PECA";   // v292 — flat: sem separar por tipo de peça
    detalhe.push({ pedido: String(r[cPed] ?? ""), cliente: r[cCli], produto: prod, categoria: cat, qtde: pecas, preco: r2(preco), valor: r2(valor),
      origem: interno ? "Interno" : `Terceirizado · ${quem}`, bordado: cBord >= 0 ? r[cBord] : null, concluido: r[cConc] ?? null });
    if (!interno) { terc.pecas += pecas; terc.valor += valor; terc.fornecedores[quem] = (terc.fornecedores[quem] || 0) + pecas; continue; }
    qtds[cat] = (qtds[cat] || 0) + pecas; somaV[cat] = (somaV[cat] || 0) + valor;
  }
  // peças de terceiro que só aparecem no resumo ("— por terceiro | 3 linhas · 850 peças")
  if (!terc.pecas) for (const r of rows.slice(0, iCab)) if (/TERCEIRO/.test(sa(r?.[0]))) { const m = String(r[1] || "").match(/([\d.]+)\s*pe/i); if (m) terc.pecas = Number(m[1].replace(/\./g, "")) || 0; }
  let competencia = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  if (!competencia) {
    const t = rows.slice(0, iCab).map((r) => sa((r || []).join(" "))).join(" ");
    const m = t.match(/(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)_(\d{4})/);
    competencia = m ? `${m[2]}-${String(MESES_N[m[1]]).padStart(2, "0")}` : compPadrao;
  }
  const mercado = Object.fromEntries(Object.keys(qtds).map((k) => [k, somaV[k] / qtds[k]]));
  const valorInterno = r2(Object.values(somaV).reduce((a, b) => a + b, 0));
  return { tipo: "MES", analises: [{ competencia, qtds, detalhe, semCategoria: 0, total: Object.values(qtds).reduce((a, b) => a + b, 0), mercado,
    extra: { valorTabela: valorInterno, terceirizado: { pecas: terc.pecas, valor: terc.valor ? r2(terc.valor) : null, fornecedores: terc.fornecedores } } }] };
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
// v296 — bordado flat: análise gravada no formato por tipo de peça (v291) ou com chaves antigas → tudo vira PECA,
//   com o valor = terceirizado médio (valor da tabela ÷ peças, ou média ponderada dos valores por tipo)
function normBordado(a) {
  const q = a.qtds || {};
  const ks = Object.keys(q).filter((k) => Number(q[k]) > 0);
  if (!ks.length || (ks.length === 1 && ks[0] === "PECA" && Number(a.mercado?.PECA) > 0)) return a;
  const total = ks.reduce((s0, k) => s0 + (Number(q[k]) || 0), 0);
  let valor = Number(a.extra?.valorTabela) || 0;
  if (!valor) valor = ks.reduce((s0, k) => s0 + (Number(q[k]) || 0) * (Number(a.mercado?.[k]) || 0), 0);
  const unit = Number(a.mercado?.PECA) > 0 && ks.length === 1 ? Number(a.mercado.PECA) : total ? valor / total : 0;
  return { ...a, qtds: { PECA: total }, mercado: { ...(a.mercado || {}), PECA: unit } };
}

export function calcularCorte(a0, pessoal, freelancer) {
  const a = a0?.setor === "BORDADO" ? normBordado(a0) : a0;
  const merc = { ...mercadoPadrao(a.setor), ...(a.mercado || {}) };
  const cats = catsDe(a.setor).map(([k, n]) => ({ k, n, qtd: Number(a.qtds?.[k]) || 0, mercado: Number(merc[k] ?? merc[nivelDe(k)]) || 0 }));
  const pecas = cats.reduce((s, c) => s + c.qtd, 0);
  // v257 — silk/bordado: custo do setor = mão de obra (pessoal + freelancers) + insumo (tinta/linha)
  const grade = !!NIVEIS_OP[a.setor];
  const unidades = grade ? (a.extra?.unidades || cats.reduce((s, c) => s + c.qtd * (Number(String(nivelDe(c.k) || "").slice(1)) || 1), 0)) : 0;
  // v291 — bordado: insumo informado ou o da DRE do mês (conta 2112700), passado em a._insumoAuto
  const insumo = grade ? r2(a.insumoManual ?? insumoAuto(a, unidades)) : a.setor === "BORDADO" ? r2(a.insumoManual ?? a._insumoAuto ?? 0) : 0;
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

// v288 — corte e expedição usam o custo REAL do setor (pessoal + freelancers do mês); costura e personalização, o valor de mercado
export const SETORES_CUSTO_REAL = ["CORTE", "EXPEDICAO"];
export async function calcularReal(a) {
  const au = await custoDoSetor(a.setor, a.competencia).catch(() => ({ pessoal: 0, freelancer: 0 }));
  return calcularCorte(a, a.pessoalManual ?? au.pessoal, a.freelancerManual ?? au.freelancer);
}

// pessoal (Matriz) e freelancers do setor no mês, identificados no sistema
export async function custoDoSetor(setor, competencia) {
  const f = await freelancerXFolha(competencia).catch(() => null);
  const l = f?.linhas?.find((x) => x.setor === SETORES_OP[setor]?.setorFolha);
  // v268 — freelancers exclusivamente do extrato identificado (sem previsão pelas contas da semana)
  const out = { pessoal: l?.folha || 0, freelancer: l?.freeExtrato || 0, fonteFree: l?.freeExtrato ? "EXTRATO IDENTIFICADO" : "nada identificado no extrato", pessoas: l?.pessoas || 0 };
  if (setor === "BORDADO") out.insumo = await insumoDre(CONTA_INSUMO_BORDADO, competencia).catch(() => 0);   // v291
  return out;
}
// v291 — saídas do mês numa conta da DRE (extrato identificado), em valor positivo
async function insumoDre(codigo, competencia) {
  const conta = await prisma.finConta.findFirst({ where: { codigo }, select: { id: true } });
  if (!conta) return 0;
  const s = await prisma.finLancamento.aggregate({ where: { competencia, desmembrado: false, substituido: false, contaId: conta.id }, _sum: { valor: true } });
  return r2(-(Number(s._sum?.valor) || 0));
}

// v286 — só os últimos 6 meses importam para a precificação: as análises mostram e calculam apenas essa janela
//   (6 meses encerrados; o mês corrente aparece em andamento, mas não entra nas médias)
export const JANELA_MESES = 6;
const mesHoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const somaM = (c, n) => { const d = new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export function janelaMeses() { const atual = mesHoje(); return { de: somaM(atual, -JANELA_MESES), ate: somaM(atual, -1), atual }; }

export async function analiseCorte(competencia, setor = "CORTE") {
  const J = janelaMeses();
  const lista = await prisma.opAnalise.findMany({ where: { setor, competencia: { gte: J.de } }, orderBy: { competencia: "asc" }, select: { competencia: true, qtds: true } });
  const a0 = competencia ? await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor, competencia } } }) : null;
  const a = a0 && setor === "BORDADO" ? normBordado(a0) : a0;   // v296 — tela já recebe o formato flat (salvar grava assim)
  const auto = competencia ? await custoDoSetor(setor, competencia) : null;
  let calc = null;
  if (a) {
    const pessoal = a.pessoalManual != null ? a.pessoalManual : auto.pessoal;
    const free = a.freelancerManual != null ? a.freelancerManual : auto.freelancer;
    calc = calcularCorte({ ...a, _insumoAuto: auto.insumo }, pessoal, free);
  }
  // série dos últimos 6 meses (v286; antes: do ano)
  const serie = [];
  for (const x of lista) {
    const full = await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor, competencia: x.competencia } } });
    const au = await custoDoSetor(setor, x.competencia);
    const free = full.freelancerManual ?? au.freelancer;
    const c = calcularCorte({ ...full, _insumoAuto: au.insumo }, full.pessoalManual ?? au.pessoal, free);
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

// v264 — resumo da tela de Análises operacionais: quanto volta para a operação por peça.
// v286 — média dos últimos 6 meses encerrados com registro (antes: 3 meses).
// Volta = valor de mercado × quantidade (silk: R$ 0,80 × cores). Corte e expedição: ÷ peças do próprio setor (todas passam por eles).
// Costura e personalização: ÷ peças da produção (expedidas nos mesmos meses) — só parte das peças passa por elas, então o valor por peça é baixo.
export async function resumoVolta(ate = null) {
  const J = janelaMeses();
  const todos = await prisma.opAnalise.findMany({ where: { competencia: { gte: J.de, lte: J.ate } }, orderBy: { competencia: "desc" } });
  const porSetor = (setores) => todos.filter((a) => setores.includes(a.setor) && (!ate || a.competencia <= ate));
  const calcMes = async (lista) => {
    const meses = {};
    for (const a of lista) {
      const real = SETORES_CUSTO_REAL.includes(a.setor);   // v288 — corte/expedição: custo real; demais: mercado × quantidade
      const c = real ? await calcularReal(a) : calcularCorte(a, 0, 0);
      if (!c.pecas) continue;
      const m = (meses[a.competencia] ||= { volta: 0, pecas: 0, cats: {} });
      m.volta += real ? c.custoTotal : c.terceirizado; m.pecas += c.pecas;
      for (const x of c.categorias || []) {   // v289 — composição por item (custo real rateado ou mercado)
        if (!x.qtd) continue;
        const it = (m.cats[x.k] ||= { k: x.k, n: x.n, q: 0, v: 0 });
        it.q += x.qtd; it.v += x.qtd * (real ? x.valorInterno : x.mercado);
      }
    }
    return Object.entries(meses).sort((x, y) => y[0].localeCompare(x[0])).slice(0, JANELA_MESES);
  };
  const expedido = Object.fromEntries(porSetor(["EXPEDICAO"]).map((a) => [a.competencia, calcularCorte(a, 0, 0).pecas]));
  const grupo = async (chave, setores, base) => {
    const ms = await calcMes(porSetor(setores));
    const volta = ms.reduce((s, [, v]) => s + v.volta, 0), pecas = ms.reduce((s, [, v]) => s + v.pecas, 0);
    const pecasProducao = ms.reduce((s, [k]) => s + (expedido[k] || 0), 0);
    const porPecaSetor = pecas ? volta / pecas : 0;
    const porPecaProducao = pecasProducao ? volta / pecasProducao : 0;
    const cs = {};
    for (const [, v] of ms) for (const it of Object.values(v.cats || {})) { const o = (cs[it.k] ||= { k: it.k, n: it.n, q: 0, v: 0 }); o.q += it.q; o.v += it.v; }
    const categorias = Object.values(cs).filter((x) => x.q).map((x) => ({ k: x.k, n: x.n, qtd: x.q, valor: x.v / x.q, total: r2(x.v) })).sort((a, b) => b.qtd - a.qtd);
    return { chave, meses: ms.map(([k]) => k).sort(), volta: r2(volta), pecas, pecasProducao, porPecaSetor, porPecaProducao, categorias,
      base, valor: base === "SETOR" ? porPecaSetor : porPecaProducao };
  };
  const g = await Promise.all([grupo("CORTE", ["CORTE"], "SETOR"), grupo("SILK", ["SILK"], "PRODUCAO"), grupo("BORDADO", ["BORDADO"], "PRODUCAO"),   /* v293 — silk e bordado separados */ grupo("COSTURA", ["COSTURA"], "PRODUCAO"), grupo("EXPEDICAO", ["EXPEDICAO"], "SETOR")]);
  for (const x of g) x.real = ["CORTE", "EXPEDICAO"].includes(x.chave);
  const producao = g.reduce((s, x) => s + (x.valor || 0), 0);
  // v284 — logística: só a FOLHA de logística volta para a operação (folha ÷ peças, últimos 6 meses encerrados — v286);
  //   combustível, fretes etc. não voltam (são cobrados na FPP)
  const { custoLogisticoPeca } = await import("@/lib/opLogistica");
  const lg = await custoLogisticoPeca().catch(() => null);
  // v290 — volta = valor cobrado na FPP (custo logístico inteiro por peça, sem frete entrega) × peças
  const logistica = lg?.porPeca || 0;
  g.push({ chave: "LOGISTICA", meses: lg?.meses || [], volta: lg?.custo || 0, pecas: lg?.pecas || 0, base: "LOGISTICA", valor: logistica,
    fppPeca: lg?.porPeca ?? null, freteEntregaPeca: lg?.freteEntregaPeca ?? null });
  const total = producao + logistica;
  // v269 — % freelancer oficial (mesma regra da Capacidade e da Matriz): últimos 3 meses fechados
  const { pctFreelancerOperacional } = await import("@/lib/rhPainel");
  const pf = await pctFreelancerOperacional().catch(() => null);
  const mesesFree = pf?.meses || [], folha = pf?.folha || 0, free = pf?.freelancer || 0;
  const pctFree = pf?.pct || 0;
  return { setores: Object.fromEntries(g.map((x) => [x.chave, x])), total, producao, logistica,
    freelancer: { meses: mesesFree, folha: r2(folha), freelancer: r2(free), pct: pctFree }, liquida: producao * (1 - pctFree) + logistica };
}

// v278 — peças faturadas do KPI = peças da análise da expedição (fonte única). Grava só o que difere.
export async function pecasExpedicao(ano = null) {
  const rows = await prisma.opAnalise.findMany({ where: { setor: "EXPEDICAO", ...(ano ? { competencia: { startsWith: `${ano}-` } } : {}) } });
  const out = {};
  for (const a of rows) { const p = calcularCorte(a, 0, 0).pecas; if (p > 0) out[a.competencia] = p; }
  return out;
}
export async function sincronizarPecasKpi(ano = null) {
  const pe = await pecasExpedicao(ano);
  const comps = Object.keys(pe);
  if (!comps.length) return 0;
  const kms = await prisma.kpiMes.findMany({ where: { OR: comps.map((c) => ({ ano: Number(c.slice(0, 4)), mes: Number(c.slice(5, 7)) })) } });
  let n = 0;
  for (const c of comps) {
    const ano_ = Number(c.slice(0, 4)), mes = Number(c.slice(5, 7));
    const k = kms.find((x) => x.ano === ano_ && x.mes === mes);
    if (k && Number(k.pecasFaturadas) === pe[c]) continue;
    await prisma.kpiMes.upsert({ where: { ano_mes: { ano: ano_, mes } }, create: { ano: ano_, mes, pecasFaturadas: pe[c] }, update: { pecasFaturadas: pe[c] } });
    n++;
  }
  return n;
}
