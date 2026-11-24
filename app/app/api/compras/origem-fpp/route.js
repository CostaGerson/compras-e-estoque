// v1089 — FPP do item de pedido de origem de uma compra: GET ?pedido=&chave= → { id, numero }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const pedido = String(q.get("pedido") || ""), chave = String(q.get("chave") || "");
  if (!pedido) return Response.json({ error: "Pedido?" }, { status: 400 });
  let ci = chave ? await prisma.compraItem.findUnique({ where: { pedidoNumero_chave: { pedidoNumero: pedido, chave } }, select: { fppId: true, fppNumero: true } }).catch(() => null) : null;
  if (!ci?.fppId && !ci?.fppNumero) ci = await prisma.compraItem.findFirst({ where: { pedidoNumero: pedido, OR: [{ fppId: { not: null } }, { fppNumero: { not: null } }] }, select: { fppId: true, fppNumero: true } });
  let f = ci?.fppId ? await prisma.fpp.findUnique({ where: { id: ci.fppId }, select: { id: true, numero: true } }) : null;
  if (!f && ci?.fppNumero) f = await prisma.fpp.findUnique({ where: { numero: ci.fppNumero }, select: { id: true, numero: true } });
  if (!f) {   // pedido do sistema: FPP do item do lançamento (mesma posição da chave #n)
    const pp = await prisma.pp.findFirst({ where: { numero: pedido }, include: { itens: { orderBy: { id: "asc" }, select: { fppId: true } } } });
    const n = Number((chave.match(/#(\d+)$/) || [])[1]) || 0;
    const it = pp ? (n ? pp.itens[n - 1] : null) || pp.itens.find((x) => x.fppId) : null;
    if (it?.fppId) f = await prisma.fpp.findUnique({ where: { id: it.fppId }, select: { id: true, numero: true } });
  }
  return f ? Response.json(f) : Response.json({ error: "Este item do pedido não tem FPP indexada." }, { status: 404 });
}
