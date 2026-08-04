export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { checarEstoqueMinimo } from "@/lib/estoqueMinimo";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

// POST /api/fme/[id]/devolucao { itens:[{fmeItemId, qtd}], usuarioId, perfil }
// Registra devolução: soma de volta no estoque, atualiza qtdDevolvida e cria movimento RETORNO.
export async function POST(req, { params }) {
  const fmeId = Number(params.id);
  const b = await req.json();
  const usuarioId = b.usuarioId ? Number(b.usuarioId) : null;
  const linhas = Array.isArray(b.itens) ? b.itens : [];

  const prep = [];
  for (const l of linhas) {
    const qtd = dec(l.qtd);
    if (!qtd || qtd <= 0) continue; // ignora linhas em branco
    const item = await prisma.fmeItem.findUnique({ where: { id: Number(l.fmeItemId) }, include: { artigo: true } });
    if (!item || item.fmeId !== fmeId) return Response.json({ error: "Item da FME não encontrado" }, { status: 400 });
    const restante = (Number(item.qtdRetirada) || 0) - (Number(item.qtdDevolvida) || 0);
    if (qtd > restante + 1e-9) return Response.json({ error: `Devolução maior que o retirado em ${item.artigo?.nome || "item"} (resta ${restante})` }, { status: 400 });
    prep.push({ item, qtd });
  }
  if (!prep.length) return Response.json({ error: "Informe ao menos uma quantidade a devolver" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    for (const p of prep) {
      await tx.artigo.update({ where: { id: p.item.artigoId }, data: { quantidade: (Number(p.item.artigo.quantidade) || 0) + p.qtd } });
      await tx.fmeItem.update({ where: { id: p.item.id }, data: { qtdDevolvida: (Number(p.item.qtdDevolvida) || 0) + p.qtd } });
      await tx.estoqueMovimentacao.create({
        data: { artigoId: p.item.artigoId, tipo: "RETORNO", quantidade: p.qtd, fmeId, usuarioId, perfil: b.perfil || null },
      });
    }
  });

  // devolução repõe estoque — pode ter voltado ao/acima do mínimo (reseta o aviso)
  for (const p of prep) await checarEstoqueMinimo(prisma, p.item.artigoId, usuarioId).catch(() => {});

  const completo = await prisma.fme.findUnique({ where: { id: fmeId }, include: { itens: { include: { artigo: { select: { id: true, nome: true, cor: true, unidade: true, quantidade: true } } } } } });
  return Response.json(completo);
}
