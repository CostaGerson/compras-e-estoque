export const dynamic = "force-dynamic";
import { usuarioAtivo, statusEquipe, mudarStatus } from "@/lib/tarefas";

// GET ?u= → status de cada pessoa (disponível, ocupado, em reunião, inativo)
export async function GET(req) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  return Response.json({ equipe: await statusEquipe(u) });
}

// PATCH { usuarioId, status: REUNIAO | DISPONIVEL }
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  return Response.json(await mudarStatus(u, b.status));
}
