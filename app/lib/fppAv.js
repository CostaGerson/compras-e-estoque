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
export const ehMontada = (tipo) => /MONTADA/i.test(String(tipo || ""));   // v506
export const faixaPedeCor = (tipo) => /MONTADA|PRONTA/i.test(String(tipo || ""));
export const semAv = (v) => !String(v || "").trim() || /^SEM\b/i.test(String(v).trim());

// v1128 — gola e punho: a sobreposição vem no próprio nome da opção (sem checkbox)
//   GOLA: RIBANA · RIBANA SOBREPOSTA · PRÓPRIA MALHA · PRÓPRIA MALHA SOBREPOSTA
//   PUNHO: RIBANA · RIBANA SOBREPOSTO · BAINHA (substitui "sem punho") · BAINHA SOBREPOSTO
//   Própria malha (com ou sem sobreposta) e bainha sobreposto usam o consumo da malha em peças/m (gola 35 · punho 45).
const nrmGP = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export const GOLA_OPCOES = ["RIBANA", "RIBANA SOBREPOSTA", "PRÓPRIA MALHA", "PRÓPRIA MALHA SOBREPOSTA"];
export const PUNHO_OPCOES = ["RIBANA", "RIBANA SOBREPOSTO", "BAINHA", "BAINHA SOBREPOSTO"];
export const ehSobreposto = (v) => /SOBREPOST/.test(nrmGP(v));
export const ehPropriaMalha = (v) => /PROPRIA MALHA/.test(nrmGP(v));
export const ehBainha = (v) => /\bBAINHA\b/.test(nrmGP(v));
// base: "RIBANA" | "MALHA" (gola própria malha) | "NADA" (bainha) | null (outra opção do cadastro) · sob: "RIBANA" | "MALHA" | null
export function golaPunhoInfo(grupo, v) {
  const s = nrmGP(v);
  const rib = /\bRIBANA\b/.test(s), pm = ehPropriaMalha(s), bainha = ehBainha(s);
  const base = rib ? "RIBANA" : pm && grupo === "GOLA" ? "MALHA" : bainha ? "NADA" : null;
  const sob = !ehSobreposto(s) ? null : rib ? "RIBANA" : pm || bainha ? "MALHA" : null;
  return { base, sob };
}
// lista do combo: as opções fixas primeiro (sobrepostas só onde a peça permite) e depois o resto do cadastro, sem repetir e sem "SEM PUNHO"
export function opcoesGolaPunho(grupo, chaves, podeSob) {
  const fixas = (grupo === "PUNHO" ? PUNHO_OPCOES : GOLA_OPCOES).filter((o) => podeSob || !ehSobreposto(o));
  const ja = new Set((grupo === "PUNHO" ? PUNHO_OPCOES : GOLA_OPCOES).map(nrmGP));
  const resto = (chaves || []).filter((c) => { const s = nrmGP(c); return s && !ja.has(s) && !(grupo === "PUNHO" && /^SEM\b/.test(s)); });
  return [...fixas, ...resto];
}

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

// v505 — faixa SEMPRE = consumo da aplicação (m/peça) × R$/m do tipo de faixa (sem o R$/peça fixo antigo)
export function faixaCalc(get, aplicacao, tipo) {
  if (semAv(aplicacao)) return { valor: 0, consumo: 0, metro: 0, porMetro: false };
  // v506 — faixa montada c/ tactel: R$/m da faixa + R$/m do tactel (mesmo consumo para os dois)
  const consumo = n(get("FAIXA", aplicacao, "consumo")), metroFaixa = tipo ? n(get("FAIXA_TIPO", tipo, "valor")) : 0;
  const montada = ehMontada(tipo), metroTactel = montada ? n(get("FAIXA_TIPO", tipo, "tactel")) : 0;
  const metro = metroFaixa + metroTactel;
  return { valor: consumo * metro, consumo, metro, metroFaixa, metroTactel, montada, porMetro: consumo > 0 && metro > 0,
    falta: !tipo ? "TIPO" : !consumo ? "CONSUMO" : !metroFaixa ? "METRO" : montada && !metroTactel ? "TACTEL" : null };
}

export function botaoUnit(get, tipo) {
  const v = tipo ? n(get("BOTAO", tipo, "valor")) : 0;
  return v > 0 ? v : n(get("CONST", "BOTAO_UNIT", "valor"));
}

// v997 — faixa montada: a compra é da faixa refletiva simples (mesma largura) + o tactel na cor; um é costurado no outro
export const faixaRefletivaDaMontada = (tipo) => { const m = String(tipo || "").toUpperCase().match(/TACTEL\s+(\d+(?:,\d+)?\s*CM)/); return m ? `FAIXA SIMPLES ${m[1].replace(/\s+/g, "")}` : "FAIXA SIMPLES"; };
export const nomeFaixaCompra = (tipo, cor) => [String(tipo || "").trim().toUpperCase(), faixaPedeCor(tipo) && cor ? String(cor).toUpperCase() : ""].filter(Boolean).join(" ");
export const fmtNum = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 4) });

// v413 — observação do material do botão
export const obsBotao = (tipo) => (/LAT[AÃ]O/i.test(String(tipo || "")) ? "NÃO ENFERRUJA" : /FERRO/i.test(String(tipo || "")) ? "ENFERRUJA" : "");

// v512 — peças especiais da FPP (não vêm do banco de parâmetros)
//  · ACESSÓRIO MALHA / ACESSÓRIO PLANO: ficha aberta — rendimento/consumo, corte, expedição/acabamento digitados
//    e todos os aviamentos (gola, punho, elástico, faixa, botão) e forro disponíveis
//  · PRODUTO REVENDA: só preço de custo + personalização, lead time, logística/embalagem e operação financeira
export const PECA_AC_MALHA = "ACESSÓRIO MALHA";
export const PECA_AC_PLANO = "ACESSÓRIO PLANO";
export const PECA_REVENDA = "PRODUTO REVENDA";
export const PECAS_ESPECIAIS = [
  { chave: PECA_AC_MALHA, tipo: "MALHA" },
  { chave: PECA_AC_PLANO, tipo: "PLANO" },
  { chave: PECA_REVENDA, tipo: "REVENDA" },
];
const _semAc = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
export const ehPecaAberta = (item) => ["ACESSORIO MALHA", "ACESSORIO PLANO"].includes(_semAc(item));
export const ehRevenda = (item, tipo) => tipo === "REVENDA" || _semAc(item) === "PRODUTO REVENDA";
