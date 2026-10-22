// v404 — FPP resumida para compras: identificação, preço e matérias-primas com consumo e demanda prevista para a qtde do item
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { materiaisDaFpp } from "@/lib/compras";

export async function GET(req, { params }) {
  const f = await prisma.fpp.findUnique({ where: { id: Number(params.id) } });
  if (!f) return Response.json({ error: "FPP não encontrada." }, { status: 404 });
  const qtd = Number(new URL(req.url).searchParams.get("qtd")) || 0;
  const ps = await prisma.fppParam.findMany({ where: { ativo: true }, select: { tipo: true, grupo: true, chave: true, valor: true } });
  const e = f.entradas || {};
  const ids = [e.artigoDet?.fornecedorId, e.artigoForroDet?.fornecedorId].filter(Boolean).map(Number);
  const forns = Object.fromEntries((ids.length ? await prisma.fornecedor.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : []).map((x) => [x.id, x.nome]));
  const materiais = materiaisDaFpp(f, ps).map((m) => ({ ...m, fornecedor: m.det?.fornecedorId ? forns[m.det.fornecedorId] || m.det.fornecedorNome : null,
    demanda: qtd ? Math.round(m.consumoPorPeca * qtd * 1000) / 1000 : null }));
  const av = [];
  if (e.gola) av.push(`Gola ${e.gola}`); if (e.punho) av.push(`Punho ${e.punho}`); if (e.elastico) av.push(`Elástico ${e.elastico}`);
  if (e.faixa && e.faixa !== "SEM FAIXA") av.push(`Faixa ${e.faixa}`); if (Number(e.botaoQtd) > 0) av.push(`${e.botaoQtd} botões`);
  for (const x of Array.isArray(e.extrasAviamentos) ? e.extrasAviamentos : []) if (x.desc) av.push(String(x.desc).toUpperCase());
  return Response.json({ id: f.id, numero: f.numero, tipo: f.tipo, item: f.item, nomeComercial: f.nomeComercial, clienteNome: f.clienteNome, negociacao: f.negociacao,
    qtde: f.qtde, valorProposto: f.valorProposto, criadoPorNome: f.criadoPorNome, createdAt: f.createdAt, materiais, aviamentos: av });
}
