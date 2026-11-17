// v891 — #85: composição do artigo (cadastro de artigos) junto ao nome da malha/tecido
import { prisma } from "@/lib/prisma";

// completa o resumo da FPP com a composição do artigo do estoque (quando a FPP só guardou o artigoId)
export async function comComposicao(rf) {
  if (!rf || rf.artigoComposicao || !rf.artigoId) return rf;
  const a = await prisma.artigo.findUnique({ where: { id: Number(rf.artigoId) }, select: { composicao: true } }).catch(() => null);
  if (a?.composicao) rf.artigoComposicao = String(a.composicao).toUpperCase().trim();
  return rf;
}
