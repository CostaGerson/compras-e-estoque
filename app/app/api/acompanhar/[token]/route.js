export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { acompanhamento, demandaPeloLink } from "@/lib/rotas";

// v576 — página pública de acompanhamento da rota (link mandado no grupo do WhatsApp). Sem login: vale o token.
// GET  → rota ao vivo (resumida) + demandas do dia
// POST { nome, objetivo, data, destinoNome, endereco, tarefa, horarioTipo, contato, telefone, obs } → nova demanda de rota
const limite = globalThis.__acompLimite || (globalThis.__acompLimite = new Map());
export async function GET(req, { params }) {
  const r = await acompanhamento(params.token);
  return Response.json(r, { status: r.error ? 404 : 200, headers: { "Cache-Control": "no-store" } });
}
export async function POST(req, { params }) {
  const t = String(params.token || "");
  const agora = Date.now(), l = (limite.get(t) || []).filter((x) => agora - x < 3600e3);
  if (l.length >= 40) return Response.json({ error: "Muitas demandas por este link na última hora. Tente mais tarde." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const r = await demandaPeloLink(t, b);
  if (r.ok) { l.push(agora); limite.set(t, l); }
  return Response.json(r, { status: r.error ? 400 : 200 });
}
