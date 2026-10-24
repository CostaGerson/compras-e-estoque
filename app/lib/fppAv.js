// v410 — aviamentos da FPP por metro (elástico e faixa) e tipos de botão.
// Funções puras: usadas na ficha (comercial.jsx) e na demanda de compras (lib/compras.js).
//  · ELÁSTICO: cada especificação tem consumo (m/peça) e R$/m → R$/peça = consumo × R$/m
//  · FAIXA: a aplicação (camisa tórax + mangas, calça…) tem o consumo (m/peça); o TIPO de faixa tem o R$/m
//  · BOTÃO: tipo com R$/unidade
//  Sem consumo ou sem R$/m preenchidos, vale o R$/peça antigo da especificação.

export const FAIXA_TIPOS = [
  "FAIXA SIMPLES 2,5CM",
  "FAIXA SIMPLES 5CM",
  "FAIXA MONTADA C/ TACTEL 2,5CM (5CM TOTAL)",
  "FAIXA MONTADA C/ TACTEL 5CM (10CM TOTAL)",
  "FAIXA PRONTA GORGURÃO 2,5CM (5CM TOTAL)",
  "FAIXA PRONTA GORGURÃO 5CM (10CM TOTAL)",
];
export const FAIXA_CORES = ["VERDE FLUOR", "LARANJA FLUOR"];
export const BOTAO_TIPOS = [
  "MASSA 4 FUROS",
  "PRESSÃO /100 FERRO",
  "PRESSÃO /100 LATÃO",
  "PRESSÃO /80 FERRO",
  "PRESSÃO /80 LATÃO",
  "FLEXÍVEL PARA CALÇA",
];
export const faixaPedeCor = (tipo) => /MONTADA|PRONTA/i.test(String(tipo || ""));
export const semAv = (v) => !String(v || "").trim() || /^SEM\b/i.test(String(v).trim());

const n = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const x = parseFloat(s);
  return isNaN(x) ? 0 : x;
};

// get(grupo, chave, campo) devolve o parâmetro (já com o override da ficha); campo "valor" ou um campo do extra
export function elasticoCalc(get, chave) {
  if (semAv(chave)) return { valor: 0, consumo: 0, metro: 0, porMetro: false };
  const consumo = n(get("ELASTICO", chave, "consumo")), metro = n(get("ELASTICO", chave, "valorMetro"));
  if (consumo > 0 && metro > 0) return { valor: consumo * metro, consumo, metro, porMetro: true };
  return { valor: n(get("ELASTICO", chave, "valor")), consumo, metro, porMetro: false };
}

export function faixaCalc(get, aplicacao, tipo) {
  if (semAv(aplicacao)) return { valor: 0, consumo: 0, metro: 0, porMetro: false };
  const consumo = n(get("FAIXA", aplicacao, "consumo")), metro = tipo ? n(get("FAIXA_TIPO", tipo, "valor")) : 0;
  if (consumo > 0 && metro > 0) return { valor: consumo * metro, consumo, metro, porMetro: true };
  return { valor: n(get("FAIXA", aplicacao, "valor")), consumo, metro, porMetro: false };
}

export function botaoUnit(get, tipo) {
  const v = tipo ? n(get("BOTAO", tipo, "valor")) : 0;
  return v > 0 ? v : n(get("CONST", "BOTAO_UNIT", "valor"));
}

export const nomeFaixaCompra = (tipo, cor) => [String(tipo || "").trim().toUpperCase(), faixaPedeCor(tipo) && cor ? String(cor).toUpperCase() : ""].filter(Boolean).join(" ");
export const fmtNum = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 4) });

// v413 — observação do material do botão
export const obsBotao = (tipo) => (/LAT[AÃ]O/i.test(String(tipo || "")) ? "NÃO ENFERRUJA" : /FERRO/i.test(String(tipo || "")) ? "ENFERRUJA" : "");
