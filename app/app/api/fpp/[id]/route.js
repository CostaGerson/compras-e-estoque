import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const f = await prisma.fpp.findUnique({ where: { id: Number(params.id) } });
  if (!f) return NextResponse.json({ error: "Ficha não encontrada." }, { status: 404 });
  return NextResponse.json(f);
}

export async function DELETE(_req, { params }) {
  await prisma.fpp.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
