// v923 — Análises operacionais › custo de sublimação e de DTF (planilhas "Levantamento de custos" do Igor).
//   Esquerda: custo do metro linear (equipamento, cabeças, depreciação e insumos — editável, os preços mudam).
//   Direita: composição de custo por peça até o CUSTO TOTAL (uma linha por arte).
//   Funções puras: usadas na tela e testadas contra as planilhas.

const n = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const x = parseFloat(s);
  return isNaN(x) ? 0 : x;
};

// seções do metro linear: campos { k, l, tipo: "txt" | "num" | "R$" } e resultados calculados { k, l, calc }
export const MODELOS = {
  SUBLIMACAO: {
    titulo: "Sublimação",
    secoes: [
      { t: "Equipamento", campos: [["marca", "Marca", "txt"], ["modelo", "Modelo", "txt"], ["valor", "Valor", "R$"], ["cabecas", "Quantidade de cabeças", "num"], ["equipamentos", "Quantidade de equipamentos", "num"], ["velocidade", "Velocidade (m/h) 6 pass", "num"], ["horasDia", "Horas trabalhadas por dia", "num"], ["diasMes", "Dias trabalhados por mês", "num"]],
        calc: [["prodMes", "Produção mensal (m)"]] },
      { t: "Cabeças de impressão", campos: [["cabMarca", "Marca", "txt"], ["cabDurab", "Durabilidade média (meses)", "num"], ["cabQtd", "Quantidade de cabeças", "num"], ["cabValor", "Valor de cada cabeça", "R$"]],
        calc: [["cabMetros", "Metro linear impresso na durabilidade"], ["cabTotal", "Valor total das cabeças"], ["cabPorM", "Custo cabeça por metro linear"]] },
      { t: "Depreciação do equipamento", campos: [["deprMeses", "Depreciação (meses)", "num"]], calc: [["deprProd", "Produção na depreciação (m)"], ["deprPorM", "Depreciação por metro linear"]] },
      { t: "Substrato", campos: [["papelValor", "Papel (bobina) — valor", "R$"], ["papelMetros", "Quantidade em metro linear", "num"]], calc: [["papelPorM", "Papel × metro linear"]] },
      { t: "Tinta pigmento — colorido", campos: [["tintaMarca", "Marca / modelo", "txt"], ["tintaConsumo", "Consumo médio (L × m)", "num"], ["tintaValor", "Valor da tinta média (CMYK)", "R$"]], calc: [["tintaPorM", "Tinta colorida × metro linear"]] },
      { t: "Solução de limpeza", campos: [["limpMarca", "Marca / modelo", "txt"], ["limpConsumo", "Consumo médio (L × m)", "num"], ["limpValor", "Valor da solução", "R$"]], calc: [["limpPorM", "Solução de limpeza × metro linear"]] },
    ],
    padrao: { marca: "JETPRIME", modelo: "SUBLIMÁTICA", valor: 135000, cabecas: 4, equipamentos: 1, velocidade: 90, horasDia: 12, diasMes: 20,
      cabMarca: "EPSON I3200", cabDurab: 12, cabQtd: 4, cabValor: 8000, deprMeses: 60, papelValor: 977.5, papelMetros: 500,
      tintaMarca: "Subly Prime", tintaConsumo: 0.012, tintaValor: 184, limpMarca: "Pigment Prime 01 litro", limpConsumo: 0.0018, limpValor: 120 },
    // colunas da composição por peça (até o custo total)
    colunas: [["unidades", "Un./m"]],
    linhas: [
      ["METRO LINEAR SUBLIMAÇÃO", { unidades: 1 }],
      ["SUBLIMAÇÃO TOTAL CAMISETA MC", { unidades: 1.35, recorte: 0.42, prensagem: 1.12 }],
      ["SUBLIMAÇÃO TOTAL CAMISETA ML", { unidades: 0.64, recorte: 0.42, prensagem: 1.12 }],
      ["SUBLIMAÇÃO FRENTE/COSTAS", { unidades: 1.1, recorte: 0.3, prensagem: 1 }],
      ["SUBLIMAÇÃO MC", { unidades: 6, recorte: 0.1833, prensagem: 0.55 }],
      ["SUBLIMAÇÃO ML", { unidades: 2.77, recorte: 0.1833, prensagem: 0.55 }],
      ["SUBLIMAÇÃO LOCALIZADA A4", { unidades: 21, recorte: 0.1833, prensagem: 0.55 }],
      ["SUBLIMAÇÃO LOCALIZADA 8X6", { unidades: 216, recorte: 0.1833, prensagem: 0.55 }],
    ],
  },
  DTF: {
    titulo: "DTF",
    secoes: [
      { t: "Equipamento", campos: [["marca", "Marca", "txt"], ["modelo", "Modelo", "txt"], ["valor", "Valor", "R$"], ["cabecas", "Quantidade de cabeças", "num"], ["equipamentos", "Quantidade de equipamentos", "num"], ["velocidade", "Velocidade (m/h) 06/08 pass", "num"], ["horasDia", "Horas trabalhadas por dia", "num"], ["diasMes", "Dias trabalhados por mês", "num"]],
        calc: [["prodMes", "Produção mensal (m)"]] },
      { t: "Cabeças de impressão", campos: [["cabMarca", "Marca", "txt"], ["cabDurab", "Durabilidade média (meses)", "num"], ["cabQtd", "Quantidade de cabeças", "num"], ["cabValor", "Valor de cada cabeça", "R$"]],
        calc: [["cabMetros", "Metro linear impresso na durabilidade"], ["cabTotal", "Valor total das cabeças"], ["cabPorM", "Custo cabeça por metro linear"]] },
      { t: "Depreciação do equipamento", campos: [["deprMeses", "Depreciação (meses)", "num"]], calc: [["deprProd", "Produção na depreciação (m)"], ["deprPorM", "Depreciação por metro linear"]] },
      { t: "Substrato", campos: [["papelValor", "Filme bobina 100 × 0,60 m — valor", "R$"], ["papelMetros", "Quantidade em metro linear", "num"]], calc: [["papelPorM", "Filme × metro linear"]] },
      { t: "Tinta pigmento — colorido", campos: [["tintaMarca", "Marca / modelo", "txt"], ["tintaConsumo", "Consumo médio (L × m)", "num"], ["tintaValor", "Valor da tinta média (CMYK)", "R$"]], calc: [["tintaPorM", "Tinta colorida × metro linear"]] },
      { t: "Tinta pigmento — branco", campos: [["brancaMarca", "Marca / modelo", "txt"], ["brancaConsumo", "Consumo médio (L × m)", "num"], ["brancaValor", "Valor da tinta média (branco)", "R$"]], calc: [["brancaPorM", "Tinta branca × metro linear"]] },
      { t: "Cola TPU", campos: [["colaValor", "Cola TPU 1,0 kg — valor", "R$"], ["colaRend", "Rendimento aproximado (m por kg)", "num"]], calc: [["colaPorM", "Cola × metro linear"]] },
      { t: "Solução de limpeza", campos: [["limpMarca", "Marca / modelo", "txt"], ["limpConsumo", "Consumo médio (L × m)", "num"], ["limpValor", "Valor da solução", "R$"]], calc: [["limpPorM", "Solução de limpeza × metro linear"]] },
    ],
    padrao: { marca: "JETPRIME", modelo: "DTF", valor: 110000, cabecas: 2, equipamentos: 1, velocidade: 7, horasDia: 8, diasMes: 22,
      cabMarca: "EPSON I3200", cabDurab: 12, cabQtd: 2, cabValor: 8000, deprMeses: 60, papelValor: 450, papelMetros: 100,
      tintaMarca: "Pigment Prime 01 litro", tintaConsumo: 0.012, tintaValor: 287.5, brancaMarca: "Pigment Prime 01 litro", brancaConsumo: 0.018, brancaValor: 287.5,
      colaValor: 100, colaRend: 33.3, limpMarca: "Pigment Prime 01 litro", limpConsumo: 0.0018, limpValor: 230 },
    colunas: [["altura", "Alt. (m)"], ["largura", "Larg. (m)"], ["unidades", "Est./m"]],
    linhas: [
      ["METRO LINEAR DTF", { altura: 1, largura: 0.6, unidades: 0.8 }],
      ["DTF NOME 2X10", { altura: 0.02, largura: 0.1, unidades: 261, recorte: 0.1, prensagem: 0.38 }],
      ["DTF LOGO 8X6", { altura: 0.08, largura: 0.06, unidades: 105, recorte: 0.1, prensagem: 0.38 }],
      ["DTF COSTAS 10X15", { altura: 0.1, largura: 0.15, unidades: 30, recorte: 0.1, prensagem: 0.38 }],
      ["DTF A4 FRENTE 29X21", { altura: 0.29, largura: 0.21, unidades: 8, recorte: 0.1, prensagem: 0.38 }],
      ["DTF A4 COSTAS 29X21", { altura: 0.29, largura: 0.21, unidades: 8, recorte: 0.1, prensagem: 0.38 }],
    ],
  },
};
export const TIPOS = Object.keys(MODELOS);

