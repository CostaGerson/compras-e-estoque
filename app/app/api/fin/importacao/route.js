export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { garantirTipos, usuarioMaster, negado, competenciaValida } from "@/lib/fin";

// GET ?u=<usuarioId>&competencia=AAAA-MM → cards do mês
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });

  await garantirTipos();
  const [tipos, arquivos, justificativas] = await Promise.all([
    prisma.finDocTipo.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    prisma.finArquivo.findMany({
      where: { competencia },
      orderBy: { createdAt: "asc" },
      select: { id: true, tipoId: true, nome: true, tamanho: true, senhaPdf: true, enviadoPorNome: true, createdAt: true },
    }),
    prisma.finJustificativa.findMany({ where: { competencia } }),
  ]);
  return Response.json({
    tipos,
    arquivos: arquivos.map(({ senhaPdf, ...a }) => ({ ...a, protegido: !!senhaPdf })),
    justificativas,
  });
}
