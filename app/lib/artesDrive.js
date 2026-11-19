// v1003 — Dados › Artes e layouts: guarda no Google Drive (pasta da empresa) os layouts, artes de personalização e mockups.
//   A ponte é um Apps Script publicado como app da web na conta Google dona da pasta (os arquivos ficam no espaço dela):
//   POST { segredo, acao: "teste" | "enviar" | "ler" | "excluir", ... }. Configuração em FinConfig "ARTES|DRIVE" = { url, segredo, pasta }.
//   Arquivo de tarefa enviado ao Drive: TarefaArquivo.conteudo vira "gdrive:<id>" (o banco fica leve; ler/baixar busca no Drive).
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const K = "ARTES|DRIVE";
export const PASTA_PADRAO = "1O40LqJ17lCAcEOadkaBNlBvh13QZKtWi";
export const LIMITE_DRIVE = 35 * 1024 * 1024;   // acima disso o Apps Script não aguenta: o arquivo fica no servidor (status LOCAL)
const md5 = (s) => crypto.createHash("md5").update(String(s || "")).digest("hex");
const semData = (s) => String(s || "").replace(/^data:[^,]+,/, "");

export async function configDrive() {
  const c = await prisma.finConfig.findUnique({ where: { chave: K } }).catch(() => null);
  let v = {}; try { v = JSON.parse(c?.valor || "{}"); } catch {}
  if (!v.segredo) {   // o segredo nasce aqui e vai dentro do script
    v.segredo = crypto.randomBytes(18).toString("base64url");
    await prisma.finConfig.upsert({ where: { chave: K }, create: { chave: K, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } }).catch(() => null);
  }
  return { url: v.url || "", segredo: v.segredo, pasta: v.pasta || PASTA_PADRAO, testadoEm: v.testadoEm || null, pastaNome: v.pastaNome || null };
}
export async function salvarConfig(b) {
  const atual = await configDrive();
  const url = String(b.url ?? atual.url).trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) return { error: "Cole o endereço do app da web do Apps Script (termina em /exec)." };
  const v = { ...atual, url, pasta: String(b.pasta || atual.pasta).trim() };
  await prisma.finConfig.upsert({ where: { chave: K }, create: { chave: K, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return { ok: true };
}

async function chamar(corpo, cfg0) {
  const cfg = cfg0 || (await configDrive());
  if (!cfg.url) throw new Error("Google Drive não configurado (Dados › Artes e layouts › Configurar).");
  const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ segredo: cfg.segredo, pasta: cfg.pasta, ...corpo }), redirect: "follow" });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error(r.ok ? "O Apps Script não respondeu JSON (confira se está publicado para 'Qualquer pessoa')." : `Apps Script respondeu ${r.status}.`); }
  if (j.error) throw new Error(j.error);
  return j;
}
export async function testar() {
  const cfg = await configDrive();
  const j = await chamar({ acao: "teste" }, cfg);
  await prisma.finConfig.update({ where: { chave: K }, data: { valor: JSON.stringify({ ...cfg, testadoEm: new Date().toISOString(), pastaNome: j.pasta || null }) } }).catch(() => null);
  return { ok: true, pasta: j.pasta };
}
// leitura para baixar/visualizar: cache curto em memória (abrir a prévia e baixar logo depois não busca duas vezes)
const cache = new Map();
export async function lerDoDrive(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.em < 5 * 60e3) return c.r;
  const j = await chamar({ acao: "ler", id });
  const r = { base64: j.base64, mime: j.mime || null, nome: j.nome || null };
  if ((j.base64 || "").length < 30e6) { cache.set(id, { r, em: Date.now() }); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return r;
}

