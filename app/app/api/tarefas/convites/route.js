export const dynamic = "force-dynamic";
import { usuarioAtivo, pendenciasAgenda, responderConvite, efetivoVisto } from "@/lib/tarefas";

// v600 — GET ?u= → { convites (a responder hoje), efetivo (meus eventos abaixo das pessoas necessárias) }
export async function GET(req) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  return Response.json(await pendenciasAgenda(u));
}
// POST { usuarioId, acao: "responder", tarefaId, resposta: CONFIRMAR|RECUSAR|DEPOIS } | { usuarioId, acao: "visto", ids }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = b.acao === "visto" ? await efetivoVisto(u, b.ids) : await responderConvite(u, b.tarefaId, b.resposta);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
