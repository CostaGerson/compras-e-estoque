import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { usuarioSoMaster, soMaster } from "../../../../lib/fin";

export const dynamic = "force-dynamic";

// v167 — excluir nota importada: só o master
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioSoMaster(b.usuarioId || new URL(req.url).searchParams.get("u")))) return soMaster();
  const id = Number(params.id);
  await prisma.clienteNota.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
