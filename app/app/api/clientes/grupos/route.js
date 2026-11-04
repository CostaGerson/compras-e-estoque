// v647 — grupos de clientes: GET lista · POST { nome, cnpj, clienteIds } cria (ou { id } junta os clientes a um grupo existente)
//   PUT { id, nome, cnpj, clienteIds? } · DELETE ?id= (os clientes ficam sem grupo) · { acao: "tirar", clienteIds }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const so = (v) => String(v || "").replace(/\D/g, "");
const up = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());

export async function GET() {
  const g = await prisma.clienteGrupo.findMany({ orderBy: { nome: "asc" }, include: { clientes: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } } } });
  return Response.json(g);
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const ids = [...new Set((b.clienteIds || []).map(Number).filter(Boolean))];
  if (b.acao === "tirar") { await prisma.cliente.updateMany({ where: { id: { in: ids } }, data: { grupoId: null } }); return Response.json({ ok: true }); }
  let id = Number(b.id) || null;
  if (!id) {
    const nome = up(b.nome);
    if (!nome) return Response.json({ error: "Dê um nome ao grupo." }, { status: 400 });
    id = (await prisma.clienteGrupo.create({ data: { nome, cnpj: so(b.cnpj) || null, criadoPorNome: b.quem || null } })).id;
  }
  if (ids.length) await prisma.cliente.updateMany({ where: { id: { in: ids } }, data: { grupoId: id } });
  return Response.json({ ok: true, id });
}

export async function PUT(req) {
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  const nome = up(b.nome);
  if (!id || !nome) return Response.json({ error: "Dê um nome ao grupo." }, { status: 400 });
  await prisma.clienteGrupo.update({ where: { id }, data: { nome, cnpj: so(b.cnpj) || null } });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await prisma.cliente.updateMany({ where: { grupoId: id }, data: { grupoId: null } });
  await prisma.clienteGrupo.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
