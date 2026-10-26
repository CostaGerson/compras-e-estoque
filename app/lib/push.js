// v466 — notificações no celular (Web Push). As chaves VAPID são geradas na 1ª vez e guardadas no banco (FinConfig).
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const K = "PUSH_VAPID";
let cache = null;
async function chaves() {
  if (cache) return cache;
  const c = await prisma.finConfig.findUnique({ where: { chave: K } }).catch(() => null);
  let v = null;
  try { v = c?.valor ? JSON.parse(c.valor) : null; } catch { v = null; }
  if (!v?.publicKey || !v?.privateKey) {
    v = webpush.generateVAPIDKeys();
    await prisma.finConfig.upsert({ where: { chave: K }, create: { chave: K, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  }
  webpush.setVapidDetails("mailto:contato@meridianpro.com.br", v.publicKey, v.privateKey);
  cache = v;
  return v;
}
export async function chavePublica() { return (await chaves()).publicKey; }

export async function inscrever(usuarioId, sub, aparelho) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return { error: "Inscrição inválida." };
  await prisma.pushInscricao.upsert({
    where: { endpoint: sub.endpoint },
    create: { usuarioId: Number(usuarioId), endpoint: sub.endpoint, chaves: sub.keys, aparelho: aparelho ? String(aparelho).slice(0, 200) : null },
    update: { usuarioId: Number(usuarioId), chaves: sub.keys, aparelho: aparelho ? String(aparelho).slice(0, 200) : null },
  });
  return { ok: true };
}
export async function remover(endpoint) {
  if (endpoint) await prisma.pushInscricao.deleteMany({ where: { endpoint } }).catch(() => null);
  return { ok: true };
}

// manda para todos os aparelhos do usuário; inscrição vencida (404/410) é apagada
export async function notificar(usuarioId, { titulo, texto, url = "/", tag }) {
  if (!usuarioId) return { enviados: 0 };
  const subs = await prisma.pushInscricao.findMany({ where: { usuarioId: Number(usuarioId) } }).catch(() => []);
  if (!subs.length) return { enviados: 0 };
  await chaves();
  const payload = JSON.stringify({ titulo, texto, url, tag });
  let enviados = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.chaves }, payload, { TTL: 6 * 3600, urgency: "high" }); enviados++; }
    catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await prisma.pushInscricao.delete({ where: { id: s.id } }).catch(() => null);
      else console.log("push:", e?.statusCode, e?.body || e?.message);
    }
  }
  return { enviados };
}
