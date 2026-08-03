export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const soDigitos = (s) => (s || "").replace(/\D/g, "");
const up = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());
const RICOS = ["razaoSocial", "nomeFantasia", "inscricaoEstadual", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "cep", "preposto", "telefones", "emailNf", "obs"];

function camposRicos(b) {
  const d = {};
  for (const k of RICOS) {
    if (b[k] === undefined) continue;
    if (k === "cep") d[k] = soDigitos(b[k]) || null;
    else if (k === "emailNf") d[k] = b[k] ? String(b[k]).trim().toLowerCase() : null;
    else if (k === "preposto" || k === "telefones" || k === "obs" || k === "inscricaoEstadual") d[k] = b[k] ? String(b[k]).trim() : null;
    else d[k] = up(b[k]);
  }
  return d;
}

export async function GET() {
  const fornecedores = await prisma.fornecedor.findMany({
    where: { ativo: true },
    include: { cnpjs: true, _count: { select: { artigos: true, nfs: true } } },
    orderBy: { nome: "asc" },
  });
  return Response.json(fornecedores);
}

export async function POST(req) {
  const b = await req.json();
  if (!b.nome || !b.nome.trim())
    return Response.json({ error: "Nome comercial é obrigatório" }, { status: 400 });
  const cnpjs = Array.isArray(b.cnpjs)
    ? b.cnpjs.map((c) => ({ cnpj: soDigitos(c.cnpj), razaoSocial: c.razaoSocial || null }))
             .filter((c) => c.cnpj)
    : [];
  try {
    const forn = await prisma.fornecedor.create({
      data: {
        nome: b.nome.trim(),
        contato: b.contato || null,
        telefone: b.telefone || null,
        email: b.email || null,
        ...camposRicos(b),
        cnpjs: { create: cnpjs },
      },
      include: { cnpjs: true },
    });
    return Response.json(forn, { status: 201 });
  } catch (e) {
    return Response.json({ error: "Nome comercial ou algum CNPJ já cadastrado." }, { status: 409 });
  }
}
