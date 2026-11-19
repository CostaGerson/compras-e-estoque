// v168 — sugestões de melhoria: qualquer usuário envia; o master julga em Desenvolvimento.
// Acatar (depois que a alteração subiu) ou recusar (com motivo) avisa o autor por mensagem do sistema e por e-mail.
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel } from "@/lib/email";
import { ehMaster } from "@/lib/acesso";

const nome = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const STATUS = { NOVA: "Nova", EM_ANALISE: "Em análise", AGUARDANDO: "Aguardando o autor", ACATADA: "Acatada", RECUSADA: "Recusada" };

export async function usuarioAtivo(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, email: true, setor: true, isMaster: true, ativo: true, diretoria: true } });
  return u && u.ativo ? u : null;
}

export const LIMITE_ANEXO = 10 * 1024 * 1024, MAX_ANEXOS = 10;
export async function criar(u, { texto, tela, anexos }) {
  const t = String(texto || "").trim();
  if (t.length < 10) return { error: "Descreva a melhoria com um pouco mais de detalhe (mínimo 10 caracteres)." };
  const arqs = (Array.isArray(anexos) ? anexos : []).filter((a) => a?.conteudo && a?.nome);
  if (arqs.length > MAX_ANEXOS) return { error: `No máximo ${MAX_ANEXOS} anexos por sugestão.` };
  for (const a of arqs) if (Math.floor(String(a.conteudo).length * 3 / 4) > LIMITE_ANEXO) return { error: `${a.nome}: maior que 10 MB.` };
  const s = await prisma.sugestao.create({ data: { usuarioId: u.id, usuarioNome: nome(u), setor: u.setor, tela: String(tela || "").slice(0, 80) || null, texto: t.slice(0, 4000),
    anexos: { create: arqs.map((a) => ({ nome: String(a.nome).slice(0, 200), mime: a.mime || null, tamanho: Math.floor(String(a.conteudo).length * 3 / 4), conteudo: String(a.conteudo) })) } } });
  // avisa os masters na caixa de entrada
  const masters = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }] }, select: { id: true } });
  const para = masters.filter((m) => m.id !== u.id);
  if (para.length) await prisma.mensagem.createMany({ data: para.map((m) => ({ deId: u.id, paraId: m.id, texto: `💡 SUGESTÃO DE MELHORIA #${s.id} de ${nome(u)}${s.tela ? ` (tela ${s.tela})` : ""}: ${t.slice(0, 600)}${arqs.length ? ` · ${arqs.length} anexo(s)` : ""} — veja em Desenvolvimento.` })) });
  return { ok: true, sugestao: s };
}

// v849 — sugestão respondida (acatada ou recusada): o aviso "💡 SUGESTÃO DE MELHORIA #id" sai das recebidas de todos (vai para arquivadas)
export async function arquivarAvisos(ids) {
  const l = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  if (!l.length) return 0;
  const r = await prisma.mensagem.updateMany({ where: { arquivada: false, OR: [...l.map((id) => ({ texto: { startsWith: `💡 SUGESTÃO DE MELHORIA #${id} ` } })), { sugestaoId: { in: l } }] }, data: { arquivada: true, lida: true, prioritaria: false } }).catch(() => ({ count: 0 }));   // v1006 — perguntas/respostas também
  return r.count;
}

export async function listar(u) {
  // v849 — também arquiva os avisos das que já foram respondidas antes desta versão
  if (ehMaster(u)) { const resp = await prisma.sugestao.findMany({ where: { status: { in: ["ACATADA", "RECUSADA"] } }, select: { id: true } }).catch(() => []); await arquivarAvisos(resp.map((x) => x.id)); }
  const where = ehMaster(u) ? {} : { usuarioId: u.id };
  return prisma.sugestao.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 500,
    include: { anexos: { select: { id: true, nome: true, mime: true, tamanho: true }, orderBy: { id: "asc" } } } });
}

// arquivo de um anexo — só o autor da sugestão ou o master
export async function anexo(u, id) {
  const a = await prisma.sugestaoAnexo.findUnique({ where: { id: Number(id) || 0 }, include: { sugestao: { select: { usuarioId: true } } } });
  if (!a || (!ehMaster(u) && a.sugestao.usuarioId !== u.id)) return null;
  return a;
}

