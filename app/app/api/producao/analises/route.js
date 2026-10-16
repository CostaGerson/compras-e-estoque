export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { analiseCorte, lerPlanilhaCorte, gravarAnalises, SETORES_ANALISE, SETORES_MANUAIS } from "@/lib/opAnalise";

const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u=&setor=CORTE&competencia=AAAA-MM → análise do mês, custo do setor e série do ano
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  const comp = /^\d{4}-\d{2}$/.test(sp.get("competencia") || "") ? sp.get("competencia") : null;
  const setor = sp.get("setor") || "CORTE";
  if (!SETORES_ANALISE.includes(setor)) return Response.json({ error: "Análise ainda não disponível para este setor." }, { status: 400 });
  return Response.json(await analiseCorte(comp, setor));
}

// POST { usuarioId, acao: "importar", nome, conteudo(base64), competencia? } → lê a planilha (do mês ou o histórico do ano)
// POST { usuarioId, acao: "salvar", competencia, campos: { pecasEstimadas, custoMeta, mercado, pessoalManual, freelancerManual, meta, causas, providencias, qtds } }
// POST { usuarioId, acao: "excluir", competencia }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioGerencial(b.usuarioId);
  if (!u) return negadoGerencial();
  const setor = b.setor || "CORTE";
  if (!SETORES_ANALISE.includes(setor)) return Response.json({ error: "Análise ainda não disponível para este setor." }, { status: 400 });
  try {
    if (b.acao === "importar") {
      if (SETORES_MANUAIS.includes(setor)) return Response.json({ error: "Esta análise é preenchida à mão." }, { status: 400 });
      const buf = Buffer.from(String(b.conteudo || ""), "base64");
      const r = lerPlanilhaCorte(buf, b.nome, b.competencia, setor);
      if (!r.analises.length || !r.analises.some((a) => a.total > 0)) return Response.json({ error: "Não achei peças na planilha (esperava a aba Conferência ou a linha ITEM/QTDE)." }, { status: 400 });
      const out = await gravarAnalises(setor, r.analises, { nome: b.nome, quem: nomeU(u), historico: r.tipo === "HISTORICO" });
      const e = out.find((x) => x.erro);
      if (e) return Response.json({ error: e.erro }, { status: 400 });
      return Response.json({ ok: true, tipo: r.tipo, meses: out });
    }
    if (b.acao === "salvar") {
      if (!/^\d{4}-\d{2}$/.test(b.competencia || "")) return Response.json({ error: "Mês inválido." }, { status: 400 });
      const c = b.campos || {};
      const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));
      const data = {};
      for (const k of ["pecasEstimadas", "custoMeta", "pessoalManual", "freelancerManual"]) if (k in c) data[k] = num(c[k]);
      if (data.pecasEstimadas == null && "pecasEstimadas" in c) data.pecasEstimadas = 13000;
      for (const k of ["meta", "causas", "providencias"]) if (k in c) data[k] = c[k] ? String(c[k]).trim().toUpperCase() : null;
      if (c.mercado) data.mercado = Object.fromEntries(Object.entries(c.mercado).map(([k, v]) => [k, Number(v) || 0]));
      if (c.qtds) data.qtds = Object.fromEntries(Object.entries(c.qtds).map(([k, v]) => [k, Math.max(0, Math.round(Number(v) || 0))]));
      data.atualizadoPorNome = nomeU(u);
      await prisma.opAnalise.upsert({ where: { setor_competencia: { setor, competencia: b.competencia } }, update: data, create: { setor, competencia: b.competencia, qtds: {}, ...data } });
      return Response.json({ ok: true, ...(await analiseCorte(b.competencia, setor)) });
    }
    if (b.acao === "excluir") {
      await prisma.opAnalise.delete({ where: { setor_competencia: { setor, competencia: b.competencia } } }).catch(() => null);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro na análise." }, { status: 400 });
  }
}
