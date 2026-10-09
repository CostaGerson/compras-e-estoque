// v168 — sugestões de melhoria: qualquer usuário envia; o master julga em Desenvolvimento.
// Acatar (depois que a alteração subiu) ou recusar (com motivo) avisa o autor por mensagem do sistema e por e-mail.
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel } from "@/lib/email";
import { ehMaster } from "@/lib/acesso";

const nome = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const STATUS = { NOVA: "Nova", EM_ANALISE: "Em análise", ACATADA: "Acatada", RECUSADA: "Recusada" };

export async function usuarioAtivo(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, email: true, setor: true, isMaster: true, ativo: true, diretoria: true } });
  return u && u.ativo ? u : null;
}

export async function criar(u, { texto, tela }) {
  const t = String(texto || "").trim();
  if (t.length < 10) return { error: "Descreva a melhoria com um pouco mais de detalhe (mínimo 10 caracteres)." };
  const s = await prisma.sugestao.create({ data: { usuarioId: u.id, usuarioNome: nome(u), setor: u.setor, tela: String(tela || "").slice(0, 80) || null, texto: t.slice(0, 4000) } });
  // avisa os masters na caixa de entrada
  const masters = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { setor: "FINANCEIRO", diretoria: false }] }, select: { id: true } });
  const para = masters.filter((m) => m.id !== u.id);
  if (para.length) await prisma.mensagem.createMany({ data: para.map((m) => ({ deId: u.id, paraId: m.id, texto: `💡 SUGESTÃO DE MELHORIA #${s.id} de ${nome(u)}${s.tela ? ` (tela ${s.tela})` : ""}: ${t.slice(0, 600)} — veja em Desenvolvimento.` })) });
  return { ok: true, sugestao: s };
}

export async function listar(u) {
  const where = ehMaster(u) ? {} : { usuarioId: u.id };
  return prisma.sugestao.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 500 });
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
  if (fecha) {
    const autor = await prisma.usuario.findUnique({ where: { id: s.usuarioId }, select: { id: true, nome: true, email: true } });
    const resumo = s.texto.length > 300 ? `${s.texto.slice(0, 300)}…` : s.texto;
    const txt = acao === "ACATAR"
      ? `✅ SUA SUGESTÃO #${s.id} FOI ACATADA e a alteração já está no sistema. "${resumo}"${r ? ` — ${r}` : ""} Obrigado pela contribuição!`
      : `❌ SUA SUGESTÃO #${s.id} NÃO FOI ACATADA. "${resumo}" — MOTIVO: ${r}`;
    if (autor && autor.id !== master.id) { await prisma.mensagem.create({ data: { deId: master.id, paraId: autor.id, texto: txt.slice(0, 2000) } }); avisos.mensagem = true; }
    if (autor?.email && emailDisponivel()) {
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
