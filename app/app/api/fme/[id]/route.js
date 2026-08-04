export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const selArtigo = { id: true, nome: true, artigoInterno: true, cor: true, unidade: true, quantidade: true };

// GET /api/fme/[id] -> FME com itens e TODO o histórico de movimentação (saídas e retornos)
export async function GET(req, { params }) {
  const id = Number(params.id);
  const fme = await prisma.fme.findUnique({
    where: { id },
    include: {
      itens: { include: { artigo: { select: selArtigo } } },
      movimentacoes: {
        orderBy: { createdAt: "asc" },
        include: { artigo: { select: { id: true, nome: true, cor: true, unidade: true } } },
      },
    },
  });
  if (!fme) return Response.json({ error: "FME não encontrada" }, { status: 404 });
  return Response.json(fme);
}
