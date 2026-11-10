// v757 — demandas para o arte finalista passam por aprovação de quem criou:
//   criamos a demanda (com arquivos) → o arte finalista anexa os arquivos de resposta e envia para aprovação →
//   quem criou recebe uma demanda de APROVAÇÃO no dia (com os arquivos) → aprova (fim) ou reprova com instruções
//   (a demanda original volta a ficar em aberto para o arte finalista) → o processo se repete.
import { prisma } from "@/lib/prisma";

const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const hojeSP = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const msg = (deId, paraId, texto) => (deId && paraId && deId !== paraId ? prisma.mensagem.create({ data: { deId, paraId, texto: texto.slice(0, 2000) } }).catch(() => null) : null);

// demandas abertas antigas para o arte finalista, criadas por outra pessoa, entram no fluxo (uma vez por processo)
let ajustado = false;
export async function ajustarAprovacoesAntigas() {
  if (ajustado) return; ajustado = true;
  await prisma.$executeRawUnsafe(`UPDATE "Tarefa" t SET "aprovacao" = jsonb_build_object('etapa', 'EXECUCAO', 'solicitanteId', t."criadoPorId", 'solicitanteNome', t."criadoPorNome", 'rodada', 1, 'desdeArquivoId', 0)
    FROM "Usuario" r WHERE r."id" = t."responsavelId" AND r."setor" = 'ARTE' AND t."criadoPorId" IS NOT NULL AND t."criadoPorId" <> t."responsavelId"
      AND t."aprovacao" IS NULL AND t."layout" IS NULL AND t."modelo" = false AND COALESCE(t."evento", false) = false AND t."status" IN ('ABERTA', 'EM_ANDAMENTO')`).catch((e) => console.log("aprovacao/ajuste:", e.message));
}

// arquivos de resposta da rodada: os anexados depois do envio anterior
export async function arquivosDaRodada(t) {
  const desde = Number(t.aprovacao?.desdeArquivoId) || 0;
  // na demanda original, só contam os anexados pelo responsável (os de quem pediu são o briefing)
  const so = t.aprovacao?.etapa === "APROVACAO" ? {} : { criadoPorNome: t.responsavelNome || undefined };
  return prisma.tarefaArquivo.findMany({ where: { tarefaId: t.id, id: { gt: desde }, ...so }, select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true }, orderBy: { id: "asc" } });
}

export async function enviarParaAprovacao(t, u) {
  const A = t.aprovacao || {};
  if (A.etapa !== "EXECUCAO") return { error: "Esta demanda não está aguardando envio para aprovação." };
  if (t.responsavelId !== u.id && !u.isMaster) return { error: "Só o responsável envia para aprovação." };
  const arqs = await prisma.tarefaArquivo.findMany({ where: { tarefaId: t.id, id: { gt: Number(A.desdeArquivoId) || 0 }, criadoPorNome: t.responsavelNome || undefined }, orderBy: { id: "asc" } });   // só os do responsável
  if (!arqs.length) return { error: "Anexe os arquivos de resposta antes de enviar para aprovação." };
  const sol = await prisma.usuario.findUnique({ where: { id: Number(A.solicitanteId) || 0 }, select: { id: true, nome: true, sobrenome: true, ativo: true } });
  if (!sol?.ativo) return { error: "Quem pediu a demanda não está mais ativo." };
  const rodada = Number(A.rodada) || 1;
  const ap = await prisma.tarefa.create({ data: {
    titulo: `APROVAÇÃO · ${t.titulo}`.slice(0, 200),
    descricao: `${nomeU(u)} enviou ${arqs.length} arquivo(s) de resposta${rodada > 1 ? ` (rodada ${rodada})` : ""}. Confira e aprove ou reprove (com as instruções).`,
    setor: t.setor, responsavelId: sol.id, responsavelNome: nomeU(sol), criadoPorId: u.id, criadoPorNome: nomeU(u),
    prazo: dUTC(hojeSP()), tipo: t.tipo === "URGENTE" ? "URGENTE" : "PADRAO", publica: false, natureza: "FUNCIONAL", lembreteMin: null, projetoId: t.projetoId || null,
    aprovacao: { etapa: "APROVACAO", origemId: t.id, rodada, solicitanteId: sol.id, solicitanteNome: nomeU(sol), executorId: u.id, executorNome: nomeU(u) },
  } });
  for (const a of arqs) await prisma.tarefaArquivo.create({ data: { tarefaId: ap.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, conteudo: a.conteudo, criadoPorNome: a.criadoPorNome } });
  try { const { fecharSessoes } = await import("@/lib/tarefas"); await fecharSessoes({ tarefaId: t.id }); } catch {}
  await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), emAndamentoDesde: null,
    retorno: `Enviado para aprovação de ${nomeU(sol)}${rodada > 1 ? ` (rodada ${rodada})` : ""}.`, aprovacao: { ...A, etapa: "AGUARDANDO", aprovacaoId: ap.id } } });
  await msg(u.id, sol.id, `🖼 ${nomeU(u)} enviou para aprovação: ${t.titulo} (${arqs.length} arquivo(s)). Está na sua agenda de hoje.`);
  return { ok: true, aprovacaoId: ap.id };
}

