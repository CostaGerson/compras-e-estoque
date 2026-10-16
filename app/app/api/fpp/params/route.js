import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

// GET: retorna todos os parâmetros agrupados: { MALHA: { PECA:[...], GOLA:[...] }, PLANO:{...}, COMUM:{...} }
export async function GET() {
  // v272 — corte, expedição/acabamento, costura e silk vêm das Análises operacionais (média dos últimos 3 meses completos);
  // os parâmetros são refeitos sozinhos quando entra um mês completo novo
  let operacional = null;
  try {
    const { atualizarParamsFpp, mediasOperacionais } = await import("@/lib/fppAnalises");
    await atualizarParamsFpp();
    operacional = await mediasOperacionais();
  } catch (e) { operacional = { erro: e.message }; }
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
  out.OPERACIONAL = operacional;
  return NextResponse.json(out);
}
