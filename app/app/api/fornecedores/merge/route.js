export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// POST /api/fornecedores/merge { manterId, removerId }
// Junta dois fornecedores de mesmo nome comercial: move CNPJs, artigos, NFs e OCs
// para o "manter" e inativa o "remover". Um fornecedor por nome, vários CNPJs dentro.
export async function POST(req) {
  const b = await req.json();
  const manterId = Number(b.manterId), removerId = Number(b.removerId);
  if (!manterId || !removerId || manterId === removerId)
    return Response.json({ error: "Selecione dois fornecedores diferentes" }, { status: 400 });

  const [manter, remover] = await Promise.all([
    prisma.fornecedor.findUnique({ where: { id: manterId } }),
    prisma.fornecedor.findUnique({ where: { id: removerId } }),
  ]);
  if (!manter || !remover) return Response.json({ error: "Fornecedor não encontrado" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.fornecedorCnpj.updateMany({ where: { fornecedorId: removerId }, data: { fornecedorId: manterId } });
    await tx.artigo.updateMany({ where: { fornecedorId: removerId }, data: { fornecedorId: manterId } });
    await tx.notaFiscal.updateMany({ where: { fornecedorId: removerId }, data: { fornecedorId: manterId } });
    await tx.ordemCompra.updateMany({ where: { fornecedorId: removerId }, data: { fornecedorId: manterId } });
    await tx.fornecedor.update({ where: { id: removerId }, data: { ativo: false } });
  });

  return Response.json({ ok: true });
}