export async function decidirAprovacao(t, u, aprovar, motivo) {
  const A = t.aprovacao || {};
  if (A.etapa !== "APROVACAO") return { error: "Esta demanda não é de aprovação." };
  if (t.status === "CONCLUIDA") return { error: "Aprovação já decidida." };
  if (t.responsavelId !== u.id && !u.isMaster) return { error: "Só quem pediu decide a aprovação." };
  const orig = await prisma.tarefa.findUnique({ where: { id: Number(A.origemId) || 0 } });
  const inst = String(motivo || "").trim();
  if (!aprovar && inst.length < 3) return { error: "Escreva as instruções para o arte finalista." };
  if (aprovar) {
    await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: "APROVADO", aprovacao: { ...A, decisao: "APROVADO" } } });
    if (orig) await prisma.tarefa.update({ where: { id: orig.id }, data: { retorno: `Aprovado por ${nomeU(u)}${Number(A.rodada) > 1 ? ` (rodada ${A.rodada})` : ""}.`, aprovacao: { ...(orig.aprovacao || {}), etapa: "APROVADO", aprovadoEm: new Date().toISOString() } } });
    await msg(u.id, orig?.responsavelId || A.executorId, `✅ APROVADO por ${nomeU(u)}: ${orig?.titulo || t.titulo}`);
    return { ok: true };
  }
  await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: `REPROVADO: ${inst}`, aprovacao: { ...A, decisao: "REPROVADO", motivo: inst } } });
  if (orig) {
    const ultimo = await prisma.tarefaArquivo.findFirst({ where: { tarefaId: orig.id }, orderBy: { id: "desc" }, select: { id: true } });
    const Ao = orig.aprovacao || {};
    const rod = (Number(Ao.rodada) || 1) + 1;
    await prisma.tarefa.update({ where: { id: orig.id }, data: {
      status: "ABERTA", concluidaEm: null, concluidaPorNome: null, retorno: null, prazo: dUTC(hojeSP()),
      descricao: `${String(orig.descricao || "").split("\n⚠ REPROVADO")[0]}\n⚠ REPROVADO por ${nomeU(u)} (rodada ${rod - 1}): ${inst}`.slice(0, 5000),
      aprovacao: { ...Ao, etapa: "EXECUCAO", rodada: rod, desdeArquivoId: ultimo?.id || 0, motivo: inst, aprovacaoId: null },
    } });
    await msg(u.id, orig.responsavelId, `↩ REPROVADO por ${nomeU(u)}: ${orig.titulo} — ${inst}. A demanda voltou para a sua agenda de hoje.`);
  }
  return { ok: true };
}
