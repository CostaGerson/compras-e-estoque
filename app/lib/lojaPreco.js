// v1084 — Frente de caixa da loja física (NORT): motor de preço da calculadora do Gerson (conta pura, sem banco).
//   Dinheiro em CENTAVOS. Faixa de quantidade POR ITEM (nunca pelo pedido). Duas tabelas de faixa: padrão (1-5 · 6-10 · 11-19 · 20+)
//   e sublimação (1-5 · 6-10 · 11-20 · 21+). Outra cor: +15% por último, arredondado em centavos (não vale na sublimação).
//   Taxa de bordado: uma vez por pedido. Desconto extra sobre o valor COM desconto de quantidade e SEM a taxa.

export const PADRAO = {
  faixas: { PADRAO: [5, 10, 19], SUBLIMACAO: [5, 10, 20] },   // limites superiores das 3 primeiras faixas; acima = 4ª
  DTF: { "2x10": [1000, 900, 800, 700], "8x6": [1200, 1100, 1000, 900], "10x15": [1400, 1300, 1200, 1100], "29x21": [2000, 1800, 1600, 1400], "27x40": [2700, 2500, 2300, 2100] },
  BORDADO: { "2x10": [1500, 1200, 800, 600], "8x6": [1600, 1400, 1200, 800], "10x15": [1800, 1600, 1400, 1000] },
  bolso: [1600, 1400, 1200, 800],
  sublimacao: [7000, 3900, 2200, 1800],
  sublimacaoLonga: 400, texturizada: 2300, mangaLonga: 400, taxaBordado: 2000, outraCorPct: 15, descontoLivrePct: 10, entradaMinPct: 50,
  prazos: { personalizado: 5, encomenda: 20 },   // dias úteis
  // grupos de produto (preço base da calculadora). tipo: PADRAO | SUBLIMACAO | CALCA | LISA
  grupos: [
    { k: "pv-gola-vies", nome: "Camiseta Malha PV — gola viés", base: 2290, tipo: "PADRAO", longa: true, tecnicas: ["DTF", "BORDADO"], re: "PV.*VI[EÉ]S|VI[EÉ]S.*PV" },
    { k: "pv-gola-ribana", nome: "Camiseta Malha PV — gola ribana", base: 2590, tipo: "PADRAO", longa: true, tecnicas: ["DTF", "BORDADO"], re: "PV.*RIBANA|RIBANA.*PV" },
    { k: "algodao-30-1", nome: "Camiseta Algodão 30.1", base: 2690, tipo: "PADRAO", longa: false, tecnicas: ["DTF", "BORDADO"], re: "ALGOD[AÃ]O 30" },
    { k: "dry-fit-elastano", nome: "Camiseta Dry Fit c/ Elastano", base: 2490, tipo: "PADRAO", longa: true, tecnicas: ["DTF"], re: "DRY ?FIT.*ELAST" },
    { k: "viscose", nome: "Camiseta Viscose", base: 3990, tipo: "PADRAO", longa: false, tecnicas: ["DTF"], re: "VISCOSE" },
    { k: "algodao-egipcio", nome: "Camiseta Algodão Egípcio", base: 4290, tipo: "PADRAO", longa: false, tecnicas: ["DTF", "BORDADO"], re: "EG[IÍ]PCIO" },
    { k: "modal", nome: "Camiseta Modal", base: 7290, tipo: "LISA", longa: false, tecnicas: [], re: "MODAL" },
    { k: "polo-piquet", nome: "Polo Piquet PA", base: 4290, tipo: "PADRAO", longa: false, tecnicas: ["DTF", "BORDADO"], re: "POLO.*PIQUET" },
    { k: "polo-poliamida", nome: "Polo Poliamida", base: 7890, tipo: "LISA", longa: false, tecnicas: [], re: "POLO.*POLIAMIDA" },
    { k: "dryfit-sublimacao-total", nome: "Dry Fit Sublimação Total", base: 2490, tipo: "SUBLIMACAO", longa: true, tecnicas: [], re: "SUBLIMA" },
    { k: "calca-brim-leve", nome: "Calça Brim Leve", base: 5490, tipo: "CALCA", longa: false, tecnicas: [], bolso: true, re: "BRIM LEVE" },
    { k: "calca-brim-pesado", nome: "Calça Brim Pesado", base: 5890, tipo: "CALCA", longa: false, tecnicas: [], bolso: true, re: "BRIM PESADO" },
    { k: "calca-social", nome: "Calça Social", base: 8590, tipo: "LISA", longa: false, tecnicas: [], re: "CAL[CÇ]A SOCIAL" },
  ],
};

