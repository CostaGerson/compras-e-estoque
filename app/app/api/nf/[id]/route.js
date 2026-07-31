export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// Exclui a NF (e seus itens/estratificações). Os artigos cadastrados permanecem.
export async function DELETE(req, { params }) {
  const id = Number(params.id);
  await prisma.$transaction(async (tx) => {
    const itens = await tx.nfItem.findMany({ where: { nfId: id }, select: { id: true } });
    const ids = itens.map((i) => i.id);
    if (ids.length) await tx.nfEstratificacao.deleteMany({ where: { nfItemId: { in: ids } } });
    await tx.nfItem.deleteMany({ where: { nfId: id } });
    await tx.estoqueMovimentacao.deleteMany({ where: { nfId: id } });
    await tx.estoqueSaldo.deleteMany({ where: { origemNfId: id } });
    await tx.notaFiscal.delete({ where: { id } });
  });
  return Response.json({ ok: true });
}
