// v620 — etiquetas de volume para impressora Zebra (página do tamanho da etiqueta, uma por página) com código de barras Code 128
const P = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"];
// Code 128-B: larguras das barras/espaços (sem as zonas de silêncio)
export function code128(txt) {
  const cs = [...String(txt)].map((ch) => { const c = ch.charCodeAt(0); return c >= 32 && c <= 126 ? c - 32 : 0; });
  let soma = 104; cs.forEach((c, i) => { soma += c * (i + 1); });
  return [104, ...cs, soma % 103, 106].map((c) => P[c]).join("");
}
export function barrasSvg(txt, { altura = 40, modulo = 1.6 } = {}) {
  const w = code128(txt); let x = 10 * modulo; const rs = [];
  [...w].forEach((d, i) => { const l = Number(d) * modulo; if (i % 2 === 0) rs.push(`<rect x="${x.toFixed(2)}" y="0" width="${l.toFixed(2)}" height="${altura}"/>`); x += l; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(x + 10 * modulo).toFixed(2)} ${altura}" preserveAspectRatio="none" style="width:100%;height:100%">${rs.join("")}</svg>`;
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const nBR = (n, d = 3) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
const UN = { M: "M", KG: "KG", UN: "UN", PC: "PÇ", CM: "CM", L: "L", CONE: "CONE", PCT: "PCT" };
// v1152 — padrão: 10 cm de largura × 8,5 cm de altura (pré-selecionada) e 5 × 5 cm
export const TAMANHOS = { "100x85": [100, 85], "50x50": [50, 50] };
export const TAMANHO_PADRAO = "100x85";
export const nomeTamanho = (k) => ({ "100x85": "10 × 8,5 cm", "50x50": "5 × 5 cm" }[k] || k);
const qtdTxt = (e) => {
  const u = UN[String(e.unidade || "").toUpperCase()] || String(e.unidade || "").toUpperCase();
  let t = `${nBR(e.quantidade)} ${u}`;
  if (e.unidade === "PCT" && e.unidadesPacote) t += ` (${nBR(e.unidadesPacote, 0)} UN/PCT)`;
  return t;
};
// etiqueta: { codigo, tipo, artigo, cor, codigoArtigo, fornecedor, largura, construcao, quantidade, unidade, unidadesPacote, pesoKg, gramatura, origem, entrada, ordem, total }
export function htmlEtiquetas(etiquetas, { tamanho = TAMANHO_PADRAO, autoPrint = true } = {}) {
  const [W, H] = TAMANHOS[tamanho] || TAMANHOS[TAMANHO_PADRAO];
  const p = W <= 50;   // 5 × 5: compacta
  const linha = (k, v, cls = "") => (v == null || v === "" ? "" : `<tr class="${cls}"><th>${k}</th><td>${esc(v)}</td></tr>`);
  const pags = etiquetas.map((e) => {
    const larg = e.largura ? `${String(nBR(e.largura, 3))} M` : "";
    const qt = qtdTxt(e) + (e.pesoKg ? ` · ${nBR(e.pesoKg)} KG` : "");
    return `<div class="et">
    <div class="topo"><div class="tipo">${esc(e.tipo || "—")}</div>${e.total ? `<div class="vol">VOL ${e.ordem}/${e.total}</div>` : ""}</div>
    <table>
      ${linha("ARTIGO", e.artigo, "art")}
      ${linha("COR", e.cor)}
      ${linha("CÓDIGO", e.codigoArtigo)}
      ${linha(p ? "FORN." : "FORNECEDOR", e.fornecedor)}
      ${linha(p ? "LARG." : "LARGURA", larg)}
      ${linha(p ? "CONSTR." : "CONSTRUÇÃO", e.construcao)}
      ${linha(p ? "QTD" : "QUANTIDADE", qt, "qtd")}
      ${linha("ORIGEM", e.origem)}
      ${p ? "" : linha("ENTRADA", dBR(e.entrada))}
    </table>
    <div class="bar">${barrasSvg(e.codigo)}</div><div class="cod">${esc(e.codigo)}</div>
  </div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${etiquetas.length} volume(s)</title><style>
    @page { size: ${W}mm ${H}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; }
    .et { width: ${W}mm; height: ${H}mm; padding: ${p ? "1.5mm" : "2.5mm 3mm"}; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
    .topo { display: flex; align-items: center; gap: 1.5mm; margin-bottom: ${p ? 0.8 : 1.5}mm; }
    .tipo { flex: 1; font-weight: 800; font-size: ${p ? 7.5 : 12}pt; background: #000; color: #fff; padding: ${p ? ".4mm 1mm" : ".8mm 2mm"}; border-radius: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .vol { font-weight: 800; font-size: ${p ? 7 : 10}pt; border: 1.2px solid #000; border-radius: 1mm; padding: .3mm 1.2mm; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: ${p ? ".6px" : "1px"} solid #000; padding: ${p ? ".25mm .8mm" : ".6mm 1.5mm"}; text-align: left; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    th { width: ${p ? "12mm" : "26mm"}; font-size: ${p ? 5.5 : 7.5}pt; font-weight: 700; background: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td { font-size: ${p ? 6.5 : 9.5}pt; font-weight: 600; }
    tr.art td { font-size: ${p ? 7 : 12}pt; font-weight: 800; white-space: normal; line-height: 1.05; max-height: ${p ? 6 : 10}mm; }
    tr.qtd td { font-size: ${p ? 8 : 15}pt; font-weight: 800; }
    .bar { flex: 1; min-height: ${p ? 4 : 7}mm; margin-top: ${p ? 0.8 : 1.5}mm; }
    .cod { text-align: center; font-family: 'Courier New', monospace; font-size: ${p ? 6 : 8}pt; letter-spacing: 1px; }
  </style></head><body>${pags}${autoPrint ? "<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>" : ""}</body></html>`;
}
export function imprimirEtiquetas(etiquetas, { tamanho = TAMANHO_PADRAO } = {}) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para imprimir as etiquetas."); return; }
  w.document.write(htmlEtiquetas(etiquetas, { tamanho })); w.document.close();
}