// posições de estampa × técnica × tamanhos permitidos (esquerdo/direito = de quem veste)
export const POSICOES = [
  { k: "FRENTE_ESQ", nome: "Frente esquerdo", DTF: ["2x10", "8x6"], BORDADO: ["2x10", "8x6"] },
  { k: "FRENTE_DIR", nome: "Frente direito", DTF: ["2x10", "8x6"], BORDADO: ["2x10", "8x6"] },
  { k: "FRENTE_CENTRO", nome: "Frente centro", DTF: ["2x10", "8x6", "10x15", "29x21"], BORDADO: [] },
  { k: "FRENTE_INF", nome: "Frente inferior", DTF: ["2x10", "8x6"], BORDADO: [] },
  { k: "COSTAS_TOPO", nome: "Costas topo", DTF: ["2x10", "8x6", "10x15", "29x21"], BORDADO: ["2x10", "8x6", "10x15"] },
  { k: "COSTAS_CENTRO", nome: "Costas centro", DTF: ["2x10", "8x6", "10x15", "29x21", "27x40"], BORDADO: [] },
  { k: "COSTAS_BARRA", nome: "Costas barra", DTF: ["2x10", "8x6", "10x15", "29x21"], BORDADO: [] },
  { k: "MANGA_ESQ", nome: "Manga esquerda", DTF: ["2x10", "8x6"], BORDADO: [] },
  { k: "MANGA_DIR", nome: "Manga direita", DTF: ["2x10", "8x6"], BORDADO: [] },
];
const POS = Object.fromEntries(POSICOES.map((p) => [p.k, p]));

export const grupoDe = (tab, k) => (tab.grupos || []).find((g) => g.k === k) || null;
export function grupoPorNome(tab, nome) {
  const n = String(nome || "").normalize("NFC").toUpperCase();
  return (tab.grupos || []).find((g) => g.re && new RegExp(g.re, "i").test(n)) || null;
}
export const qtdDe = (grade) => Object.values(grade || {}).reduce((s, q) => s + Math.max(0, Math.round(Number(q) || 0)), 0);
export function faixaIdx(tab, tipo, q) {
  const f = tab.faixas[tipo === "SUBLIMACAO" ? "SUBLIMACAO" : "PADRAO"];
  return q <= f[0] ? 0 : q <= f[1] ? 1 : q <= f[2] ? 2 : 3;
}

// limpa o item vindo da tela (técnica e estampas válidas para o grupo)
export function limparItem(tab, it) {
  const g = grupoDe(tab, it?.grupo);
  if (!g) return { erro: "Produto sem grupo de preço." };
  const grade = Object.fromEntries(Object.entries(it.grade || {}).map(([t, q]) => [String(t).toUpperCase().slice(0, 12), Math.max(0, Math.round(Number(q) || 0))]).filter(([, q]) => q > 0));
  const tecnica = g.tipo === "PADRAO" && g.tecnicas.includes(it.tecnica) ? it.tecnica : null;
  const estampas = tecnica ? (Array.isArray(it.estampas) ? it.estampas : []).filter((e) => POS[e?.local] && (POS[e.local][tecnica] || []).includes(e.tamanho))
    .filter((e, i, a) => a.findIndex((x) => x.local === e.local) === i).map((e) => ({ local: e.local, tamanho: e.tamanho, obs: e.obs ? String(e.obs).slice(0, 120) : null })) : [];
  const manga = g.longa && it.manga === "LONGA" ? "LONGA" : "CURTA";
  return {
    produtoId: Number(it.produtoId) || null, grupo: g.k, modelo: String(it.modelo || "").toUpperCase().slice(0, 160), fppId: Number(it.fppId) || null, fppNumero: Number(it.fppNumero) || null,
    grade, manga, tecnica: estampas.length ? tecnica : null, estampas,
    outraCor: g.tipo !== "SUBLIMACAO" && !!it.outraCor, corNome: it.outraCor ? String(it.corNome || "").toUpperCase().slice(0, 40) : null,
    encomenda: !!it.encomenda, malha: g.tipo === "SUBLIMACAO" && it.malha === "TEXTURIZADA" ? "TEXTURIZADA" : "LISA", bolso: g.tipo === "CALCA" && !!g.bolso && !!it.bolso,
    obs: it.obs ? String(it.obs).slice(0, 300) : null,
  };
}