// ---------- registro: o que é arte/layout ----------
const tipoPeloNome = (n, titulo = "") => { const s = `${n} ${titulo}`.toUpperCase(); return /MOCK/.test(s) ? "MOCKUP" : /LAYOUT/.test(s) ? "LAYOUT" : "ARTE"; };
export async function registrar() {
  let n = 0;
  // 1) arquivos das tarefas de layout (criação/aprovação), das demandas com aprovação e das demandas do arte finalista
  let arteId = null; try { arteId = (await (await import("@/lib/layoutFluxo")).arteFinalista())?.id || null; } catch {}
  const ts = await prisma.$queryRawUnsafe(`SELECT a."id", a."tarefaId", a."nome", a."mime", a."tamanho", a."criadoPorNome", a."createdAt", t."titulo",
      t."layout"->>'numero' AS numero, t."layout"->>'cliente' AS cliente, t."natureza"
    FROM "TarefaArquivo" a JOIN "Tarefa" t ON t."id" = a."tarefaId"
    WHERE (t."titulo" LIKE 'CRIAÇÃO DE LAYOUT%' OR t."titulo" LIKE 'APROVAÇÃO DE LAYOUT%' OR t."layout" IS NOT NULL OR t."aprovacao" IS NOT NULL
      OR ($1::int IS NOT NULL AND t."responsavelId" = $1::int AND t."natureza" <> 'PESSOAL'))
      AND NOT EXISTS (SELECT 1 FROM "ArteArquivo" r WHERE r."chave" = 'TAREFA|' || a."id")
    ORDER BY a."id" LIMIT 500`, arteId).catch((e) => { console.log("artes/registrar tarefas:", e.message); return []; });
  for (const a of ts) {
    const num = a.numero || (String(a.titulo || "").match(/\b(\d{8})\b/) || [])[1] || null;
    await prisma.arteArquivo.create({ data: { chave: `TAREFA|${a.id}`, origem: "TAREFA", tipo: tipoPeloNome(a.nome, a.titulo), nome: a.nome, mime: a.mime, tamanho: Number(a.tamanho) || 0,
      pedidoNumero: num, cliente: a.cliente || null, item: a.titulo || null, tarefaId: a.tarefaId, arquivoId: a.id, criadoPorNome: a.criadoPorNome, createdAt: a.createdAt } }).catch(() => null);
    n++;
  }
  // 2) layout (imagem) de cada item dos pedidos lançados no sistema — uma cópia por versão do layout
  const its = await prisma.$queryRawUnsafe(`SELECT i."id", i."descricao", i."codigo", p."numero", p."clienteNome", md5(i."fotoBase64") AS h, length(i."fotoBase64") AS len
    FROM "PpItem" i JOIN "Pp" p ON p."id" = i."ppId"
    WHERE COALESCE(i."fotoBase64", '') <> '' AND NOT EXISTS (SELECT 1 FROM "ArteArquivo" r WHERE r."chave" = 'PP_ITEM|' || i."id" || '|' || md5(i."fotoBase64"))
    ORDER BY i."id" LIMIT 500`).catch((e) => { console.log("artes/registrar itens:", e.message); return []; });
  for (const i of its) {
    const nome = `${i.numero || "PEDIDO"} · ${[i.codigo, i.descricao].filter(Boolean).join(" ") || `item ${i.id}`}`.replace(/[\\/:*?"<>|]/g, "-").slice(0, 180);
    await prisma.arteArquivo.create({ data: { chave: `PP_ITEM|${i.id}|${i.h}`, origem: "PP_ITEM", tipo: "LAYOUT", nome, mime: null, tamanho: Math.floor((Number(i.len) || 0) * 0.75),
      pedidoNumero: i.numero || null, cliente: i.clienteNome || null, item: [i.codigo, i.descricao].filter(Boolean).join(" · ") || null, ppItemId: i.id, hash: i.h } }).catch(() => null);
    n++;
  }
  return n;
}

// conteúdo (base64 puro + mime) de um registro, de onde ele estiver
async function conteudoDe(r) {
  const { lerBase64, driveDe } = await import("@/lib/arquivos");
  if (r.origem === "TAREFA") {
    const a = await prisma.tarefaArquivo.findUnique({ where: { id: r.arquivoId || 0 } });
    if (!a) return { sumiu: true };
    if (driveDe(a.conteudo)) return { jaNoDrive: driveDe(a.conteudo) };
    return { base64: await lerBase64(a.conteudo), mime: a.mime, bruto: a.conteudo };
  }
  if (r.origem === "PP_ITEM") {
    const i = await prisma.ppItem.findUnique({ where: { id: r.ppItemId || 0 }, select: { fotoBase64: true } });
    if (!i?.fotoBase64) return { sumiu: true };
    const mm = String(i.fotoBase64).match(/^data:([^;,]+)/);
    return { base64: await lerBase64(i.fotoBase64), mime: mm?.[1] || "image/png" };
  }
  return { base64: r.conteudo ? await lerBase64(r.conteudo) : null, mime: r.mime, bruto: r.conteudo };
}
const ext = (mime) => ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf" })[mime] || "";
const subpasta = (r) => `${r.pedidoNumero || "SEM PEDIDO"}${r.cliente ? ` - ${String(r.cliente).slice(0, 60)}` : ""}`.replace(/[\\/:*?"<>|]/g, "-").trim();

// envia os pendentes (no máximo `max` por vez); arquivo da tarefa enviado passa a apontar para o Drive
export async function enviarPendentes(max = 8) {
  const cfg = await configDrive();
  if (!cfg.url) return { enviados: 0, semConfig: true };
  const l = await prisma.arteArquivo.findMany({ where: { status: { in: ["PENDENTE", "ERRO"] }, tentativas: { lt: 5 }, excluidoEm: null }, orderBy: { id: "asc" }, take: max });
  let enviados = 0;
  for (const r of l) {
    try {
      const c = await conteudoDe(r);
      if (c.sumiu) { await prisma.arteArquivo.update({ where: { id: r.id }, data: { status: "ERRO", erro: "Arquivo de origem não existe mais.", tentativas: 5 } }); continue; }
      if (c.jaNoDrive) { await prisma.arteArquivo.update({ where: { id: r.id }, data: { status: "ENVIADO", driveId: c.jaNoDrive, enviadoEm: new Date(), erro: null } }); continue; }
      const b64 = semData(c.base64 || "");
      if (!b64) throw new Error("Conteúdo vazio.");
      if (b64.length * 0.75 > LIMITE_DRIVE) { await prisma.arteArquivo.update({ where: { id: r.id }, data: { status: "LOCAL", erro: "Acima de 35 MB: fica guardado no servidor." } }); continue; }
      const h = md5(b64);
      // mesmo arquivo já está no Drive (ex.: cópia na tarefa de aprovação): reaproveita
      const igual = await prisma.arteArquivo.findFirst({ where: { hash: h, status: "ENVIADO", driveId: { not: null } } });
      const j = igual ? { id: igual.driveId, link: igual.driveLink } : await chamar({ acao: "enviar", nome: /\.[a-z0-9]{2,5}$/i.test(r.nome) ? r.nome : `${r.nome}${ext(c.mime)}`, mime: c.mime || "application/octet-stream", base64: b64, subpasta: subpasta(r) }, cfg);
      if (!j?.id) throw new Error("O Drive não devolveu o arquivo.");
      if (!igual && j.tamanho != null && Math.abs(Number(j.tamanho) - Buffer.byteLength(b64, "base64")) > 2) throw new Error(`Tamanho no Drive (${j.tamanho}) diferente do original — não troquei o arquivo.`);
      await prisma.arteArquivo.update({ where: { id: r.id }, data: { status: "ENVIADO", driveId: j.id, driveLink: j.link || null, hash: h, enviadoEm: new Date(), erro: null, conteudo: null, mime: r.mime || c.mime || null } });
      if (r.origem === "MANUAL" && c.bruto) { const { tokenDe, DIR } = await import("@/lib/arquivos"); const t = tokenDe(c.bruto); if (t) { const fs = await import("fs/promises"); const path = await import("path"); await fs.unlink(path.join(DIR, `${t}.bin`)).catch(() => null); } }
      if (r.origem === "TAREFA" && c.bruto) {
        // só troca se o conteúdo não mudou nesse meio tempo; arquivo grande em disco é apagado do servidor
        const u = await prisma.tarefaArquivo.updateMany({ where: { id: r.arquivoId, conteudo: c.bruto }, data: { conteudo: `gdrive:${j.id}` } });
        const { tokenDe, DIR } = await import("@/lib/arquivos");
        const t = tokenDe(c.bruto);
        if (u.count && t) { const fs = await import("fs/promises"); const path = await import("path"); await fs.unlink(path.join(DIR, `${t}.bin`)).catch(() => null); }
      }
      enviados++;
    } catch (e) {
      await prisma.arteArquivo.update({ where: { id: r.id }, data: { status: "ERRO", erro: String(e.message || e).slice(0, 300), tentativas: { increment: 1 } } }).catch(() => null);
    }
  }
  return { enviados };
}

let rodando = false;
export async function sincronizarArtes() {
  if (rodando) return null;
  rodando = true;
  try { const reg = await registrar(); const env = await enviarPendentes(); return { registrados: reg, ...env }; }
  finally { rodando = false; }
}
export function agendarArtes() {
  const ir = () => sincronizarArtes().catch((e) => console.log("[artes]", e.message));
  setTimeout(ir, 90 * 1000); setInterval(ir, 5 * 60 * 1000);
}

// lista para a guia (sem conteúdo)
export async function listarArtes({ q, tipo, origem } = {}) {
  const where = { excluidoEm: null, ...(tipo ? { tipo } : {}), ...(origem ? { origem } : {}) };
  const l = await prisma.arteArquivo.findMany({ where, orderBy: { createdAt: "desc" }, take: 3000, select: { id: true, origem: true, tipo: true, nome: true, mime: true, tamanho: true, pedidoNumero: true, cliente: true, item: true,
    tarefaId: true, driveLink: true, status: true, erro: true, criadoPorNome: true, createdAt: true, enviadoEm: true } });
  const s = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const b = s(q).trim();
  return b ? l.filter((x) => s(`${x.nome} ${x.pedidoNumero} ${x.cliente} ${x.item} ${x.criadoPorNome}`).includes(b)) : l;
}
export async function enviarManual({ nome, mime, base64, tipo, pedidoNumero, cliente, item }, quem) {
  const { tokenDe, lerMeta } = await import("@/lib/arquivos");
  const tok = tokenDe(base64);   // acima de 8 MB o navegador sobe em partes e manda "arq:<token>"
  const b = tok ? `arq:${tok}` : semData(base64);
  if (!b) return { error: "Arquivo vazio." };
  const tam = tok ? Number((await lerMeta(tok))?.tamanho) || 0 : Math.floor(b.length * 0.75);
  if (tam > LIMITE_DRIVE) return { error: "Arquivo acima de 35 MB: o Google Drive (via Apps Script) não aceita. Envie compactado." };
  const r = await prisma.arteArquivo.create({ data: { chave: `MANUAL|${crypto.randomBytes(9).toString("hex")}`, origem: "MANUAL", tipo: ["LAYOUT", "ARTE", "MOCKUP", "OUTRO"].includes(tipo) ? tipo : "ARTE",
    nome: String(nome || "arte").slice(0, 200), mime: mime || null, tamanho: tam, conteudo: b,
    pedidoNumero: String(pedidoNumero || "").trim() || null, cliente: String(cliente || "").trim().toUpperCase() || null, item: String(item || "").trim() || null, criadoPorNome: quem || null } });
  enviarPendentes(3).catch(() => null);
  return { ok: true, id: r.id };
}
// arquivo para baixar/abrir: do Drive, ou de onde estiver enquanto não subiu
export async function baixarArte(id) {
  const r = await prisma.arteArquivo.findUnique({ where: { id: Number(id) || 0 } });
  if (!r) return null;
  if (r.driveId) { const d = await lerDoDrive(r.driveId); return { base64: d.base64, mime: r.mime || d.mime, nome: r.nome }; }
  const c = await conteudoDe(r);
  if (c.jaNoDrive) { const d = await lerDoDrive(c.jaNoDrive); return { base64: d.base64, mime: r.mime || d.mime, nome: r.nome }; }
  return c.base64 ? { base64: semData(c.base64), mime: r.mime || c.mime, nome: r.nome } : null;
}
export async function excluirArte(id, quem) {
  const r = await prisma.arteArquivo.findUnique({ where: { id: Number(id) || 0 } });
  if (!r) return { ok: true };
  if (r.origem !== "MANUAL") return { error: "Só a arte enviada nesta guia pode ser excluída aqui; a do pedido/tarefa sai pela origem." };
  await prisma.arteArquivo.update({ where: { id: r.id }, data: { excluidoEm: new Date(), erro: `excluída por ${quem || "?"}`, conteudo: null } });
  if (r.driveId) chamar({ acao: "excluir", id: r.driveId }).catch(() => null);   // vai para a lixeira do Drive
  return { ok: true };
}

// texto do Apps Script (o usuário cola em script.google.com na conta dona da pasta)
export function scriptApps(segredo, pasta) {
  return `// Meridian ERP — ponte com o Google Drive (Artes e layouts)
const SEGREDO = "${segredo}";
const PASTA = "${pasta}";
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.segredo !== SEGREDO) return out({ error: "Segredo inválido." });
    const raiz = DriveApp.getFolderById(b.pasta || PASTA);
    if (b.acao === "teste") return out({ ok: true, pasta: raiz.getName() });
    if (b.acao === "enviar") {
      let pasta = raiz;
      if (b.subpasta) { const it = raiz.getFoldersByName(b.subpasta); pasta = it.hasNext() ? it.next() : raiz.createFolder(b.subpasta); }
      const f = pasta.createFile(Utilities.newBlob(Utilities.base64Decode(b.base64), b.mime || "application/octet-stream", b.nome || "arte"));
      return out({ id: f.getId(), link: f.getUrl(), tamanho: f.getSize() });
    }
    if (b.acao === "ler") { const f = DriveApp.getFileById(b.id); return out({ base64: Utilities.base64Encode(f.getBlob().getBytes()), mime: f.getMimeType(), nome: f.getName() }); }
    if (b.acao === "excluir") { DriveApp.getFileById(b.id).setTrashed(true); return out({ ok: true }); }
    return out({ error: "Ação?" });
  } catch (err) { return out({ error: String(err) }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
}
