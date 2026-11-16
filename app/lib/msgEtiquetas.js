// v862 — etiquetas das mensagens. Sem etiqueta gravada: as automáticas do fluxo de lançamento de pedidos
// (solicitação/conclusão de "LANÇAR PEDIDO", layout, pedido do portal) viram LANCAMENTO; o resto, COMUNICACAO.
export const ETIQUETAS = [
  { k: "COMUNICACAO", nome: "Comunicação", cor: "#2563EB" },
  { k: "LANCAMENTO", nome: "Lançamento de pedidos", cor: "#F06A1E" },
];
const RE_LANC = /LAN[ÇC]AR PEDIDO|LAN[ÇC]AMENTO DE PEDIDO|CRIA[ÇC][ÃA]O DE LAYOUT|APROVA[ÇC][ÃA]O DE LAYOUT|LAYOUT (APROVADO|REPROVADO)|PEDIDO DO PORTAL/i;
export const etiquetaAuto = (texto) => (RE_LANC.test(String(texto || "")) ? "LANCAMENTO" : "COMUNICACAO");
export const etiquetaDe = (m) => (ETIQUETAS.some((e) => e.k === m?.etiqueta) ? m.etiqueta : etiquetaAuto(m?.texto));
export const ehEtiqueta = (k) => ETIQUETAS.some((e) => e.k === k);
