export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { acompanhamento, diaDoTokenPublico, destinos, salvarDemanda, consolidarDemandas, motoristas } from "@/lib/rotas";
import { autocompletar, lugar } from "@/lib/googleMaps";

// v576/v579/v582 — página pública de acompanhamento do dia (link do grupo do WhatsApp). Sem login: vale o token.
// GET                    → rotas do dia ao vivo + demandas + usuários (para escolher quem pede) + motoristas
// GET ?destinos=1 | ?auto= | ?lugar=   → os mesmos auxiliares do formulário de demanda do sistema
// POST { usuarioId, acao: "demanda", demanda } | { usuarioId, acao: "consolidar", ids }
const limite = globalThis.__acompLimite || (globalThis.__acompLimite = new Map());
const sel = { id: true, nome: true, sobrenome: true, setor: true, isMaster: true, diretoria: true, ativo: true, pessoaId: true };

export async function GET(req, { params }) {
  const q = new URL(req.url).searchParams;
  const dia = await diaDoTokenPublico(params.token);
  if (!dia) return Response.json({ error: "Link inválido ou expirado." }, { status: 404 });
  if (q.get("destinos")) return Response.json(await destinos());
  if (q.get("auto") != null) { try { return Response.json(await autocompletar(q.get("auto"), q.get("sessao"))); } catch (e) { return Response.json({ error: e.message }, { status: 502 }); } }
  if (q.get("lugar")) { try { return Response.json(await lugar(q.get("lugar"), q.get("sessao"), q.get("digitado"))); } catch (e) { return Response.json({ error: e.message }, { status: 502 }); } }
  const r = await acompanhamento(params.token);
  if (r.error) return Response.json(r, { status: 404 });
  const usuarios = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true, setor: true }, orderBy: { nome: "asc" } });
  const mots = await motoristas().catch(() => []);
  return Response.json({ ...r, usuarios, motoristas: mots.map((m) => ({ id: m.id, nome: m.nome, origem: m.origem, emRota: m.emRota, padrao: m.padrao })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req, { params }) {
  const t = String(params.token || "");
  const dia = await diaDoTokenPublico(t);
  if (!dia) return Response.json({ error: "Link inválido ou expirado." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const u = b.usuarioId ? await prisma.usuario.findUnique({ where: { id: Number(b.usuarioId) }, select: sel }) : null;
  if (!u?.ativo) return Response.json({ error: "Escolha quem está pedindo (seu nome)." }, { status: 400 });
  if (b.acao === "consolidar") return Response.json(await consolidarDemandas(b.ids, u));
  const agora = Date.now(), l = (limite.get(t) || []).filter((x) => agora - x < 3600e3);
  if (l.length >= 40) return Response.json({ error: "Muitas demandas por este link na última hora. Tente mais tarde." }, { status: 429 });
  const d = b.demanda || {};
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.data || "")) || d.data < hoje) return Response.json({ error: "Escolha uma data de hoje em diante." }, { status: 400 });
  const { id, ...nova } = d;   // pelo link só se cria demanda nova
  const r = await salvarDemanda({ ...nova, obs: [nova.obs, "Lançada pelo link de acompanhamento"].filter(Boolean).join(" · ") }, u);
  if (r.ok) { l.push(agora); limite.set(t, l); }
  return Response.json(r, { status: r.error ? 400 : 200 });
}
