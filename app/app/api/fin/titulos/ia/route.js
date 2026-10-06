export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirContas } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { analisarTitulos } from "@/lib/finTitulosIA";

const okD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// POST { usuarioId, tipo, dIni, dFim }                       → análise (duplicidades + contas-caixa)
// POST { usuarioId, acao: "conta", id, contaId }              → aplica a conta sugerida
//      (conta de recorrência: muda a recorrência e os meses em aberto a partir deste)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  if (b.acao === "conta") {
    const t = await prisma.finTitulo.findUnique({ where: { id: Number(b.id) } });
    const contaId = Number(b.contaId);
    if (!t || !contaId || !(await prisma.finConta.findUnique({ where: { id: contaId } }))) return Response.json({ error: "Conta não encontrada." }, { status: 400 });
    const rateio = [{ contaId, pct: 100 }];
    if (t.recorrenciaId) {
      await prisma.finRecorrencia.update({ where: { id: t.recorrenciaId }, data: { rateio } });
      const n = await prisma.finTitulo.updateMany({ where: { recorrenciaId: t.recorrenciaId, status: "ABERTO", competencia: { gte: t.competencia } }, data: { rateio, atualizadoPorNome: nomeU(u) } });
      if (t.status !== "ABERTO") await prisma.finTitulo.update({ where: { id: t.id }, data: { rateio, atualizadoPorNome: nomeU(u) } });
      return Response.json({ ok: true, qtd: n.count + (t.status !== "ABERTO" ? 1 : 0), recorrencia: true });
    }
    await prisma.finTitulo.update({ where: { id: t.id }, data: { rateio, atualizadoPorNome: nomeU(u) } });
    return Response.json({ ok: true, qtd: 1 });
  }
  if (!okD(b.dIni) || !okD(b.dFim)) return Response.json({ error: "Informe o período." }, { status: 400 });
  await garantirContas();
  const tipo = b.tipo === "RECEBER" ? "RECEBER" : "PAGAR", dFim = b.dFim < b.dIni ? b.dIni : b.dFim;
  const r = await analisarTitulos({ tipo, dIni: b.dIni, dFim });
  // fica salva, como a análise da identificação (FinAnaliseIA com competencia "TITULOS|PAGAR")
  const resultado = { ...r, tipo, dIni: b.dIni, dFim };
  const salva = await prisma.finAnaliseIA.create({
    data: { competencia: `TITULOS|${tipo}`, usuarioNome: nomeU(u), ia: r.ia, nSugestoes: r.duplicidades.length, nIncong: r.contas.length, resultado },
  });
  return Response.json({ ...resultado, analiseId: salva.id, criadaEm: salva.createdAt, usuarioNome: salva.usuarioNome });
}

// GET ?u=&tipo= → análises salvas (mais nova primeiro)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const tipo = sp.get("tipo") === "RECEBER" ? "RECEBER" : "PAGAR";
  const l = await prisma.finAnaliseIA.findMany({ where: { competencia: `TITULOS|${tipo}` }, orderBy: { createdAt: "desc" }, take: 60,
    select: { id: true, createdAt: true, usuarioNome: true, ia: true, nSugestoes: true, nIncong: true, resultado: true } });
  return Response.json(l.map(({ resultado: r, ...a }) => ({ ...a, dIni: r?.dIni || null, dFim: r?.dFim || null, analisadas: r?.analisadas || 0 })));
}
