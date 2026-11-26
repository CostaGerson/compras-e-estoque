// v1131 — contas a pagar ligadas a pedidos: a despesa é dividida entre um ou mais pedidos (FinTituloPedido)
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// valida a lista [{ numero|pedidoNumero, valor, manual }] contra o valor da conta
export function validarPedidos(lista, total) {
  if (!Array.isArray(lista)) return { erro: null, itens: null };
  const itens = [];
  for (const x of lista) {
    const numero = String(x?.numero ?? x?.pedidoNumero ?? "").trim();
    if (!numero) continue;
    if (itens.some((y) => y.numero === numero)) return { erro: `O pedido ${numero} está repetido na divisão da despesa.` };
    const valor = r2(x.valor);
    if (!(valor > 0)) return { erro: `Informe o valor da despesa do pedido ${numero}.` };
    itens.push({ numero, valor, manual: !!x.manual });
  }
  if (itens.length) {
    const soma = r2(itens.reduce((s, x) => s + x.valor, 0));
    if (Math.abs(soma - r2(total)) > 0.01) return { erro: `A divisão entre os pedidos soma ${soma.toFixed(2).replace(".", ",")}, mas a conta é de ${r2(total).toFixed(2).replace(".", ",")}.` };
  }
  return { erro: null, itens };
}

export async function conferirPedidosExistem(itens) {
  if (!itens?.length) return null;
  const achados = await prisma.pedidoVenda.findMany({ where: { numero: { in: itens.map((x) => x.numero) } }, select: { numero: true } });
  const falta = itens.filter((x) => !achados.some((a) => a.numero === x.numero)).map((x) => x.numero);
  return falta.length ? `Pedido não encontrado: ${falta.join(", ")}.` : null;
}

export async function gravarPedidosTitulo(tituloId, itens, quem) {
  await prisma.finTituloPedido.deleteMany({ where: { tituloId } });
  if (itens?.length) await prisma.finTituloPedido.createMany({ data: itens.map((x) => ({ tituloId, pedidoNumero: x.numero, valor: x.valor, manual: x.manual, criadoPorNome: quem || null })) });
}

// valor da conta mudou sem nova divisão: as partes acompanham na mesma proporção (o centavo que sobra vai na última)
export async function reescalarPedidosTitulo(tituloId, novoTotal) {
  const l = await prisma.finTituloPedido.findMany({ where: { tituloId }, orderBy: { id: "asc" } });
  if (!l.length) return;
  const antes = l.reduce((s, x) => s + Number(x.valor), 0);
  if (!(antes > 0) || Math.abs(antes - novoTotal) < 0.005) return;
  let acc = 0;
  for (let i = 0; i < l.length; i++) {
    const v = i === l.length - 1 ? r2(novoTotal - acc) : r2((Number(l[i].valor) / antes) * novoTotal);
    acc = r2(acc + v);
    await prisma.finTituloPedido.update({ where: { id: l[i].id }, data: { valor: v } });
  }
}

export async function pedidosDoTitulo(tituloId) {
  const l = await prisma.finTituloPedido.findMany({ where: { tituloId: Number(tituloId) }, orderBy: { id: "asc" } });
  const ps = l.length ? await prisma.pedidoVenda.findMany({ where: { numero: { in: l.map((x) => x.pedidoNumero) } }, select: { numero: true, cliente: true, total: true, status: true } }) : [];
  return l.map((x) => { const p = ps.find((y) => y.numero === x.pedidoNumero); return { numero: x.pedidoNumero, valor: r2(x.valor), manual: x.manual, cliente: p?.cliente || null, total: p ? r2(p.total) : null, status: p?.status || null }; });
}

// busca para o seletor: número ou cliente; sem texto, os pedidos mais recentes (cancelados ficam fora)
export async function buscarPedidos(q) {
  const t = String(q || "").trim();
  const where = { status: { not: "CANCELADO" }, ...(t ? { OR: [{ numero: { contains: t } }, { cliente: { contains: t, mode: "insensitive" } }] } : {}) };
  const l = await prisma.pedidoVenda.findMany({ where, select: { numero: true, cliente: true, total: true, status: true, emissao: true }, orderBy: [{ emissao: { sort: "desc", nulls: "last" } }, { id: "desc" }], take: 25 });
  return l.map((p) => ({ numero: p.numero, cliente: p.cliente, total: r2(p.total), status: p.status, emissao: p.emissao ? p.emissao.toISOString().slice(0, 10) : null }));
}

// financeiro do pedido: as contas a pagar (ou a parte delas) lançadas para este pedido
export async function despesasDoPedido(numero) {
  const l = await prisma.finTituloPedido.findMany({ where: { pedidoNumero: String(numero) }, include: { titulo: { select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, dataPagamento: true, numeroDoc: true } } }, orderBy: { id: "asc" } });
  const outros = l.length ? await prisma.finTituloPedido.groupBy({ by: ["tituloId"], where: { tituloId: { in: l.map((x) => x.tituloId) } }, _count: { _all: true } }) : [];
  const itens = l.filter((x) => x.titulo && x.titulo.status !== "CANCELADO").map((x) => ({
    tituloId: x.tituloId, titulo: x.titulo.titulo, parceiro: x.titulo.parceiro, numeroDoc: x.titulo.numeroDoc || null,
    valor: r2(x.valor), valorConta: r2(x.titulo.valor), dividida: (outros.find((o) => o.tituloId === x.tituloId)?._count?._all || 1) > 1,
    vencimento: x.titulo.vencimento.toISOString().slice(0, 10), status: x.titulo.status, dataPagamento: x.titulo.dataPagamento ? x.titulo.dataPagamento.toISOString().slice(0, 10) : null,
  })).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return { itens, total: r2(itens.reduce((s, x) => s + x.valor, 0)), pago: r2(itens.filter((x) => x.status === "PAGO").reduce((s, x) => s + x.valor, 0)), emAberto: r2(itens.filter((x) => x.status === "ABERTO").reduce((s, x) => s + x.valor, 0)) };
}
