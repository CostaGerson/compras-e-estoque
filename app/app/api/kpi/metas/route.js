export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioAtivo, ehMaster, negadoKpi as negado, garantirKpis } from "@/lib/kpi";
import { metasDoAno, salvarCoerente } from "@/lib/kpiMetas";

const anoValido = (a) => Number.isInteger(Number(a)) && Number(a) >= 2000 && Number(a) <= 2100;
const fracao = (v) => {
  if (v === "" || v == null) return null;
  const x = Number(String(v).replace("%", "").replace(/\./g, "").replace(",", "."));
  if (isNaN(x)) return null;
  return x > 1 ? x / 100 : x;
};

// v213 — GET ?u=&ano= → metas do ano por natureza + distribuição histórica
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!ehMaster(u)) return negado("Metas: master e diretoria.");
  await garantirKpis();
  const ano = Number(sp.get("ano")) || new Date().getFullYear();
  if (!anoValido(ano)) return Response.json({ error: "Ano inválido." }, { status: 400 });
  return Response.json(await metasDoAno(ano));
}

// POST { usuarioId, ano, metas: { natureza: { anual, meses[12] } }, margem }
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioAtivo(b?.usuarioId);
  if (!ehMaster(u)) return negado("Só o financeiro altera metas.");
  if (!anoValido(b.ano)) return Response.json({ error: "Ano inválido." }, { status: 400 });
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  const tk = "ticket" in b ? (b.ticket === "" || b.ticket == null ? null : Number(String(b.ticket).replace(/\./g, "").replace(",", "."))) : undefined;
  const tkOk = tk === undefined || (tk !== null && isNaN(tk)) ? null : tk;
  // v221 — regra de coerência: só vendas (R$) e ticket entram; o resto é calculado
  if (!b.metas?.vendasValor?.meses) return Response.json({ error: "Informe a meta de vendas (R$)." }, { status: 400 });
  if (tkOk == null) return Response.json({ error: "Informe o ticket médio: sem ele não dá para calcular vendas, faturamento e receita em R$." }, { status: 400 });
  return Response.json(await salvarCoerente(Number(b.ano), b.metas.vendasValor.meses, tkOk, "margem" in b ? fracao(b.margem) : undefined, quem,
    "freelancer" in b ? fracao(b.freelancer) : undefined));
}
