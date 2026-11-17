// v511 — situação do Resend e e-mail de teste (só master)
// v893 — configuração pela tela: chave da API, remetente e domínio (cadastrar no Resend, ver os registros DNS e verificar)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { enviarEmail, configEmail, limparCacheEmail, resendApi, CHAVE_CFG } from "@/lib/email";

async function master(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 } });
  return u && u.ativo && u.isMaster ? u : null;
}
const dominioDe = (from) => (String(from || "").match(/@([^>\s]+)/) || [])[1]?.toLowerCase() || "";
const mascara = (k) => (k ? `${k.slice(0, 6)}…${k.slice(-4)}` : "");
const registros = (d) => (d?.records || []).map((r) => ({ registro: r.record, tipo: r.type, nome: r.name, valor: r.value, prioridade: r.priority ?? null, status: r.status }));

// domínio do remetente no Resend: { id, nome, status, registros } | { erro }
async function dominio(cfg, criar = false) {
  const nome = dominioDe(cfg.from);
  if (!nome || !cfg.chave) return null;
  try {
    const l = await resendApi("/domains", { chave: cfg.chave });
    let d = (l.data || []).find((x) => String(x.name).toLowerCase() === nome);
    if (!d && criar) d = await resendApi("/domains", { method: "POST", body: { name: nome, region: "sa-east-1" }, chave: cfg.chave });
    if (!d) return { nome, status: "nao_cadastrado", registros: [] };
    const full = await resendApi(`/domains/${d.id}`, { chave: cfg.chave });
    return { id: full.id, nome: full.name, status: full.status, registros: registros(full) };
  } catch (e) {
    return { nome, erro: e.status === 401 || e.status === 403 ? "A chave não tem permissão para ver domínios (crie a chave com \"Full access\" para conferir por aqui)." : e.message };
  }
}

async function situacao(u) {
  const c = await configEmail();
  return { ok: !!c.chave && !!c.from, chave: !!c.chave, chaveMascara: mascara(c.chave), origem: c.origem, remetente: c.from || null,
    appUrl: process.env.APP_URL || null, emailUsuario: u.email || null, dominio: await dominio(c) };
}

export async function GET(req) {
  const u = await master(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Só master." }, { status: 403 });
  return Response.json(await situacao(u));
}

// POST { usuarioId, acao: teste|salvar|dominio|verificar, para, chave, from }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await master(b.usuarioId);
  if (!u) return Response.json({ error: "Só master." }, { status: 403 });
  const acao = b.acao || "teste";
  try {
    if (acao === "salvar") {
      const atual = await configEmail();
      const chave = String(b.chave || "").trim() || (atual.origem === "tela" ? atual.chave : "");
      const from = String(b.from || "").trim();
      if (!chave) return Response.json({ error: "Cole a chave da API do Resend (começa com re_)." }, { status: 400 });
      if (!/^re_/.test(chave)) return Response.json({ error: "A chave do Resend começa com re_." }, { status: 400 });
      if (!dominioDe(from)) return Response.json({ error: "Remetente inválido. Ex.: ERP Meridian <nao-responda@meridianpro.com.br>" }, { status: 400 });
      await prisma.finConfig.upsert({ where: { chave: CHAVE_CFG }, update: { valor: JSON.stringify({ chave, from, em: new Date().toISOString(), por: u.id }) },
        create: { chave: CHAVE_CFG, valor: JSON.stringify({ chave, from, em: new Date().toISOString(), por: u.id }) } });
      limparCacheEmail();
      return Response.json({ ok: true, ...(await situacao(u)) });
    }
    if (acao === "dominio") {   // cadastra o domínio do remetente no Resend e devolve os registros DNS
      const d = await dominio(await configEmail(), true);
      return Response.json({ ok: !d?.erro, ...(await situacao(u)), ...(d?.erro ? { error: d.erro } : {}) }, { status: d?.erro ? 400 : 200 });
    }
    if (acao === "verificar") {
      const d = await dominio(await configEmail());
      if (!d?.id) return Response.json({ error: d?.erro || "Domínio ainda não cadastrado no Resend." }, { status: 400 });
      await resendApi(`/domains/${d.id}/verify`, { method: "POST" });
      await new Promise((r) => setTimeout(r, 1500));
      return Response.json({ ok: true, ...(await situacao(u)) });
    }
    const para = String(b.para || u.email || "").trim();
    if (!para) return Response.json({ error: "Informe o e-mail de destino (seu cadastro está sem e-mail)." }, { status: 400 });
    const c = await configEmail();
    const r = await enviarEmail({ para, assunto: "ERP Meridian · e-mail de teste", html: `<div style="font-family:Arial,sans-serif;color:#0c2342"><h2 style="margin:0 0 8px">Envio de e-mails funcionando ✅</h2><p>Este é um teste do ERP Meridian (${process.env.APP_URL || "erp.meridianpro.com.br"}), enviado por ${[u.nome, u.sobrenome].filter(Boolean).join(" ")}.</p><p style="color:#667085;font-size:12px">Remetente: ${c.from.replace(/</g, "&lt;")}</p></div>` });
    return Response.json({ ok: true, id: r.id, para });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
