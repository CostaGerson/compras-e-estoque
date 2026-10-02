export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await prisma.finSenhaPdf.delete({ where: { id: Number(params.id) } }).catch(() => null);
  return Response.json({ ok: true });
}
