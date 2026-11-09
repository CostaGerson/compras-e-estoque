// v699/v711 — portal do cliente: itens padrão, pedidos (com status e valores), rascunho, envio e edição
export const dynamic = "force-dynamic";
import { usuarioPortal, negadoPortal, itensDoCliente, pedidosDoCliente, enviarPedido, salvarRascunho, nomeCliente, salvarItemPortal, pedidoParaEditar, excluirRascunho } from "@/lib/portalCliente";

// GET → { cliente, itens, pedidos } · ?editar=ID → pedido para editar
export async function GET(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const ed = new URL(req.url).searchParams.get("editar");
  if (ed) { const r = await pedidoParaEditar(p.cliente, ed); return Response.json(r, { status: r.error ? 400 : 200 }); }
  const [itens, pedidos] = await Promise.all([itensDoCliente(p.cliente.id), pedidosDoCliente(p.cliente.id, p.cliente)]);
  return Response.json({ cliente: { id: p.cliente.id, nome: nomeCliente(p.cliente) }, itens, pedidos });
}

// POST { acao: "rascunho" | "enviar", ppId?, clienteFinal, itens: [{ itemPadraoId, grade, artes, dadosUnitarios, valorVenda }], obs, oc, modo?, limite? }
export async function POST(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Requisição inválida." }, { status: 400 });
  try {
    const r = b.acao === "rascunho" ? await salvarRascunho(p, b) : await enviarPedido(p, b);
    if (r.error) return Response.json(r, { status: 400 });
    return Response.json({ ...r, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
  } catch (e) { return Response.json({ error: "Falha ao gravar: " + (e?.message || e) }, { status: 500 }); }
}

// PUT { ppId, idx, dadosUnitarios, grade } → ajusta o item de um pedido ainda fora da produção
export async function PUT(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Requisição inválida." }, { status: 400 });
  const r = await salvarItemPortal(p, b);
  if (r.error) return Response.json(r, { status: 400 });
  return Response.json({ ok: true, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
}

// DELETE { ppId } → exclui um pedido em aberto
export async function DELETE(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const b = await req.json().catch(() => ({}));
  const r = await excluirRascunho(p.cliente, b.ppId, p.u);
  if (r.error) return Response.json(r, { status: 400 });
  return Response.json({ ok: true, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
}
