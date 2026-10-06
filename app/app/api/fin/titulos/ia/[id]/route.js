export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

const principal = (rateio) => { const r = (Array.isArray(rateio) ? rateio : []).filter((x) => Number(x.contaId) && Number(x.pct) > 0); return r.length ? Number([...r].sort((a, b) => b.pct - a.pct)[0].contaId) : null; };
const ehTitulos = (a) => String(a?.competencia || "").startsWith("TITULOS|");

// GET ?u= → análise salva, já sem o que foi resolvido depois dela
//   · duplicidade: sai a conta excluída/cancelada; o grupo some quando sobra uma só (ou nenhuma em aberto)
//   · conta-caixa: some se a conta foi baixada/excluída/cancelada, se mudou de conta-caixa, ou se foi ignorada
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const a = await prisma.finAnaliseIA.findUnique({ where: { id: Number(params.id) } });
  if (!a || !ehTitulos(a)) return Response.json({ error: "Análise não encontrada." }, { status: 404 });
  const r = a.resultado || {};
  const ign = new Set((a.ignorados || []).map(String));
  const ids = [...(r.duplicidades || []).flatMap((g) => g.titulos.map((t) => t.id)), ...(r.contas || []).map((c) => c.titulo.id)];
  const atuais = await prisma.finTitulo.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, rateio: true, valor: true, vencimento: true } });
  const porId = Object.fromEntries(atuais.map((t) => [t.id, t]));
  const duplicidades = (r.duplicidades || []).filter((g) => !ign.has(g.k)).map((g) => {
    const ts = g.titulos.filter((t) => porId[t.id] && porId[t.id].status !== "CANCELADO")
      .map((t) => ({ ...t, status: porId[t.id].status, valor: Number(porId[t.id].valor), vencimento: porId[t.id].vencimento.toISOString().slice(0, 10) }));
    if (ts.length < 2 || !ts.some((t) => t.status === "ABERTO")) return null;
    return { ...g, titulos: ts, manterId: ts.some((t) => t.id === g.manterId) ? g.manterId : ts[0].id };
  }).filter(Boolean);
  const contas = (r.contas || []).filter((c) => {
    const t = porId[c.titulo.id];
    return !ign.has(c.k) && t && t.status !== "CANCELADO" && principal(t.rateio) === (c.contaAtualId || null);
  });
  return Response.json({
    ...r, duplicidades, contas, analiseId: a.id, criadaEm: a.createdAt, usuarioNome: a.usuarioNome, salva: true,
    resolvidas: (r.duplicidades || []).length - duplicidades.length + (r.contas || []).length - contas.length,
  });
}

// PATCH { usuarioId, ignorar: "D1" | "C3" } → marca o item como ignorado nessa análise
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const a = await prisma.finAnaliseIA.findUnique({ where: { id: Number(params.id) }, select: { ignorados: true, competencia: true } });
  if (!a || !ehTitulos(a)) return Response.json({ error: "Análise não encontrada." }, { status: 404 });
  const ign = [...new Set([...(a.ignorados || []).map(String), String(b.ignorar)])];
  await prisma.finAnaliseIA.update({ where: { id: Number(params.id) }, data: { ignorados: ign } });
  return Response.json({ ok: true });
}

// DELETE { usuarioId } → apaga a análise salva
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const a = await prisma.finAnaliseIA.findUnique({ where: { id: Number(params.id) }, select: { competencia: true } });
  if (a && ehTitulos(a)) await prisma.finAnaliseIA.delete({ where: { id: Number(params.id) } }).catch(() => {});
  return Response.json({ ok: true });
}
