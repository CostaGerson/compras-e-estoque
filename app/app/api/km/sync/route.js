// v386 — recebe os pedidos lidos do banco do KM pelo agente do PC da fábrica (tools/km/km-sync.ps1)
// POST /api/km/sync            { pedidos: [...] }  → aplica (PV + OP + entrada automática)
// POST /api/km/sync?previa=1   { pedidos: [...] }  → só mostra como cada pedido ficaria, não grava
// GET  /api/km/sync                                 → últimas sincronizações
// autenticação: cabeçalho x-km-token = KM_SYNC_TOKEN (.env da VPS)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { sincronizarKm } from "@/lib/kmSync";

function autorizado(req) {
  const t = process.env.KM_SYNC_TOKEN;
  if (!t || t.length < 16) return { erro: "KM_SYNC_TOKEN não configurado no .env da VPS.", status: 503 };
  if (req.headers.get("x-km-token") !== t) return { erro: "Token inválido.", status: 401 };
  return null;
}

export async function POST(req) {
  const neg = autorizado(req);
  if (neg) return Response.json({ error: neg.erro }, { status: neg.status });
  let b; try { b = await req.json(); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const previa = new URL(req.url).searchParams.get("previa") === "1";
  try {
    const r = await sincronizarKm(b?.pedidos, { previa });
    return Response.json({ ok: true, previa, ...r });
  } catch (e) {
    console.log("km/sync:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req) {
  const neg = autorizado(req);
  if (neg) return Response.json({ error: neg.erro }, { status: neg.status });
  const logs = await prisma.kmSyncLog.findMany({ orderBy: { id: "desc" }, take: 20 });
  return Response.json({ logs });
}
