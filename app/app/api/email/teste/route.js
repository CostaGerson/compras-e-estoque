// v511 — situação do Resend e e-mail de teste (só master)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel } from "@/lib/email";

async function master(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 } });
  return u && u.ativo && u.isMaster ? u : null;
}
export async function GET(req) {
  const u = await master(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Só master." }, { status: 403 });
  return Response.json({ ok: emailDisponivel(), chave: !!process.env.RESEND_API_KEY, remetente: process.env.RESEND_FROM || null, appUrl: process.env.APP_URL || null, emailUsuario: u.email || null });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await master(b.usuarioId);
  if (!u) return Response.json({ error: "Só master." }, { status: 403 });
  const para = String(b.para || u.email || "").trim();
  if (!para) return Response.json({ error: "Informe o e-mail de destino (seu cadastro está sem e-mail)." }, { status: 400 });
  try {
    const r = await enviarEmail({ para, assunto: "ERP Meridian · e-mail de teste", html: `<div style="font-family:Arial,sans-serif;color:#0c2342"><h2 style="margin:0 0 8px">Envio de e-mails funcionando ✅</h2><p>Este é um teste do ERP Meridian (${process.env.APP_URL || "erp.meridianpro.com.br"}), enviado por ${[u.nome, u.sobrenome].filter(Boolean).join(" ")}.</p><p style="color:#667085;font-size:12px">Remetente: ${process.env.RESEND_FROM || ""}</p></div>` });
    return Response.json({ ok: true, id: r.id, para });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
