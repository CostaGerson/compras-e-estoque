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
  const r = await analisarTitulos({ tipo: b.tipo === "RECEBER" ? "RECEBER" : "PAGAR", dIni: b.dIni, dFim: b.dFim < b.dIni ? b.dIni : b.dFim });
  return Response.json(r);
}
