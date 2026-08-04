export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { checarEstoqueMinimo } from "@/lib/estoqueMinimo";

const bool = (v) => v === true || v === "true" || v === 1;
const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  const data = {};
  const UP = ["nome","artigoInterno","codigo","cor","composicao","especificacao"];
  for (const k of ["nome","artigoInterno","codigo","cor","composicao","especificacao","categoria","tipoMalha","unidade"])
    if (k in b) data[k] = b[k] ? (UP.includes(k) ? String(b[k]).toUpperCase() : b[k]) : null;
  for (const k of ["largura","rendimento","gramatura","valorUnitario","quantidade"])
    if (k in b) data[k] = dec(b[k]);
  if ("fornecedorId" in b) data.fornecedorId = b.fornecedorId ? Number(b.fornecedorId) : null;
  if ("dataCompra" in b) data.dataCompra = b.dataCompra ? new Date(b.dataCompra) : null;
  if ("estoqueMinimoAtivo" in b) {
    data.estoqueMinimoAtivo = bool(b.estoqueMinimoAtivo);
    data.estoqueMinimo = bool(b.estoqueMinimoAtivo) ? dec(b.estoqueMinimo) : null;
  } else if ("estoqueMinimo" in b) {
    data.estoqueMinimo = dec(b.estoqueMinimo);
  }
  const artigo = await prisma.artigo.update({ where: { id }, data, include: { fornecedor: true } });
  await checarEstoqueMinimo(prisma, id, b.usuarioId).catch(() => {});
  return Response.json(artigo);
}

export async function DELETE(req, { params }) {
  await prisma.artigo.update({ where: { id: Number(params.id) }, data: { ativo: false } });
  return Response.json({ ok: true });
}