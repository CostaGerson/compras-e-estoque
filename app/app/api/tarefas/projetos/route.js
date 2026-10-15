export const dynamic = "force-dynamic";
import { usuarioAtivo, listarProjetos, salvarProjeto, excluirProjeto } from "@/lib/tarefas";

// v226 — projetos da agenda
export async function GET(req) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  return Response.json({ projetos: await listarProjetos(u) });
}
// POST { usuarioId, projeto: { id?, nome, cor, publico } }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await salvarProjeto(b.projeto || {}, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
// DELETE { usuarioId, id }
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await excluirProjeto(b.id, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
