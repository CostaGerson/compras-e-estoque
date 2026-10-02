export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, normRegra, aplicarRegras } from "@/lib/fin";

// POST { usuarioId, ids:[], contaId, identificacao?, regra?: { termo, banco? } }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const ids = (b.ids || []).map(Number).filter(Boolean);
  const contaId = Number(b.contaId);
  if (!ids.length || !contaId) return Response.json({ error: "Escolha a conta-caixa." }, { status: 400 });
  const quem = [u.nome, u.sobrenome].join(" ").trim().toUpperCase();
  const data = { contaId, regraId: null, identificadoPor: quem };
  if (b.identificacao !== undefined && b.identificacao !== null && String(b.identificacao).trim()) data.identificacao = String(b.identificacao).toUpperCase();
  await prisma.finLancamento.updateMany({ where: { id: { in: ids } }, data });

  let porRegra = 0, regraCriada = null;
  const termo = String(b.regra?.termo || "").split(";").map((t) => t.trim().toUpperCase()).filter(Boolean).join(";");
  if (termo && normRegra(termo).length >= 2) {
    const conta = await prisma.finConta.findUnique({ where: { id: contaId } });
    const min = await prisma.finRegra.aggregate({ _min: { ordem: true } });
    regraCriada = await prisma.finRegra.create({
      data: {
        termo, contaId, banco: b.regra.banco || null, dc: b.regra.dc === "D" || b.regra.dc === "C" ? b.regra.dc : null,
        descricao: conta?.nome || null, ordem: (min._min.ordem ?? 10) - 10, origem: "MANUAL", criadoPorNome: quem, usos: ids.length,
      },
    });
    const um = await prisma.finLancamento.findUnique({ where: { id: ids[0] }, select: { competencia: true } });
    if (um) porRegra = await aplicarRegras(um.competencia);
  }
  return Response.json({ ok: true, atualizados: ids.length, porRegra, regra: regraCriada });
}