// acao: ANALISE | ACATAR | RECUSAR | REABRIR
export async function decidir(id, acao, resposta, master) {
  const s = await prisma.sugestao.findUnique({ where: { id: Number(id) || 0 } });
  if (!s) return { error: "Sugestão não encontrada." };
  const r = String(resposta || "").trim();
  if (acao === "RECUSAR" && r.length < 5) return { error: "Preencha a justificativa da recusa." };
  const status = { ANALISE: "EM_ANALISE", ACATAR: "ACATADA", RECUSAR: "RECUSADA", REABRIR: "NOVA" }[acao];
  if (!status) return { error: "Ação inválida." };
  const fecha = acao === "ACATAR" || acao === "RECUSAR";
  const novo = await prisma.sugestao.update({ where: { id: s.id }, data: {
    status, resposta: fecha ? (r || null) : acao === "REABRIR" ? null : s.resposta,
    respondidoPor: fecha ? nome(master) : acao === "REABRIR" ? null : s.respondidoPor, respondidoEm: fecha ? new Date() : acao === "REABRIR" ? null : s.respondidoEm,
  } });
  let avisos = { mensagem: false, email: null };
  if (fecha) await arquivarAvisos(s.id);   // v849
  if (fecha) {
    const autor = await prisma.usuario.findUnique({ where: { id: s.usuarioId }, select: { id: true, nome: true, email: true } });
    const resumo = s.texto.length > 300 ? `${s.texto.slice(0, 300)}…` : s.texto;
    const txt = acao === "ACATAR"
      ? `✅ SUA SUGESTÃO #${s.id} FOI ACATADA e a alteração já está no sistema. "${resumo}"${r ? ` — ${r}` : ""} Obrigado pela contribuição!`
      : `❌ SUA SUGESTÃO #${s.id} NÃO FOI ACATADA. "${resumo}" — MOTIVO: ${r}`;
    if (autor && autor.id !== master.id) { await prisma.mensagem.create({ data: { deId: master.id, paraId: autor.id, texto: txt.slice(0, 2000) } }); avisos.mensagem = true; }
    if (autor?.email && (await emailDisponivel())) {
      const ok = acao === "ACATAR";
      try {
        await enviarEmail({
          para: autor.email,
          assunto: ok ? `Meridian — sua sugestão #${s.id} foi acatada` : `Meridian — retorno da sua sugestão #${s.id}`,
          html: `<div style="font-family:Montserrat,Arial,sans-serif;background:#F5F6F8;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden">
            <div style="background:#001E41;color:#fff;padding:16px 20px;font-weight:700;letter-spacing:1px">MERIDIAN</div>
            <div style="padding:20px;color:#1F2733;font-size:14px;line-height:1.5">
              <div style="font-weight:700;font-size:16px;margin-bottom:12px;color:${ok ? "#12A150" : "#D92D20"}">${ok ? "Sugestão acatada" : "Sugestão não acatada"}</div>
              <p>Olá, ${esc(autor.nome)}.</p>
              <p>${ok ? "A melhoria que você sugeriu foi aceita e <b>já está no sistema</b>. Obrigado pela contribuição!" : "Analisamos a melhoria que você sugeriu e, desta vez, ela não será feita."}</p>
              <div style="background:#F1F3F5;border-radius:8px;padding:12px;margin:12px 0;font-size:13px">${esc(s.texto)}</div>
              ${r ? `<p><b>${ok ? "Observação" : "Motivo"}:</b> ${esc(r)}</p>` : ""}
              <p style="color:#667085;font-size:12px">Respondido por ${esc(nome(master))}.</p>
            </div></div></div>`,
          texto: `${txt}`,
        });
        avisos.email = true;
      } catch (e) { avisos.email = `não enviado: ${e.message}`; }
    } else avisos.email = autor?.email ? "envio de e-mail não configurado" : "autor sem e-mail cadastrado";
  }
  return { ok: true, sugestao: novo, avisos };
}

