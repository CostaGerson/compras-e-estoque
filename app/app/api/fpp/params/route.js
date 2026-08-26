import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

// GET: retorna todos os parâmetros agrupados: { MALHA: { PECA:[...], GOLA:[...] }, PLANO:{...}, COMUM:{...} }
export async function GET() {
  const rows = await prisma.fppParam.findMany({
    where: { ativo: true },
    orderBy: [{ tipo: "asc" }, { grupo: "asc" }, { ordem: "asc" }],
  });
  const out = { MALHA: {}, PLANO: {}, COMUM: {} };
  for (const r of rows) {
    const t = out[r.tipo] || (out[r.tipo] = {});
    (t[r.grupo] || (t[r.grupo] = [])).push({
      id: r.id, chave: r.chave, rotulo: r.rotulo, valor: r.valor, extra: r.extra || null, ordem: r.ordem,
    });
  }
  return NextResponse.json(out);
}
