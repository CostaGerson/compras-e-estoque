export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida, garantirContas, lancOut, descartarPagamentosFatura } from "@/lib/fin";
import { LEITORES, LEITORES_DETALHE } from "@/lib/finParse";
import { CONSOLIDADOS } from "@/lib/finConcilia";
import { limparCartaoBBdeDividas, renomearContas } from "@/lib/finAjustes";

// GET ?u=&competencia=  → lançamentos do mês
// GET ?u=&ano=2026       → lançamentos do ano inteiro (identificação anual)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const ano = sp.get("ano");
  const competencia = sp.get("competencia");
  const anual = /^\d{4}$/.test(ano || "");
  if (!anual && !competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  await garantirContas();
  await renomearContas().catch(() => null);                             // nomes de conta combinados com o Igor
  const cartaoBB = await limparCartaoBBdeDividas().catch(() => null);   // cartão BB fora de dívidas (uma vez)

  // filtro de competência: um mês ou o ano inteiro
  const ondeComp = anual ? { startsWith: `${ano}-` } : competencia;
  if (anual) {
    const meses = await prisma.finLancamento.findMany({
      where: { competencia: ondeComp }, distinct: ["competencia"], select: { competencia: true },
    });
    for (const m of meses) await descartarPagamentosFatura(m.competencia);
  } else {
    await descartarPagamentosFatura(competencia);
  }

  const [ls, contas, arqs, pendentes, detalhes] = await Promise.all([
    prisma.finLancamento.findMany({ where: { competencia: ondeComp }, orderBy: [{ data: "asc" }, { arquivoId: "asc" }, { ordem: "asc" }, { id: "asc" }] }),
    prisma.finConta.findMany({ orderBy: { codigo: "asc" } }),
    anual ? Promise.resolve([]) : prisma.finArquivo.findMany({ where: { competencia, processado: true }, select: { saldoAnterior: true, lancamentos: { select: { banco: true }, take: 1 } } }),
    prisma.finArquivo.count({ where: { competencia: ondeComp, processado: false, tipo: { codigo: { in: [...Object.keys(LEITORES), ...Object.keys(LEITORES_DETALHE)] } } } }),
    prisma.finArquivo.findMany({ where: { competencia: ondeComp, processado: true, tipo: { codigo: { in: Object.keys(LEITORES_DETALHE) } } }, select: { conciliacao: true } }),
  ]);
  const leituras = await prisma.finArquivo.findMany({ where: { competencia: ondeComp }, select: { id: true, nome: true, prova: true, tipo: { select: { banco: true, documento: true } } } });
  const leitura = leituras.filter((a) => a.prova && a.prova.ok === false).map((a) => ({ id: a.id, nome: a.nome, banco: a.tipo.banco, documento: a.tipo.documento, msg: a.prova.msg }));
  // conferência: grupos de detalhamento (sem repetir) + consolidados do extrato que ficaram sem detalhamento
  const conf = {};
  detalhes.forEach((a) => (a.conciliacao || []).forEach((c) => { conf[c.chave] = c; }));
  const consolidados = ls.filter((l) => l.origem === "EXTRATO" && !l.substituido && !l.desmembrado && !l.revisado)
    .map((l) => ({ l, c: CONSOLIDADOS.find((x) => x.re.test(l.historico)) })).filter((x) => x.c)
    .map(({ l, c }) => ({ id: l.id, doc: c.doc }));
  const saldos = {};
  arqs.forEach((a) => { const b = a.lancamentos[0]?.banco; if (b && a.saldoAnterior != null) saldos[b] = (saldos[b] || 0) + Number(a.saldoAnterior); });
  const { mapaDeContas } = await import("@/lib/finDre");
  const comGrupo = await mapaDeContas().catch(() => null);
  const grupoDe = comGrupo ? Object.fromEntries(comGrupo.map((c) => [c.id, c.grupo])) : {};
  return Response.json({
    lancamentos: ls.map(lancOut),
    contas: contas.map((c) => ({ ...c, grupoDre: grupoDe[c.id] || null })),
    saldos, arquivosPendentes: pendentes, conferencia: Object.values(conf), consolidados, leitura,
    ...(anual ? { anual: true, ano: Number(ano) } : {}),
    ...(cartaoBB && !cartaoBB.jaFeito && cartaoBB.ok ? { ajusteCartaoBB: cartaoBB } : {}),
  });
}

// POST { usuarioId, competencia, banco, data, historico, documento?, identificacao?, valor, contaId? } → lançamento manual
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const valor = Number(b.valor);
  if (!b.data || !b.historico || !b.banco || !valor) return Response.json({ error: "Informe banco, data, histórico e valor." }, { status: 400 });
  const l = await prisma.finLancamento.create({
    data: {
      competencia: b.competencia, banco: String(b.banco).toUpperCase(), data: new Date(b.data + "T00:00:00Z"),
      historico: String(b.historico).toUpperCase(), documento: b.documento || null,
      identificacao: b.identificacao ? String(b.identificacao).toUpperCase() : null, valor, origem: "MANUAL",
      contaId: b.contaId ? Number(b.contaId) : null, identificadoPor: b.contaId ? [u.nome, u.sobrenome].join(" ").trim().toUpperCase() : null,
    },
  });
  return Response.json(lancOut(l));
}
