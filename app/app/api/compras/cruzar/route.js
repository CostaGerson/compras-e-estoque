// v406 — cruza o levantamento com o estoque (saldo − reservas) e autoriza o atendimento pelo estoque
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { itensAbertos, cruzarEstoque, necessidade, disponivelEstoque, montarLevantamento } from "@/lib/compras";

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

async function simular() {
  const itens = await itensAbertos();
  const lev = montarLevantamento(itens);
  const ids = lev.consolidado.map((c) => c.artigoId);
  const { saldo, reservas, disponivel } = await disponivelEstoque(ids);
  const { atendidos, completos, sobra } = cruzarEstoque(itens, disponivel);
  const at = new Set(atendidos);
  // por artigo: demanda, saldo, reservado, disponível, atendido pelo estoque, a comprar (demanda dos itens não atendidos − sobra)
  const artigos = lev.consolidado.map((c) => {
    let atendido = 0, paraCompra = 0;
    for (const i of itens) { const q = necessidade(i)[c.artigoId] || 0; if (at.has(i.id)) atendido += q; else paraCompra += q; }
    const comprar = r3(Math.max(0, paraCompra - (sobra[c.artigoId] || 0)));
    return { ...c, saldo: r3(saldo[c.artigoId] || 0), reservado: r3(reservas[c.artigoId] || 0), disponivel: r3(disponivel[c.artigoId] || 0),
      atendido: r3(atendido), paraCompra: r3(paraCompra), sobra: r3(sobra[c.artigoId] || 0), comprar, comprarEmb: c.embalagem && comprar ? Math.ceil(comprar / c.embalagem) : null };
  });
  const peds = {};
  for (const i of itens) {
    const p = (peds[i.pedidoNumero] ||= { numero: i.pedidoNumero, cliente: i.cliente, entrega: i.entrega, itens: [] });
    p.itens.push({ id: i.id, chave: i.chave, descricao: i.descricao, quantidade: Number(i.quantidade), fppNumero: i.fppNumero, atendido: at.has(i.id), semDemanda: !Object.keys(necessidade(i)).length,
      demanda: (i.demanda || []).map((d) => ({ nome: d.nome, cor: d.cor, codigo: d.codigo, fornecedor: d.fornecedor, quantidade: d.quantidade, unidade: d.unidade, artigoId: d.equiparadoA || d.artigoId })) });
  }
  const pedidos = Object.values(peds).map((p) => {
    const n = p.itens.filter((x) => !x.semDemanda);
    const a = n.filter((x) => x.atendido).length;
    return { ...p, completo: completos.includes(p.numero), situacao: !n.length ? "SEM DEMANDA" : a === n.length ? "COMPLETO" : a ? "PARCIAL" : "COMPRA" };
  }).sort((a, b) => String(a.entrega ? new Date(a.entrega).toISOString() : "9").localeCompare(String(b.entrega ? new Date(b.entrega).toISOString() : "9")));
  return { pedidos, artigos, atendidos, itens };
}

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
