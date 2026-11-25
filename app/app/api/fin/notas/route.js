export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin, negado } from "@/lib/fin";

// v1118 — caderno de notas do financeiro (um só, compartilhado), salvo automaticamente
const K = "FIN|NOTAS";
const ler = async () => { const r = await prisma.finConfig.findUnique({ where: { chave: K } }).catch(() => null); try { return r?.valor ? JSON.parse(r.valor) : {}; } catch { return {}; } };
export async function GET(req) {
  if (!(await usuarioAtivoFin(new URL(req.url).searchParams.get("u")))) return negado();
  const v = await ler();
  return Response.json({ texto: v.texto || "", por: v.por || null, em: v.em || null });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivoFin(b.usuarioId);
  if (!u) return negado();
  const v = { texto: String(b.texto ?? "").slice(0, 200000), por: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase(), em: new Date().toISOString() };
  await prisma.finConfig.upsert({ where: { chave: K }, create: { chave: K, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return Response.json({ ok: true, por: v.por, em: v.em });
}
