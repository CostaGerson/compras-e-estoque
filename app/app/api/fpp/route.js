import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { garantirNumeros, criarComNumero, registrarNegociacao } from "../../../lib/fppNumero";
import { sincronizarArtigosFpp } from "../../../lib/compras";

export const dynamic = "force-dynamic";

// GET: lista de fichas salvas
export async function GET() {
  await garantirNumeros();
  const lista = await prisma.fpp.findMany({ orderBy: { createdAt: "desc" }, take: 2000 });
  return NextResponse.json(lista);
}

// POST: salva uma ficha de precificação
export async function POST(req) {
  const b = await req.json();
  if (!b.item) return NextResponse.json({ error: "Informe o ITEM da ficha." }, { status: 400 });
  const f = await criarComNumero({
      tipo: ["PLANO", "REVENDA"].includes(b.tipo) ? b.tipo : "MALHA",   // v512 — revenda
      item: String(b.item).toUpperCase(),
      nomeComercial: b.nomeComercial ? String(b.nomeComercial).toUpperCase() : null,
      condicaoPagamento: b.condicaoPagamento || null,
      leadTime: b.leadTime != null ? Number(b.leadTime) : null,
      clienteId: b.clienteId != null ? Number(b.clienteId) : null,
      clienteNome: b.clienteNome || null,
      negociacao: b.negociacao ? String(b.negociacao).toUpperCase() : null,
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
  });
  await registrarNegociacao(f.negociacao);
  // v404 — artigos detalhados na ficha entram no cadastro (origem FPP)
  try { if (await sincronizarArtigosFpp(f)) return NextResponse.json(await prisma.fpp.findUnique({ where: { id: f.id } })); } catch (e) { console.error("artigos da FPP", e); }
  return NextResponse.json(f);
}
