// v824 — POST { usuarioId, itens:[{ id, valor }] } → ajusta as parcelas em aberto do pedido
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { aplicarAjustePedido, ajusteParcelasPedido } from "@/lib/finAjustePedido";
import { prisma } from "@/lib/prisma";

// GET ?u=&tituloId= → proposta de ajuste (abrir de novo pela lista)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(sp.get("tituloId")) || 0 } });
  const d = await ajusteParcelasPedido(t);
  return d ? Response.json(d) : Response.json({ error: "As parcelas em aberto deste pedido já fecham o total — nada a ajustar." }, { status: 404 });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  return Response.json(await aplicarAjustePedido(b.itens, nomeU(u)));
}
