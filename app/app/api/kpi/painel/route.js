export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { garantirKpis, painel, anosDisponiveis, usuarioAtivo, ehMaster, kpisDoTipo, veValores, negadoKpi as negado } from "@/lib/kpi";

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
  // v170 — comercial vê os dados de venda; produção, os de produção; master e diretoria, tudo
  const permitidos = kpisDoTipo(u);
  if (permitidos) {
    p.kpis = p.kpis.filter((k) => permitidos.includes(k.chave));
    p.canais = []; p.receitaMes = null; p.restrito = true;
    if (!veValores(u)) p.anuais = { ...p.anuais, ticketMedio: null, mediaFaturamento: null };
  }
  return Response.json({ ...p, anos, podeEditar: ehMaster(u), veValores: veValores(u) });
}
