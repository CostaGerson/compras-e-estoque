// v696 — imagens embutidas num PDF (servidor): na ordem em que são desenhadas, como data URL (JPEG direto, demais viram PNG).
// Usado na leitura da solicitação de lançamento da skill: a arte de cada peça vem dentro do PDF.
import zlib from "zlib";
import { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFDict, PDFRef } from "pdf-lib";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// pixels crus (8 bits) → PNG. canais: 1 (cinza), 2 (cinza+alfa), 3 (RGB), 4 (RGBA)
function png(w, h, canais, px) {
  const cor = { 1: 0, 2: 4, 3: 2, 4: 6 }[canais];
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = cor;
  const linha = w * canais, raw = Buffer.alloc((linha + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (linha + 1)] = 0; px.copy(raw, y * (linha + 1) + 1, y * linha, y * linha + linha); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function ascii85(buf) {
  const s = buf.toString("latin1").replace(/\s/g, "").replace(/^<~/, "").replace(/~>.*$/, "");
  const out = []; let grupo = [];
  const solta = (g, n) => { let v = 0; for (const c of g) v = v * 85 + c; for (let i = 3; i >= 4 - n; i--) out.push((v >>> (8 * i)) & 0xff); };
  for (const ch of s) {
    if (ch === "z" && !grupo.length) { out.push(0, 0, 0, 0); continue; }
    grupo.push(ch.charCodeAt(0) - 33);
    if (grupo.length === 5) { solta(grupo, 4); grupo = []; }
  }
  if (grupo.length) { const n = grupo.length - 1; while (grupo.length < 5) grupo.push(84); solta(grupo, n); }
  return Buffer.from(out);
}
const asciiHex = (buf) => Buffer.from(buf.toString("latin1").replace(/[^0-9a-f]/gi, "").replace(/(.)?$/, (m) => (m.length === 1 ? m + "0" : m)), "hex");
const nomes = (v) => (!v ? [] : v instanceof PDFArray ? v.asArray().map((x) => String(x).replace(/^\//, "")) : [String(v).replace(/^\//, "")]);

// aplica os filtros até o DCT (JPEG fica como está): { dados, jpeg }
function decodificar(stream) {
  let dados = Buffer.from(stream.contents);
  for (const f of nomes(stream.dict.get(PDFName.of("Filter")))) {
    if (f === "DCTDecode" || f === "DCT") return { dados, jpeg: true };
    if (f === "FlateDecode" || f === "Fl") dados = zlib.inflateSync(dados);
    else if (f === "ASCII85Decode" || f === "A85") dados = ascii85(dados);
    else if (f === "ASCIIHexDecode" || f === "AHx") dados = asciiHex(dados);
    else return null;   // LZW, JBIG2, CCITT, JPX: não converte
  }
  return { dados, jpeg: false };
}
const numDe = (d, k) => { const v = d.get(PDFName.of(k)); return v ? Number(String(v)) : null; };

function imagemDataUrl(doc, stream) {
  const d = stream.dict;
  const w = numDe(d, "Width"), h = numDe(d, "Height"), bpc = numDe(d, "BitsPerComponent") || 8;
  const dec = decodificar(stream);
  if (!dec || !w || !h) return null;
  if (dec.jpeg) return { w, h, url: "data:image/jpeg;base64," + dec.dados.toString("base64"), bytes: dec.dados.length };
  if (bpc !== 8) return null;
  let cs = d.get(PDFName.of("ColorSpace"));
  if (cs instanceof PDFRef) cs = doc.context.lookup(cs);
  const csNome = cs instanceof PDFArray ? String(cs.get(0)) : String(cs || "");
  const canais = /Gray/.test(csNome) ? 1 : /RGB/.test(csNome) ? 3 : /ICCBased/.test(csNome) ? Math.round(dec.dados.length / (w * h)) : 0;
  if (![1, 3].includes(canais) || dec.dados.length < w * h * canais) return null;
  let px = dec.dados.subarray(0, w * h * canais), saida = canais;
  const smRef = d.get(PDFName.of("SMask"));
  const sm = smRef ? doc.context.lookup(smRef) : null;
  if (sm instanceof PDFRawStream && numDe(sm.dict, "Width") === w && numDe(sm.dict, "Height") === h) {
    const a = decodificar(sm);
    if (a && !a.jpeg && a.dados.length >= w * h) {
      const c2 = canais + 1, out = Buffer.alloc(w * h * c2);
      for (let i = 0; i < w * h; i++) { for (let k = 0; k < canais; k++) out[i * c2 + k] = px[i * canais + k]; out[i * c2 + canais] = a.dados[i]; }
      px = out; saida = c2;
    }
  }
  const b = png(w, h, saida, Buffer.from(px));
  return { w, h, url: "data:image/png;base64," + b.toString("base64"), bytes: b.length };
}

// imagens na ordem de desenho, por página: [{ pagina, w, h, url, chave }]
export async function imagensDoPdf(buffer, { max = 20 } = {}) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const out = [];
  doc.getPages().forEach((page, pi) => {
    const res = page.node.Resources();
    const xo = res ? res.lookup(PDFName.of("XObject")) : null;
    if (!(xo instanceof PDFDict)) return;
    // ordem de desenho: "/Nome Do" no conteúdo da página
    let conteudo = "";
    try {
      const c = page.node.Contents();
      const streams = c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c];
      for (const s of streams) if (s instanceof PDFRawStream) { const dd = decodificar(s); if (dd && !dd.jpeg) conteudo += dd.dados.toString("latin1") + "\n"; }
    } catch {}
    const ordem = [...conteudo.matchAll(/\/([^\s/<>()\[\]]+)\s+Do\b/g)].map((m) => m[1]);
    const chaves = xo.keys().map((k) => String(k).replace(/^\//, ""));
    const seq = ordem.length ? ordem.filter((n) => chaves.includes(n)) : chaves;
    for (const nome of seq) {
      if (out.length >= max) return;
      const ref = xo.get(PDFName.of(nome));
      const s = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      if (!(s instanceof PDFRawStream) || String(s.dict.get(PDFName.of("Subtype"))) !== "/Image") continue;
      try { const im = imagemDataUrl(doc, s); if (im) out.push({ pagina: pi + 1, chave: ref instanceof PDFRef ? ref.toString() : `${pi}:${nome}`, ...im }); } catch {}
    }
  });
  return out;
}
