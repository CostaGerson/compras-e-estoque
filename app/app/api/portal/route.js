// v699/v711 — portal do cliente: itens padrão, pedidos (com status e valores), rascunho, envio e edição
export const dynamic = "force-dynamic";
import { usuarioPortal, negadoPortal, itensDoCliente, pedidosDoCliente, enviarPedido, salvarRascunho, nomeCliente, salvarItemPortal, pedidoParaEditar, excluirRascunho, marcarEntregue, clientesComPortal, acessoInternoPortal, alterarDespacho, alterarCustos, anexarNfCliente, removerNfCliente, nfClienteArquivo } from "@/lib/portalCliente";
import { usuarioAtivoFin } from "@/lib/fin";

// GET → { cliente, itens, pedidos } · ?editar=ID → pedido para editar
export async function GET(req) {
  // v1076 — acesso interno: lista dos clientes com portal
  if (new URL(req.url).searchParams.get("clientes")) {
    const u = await usuarioAtivoFin(req.headers.get("x-usuario-id"));
    if (!acessoInternoPortal(u) || u.setor === "CLIENTE") return negadoPortal();
    return Response.json({ clientes: await clientesComPortal() });
  }
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const nfq = new URL(req.url).searchParams.get("nf");   // v1078 — baixar a NF do cliente anexada
  if (nfq) {
    const a = await nfClienteArquivo(p.cliente, nfq);
    if (!a) return Response.json({ error: "NF não encontrada." }, { status: 404 });
    const { respostaAnexo } = await import("@/lib/arquivos");
    return respostaAnexo(a.base64, { nome: a.nome, mime: a.tipo });
  }
  const ed = new URL(req.url).searchParams.get("editar");
  if (ed) { const r = await pedidoParaEditar(p.cliente, ed); return Response.json(r, { status: r.error ? 400 : 200 }); }
  const [itens, pedidos] = await Promise.all([itensDoCliente(p.cliente.id), pedidosDoCliente(p.cliente.id, p.cliente)]);
  return Response.json({ cliente: { id: p.cliente.id, nome: nomeCliente(p.cliente) }, itens, pedidos, interno: !!p.interno });
}

// POST { acao: "rascunho" | "enviar", ppId?, clienteFinal, itens: [{ itemPadraoId, grade, artes, dadosUnitarios, valorVenda }], obs, oc, modo?, limite? }
export async function POST(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Requisição inválida." }, { status: 400 });
  try {
    if (b.acao === "despacho") {   // v1076 — só pelo acesso interno (ERP)
      if (!p.interno) return Response.json({ error: "Só a Meridian altera a data de despacho." }, { status: 403 });
      const r = await alterarDespacho(p.cliente, b.ppId, b.data, p.u);
      if (r.error) return Response.json(r, { status: 400 });
      return Response.json({ ok: true, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
    }
    if (b.acao === "nf" || b.acao === "nfRemover") {   // v1078 — NF emitida para o cliente final (PDF) → anexo do pedido no ERP
      const r = b.acao === "nf" ? await anexarNfCliente(p.cliente, b.ppId, b.arquivos, p.u) : await removerNfCliente(p.cliente, b.anexoId);
      if (r.error) return Response.json(r, { status: 400 });
      return Response.json({ ok: true, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
    }
    if (b.acao === "custos") {   // v1077 — custos adicionais do pedido, só pelo acesso interno
      if (!p.interno) return Response.json({ error: "Só a Meridian lança custos adicionais." }, { status: 403 });
      const r = await alterarCustos(p.cliente, b.ppId, { adicionar: b.adicionar, remover: b.remover }, p.u);
      if (r.error) return Response.json(r, { status: 400 });
      return Response.json({ ok: true, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
    }
    if (b.acao === "entregue") {   // v1074 — pedido despachado entregue ao cliente final
      const r = await marcarEntregue(p.cliente, b.ppId, p.u, b.valor !== false);
      if (r.error) return Response.json(r, { status: 400 });
      return Response.json({ ok: true, pedidos: await pedidosDoCliente(p.cliente.id, p.cliente) });
    }
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
