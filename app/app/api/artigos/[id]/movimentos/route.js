export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  const artigoId = Number(params.id);
  const movs = await prisma.estoqueMovimentacao.findMany({
    where: { artigoId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, tipo: true, quantidade: true, createdAt: true, perfil: true, observacao: true,
      nf: { select: { id: true, numero: true, temPdf: true, temXml: true, dataEmissao: true } },
      fme: { select: { id: true, numero: true } },
    },
  });
  return Response.json(movs);
}
