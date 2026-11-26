import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

const soDig = (v) => String(v || "").replace(/\D/g, "");
const up = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());
const CAMPOS = ["nomeFantasia", "inscricaoEstadual", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "cep", "preposto", "telefones", "emailNf", "obs"];

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  const data = {};
  if (b.razaoSocial !== undefined) data.razaoSocial = up(b.razaoSocial) || "";
  if (b.cnpj !== undefined) {
    const cnpj = soDig(b.cnpj);
    if (!cnpj) return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
    const outro = await prisma.cliente.findUnique({ where: { cnpj } });
    if (outro && outro.id !== id) return NextResponse.json({ error: "Outro cliente já usa este CNPJ." }, { status: 400 });
    data.cnpj = cnpj;
  }
  for (const c of CAMPOS) {
    if (b[c] === undefined) continue;
    if (c === "cep") data[c] = soDig(b[c]) || null;
    else if (c === "emailNf") data[c] = b[c] ? String(b[c]).trim().toLowerCase() : null;
    else if (c === "telefones" || c === "preposto" || c === "obs") data[c] = b[c] ? String(b[c]).trim() : null;
    else data[c] = up(b[c]);
  }
  if (b.aceitaAntecipacao !== undefined) data.aceitaAntecipacao = b.aceitaAntecipacao === null || b.aceitaAntecipacao === "" ? null : !!b.aceitaAntecipacao;   // v1147 · v1149
  if (b.vendedor !== undefined) data.vendedor = String(b.vendedor || "").trim().toUpperCase() || null;   // v1148
  const cli = await prisma.cliente.update({ where: { id }, data });
  if (b.vendedor !== undefined) await (await import("@/lib/clientePendencias")).avisarPendenciasCliente(cli, b.usuarioId);   // v1148
  return NextResponse.json(cli);
}

export async function DELETE(_req, { params }) {
  const id = Number(params.id);
  await prisma.cliente.delete({ where: { id } }); // ClienteNota tem cascade
  return NextResponse.json({ ok: true });
}
