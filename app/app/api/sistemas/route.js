// v907 — Gestão › Sistemas do grupo: situação das integrações do ERP com o PCP (Maycon), o CRM (Pedro) e o dashboard NORT (Gerson)
//   GET ?u= → { sistemas: [{ chave, ativo, ultima, detalhe }] }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";

const H = 3600e3;
async function cfgJson(chave) { try { return JSON.parse((await prisma.finConfig.findUnique({ where: { chave } }))?.valor || "{}"); } catch { return {}; } }

async function pcp() {
  const s = await cfgJson("CRONO|SYNC");
  const em = s.em || s.ultima || null;
  const ok = s.ok !== false && !s.erro && em && Date.now() - new Date(em).getTime() < 24 * H;
  return { chave: "PCP", ativo: !!ok, ultima: em, detalhe: s.erro ? `Última leitura com erro: ${String(s.erro).slice(0, 120)}` : em ? "Leitura do Cronograma (pedidos e etapas)" : "Ainda sem leitura do Cronograma" };
}
async function crm() {
  if (!process.env.CRM_DATABASE_URL) return { chave: "CRM", ativo: false, ultima: null, detalhe: "Banco do CRM não configurado no servidor" };
  try {
    const { crmPool } = await import("@/lib/crm");
    const t0 = Date.now();
    await Promise.race([crmPool().query("select 1"), new Promise((_, rej) => setTimeout(() => rej(new Error("sem resposta")), 4000))]);
    return { chave: "CRM", ativo: true, ultima: new Date().toISOString(), detalhe: `Banco do CRM respondeu em ${Date.now() - t0} ms` };
  } catch (e) { return { chave: "CRM", ativo: false, ultima: null, detalhe: `CRM sem resposta: ${e.message}` }; }
}
async function nort() {
  const [m, p] = await Promise.all([
    prisma.nortMov.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null),
    prisma.pp.findFirst({ where: { extRef: { startsWith: "NORT|" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null),
  ]);
  const em = [m?.createdAt, p?.createdAt].filter(Boolean).sort((a, b) => b - a)[0] || null;
  return { chave: "NORT", ativo: !!em && Date.now() - new Date(em).getTime() < 48 * H, ultima: em,
    detalhe: em ? "Último envio de estoque ou pedido da loja" : "A loja ainda não enviou estoque nem pedidos" };
}

export async function GET(req) {
  const u = await usuarioAtivoFin(new URL(req.url).searchParams.get("u"));
  if (!u || u.setor === "CLIENTE") return Response.json({ error: "Sem acesso." }, { status: 403 });
  const sistemas = await Promise.all([pcp(), crm(), nort()]);
  return Response.json({ sistemas, em: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
