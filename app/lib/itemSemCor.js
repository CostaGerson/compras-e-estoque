// v1108 — nome da peça sem a cor no fim ("CAMISETA NATAL FAMILIA LT MARFIM" → "CAMISETA NATAL FAMILIA LT"), para o link de preenchimento
const CORES = new Set(("PRETO PRETA BRANCO BRANCA MARFIM OFF WHITE OFFWHITE OFF-WHITE AZUL MARINHO ROYAL VERDE MUSGO BANDEIRA BB VERMELHO VERMELHA AMARELO AMARELA " +
  "CINZA MESCLA MESCLADO GRAFITE CHUMBO ROSA BEBE BEGE AREIA MARROM VINHO BORDO LARANJA ROXO ROXA LILAS CARAMELO CAQUI KHAKI NUDE PETROLEO MILITAR OLIVA " +
  "TERRACOTA MOSTARDA CORAL CELESTE TURQUESA GELO NOITE ATLANTICO FOLHA CLARO CLARA ESCURO ESCURA MOTORISTA CALCARIO LEGADO ARDOSIA CRU NATURAL DOURADO PRATA").split(" "));
const sa = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
export function itemDoTitulo(t) {
  const p = String(t || "").split("·").map((x) => x.trim()).filter(Boolean);
  const w = String(p[p.length - 1] || "").toUpperCase().split(/\s+/).filter(Boolean);
  while (w.length > 1 && (CORES.has(sa(w[w.length - 1]).replace(/[()]/g, "")) || /^\(?\d+\)?$/.test(w[w.length - 1]))) w.pop();
  return w.join(" ") || "PEÇA";
}
