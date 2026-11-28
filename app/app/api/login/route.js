export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  const b = await req.json();
  const login = String(b.login || "").trim().toLowerCase();
  const senha = String(b.senha || "");
  if (!login) return Response.json({ error: "Informe usuário e senha" }, { status: 400 });
  const u = await prisma.usuario.findUnique({ where: { login } });
  // v1197 — o usuário "estoque" entra sem senha (só a guia Estoque); os demais continuam exigindo senha
  const semSenha = !!u && u.senha === "" && !u.senhaHash && Array.isArray(u.permissoes) && u.permissoes.includes("SO_ESTOQUE");
  if (!senha && !semSenha) return Response.json({ error: "Informe usuário e senha" }, { status: 400 });
  if (!u || (!semSenha && u.senha !== senha)) return Response.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  if (!u.ativo) return Response.json({ error: "Usuário bloqueado. Fale com o master." }, { status: 403 });
  const { resetHash, resetExpira, ...r } = u;
  return Response.json(r);
}
