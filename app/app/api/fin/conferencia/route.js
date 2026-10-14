export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { conferencia } from "@/lib/finConferencia";

// v211 — GET ?u=&ano=2026 → conferência de integração (mesmo número em telas diferentes)
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  const ano = Number(q.get("ano") || new Date().getFullYear());
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return Response.json({ error: "Ano inválido." }, { status: 400 });
  try { return Response.json(await conferencia(ano)); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
