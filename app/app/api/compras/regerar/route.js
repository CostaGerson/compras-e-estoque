// v685 — gerar novamente as demandas de compra de um pedido: POST { pedidoNumero, quem }
export const dynamic = "force-dynamic";
import { regerarDemandasPedido } from "@/lib/compras";

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = await regerarDemandasPedido(b.pedidoNumero, b.quem);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
