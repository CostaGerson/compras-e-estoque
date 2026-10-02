export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

// GET ?u= → análise salva, já sem o que foi resolvido depois dela
//   · sugestão some quando todos os lançamentos do grupo já têm conta (os já identificados saem do grupo)
//   · incongruência some se o lançamento mudou de conta, sumiu, ou foi marcada como ignorada
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const a = await prisma.finAnaliseIA.findUnique({ where: { id: Number(params.id) } });
  if (!a) return Response.json({ error: "Análise não encontrada." }, { status: 404 });
  const r = a.resultado || {};
  const ids = [...(r.sugestoes || []).flatMap((s) => s.ids), ...(r.incongruencias || []).map((x) => x.id)];
  const atuais = await prisma.finLancamento.findMany({ where: { id: { in: ids } }, select: { id: true, contaId: true, valor: true, substituido: true, desmembrado: true } });
  const porId = Object.fromEntries(atuais.map((l) => [l.id, l]));
  const ativo = (l) => l && !l.substituido && !l.desmembrado;
  const ign = new Set(a.ignorados || []);
  const sugestoes = (r.sugestoes || []).map((s) => {
    const resta = s.ids.filter((id) => ativo(porId[id]) && !porId[id].contaId);
    if (!resta.length) return null;
    const total = Math.round(resta.reduce((t, id) => t + Number(porId[id].valor), 0) * 100) / 100;
    return { ...s, ids: resta, qtd: resta.length, total };
  }).filter(Boolean);
  const incongruencias = (r.incongruencias || []).filter((x) => !ign.has(x.i) && ativo(porId[x.id]) && porId[x.id].contaId === x.contaAtualId);
  return Response.json({
    ...r, sugestoes, incongruencias, analiseId: a.id, criadaEm: a.createdAt, usuarioNome: a.usuarioNome, salva: true,
    resolvidas: (r.sugestoes || []).length - sugestoes.length + (r.incongruencias || []).length - incongruencias.length,
  });
}

// PATCH { usuarioId, ignorar: i } → marca incongruência como ignorada nessa análise
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const a = await prisma.finAnaliseIA.findUnique({ where: { id: Number(params.id) }, select: { ignorados: true } });
  if (!a) return Response.json({ error: "Análise não encontrada." }, { status: 404 });
  const ign = [...new Set([...(a.ignorados || []), Number(b.ignorar)])];
  await prisma.finAnaliseIA.update({ where: { id: Number(params.id) }, data: { ignorados: ign } });
  return Response.json({ ok: true });
}

// DELETE { usuarioId } → apaga a análise salva
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  await prisma.finAnaliseIA.delete({ where: { id: Number(params.id) } }).catch(() => {});
  return Response.json({ ok: true });
}
