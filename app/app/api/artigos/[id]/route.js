export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const dec = (v) => (v === "" || v === null || v === undefined ? null : v);

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  const data = {};
  for (const k of ["nome","cor","composicao","especificacao","categoria","tipoMalha","unidade"])
    if (k in b) data[k] = b[k] || null;
  for (const k of ["largura","rendimento","gramatura","valorUnitario"])
    if (k in b) data[k] = dec(b[k]);
  if ("fornecedorId" in b) data.fornecedorId = b.fornecedorId ? Number(b.fornecedorId) : null;
  const artigo = await prisma.artigo.update({ where: { id }, data, include: { fornecedor: true } });
  return Response.json(artigo);
}

export async function DELETE(req, { params }) {
  await prisma.artigo.update({ where: { id: Number(params.id) }, data: { ativo: false } });
  return Response.json({ ok: true });
}

