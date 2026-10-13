export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { acaoEmLote } from "@/lib/finLote";

// POST { usuarioId, acao: "baixar" | "excluir", ids: [..], dataPagamento? }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  if (b.acao === "vistarCritica") {   // v196
    const { prisma } = await import("@/lib/prisma");
    const ts = await prisma.finTitulo.findMany({ where: { id: { in: (b.ids || []).map(Number) }, critica: { not: null } }, select: { id: true, critica: true } });
    for (const t of ts) await prisma.finTitulo.update({ where: { id: t.id }, data: { criticaVista: t.critica, atualizadoPorNome: nomeU(u) } });
    return Response.json({ ok: true, feitos: ts.length });
  }
  const r = await acaoEmLote({ acao: b.acao, ids: b.ids, dataPagamento: b.dataPagamento, quem: nomeU(u) });
  if (r.error) return Response.json(r, { status: 400 });
  return Response.json(r);
}
