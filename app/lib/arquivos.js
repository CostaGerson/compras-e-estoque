// v865 — arquivos grandes (RAR, ZIP, PSD, CDR… acima de 8 MB): ficam em disco (/app/arquivos, volume ./arquivos) e não no banco.
//   O anexo guarda só a marca "arq:<token>" no lugar do base64 (pode vir dentro de um data URL: "data:...;base64,arq:<token>").
//   Envio em partes (PUT de até 8 MB cada) para passar pelo limite do nginx; download em stream.
import { createReadStream, promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

export const DIR = process.env.ARQUIVOS_DIR || "/app/arquivos";
export const PARTE = 8 * 1024 * 1024;
export const LIMITE = 2 * 1024 * 1024 * 1024;   // 2 GB por arquivo
const okTok = (t) => /^[A-Za-z0-9_-]{24,64}$/.test(String(t || ""));
const cam = (t) => path.join(DIR, `${t}.bin`), meta = (t) => path.join(DIR, `${t}.json`);

// "arq:TOKEN" (puro ou dentro de data URL) → TOKEN
export const tokenDe = (s) => { const m = String(s || "").match(/(?:^|,)arq:([A-Za-z0-9_-]{24,64})$/); return m ? m[1] : null; };

export async function iniciar({ nome, mime, tamanho, quem }) {
  const n = Number(tamanho) || 0;
  if (n <= 0) throw new Error("Arquivo vazio.");
  if (n > LIMITE) throw new Error("Arquivo maior que 2 GB.");
  await fs.mkdir(DIR, { recursive: true });
  const t = crypto.randomBytes(24).toString("base64url");
  await fs.writeFile(cam(t), Buffer.alloc(0));
  await fs.writeFile(meta(t), JSON.stringify({ nome: String(nome || "arquivo").slice(0, 250), mime: mime || null, tamanho: n, quem: quem || null, em: new Date().toISOString(), completo: false }));
  return t;
}
export async function lerMeta(t) {
  if (!okTok(t)) return null;
  try { return JSON.parse(await fs.readFile(meta(t), "utf8")); } catch { return null; }
}
// acrescenta uma parte no fim; "off" tem que ser o tamanho atual (evita parte repetida/fora de ordem)
export async function parte(t, off, buf) {
  const m = await lerMeta(t);
  if (!m) throw new Error("Envio não encontrado.");
  const atual = (await fs.stat(cam(t))).size;
  if (Number(off) !== atual) return { recebido: atual, completo: m.completo };   // cliente reenvia a partir daqui
  if (atual + buf.length > m.tamanho) throw new Error("Parte maior que o arquivo.");
  await fs.appendFile(cam(t), buf);
  const recebido = atual + buf.length;
  if (recebido === m.tamanho) { m.completo = true; await fs.writeFile(meta(t), JSON.stringify(m)); }
  return { recebido, completo: recebido === m.tamanho };
}
export async function resposta(t, { nome, mime, baixar = false } = {}) {
  const m = await lerMeta(t);
  if (!m || !m.completo) return new Response("Arquivo não encontrado.", { status: 404 });
  const st = await fs.stat(cam(t)).catch(() => null);
  if (!st) return new Response("Arquivo não encontrado.", { status: 404 });
  const n = nome || m.nome || "arquivo";
  return new Response(Readable.toWeb(createReadStream(cam(t))), { headers: {
    "Content-Type": mime || m.mime || "application/octet-stream", "Content-Length": String(st.size), "Cache-Control": "no-store",
    "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(n)}`,
  } });
}
// responde o anexo: arquivo em disco (marca arq:) ou base64 (data URL ou puro)
export async function respostaAnexo(b64, { nome, mime } = {}) {
  const t = tokenDe(b64);
  if (t) return resposta(t, { nome, mime });
  const s = String(b64 || "");
  const mm = s.match(/^data:([^;,]+)[^,]*,/);
  return new Response(Buffer.from(s.replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": mime || mm?.[1] || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome || "arquivo")}` } });
}
