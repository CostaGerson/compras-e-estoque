export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirContas } from "@/lib/fin";
import { propostasDaMatriz } from "@/lib/finMatrizRec";
import { validarRateio, gerarRecorrencias, nomeU, r2, mesAtual, vencNoMes } from "@/lib/finTitulos";

const mesmoRateio = (a, b) => JSON.stringify((a || []).map((r) => [Number(r.contaId), r2(r.pct)]).sort()) === JSON.stringify((b || []).map((r) => [Number(r.contaId), r2(r.pct)]).sort());

async function montar() {
  await garantirContas();
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) return { error: "Abra a Matriz de custos uma vez para carregar a oficial." };
  const { propostas, totalMatriz } = propostasDaMatriz(m.dados);
  const contas = await prisma.finConta.findMany({ select: { id: true, codigo: true } });
  const id = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
  const existentes = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { not: null } } });
  const porChave = Object.fromEntries(existentes.filter((e) => e.chaveOrigem).map((e) => [e.chaveOrigem, e]));
  const chavesProp = new Set(propostas.map((p) => p.chave));
  const lista = propostas.map((p) => {
    const rateio = p.rateio.map((r) => ({ contaId: id[r.codigo] || null, pct: r.pct }));
    const e = porChave[p.chave];
    const difValor = e && Math.abs(Number(e.valor) - r2(p.valor)) > 0.009;
    // rateio só é comparado nas contas montadas da folha (o usuário pode ter trocado a conta de um item)
    const difRateio = e && p.chave.startsWith("MATRIZ|pessoal|") && !mesmoRateio(e.rateio, rateio);
    return { ...p, rateio, jaExiste: !!e, recorrenciaId: e?.id || null, valorAtual: e ? Number(e.valor) : null, mudou: !!(difValor || difRateio) };
  });
  // geradas da matriz antes e que não existem mais (ex.: salário por pessoa da versão anterior)
  const obsoletas = existentes.filter((e) => e.chaveOrigem && e.chaveOrigem.startsWith("MATRIZ|") && !chavesProp.has(e.chaveOrigem))
    .map((e) => ({ id: e.id, chave: e.chaveOrigem, titulo: e.titulo, valor: Number(e.valor) }));
  return { totalMatriz, propostas: lista, obsoletas };
}

// GET ?u= → propostas (novas, já criadas, com valor mudado) + obsoletas
export async function GET(req) {
  if (!(await usuarioMaster(new URL(req.url).searchParams.get("u")))) return negado();
  const r = await montar();
  if (r.error) return Response.json(r, { status: 400 });
  return Response.json(r);
}

// POST { usuarioId, chaves, atualizar, encerrar, inicio }
//  chaves    → cria as recorrências novas escolhidas
//  atualizar → chaves já criadas cujo valor/rateio mudou na matriz (vale para os meses ainda não conferidos)
//  encerrar  → ids de recorrências obsoletas: apaga previsões não conferidas a partir deste mês e a recorrência
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const r = await montar();
  if (r.error) return Response.json(r, { status: 400 });
  const quero = new Set(b.chaves || []), atual = new Set(b.atualizar || []);
  const inicio = /^\d{4}-\d{2}$/.test(b.inicio || "") ? b.inicio : mesAtual();
  let criadas = 0, atualizadas = 0, encerradas = 0;
  for (const p of r.propostas) {
    const rt = validarRateio(p.rateio);
    if (!p.jaExiste && quero.has(p.chave)) {
      await prisma.finRecorrencia.create({
        data: {
          tipo: "PAGAR", titulo: p.titulo.toUpperCase(), parceiro: p.parceiro.toUpperCase(), valor: r2(p.valor), diaVencimento: p.dia, diaUtil: !!p.util,
          rateio: rt.rateio || [], inicio, observacao: p.obs || "GERADA DA MATRIZ DE CUSTOS", chaveOrigem: p.chave, criadoPorNome: nomeU(u),
        },
      });
      criadas++;
    } else if (p.jaExiste && p.mudou && atual.has(p.chave)) {
      const up = { valor: r2(p.valor), observacao: p.obs || undefined };
      if (p.chave.startsWith("MATRIZ|pessoal|") && rt.rateio) up.rateio = rt.rateio;
      await prisma.finRecorrencia.update({ where: { id: p.recorrenciaId }, data: up });
      const tUp = { valor: up.valor, ...(up.rateio ? { rateio: up.rateio } : {}) };
      await prisma.finTitulo.updateMany({ where: { recorrenciaId: p.recorrenciaId, competencia: { gte: mesAtual() }, status: "ABERTO", valorConfirmado: false }, data: tUp });
      atualizadas++;
    }
  }
  for (const id of (b.encerrar || []).map(Number)) {
    if (!r.obsoletas.some((o) => o.id === id)) continue;
    await prisma.finTitulo.deleteMany({ where: { recorrenciaId: id, status: "ABERTO", valorConfirmado: false, competencia: { gte: mesAtual() } } });
    await prisma.finRecorrencia.delete({ where: { id } }).catch(() => {});
    encerradas++;
  }
  const geradas = await gerarRecorrencias("PAGAR");
  return Response.json({ ok: true, criadas, atualizadas, encerradas, geradas });
}
