export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
const up = (v) => (v ? String(v).toUpperCase() : null);

export async function GET() {
  const artigos = await prisma.artigo.findMany({
    where: { ativo: true },
    include: {
      fornecedor: true,
      nf: { select: { id: true, numero: true, temPdf: true, temXml: true } },
      movimentacoes: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { id: true, tipo: true, quantidade: true, createdAt: true, perfil: true,
          nf: { select: { id: true, numero: true, temPdf: true, temXml: true } },
          fme: { select: { id: true, numero: true } } },
      },
    },
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
      nome: up(b.nome.trim()),
      artigoInterno: up(b.artigoInterno),
      codigo: up(b.codigo),
      cor: up(b.cor),
      tipoMalha: b.tipoMalha || null,
      composicao: up(b.composicao),
      largura: dec(b.largura),
      rendimento: dec(b.rendimento),
      gramatura: dec(b.gramatura),
      especificacao: up(b.especificacao),
      unidade: b.unidade || "M",
      valorUnitario: dec(b.valorUnitario),
      quantidade: dec(b.quantidade),
      dataCompra: b.dataCompra ? new Date(b.dataCompra) : null,
    },
    include: { fornecedor: true, nf: { select: { id: true, numero: true, temPdf: true, temXml: true } } },
  });
  return Response.json(artigo, { status: 201 });
}