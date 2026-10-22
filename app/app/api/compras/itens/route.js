// v404 — vincula a FPP base a um item de pedido e gera a demanda de matéria-prima (vai para o Levantamento)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { itensDoPedido, demandaDoItem } from "@/lib/compras";

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const p = await prisma.pedidoVenda.findUnique({ where: { numero: String(b.pedidoNumero || "") } });
  if (!p) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  const it = itensDoPedido(p).find((i) => i.chave === b.chave);
  if (!it) return Response.json({ error: "Item não encontrado no pedido." }, { status: 404 });
  const fpp = await prisma.fpp.findUnique({ where: { id: Number(b.fppId) } });
  if (!fpp) return Response.json({ error: "FPP não encontrada." }, { status: 404 });
  const atual = await prisma.compraItem.findUnique({ where: { pedidoNumero_chave: { pedidoNumero: p.numero, chave: it.chave } } });
  if (atual && atual.status !== "LEVANTAMENTO") return Response.json({ error: `Item já está em ${atual.status} — não dá para trocar a FPP.` }, { status: 409 });
  const demanda = await demandaDoItem(fpp, it.qtd);
  const dados = { descricao: it.descricao, quantidade: it.qtd, valorUnitario: it.preco, cliente: p.cliente, entrega: p.despacho,
    fppId: fpp.id, fppNumero: fpp.numero, status: "LEVANTAMENTO", demanda, vinculadoPorNome: b.quem || null };
  const v = atual
    ? await prisma.compraItem.update({ where: { id: atual.id }, data: dados })
    : await prisma.compraItem.create({ data: { pedidoNumero: p.numero, chave: it.chave, ...dados } });
  return Response.json(v);
}

export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const v = await prisma.compraItem.findUnique({ where: { pedidoNumero_chave: { pedidoNumero: String(b.pedidoNumero || ""), chave: String(b.chave || "") } } });
  if (!v) return Response.json({ ok: true });
  if (v.status !== "LEVANTAMENTO") return Response.json({ error: `Item já está em ${v.status}.` }, { status: 409 });
  await prisma.compraItem.delete({ where: { id: v.id } });
  return Response.json({ ok: true });
}
