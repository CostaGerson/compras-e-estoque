export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const up = (v) => (v ? String(v).trim().toUpperCase() : null);
const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const selArtigo = { id: true, nome: true, artigoInterno: true, cor: true, unidade: true, quantidade: true };

export async function GET() {
  const fmes = await prisma.fme.findMany({
    orderBy: { createdAt: "desc" },
    include: { itens: { include: { artigo: { select: selArtigo } } } },
  });
  return Response.json(fmes);
}

// próximo número FME0001, FME0002…
async function proximoNumero() {
  const ult = await prisma.fme.findFirst({ orderBy: { id: "desc" }, select: { numero: true } });
  let n = 0;
  if (ult?.numero) { const m = String(ult.numero).match(/(\d+)/); if (m) n = parseInt(m[1], 10); }
  return "FME" + String(n + 1).padStart(4, "0");
}

export async function POST(req) {
  const b = await req.json();
  const setor = b.setorDemandante || b.setor;
  const solicitante = up(b.solicitante || b.responsavelSetor);
  const responsavelEstoque = b.responsavelEstoque ? Number(b.responsavelEstoque) : null;
  const itens = Array.isArray(b.itens) ? b.itens : [];
  if (!setor) return Response.json({ error: "Informe o setor demandante" }, { status: 400 });
  if (!itens.length) return Response.json({ error: "Inclua ao menos um material" }, { status: 400 });

  // valida cada item: existe, ativo, e tem saldo suficiente
  const prep = [];
  for (const it of itens) {
    const artigoId = Number(it.artigoId);
    const qtd = dec(it.qtdRetirada ?? it.quantidade);
    if (!artigoId) return Response.json({ error: "Item sem material selecionado" }, { status: 400 });
    if (!qtd || qtd <= 0) return Response.json({ error: "Quantidade inválida em um dos itens" }, { status: 400 });
    const art = await prisma.artigo.findUnique({ where: { id: artigoId } });
    if (!art || !art.ativo) return Response.json({ error: "Material inexistente no estoque" }, { status: 400 });
    const saldo = Number(art.quantidade) || 0;
    if (qtd > saldo) return Response.json({ error: `Saldo insuficiente de ${art.nome} (disponível ${saldo})` }, { status: 400 });
    prep.push({ art, qtd, pp: up(it.pedidoProducao) });
  }

  const numero = await proximoNumero();

  // cria a FME, os itens, as movimentações de SAÍDA e baixa o saldo — numa transação
  const fme = await prisma.$transaction(async (tx) => {
    const novo = await tx.fme.create({
      data: { numero, setorDemandante: setor, responsavelSetor: solicitante, responsavelEstoque },
    });
    for (const p of prep) {
      await tx.fmeItem.create({
        data: {
          fmeId: novo.id, artigoId: p.art.id, qtdRetirada: p.qtd,
          pedidoProducao: p.pp, nomeItem: p.art.nome, cor: p.art.cor, unidade: p.art.unidade,
        },
      });
      await tx.estoqueMovimentacao.create({
        data: { artigoId: p.art.id, tipo: "SAIDA", quantidade: p.qtd, fmeId: novo.id, usuarioId: responsavelEstoque, perfil: b.perfil || null },
      });
      await tx.artigo.update({ where: { id: p.art.id }, data: { quantidade: (Number(p.art.quantidade) || 0) - p.qtd } });
    }
    return novo;
  });

  const completo = await prisma.fme.findUnique({ where: { id: fme.id }, include: { itens: { include: { artigo: { select: selArtigo } } } } });
  return Response.json(completo, { status: 201 });
}
