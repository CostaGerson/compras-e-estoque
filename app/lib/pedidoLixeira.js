// v552 — excluir pedido: vai para a lixeira (PedidoExcluido) e deixa de influenciar o sistema.
// Sai de PedidoVenda (produção, faturamento, previsões, cronograma); o PP fica EXCLUIDO; compras dispensadas e itens
// do levantamento removidos; o sync do KM e os relatórios de vendas não recriam o pedido. Restaurar desfaz tudo.
import { prisma } from "@/lib/prisma";

export async function numerosExcluidos() {
  return new Set((await prisma.pedidoExcluido.findMany({ select: { numero: true } }).catch(() => [])).map((x) => x.numero));
}

export async function excluirPedido(numero, { motivo, quem } = {}) {
  const n = String(numero || "").trim();
  const p = await prisma.pedidoVenda.findUnique({ where: { numero: n } });
  if (!p) return { error: "Pedido não encontrado." };
  if (await prisma.pedidoExcluido.findUnique({ where: { numero: n } })) return { error: "Pedido já está na lixeira." };
  const pp = await prisma.pp.findUnique({ where: { numero: n }, select: { id: true, status: true } }).catch(() => null);
  const dispensaAntes = await prisma.compraDispensa.findUnique({ where: { pedidoNumero: n } }).catch(() => null);
  const filtroItens = { pedidoNumero: n, OR: [{ status: "LEVANTAMENTO" }, { status: "ESTOQUE", reservaLiberada: false }, { status: "REPROVADO" }] };
  const compraItens = await prisma.compraItem.findMany({ where: filtroItens }).catch(() => []);
  const { pvPdf, ppPdf, ...resto } = p;   // PDFs vão junto, mas separados (o JSON fica legível)
  await prisma.pedidoExcluido.create({ data: { numero: n, cliente: p.cliente, total: p.total, motivo: String(motivo || "").trim().slice(0, 500) || null, excluidoPorNome: quem || null,
    dados: JSON.parse(JSON.stringify({ pedido: resto, pvPdf, ppPdf, ppStatus: pp?.status || null, compraItens, dispensaAntes: !!dispensaAntes })) } });
  await prisma.pedidoVenda.delete({ where: { id: p.id } });
  if (pp) await prisma.pp.update({ where: { id: pp.id }, data: { status: "EXCLUIDO" } }).catch(() => null);
  if (!dispensaAntes) await prisma.compraDispensa.create({ data: { pedidoNumero: n, motivo: "PEDIDO EXCLUÍDO (LIXEIRA)", porNome: quem || null } }).catch(() => null);
  if (compraItens.length) await prisma.compraItem.deleteMany({ where: { id: { in: compraItens.map((i) => i.id) } } });
  return { ok: true, numero: n, itensCompra: compraItens.length };
}

const DATAS = ["emissao", "despacho", "faturadoEm", "entregaPrevista", "cronoEm", "cronoPrazo", "cronoFimProgramado", "createdAt", "updatedAt"];
export async function restaurarPedido(numero, quem) {
  const x = await prisma.pedidoExcluido.findUnique({ where: { numero: String(numero) } });
  if (!x) return { error: "Pedido não está na lixeira." };
  if (await prisma.pedidoVenda.findUnique({ where: { numero: x.numero }, select: { id: true } })) return { error: "Já existe um pedido com esse número no sistema." };
  const d = x.dados || {};
  const { id, updatedAt, ...ped } = d.pedido || {};
  for (const k of DATAS) if (ped[k]) ped[k] = new Date(ped[k]);
  await prisma.pedidoVenda.create({ data: { ...ped, ...(d.pvPdf ? { pvPdf: d.pvPdf } : {}), ...(d.ppPdf ? { ppPdf: d.ppPdf } : {}), atualizadoPorNome: quem || null } });
  if (d.ppStatus) await prisma.pp.updateMany({ where: { numero: x.numero, status: "EXCLUIDO" }, data: { status: d.ppStatus } }).catch(() => null);
  if (!d.dispensaAntes) await prisma.compraDispensa.deleteMany({ where: { pedidoNumero: x.numero, motivo: "PEDIDO EXCLUÍDO (LIXEIRA)" } }).catch(() => null);
  for (const it of d.compraItens || []) {
    const { id: _i, createdAt, updatedAt: _u, entrega, autorizadoEm, liberadoEm, ...r } = it;
    await prisma.compraItem.create({ data: { ...r, entrega: entrega ? new Date(entrega) : null, autorizadoEm: autorizadoEm ? new Date(autorizadoEm) : null, liberadoEm: liberadoEm ? new Date(liberadoEm) : null } }).catch(() => null);
  }
  await prisma.pedidoExcluido.delete({ where: { id: x.id } });
  return { ok: true, numero: x.numero };
}

export async function listarExcluidos() {
  const l = await prisma.pedidoExcluido.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, numero: true, cliente: true, total: true, motivo: true, excluidoPorNome: true, createdAt: true } });
  return l.map((x) => ({ ...x, total: x.total != null ? Number(x.total) : null }));
}
