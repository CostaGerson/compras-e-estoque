// Envio de e-mail pela API do Resend (sem dependência nova: chamada direta por fetch).
// .env da VPS:
//   RESEND_API_KEY=re_...
//   RESEND_FROM=Meridian <financeiro@seu-dominio.com.br>   # domínio verificado no Resend
export const emailDisponivel = () => !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;

export const LIMITE_ANEXO = 38 * 1024 * 1024; // o Resend recusa acima de ~40 MB

export async function enviarEmail({ para, assunto, html, texto, anexos = [], responderPara }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY no .env da VPS.");
  if (!process.env.RESEND_FROM) throw new Error("Falta RESEND_FROM no .env da VPS (remetente do domínio verificado).");

  const soma = anexos.reduce((s, a) => s + Buffer.byteLength(a.content, "base64"), 0);
  if (soma > LIMITE_ANEXO) {
    throw new Error(`O pacote tem ${(soma / 1048576).toFixed(1)} MB e o limite por e-mail é 38 MB. Baixe o ZIP e envie por link (Drive/WeTransfer).`);
  }

  const body = {
    from: process.env.RESEND_FROM,
    to: Array.isArray(para) ? para : [para],
    subject: assunto,
    html: html || undefined,
    text: texto || undefined,
    attachments: anexos.map((a) => ({ filename: a.filename, content: a.content })),
  };
  if (responderPara) body.reply_to = responderPara;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error?.message || `O Resend respondeu ${r.status}.`);
  return { id: j.id, tamanho: soma };
}
