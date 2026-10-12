export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP } from "@/lib/pp";

export async function GET(req, { params }) {
  if (!(await usuarioPP(req))) return negadoPP();
  const id = Number(params.id);
  const pp = await prisma.pp.findUnique({
    where: { id },
    include: { itens: { orderBy: { id: "asc" } } },
  });
  if (!pp) return Response.json({ error: "PP não encontrado" }, { status: 404 });
  return Response.json(pp);
}

export async function DELETE(req, { params }) {
  if (!(await usuarioPP(req))) return negadoPP();
  const id = Number(params.id);
  await prisma.pp.delete({ where: { id } }); // itens em cascata
  return Response.json({ ok: true });
}
