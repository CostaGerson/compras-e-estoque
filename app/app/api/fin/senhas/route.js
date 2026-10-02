export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  return Response.json(await prisma.finSenhaPdf.findMany({ orderBy: { rotulo: "asc" } }));
}

// POST { usuarioId, rotulo, senha }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const rotulo = String(b.rotulo || "").trim().toUpperCase();
  const senha = String(b.senha || "");
  if (!rotulo || !senha) return Response.json({ error: "Informe a descrição e a senha." }, { status: 400 });
  return Response.json(await prisma.finSenhaPdf.create({ data: { rotulo, senha } }));
}
