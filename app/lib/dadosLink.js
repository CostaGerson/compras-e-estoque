// v699 — link público de dados unitários: o vendedor (ou o portal do cliente) gera; cada pessoa preenche o tamanho e os dados da sua peça
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { limparDU, normTam } from "@/lib/dadosUnitarios";

export const novoToken = () => crypto.randomBytes(12).toString("base64url");
const LIM_TOTAL = 5000, LIM_ENVIO = 50;

export async function criarLink({ titulo, clienteNome, campos, tamanhos }, { u, portalClienteId }) {
  const du = limparDU({ campos, linhas: [] });
  if (!du) return { error: "Defina ao menos um dado (local) antes de gerar o link." };
  const tams = (Array.isArray(tamanhos) ? tamanhos : []).map(normTam).filter(Boolean).slice(0, 40);
  if (!tams.length) return { error: "Informe os tamanhos que podem ser escolhidos." };
  const l = await prisma.dadoUnitarioLink.create({ data: {
    token: novoToken(), titulo: String(titulo || "PEDIDO").toUpperCase().slice(0, 120), clienteNome: clienteNome ? String(clienteNome).toUpperCase().slice(0, 120) : null,
    campos: du.campos, tamanhos: tams, portalClienteId: portalClienteId || null, criadoPorId: u?.id || null,
    criadoPorNome: [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase() || null } });
  return { ok: true, id: l.id, token: l.token };
}

// visão de quem gerou: respostas e previsão de peças
export async function verLink(id) {
  const l = await prisma.dadoUnitarioLink.findUnique({ where: { id: Number(id) }, include: { respostas: { orderBy: { id: "asc" } } } });
  if (!l) return null;
  const cont = {};
  for (const r of l.respostas) cont[r.tam] = (cont[r.tam] || 0) + 1;
  const ordem = Array.isArray(l.tamanhos) ? l.tamanhos : [];
  const porTam = [...ordem.filter((t) => cont[t]), ...Object.keys(cont).filter((t) => !ordem.includes(t))].map((t) => ({ tam: t, qtd: cont[t] }));
  return {
    id: l.id, token: l.token, titulo: l.titulo, clienteNome: l.clienteNome, campos: l.campos, tamanhos: l.tamanhos, aberto: l.aberto,
    fechadoEm: l.fechadoEm, fechadoPorNome: l.fechadoPorNome, portalClienteId: l.portalClienteId,
    pessoas: new Set(l.respostas.map((r) => r.envio)).size, total: l.respostas.length, porTam,
    linhas: l.respostas.map((r) => ({ tam: r.tam, valores: r.valores || {}, responsavel: r.responsavel, em: r.createdAt })),
  };
}

// visão pública (sem as respostas dos outros)
export async function linkPublico(token) {
  const l = await prisma.dadoUnitarioLink.findUnique({ where: { token: String(token) }, select: { id: true, titulo: true, clienteNome: true, campos: true, tamanhos: true, aberto: true } });
  if (!l) return null;
  const total = await prisma.dadoUnitarioResposta.count({ where: { linkId: l.id } });
  return { titulo: l.titulo, clienteNome: l.clienteNome, campos: l.campos, tamanhos: l.tamanhos, aberto: l.aberto, total };
}

export async function responder(token, { responsavel, pecas }) {
  const l = await prisma.dadoUnitarioLink.findUnique({ where: { token: String(token) } });
  if (!l) return { error: "Link não encontrado." };
  if (!l.aberto) return { error: "O preenchimento deste link já foi encerrado. Fale com quem enviou o link." };
  const tams = new Set((l.tamanhos || []).map(normTam));
  const ids = new Set((l.campos || []).map((c) => c.id));
  const lista = (Array.isArray(pecas) ? pecas : []).slice(0, LIM_ENVIO);
  if (!lista.length) return { error: "Preencha ao menos uma peça." };
  for (const [i, p] of lista.entries()) if (!tams.has(normTam(p.tam))) return { error: `Peça ${i + 1}: escolha o tamanho.` };
  if ((await prisma.dadoUnitarioResposta.count({ where: { linkId: l.id } })) + lista.length > LIM_TOTAL) return { error: "Limite de peças deste link atingido." };
  const envio = novoToken();
  await prisma.dadoUnitarioResposta.createMany({ data: lista.map((p) => ({
    linkId: l.id, envio, responsavel: responsavel ? String(responsavel).slice(0, 80) : null, tam: normTam(p.tam),
    valores: Object.fromEntries(Object.entries(p.valores || {}).filter(([k]) => ids.has(k)).map(([k, v]) => [k, String(v ?? "").trim().slice(0, 120)])),
  })) });
  return { ok: true, n: lista.length };
}
