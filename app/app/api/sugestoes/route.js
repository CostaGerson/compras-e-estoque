export const dynamic = "force-dynamic";
import { usuarioAtivo, criar, listar } from "@/lib/sugestoes";

// GET ?u= → master: todas · demais: as suas
export async function GET(req) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  return Response.json({ sugestoes: await listar(u) });
}

// POST { usuarioId, texto, tela }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await criar(u, b);
  return Response.json(r, { status: r.error ? 400 : 201 });
}
