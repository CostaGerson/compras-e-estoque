export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioAtivo, ehMaster, negadoKpi as negado } from "@/lib/kpi";
import { analisarCapacidade, salvarDiarias } from "@/lib/gestaoCapacidade";

// v229 — GET ?u=&meses=6&alvo=15000 → capacidade × freelancer por setor (pela diária de cada área)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!ehMaster(u)) return negado("Capacidade: master e diretoria.");
  try { return Response.json(await analisarCapacidade({ meses: sp.get("meses"), alvo: sp.get("alvo") })); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
// POST { usuarioId, diarias: { COSTURA: 180, CORTE: 200, ... } } → grava a diária do freelancer por área
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!ehMaster(u)) return negado("Só o financeiro altera.");
  return Response.json({ diarias: await salvarDiarias(b.diarias) });
}
