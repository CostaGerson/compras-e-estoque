export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioRH, negadoRH, lerPessoal, calendario } from "@/lib/rh";
import { veRHCompleto } from "@/lib/acesso";
import { garantirContas } from "@/lib/fin";
import { mesAtual, somaMes } from "@/lib/finTitulos";
import { planoFerias } from "@/lib/rhFerias";

// GET ?u=&comp=AAAA-MM → pessoal da Matriz, calendário de obrigações, envios do mês e contas-caixa (para criar conta)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioRH(sp.get("u"));
  if (!u) return negadoRH();
  await garantirContas();
  const comp = /^\d{4}-\d{2}$/.test(sp.get("comp") || "") ? sp.get("comp") : mesAtual();
  const [pessoal, cal, envios, contas] = await Promise.all([
    lerPessoal(), calendario(comp),
    prisma.rhEnvio.findMany({ where: { competencia: { in: [comp, somaMes(comp, -1)] } }, orderBy: { createdAt: "desc" } }),
    prisma.finConta.findMany({ orderBy: { codigo: "asc" } }),
  ]);
  // v169 — resumo do plano de férias para o card
  const pf = await planoFerias(new Date().getFullYear()).catch(() => null);
  const feriasResumo = pf ? { agora: pf.agora.length, proximas: pf.proximas.length, alertasAltos: pf.alertas.filter((a) => a.nivel === "ALTO").length } : null;
  // v170 — quem entra só pelos documentos de RH (administrativo) não vê salários nem benefícios
  if (!veRHCompleto(u)) pessoal.pessoas = pessoal.pessoas.map((p) => ({ id: p.id, nome: p.nome, nomeCompleto: p.nomeCompleto, cargo: p.cargo, depto: p.depto, empresa: p.empresa, ativo: p.ativo, admissao: p.admissao }));
  return Response.json({
    completo: veRHCompleto(u),
    ...pessoal, calendario: cal, competencia: comp, feriasResumo,
    // um registro por documento (o mesmo arquivo enviado de novo não aparece duas vezes)
    envios: envios.filter((e, i, l) => l.findIndex((x) => (e.hash ? x.hash === e.hash : x.arquivo === e.arquivo && x.tituloId === e.tituloId)) === i)
      .map((e) => ({ ...e, valor: e.valor != null ? Number(e.valor) : null })),
    contas,
  });
}
