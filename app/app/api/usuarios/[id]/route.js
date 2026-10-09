export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ator, soMasterUsuarios, limparPermissoes, CAMPOS_PROPRIOS } from "@/lib/usuariosAcesso";

const up = (v) => (v ? String(v).trim().toUpperCase() : "");
const txt = (v) => (v == null ? "" : String(v).trim());
const bool = (v) => v === true || v === "true" || v === 1;
const PERMS = ["permLancaPedidos", "permLancaContas", "permAlteraStatus", "permVeValores"];
// v167 — chave Diretoria liga lançar/editar contas e pedidos e ver valores
const aplicaDiretoria = (data) => { if (data.diretoria) { data.isMaster = false; data.permLancaPedidos = true; data.permLancaContas = true; data.permVeValores = true; data.permAlteraStatus = true; } };
const semSegredos = (u) => { if (!u) return u; const { resetHash, resetExpira, ...r } = u; return r; };

// GET → dados atuais do usuário (o navegador atualiza a sessão ao abrir: setor, chave Diretoria, bloqueio)
export async function GET(req, { params }) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!u) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
  return Response.json(semSegredos(u));
}

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  // v170 — master edita tudo; o próprio usuário, só o perfil
  const a = await ator(b.atorId);
  if (!a) return soMasterUsuarios();
  if (!a.isMaster) {
    if (a.id !== id) return soMasterUsuarios();
    for (const k of Object.keys(b)) if (!CAMPOS_PROPRIOS.includes(k) && k !== "atorId") delete b[k];
  }
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
  if ("diretoria" in b) data.diretoria = bool(b.diretoria);
  aplicaDiretoria(data);
  if ("permissoes" in b) {
    const atual = await prisma.usuario.findUnique({ where: { id }, select: { setor: true, isMaster: true, diretoria: true } });
    data.permissoes = limparPermissoes(b.permissoes, { ...atual, ...data }) ?? Prisma.DbNull;
  }
  try {
    const u = await prisma.usuario.update({ where: { id }, data });
    return Response.json(semSegredos(u));
  } catch (e) {
    if (e.code === "P2002") return Response.json({ error: "Já existe um usuário com esse login" }, { status: 400 });
    return Response.json({ error: "Erro ao salvar usuário" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await ator(b.atorId || new URL(req.url).searchParams.get("u")))?.isMaster) return soMasterUsuarios();
  await prisma.usuario.delete({ where: { id: Number(params.id) } });
  return Response.json({ ok: true });
}
