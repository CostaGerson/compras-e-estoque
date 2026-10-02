export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

// POST { usuarioId, partes: [{ valor, contaId?, historico? }] } — a soma tem que fechar com o original
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const o = await prisma.finLancamento.findUnique({ where: { id: Number(params.id) } });
  if (!o) return Response.json({ error: "Lançamento não encontrado." }, { status: 404 });
  if (o.paiId || o.desmembrado) return Response.json({ error: "Este lançamento já foi desmembrado." }, { status: 400 });
  const partes = (b.partes || []).map((p) => ({ ...p, valor: Math.round(Number(p.valor) * 100) / 100 })).filter((p) => p.valor);
  if (partes.length < 2) return Response.json({ error: "Informe ao menos 2 partes." }, { status: 400 });
  const soma = Math.round(partes.reduce((a, p) => a + p.valor, 0) * 100) / 100;
  if (Math.abs(soma - Number(o.valor)) > 0.005) return Response.json({ error: `As partes somam ${soma.toFixed(2)} e o lançamento é ${Number(o.valor).toFixed(2)}.` }, { status: 400 });
  const quem = [u.nome, u.sobrenome].join(" ").trim().toUpperCase();
  await prisma.$transaction([
    prisma.finLancamento.update({ where: { id: o.id }, data: { desmembrado: true } }),
    prisma.finLancamento.createMany({
      data: partes.map((p, i) => ({
        competencia: o.competencia, arquivoId: o.arquivoId, banco: o.banco, data: o.data,
        historico: p.historico ? String(p.historico).toUpperCase() : o.historico, documento: o.documento,
        identificacao: o.identificacao, valor: p.valor, origem: "PARTE", paiId: o.id, ordem: o.ordem,
        contaId: p.contaId ? Number(p.contaId) : null, identificadoPor: p.contaId ? quem : null,
      })),
    }),
  ]);
  return Response.json({ ok: true });
}
