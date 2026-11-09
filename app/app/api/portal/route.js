// v699 — portal do cliente: itens padrão do cliente, pedidos dele e envio de pedido novo
export const dynamic = "force-dynamic";
import { usuarioPortal, negadoPortal, itensDoCliente, pedidosDoCliente, enviarPedido, nomeCliente } from "@/lib/portalCliente";

// GET → { cliente, itens, pedidos }
export async function GET(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const [itens, pedidos] = await Promise.all([itensDoCliente(p.cliente.id), pedidosDoCliente(p.cliente.id)]);
  return Response.json({ cliente: { id: p.cliente.id, nome: nomeCliente(p.cliente) }, itens, pedidos });
}

// POST { itens: [{ itemPadraoId, grade, artes, dadosUnitarios }], obs, oc }
export async function POST(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Requisição inválida." }, { status: 400 });
  try {
    const r = await enviarPedido(p, b);
    if (r.error) return Response.json(r, { status: 400 });
    return Response.json({ ...r, pedidos: await pedidosDoCliente(p.cliente.id) });
  } catch (e) { return Response.json({ error: "Falha ao enviar: " + (e?.message || e) }, { status: 500 }); }
}
