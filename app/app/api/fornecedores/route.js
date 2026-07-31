export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const fornecedores = await prisma.fornecedor.findMany({
    where: { ativo: true },
    include: { cnpjs: true, _count: { select: { artigos: true } } },
    orderBy: { nome: "asc" },
  });
  return Response.json(fornecedores);
}

export async function POST(req) {
  const b = await req.json();
  if (!b.nome || !b.nome.trim())
    return Response.json({ error: "Nome comercial Ã© obrigatÃ³rio" }, { status: 400 });
  const cnpjs = Array.isArray(b.cnpjs)
    ? b.cnpjs.filter((c) => c && c.cnpj && c.cnpj.trim())
             .map((c) => ({ cnpj: c.cnpj.trim(), razaoSocial: c.razaoSocial || null }))
    : [];
  try {
    const forn = await prisma.fornecedor.create({
      data: {
        nome: b.nome.trim(),
        contato: b.contato || null,
        telefone: b.telefone || null,
        email: b.email || null,
        cnpjs: { create: cnpjs },
      },
      include: { cnpjs: true },
    });
    return Response.json(forn, { status: 201 });
  } catch (e) {
    return Response.json({ error: "Nome ou CNPJ jÃ¡ cadastrado" }, { status: 409 });
  }
}

