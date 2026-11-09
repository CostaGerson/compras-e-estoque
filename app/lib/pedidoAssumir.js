// v730 — "Editar" de pedido que veio do KM: o pedido passa a ser do sistema (assumido).
// Monta (ou reaproveita) o lançamento (Pp) a partir do pedido de venda: cliente, OC, vendedor, prazo, itens com grade, preço,
// parâmetros e a FPP já ligada em Compras. Fica como efetivado; ao salvar no editor, o pedido de venda vira fonte SISTEMA
// e a sincronização do KM deixa de mexer nele. As contas a receber que vieram do KM continuam (não são refeitas).
import { prisma } from "@/lib/prisma";
import { itensDoPedido } from "@/lib/compras";

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const brData = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : null);

export async function assumirPedidoKm(numero, quem) {
  const pv = await prisma.pedidoVenda.findUnique({ where: { numero: String(numero) } });
  if (!pv) return { error: "Pedido não encontrado." };
  const ja = await prisma.pp.findUnique({ where: { numero: pv.numero }, include: { itens: { orderBy: { id: "asc" } } } });
  if (pv.fonte === "SISTEMA") {
    if (!ja) return { error: "Pedido do sistema sem lançamento." };
    return { ok: true, ppId: ja.id };
  }
  const emissao = iso(pv.emissao) || iso(pv.createdAt);
  const prazoDias = pv.despacho && emissao ? Math.max(0, Math.round((new Date(pv.despacho) - new Date(`${emissao}T00:00:00Z`)) / 86400e3)) : null;
  const itensPv = itensDoPedido(pv);
  const brutos = Array.isArray(pv.itens) ? pv.itens : [];
  const cis = await prisma.compraItem.findMany({ where: { pedidoNumero: pv.numero }, select: { chave: true, fppId: true, fppNumero: true, corFpp: true } });
  const fppDe = Object.fromEntries(cis.map((c) => [c.chave, c]));
  const cab = {
    clienteNome: pv.cliente, clienteCnpj: pv.cnpj || null, oc: pv.oc || null, vendedor: pv.vendedor || null, obs: pv.obs || null,
    emissao, prazoDias, prazoTipo: "CORRIDOS", prazoEntrega: prazoDias != null ? `${prazoDias} DIAS CORRIDOS` : null, dtDespacho: brData(iso(pv.despacho)),
    interno: !!pv.interno, tipoPedido: pv.tipoPedido === "SERVIÇO" ? "SERVIÇO" : pv.interno ? "INTERNO" : "VENDA NORMAL",
    condicaoPagamento: pv.condicao || null, valorTotal: pv.total, entregaModo: pv.entregaModo || "UNICA", entregas: pv.entregas || [],
    ...(pv.pagamento ? { pagamento: pv.pagamento } : {}),
    status: pv.status === "FATURADO" ? "FATURADO" : "LANCADO", efetivadoEm: ja?.efetivadoEm || pv.createdAt || new Date(), efetivadoPorNome: ja?.efetivadoPorNome || "KM",
    kmAssumidoEm: new Date(),
  };
  if (ja && (ja.itens || []).length) {
    // lançamento já existente (PDF do KM): mantém os itens e completa a FPP que está em Compras
    for (const [i, it] of ja.itens.entries()) {
      const c = fppDe[itensPv[i]?.chave];
      if (!it.fppId && c?.fppId) await prisma.ppItem.update({ where: { id: it.id }, data: { fppId: c.fppId, fppNumero: c.fppNumero ?? null } });
    }
    await prisma.pp.update({ where: { id: ja.id }, data: cab });
    return { ok: true, ppId: ja.id };
  }
  const itens = itensPv.map((it, i) => {
    const b = brutos[i] || {};
    const params = Object.fromEntries((Array.isArray(b.parametros) ? b.parametros : []).filter((x) => x && x.t).map((x) => [String(x.t).toUpperCase(), x.v]));
    const grade = (it.grade || []).filter((g) => g && g.tam).map((g) => ({ tam: g.tam, qtd: Number(g.qtd) || 0 }));
    const c = fppDe[it.chave];
    return { tipoPecaNome: b.tipoPeca || null, codigo: it.codigo || null, descricao: it.descricao || null,
      quantidade: it.qtd, valorUnitario: it.preco || null, valorTotal: it.preco ? Math.round(it.qtd * it.preco * 100) / 100 : null,
      gradeJson: JSON.stringify(grade.length ? grade : [{ tam: "UN", qtd: it.qtd }]), parametrosJson: JSON.stringify(params),
      fppId: c?.fppId || it.fppId || null, fppNumero: c?.fppNumero ?? null };
  });
  const pp = ja ? await prisma.pp.update({ where: { id: ja.id }, data: { ...cab, itens: { create: itens } } })
    : await prisma.pp.create({ data: { numero: pv.numero, ...cab, itens: { create: itens } } });
  return { ok: true, ppId: pp.id, quem };
}
