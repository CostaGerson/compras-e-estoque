export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { garantirKpis, rankingClientes, usuarioAtivo, negadoKpi as negado } from "@/lib/kpi";

// GET ?u=&ano=&mes= → os 10 clientes que mais compraram peças no mês
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!u) return negado();
  await garantirKpis();
  const ano = Number(sp.get("ano")), mes = Number(sp.get("mes"));
  if (!(ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12)) return Response.json({ error: "Período inválido." }, { status: 400 });
  return Response.json(await rankingClientes(ano, mes));
}
