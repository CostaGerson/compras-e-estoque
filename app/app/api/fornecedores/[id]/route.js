export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const soDigitos = (s) => (s || "").replace(/\D/g, "");

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  if (!b.nome || !b.nome.trim())
    return Response.json({ error: "Nome comercial é obrigatório" }, { status: 400 });

  const cnpjs = Array.isArray(b.cnpjs)
    ? b.cnpjs.map((c) => ({ cnpj: soDigitos(c.cnpj), razaoSocial: c.razaoSocial || null }))
             .filter((c) => c.cnpj)
    : [];

  try {
    // substitui a lista de CNPJs (nada mais referencia FornecedorCnpj)
    const forn = await prisma.$transaction(async (tx) => {
      await tx.fornecedor.update({
        where: { id },
        data: {
          nome: b.nome.trim(),
          contato: b.contato || null,
          telefone: b.telefone || null,
          email: b.email || null,
        },
      });
      await tx.fornecedorCnpj.deleteMany({ where: { fornecedorId: id } });
      if (cnpjs.length)
        await tx.fornecedorCnpj.createMany({ data: cnpjs.map((c) => ({ ...c, fornecedorId: id })) });
      return tx.fornecedor.findUnique({ where: { id }, include: { cnpjs: true } });
    });
    return Response.json(forn);
  } catch (e) {
    return Response.json({ error: "Nome comercial ou algum CNPJ já pertence a outro fornecedor." }, { status: 409 });
  }
}

export async function DELETE(req, { params }) {
  await prisma.fornecedor.update({ where: { id: Number(params.id) }, data: { ativo: false } });
  return Response.json({ ok: true });
}
