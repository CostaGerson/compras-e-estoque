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
export async function paraDisco(b64, { nome, mime, quem, limite = GRANDE } = {}) {
  if (!b64 || tokenDe(b64) || driveDe(b64)) return b64;
  const raw = String(b64).replace(/^data:[^,]+,/, "");
  if (raw.length * 0.75 <= limite) return b64;
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

// v1038 — arquivos das tarefas (layouts, artes) saem do banco: base64 acima de 512 KB vira "arq:<token>" em disco.
//   Ler um TarefaArquivo de 50 MB pelo Prisma fazia o processo passar de 6 GB e o Linux matar o ERP (502 a cada ~7 min).
//   A cópia é feita em pedaços por SQL (substring), sem trazer a linha inteira para o Node.
export const LIM_TAREFA = 512 * 1024;
const PEDACO = 4 * 1024 * 1024;   // caracteres de base64 por leitura (múltiplo de 4)
const SQL_GRANDE = `octet_length("conteudo") > ${LIM_TAREFA} AND "conteudo" NOT LIKE 'arq:%' AND "conteudo" NOT LIKE 'gdrive:%' AND "conteudo" NOT LIKE 'data:%,arq:%' AND "conteudo" NOT LIKE 'data:%,gdrive:%'`;

export async function tarefaArquivoParaDisco(id, db) {
  const prisma = db || (await import("@/lib/prisma")).prisma;
  const r0 = await prisma.$queryRawUnsafe(`SELECT "id", "nome", "mime", "criadoPorNome", left("conteudo", 300) AS ini, length("conteudo") AS len, octet_length("conteudo") AS oct FROM "TarefaArquivo" WHERE "id" = $1 AND ${SQL_GRANDE}`, Number(id) || 0);
  const a = r0[0];
  if (!a) return null;
  const len = Number(a.len) || 0;
  const vir = String(a.ini || "").startsWith("data:") ? String(a.ini).indexOf(",") : -1;
  const mm = String(a.ini || "").match(/^data:([^;,]+)/);
  await fs.mkdir(DIR, { recursive: true });
  const t = crypto.randomBytes(24).toString("base64url");
  let pos = vir + 2, resto = "", total = 0;   // substring do SQL começa em 1
  try {
    await fs.writeFile(cam(t), Buffer.alloc(0));
    while (pos <= len) {
      const p = await prisma.$queryRawUnsafe(`SELECT substring("conteudo" from $2::int for $3::int) AS p FROM "TarefaArquivo" WHERE "id" = $1`, a.id, pos, PEDACO);
      let s = resto + String(p[0]?.p || "").replace(/\s+/g, "");
      pos += PEDACO;
      const corte = pos <= len ? s.length - (s.length % 4) : s.length;
      resto = s.slice(corte); s = s.slice(0, corte);
      if (s) { const buf = Buffer.from(s, "base64"); total += buf.length; await fs.appendFile(cam(t), buf); }
    }
    if (!total) throw new Error("conteúdo vazio");
    await fs.writeFile(meta(t), JSON.stringify({ nome: String(a.nome || "arquivo").slice(0, 250), mime: a.mime || mm?.[1] || null, tamanho: total, quem: a.criadoPorNome || null, em: new Date().toISOString(), completo: true, origem: `TarefaArquivo|${a.id}` }));
    // só troca se o conteúdo não mudou enquanto copiava
    const n = await prisma.$executeRawUnsafe(`UPDATE "TarefaArquivo" SET "conteudo" = $2, "tamanho" = $3::int WHERE "id" = $1::int AND octet_length("conteudo") = $4::int`, a.id, `arq:${t}`, total, Number(a.oct));
    if (!n) throw new Error("conteúdo mudou durante a cópia");
    return `arq:${t}`;
  } catch (e) {
    await fs.unlink(cam(t)).catch(() => null); await fs.unlink(meta(t)).catch(() => null);
    console.log(`[v1038] TarefaArquivo ${a.id}:`, e.message);
    return null;
  }
}
// antes de ler arquivos de tarefa pelo Prisma: garante que os grandes já estão em disco
export async function garantirDiscoTarefa({ ids, tarefaId } = {}, db) {
  const prisma = db || (await import("@/lib/prisma")).prisma;
  const lista = (ids || []).map(Number).filter(Boolean);
  if (!lista.length && !tarefaId) return 0;
  const r = lista.length
    ? await prisma.$queryRawUnsafe(`SELECT "id" FROM "TarefaArquivo" WHERE "id" = ANY($1::int[]) AND ${SQL_GRANDE}`, lista)
    : await prisma.$queryRawUnsafe(`SELECT "id" FROM "TarefaArquivo" WHERE "tarefaId" = $1 AND ${SQL_GRANDE}`, Number(tarefaId) || 0);
  let n = 0;
  for (const x of r) if (await tarefaArquivoParaDisco(x.id, prisma)) n++;
  return n;
}
// migração de tudo (roda ao subir, um arquivo por vez)
let migrando = false;
export async function migrarTarefaArquivos(db) {
  if (migrando) return 0;
  migrando = true;
  const prisma = db || (await import("@/lib/prisma")).prisma;
  let n = 0, falhas = new Set();
  try {
    for (;;) {
      const r = await prisma.$queryRawUnsafe(`SELECT "id" FROM "TarefaArquivo" WHERE ${SQL_GRANDE} ${falhas.size ? `AND "id" <> ALL($1::int[])` : ""} ORDER BY "id" LIMIT 1`, ...(falhas.size ? [[...falhas]] : []));
      if (!r.length) break;
      if (await tarefaArquivoParaDisco(r[0].id, prisma)) n++; else falhas.add(r[0].id);
    }
  } finally { migrando = false; }
  if (n || falhas.size) console.log(`[v1038] arquivos de tarefa levados para o disco: ${n}${falhas.size ? ` · falharam: ${[...falhas].join(", ")}` : ""}`);
  return n;
}
export const emMigracao = () => migrando;
