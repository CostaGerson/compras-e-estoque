export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { montarZip, mesAno, CFG_EMAIL, lerConfig, salvarConfig, emailValido } from "@/lib/finContab";
import { enviarEmail, emailDisponivel } from "@/lib/email";

// POST { usuarioId, competencia, email, mensagem? } → envia o ZIP para a contabilidade
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  if (!emailDisponivel()) return Response.json({ error: "Envio de e-mail não configurado na VPS (RESEND_API_KEY e RESEND_FROM no .env)." }, { status: 503 });

  const email = String(b.email || "").trim().toLowerCase();
  if (!emailValido(email)) return Response.json({ error: "Informe um e-mail válido para a contabilidade." }, { status: 400 });

  const z = await montarZip(b.competencia);
  if (!z) return Response.json({ error: "Nenhum documento enviado neste mês." }, { status: 400 });

  const ref = mesAno(b.competencia);
  const assunto = `MERIDIAN · Documentos contábeis ${ref}`;
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1F2733">
      <p>Olá,</p>
      <p>Seguem em anexo os documentos contábeis da <b>MERIDIAN</b> referentes a <b>${ref}</b>.</p>
      ${b.mensagem ? `<p>${String(b.mensagem).replace(/[<>]/g, "")}</p>` : ""}
      <p><b>${z.arquivos}</b> arquivo(s) no pacote:</p>
      <ul style="font-size:13px;color:#667085">${z.lista.map((n) => `<li>${n}</li>`).join("")}</ul>
      <p style="color:#667085;font-size:12px">Enviado por ${quem} pelo sistema de compras e estoque da Meridian.</p>
    </div>`;

  let envio = null, erro = null;
  try {
    envio = await enviarEmail({
      para: email, assunto, html,
      anexos: [{ filename: z.nome, content: z.buffer.toString("base64") }],
    });
  } catch (e) { erro = e.message; }

  await prisma.finContabEnvio.create({
    data: {
      competencia: b.competencia, email, assunto, arquivos: z.arquivos, tamanho: z.buffer.length,
      status: erro ? "ERRO" : "ENVIADO", erro: erro || null, enviadoPorNome: quem,
    },
  });
  // guarda o e-mail usado
  if (!erro) { const atual = await lerConfig(CFG_EMAIL); if (atual !== email) await salvarConfig(CFG_EMAIL, email); }

  if (erro) return Response.json({ error: erro }, { status: 502 });
  return Response.json({ ok: true, arquivos: z.arquivos, tamanho: z.buffer.length, nome: z.nome, id: envio.id });
}
