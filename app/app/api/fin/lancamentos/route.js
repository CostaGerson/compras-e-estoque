export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida, garantirContas, lancOut } from "@/lib/fin";

// GET ?u=&competencia= → lançamentos do mês + contas + saldos anteriores por banco
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  await garantirContas();
  const [ls, contas, arqs, pendentes] = await Promise.all([
    prisma.finLancamento.findMany({ where: { competencia }, orderBy: [{ data: "asc" }, { arquivoId: "asc" }, { ordem: "asc" }, { id: "asc" }] }),
    prisma.finConta.findMany({ orderBy: { codigo: "asc" } }),
    prisma.finArquivo.findMany({ where: { competencia, processado: true }, select: { saldoAnterior: true, lancamentos: { select: { banco: true }, take: 1 } } }),
    prisma.finArquivo.count({ where: { competencia, processado: false, tipo: { codigo: { in: ["BRADESCO_EXTRATO", "ITAU_EXTRATO", "INTER_EXTRATO", "C6_EXTRATO", "BB_EXTRATO", "CAIXA_EXTRATO"] } } } }),
  ]);
  const saldos = {};
  arqs.forEach((a) => { const b = a.lancamentos[0]?.banco; if (b && a.saldoAnterior != null) saldos[b] = (saldos[b] || 0) + Number(a.saldoAnterior); });
  return Response.json({ lancamentos: ls.map(lancOut), contas, saldos, arquivosPendentes: pendentes });
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
