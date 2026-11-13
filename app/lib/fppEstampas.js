import { prisma } from "@/lib/prisma";

// v806 — copia os arquivos das estampas (FppAnexo com aplicacaoUid) de uma FPP para outra
export async function copiarEstampas(de, para) {
  try {
    const l = await prisma.fppAnexo.findMany({ where: { fppId: Number(de), aplicacaoUid: { not: null } } });
    for (const { id, fppId, createdAt, ...a } of l) await prisma.fppAnexo.create({ data: { ...a, fppId: Number(para) } });
  } catch (e) { console.log("fpp/copiarEstampas:", e.message); }
}
