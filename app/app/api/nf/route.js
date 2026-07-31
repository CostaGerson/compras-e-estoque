export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const nfs = await prisma.notaFiscal.findMany({
    include: { fornecedor: true, _count: { select: { itens: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json(nfs);
}

