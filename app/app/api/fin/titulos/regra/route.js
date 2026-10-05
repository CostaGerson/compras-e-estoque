export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, normRegra } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";

// "Usar como regra": leva a conta-caixa escolhida numa conta para as demais contas em aberto que tenham o
// mesmo termo (fornecedor/título) e, se pedido, grava a palavra-chave — igual à identificação do extrato.
// POST { usuarioId, tipo, termo, contaId, exceto?, salvarRegra?, dryRun? }
//   dryRun → { qtd, valor, semConta } (quantas contas mudariam)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const tipo = b.tipo === "RECEBER" ? "RECEBER" : "PAGAR";
  const contaId = Number(b.contaId);
  const termos = String(b.termo || "").split(";").map((t) => normRegra(t).trim()).filter((t) => t.length >= 2);
  if (!termos.length || !contaId) return Response.json({ error: "Informe o termo e a conta-caixa." }, { status: 400 });

  // em aberto, fora das contas da semana (rateadas pelos itens) e das recorrências (seguem a recorrência)
  const abertas = await prisma.finTitulo.findMany({
    where: { tipo, status: "ABERTO", recorrenciaId: null, ...(b.exceto ? { id: { not: Number(b.exceto) } } : {}) },
    select: { id: true, titulo: true, parceiro: true, valor: true, rateio: true, chaveImport: true },
  });
  const alvo = abertas.filter((t) => {
    if (String(t.chaveImport || "").startsWith("SEMANA|")) return false;
    const txt = normRegra(`${t.parceiro} ${t.titulo}`);
    if (!termos.some((x) => txt.includes(x))) return false;
    const r = Array.isArray(t.rateio) ? t.rateio : [];
    return !(r.length === 1 && Number(r[0].contaId) === contaId);   // já está nessa conta
  });
  const semConta = alvo.filter((t) => !(Array.isArray(t.rateio) && t.rateio.length)).length;
  const valor = Math.round(alvo.reduce((s, t) => s + Number(t.valor), 0) * 100) / 100;
  if (b.dryRun && !b.salvarRegra) return Response.json({ qtd: alvo.length, valor, semConta });

  const quem = nomeU(u);
  if (!b.dryRun && alvo.length) {
    await prisma.finTitulo.updateMany({ where: { id: { in: alvo.map((t) => t.id) } }, data: { rateio: [{ contaId, pct: 100 }], atualizadoPorNome: quem } });
  }
  let regra = false;
  if (b.salvarRegra) {
    const termo = String(b.termo).split(";").map((t) => t.trim().toUpperCase()).filter(Boolean).join(";");
    const conta = await prisma.finConta.findUnique({ where: { id: contaId } });
    const min = await prisma.finRegra.aggregate({ _min: { ordem: true } });
    await prisma.finRegra.create({
      data: { termo, contaId, banco: null, dc: tipo === "PAGAR" ? "D" : "C", descricao: conta?.nome || null,
        ordem: (min._min.ordem ?? 10) - 10, origem: "MANUAL", criadoPorNome: quem, usos: 1 },
    });
    regra = true;
  }
  return Response.json({ ok: true, qtd: b.dryRun ? 0 : alvo.length, valor, semConta, regra });
}
