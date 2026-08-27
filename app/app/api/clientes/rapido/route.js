import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

// POST { razaoSocial }: cria um cliente só com o nome, demais campos em branco (sem CNPJ).
export async function POST(req) {
  const b = await req.json();
  const nome = String(b.razaoSocial || "").trim().toUpperCase();
  if (!nome) return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });

  // reaproveita se já existir um com o mesmo nome
  const existe = await prisma.cliente.findFirst({ where: { razaoSocial: nome } });
  if (existe) return NextResponse.json(existe);

  const c = await prisma.cliente.create({ data: { razaoSocial: nome, cnpj: null, ativo: true } });
  return NextResponse.json(c);
}
