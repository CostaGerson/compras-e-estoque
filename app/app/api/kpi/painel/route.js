export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { garantirKpis, painel, anosDisponiveis, usuarioAtivo, ehMaster, negadoKpi as negado } from "@/lib/kpi";

// GET ?u=&ano=&mes=  → os 5 KPIs do mês + indicadores do ano
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!u) return negado();
  await garantirKpis();

  const hoje = new Date();
  const ano = Number(sp.get("ano")) || hoje.getFullYear();
  const mes = Number(sp.get("mes")) || hoje.getMonth() + 1;
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12) return Response.json({ error: "Período inválido." }, { status: 400 });

  const [p, anos] = await Promise.all([painel(ano, mes), anosDisponiveis()]);
  return Response.json({ ...p, anos, podeEditar: ehMaster(u) });
}
