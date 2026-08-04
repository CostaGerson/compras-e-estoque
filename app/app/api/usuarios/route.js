export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const up = (v) => (v ? String(v).trim().toUpperCase() : "");
const txt = (v) => (v == null ? "" : String(v).trim());
const bool = (v) => v === true || v === "true" || v === 1;
const PERMS = ["permLancaPedidos", "permLancaContas", "permAlteraStatus", "permVeValores"];

export async function GET() {
  const usuarios = await prisma.usuario.findMany({ orderBy: [{ isMaster: "desc" }, { nome: "asc" }] });
  return Response.json(usuarios);
}

export async function POST(req) {
  const b = await req.json();
  if (!txt(b.nome)) return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
  if (!txt(b.login)) return Response.json({ error: "Usuário (login) é obrigatório" }, { status: 400 });
  const data = {
    nome: up(b.nome),
    sobrenome: up(b.sobrenome),
    email: txt(b.email).toLowerCase(),
    login: txt(b.login).toLowerCase(),
    senha: txt(b.senha),
    fotoBase64: b.fotoBase64 || null,
    setor: b.setor || "PCP",
    isMaster: bool(b.isMaster),
    ativo: b.ativo === undefined ? true : bool(b.ativo),
  };
  for (const p of PERMS) data[p] = bool(b[p]);
  try {
    const u = await prisma.usuario.create({ data });
    return Response.json(u, { status: 201 });
  } catch (e) {
    if (e.code === "P2002") return Response.json({ error: "Já existe um usuário com esse login" }, { status: 400 });
    return Response.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
