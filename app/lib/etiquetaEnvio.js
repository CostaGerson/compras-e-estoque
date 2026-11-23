// v1076 — etiqueta de envio 10 × 15 cm no padrão Correios (destinatário com CEP em código de barras, remetente,
//   pedido, volume e peso; código de rastreio em barras quando houver). Leitura pura: roda no navegador.
//   Não é etiqueta de postagem paga (sem SIGEP/contrato): a postagem é feita no balcão ou com o código do contrato.

export const REMETENTE = {
  nome: "MERIDIAN LTDA", cnpj: "48.011.287/0001-81", rua: "RUA VIANA DO CASTELO", numero: "916", complemento: "",
  bairro: "SÃO FRANCISCO", cidade: "BELO HORIZONTE", uf: "MG", cep: "31255-160", fone: "(31) 3656-4398",
};

// Code 128-B → retângulos (larguras em módulos)
const P = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"];
export function code128B(txt) {
  const s = String(txt || "").replace(/[^\x20-\x7E]/g, "");
  const cods = [104, ...[...s].map((c) => c.charCodeAt(0) - 32)];
  const chk = cods.reduce((a, c, i) => a + c * (i || 1), 0) % 103;
  return [...cods, chk, 106].map((c) => P[c]).join("");
}
export function barrasSvg(txt, { altura = 46, modulo = 1.6 } = {}) {
  const w = code128B(txt);
  if (!txt) return "";
  let x = 10 * modulo, rects = "";
  [...w].forEach((d, i) => { const l = Number(d) * modulo; if (i % 2 === 0) rects += `<rect x="${x.toFixed(2)}" y="0" width="${l.toFixed(2)}" height="${altura}"/>`; x += l; });
  const tot = x + 10 * modulo;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot.toFixed(2)} ${altura}" preserveAspectRatio="none" style="width:100%;height:${altura}px">${rects}</svg>`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const so = (s) => String(s || "").replace(/\D/g, "");
const cepFmt = (v) => { const c = so(v); return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : String(v || ""); };
const foneFmt = (v) => { const c = so(v); return c.length === 11 ? c.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : c.length === 10 ? c.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : String(v || ""); };

// destinatário a partir do cliente final do portal ({ tipo, nome | razaoSocial, contato, rua, numero, … })
export function destinatarioDe(cf) {
  const c = cf || {};
  return { nome: String((c.tipo === "PJ" ? c.razaoSocial : c.nome) || "").toUpperCase(), aosCuidados: c.tipo === "PJ" && c.contato ? String(c.contato).toUpperCase() : "",
    rua: String(c.rua || "").toUpperCase(), numero: c.numero || "", complemento: String(c.complemento || "").toUpperCase(), bairro: String(c.bairro || "").toUpperCase(),
    cidade: String(c.cidade || "").toUpperCase(), uf: String(c.uf || "").toUpperCase(), cep: c.cep || "", fone: c.whatsapp || "" };
}
export function faltasDestinatario(d) {
  const f = [];
  if (!d.nome) f.push("nome"); if (!d.rua) f.push("rua"); if (!d.numero) f.push("número"); if (!d.cidade) f.push("cidade"); if (!d.uf) f.push("UF");
  if (so(d.cep).length !== 8) f.push("CEP");
  return f;
}

