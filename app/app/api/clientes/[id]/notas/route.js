import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const id = Number(params.id);
  const notas = await prisma.clienteNota.findMany({
    where: { clienteId: id },
    orderBy: [{ dataEmissao: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(notas);
}
