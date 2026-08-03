export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// Exclui a NF, reverte o saldo em estoque dos artigos e desvincula o nfId. Os artigos permanecem no catálogo.
export async function DELETE(req, { params }) {
  const id = Number(params.id);
  await prisma.$transaction(async (tx) => {
    const itens = await tx.nfItem.findMany({ where: { nfId: id }, select: { id: true, artigoId: true, quantidade: true } });

    // 1) reverte o saldo (a importação somou quantidade em cada artigo)
    for (const it of itens) {
      if (!it.artigoId) continue;
      const art = await tx.artigo.findUnique({ where: { id: it.artigoId }, select: { quantidade: true } });
      const atual = art ? Number(art.quantidade) || 0 : 0;
      const novo = Math.max(0, atual - (Number(it.quantidade) || 0));
      await tx.artigo.update({ where: { id: it.artigoId }, data: { quantidade: novo } });
    }

    // 2) desvincula artigos que apontam para esta NF (evita erro de FK)
    await tx.artigo.updateMany({ where: { nfId: id }, data: { nfId: null } });

    // 3) remove estratificações, itens, movimentos e saldos da NF
    const ids = itens.map((i) => i.id);
    if (ids.length) await tx.nfEstratificacao.deleteMany({ where: { nfItemId: { in: ids } } });
    await tx.nfItem.deleteMany({ where: { nfId: id } });
    await tx.estoqueMovimentacao.deleteMany({ where: { nfId: id } });
    await tx.estoqueSaldo.deleteMany({ where: { origemNfId: id } });

    // 4) exclui a NF
    await tx.notaFiscal.delete({ where: { id } });
  });
  return Response.json({ ok: true });
}
