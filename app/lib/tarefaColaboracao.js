// v992 — colaboradores numa tarefa: cada colaborador recebe uma tarefa amarelo ouro na agenda, mensagem, push e e-mail
//   com o pedido de colaboração; ele responde com texto e anexos, e a resposta aparece na tarefa de origem.
//   Origem:  Tarefa.colaboracao = { pedido, colaboradores: [ids] }
//   Filha:   Tarefa.colaboracao = { origemId, pedido, solicitanteId, solicitanteNome, resposta?, respondidoEm? }
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel } from "@/lib/email";

const nome = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const dataBR = (d) => iso(d).split("-").reverse().join("/");
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
const TITULO = (t) => `COLABORAÇÃO: ${String(t.titulo || "").replace(/^COLABORAÇÃO:\s*/, "")}`.slice(0, 200);
const abertas = { status: { notIn: ["CONCLUIDA", "CANCELADA"] } };

export const ehFilha = (t) => !!Number(t?.colaboracao?.origemId);
export const filhasDe = (id, extra = {}) => prisma.tarefa.findMany({ where: { colaboracao: { path: ["origemId"], equals: Number(id) }, status: { not: "CANCELADA" }, ...extra }, orderBy: { id: "asc" } });

async function avisar(deId, paraId, texto, tarefaId) {
  if (!paraId || paraId === deId) return;
  await prisma.mensagem.create({ data: { deId, paraId, texto: String(texto).slice(0, 2000), tarefaId } }).catch(() => {});
}

// b = { pedido, colaboradores: [ids] } — cria/remove/atualiza as tarefas dos colaboradores
export async function sincronizarColaboradores(t, b, u) {
  if (!t || ehFilha(t) || t.modelo) return { ok: true };
  const pedido = String(b?.pedido || "").trim().slice(0, 4000);
  const quer = [...new Set((Array.isArray(b?.colaboradores) ? b.colaboradores : []).map(Number).filter((id) => id && id !== t.responsavelId))];
  if (quer.length && !pedido) return { error: "Descreva a colaboração necessária." };
  const ja = await filhasDe(t.id);
  // saiu da lista: a tarefa de colaboração em aberto é cancelada (a respondida fica no histórico)
  const sair = ja.filter((f) => !quer.includes(f.responsavelId) && f.status !== "CONCLUIDA").map((f) => f.id);
  if (sair.length) await prisma.tarefa.updateMany({ where: { id: { in: sair } }, data: { status: "CANCELADA" } });
  // continuam: acompanham data, horário, título e pedido da origem
  const ficam = ja.filter((f) => quer.includes(f.responsavelId) && f.status !== "CONCLUIDA");
  for (const f of ficam) await prisma.tarefa.update({ where: { id: f.id }, data: { titulo: TITULO(t), prazo: t.prazo, hora: t.hora, horaFim: t.horaFim, periodo: t.periodo, setor: t.setor, colaboracao: { ...f.colaboracao, pedido } } }).catch(() => null);
  const novos = quer.filter((id) => !ja.some((f) => f.responsavelId === id));
  const us = novos.length ? await prisma.usuario.findMany({ where: { id: { in: novos }, ativo: true }, select: { id: true, nome: true, sobrenome: true, email: true } }) : [];
  const quando = `${dataBR(t.prazo)}${t.hora ? ` às ${t.hora}` : ""}`;
  for (const x of us) {
    const f = await prisma.tarefa.create({ data: {
      titulo: TITULO(t), descricao: null, setor: t.setor, responsavelId: x.id, responsavelNome: nome(x), criadoPorId: u.id, criadoPorNome: nome(u),
      prazo: t.prazo, hora: t.hora, horaFim: t.horaFim, periodo: t.periodo, tipo: "PADRAO", publica: true, natureza: "FUNCIONAL", lembreteMin: t.lembreteMin,
      subtarefas: [], dependencias: [], colaboracao: { origemId: t.id, pedido, solicitanteId: u.id, solicitanteNome: nome(u) },
    } }).catch((e) => { console.log("colaboração/criar:", e.message); return null; });
    if (!f) continue;
    await avisar(u.id, x.id, `🤝 ${nome(u)} pediu sua COLABORAÇÃO em "${t.titulo}" (${quando}): ${pedido.slice(0, 600)} — abra a tarefa na Agenda para responder.`, f.id);
    try { const { notificar } = await import("@/lib/push"); await notificar(x.id, { titulo: `🤝 Colaboração: ${t.titulo}`, texto: `${nome(u)} pediu sua colaboração — ${pedido.slice(0, 120)}`, url: "/", tag: `colab-${f.id}` }); } catch {}
    try {
      if (x.email && (await emailDisponivel())) await enviarEmail({ para: x.email, assunto: `Pedido de colaboração: ${t.titulo}`,
        html: `<p>Olá, ${esc(x.nome)}.</p><p><b>${esc(nome(u))}</b> pediu sua colaboração na tarefa <b>${esc(t.titulo)}</b> (${esc(quando)}).</p>`
          + `<p><b>Colaboração necessária:</b><br>${esc(pedido)}</p>`
          + `<p>A tarefa <b>${esc(TITULO(t))}</b> já está na sua Agenda (em amarelo). Abra-a no sistema para escrever as informações e enviar os anexos.</p>` });
    } catch (e) { console.log("colaboração/e-mail:", e.message); }
  }
  await prisma.tarefa.update({ where: { id: t.id }, data: { colaboracao: quer.length ? { pedido, colaboradores: quer } : null } });
  return { ok: true };
}

