// v521 — clientes cadastrados no KM
// Agente (cabeçalho x-km-token = KM_SYNC_TOKEN):
//   GET  /api/km/clientes?pendente=1   → "1" quando alguém pediu a busca pela tela, senão "0"
//   POST /api/km/clientes[?previa=1]   { clientes: [...linhas de solclien] } → grava (ou só mostra o mapeamento)
// Tela Clientes:
//   GET  /api/km/clientes              → status da última busca + se há pedido pendente
//   POST /api/km/clientes              { pedir: true } → pede a busca (o agente do PC atende em até 1 min)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { sincronizarClientesKm, K_PEDIDO, K_STATUS } from "@/lib/kmClientes";

const doAgente = (req) => !!req.headers.get("x-km-token");
function autorizado(req) {
  const t = process.env.KM_SYNC_TOKEN;
  if (!t || t.length < 16) return { erro: "KM_SYNC_TOKEN não configurado no .env da VPS.", status: 503 };
  if (req.headers.get("x-km-token") !== t) return { erro: "Token inválido.", status: 401 };
  return null;
}
const cfg = async (chave) => { const r = await prisma.finConfig.findUnique({ where: { chave } }); try { return r ? JSON.parse(r.valor) : null; } catch { return null; } };

export async function GET(req) {
  const pend = await cfg(K_PEDIDO);
  if (new URL(req.url).searchParams.get("pendente") === "1") {
    const neg = autorizado(req);
    if (neg) return new Response("0", { status: neg.status });
    return new Response(pend ? "1" : "0", { headers: { "content-type": "text/plain" } });
  }
  const st = await cfg(K_STATUS);
  const doKm = await prisma.cliente.count({ where: { kmSyncEm: { not: null } } });
  return Response.json({ ultima: st, pedido: pend, doKm });
}

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!doAgente(req)) {
    if (!b?.pedir) return Response.json({ error: "Requisição inválida." }, { status: 400 });
    const v = JSON.stringify({ em: new Date().toISOString(), usuarioId: b.usuarioId || null });
    await prisma.finConfig.upsert({ where: { chave: K_PEDIDO }, update: { valor: v }, create: { chave: K_PEDIDO, valor: v } });
    return Response.json({ ok: true });
  }
  const neg = autorizado(req);
  if (neg) return Response.json({ error: neg.erro }, { status: neg.status });
  const previa = new URL(req.url).searchParams.get("previa") === "1";
  try {
    const r = await sincronizarClientesKm(b?.clientes, { previa });
    return Response.json({ ok: true, previa, ...r });
  } catch (e) {
    console.log("km/clientes:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
