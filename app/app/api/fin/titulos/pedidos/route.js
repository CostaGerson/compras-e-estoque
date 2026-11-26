// v1131 — pedidos de uma conta a pagar: GET ?u=&q= busca pedidos · GET ?u=&titulo=ID a divisão gravada
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { buscarPedidos, pedidosDoTitulo } from "@/lib/finTituloPedidos";

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioMaster(q.get("u")))) return negado();
  try {
    if (q.get("titulo")) return Response.json({ pedidos: await pedidosDoTitulo(q.get("titulo")) });
    return Response.json({ pedidos: await buscarPedidos(q.get("q")) });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
