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
const qtdTxt = (q, u) => `${Number(q || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${String(u || "").toUpperCase()}`;
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
export const TAMANHOS = { "100x60": [100, 60], "100x50": [100, 50], "100x75": [100, 75], "100x150": [100, 150], "80x50": [80, 50] };

// etiquetas: [{ codigo, artigoInterno, cor, codigoArtigo, largura, composicao, quantidade, unidade, nfNumero, fornecedor, entrada, ordem, total }]
export function imprimirEtiquetas(etiquetas, { tamanho = "100x60" } = {}) {
  const [W, H] = TAMANHOS[tamanho] || TAMANHOS["100x60"];
  const grande = H >= 75;
  const pags = etiquetas.map((e) => `<div class="et">
    <div class="topo"><div class="art">${esc(e.artigoInterno)}</div><div class="vol">VOL ${e.ordem}/${e.total}</div></div>
    <div class="det">${[e.cor && `Cor: <b>${esc(e.cor)}</b>`, e.codigoArtigo && `Cód.: <b>${esc(e.codigoArtigo)}</b>`, e.largura && `Larg.: <b>${String(e.largura).replace(".", ",")} m</b>`].filter(Boolean).join(" · ") || "&nbsp;"}</div>
    ${grande && e.composicao ? `<div class="det">${esc(e.composicao)}</div>` : ""}
    <div class="meio"><div class="qtd">${esc(qtdTxt(e.quantidade, e.unidade))}</div>
      <div class="nf">NF de compra <b>${esc(e.nfNumero || "—")}</b><br/>Entrada <b>${esc(dBR(e.entrada))}</b>${e.fornecedor ? `<br/><span class="f">${esc(e.fornecedor)}</span>` : ""}</div></div>
    <div class="ped">PEDIDO:</div>
    <div class="bar">${barrasSvg(e.codigo)}</div><div class="cod">${esc(e.codigo)}</div>
  </div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${etiquetas.length} volume(s)</title><style>
    @page { size: ${W}mm ${H}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; }
    .et { width: ${W}mm; height: ${H}mm; padding: 2.5mm 3mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
    .topo { display: flex; align-items: flex-start; gap: 2mm; }
    .art { flex: 1; font-weight: 800; font-size: ${grande ? 17 : 13.5}pt; line-height: 1.05; max-height: ${grande ? 15 : 10.5}mm; overflow: hidden; text-transform: uppercase; }
    .vol { font-weight: 700; font-size: 9pt; border: 1.2px solid #000; border-radius: 1.5mm; padding: .5mm 1.5mm; white-space: nowrap; }
    .det { font-size: 8.5pt; margin-top: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meio { display: flex; align-items: center; gap: 3mm; margin-top: 1.2mm; }
    .qtd { font-weight: 800; font-size: ${grande ? 22 : 17}pt; white-space: nowrap; }
    .nf { font-size: 8pt; line-height: 1.25; border-left: 1px solid #000; padding-left: 2.5mm; min-width: 0; }
    .nf .f { font-size: 7pt; }
    .ped { margin-top: 1.5mm; border: 1.2px solid #000; border-radius: 1mm; padding: 1mm 1.5mm; font-weight: 700; font-size: 9pt; height: ${grande ? 9 : 6.5}mm; }
    .bar { flex: 1; min-height: 7mm; margin-top: 1.5mm; }
    .cod { text-align: center; font-family: 'Courier New', monospace; font-size: 8pt; letter-spacing: 1px; }
  </style></head><body>${pags}<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para imprimir as etiquetas."); return; }
  w.document.write(html); w.document.close();
}
