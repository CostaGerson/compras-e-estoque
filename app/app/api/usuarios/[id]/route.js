export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const up = (v) => (v ? String(v).trim().toUpperCase() : "");
const txt = (v) => (v == null ? "" : String(v).trim());
const bool = (v) => v === true || v === "true" || v === 1;
const PERMS = ["permLancaPedidos", "permLancaContas", "permAlteraStatus", "permVeValores"];

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  const data = {};
  if ("nome" in b) data.nome = up(b.nome);
  if ("sobrenome" in b) data.sobrenome = up(b.sobrenome);
  if ("email" in b) data.email = txt(b.email).toLowerCase();
  if ("login" in b) data.login = txt(b.login).toLowerCase();
  if ("senha" in b) data.senha = txt(b.senha);
  if ("fotoBase64" in b) data.fotoBase64 = b.fotoBase64 || null;
  if ("setor" in b) data.setor = b.setor || "PCP";
  if ("isMaster" in b) data.isMaster = bool(b.isMaster);
  if ("ativo" in b) data.ativo = bool(b.ativo);
  for (const p of PERMS) if (p in b) data[p] = bool(b[p]);
  try {
    const u = await prisma.usuario.update({ where: { id }, data });
    return Response.json(u);
  } catch (e) {
    if (e.code === "P2002") return Response.json({ error: "Já existe um usuário com esse login" }, { status: 400 });
    return Response.json({ error: "Erro ao salvar usuário" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  await prisma.usuario.delete({ where: { id: Number(params.id) } });
  return Response.json({ ok: true });
}
