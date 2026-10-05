// Impressão digital dos arquivos (sha-256): o mesmo documento não entra duas vezes no contas a pagar
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const hashB64 = (b64) => createHash("sha256").update(Buffer.from(String(b64 || ""), "base64")).digest("hex");

// anexos antigos (sem hash) ganham o hash uma vez
export async function completarHashes() {
  for (;;) {
    const l = await prisma.finTituloAnexo.findMany({ where: { hash: null }, select: { id: true, conteudo: true }, take: 50 });
    if (!l.length) return;
    for (const a of l) await prisma.finTituloAnexo.update({ where: { id: a.id }, data: { hash: hashB64(a.conteudo) } });
  }
}

// hash → conta ativa (não cancelada) que já tem esse arquivo
export async function jaImportados(hashes) {
  const lista = [...new Set((hashes || []).filter(Boolean))];
  if (!lista.length) return {};
  await completarHashes();
  const an = await prisma.finTituloAnexo.findMany({
    where: { hash: { in: lista }, titulo: { status: { not: "CANCELADO" } } },
    select: { hash: true, nome: true, createdAt: true, titulo: { select: { id: true, titulo: true, competencia: true } } },
  });
  const out = {};
  for (const a of an) if (!out[a.hash]) out[a.hash] = { tituloId: a.titulo.id, titulo: a.titulo.titulo, nome: a.nome, em: a.createdAt };
  return out;
}
