// Envio de e-mail pela API do Resend (sem dependência nova: chamada direta por fetch).
// .env da VPS:
//   RESEND_API_KEY=re_...
//   RESEND_FROM=Meridian <financeiro@seu-dominio.com.br>   # domínio verificado no Resend
import { prisma } from "@/lib/prisma";

// v893 — chave e remetente configuráveis pela tela (Usuários › E-mail), gravados em FinConfig "EMAIL|RESEND";
//   sem configuração na tela, valem RESEND_API_KEY / RESEND_FROM do .env
export const CHAVE_CFG = "EMAIL|RESEND";
let cache = null, cacheEm = 0;
export async function configEmail() {
  if (cache && Date.now() - cacheEm < 60e3) return cache;
  let c = {};
  try { const r = await prisma.finConfig.findUnique({ where: { chave: CHAVE_CFG } }); if (r) c = JSON.parse(r.valor) || {}; } catch {}
  cache = { chave: c.chave || process.env.RESEND_API_KEY || "", from: c.from || process.env.RESEND_FROM || "", origem: c.chave ? "tela" : process.env.RESEND_API_KEY ? "env" : null, dominioId: c.dominioId || null };
  cacheEm = Date.now();
  return cache;
}
export const limparCacheEmail = () => { cache = null; };
export async function emailDisponivel() { const c = await configEmail(); return !!c.chave && !!c.from; }

// chamada à API do Resend com a chave configurada (ou uma chave informada)
export async function resendApi(caminho, { method = "GET", body, chave } = {}) {
  const k = chave || (await configEmail()).chave;
  if (!k) throw new Error("Falta a chave da API do Resend.");
  const r = await fetch(`https://api.resend.com${caminho}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${k}` }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.message || j?.error?.message || `O Resend respondeu ${r.status}.`); e.status = r.status; throw e; }
  return j;
}

export const LIMITE_ANEXO = 38 * 1024 * 1024; // o Resend recusa acima de ~40 MB

export async function enviarEmail({ para, assunto, html, texto, anexos = [], responderPara }) {
  const cfg = await configEmail();
  if (!cfg.chave) throw new Error("Envio de e-mail não configurado: falta a chave do Resend (Usuários › E-mail).");
  if (!cfg.from) throw new Error("Envio de e-mail não configurado: falta o remetente (Usuários › E-mail).");

  const soma = anexos.reduce((s, a) => s + Buffer.byteLength(a.content, "base64"), 0);
  if (soma > LIMITE_ANEXO) {
    throw new Error(`O pacote tem ${(soma / 1048576).toFixed(1)} MB e o limite por e-mail é 38 MB. Baixe o ZIP e envie por link (Drive/WeTransfer).`);
  }

  const body = {
    from: cfg.from,
    to: Array.isArray(para) ? para : [para],
    subject: assunto,
    html: html || undefined,
    text: texto || undefined,
    attachments: anexos.map((a) => ({ filename: a.filename, content: a.content })),
  };
  if (responderPara) body.reply_to = responderPara;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.chave}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error?.message || `O Resend respondeu ${r.status}.`);
  return { id: j.id, tamanho: soma };
}
