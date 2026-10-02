export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const MAX_VERSOES = 60;

export async function GET(req, { params }) {
  if (!(await usuarioMaster(new URL(req.url).searchParams.get("u")))) return negado();
  const m = await prisma.finMatriz.findUnique({ where: { id: Number(params.id) } });
  if (!m) return Response.json({ error: "Matriz não encontrada." }, { status: 404 });
  return Response.json(m);
}

// PUT { usuarioId, dados, resumo, versaoBase } → grava (guarda a versão anterior)
export async function PUT(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const id = Number(params.id);
  const atual = await prisma.finMatriz.findUnique({ where: { id } });
  if (!atual) return Response.json({ error: "Matriz não encontrada." }, { status: 404 });
  if (b.versaoBase && new Date(atual.updatedAt).getTime() !== new Date(b.versaoBase).getTime())
    return Response.json({ error: `Esta matriz foi alterada por ${atual.atualizadoPor || "outra pessoa"} enquanto você editava. Recarregue antes de salvar.` }, { status: 409 });
  if (!b.dados || !Array.isArray(b.dados.pessoal)) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  await prisma.finMatrizVersao.create({ data: { matrizId: id, dados: atual.dados, usuarioNome: atual.atualizadoPor, resumo: "antes de: " + String(b.resumo || "alteração").slice(0, 300) } });
  const velhas = await prisma.finMatrizVersao.findMany({ where: { matrizId: id }, orderBy: { createdAt: "desc" }, skip: MAX_VERSOES, select: { id: true } });
  if (velhas.length) await prisma.finMatrizVersao.deleteMany({ where: { id: { in: velhas.map((v) => v.id) } } });
  const m = await prisma.finMatriz.update({ where: { id }, data: { dados: b.dados, atualizadoPor: nomeU(u) } });
  return Response.json({ ok: true, updatedAt: m.updatedAt, atualizadoPor: m.atualizadoPor });
}

// PATCH { usuarioId, nome } → renomeia
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  await prisma.finMatriz.update({ where: { id: Number(params.id) }, data: { nome: String(b.nome || "").toUpperCase() || "SEM NOME" } });
  return Response.json({ ok: true });
}

// DELETE { usuarioId } → apaga cenário (a oficial não pode)
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const m = await prisma.finMatriz.findUnique({ where: { id: Number(params.id) } });
  if (!m) return Response.json({ ok: true });
  if (m.oficial) return Response.json({ error: "A matriz oficial não pode ser apagada." }, { status: 400 });
  await prisma.finMatriz.delete({ where: { id: m.id } });
  return Response.json({ ok: true });
}
