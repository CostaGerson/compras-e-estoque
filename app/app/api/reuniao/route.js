// v785 — apresentação da reunião mensal de gestão (Gestão › Reuniões)
//   GET ?u=&mes=AAAA-MM → reunião do mês (tarefa recorrente; criada se faltar), pautas e textos da apresentação.
//     A reunião de um mês apresenta os números do mês anterior (ref).
//   POST { usuarioId, tarefaId, textos: { chave: texto } } → grava os textos editados na tela (junto da tarefa, em reuniao.apresentacao)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gerencial } from "@/lib/acesso";
import { garantirReuniao, dataReuniao } from "@/lib/decisoes";

async function quem(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, ativo: true, isMaster: true, diretoria: true, setor: true, permissoes: true } }).catch(() => null);
  return u && u.ativo ? u : null;
}
const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const ant = (ano, mes) => (mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`);

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await quem(sp.get("u"));
  if (!u || !gerencial(u)) return Response.json({ error: "Só master e diretoria." }, { status: 403 });
  // v1015 — lista de meses (cards da página inicial): só lê, não cria reunião
  if (sp.get("lista")) {
    const todas = await prisma.tarefa.findMany({ where: { titulo: { startsWith: "REUNIÃO DE GESTÃO · " }, modelo: false, status: { not: "CANCELADA" } }, select: { id: true, reuniao: true, prazo: true, hora: true, status: true } });
    const ids = todas.map((x) => x.id);
    const snaps = ids.length ? await prisma.finConfig.findMany({ where: { chave: { in: ids.map(KS) } }, select: { chave: true } }) : [];
    const comSnap = new Set(snaps.map((x) => Number(x.chave.split("|")[2])));
    const meses = {};
    for (const x of todas) { const mm = x.reuniao?.mes; if (!mm) continue; const A = x.reuniao.apresentacao || {};
      meses[mm] = { tarefaId: x.id, prazo: x.prazo, hora: x.hora, status: x.status, pautas: (x.reuniao.pautas || []).length,
        salva: comSnap.has(x.id), editada: comSnap.has(x.id) || Object.keys(A.textos || {}).length > 0 || (A.estrutura || []).length > 0 }; }
    return Response.json({ hoje: hojeSP(), meses });
  }
  let m = sp.get("mes");
  if (!/^\d{4}-\d{2}$/.test(m || "")) { const h = hojeSP(); m = h.slice(0, 7); if (dataReuniao(Number(h.slice(0, 4)), Number(h.slice(5, 7))) < h) { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); m = d.toISOString().slice(0, 7); } }
  const ano = Number(m.slice(0, 4)), mes = Number(m.slice(5, 7));
  // mês passado: só abre a reunião que existe (não cria tarefa nem convite retroativo)
  const { reuniaoDoMes } = await import("@/lib/decisoes");
  const t = m < hojeSP().slice(0, 7) ? await reuniaoDoMes(ano, mes) : await garantirReuniao(ano, mes);
  if (!t && m < hojeSP().slice(0, 7)) return Response.json({ error: `Não há reunião de gestão registrada em ${m.slice(5)}/${m.slice(0, 4)}.` }, { status: 404 });
  if (!t) return Response.json({ error: "Não consegui criar a reunião do mês (usuário Igor não encontrado)." }, { status: 400 });
  const todas = await prisma.tarefa.findMany({ where: { titulo: { startsWith: "REUNIÃO DE GESTÃO · " }, modelo: false, status: { not: "CANCELADA" } }, select: { id: true, reuniao: true, prazo: true, status: true }, orderBy: { prazo: "desc" }, take: 36 });
  const R = t.reuniao || {};
  return Response.json({
    mes: m, ref: ant(ano, mes), dataReuniao: dataReuniao(ano, mes),
    tarefa: { id: t.id, titulo: t.titulo, prazo: t.prazo, hora: t.hora, status: t.status, pautas: R.pautas || [] },
    apresentacao: R.apresentacao || { textos: {} },
    snapshot: await lerSnap(t.id),   // v1008 — versão salva: números congelados por slide
    meses: [...new Set(todas.map((x) => x.reuniao?.mes).filter(Boolean))],
  });
}

// v1008 — números congelados de cada slide ficam fora da tarefa (a lista de tarefas não carrega isso)
const KS = (id) => `REUNIAO|SNAP|${id}`;
async function lerSnap(id) { const c = await prisma.finConfig.findUnique({ where: { chave: KS(id) } }).catch(() => null); try { return c ? JSON.parse(c.valor) : null; } catch { return null; } }

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await quem(b.usuarioId);
  if (!u || !gerencial(u)) return Response.json({ error: "Só master e diretoria." }, { status: 403 });
  const t = await prisma.tarefa.findUnique({ where: { id: Number(b.tarefaId) || 0 }, select: { id: true, reuniao: true } });
  if (!t?.reuniao) return Response.json({ error: "Reunião não encontrada." }, { status: 404 });
  const R = t.reuniao, A = R.apresentacao || { textos: {} };
  const textos = { ...(A.textos || {}) };
  for (const [k, v] of Object.entries(b.textos || {})) textos[String(k).slice(0, 60)] = String(v ?? "").slice(0, 20000);
  const nome = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  // relê na hora de gravar para não apagar pauta incluída ao mesmo tempo
  const atual = (await prisma.tarefa.findUnique({ where: { id: t.id }, select: { reuniao: true } })).reuniao || R;
  const A2 = atual.apresentacao || A;
  // v1007 — páginas em branco (títulos, subtítulos, caixas de texto, links e imagens posicionados livremente); imagem fica como anexo da tarefa
  let paginas = A2.paginas || [];
  if (Array.isArray(b.paginas)) {
    const n = (v, a0, z) => Math.max(a0, Math.min(z, Math.round(Number(v) || 0)));
    paginas = b.paginas.slice(0, 60).map((pg) => ({ id: String(pg.id || "").slice(0, 40), apos: String(pg.apos || "").slice(0, 120),
      elementos: (Array.isArray(pg.elementos) ? pg.elementos : []).slice(0, 80).map((e) => ({ id: String(e.id || "").slice(0, 40), tipo: ["TITULO", "SUBTITULO", "TEXTO", "LINK", "IMAGEM"].includes(e.tipo) ? e.tipo : "TEXTO",
        x: n(e.x, -200, 1280), y: n(e.y, -200, 720), w: n(e.w, 20, 1280), h: n(e.h, 16, 720), texto: String(e.texto ?? "").slice(0, 8000), url: String(e.url || "").slice(0, 1000),
        arquivoId: Number(e.arquivoId) || null })) })).filter((pg) => pg.id);
  }
  // v1008 — estrutura (ordem, cópias e excluídos) e versão salva
  let estrutura = A2.estrutura || null;
  if (Array.isArray(b.estrutura)) estrutura = b.estrutura.slice(0, 200).map((x) => ({ id: String(x.id || "").slice(0, 160), ...(x.base ? { base: String(x.base).slice(0, 160) } : {}), ...(x.pagina ? { pagina: String(x.pagina).slice(0, 40) } : {}), ...(x.dup ? { dup: true, pre: String(x.pre || "").slice(0, 40) } : {}), ...(x.excluido ? { excluido: true } : {}) })).filter((x) => x.id && (x.base || x.pagina));
  let salvoEm = null;
  if (b.snapshot && typeof b.snapshot === "object") {
    const valor = JSON.stringify({ em: new Date().toISOString(), por: nome, slides: b.snapshot });
    if (valor.length > 15e6) return Response.json({ error: "Versão grande demais para salvar." }, { status: 400 });
    await prisma.finConfig.upsert({ where: { chave: KS(t.id) }, create: { chave: KS(t.id), valor }, update: { valor } });
    salvoEm = new Date().toISOString();
  }
  await prisma.tarefa.update({ where: { id: t.id }, data: { reuniao: { ...atual, apresentacao: { ...A2, ...(estrutura ? { estrutura } : {}), textos: { ...(A2.textos || {}), ...Object.fromEntries(Object.entries(b.textos || {}).map(([k, v]) => [String(k).slice(0, 60), String(v ?? "").slice(0, 20000)])) }, paginas, atualizadoPor: nome, atualizadoEm: new Date().toISOString() } } } });
  return Response.json({ ok: true, salvoEm });
}
