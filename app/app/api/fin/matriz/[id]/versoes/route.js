export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";

// GET ?u= → versões anteriores (sem os dados)
export async function GET(req, { params }) {
  if (!(await usuarioGerencial(new URL(req.url).searchParams.get("u")))) return negadoGerencial();
  const l = await prisma.finMatrizVersao.findMany({
    where: { matrizId: Number(params.id) }, orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, usuarioNome: true, resumo: true },
  });
  return Response.json(l);
}

// POST { usuarioId, versaoId } → restaura a versão (a atual vira uma versão também)
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioGerencial(b.usuarioId);
  if (!u) return negadoGerencial();
  const id = Number(params.id);
  const [m, v] = await Promise.all([prisma.finMatriz.findUnique({ where: { id } }), prisma.finMatrizVersao.findUnique({ where: { id: Number(b.versaoId) } })]);
  if (!m || !v || v.matrizId !== id) return Response.json({ error: "Versão não encontrada." }, { status: 404 });
  await prisma.finMatrizVersao.create({ data: { matrizId: id, dados: m.dados, usuarioNome: m.atualizadoPor, resumo: `antes de restaurar a versão de ${new Date(v.createdAt).toLocaleString("pt-BR")}` } });
  await prisma.finMatriz.update({ where: { id }, data: { dados: v.dados, atualizadoPor: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() } });
  return Response.json({ ok: true });
}
