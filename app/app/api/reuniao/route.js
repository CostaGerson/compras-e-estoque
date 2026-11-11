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
    meses: [...new Set(todas.map((x) => x.reuniao?.mes).filter(Boolean))],
  });
}

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
  await prisma.tarefa.update({ where: { id: t.id }, data: { reuniao: { ...atual, apresentacao: { ...A, textos, atualizadoPor: nome, atualizadoEm: new Date().toISOString() } } } });
  return Response.json({ ok: true });
}
