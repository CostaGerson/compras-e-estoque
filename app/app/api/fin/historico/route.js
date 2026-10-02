export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirContas, normalizarTexto } from "@/lib/fin";
import { lerHistorico } from "@/lib/finHistorico";

const r2 = (n) => Math.round(n * 100) / 100;

// POST { usuarioId, texto, simular } → importa o extrato de identificações do sistema anterior.
// Cada mês do arquivo substitui o histórico já importado daquele mês.
// Meses que já têm lançamentos vindos de documentos (extratos/faturas deste sistema) ficam de fora.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const { itens, erros } = lerHistorico(b.texto);
  if (!itens.length) return Response.json({ error: "Nenhum lançamento encontrado. Envie o .txt do 'Extrato' do sistema anterior." }, { status: 400 });

  await garantirContas();
  const contas = await prisma.finConta.findMany({ select: { id: true, codigo: true, nome: true } });
  const porCodigo = Object.fromEntries(contas.map((c) => [c.codigo, c]));
  const porNome = Object.fromEntries(contas.map((c) => [normalizarTexto(c.nome), c]));
  const conc = porCodigo["3000000"];

  const meses = {};
  const naoAchadas = {};
  for (const it of itens) {
    let conta = null;
    if (it.contaCodigo && it.contaCodigo !== "0") conta = porCodigo[it.contaCodigo] || null;
    if (!conta && it.contaCodigo !== "0" && it.contaNome && it.contaNome !== "INDEFINIDO") conta = porNome[normalizarTexto(it.contaNome)] || null;
    if (!conta && it.contaCodigo !== "0" && it.contaNome !== "INDEFINIDO") naoAchadas[`${it.contaCodigo} ${it.contaNome}`.trim()] = (naoAchadas[`${it.contaCodigo} ${it.contaNome}`.trim()] || 0) + 1;
    it.contaId = conta ? conta.id : null;
    const m = (meses[it.competencia] ||= { competencia: it.competencia, n: 0, semConta: 0, entradas: 0, saidas: 0, conciliacao: 0, itens: [] });
    m.n++;
    if (!it.contaId) m.semConta++;
    if (conc && it.contaId === conc.id) m.conciliacao += it.valor;
    else if (it.valor > 0) m.entradas += it.valor;
    else m.saidas += it.valor;
    m.itens.push(it);
  }

  const comps = Object.keys(meses).sort();
  const [docs, hist] = await Promise.all([
    prisma.finLancamento.groupBy({ by: ["competencia"], where: { competencia: { in: comps }, origem: { not: "HISTORICO" } }, _count: true }),
    prisma.finLancamento.groupBy({ by: ["competencia"], where: { competencia: { in: comps }, origem: "HISTORICO" }, _count: true }),
  ]);
  const temDocs = Object.fromEntries(docs.map((d) => [d.competencia, d._count]));
  const temHist = Object.fromEntries(hist.map((d) => [d.competencia, d._count]));

  const resumo = comps.map((c) => {
    const m = meses[c];
    const situacao = temDocs[c] ? "BLOQUEADO" : temHist[c] ? "SUBSTITUI" : "NOVO";
    return {
      competencia: c, n: m.n, semConta: m.semConta, entradas: r2(m.entradas), saidas: r2(m.saidas), conciliacao: r2(m.conciliacao),
      resultado: r2(m.entradas + m.saidas), situacao, lancDocs: temDocs[c] || 0, histAtual: temHist[c] || 0,
    };
  });

  if (b.simular) return Response.json({ meses: resumo, erros, naoAchadas });

  let gravados = 0;
  for (const r of resumo) {
    if (r.situacao === "BLOQUEADO") continue;
    const data = meses[r.competencia].itens.map((it, i) => ({
      competencia: it.competencia, banco: it.banco, data: new Date(it.data + "T00:00:00Z"), historico: it.historico,
      documento: it.documento, identificacao: it.identificacao, valor: it.valor, contaId: it.contaId,
      origem: "HISTORICO", ordem: i, identificadoPor: it.contaId ? "HISTÓRICO" : null,
    }));
    await prisma.$transaction([
      prisma.finLancamento.deleteMany({ where: { competencia: r.competencia, origem: "HISTORICO" } }),
      prisma.finLancamento.createMany({ data }),
    ]);
    gravados += data.length;
  }
  return Response.json({ ok: true, gravados, meses: resumo, erros, naoAchadas });
}

// DELETE { usuarioId, competencia } → remove o histórico importado de um mês
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const r = await prisma.finLancamento.deleteMany({ where: { competencia: String(b.competencia || ""), origem: "HISTORICO" } });
  return Response.json({ ok: true, removidos: r.count });
}
