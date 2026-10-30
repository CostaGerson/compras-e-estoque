// v595 — cadastro de itens do KM (solprodu + último detalhe de produção). Agente: POST { produtos: [...] } com x-km-token
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { sincronizarProdutosKm } from "@/lib/pedidoEfetivar";

export async function POST(req) {
  const t = process.env.KM_SYNC_TOKEN;
  if (!t || t.length < 16) return Response.json({ error: "KM_SYNC_TOKEN não configurado no .env da VPS." }, { status: 503 });
  if (req.headers.get("x-km-token") !== t) return Response.json({ error: "Token inválido." }, { status: 401 });
  let b; try { b = await req.json(); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (new URL(req.url).searchParams.get("previa") === "1") return Response.json({ recebidos: (b?.produtos || []).length, amostra: (b?.produtos || []).slice(0, 10) });
  try { return Response.json({ ok: true, ...(await sincronizarProdutosKm(b?.produtos)) }); }
  catch (e) { console.log("km/produtos:", e); return Response.json({ error: e.message }, { status: 500 }); }
}
