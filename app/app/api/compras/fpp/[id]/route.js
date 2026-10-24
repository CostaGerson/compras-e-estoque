// v404 — FPP resumida para compras: identificação, preço e matérias-primas com consumo e demanda prevista para a qtde do item
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { materiaisDaFpp } from "@/lib/compras";

export async function GET(req, { params }) {
  const f = await prisma.fpp.findUnique({ where: { id: Number(params.id) } });
  if (!f) return Response.json({ error: "FPP não encontrada." }, { status: 404 });
  const qtd = Number(new URL(req.url).searchParams.get("qtd")) || 0;
  const ps = await prisma.fppParam.findMany({ where: { ativo: true }, select: { tipo: true, grupo: true, chave: true, valor: true, extra: true } });
  const e = f.entradas || {};
  const ids = [e.artigoDet?.fornecedorId, e.artigoForroDet?.fornecedorId, ...Object.values(e.aviamentosDet || {}).map((d) => d?.fornecedorId),
    ...(e.extrasAviamentos || []).map((x) => x?.det?.fornecedorId), ...(e.materiasExtras || []).map((x) => x?.det?.fornecedorId)].filter(Boolean).map(Number);
  const forns = Object.fromEntries((ids.length ? await prisma.fornecedor.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, nomeFantasia: true, razaoSocial: true } }) : []).map((x) => [x.id, x.nome || x.nomeFantasia || x.razaoSocial]));
  const materiais = materiaisDaFpp(f, ps).map((m) => ({ ...m, fornecedor: m.det?.fornecedorId ? forns[m.det.fornecedorId] || m.det.fornecedorNome : null,
    demanda: qtd ? Math.round(m.consumoPorPeca * qtd * 1000) / 1000 : null }));
  return Response.json({ id: f.id, numero: f.numero, tipo: f.tipo, item: f.item, nomeComercial: f.nomeComercial, clienteNome: f.clienteNome, negociacao: f.negociacao,
    qtde: f.qtde, valorProposto: f.valorProposto, criadoPorNome: f.criadoPorNome, createdAt: f.createdAt, materiais });
}
