// v1171 — etiqueta ocupa a área toda e sai escura (sem cinza, fonte/linhas mais grossas, barras sem antialias)
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(x + 10 * modulo).toFixed(2)} ${altura}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000" style="display:block;width:100%;height:100%">${rs.join("")}</svg>`;
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
    <div class="tab"><table>
      ${linha("ARTIGO", e.artigo, "art")}
      ${linha("COR", e.cor)}
      ${linha("CÓDIGO", e.codigoArtigo)}
      ${linha(p ? "FORN." : "FORNECEDOR", e.fornecedor)}
      ${linha(p ? "LARG." : "LARGURA", larg)}
      ${linha(p ? "CONSTR." : "CONSTRUÇÃO", e.construcao)}
      ${linha(p ? "TAM." : "TAMANHO", e.tamanho)}
      ${linha("ZÍPER", e.tipoZiper)}
      ${linha(p ? "QTD" : "QUANTIDADE", qt, "qtd")}
      ${linha("ORIGEM", e.origem)}
      ${p ? "" : linha("ENTRADA", dBR(e.entrada))}
      ${linha("OBS", e.obs, "obs")}
    </table></div>
    <div class="bar">${barrasSvg(e.codigo)}</div><div class="cod">${esc(e.codigo)}</div>
  </div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas · ${etiquetas.length} volume(s)</title><style>
    @page { size: ${W}mm ${H}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${W}mm; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-font-smoothing: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .et { width: ${W}mm; height: ${H}mm; padding: ${p ? "1.2mm" : "2mm 2.5mm"}; display: flex; flex-direction: column; page-break-after: always; break-after: page; overflow: hidden; }
    .et:last-child { page-break-after: auto; break-after: auto; }
    .topo { display: flex; align-items: center; gap: 1.5mm; margin-bottom: ${p ? 0.8 : 1.2}mm; }
    .tipo { flex: 1; font-weight: 900; font-size: ${p ? 8.5 : 14}pt; background: #000; color: #fff; padding: ${p ? ".5mm 1mm" : "1mm 2mm"}; border-radius: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vol { font-weight: 900; font-size: ${p ? 8 : 13}pt; border: ${p ? 1.2 : 2}px solid #000; border-radius: 1mm; padding: .3mm 1.5mm; white-space: nowrap; }
    .tab { flex: 1 1 auto; min-height: 0; display: flex; overflow: hidden; }
    table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: ${p ? "1px" : "1.6px"} solid #000; padding: ${p ? "0 .8mm" : "0 1.5mm"}; text-align: left; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #000; }
    th { width: ${p ? "13mm" : "28mm"}; font-size: ${p ? 6.5 : 8.5}pt; font-weight: 900; background: #fff; }
    td { font-size: ${p ? 7.5 : 11}pt; font-weight: 700; }
    tr.art td { font-size: ${p ? 8.5 : 13}pt; font-weight: 900; white-space: normal; line-height: 1.05; }
    tr.obs td { font-size: ${p ? 6.5 : 9}pt; white-space: normal; line-height: 1.05; }
    tr.qtd td { font-size: ${p ? 10 : 17}pt; font-weight: 900; }
    .bar { flex: 0 0 ${p ? 9 : 13}mm; margin-top: ${p ? 0.8 : 1.5}mm; }
    .cod { text-align: center; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: ${p ? 7 : 10}pt; letter-spacing: 1px; }
  </style></head><body>${pags}${autoPrint ? "<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>" : ""}</body></html>`;
}
// ───────── v1174 — impressão direta em ZPL pelo Zebra Browser Print ─────────
// O ZPL define tamanho (^PW/^LL), escuridão (~SD) e velocidade (^PR) na própria etiqueta: não depende do driver nem da escala do navegador.
// Sem o Browser Print instalado no PC, cai na impressão pelo navegador (HTML).
const zz = (s) => String(s == null ? "" : s).replace(/[\^~\\]/g, " ").replace(/\s+/g, " ").trim();
const CFG_K = "ce_zebra_cfg";
export function zebraCfg() {
  let c = {}; try { c = JSON.parse(localStorage.getItem(CFG_K) || "{}"); } catch {}
  return { dpi: [203, 300].includes(Number(c.dpi)) ? Number(c.dpi) : 203, escuridao: Number.isFinite(Number(c.escuridao)) ? Math.min(30, Math.max(0, Number(c.escuridao))) : 25,
    velocidade: Number.isFinite(Number(c.velocidade)) ? Math.min(6, Math.max(2, Number(c.velocidade))) : 3, direta: c.direta !== false };
}
export function salvarZebraCfg(p) { const c = { ...zebraCfg(), ...p }; try { localStorage.setItem(CFG_K, JSON.stringify(c)); } catch {} return c; }

export function zplEtiquetas(etiquetas, { tamanho = TAMANHO_PADRAO, dpi, escuridao, velocidade } = {}) {
  const cfg = zebraCfg();
  dpi = dpi || cfg.dpi; escuridao = escuridao ?? cfg.escuridao; velocidade = velocidade || cfg.velocidade;
  const [W, H] = TAMANHOS[tamanho] || TAMANHOS[TAMANHO_PADRAO];
  const dm = dpi / 25.4;                       // pontos por mm
  const d = (mm) => Math.round(mm * dm);
  const p = W <= 50;
  const M = p ? 1.2 : 2;                       // margem (mm)
  const L = { th: p ? 13 : 28, topo: p ? 4.4 : 6.5, gap: p ? 0.8 : 1.2, barra: p ? 6.5 : 10, codTxt: p ? 2.2 : 3,
    fTh: p ? 2.2 : 3, fTd: p ? 2.8 : 4, fArt: p ? 3 : 4.6, fQtd: p ? 4 : 6.5, fObs: p ? 2.3 : 3.2, fTopo: p ? 3.2 : 5, pad: p ? 0.8 : 1.5, linha: p ? 0.3 : 0.4 };
  const t = Math.max(2, d(L.linha));          // espessura das linhas (pontos)
  // texto que não cabe é cortado (no ZPL o excesso sobrepõe a última linha)
  const corta = (v, w, alt, linhas) => { const t = zz(v), n = Math.max(1, Math.floor(w / (alt * 0.6))) * linhas; return t.length > n ? t.slice(0, n - 1) + "…" : t; };
  const txt = (x, y, w, alt, v, linhas = 1, just = "L", rev = false) =>
    `^FO${d(x)},${d(y)}^A0N,${d(alt)},${d(alt * 0.92)}^FB${d(w)},${linhas},0,${just}${rev ? "^FR" : ""}^FD${corta(v, w, alt, linhas)}^FS`;
  return etiquetas.map((e) => {
    const larg = e.largura ? `${nBR(e.largura, 3)} M` : "";
    const qt = qtdTxt(e) + (e.pesoKg ? ` · ${nBR(e.pesoKg)} KG` : "");
    const rows = [
      ["ARTIGO", e.artigo, "art"], ["COR", e.cor], ["CÓDIGO", e.codigoArtigo], [p ? "FORN." : "FORNECEDOR", e.fornecedor],
      [p ? "LARG." : "LARGURA", larg], [p ? "CONSTR." : "CONSTRUÇÃO", e.construcao], [p ? "TAM." : "TAMANHO", e.tamanho], ["ZÍPER", e.tipoZiper],
      [p ? "QTD" : "QUANTIDADE", qt, "qtd"], ["ORIGEM", e.origem], ...(p ? [] : [["ENTRADA", dBR(e.entrada)]]), ["OBS", e.obs, "obs"],
    ].filter((r) => r[1] != null && r[1] !== "");
    const out = ["^XA", "^CI28", `~SD${String(Math.round(escuridao)).padStart(2, "0")}`, `^PR${velocidade},${velocidade},${velocidade}`, `^PW${d(W)}`, `^LL${d(H)}`, "^LH0,0", "^MMT", "^PON"];
    // faixa preta com o tipo (texto vazado) e VOL x/y
    const wVol = e.total ? (p ? 14 : 22) : 0;
    const wTipo = W - 2 * M - (wVol ? wVol + 1.5 : 0);
    out.push(`^FO${d(M)},${d(M)}^GB${d(wTipo)},${d(L.topo)},${d(L.topo)},B,1^FS`);
    out.push(txt(M + L.pad, M + (L.topo - L.fTopo) / 2 + 0.2, wTipo - 2 * L.pad, L.fTopo, e.tipo || "—", 1, "L", true));
    if (wVol) {
      const xv = W - M - wVol;
      out.push(`^FO${d(xv)},${d(M)}^GB${d(wVol)},${d(L.topo)},${t * 2},B,1^FS`);
      out.push(txt(xv, M + (L.topo - L.fTopo * 0.85) / 2 + 0.2, wVol, L.fTopo * 0.85, `VOL ${e.ordem}/${e.total}`, 1, "C"));
    }
    // tabela: ocupa a altura entre a faixa e o código de barras (linhas com peso)
    const y0 = M + L.topo + L.gap;
    const yBar = H - M - L.codTxt - L.barra - 0.4;
    const y1 = yBar - L.gap;
    const peso = (k) => (k === "art" || k === "qtd" ? 1.5 : k === "obs" ? 1.3 : 1);
    const soma = rows.reduce((s, r) => s + peso(r[2]), 0);
    const wTab = W - 2 * M, wTd = wTab - L.th;
    let y = y0;
    for (const [k, v, cls] of rows) {
      const rh = ((y1 - y0) * peso(cls)) / soma;
      out.push(`^FO${d(M)},${d(y)}^GB${d(wTab)},${d(rh) + t},${t},B,0^FS`);
      out.push(`^FO${d(M + L.th)},${d(y)}^GB${t},${d(rh) + t},${t},B,0^FS`);
      out.push(txt(M + L.pad, y + (rh - L.fTh) / 2 + 0.15, L.th - 2 * L.pad, L.fTh, k));
      const f = cls === "art" ? L.fArt : cls === "qtd" ? L.fQtd : cls === "obs" ? L.fObs : L.fTd;
      const cabe = Math.floor((wTd - 2 * L.pad) / (f * 0.6));
      const duas = (cls === "art" || cls === "obs") && zz(v).length > cabe;
      const fh = duas ? Math.min(f, (rh - 0.6) / 2.1) : Math.min(f, rh - 0.6);
      out.push(txt(M + L.th + L.pad, y + (rh - fh * (duas ? 2.1 : 1)) / 2 + 0.15, wTd - 2 * L.pad, fh, v, duas ? 2 : 1));
      y += rh;
    }
    // código de barras Code 128 centralizado, com o código embaixo
    const cod = zz(e.codigo);
    const mods = 11 * (cod.length + 2) + 13 + 20;   // start + dados + checksum + stop + zonas de silêncio
    const mod = Math.max(1, Math.min(Math.floor(d(W - 2 * M) / mods), Math.round(dm * 0.5)));
    const xBar = Math.max(0, Math.round((d(W) - mod * (mods - 20)) / 2));
    out.push(`^BY${mod},3,${d(L.barra)}^FO${xBar},${d(yBar)}^BCN,${d(L.barra)},N,N,N^FD${cod}^FS`);
    out.push(txt(M, yBar + L.barra + 0.4, W - 2 * M, L.codTxt * 0.85, cod, 1, "C"));
    out.push("^PQ1", "^XZ");
    return out.join("\n");
  }).join("\n");
}

// Zebra Browser Print (serviço local do PC: https://127.0.0.1:9101 ou http://127.0.0.1:9100)
const BASES = () => (typeof location !== "undefined" && location.protocol === "https:" ? ["https://127.0.0.1:9101/", "http://127.0.0.1:9100/"] : ["http://127.0.0.1:9100/", "https://127.0.0.1:9101/"]);
let zebraCache = null;   // { base, device } | false
async function comTempo(pr, ms) { return Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("tempo")), ms))]); }
export async function acharZebra({ forcar = false } = {}) {
  if (zebraCache && !forcar) return zebraCache;
  for (const base of BASES()) {
    try {
      const r = await comTempo(fetch(base + "default?type=printer"), 1500);
      const txt = await r.text();
      let dev = txt ? JSON.parse(txt) : null;
      if (!dev || !dev.uid) {   // sem padrão: primeira impressora disponível
        const a = await comTempo(fetch(base + "available"), 1500).then((x) => x.json()).catch(() => null);
        dev = (a?.printer || [])[0] || null;
      }
      if (dev && dev.uid) { zebraCache = { base, device: dev }; return zebraCache; }
    } catch {}
  }
  zebraCache = false; return false;
}
async function enviarZpl(zpl) {
  const z = await acharZebra();
  if (!z) throw new Error("Zebra Browser Print não encontrado neste PC.");
  const r = await fetch(z.base + "write", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ device: z.device, data: zpl }) });
  if (!r.ok) { zebraCache = null; throw new Error(`A Zebra recusou (${r.status}). ${await r.text().catch(() => "")}`.trim()); }
  return z.device.name;
}

function imprimirHtml(etiquetas, tamanho) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para imprimir as etiquetas."); return; }
  w.document.write(htmlEtiquetas(etiquetas, { tamanho })); w.document.close();
}
// direto na Zebra (ZPL) quando o Browser Print responde; senão, pelo navegador
export async function imprimirEtiquetas(etiquetas, { tamanho = TAMANHO_PADRAO, navegador = false } = {}) {
  if (!etiquetas?.length) return;
  if (!navegador && zebraCfg().direta) {
    const z = await acharZebra().catch(() => false);
    if (z) {
      try { const nome = await enviarZpl(zplEtiquetas(etiquetas, { tamanho })); return { ok: true, direta: true, impressora: nome }; }
      catch (e) { alert(`${e.message}\n\nVou abrir a impressão pelo navegador.`); }
    }
  }
  imprimirHtml(etiquetas, tamanho);
  return { ok: true, direta: false };
}
