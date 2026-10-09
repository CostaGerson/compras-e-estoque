export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { garantirKpis, relatorio, anosDisponiveis, SEGMENTOS_PADRAO, usuarioAtivo, ehMaster, negadoKpi as negado } from "@/lib/kpi";

const anoValido = (a) => Number.isInteger(Number(a)) && Number(a) >= 2000 && Number(a) <= 2100;
const mesValido = (m) => Number.isInteger(Number(m)) && Number(m) >= 1 && Number(m) <= 12;
const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const int = (v) => { const x = dec(v); return x === null ? null : Math.round(x); };

// GET ?u=&ano=  → relatório do ano (com o ano anterior ao lado)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!u) return negado();
  if (!ehMaster(u)) return negado("Relatório de KPIs: master e diretoria.");   // v170
  await garantirKpis();
  const ano = Number(sp.get("ano")) || new Date().getFullYear();
  if (!anoValido(ano)) return Response.json({ error: "Ano inválido." }, { status: 400 });
  const [r, anos] = await Promise.all([relatorio(ano), anosDisponiveis()]);
  return Response.json({ ...r, anos, podeEditar: ehMaster(u), segmentosPadrao: SEGMENTOS_PADRAO });
}

// PUT { usuarioId, ano, mes, campos:{...}, receita:{SEGMENTO: valor} } → lança/corrige o mês
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioAtivo(b?.usuarioId);
  if (!ehMaster(u)) return negado("Só o financeiro lança KPI.");
  if (!anoValido(b.ano) || !mesValido(b.mes)) return Response.json({ error: "Ano ou mês inválido." }, { status: 400 });

  const c = b.campos || {};
  const data = {};
  for (const k of ["vendasValor", "faturamentoValor", "metaVendasValor", "metaFaturamentoValor", "metaReceitaValor"]) {
    if (k in c) data[k] = dec(c[k]);
  }
  for (const k of ["vendasPecas", "pecasProduzidas", "pecasFaturadas", "metaVendasPecas", "metaFaturamentoPecas", "metaPecasProduzidas"]) {
    if (k in c) data[k] = int(c[k]);
  }
  if ("observacao" in c) data.observacao = c.observacao ? String(c.observacao).toUpperCase() : null;
  data.atualizadoPorNome = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

  await prisma.kpiMes.upsert({
    where: { ano_mes: { ano: Number(b.ano), mes: Number(b.mes) } },
    create: { ano: Number(b.ano), mes: Number(b.mes), ...data },
    update: data,
  });

  if (b.receita && typeof b.receita === "object") {
    for (const [seg, v] of Object.entries(b.receita)) {
      const segmento = String(seg).toUpperCase().trim();
      if (!segmento) continue;
      const valor = dec(v);
      if (valor === null) {
        await prisma.kpiReceita.deleteMany({ where: { ano: Number(b.ano), mes: Number(b.mes), segmento } });
      } else {
        await prisma.kpiReceita.upsert({
          where: { ano_mes_segmento: { ano: Number(b.ano), mes: Number(b.mes), segmento } },
          create: { ano: Number(b.ano), mes: Number(b.mes), segmento, valor },
          update: { valor },
        });
      }
    }
  }

  return Response.json({ ok: true, ...(await relatorio(Number(b.ano))) });
}

// percentual aceito como 18, 18%, 0,18 → guarda sempre a fração (0.18)
const fracao = (v) => {
  const x = dec(String(v ?? "").replace("%", ""));
  if (x === null) return null;
  return x > 1 ? x / 100 : x;
};

// POST { usuarioId, ano, metas:{...}, pecasProduzidasMes:{1..12} } → metas do ano e metas mensais de produção
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioAtivo(b?.usuarioId);
  if (!ehMaster(u)) return negado("Só o financeiro altera metas.");
  if (!anoValido(b.ano)) return Response.json({ error: "Ano inválido." }, { status: 400 });
  const m = b.metas || {};
  const data = {
    metaVendas: dec(m.vendas), metaFaturamento: dec(m.faturamento), metaReceita: dec(m.receita),
    metaPecasFaturadas: int(m.pecasFaturadas), metaPecasProduzidas: int(m.pecasProduzidas),
    semNotaVendas: dec(m.semNotaVendas), semNotaFaturamento: dec(m.semNotaFaturamento),
    metaMargem: fracao(m.margem),
  };
  await prisma.kpiAno.upsert({ where: { ano: Number(b.ano) }, create: { ano: Number(b.ano), ...data }, update: data });

  // meta de peças produzidas mês a mês
  if (b.pecasProduzidasMes && typeof b.pecasProduzidasMes === "object") {
    for (const [mesTxt, v] of Object.entries(b.pecasProduzidasMes)) {
      const mes = Number(mesTxt);
      if (!mesValido(mes)) continue;
      const metaPecasProduzidas = int(v);
      await prisma.kpiMes.upsert({
        where: { ano_mes: { ano: Number(b.ano), mes } },
        create: { ano: Number(b.ano), mes, metaPecasProduzidas },
        update: { metaPecasProduzidas },
      });
    }
  }

  return Response.json({ ok: true, ...(await relatorio(Number(b.ano))) });
}
