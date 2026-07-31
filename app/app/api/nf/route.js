export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const nfs = await prisma.notaFiscal.findMany({
    select: {
      id: true, numero: true, status: true,
      dataEmissao: true, valorTotal: true, temPdf: true, temXml: true,
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return Response.json(nfs);
}