// metro linear: devolve os calculados e o total (R$/m)
export function calcMetro(tipo, p0) {
  const p = { ...MODELOS[tipo].padrao, ...(p0 || {}) };
  const c = {};
  c.prodMes = n(p.velocidade) * n(p.horasDia) * n(p.diasMes);
  c.cabMetros = n(p.cabDurab) * c.prodMes;
  c.cabTotal = n(p.cabQtd) * n(p.cabValor);
  c.cabPorM = c.cabMetros ? c.cabTotal / c.cabMetros : 0;
  c.deprProd = n(p.deprMeses) * c.prodMes;
  c.deprPorM = c.deprProd ? n(p.valor) / c.deprProd : 0;
  c.papelPorM = n(p.papelMetros) ? n(p.papelValor) / n(p.papelMetros) : 0;
  c.tintaPorM = n(p.tintaValor) * n(p.tintaConsumo);
  c.limpPorM = n(p.limpValor) * n(p.limpConsumo);
  if (tipo === "DTF") { c.brancaPorM = n(p.brancaValor) * n(p.brancaConsumo); c.colaPorM = n(p.colaRend) ? n(p.colaValor) / n(p.colaRend) : 0; }
  c.total = c.cabPorM + c.deprPorM + c.papelPorM + c.tintaPorM + c.limpPorM + (c.brancaPorM || 0) + (c.colaPorM || 0);
  return { p, c };
}
// composição por peça: material = R$/m ÷ unidades por m; total = material + M.O. + recorte + prensagem
export function calcLinha(l, totalM) {
  const material = n(l.unidades) ? totalM / n(l.unidades) : 0;
  return { material, total: material + n(l.mo) + n(l.recorte) + n(l.prensagem) };
}
export function padraoDe(tipo) {
  const m = MODELOS[tipo];
  return { params: { ...m.padrao }, linhas: m.linhas.map(([nome, x]) => ({ nome, mo: "", recorte: "", prensagem: "", ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v])) })) };
}
export const numCI = n;
