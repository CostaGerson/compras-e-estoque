// v167 — redefinição de senha pelo próprio usuário, com link por e-mail (Resend)
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel } from "@/lib/email";

export const VALIDADE_MIN = 60;                 // o link vale 1 hora
export const SENHA_MIN = 6;
const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const nome = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ");
const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// endereço do sistema: APP_URL do .env ou o próprio endereço que o usuário abriu
export function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "147.93.35.189:3010";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

const moldura = (titulo, corpo) => `
<div style="font-family:Montserrat,Arial,sans-serif;background:#F5F6F8;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden">
    <div style="background:#001E41;color:#fff;padding:16px 20px;font-weight:700;letter-spacing:1px">MERIDIAN</div>
    <div style="padding:20px;color:#1F2733;font-size:14px;line-height:1.5">
      <div style="font-weight:700;font-size:16px;margin-bottom:12px">${titulo}</div>${corpo}
    </div>
  </div>
</div>`;

// procura por login ou e-mail; sempre responde igual (não revela se o usuário existe)
export async function pedirRedefinicao(chave, base) {
  const k = String(chave || "").trim().toLowerCase();
  if (!k) return { ok: false, erro: "Informe seu usuário ou e-mail." };
  if (!emailDisponivel()) return { ok: false, erro: "O envio de e-mail não está configurado. Fale com o master." };
  const u = await prisma.usuario.findFirst({ where: { ativo: true, OR: [{ login: k }, { email: k }] } });
  if (u && u.email) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.usuario.update({ where: { id: u.id }, data: { resetHash: sha(token), resetExpira: new Date(Date.now() + VALIDADE_MIN * 60000) } });
    const link = `${base}/?redefinir=${token}`;
    await enviarEmail({
      para: u.email,
      assunto: "Meridian — redefinir sua senha",
      html: moldura("Redefinir senha", `
        <p>Olá, ${esc(nome(u))}.</p>
        <p>Recebemos um pedido para redefinir a senha do usuário <b>${esc(u.login)}</b> no sistema de gestão da Meridian.</p>
        <p style="margin:20px 0"><a href="${link}" style="background:#FF6B1A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Criar nova senha</a></p>
        <p style="color:#667085;font-size:12px">O link vale ${VALIDADE_MIN} minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
        <p style="color:#667085;font-size:12px;word-break:break-all">${esc(link)}</p>`),
      texto: `Para criar uma nova senha do usuário ${u.login}, abra: ${link} (vale ${VALIDADE_MIN} minutos).`,
    });
  }
  return { ok: true, msg: "Se o usuário existir e tiver e-mail cadastrado, enviamos um link para criar a nova senha. Confira sua caixa de entrada (e o spam)." };
}

export async function conferirToken(token) {
  const t = String(token || "");
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  const u = await prisma.usuario.findFirst({ where: { resetHash: sha(t), ativo: true } });
  if (!u || !u.resetExpira || u.resetExpira < new Date()) return null;
  return u;
}

export async function redefinir(token, senha, confirma) {
  const s = String(senha || "");
  if (s.length < SENHA_MIN) return { ok: false, erro: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` };
  if (confirma !== undefined && s !== String(confirma)) return { ok: false, erro: "As duas senhas não conferem." };
  const u = await conferirToken(token);
  if (!u) return { ok: false, erro: "Link inválido ou vencido. Peça um novo em \"Esqueci minha senha\"." };
  await prisma.usuario.update({ where: { id: u.id }, data: { senha: s, resetHash: null, resetExpira: null } });
  // e-mail de confirmação da troca
  if (u.email && emailDisponivel()) {
    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await enviarEmail({
      para: u.email,
      assunto: "Meridian — sua senha foi alterada",
      html: moldura("Senha alterada", `
        <p>Olá, ${esc(nome(u))}.</p>
        <p>A senha do usuário <b>${esc(u.login)}</b> foi alterada em ${esc(quando)}.</p>
        <p style="color:#667085;font-size:12px">Se não foi você, avise o master imediatamente para bloquear o acesso.</p>`),
      texto: `A senha do usuário ${u.login} foi alterada em ${quando}. Se não foi você, avise o master.`,
    }).catch(() => {});
  }
  return { ok: true, login: u.login, msg: "Senha alterada. Enviamos um e-mail de confirmação. Já pode entrar com a nova senha." };
}
