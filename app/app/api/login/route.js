export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  const b = await req.json();
  const login = String(b.login || "").trim().toLowerCase();
  const senha = String(b.senha || "");
  if (!login || !senha) return Response.json({ error: "Informe usuário e senha" }, { status: 400 });
  const u = await prisma.usuario.findUnique({ where: { login } });
  if (!u || u.senha !== senha) return Response.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  if (!u.ativo) return Response.json({ error: "Usuário bloqueado. Fale com o master." }, { status: 403 });
  return Response.json(u);
}
