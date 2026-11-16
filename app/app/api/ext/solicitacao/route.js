// v872 — Gmail → solicitação de lançamento de pedido (script do Google na conta do Gmail, etiqueta "Pedidos a Lançar")
// Autenticação: cabeçalho X-Api-Key (o mesmo token das integrações — Dados › Integrações).
//   POST { acao: "criar", tipo?, idEmail, de, assunto, data, corpo, solicitante }  → { tarefaId, ja }   (um e-mail = uma tarefa; repetir não duplica)
//        tipo PEDIDO (padrão) → "LANÇAR PEDIDO" para o Leandro · v873 tipo FATURA → "LANÇAR FATURA/NOTA" para a Brenda (etiqueta "Fatura/nota a lançar")
//   POST { acao: "iniciar", nome, mime, tamanho }                            → { token, parte }  (arquivo grande, em partes)
//   POST { acao: "parte", token, off, conteudo }                             → { recebido, completo }   (conteudo em base64, até 8 MB)
//   POST { acao: "anexar", tarefaId, nome, mime, conteudo | token }          → { ok, id }
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { tokenExterno } from "@/lib/compras";
import { iniciar, parte, lerMeta, PARTE } from "@/lib/arquivos";
import { criar } from "@/lib/tarefas";
import { setorTarefaDe } from "@/lib/acesso";

const semAc = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

export async function POST(req) {
  const tk = req.headers.get("x-api-key") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "criar") {
      const id = String(b.idEmail || "").trim();
      if (!id) return Response.json({ error: "idEmail?" }, { status: 400 });
      const fatura = b.tipo === "FATURA";   // v873
      const chave = `gmail-solicitacao:${fatura ? "FATURA:" : ""}${id}`.slice(0, 190);
      const ja = await prisma.finConfig.findUnique({ where: { chave } });
      if (ja && (await prisma.tarefa.findUnique({ where: { id: Number(ja.valor) || 0 }, select: { id: true } }))) return Response.json({ tarefaId: Number(ja.valor), ja: true });
      const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true, email: true, setor: true, isMaster: true, diretoria: true } });
      const leandro = fatura ? us.find((u) => semAc(u.nome).startsWith("BRENDA"))
        : us.find((u) => semAc(u.nome).startsWith("LEANDRO") && u.setor === "PCP") || us.find((u) => semAc(u.nome).startsWith("LEANDRO"));
      if (!leandro) return Response.json({ error: `${fatura ? "Brenda" : "Leandro"} não encontrado(a) no cadastro de usuários.` }, { status: 400 });
      const em = String(b.solicitante || "").toLowerCase().trim();
      const quem = (em && us.find((u) => String(u.email || "").toLowerCase().trim() === em)) || us.find((u) => u.isMaster) || leandro;
      const assunto = String(b.assunto || "(sem assunto)").replace(/^\s*((ENC|FWD?|RES|RE)\s*:\s*)+/i, "").trim();
      const descricao = [`E-MAIL de ${b.de || "—"}${b.data ? ` · ${b.data}` : ""}`, `Assunto: ${b.assunto || "—"}`, "", String(b.corpo || "").trim().slice(0, 6000)].join("\n");
      const r = await criar({ titulo: `${fatura ? "LANÇAR FATURA/NOTA" : "LANÇAR PEDIDO"} · solicitado por ${nomeU(quem)} · e-mail: ${assunto}`.slice(0, 200), descricao,
        setor: setorTarefaDe(leandro), responsavelId: leandro.id, prazo: hojeSP(), tipo: "PADRAO" }, quem);
      if (r.error) return Response.json({ error: r.error }, { status: 400 });
      await prisma.finConfig.upsert({ where: { chave }, create: { chave, valor: String(r.tarefa.id) }, update: { valor: String(r.tarefa.id) } });
      return Response.json({ tarefaId: r.tarefa.id, ja: false });
    }
    if (b.acao === "iniciar") return Response.json({ token: await iniciar({ nome: b.nome, mime: b.mime, tamanho: b.tamanho, quem: "GMAIL" }), parte: PARTE });
    if (b.acao === "parte") return Response.json(await parte(b.token, Number(b.off) || 0, Buffer.from(String(b.conteudo || ""), "base64")));
    if (b.acao === "anexar") {
      const t = await prisma.tarefa.findUnique({ where: { id: Number(b.tarefaId) || 0 }, select: { id: true, responsavelNome: true } });
      if (!t) return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
      const nome = String(b.nome || "arquivo").slice(0, 250);
      if (await prisma.tarefaArquivo.findFirst({ where: { tarefaId: t.id, nome }, select: { id: true } })) return Response.json({ ok: true, ja: true });   // reenvio não duplica
      let conteudo, tamanho;
      if (b.token) { const m = await lerMeta(b.token); if (!m?.completo) return Response.json({ error: "Arquivo incompleto." }, { status: 400 }); conteudo = `arq:${b.token}`; tamanho = m.tamanho; }
      else { conteudo = String(b.conteudo || ""); tamanho = Math.floor(conteudo.length * 3 / 4); }
      const a = await prisma.tarefaArquivo.create({ data: { tarefaId: t.id, nome, mime: b.mime || null, tamanho, conteudo, criadoPorNome: "E-MAIL" } });
      return Response.json({ ok: true, id: a.id });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { console.log("ext/solicitacao:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}
