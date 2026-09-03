import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const f = await prisma.fpp.findUnique({ where: { id: Number(params.id) } });
  if (!f) return NextResponse.json({ error: "Ficha não encontrada." }, { status: 404 });
  return NextResponse.json(f);
}

export async function DELETE(_req, { params }) {
  await prisma.fpp.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}

// PATCH: atualiza uma ficha existente (edição)
export async function PATCH(req, { params }) {
  const b = await req.json();
  const data = {};
  if (b.item != null) data.item = String(b.item).toUpperCase();
  if (b.nomeComercial !== undefined) data.nomeComercial = b.nomeComercial ? String(b.nomeComercial).toUpperCase() : null;
  if (b.tipo != null) data.tipo = b.tipo === "PLANO" ? "PLANO" : "MALHA";
  if (b.clienteId !== undefined) data.clienteId = b.clienteId != null ? Number(b.clienteId) : null;
  if (b.clienteNome !== undefined) data.clienteNome = b.clienteNome || null;
  if (b.negociacao !== undefined) data.negociacao = b.negociacao ? String(b.negociacao).toUpperCase() : null;
  if (b.qtde !== undefined) data.qtde = b.qtde != null ? Number(b.qtde) : null;
  if (b.condicaoPagamento !== undefined) data.condicaoPagamento = b.condicaoPagamento || null;
  if (b.leadTime !== undefined) data.leadTime = b.leadTime != null ? Number(b.leadTime) : null;
  if (b.entradas !== undefined) data.entradas = b.entradas || {};
  if (b.overrides !== undefined) data.overrides = b.overrides || null;
  if (b.resultados !== undefined) data.resultados = b.resultados || {};
  if (b.custoProducao !== undefined) data.custoProducao = b.custoProducao != null ? Number(b.custoProducao) : null;
  if (b.custoFinal !== undefined) data.custoFinal = b.custoFinal != null ? Number(b.custoFinal) : null;
  if (b.valorProposto !== undefined) data.valorProposto = b.valorProposto != null ? Number(b.valorProposto) : null;
  if (b.margem !== undefined) data.margem = b.margem != null ? Number(b.margem) : null;
  if (b.totalItem !== undefined) data.totalItem = b.totalItem != null ? Number(b.totalItem) : null;
  const f = await prisma.fpp.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json(f);
}
