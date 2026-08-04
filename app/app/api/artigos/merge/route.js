export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// POST /api/artigos/merge { manterId, removerId }
// Soma o saldo do "remover" no "manter", repõe histórico (movimentações e itens de NF)
// para o "manter" e inativa o "remover". Não mistura cores — a escolha é manual.
export async function POST(req) {
  const b = await req.json();
  const manterId = Number(b.manterId), removerId = Number(b.removerId);
  if (!manterId || !removerId || manterId === removerId)
    return Response.json({ error: "Selecione dois artigos diferentes" }, { status: 400 });

  const [manter, remover] = await Promise.all([
    prisma.artigo.findUnique({ where: { id: manterId } }),
    prisma.artigo.findUnique({ where: { id: removerId } }),
  ]);
  if (!manter || !remover) return Response.json({ error: "Artigo não encontrado" }, { status: 404 });

  const somado = (Number(manter.quantidade) || 0) + (Number(remover.quantidade) || 0);

  await prisma.$transaction(async (tx) => {
    await tx.estoqueMovimentacao.updateMany({ where: { artigoId: removerId }, data: { artigoId: manterId } });
    await tx.nfItem.updateMany({ where: { artigoId: removerId }, data: { artigoId: manterId } });
    await tx.artigo.update({ where: { id: manterId }, data: { quantidade: somado } });
    await tx.artigo.update({ where: { id: removerId }, data: { ativo: false, quantidade: 0 } });
  });

  return Response.json({ ok: true });
}
