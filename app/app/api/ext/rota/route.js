// v725 — Cronograma PCP: cria a demanda de rota a partir da OS (POST) e consulta a demanda de uma OS (GET ?osPcp=47).
// Mesma OS duas vezes não duplica: devolve a que já existe com jaExistia: true. Recusa → { ok: false, error } (texto para a tela).
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { criarRotaPcp, statusRotaPcp } from "@/lib/rotaExt";

const autorizado = async (req) => { const tk = req.headers.get("x-api-key") || ""; return !!tk && tk === (await tokenExterno()); };

export async function GET(req) {
  if (!(await autorizado(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const r = await statusRotaPcp(new URL(req.url).searchParams.get("osPcp"));
  return Response.json(r, { status: r.ok ? 200 : 404 });
}

export async function POST(req) {
  if (!(await autorizado(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: "Corpo inválido (JSON)." }, { status: 400 });
  try {
    const r = await criarRotaPcp(b);
    return Response.json(r, { status: r.ok ? 200 : 422 });
  } catch (e) {
    console.log("ext/rota:", e.message);
    return Response.json({ ok: false, error: "Não foi possível criar a demanda de rota no ERP. Tente de novo em instantes." }, { status: 500 });
  }
}
