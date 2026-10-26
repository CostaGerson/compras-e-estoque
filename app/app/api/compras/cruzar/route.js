// v406 — cruza o levantamento com o estoque (saldo − reservas) e autoriza o atendimento pelo estoque
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { itensAbertos, necessidade, disponivelEstoque, simularCruzamento as simular } from "@/lib/compras";
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

export async function GET(req) {
  // v415 — ?atendidos=1: itens autorizados pelo estoque (podem voltar ao levantamento enquanto o material não seguiu para a produção)
  if (new URL(req.url).searchParams.get("atendidos")) {
    const l = await prisma.compraItem.findMany({ where: { status: "ESTOQUE" }, orderBy: [{ autorizadoEm: "desc" }] });
    return Response.json({ itens: l.map((i) => ({ id: i.id, pedidoNumero: i.pedidoNumero, chave: i.chave, descricao: i.descricao, cliente: i.cliente, entrega: i.entrega,
      quantidade: Number(i.quantidade), fppNumero: i.fppNumero, autorizadoEm: i.autorizadoEm, autorizadoPorNome: i.autorizadoPorNome, seguiu: !!i.reservaLiberada,
      demanda: (i.demanda || []).map((d) => ({ nome: d.nome, cor: d.cor, quantidade: d.quantidade, unidade: d.unidade })) })) });
  }
  const { pedidos, artigos, atendidos } = await simular();
  return Response.json({ pedidos, artigos, atendidos });
}

// { itemIds, quem } — autoriza o atendimento pelo estoque: confere de novo o saldo disponível, item a item, em ordem de entrega
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const ids = new Set((b.itemIds || []).map(Number));
  if (!ids.size) return Response.json({ error: "Nenhum item escolhido." }, { status: 400 });
  const itens = (await itensAbertos()).filter((i) => ids.has(i.id));
  const artIds = [...new Set(itens.flatMap((i) => Object.keys(necessidade(i)).map(Number)))];
  const { disponivel } = await disponivelEstoque(artIds);
  const disp = { ...disponivel };
  const falta = [];
  for (const i of itens) {
    const nec = necessidade(i);
    if (!Object.entries(nec).every(([a, q]) => (disp[a] || 0) + 1e-9 >= q)) { falta.push(`${i.pedidoNumero} ${i.chave}`); continue; }
    for (const [a, q] of Object.entries(nec)) disp[a] = r3(disp[a] - q);
  }
  if (falta.length) return Response.json({ error: `Estoque não cobre: ${falta.join(", ")}. Atualize o cruzamento.` }, { status: 409 });
  const agora = new Date();
  await prisma.compraItem.updateMany({ where: { id: { in: itens.map((i) => i.id) } }, data: { status: "ESTOQUE", autorizadoEm: agora, liberadoEm: agora, autorizadoPorNome: b.quem || null } });
  return Response.json({ ok: true, itens: itens.length });
}

// { itemId } — desfaz a autorização (volta ao levantamento) enquanto o material não seguiu para a produção
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  // v415 — em lote: { itemIds }
  if (Array.isArray(b.itemIds)) {
    const l = await prisma.compraItem.findMany({ where: { id: { in: b.itemIds.map(Number) } } });
    const nao = l.filter((x) => x.status !== "ESTOQUE" || x.reservaLiberada);
    if (nao.length) return Response.json({ error: `Não dá para devolver (material já seguiu ou item fora do estoque): ${nao.map((x) => `${x.pedidoNumero} ${x.chave}`).join(", ")}.` }, { status: 409 });
    const r = await prisma.compraItem.updateMany({ where: { id: { in: l.map((x) => x.id) } }, data: { status: "LEVANTAMENTO", autorizadoEm: null, liberadoEm: null, autorizadoPorNome: null } });
    return Response.json({ ok: true, devolvidos: r.count });
  }
  const i = await prisma.compraItem.findUnique({ where: { id: Number(b.itemId) } });
  if (!i || i.status !== "ESTOQUE") return Response.json({ error: "Item não está atendido pelo estoque." }, { status: 400 });
  if (i.reservaLiberada) return Response.json({ error: "O material já seguiu para a produção." }, { status: 409 });
  await prisma.compraItem.update({ where: { id: i.id }, data: { status: "LEVANTAMENTO", autorizadoEm: null, liberadoEm: null, autorizadoPorNome: null } });
  return Response.json({ ok: true });
}
