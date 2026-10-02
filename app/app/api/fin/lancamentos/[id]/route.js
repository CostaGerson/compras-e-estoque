export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, lancOut } from "@/lib/fin";

// PATCH { usuarioId, data?, historico?, documento?, identificacao?, valor?, contaId?, banco? }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const d = {};
  if (b.data) d.data = new Date(b.data + "T00:00:00Z");
  if (b.historico !== undefined) d.historico = String(b.historico).toUpperCase();
  if (b.documento !== undefined) d.documento = b.documento || null;
  if (b.identificacao !== undefined) d.identificacao = b.identificacao ? String(b.identificacao).toUpperCase() : null;
  if (b.banco) d.banco = String(b.banco).toUpperCase();
  if (b.valor !== undefined && Number(b.valor)) d.valor = Number(b.valor);
  if (b.contaId !== undefined) {
    d.contaId = b.contaId ? Number(b.contaId) : null;
    d.regraId = null;
    d.identificadoPor = b.contaId ? [u.nome, u.sobrenome].join(" ").trim().toUpperCase() : null;
  }
  const l = await prisma.finLancamento.update({ where: { id: Number(params.id) }, data: d });
  return Response.json(lancOut(l));
}

// DELETE ?u=  (excluir uma parte desfaz o desmembramento inteiro)
export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const id = Number(params.id);
  const l = await prisma.finLancamento.findUnique({ where: { id } });
  if (!l) return Response.json({ ok: true });
  if (l.paiId) {
    await prisma.$transaction([
      prisma.finLancamento.deleteMany({ where: { paiId: l.paiId } }),
      prisma.finLancamento.update({ where: { id: l.paiId }, data: { desmembrado: false } }),
    ]);
    return Response.json({ ok: true, desfeito: true });
  }
  await prisma.$transaction([
    prisma.finLancamento.deleteMany({ where: { paiId: id } }),
    prisma.finLancamento.delete({ where: { id } }),
  ]);
  return Response.json({ ok: true });
}
