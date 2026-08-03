import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    orderBy: { razaoSocial: "asc" },
    include: { _count: { select: { notas: true } } },
  });
  return NextResponse.json(clientes);
}

const soDig = (v) => String(v || "").replace(/\D/g, "");
const up = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());
const CAMPOS = ["nomeFantasia", "inscricaoEstadual", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "cep", "preposto", "telefones", "emailNf", "obs"];

export async function POST(req) {
  const b = await req.json();
  const cnpj = soDig(b.cnpj);
  if (!cnpj) return NextResponse.json({ error: "Informe o CNPJ." }, { status: 400 });
  const existe = await prisma.cliente.findUnique({ where: { cnpj } });
  if (existe) return NextResponse.json({ error: "Já existe um cliente com este CNPJ." }, { status: 400 });
  const data = { cnpj, razaoSocial: up(b.razaoSocial) || "" };
  for (const c of CAMPOS) {
    if (c === "cep") { const v = soDig(b[c]); data[c] = v || null; }
    else if (c === "emailNf") { data[c] = b[c] ? String(b[c]).trim().toLowerCase() : null; }
    else if (c === "telefones" || c === "preposto" || c === "obs") { data[c] = b[c] ? String(b[c]).trim() : null; }
    else data[c] = up(b[c]);
  }
  const cli = await prisma.cliente.create({ data });
  return NextResponse.json(cli);
}
