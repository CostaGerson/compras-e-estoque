export const dynamic = "force-dynamic";
import { usuarioMaster, negado, competenciaValida, aplicarRegras } from "@/lib/fin";

// POST { usuarioId, competencia } → aplica as palavras-chave nos lançamentos ainda SEM conta
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  return Response.json({ identificados: await aplicarRegras(b.competencia) });
}
