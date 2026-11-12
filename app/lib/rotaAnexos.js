// v788 — sugestão #70: anexos nas demandas de rota e confirmação da demanda estimada
import { prisma } from "@/lib/prisma";

const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
export const LIMITE_ANEXO_ROTA = 15 * 1024 * 1024;

export async function anexosDe(ids) {
  const l = ids.length ? await prisma.rotaDemandaArquivo.findMany({ where: { demandaId: { in: ids } }, select: { id: true, demandaId: true, nome: true, mime: true, tamanho: true, criadoPorNome: true }, orderBy: { id: "asc" } }) : [];
  const por = {};
  for (const a of l) (por[a.demandaId] ||= []).push(a);
  return por;
}

export async function anexarDemanda(b, u) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(b.id) || 0 }, select: { id: true } });
  if (!d) return { error: "Demanda não encontrada." };
  const conteudo = String(b.conteudo || ""), nome = String(b.nome || "").trim().slice(0, 200);
  if (!conteudo || !nome) return { error: "Arquivo vazio." };
  const tamanho = Math.floor(conteudo.length * 3 / 4);
  if (tamanho > LIMITE_ANEXO_ROTA) return { error: `${nome}: maior que 15 MB.` };
  const a = await prisma.rotaDemandaArquivo.create({ data: { demandaId: d.id, nome, mime: b.mime || null, tamanho, conteudo, criadoPorNome: nomeU(u) },
    select: { id: true, demandaId: true, nome: true, mime: true, tamanho: true, criadoPorNome: true } });
  return { ok: true, anexo: a };
}

export async function tirarAnexoDemanda(id) {
  await prisma.rotaDemandaArquivo.delete({ where: { id: Number(id) || 0 } }).catch(() => null);
  return { ok: true };
}

export const arquivoDemanda = (id) => prisma.rotaDemandaArquivo.findUnique({ where: { id: Number(id) || 0 } });

// demanda estimada (pendente) só entra numa rota depois de confirmada
export async function confirmarDemanda(id, u) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) || 0 } });
  if (!d) return { error: "Demanda não encontrada." };
  if (!d.pendente) return { ok: true };
  const obs = `${d.obs ? `${d.obs}\n` : ""}Confirmada por ${nomeU(u)} em ${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 16).replace("T", " ").split(" ").map((x, i) => (i ? x : x.split("-").reverse().join("/"))).join(" ")}${d.pendencia ? ` (era: ${d.pendencia})` : ""}.`;
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { pendente: false, pendencia: null, obs: obs.slice(0, 2000) } });
  return { ok: true };
}
