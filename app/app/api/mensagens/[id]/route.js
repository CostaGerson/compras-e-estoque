export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// PATCH /api/mensagens/[id]  { lida?, arquivada? }  -> vistar / arquivar / desarquivar
export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  const data = {};
  if ("lida" in b) data.lida = !!b.lida;
  if ("arquivada" in b) data.arquivada = !!b.arquivada;
  const m = await prisma.mensagem.update({ where: { id }, data });
  return Response.json(m);
}

export async function DELETE(req, { params }) {
  await prisma.mensagem.delete({ where: { id: Number(params.id) } });
  return Response.json({ ok: true });
}