// vai para a produção: personalizado, encomenda, outra cor, manga longa, sublimação ou bolso bordado
export function vaiProducao(tab, it) {
  const g = grupoDe(tab, it.grupo);
  return !!(it.tecnica || it.encomenda || it.outraCor || it.manga === "LONGA" || g?.tipo === "SUBLIMACAO" || it.bolso);
}

// preço por peça (centavos) na faixa idx
export function precoPeca(tab, it, idx) {
  const g = grupoDe(tab, it.grupo);
  if (!g) return 0;
  if (g.tipo === "SUBLIMACAO") return g.base + tab.sublimacao[idx] + (it.manga === "LONGA" ? tab.sublimacaoLonga : 0) + (it.malha === "TEXTURIZADA" ? tab.texturizada : 0);
  let p = g.base;
  if (g.tipo === "CALCA") p += it.bolso ? tab.bolso[idx] : 0;
  if (g.tipo === "PADRAO") {
    p += it.manga === "LONGA" ? tab.mangaLonga : 0;
    for (const e of it.estampas || []) p += (tab[it.tecnica]?.[e.tamanho] || [0, 0, 0, 0])[idx];
  }
  if (it.outraCor) p = Math.round(p * (100 + tab.outraCorPct) / 100);
  return p;
}

export function calcularItem(tab, it) {
  const g = grupoDe(tab, it.grupo);
  const q = qtdDe(it.grade);
  const idx = g && g.tipo !== "LISA" ? faixaIdx(tab, g.tipo, q) : 0;
  const unit = precoPeca(tab, it, idx), unit1 = precoPeca(tab, it, 0);
  return { qtd: q, faixa: idx, unit, unitTabela: unit1, total: unit * q, totalTabela: unit1 * q, producao: vaiProducao(tab, it), bordado: it.tecnica === "BORDADO" || !!it.bolso };
}

// desconto: { tipo: PCT|VALOR, valor } · acrescimo: { tipo, valor, obs } (nunca os dois) · credito (centavos, troca)
export function totaisPedido(tab, itens, { desconto, acrescimo } = {}) {
  const linhas = itens.map((it) => calcularItem(tab, it));
  const valorTabela = linhas.reduce((s, l) => s + l.totalTabela, 0);
  const semTaxa = linhas.reduce((s, l) => s + l.total, 0);
  const taxaBordado = linhas.some((l) => l.bordado) ? tab.taxaBordado : 0;
  const val = (x, base) => (!x || !(Number(x.valor) > 0) ? 0 : x.tipo === "VALOR" ? Math.round(Number(x.valor) * 100) : Math.round(base * Number(x.valor) / 100));
  const descontoExtra = Math.min(semTaxa, val(desconto, semTaxa));
  const acresc = descontoExtra ? 0 : val(acrescimo, semTaxa);
  const total = semTaxa - descontoExtra + acresc + taxaBordado;
  const producao = linhas.some((l) => l.producao);
  const descPct = semTaxa ? Math.round((descontoExtra / semTaxa) * 1000) / 10 : 0;
  return {
    linhas, valorTabela, semTaxa, descontoQuantidade: valorTabela - semTaxa, taxaBordado, descontoExtra, descontoPct: descPct, acrescimo: acresc,
    total, producao, entradaMinima: producao ? Math.ceil(total * tab.entradaMinPct / 100) : total, precisaSenha: descPct > tab.descontoLivrePct,
    pecas: linhas.reduce((s, l) => s + l.qtd, 0),
  };
}

// texto da personalização para o pedido de produção ("DTF · FRENTE ESQUERDO 8X6 | COSTAS CENTRO 27X40")
export function textoPersonalizacao(it) {
  if (!it.tecnica && !it.bolso) return "";
  if (it.bolso) return "BORDADO NO BOLSO";
  return `${it.tecnica} · ${it.estampas.map((e) => `${(POS[e.local]?.nome || e.local).toUpperCase()} ${e.tamanho.toUpperCase()}${e.obs ? ` (${e.obs.toUpperCase()})` : ""}`).join(" | ")}`;
}
export const brl = (c) => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
