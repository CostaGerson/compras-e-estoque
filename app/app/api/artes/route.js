// v1003 — Dados › Artes e layouts (Google Drive)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { listarArtes, configDrive, salvarConfig, testar, sincronizarArtes, enviarManual, baixarArte, excluirArte, scriptApps } from "@/lib/artesDrive";

const usuario = async (id) => { const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, ativo: true, isMaster: true } }).catch(() => null); return u?.ativo ? u : null; };
const nome = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u=&q=&tipo=&origem= → lista + resumo · ?u=&baixar=id[&inline=1] → arquivo
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuario(sp.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  if (sp.get("baixar")) {
    const a = await baixarArte(sp.get("baixar")).catch((e) => ({ erro: e.message }));
    if (!a?.base64) return new Response(a?.erro ? `Não foi possível ler: ${a.erro}` : "Arquivo não encontrado.", { status: 404 });
    return new Response(Buffer.from(a.base64, "base64"), { headers: { "Cache-Control": "private, max-age=300", "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `${sp.get("inline") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nome || "arte")}` } });
  }
  const cfg = await configDrive();
  const itens = await listarArtes({ q: sp.get("q"), tipo: sp.get("tipo") || null, origem: sp.get("origem") || null });
  const resumo = itens.reduce((m, x) => ((m[x.status] = (m[x.status] || 0) + 1), m), {});
  return Response.json({ itens, resumo, config: { configurado: !!cfg.url, url: u.isMaster ? cfg.url : undefined, pasta: cfg.pasta, pastaNome: cfg.pastaNome, testadoEm: cfg.testadoEm,
    script: u.isMaster ? scriptApps(cfg.segredo, cfg.pasta) : undefined }, master: !!u.isMaster });
}

// POST { usuarioId, acao: config|testar|sincronizar|enviar|excluir, ... }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuario(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = (x, st) => Response.json(x, { status: st || (x?.error ? 400 : 200) });
  try {
    if (b.acao === "config") { if (!u.isMaster) return r({ error: "Só o master configura." }); return r(await salvarConfig(b)); }
    if (b.acao === "testar") return r(await testar());
    if (b.acao === "sincronizar") return r(await sincronizarArtes() || { ok: true, ocupado: true });
    if (b.acao === "enviar") return r(await enviarManual(b, nome(u)));
    if (b.acao === "excluir") return r(await excluirArte(b.id, nome(u)));
    return r({ error: "Ação?" });
  } catch (e) { return r({ error: e.message }, 500); }
}
