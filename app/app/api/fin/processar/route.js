export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, competenciaValida, processarArquivo, conciliarCompetencia } from "@/lib/fin";

// POST { usuarioId, competencia, reler?: [arquivoId] } — lê arquivos pendentes, confere detalhamentos e aplica palavras-chave
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioSoMaster(b.usuarioId, "docsFinanceiros"))) return soMaster();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  if (Array.isArray(b.reler) && b.reler.length) {
    await prisma.finArquivo.updateMany({ where: { id: { in: b.reler.map(Number) }, competencia: b.competencia }, data: { processado: false } });
  }
  const arqs = await prisma.finArquivo.findMany({ where: { competencia: b.competencia, processado: false }, select: { id: true, nome: true } });
  const res = [];
  for (const a of arqs) {
    try { res.push({ nome: a.nome, ...(await processarArquivo(a.id, { conciliarDepois: false })) }); }
    catch (e) { res.push({ nome: a.nome, ok: false, erro: e.message }); }
  }
  const conferencia = await conciliarCompetencia(b.competencia);
  return Response.json({ arquivos: res, conferencia });
}
