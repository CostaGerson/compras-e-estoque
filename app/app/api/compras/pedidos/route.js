// v404 — Compras › Pedidos: pedidos do KM em andamento, desmembrados em itens, com a FPP base (ou sugestões)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { itensDoPedido, sugerirFpps, demandaDoItem, faseCompraPcp } from "@/lib/compras";

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export async function GET() {
  const pedidos = await prisma.pedidoVenda.findMany({
    where: { status: "ANDAMENTO" },
    select: { id: true, numero: true, cliente: true, cnpj: true, emissao: true, despacho: true, itens: true, interno: true, cronoSituacao: true, cronoItens: true, cronoPrazo: true, vendedor: true, total: true },
    orderBy: [{ despacho: "asc" }, { numero: "asc" }],
  });
  const numeros = pedidos.map((p) => p.numero);
  const [vinc, fpps, clientes] = await Promise.all([
    prisma.compraItem.findMany({ where: { pedidoNumero: { in: numeros } } }),
    prisma.fpp.findMany({ select: { id: true, numero: true, item: true, nomeComercial: true, clienteId: true, clienteNome: true, negociacao: true, valorProposto: true, createdAt: true } }),
    prisma.cliente.findMany({ select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true } }),
  ]);
  const porChave = Object.fromEntries(vinc.map((v) => [`${v.pedidoNumero}|${v.chave}`, v]));
  const fppPorId = Object.fromEntries(fpps.map((f) => [f.id, f]));
  const out = [];
  let emProducao = 0;
  for (const p of pedidos) {
    // v417 — só os pedidos em levantamento/compras no PCP (ou ainda fora dele); programado/produção/concluído já tem MP comprada
    const fase = faseCompraPcp(p);
    if (fase === "PRODUCAO") { emProducao++; continue; }
    const itens = itensDoPedido(p);
    const chaves = new Set(itens.map((i) => i.chave));
    // item que saiu do pedido no KM e ainda estava só no levantamento: some do levantamento
    for (const v of vinc.filter((v) => v.pedidoNumero === p.numero && !chaves.has(v.chave) && v.status === "LEVANTAMENTO"))
      await prisma.compraItem.delete({ where: { id: v.id } }).catch(() => {});
    const lst = [];
    for (const it of itens) {
      let v = porChave[`${p.numero}|${it.chave}`];
      // quantidade mudou no KM: refaz a demanda enquanto está no levantamento
      if (v && v.status === "LEVANTAMENTO" && Number(v.quantidade) !== it.qtd && v.fppId) {
        const fpp = await prisma.fpp.findUnique({ where: { id: v.fppId } });
        if (fpp) {
          const demanda = await demandaDoItem(fpp, it.qtd);
          v = await prisma.compraItem.update({ where: { id: v.id }, data: { quantidade: it.qtd, valorUnitario: it.preco, descricao: it.descricao,
            demanda: demanda.map((d) => ({ ...d, equiparadoA: (v.demanda || []).find((x) => x.artigoId === d.artigoId)?.equiparadoA || null })) } });
        }
      }
      lst.push({ ...it, vinculo: v ? { id: v.id, fppId: v.fppId, fppNumero: v.fppNumero, status: v.status, demanda: v.demanda,
          fpp: v.fppId && fppPorId[v.fppId] ? { nomeComercial: fppPorId[v.fppId].nomeComercial, item: fppPorId[v.fppId].item, valorProposto: fppPorId[v.fppId].valorProposto } : null } : null,
        sugestoes: v ? [] : sugerirFpps(it, p, fpps, clientes) });
    }
    out.push({ id: p.id, numero: p.numero, cliente: p.cliente, cnpj: p.cnpj, emissao: iso(p.emissao), entrega: iso(p.despacho), interno: p.interno,
      situacaoPcp: p.cronoSituacao, fasePcp: fase, vendedor: p.vendedor, itens: lst,
      comFpp: lst.filter((i) => i.vinculo).length, total: lst.length });
  }
  return Response.json({ pedidos: out, emProducao });
}
