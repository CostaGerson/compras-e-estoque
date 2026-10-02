export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";

// PUT { usuarioId, competencia, tipoId, texto } — texto vazio apaga
export async function PUT(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const tipoId = Number(b.tipoId);
  const texto = String(b.texto || "").trim().toUpperCase();
  if (!texto) {
    await prisma.finJustificativa.deleteMany({ where: { competencia: b.competencia, tipoId } });
    return Response.json({ ok: true, removida: true });
  }
  const nome = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  const j = await prisma.finJustificativa.upsert({
    where: { competencia_tipoId: { competencia: b.competencia, tipoId } },
    update: { texto, usuarioId: u.id, usuarioNome: nome },
    create: { competencia: b.competencia, tipoId, texto, usuarioId: u.id, usuarioNome: nome },
  });
  return Response.json(j);
}