// colaborador envia (ou reenvia) a resposta: texto + anexos já subidos na tarefa dele
export async function responderColaboracao(id, texto, u) {
  const f = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 }, include: { _count: { select: { arquivos: true } } } });
  if (!f || !ehFilha(f)) return { error: "Tarefa de colaboração não encontrada." };
  if (f.responsavelId !== u.id) return { error: "Só o colaborador responde esta colaboração." };
  const resposta = String(texto || "").trim().slice(0, 8000);
  if (!resposta && !f._count.arquivos) return { error: "Escreva as informações ou anexe um arquivo." };
  const reenvio = !!f.colaboracao.respondidoEm;
  await prisma.tarefa.update({ where: { id: f.id }, data: { colaboracao: { ...f.colaboracao, resposta, respondidoEm: new Date().toISOString() },
    status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nome(u), retorno: resposta || null, emAndamentoDesde: null } });
  const o = await prisma.tarefa.findUnique({ where: { id: Number(f.colaboracao.origemId) }, select: { id: true, titulo: true, responsavelId: true, criadoPorId: true } });
  const txt = `🤝 ${nome(u)} ${reenvio ? "atualizou" : "enviou"} a colaboração em "${o?.titulo || f.titulo}"${resposta ? `: ${resposta.slice(0, 400)}` : ""}${f._count.arquivos ? ` (${f._count.arquivos} anexo(s))` : ""} — veja na tarefa.`;
  for (const p of new Set([o?.responsavelId, o?.criadoPorId, f.colaboracao.solicitanteId].map(Number).filter(Boolean))) await avisar(u.id, p, txt, o?.id || f.id);
  return { ok: true };
}

// detalhe: na origem, as colaborações (com resposta e anexos); na filha, os dados da tarefa de origem
export async function dadosColaboracao(t) {
  if (ehFilha(t)) {
    const o = await prisma.tarefa.findUnique({ where: { id: Number(t.colaboracao.origemId) }, select: { id: true, titulo: true, descricao: true, responsavelNome: true, prazo: true, hora: true } });
    return { colabOrigem: o ? { ...o, prazo: iso(o.prazo) } : null };
  }
  if (!t.colaboracao?.colaboradores?.length) return {};
  const fs = await prisma.tarefa.findMany({ where: { colaboracao: { path: ["origemId"], equals: t.id } }, orderBy: { id: "asc" },
    include: { arquivos: { select: { id: true, nome: true, tamanho: true, createdAt: true } } } });
  return { colaboracoes: fs.filter((f) => f.status !== "CANCELADA").map((f) => ({ id: f.id, usuarioId: f.responsavelId, nome: f.responsavelNome, status: f.status,
    resposta: f.colaboracao?.resposta || "", respondidoEm: f.colaboracao?.respondidoEm || null, arquivos: f.arquivos })) };
}

// excluir a origem cancela as colaborações ainda em aberto
export async function cancelarColaboracoes(id) {
  await prisma.tarefa.updateMany({ where: { colaboracao: { path: ["origemId"], equals: Number(id) }, ...abertas }, data: { status: "CANCELADA" } }).catch(() => null);
}
