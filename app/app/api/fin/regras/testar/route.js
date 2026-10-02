export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida, regraCasa, lancOut, dadosRegra } from "@/lib/fin";

// POST { usuarioId, competencia, regra:{...} } → quais lançamentos do mês essa palavra-chave pegaria
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const r = { comparar: "CONTEM", campo: "TODOS", ...dadosRegra(b.regra || {}), ativo: true };
  const ls = await prisma.finLancamento.findMany({ where: { competencia: b.competencia, desmembrado: false }, orderBy: [{ data: "asc" }, { id: "asc" }] });
  const hits = ls.filter((l) => regraCasa(r, l));
  return Response.json({ total: hits.length, semConta: hits.filter((l) => !l.contaId).length, itens: hits.slice(0, 80).map(lancOut) });
}
