export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const dec = (v) => (v === "" || v === null || v === undefined ? null : v);

export async function GET() {
  const artigos = await prisma.artigo.findMany({
    where: { ativo: true },
    include: { fornecedor: true, nf: { select: { id: true, numero: true, temPdf: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(artigos);
}

export async function POST(req) {
  const b = await req.json();
  if (!b.nome || !b.nome.trim())
    return Response.json({ error: "Nome do artigo é obrigatório" }, { status: 400 });
  const artigo = await prisma.artigo.create({
    data: {
      categoria: b.categoria || "MALHA",
      fornecedorId: b.fornecedorId ? Number(b.fornecedorId) : null,
      nome: b.nome.trim(),
      artigoInterno: b.artigoInterno || null,
      cor: b.cor || null,
      tipoMalha: b.tipoMalha || null,
      composicao: b.composicao || null,
      largura: dec(b.largura),
      rendimento: dec(b.rendimento),
      gramatura: dec(b.gramatura),
      especificacao: b.especificacao || null,
      unidade: b.unidade || "M",
      valorUnitario: dec(b.valorUnitario),
      dataCompra: b.dataCompra ? new Date(b.dataCompra) : null,
    },
    include: { fornecedor: true, nf: { select: { id: true, numero: true, temPdf: true } } },
  });
  return Response.json(artigo, { status: 201 });
}