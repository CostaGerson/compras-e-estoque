// v404 — Compras › Pedidos: pedidos do KM em andamento, desmembrados em itens, com a FPP base (ou sugestões)
export const dynamic = "force-dynamic";
import { ehRevenda } from "@/lib/fppAv";   // v523
import { prisma } from "@/lib/prisma";
import { itensDoPedido, sugerirFpps, demandaDoItem, faseCompraPcp, faseItemPcp } from "@/lib/compras";

// v419 — dispensar compras (pedido só para faturamento): POST { pedidoNumero, motivo, quem } · DELETE { pedidoNumero } reativa
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const n = String(b.pedidoNumero || "").trim();
  if (!n) return Response.json({ error: "Pedido?" }, { status: 400 });
  await prisma.compraDispensa.upsert({ where: { pedidoNumero: n }, create: { pedidoNumero: n, motivo: b.motivo || null, porNome: b.quem || null }, update: { motivo: b.motivo || null, porNome: b.quem || null } });
  await prisma.compraItem.deleteMany({ where: { pedidoNumero: n, OR: [{ status: "LEVANTAMENTO" }, { status: "ESTOQUE", reservaLiberada: false }] } });
  return Response.json({ ok: true });
}
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  await prisma.compraDispensa.deleteMany({ where: { pedidoNumero: String(b.pedidoNumero || "") } });
  return Response.json({ ok: true });
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
// v612 — FPP indexada no lançamento do pedido vem primeiro, marcada para confirmar
function comIndicada(it, sug, fppPorId) {
  const id = Number(it.fppId) || null, f = id && fppPorId[id];
  if (!f) return sug;
  return [{ id: f.id, numero: f.numero, item: f.item, nomeComercial: f.nomeComercial, valorProposto: f.valorProposto, score: 100, nome: 100, valor: 100, indicada: true }, ...sug.filter((s) => s.id !== f.id)];
}

export async function GET() {
  const pedidos = await prisma.pedidoVenda.findMany({
    where: { status: "ANDAMENTO" },
    select: { id: true, numero: true, cliente: true, cnpj: true, emissao: true, despacho: true, itens: true, interno: true, cronoSituacao: true, cronoItens: true, cronoCompras: true, cronoPrazo: true, vendedor: true, total: true, fonte: true, tipoPedido: true },
    orderBy: [{ despacho: "asc" }, { numero: "asc" }],
  });
  const numeros = pedidos.map((p) => p.numero);
  const [vinc, fpps, clientes] = await Promise.all([
    prisma.compraItem.findMany({ where: { pedidoNumero: { in: numeros } } }),
    prisma.fpp.findMany({ select: { id: true, updatedAt: true, numero: true, item: true, nomeComercial: true, clienteId: true, clienteNome: true, negociacao: true, valorProposto: true, createdAt: true } }),
    prisma.cliente.findMany({ select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true } }),
  ]);
  const porChave = Object.fromEntries(vinc.map((v) => [`${v.pedidoNumero}|${v.chave}`, v]));
  const fppPorId = Object.fromEntries(fpps.map((f) => [f.id, f]));
  const out = [];
  let emProducao = 0;
  const disp = Object.fromEntries((await prisma.compraDispensa.findMany()).map((x) => [x.pedidoNumero, x]));   // v419
  const dispensados = [];
  for (const p of pedidos) {
    if (disp[p.numero]) { dispensados.push({ numero: p.numero, cliente: p.cliente, entrega: iso(p.despacho), total: p.total, motivo: disp[p.numero].motivo, porNome: disp[p.numero].porNome, em: disp[p.numero].createdAt }); continue; }
    // v417 — só os pedidos em levantamento/compras no PCP (ou ainda fora dele); programado/produção/concluído já tem MP comprada
    // v612 — pedido lançado no sistema: entra aqui ao ser lançado e fica até os itens serem liberados para programação
    //        (aí o PCP do Maycon lê e recebe em A PROGRAMAR). Não depende de estar no cronograma.
    const proprio = p.fonte === "SISTEMA";
    if (proprio && p.tipoPedido === "SERVIÇO") continue;   // v614 — pedido de serviço não tem matéria-prima
    const fase = proprio ? "COMPRAS" : faseCompraPcp(p);
    if (fase === "PRODUCAO") { emProducao++; continue; }
    let itensFora = 0;   // v418 — itens do pedido já programados/em produção no PCP
    const itens = itensDoPedido(p);
    const chaves = new Set(itens.map((i) => i.chave));
    // item que saiu do pedido no KM e ainda estava só no levantamento: some do levantamento
    for (const v of vinc.filter((v) => v.pedidoNumero === p.numero && !chaves.has(v.chave) && v.status === "LEVANTAMENTO"))
      await prisma.compraItem.delete({ where: { id: v.id } }).catch(() => {});
    const lst = [];
    for (const it of itens) {
      let v = porChave[`${p.numero}|${it.chave}`];
      const fi = proprio ? { fase: v?.liberadoEm ? "PRODUCAO" : "COMPRAS", coluna: null } : faseItemPcp(p, it.chave);
      if (fi.fase === "PRODUCAO") { itensFora++; continue; }
      // quantidade mudou no KM: refaz a demanda enquanto está no levantamento
      // v523 — FPP de produto revenda com demanda vazia (antes da v523): refaz uma vez
      const revVazia = v && v.fppId && !(v.demanda || []).length && ehRevenda(fppPorId[v.fppId]?.item, fppPorId[v.fppId]?.tipo);
      // v525 — FPP alterada depois da última demanda: refaz (fornecedor, cor, código, consumo…)
      const fppMudou = v && v.fppId && fppPorId[v.fppId]?.updatedAt && new Date(fppPorId[v.fppId].updatedAt) > new Date(v.updatedAt);
      if (v && v.status === "LEVANTAMENTO" && (Number(v.quantidade) !== it.qtd || revVazia || fppMudou) && v.fppId) {
        const fpp = await prisma.fpp.findUnique({ where: { id: v.fppId } });
        if (fpp) {
          const demanda = await demandaDoItem(fpp, it.qtd);
          v = await prisma.compraItem.update({ where: { id: v.id }, data: { quantidade: it.qtd, valorUnitario: it.preco, descricao: it.descricao,
            demanda: demanda.map((d) => ({ ...d, equiparadoA: (v.demanda || []).find((x) => x.artigoId === d.artigoId)?.equiparadoA || null })) } });
        }
      }
      lst.push({ ...it, colunaPcp: fi.coluna, vinculo: v ? { id: v.id, fppId: v.fppId, fppNumero: v.fppNumero, status: v.status, demanda: v.demanda,
          fpp: v.fppId && fppPorId[v.fppId] ? { nomeComercial: fppPorId[v.fppId].nomeComercial, item: fppPorId[v.fppId].item, valorProposto: fppPorId[v.fppId].valorProposto } : null } : null,
        sugestoes: v ? [] : comIndicada(it, sugerirFpps(it, p, fpps, clientes), fppPorId) });
    }
    if (proprio && !lst.length) { emProducao++; continue; }   // tudo liberado: está com o PCP
    out.push({ id: p.id, numero: p.numero, proprio, cliente: p.cliente, cnpj: p.cnpj, emissao: iso(p.emissao), entrega: iso(p.despacho), interno: p.interno,
      situacaoPcp: p.cronoSituacao, fasePcp: fase, itensFora, vendedor: p.vendedor, itens: lst,
      comFpp: lst.filter((i) => i.vinculo).length, total: lst.length });
  }
  return Response.json({ pedidos: out, emProducao, dispensados });
}
