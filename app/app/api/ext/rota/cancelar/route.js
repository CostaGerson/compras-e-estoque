// v725 — Cronograma PCP: cancela a demanda de rota aberta pela OS ({ rotaId, motivo } ou { osPcp, motivo }). Rota já saiu → recusa.
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { cancelarRotaPcp } from "@/lib/rotaExt";

export async function POST(req) {
  const tk = req.headers.get("x-api-key") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: "Corpo inválido (JSON)." }, { status: 400 });
  const r = await cancelarRotaPcp(b).catch((e) => ({ ok: false, error: e.message }));
  return Response.json(r, { status: r.ok ? 200 : 422 });
}
