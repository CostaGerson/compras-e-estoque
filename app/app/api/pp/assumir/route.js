// v730 — Editar pedido do KM pelo card da Produção: monta o lançamento (Pp) e devolve o id para abrir no editor
export const dynamic = "force-dynamic";
import { usuarioPP, negadoPP, nomeQuem } from "@/lib/pp";
import { assumirPedidoKm } from "@/lib/pedidoAssumir";

export async function POST(req) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const b = await req.json().catch(() => ({}));
  try {
    const r = await assumirPedidoKm(b.numero, nomeQuem(u));
    return Response.json(r, { status: r.error ? 400 : 200 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
