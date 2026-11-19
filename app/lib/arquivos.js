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
// v1003 — arquivo guardado no Google Drive (Artes e layouts): "gdrive:<id>" (puro ou dentro de data URL)
export const driveDe = (s) => { const m = String(s || "").match(/(?:^|,)gdrive:([A-Za-z0-9_-]{10,120})$/); return m ? m[1] : null; };
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
// v868 — base64 grande (acima de 8 MB) vai para o disco e vira "arq:<token>"; o resto fica como está
export const GRANDE = 8 * 1024 * 1024;
export async function paraDisco(b64, { nome, mime, quem } = {}) {
  if (!b64 || tokenDe(b64) || driveDe(b64)) return b64;
  const raw = String(b64).replace(/^data:[^,]+,/, "");
  if (raw.length * 0.75 <= GRANDE) return b64;
  const buf = Buffer.from(raw, "base64");
  const mm = String(b64).match(/^data:([^;,]+)/);
  const t = await iniciar({ nome, mime: mime || mm?.[1] || null, tamanho: buf.length, quem });
  await parte(t, 0, buf);
  return `arq:${t}`;
}
// anexos dos itens de um pedido (anexosJson): tira do banco os arquivos grandes — o pedido volta a salvar leve
export async function enxugarItensPp(ppId, db) {
  const prisma = db || (await import("@/lib/prisma")).prisma;
  const its = await prisma.ppItem.findMany({ where: { ppId: Number(ppId) }, select: { id: true, anexosJson: true } });
  let n = 0;
  for (const it of its) {
    const l = Array.isArray(it.anexosJson) ? it.anexosJson : [];
    if (!l.some((a) => a && a.base64 && !tokenDe(a.base64) && String(a.base64).length * 0.75 > GRANDE)) continue;
    const novo = [];
    for (const a of l) novo.push(a && a.base64 ? { ...a, base64: await paraDisco(a.base64, { nome: a.nome, mime: a.mime }) } : a);
    await prisma.ppItem.update({ where: { id: it.id }, data: { anexosJson: novo } });
    n++;
  }
  return n;
}
// responde o anexo: arquivo em disco (marca arq:) ou base64 (data URL ou puro)
export async function respostaAnexo(b64, { nome, mime } = {}) {
  const t = tokenDe(b64);
  if (t) return resposta(t, { nome, mime });
  const g = driveDe(b64);
  if (g) {   // v1003 — vem do Google Drive
    const r = await (await import("@/lib/artesDrive")).lerDoDrive(g).catch((e) => ({ error: e.message }));
    if (!r?.base64) return new Response(`Não foi possível ler o arquivo no Google Drive${r?.error ? `: ${r.error}` : ""}.`, { status: 502 });
    return new Response(Buffer.from(r.base64, "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": mime || r.mime || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome || r.nome || "arquivo")}` } });
  }
  const s = String(b64 || "");
  const mm = s.match(/^data:([^;,]+)[^,]*,/);
  return new Response(Buffer.from(s.replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": mime || mm?.[1] || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome || "arquivo")}` } });
}

// v903 — base64 de um anexo, venha ele do banco ou do disco ("arq:<token>")
export async function lerBase64(s) {
  if (!s) return null;
  const g = driveDe(s);
  if (g) { try { return (await (await import("@/lib/artesDrive")).lerDoDrive(g))?.base64 || null; } catch { return null; } }   // v1003
  const t = tokenDe(s);
  if (!t) return String(s).replace(/^data:[^,]+,/, "");
  try { return (await fs.readFile(cam(t))).toString("base64"); } catch { return null; }
}
