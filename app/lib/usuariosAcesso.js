// v170 — quem pode mexer em usuários: só o master (cadastrar, editar, alterar permissões, bloquear, excluir).
// Cada usuário pode editar o próprio perfil (nome, e-mail, login, senha e foto).
import { prisma } from "@/lib/prisma";
import { PERMS_DO_TIPO, tipoDe } from "@/lib/acesso";

export async function ator(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, isMaster: true, ativo: true } }).catch(() => null);
  return u && u.ativo ? u : null;
}
export const soMasterUsuarios = () => Response.json({ error: "Só o master cadastra e edita usuários e altera permissões." }, { status: 403 });
export const CAMPOS_PROPRIOS = ["nome", "sobrenome", "email", "login", "senha", "fotoBase64"];

// guarda só as permissões que existem no tipo; todas ligadas = null (acompanha o tipo)
export function limparPermissoes(lista, u) {
  if (!Array.isArray(lista)) return null;
  const doTipo = PERMS_DO_TIPO[tipoDe(u)] || [];
  const l = [...new Set(lista.filter((p) => doTipo.includes(p)))];
  return l.length === doTipo.length ? null : l;
}
