// v483 — avisos ao Leandro (encarregado do PCP): mensagem no sistema + notificação no celular
import { prisma } from "@/lib/prisma";
import { notificar } from "@/lib/push";

export async function usuariosLeandro() {
  return (await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true } }))
    .filter((u) => /(^|\s)LEANDRO(\s|$)/.test(`${u.nome || ""} ${u.sobrenome || ""}`.toUpperCase()));
}
export async function avisarLeandro({ texto, titulo, resumo, tag, deId }) {
  const us = await usuariosLeandro();
  for (const u of us) {
    await prisma.mensagem.create({ data: { deId: Number(deId) || u.id, paraId: u.id, texto: String(texto).slice(0, 2000) } }).catch(() => null);
    await notificar(u.id, { titulo, texto: resumo || "", tag }).catch(() => null);
  }
  return us.length;
}
