export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, normRegra } from "@/lib/fin";

// PATCH { usuarioId, termo?, contaId?, banco? }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const d = {};
  if (b.termo !== undefined) d.termo = normRegra(b.termo);
  if (b.contaId !== undefined) d.contaId = Number(b.contaId);
  if (b.banco !== undefined) d.banco = b.banco || null;
  return Response.json(await prisma.finRegra.update({ where: { id: Number(params.id) }, data: d, include: { conta: true } }));
}

export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await prisma.finRegra.delete({ where: { id: Number(params.id) } }).catch(() => null);
  return Response.json({ ok: true });
}
