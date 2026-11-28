export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { checarEstoqueMinimo } from "@/lib/estoqueMinimo";

const bool = (v) => v === true || v === "true" || v === 1;

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
const up = (v) => (v ? String(v).toUpperCase() : null);

// v851 — ?estoque=1: só o que entrou no estoque por NF ou por lançamento manual. Artigo que nasceu da FPP (origem "FPP")
//   só aparece depois de ter NF, movimentação ou saldo. Sem o parâmetro (compras, FME, banco de dados): todos.
export async function GET(req) {
  const soEstoque = new URL(req.url).searchParams.get("estoque") === "1";
  const artigos = await prisma.artigo.findMany({
    where: { ativo: true, ...(soEstoque ? { OR: [{ origem: null }, { origem: { not: "FPP" } }, { nfId: { not: null } }, { nfItens: { some: {} } }, { movimentacoes: { some: {} } }, { saldos: { some: {} } }] } : {}) },
    include: {
      fornecedor: true,
      nf: { select: { id: true, numero: true, temPdf: true, temXml: true } },
      movimentacoes: {
        where: { excluidoEm: null }, orderBy: { createdAt: "desc" }, take: 1,
        select: { id: true, tipo: true, quantidade: true, createdAt: true, perfil: true,
          nf: { select: { id: true, numero: true, temPdf: true, temXml: true } },
          fme: { select: { id: true, numero: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  // v404 — nº da FPP de origem (artigo cadastrado pelo detalhe da ficha)
  const ids = [...new Set(artigos.map((a) => a.origemFppId).filter(Boolean))];
  if (ids.length) {
    const nums = Object.fromEntries((await prisma.fpp.findMany({ where: { id: { in: ids } }, select: { id: true, numero: true } })).map((f) => [f.id, f.numero]));
    for (const a of artigos) if (a.origemFppId) a.origemFppNumero = nums[a.origemFppId] ?? null;
  }
  // v1199 — quantos volumes (etiquetas) formam o saldo
  if (soEstoque) { try { const { volumesPorArtigo } = await import("@/lib/estoqueManual"); const vp = await volumesPorArtigo(); for (const a of artigos) a.volumes = vp[a.id] || 0; } catch {} }
  return Response.json(artigos);
}

export async function POST(req) {
  const b = await req.json();
  if (!b.nome || !b.nome.trim())
    return Response.json({ error: "Nome do artigo é obrigatório" }, { status: 400 });
  // v1143 — cadastro manual: nome no padrão do catálogo (sem fornecedor e cor dentro do nome)
  const { nomePadrao } = await import("@/lib/artigoPadrao");
  const fo = b.fornecedorId ? await prisma.fornecedor.findUnique({ where: { id: Number(b.fornecedorId) }, select: { nome: true, nomeFantasia: true } }).catch(() => null) : null;
  const artigo = await prisma.artigo.create({
    data: {
      categoria: b.categoria || "MALHA",
      fornecedorId: b.fornecedorId ? Number(b.fornecedorId) : null,
      nome: nomePadrao(b.nome, { fornecedor: fo?.nome || fo?.nomeFantasia, cor: b.cor }),
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
      estoqueMinimoAtivo: bool(b.estoqueMinimoAtivo),
      estoqueMinimo: bool(b.estoqueMinimoAtivo) ? dec(b.estoqueMinimo) : null,
    },
    include: { fornecedor: true, nf: { select: { id: true, numero: true, temPdf: true, temXml: true } } },
  });
  await checarEstoqueMinimo(prisma, artigo.id, b.usuarioId).catch(() => {});
  return Response.json(artigo, { status: 201 });
}