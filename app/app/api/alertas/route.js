export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// setores que enxergam TODOS os alertas de produto incompleto
const SETORES_ALERTA = ["FINANCEIRO", "COMPRAS", "ESTOQUE"];

// devolve os campos obrigatórios que estão faltando no artigo (vazio = completo)
function faltando(a) {
  const vazio = (v) => v === null || v === undefined || String(v).trim() === "";
  const falta = [];
  if (vazio(a.fornecedor?.nome)) falta.push("Fornecedor (nome comercial)");
  if (vazio(a.artigoInterno)) falta.push("Artigo interno");
  if (vazio(a.codigo)) falta.push("Código");
  if (vazio(a.cor)) falta.push("Cor");
  if (a.categoria === "MALHA") {
    if (vazio(a.composicao)) falta.push("Composição");
    if (vazio(a.largura)) falta.push("Largura");
    if (vazio(a.rendimento)) falta.push("Rendimento");
  } else if (a.categoria === "TECIDO") {
    if (vazio(a.composicao)) falta.push("Composição");
    if (vazio(a.largura)) falta.push("Largura");
    if (vazio(a.gramatura)) falta.push("Gramatura");
  } else if (a.categoria === "AVIAMENTO" || a.categoria === "OUTROS") {
    if (vazio(a.especificacao)) falta.push("Especificação");
  }
  return falta;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const usuarioId = searchParams.get("usuarioId") ? Number(searchParams.get("usuarioId")) : null;
  const setor = searchParams.get("setor") || "";
  const veTudo = SETORES_ALERTA.includes(setor);

  const artigos = await prisma.artigo.findMany({
    where: { ativo: true },
    include: { fornecedor: { select: { nome: true } }, nf: { select: { numero: true } } },
    orderBy: { createdAt: "desc" },
  });

  const alertas = [];
  for (const a of artigos) {
    const falta = faltando(a);
    if (!falta.length) continue;
    // visível se o setor vê tudo, ou se o próprio usuário cadastrou
    if (!veTudo && !(usuarioId && a.criadoPorId === usuarioId)) continue;
    alertas.push({
      id: a.id, nome: a.nome, categoria: a.categoria,
      nfNumero: a.nf?.numero || null, faltando: falta,
    });
  }
  return Response.json(alertas);
}
