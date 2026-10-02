export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

// PATCH { usuarioId, codigo?, nome?, ativo? }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const d = {};
  if (b.codigo !== undefined) d.codigo = String(b.codigo).replace(/\D/g, "");
  if (b.nome !== undefined) d.nome = String(b.nome).trim().toUpperCase();
  if (b.ativo !== undefined) d.ativo = !!b.ativo;
  try { return Response.json(await prisma.finConta.update({ where: { id: Number(params.id) }, data: d })); }
  catch { return Response.json({ error: "Não foi possível salvar (código repetido?)." }, { status: 400 }); }
}
