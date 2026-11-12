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
  if (String(motivo || "").trim().length < 5) return { error: "Justificativa obrigatória para excluir o pedido." };   // v553
  if (await prisma.pedidoExcluido.findUnique({ where: { numero: n } })) return { error: "Pedido já está na lixeira." };
  const pp = await prisma.pp.findUnique({ where: { numero: n }, select: { id: true, status: true } }).catch(() => null);
  const dispensaAntes = await prisma.compraDispensa.findUnique({ where: { pedidoNumero: n } }).catch(() => null);
  const filtroItens = { pedidoNumero: n, OR: [{ status: "LEVANTAMENTO" }, { status: "ESTOQUE", reservaLiberada: false }, { status: "REPROVADO" }] };
  const compraItens = await prisma.compraItem.findMany({ where: filtroItens }).catch(() => []);
  const { pvPdf, ppPdf, ...resto } = p;   // PDFs vão junto, mas separados (o JSON fica legível)
  await prisma.pedidoExcluido.create({ data: { numero: n, cliente: p.cliente, total: p.total, motivo: String(motivo || "").trim().slice(0, 500) || null, excluidoPorNome: quem || null,
    dados: JSON.parse(JSON.stringify({ pedido: resto, pvPdf, ppPdf, ppStatus: pp?.status || null, compraItens, dispensaAntes: !!dispensaAntes })) } });
  // v797 — contas a receber em aberto do pedido são canceladas (voltam ao restaurar)
  const tits = await prisma.finTitulo.findMany({ where: { chaveImport: { startsWith: `PED|${n}|` }, status: "ABERTO" }, select: { id: true } }).catch(() => []);
  if (tits.length) {
    await prisma.finTitulo.updateMany({ where: { id: { in: tits.map((t) => t.id) } }, data: { status: "CANCELADO", atualizadoPorNome: `${quem || "SISTEMA"} · PEDIDO NA LIXEIRA` } });
    await prisma.pedidoExcluido.update({ where: { numero: n }, data: { dados: { ...(JSON.parse(JSON.stringify({ pedido: resto, pvPdf, ppPdf, ppStatus: pp?.status || null, compraItens, dispensaAntes: !!dispensaAntes }))), titulos: tits.map((t) => t.id) } } });
  }
  await prisma.pedidoVenda.delete({ where: { id: p.id } });
  if (pp) await prisma.pp.update({ where: { id: pp.id }, data: { status: "EXCLUIDO" } }).catch(() => null);
  if (!dispensaAntes) await prisma.compraDispensa.create({ data: { pedidoNumero: n, motivo: "PEDIDO EXCLUÍDO (LIXEIRA)", porNome: quem || null } }).catch(() => null);
  if (compraItens.length) await prisma.compraItem.deleteMany({ where: { id: { in: compraItens.map((i) => i.id) } } });
  return { ok: true, numero: n, itensCompra: compraItens.length };
}

// v793 — pedido nunca some: rascunho com número (sem pedido de venda) também vai para a lixeira, com o status guardado
export async function excluirPpNumerado(ppId, { motivo, quem } = {}) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, select: { id: true, numero: true, status: true, clienteNome: true, valorTotal: true } });
  if (!pp?.numero) return { error: "Pedido sem número." };
  if (await prisma.pedidoVenda.findUnique({ where: { numero: pp.numero }, select: { id: true } })) return excluirPedido(pp.numero, { motivo, quem });
  if (await prisma.pedidoExcluido.findUnique({ where: { numero: pp.numero } })) return { error: "Pedido já está na lixeira." };
  await prisma.pedidoExcluido.create({ data: { numero: pp.numero, cliente: pp.clienteNome || null, total: pp.valorTotal ?? null,
    motivo: String(motivo || "").trim().slice(0, 500) || "RASCUNHO EXCLUÍDO", excluidoPorNome: quem || null, dados: { soPp: true, ppStatus: pp.status || "RASCUNHO" } } });
  await prisma.pp.update({ where: { id: pp.id }, data: { status: "EXCLUIDO" } });
  return { ok: true, numero: pp.numero, lixeira: true };
}

const DATAS = ["emissao", "despacho", "faturadoEm", "entregaPrevista", "cronoEm", "cronoPrazo", "cronoFimProgramado", "createdAt", "updatedAt"];
export async function restaurarPedido(numero, quem) {
  const x = await prisma.pedidoExcluido.findUnique({ where: { numero: String(numero) } });
  if (!x) return { error: "Pedido não está na lixeira." };
  if (await prisma.pedidoVenda.findUnique({ where: { numero: x.numero }, select: { id: true } })) return { error: "Já existe um pedido com esse número no sistema." };
  const d = x.dados || {};
  if (d.soPp) {   // v793 — rascunho: só volta o status do PP
    await prisma.pp.updateMany({ where: { numero: x.numero, status: "EXCLUIDO" }, data: { status: d.ppStatus || "RASCUNHO" } });
    await prisma.pedidoExcluido.delete({ where: { id: x.id } });
    return { ok: true, numero: x.numero };
  }
  const { id, updatedAt, ...ped } = d.pedido || {};
  for (const k of DATAS) if (ped[k]) ped[k] = new Date(ped[k]);
  await prisma.pedidoVenda.create({ data: { ...ped, ...(d.pvPdf ? { pvPdf: d.pvPdf } : {}), ...(d.ppPdf ? { ppPdf: d.ppPdf } : {}), atualizadoPorNome: quem || null } });
  if (d.ppStatus) await prisma.pp.updateMany({ where: { numero: x.numero, status: "EXCLUIDO" }, data: { status: d.ppStatus } }).catch(() => null);
  if (!d.dispensaAntes) await prisma.compraDispensa.deleteMany({ where: { pedidoNumero: x.numero, motivo: "PEDIDO EXCLUÍDO (LIXEIRA)" } }).catch(() => null);
  for (const it of d.compraItens || []) {
    const { id: _i, createdAt, updatedAt: _u, entrega, autorizadoEm, liberadoEm, ...r } = it;
    await prisma.compraItem.create({ data: { ...r, entrega: entrega ? new Date(entrega) : null, autorizadoEm: autorizadoEm ? new Date(autorizadoEm) : null, liberadoEm: liberadoEm ? new Date(liberadoEm) : null } }).catch(() => null);
  }
  if (Array.isArray(d.titulos) && d.titulos.length) await prisma.finTitulo.updateMany({ where: { id: { in: d.titulos }, status: "CANCELADO" }, data: { status: "ABERTO", atualizadoPorNome: quem || null } }).catch(() => null);   // v797
  await prisma.pedidoExcluido.delete({ where: { id: x.id } });
  return { ok: true, numero: x.numero };
}

export async function listarExcluidos() {
  const l = await prisma.pedidoExcluido.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, numero: true, cliente: true, total: true, motivo: true, excluidoPorNome: true, createdAt: true } });
  return l.map((x) => ({ ...x, total: x.total != null ? Number(x.total) : null }));
}
