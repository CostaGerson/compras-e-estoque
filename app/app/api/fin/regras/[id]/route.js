export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, dadosRegra } from "@/lib/fin";

// PATCH { usuarioId, ...campos } ou { usuarioId, mover: "cima" | "baixo" | "topo" | "fim" }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const id = Number(params.id);
  if (b.mover) {
    const todas = await prisma.finRegra.findMany({ orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true } });
    const i = todas.findIndex((r) => r.id === id);
    if (i < 0) return Response.json({ ok: true });
    const lista = todas.map((r) => r.id);
    lista.splice(i, 1);
    const j = b.mover === "topo" ? 0 : b.mover === "fim" ? lista.length : b.mover === "cima" ? Math.max(0, i - 1) : Math.min(lista.length, i + 1);
    lista.splice(j, 0, id);
    // renumera só o que mudou
    const ops = [];
    lista.forEach((rid, k) => ops.push(prisma.finRegra.update({ where: { id: rid }, data: { ordem: (k + 1) * 10 } })));
    await prisma.$transaction(ops);
    return Response.json({ ok: true });
  }
  return Response.json(await prisma.finRegra.update({ where: { id }, data: dadosRegra(b), include: { conta: true } }));
}

export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await prisma.finRegra.delete({ where: { id: Number(params.id) } }).catch(() => null);
  return Response.json({ ok: true });
}
