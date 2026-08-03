import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    orderBy: { razaoSocial: "asc" },
    include: { _count: { select: { notas: true } } },
  });
  return NextResponse.json(clientes);
}
