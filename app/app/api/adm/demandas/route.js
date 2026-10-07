export const dynamic = "force-dynamic";
import { usuarioAdm, negadoAdm, listar, criar } from "@/lib/admDemandas";

// GET ?u= → demandas (o administrativo vê as suas e as do setor) + equipe do administrativo
export async function GET(req) {
  const u = await usuarioAdm(new URL(req.url).searchParams.get("u"));
  if (!u) return negadoAdm();
  return Response.json(await listar(u));
}
// POST { usuarioId, titulo, descricao, prazo, prioridade, responsavelId }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAdm(b.usuarioId);
  if (!u) return negadoAdm();
  const r = await criar(b, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
