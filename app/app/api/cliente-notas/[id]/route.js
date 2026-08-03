import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_req, { params }) {
  const id = Number(params.id);
  await prisma.clienteNota.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
