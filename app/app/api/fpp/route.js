import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

// GET: lista de fichas salvas
export async function GET() {
  const lista = await prisma.fpp.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(lista);
}

// POST: salva uma ficha de precificação
export async function POST(req) {
  const b = await req.json();
  if (!b.item) return NextResponse.json({ error: "Informe o ITEM da ficha." }, { status: 400 });
  const f = await prisma.fpp.create({
    data: {
      tipo: b.tipo === "PLANO" ? "PLANO" : "MALHA",
      item: String(b.item).toUpperCase(),
      nomeComercial: b.nomeComercial ? String(b.nomeComercial).toUpperCase() : null,
      condicaoPagamento: b.condicaoPagamento || null,
      leadTime: b.leadTime != null ? Number(b.leadTime) : null,
      clienteId: b.clienteId != null ? Number(b.clienteId) : null,
      clienteNome: b.clienteNome || null,
      qtde: b.qtde != null ? Number(b.qtde) : null,
      entradas: b.entradas || {},
      overrides: b.overrides || null,
      resultados: b.resultados || {},
      custoProducao: b.custoProducao != null ? Number(b.custoProducao) : null,
      custoFinal: b.custoFinal != null ? Number(b.custoFinal) : null,
      valorProposto: b.valorProposto != null ? Number(b.valorProposto) : null,
      margem: b.margem != null ? Number(b.margem) : null,
      totalItem: b.totalItem != null ? Number(b.totalItem) : null,
      criadoPorId: b.criadoPorId != null ? Number(b.criadoPorId) : null,
      criadoPorNome: b.criadoPorNome || null,
    },
  });
  return NextResponse.json(f);
}
