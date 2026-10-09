export const dynamic = "force-dynamic";
import { conferirToken, redefinir } from "@/lib/senha";

// GET ?token= → confere se o link ainda vale
export async function GET(req) {
  const u = await conferirToken(new URL(req.url).searchParams.get("token"));
  return Response.json(u ? { ok: true, login: u.login } : { ok: false, erro: "Link inválido ou vencido. Peça um novo em \"Esqueci minha senha\"." });
}

// POST { token, senha, confirma } → grava a nova senha e manda e-mail de confirmação
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = await redefinir(b.token, b.senha, b.confirma);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
