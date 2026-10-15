export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioAtivo, ehMaster, negadoKpi as negado } from "@/lib/kpi";
import { analisarCapacidade } from "@/lib/gestaoCapacidade";

// v227 — GET ?u=&meses=6&alvo=15000&folga=5 → capacidade × freelancer por setor
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!ehMaster(u)) return negado("Capacidade: master e diretoria.");
  const folga = sp.get("folga") != null ? Number(String(sp.get("folga")).replace(",", ".")) / 100 : 0.05;
  try { return Response.json(await analisarCapacidade({ meses: sp.get("meses"), alvo: sp.get("alvo"), folga })); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
