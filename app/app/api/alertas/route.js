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

// artigos incompletos visíveis ao usuário
async function incompletosVisiveis(usuarioId, setor) {
  const veTudo = SETORES_ALERTA.includes(setor);
  const artigos = await prisma.artigo.findMany({
    where: { ativo: true },
    include: { fornecedor: { select: { nome: true } }, nf: { select: { numero: true } } },
    orderBy: { createdAt: "desc" },
  });
  const out = [];
  for (const a of artigos) {
    const falta = faltando(a);
    if (!falta.length) continue;
    if (!veTudo && !(usuarioId && a.criadoPorId === usuarioId)) continue;
    out.push({
      id: a.id, nome: a.nome, categoria: a.categoria, nfNumero: a.nf?.numero || null,
      faltando: falta, visto: a.alertaVisto, resolvido: a.alertaResolvido,
    });
  }
  return out;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const usuarioId = searchParams.get("usuarioId") ? Number(searchParams.get("usuarioId")) : null;
  const setor = searchParams.get("setor") || "";
  const todos = await incompletosVisiveis(usuarioId, setor);
  const pendentes = todos.filter((a) => !a.resolvido);
  const resolvidas = todos.filter((a) => a.resolvido);
  const naoVistos = pendentes.filter((a) => !a.visto).length;
  return Response.json({ pendentes, resolvidas, naoVistos });
}

// ações: visto | resolvido | reabrir | vistoTudo
export async function POST(req) {
  const b = await req.json();
  const acao = b.acao;
  if (acao === "visto") {
    await prisma.artigo.update({ where: { id: Number(b.id) }, data: { alertaVisto: true } });
  } else if (acao === "resolvido") {
    await prisma.artigo.update({ where: { id: Number(b.id) }, data: { alertaResolvido: true, alertaVisto: true } });
  } else if (acao === "reabrir") {
    await prisma.artigo.update({ where: { id: Number(b.id) }, data: { alertaResolvido: false, alertaVisto: false } });
  } else if (acao === "vistoTudo") {
    const pend = (await incompletosVisiveis(b.usuarioId ? Number(b.usuarioId) : null, b.setor || "")).filter((a) => !a.resolvido);
    const ids = pend.map((a) => a.id);
    if (ids.length) await prisma.artigo.updateMany({ where: { id: { in: ids } }, data: { alertaVisto: true } });
  } else {
    return Response.json({ error: "Ação inválida" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
