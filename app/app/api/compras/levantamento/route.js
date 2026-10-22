// v404 — Levantamento: todas as demandas registradas (por item de pedido), sugestões de equiparação e consolidado por artigo
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { montarLevantamento } from "@/lib/compras";

async function itensAbertos() {
  const itens = await prisma.compraItem.findMany({ where: { status: "LEVANTAMENTO" }, orderBy: [{ entrega: "asc" }, { pedidoNumero: "asc" }] });
  const ativos = new Set((await prisma.pedidoVenda.findMany({ where: { numero: { in: [...new Set(itens.map((i) => i.pedidoNumero))] }, status: "ANDAMENTO" }, select: { numero: true } })).map((p) => p.numero));
  return itens.filter((i) => ativos.has(i.pedidoNumero));
}

export async function GET() {
  const itens = await itensAbertos();
  const lev = montarLevantamento(itens);
  return Response.json({ ...lev, itens: itens.length, pedidos: new Set(itens.map((i) => i.pedidoNumero)).size });
}

// { de, para } junta as demandas do artigo "de" (menos detalhado) no "para"; { de, para: null } desfaz
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const de = Number(b.de), para = b.para != null ? Number(b.para) : null;
  if (!de) return Response.json({ error: "Informe o artigo." }, { status: 400 });
  let n = 0;
  for (const it of await itensAbertos()) {
    let mudou = false;
    const dem = (it.demanda || []).map((d) => {
      if (d.artigoId !== de) return d;
      if (para ? d.equiparadoA : !d.equiparadoA) return d;
      mudou = true; n++;
      return { ...d, equiparadoA: para };
    });
    if (mudou) await prisma.compraItem.update({ where: { id: it.id }, data: { demanda: dem } });
  }
  return Response.json({ ok: true, linhas: n });
}