// HTML de uma ou mais etiquetas (uma por volume) — abre numa janela e imprime em 10 × 15 cm
export function htmlEtiqueta({ dest, rem = REMETENTE, pedido, pedidoPortal, cliente, rastreio, volumes = 1, pecas, peso, obs }) {
  const n = Math.max(1, Math.min(50, Number(volumes) || 1));
  const uma = (v) => `
  <div class="et">
    <div class="topo"><div><div class="marca">MERIDIAN</div><div class="sub">${esc(cliente || "")}</div></div>
      <div class="ped"><div>PEDIDO <b>${esc(pedido || "—")}</b></div>${pedidoPortal ? `<div>PORTAL <b>${esc(pedidoPortal)}</b></div>` : ""}<div>VOLUME <b>${v}/${n}</b></div></div></div>
    ${rastreio ? `<div class="rastr">${barrasSvg(rastreio, { altura: 54 })}<div class="cod">${esc(rastreio)}</div></div>` : `<div class="rastr vazio">CÓDIGO DE RASTREIO</div>`}
    <div class="linha"><span>Peso: <b>${peso ? esc(String(peso).replace(".", ",")) + " kg" : "________ kg"}</b></span><span>Peças: <b>${pecas != null ? esc(pecas) : "____"}</b></span><span>Recebedor: ____________________</span></div>
    <div class="dest">
      <div class="tit">DESTINATÁRIO</div>
      <div class="nome">${esc(dest.nome)}</div>
      ${dest.aosCuidados ? `<div>A/C ${esc(dest.aosCuidados)}</div>` : ""}
      <div>${esc([dest.rua, dest.numero].filter(Boolean).join(", "))}${dest.complemento ? ` - ${esc(dest.complemento)}` : ""}</div>
      <div>${esc(dest.bairro)}</div>
      <div class="cep"><b>${esc(cepFmt(dest.cep))}</b> ${esc(dest.cidade)}/${esc(dest.uf)}</div>
      ${dest.fone ? `<div class="fone">Tel.: ${esc(foneFmt(dest.fone))}</div>` : ""}
      <div class="bcep">${barrasSvg(so(dest.cep), { altura: 34, modulo: 1.4 })}</div>
    </div>
    <div class="rem">
      <div class="tit">REMETENTE</div>
      <div><b>${esc(rem.nome)}</b>${rem.cnpj ? ` · CNPJ ${esc(rem.cnpj)}` : ""}</div>
      <div>${esc([rem.rua, rem.numero].filter(Boolean).join(", "))}${rem.complemento ? ` - ${esc(rem.complemento)}` : ""} - ${esc(rem.bairro)}</div>
      <div><b>${esc(cepFmt(rem.cep))}</b> ${esc(rem.cidade)}/${esc(rem.uf)}${rem.fone ? ` · ${esc(rem.fone)}` : ""}</div>
    </div>
    ${obs ? `<div class="obs">${esc(obs)}</div>` : ""}
  </div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiqueta pedido ${esc(pedido || "")}</title><style>
  @page{size:100mm 150mm;margin:0}
  *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000;background:#eee}
  .et{width:100mm;height:150mm;padding:4mm;background:#fff;margin:6mm auto;display:flex;flex-direction:column;gap:2mm;page-break-after:always;overflow:hidden}
  @media print{body{background:#fff}.et{margin:0}.barra{display:none}}
  .topo{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid #000;padding-bottom:1.5mm}
  .marca{font-weight:900;font-size:17px;letter-spacing:2px}.sub{font-size:9px;max-width:48mm}
  .ped{text-align:right;font-size:10px;line-height:1.35}
  .rastr{text-align:center}.rastr .cod{font:bold 13px monospace;letter-spacing:2px;margin-top:1mm}
  .rastr.vazio{border:1px dashed #000;height:16mm;display:flex;align-items:center;justify-content:center;font-size:9px;color:#555}
  .linha{display:flex;justify-content:space-between;font-size:9px}
  .dest{border:2px solid #000;padding:2.5mm;font-size:12px;line-height:1.3;flex:1}
  .tit{font-weight:900;font-size:10px;background:#000;color:#fff;display:inline-block;padding:0.5mm 2mm;margin-bottom:1.5mm}
  .dest .nome{font-weight:bold;font-size:14px}.dest .cep{font-size:14px;margin-top:1mm}.fone{font-size:10px}.bcep{margin-top:2mm;width:55mm}
  .rem{border-top:1.5px solid #000;padding-top:1.5mm;font-size:9.5px;line-height:1.3}
  .obs{font-size:9px;border-top:1px dashed #000;padding-top:1mm}
  .barra{text-align:center;padding:8px;font:13px Arial}.barra button{font:bold 13px Arial;padding:6px 18px;cursor:pointer}
  </style></head><body><div class="barra"><button onclick="window.print()">Imprimir etiqueta (10 × 15 cm)</button></div>${Array.from({ length: n }, (_, i) => uma(i + 1)).join("")}</body></html>`;
}

export function abrirEtiqueta(dados) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(htmlEtiqueta(dados)); w.document.close();
  return true;
}
