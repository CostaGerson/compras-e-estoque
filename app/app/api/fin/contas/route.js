export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirContas } from "@/lib/fin";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await garantirContas();
  return Response.json(await prisma.finConta.findMany({ orderBy: { codigo: "asc" } }));
}

// POST { usuarioId, codigo, nome }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const codigo = String(b.codigo || "").replace(/\D/g, "");
  const nome = String(b.nome || "").trim().toUpperCase();
  if (!codigo || !nome) return Response.json({ error: "Informe código e nome." }, { status: 400 });
  if (await prisma.finConta.findUnique({ where: { codigo } })) return Response.json({ error: "Já existe conta com esse código." }, { status: 409 });
  return Response.json(await prisma.finConta.create({ data: { codigo, nome } }));
}