// ---------- v1006 — aprofundar: o master pergunta, o autor responde (caixa de entrada, e-mail e na própria sugestão) ----------
const conversa = (s) => (Array.isArray(s?.conversa) ? s.conversa : []);
export async function aprofundar(id, texto, master) {
  const s = await prisma.sugestao.findUnique({ where: { id: Number(id) || 0 } });
  if (!s) return { error: "Sugestão não encontrada." };
  const t = String(texto || "").trim();
  if (t.length < 3) return { error: "Escreva a pergunta para o autor." };
  const conv = [...conversa(s), { de: "MASTER", nome: nome(master), texto: t.slice(0, 4000), em: new Date().toISOString() }];
  const novo = await prisma.sugestao.update({ where: { id: s.id }, data: { conversa: conv, status: "AGUARDANDO" } });
  const resumo = s.texto.length > 200 ? `${s.texto.slice(0, 200)}…` : s.texto;
  const avisos = { mensagem: false, email: null };
  if (s.usuarioId !== master.id) {
    await prisma.mensagem.create({ data: { deId: master.id, paraId: s.usuarioId, sugestaoId: s.id, prioritaria: true,
      texto: `❓ SOBRE A SUA SUGESTÃO #${s.id}, ${nome(master)} quer entender melhor: ${t}\n\nSua sugestão: "${resumo}"\n\nResponda aqui mesmo, no campo abaixo.`.slice(0, 2000) } });
    avisos.mensagem = true;
  }
  const autor = await prisma.usuario.findUnique({ where: { id: s.usuarioId }, select: { nome: true, email: true } });
  if (autor?.email && (await emailDisponivel())) {
    try {
      await enviarEmail({ para: autor.email, assunto: `Meridian — perguntas sobre a sua sugestão #${s.id}`,
        html: `<div style="font-family:Montserrat,Arial,sans-serif;background:#F5F6F8;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden">
          <div style="background:#001E41;color:#fff;padding:16px 20px;font-weight:700;letter-spacing:1px">MERIDIAN</div>
          <div style="padding:20px;color:#1F2733;font-size:14px;line-height:1.5"><p>Olá, ${esc(autor.nome)}.</p>
          <p><b>${esc(nome(master))}</b> quer entender melhor a sua sugestão de melhoria:</p>
          <div style="background:#FFF6DD;border-radius:8px;padding:12px;margin:12px 0">${esc(t).replace(/\n/g, "<br>")}</div>
          <div style="background:#F1F3F5;border-radius:8px;padding:12px;margin:12px 0;font-size:13px">${esc(s.texto)}</div>
          <p>Responda pela <b>caixa de entrada</b> do sistema (a mensagem já está lá) ou pela lâmpada de sugestões.</p></div></div></div>`, texto: `${nome(master)} quer entender melhor a sua sugestão #${s.id}: ${t}` });
      avisos.email = true;
    } catch (e) { avisos.email = `não enviado: ${e.message}`; }
  }
  return { ok: true, sugestao: novo, avisos };
}
export async function responderAutor(id, texto, u) {
  const s = await prisma.sugestao.findUnique({ where: { id: Number(id) || 0 } });
  if (!s) return { error: "Sugestão não encontrada." };
  if (s.usuarioId !== u.id) return { error: "Só quem enviou a sugestão responde." };
  if (["ACATADA", "RECUSADA"].includes(s.status)) return { error: "Esta sugestão já foi decidida." };
  const t = String(texto || "").trim();
  if (t.length < 2) return { error: "Escreva a resposta." };
  const conv = [...conversa(s), { de: "AUTOR", nome: nome(u), texto: t.slice(0, 4000), em: new Date().toISOString() }];
  const novo = await prisma.sugestao.update({ where: { id: s.id }, data: { conversa: conv, status: "EM_ANALISE" } });
  // as perguntas respondidas saem das prioritárias do autor; os masters recebem a resposta
  await prisma.mensagem.updateMany({ where: { paraId: u.id, sugestaoId: s.id }, data: { lida: true, prioritaria: false } }).catch(() => null);
  const ultMaster = [...conv].reverse().find((x) => x.de === "MASTER");
  const masters = await prisma.usuario.findMany({ where: { ativo: true, isMaster: true }, select: { id: true } });
  const para = masters.filter((m) => m.id !== u.id);
  if (para.length) await prisma.mensagem.createMany({ data: para.map((m) => ({ deId: u.id, paraId: m.id, sugestaoId: s.id,
    texto: `💬 RESPOSTA À SUGESTÃO #${s.id} de ${nome(u)}: ${t}${ultMaster ? `\n\nPergunta: "${ultMaster.texto.slice(0, 300)}"` : ""} — veja em Desenvolvimento.`.slice(0, 2000) })) });
  return { ok: true, sugestao: novo };
}
