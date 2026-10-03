export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { sincronizarMatriz, previaMatriz } from "@/lib/alavancagemMatriz";

// GET ?u= → prévia do que vai para a aba Dívidas da Matriz
export async function GET(req) {
  if (!(await usuarioMaster(new URL(req.url).searchParams.get("u")))) return negado();
  return Response.json({ ok: true, previa: await previaMatriz() });
}

// POST { usuarioId } → grava os contratos na aba Dívidas da Matriz oficial
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();

  const r = await sincronizarMatriz({ usuarioNome: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });

  await prisma.finContrato.updateMany({ where: { ativo: true, quitado: false }, data: { naMatriz: true } });
  return Response.json(r);
}
