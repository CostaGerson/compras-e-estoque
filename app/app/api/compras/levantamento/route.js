// v404 — Levantamento: todas as demandas registradas (por item de pedido), sugestões de equiparação e consolidado por artigo
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { montarLevantamento, itensAbertos } from "@/lib/compras";

export async function GET() {
  const itens = await itensAbertos();
  const lev = montarLevantamento(itens);
  // v734 — quem lançou cada compra avulsa (para liberar a exclusão da demanda a essa pessoa)
  const avIds = [...new Set(itens.filter((i) => /^AV\d+$/.test(i.pedidoNumero)).map((i) => Number(i.pedidoNumero.slice(2))))];
  const av = avIds.length ? await prisma.compraAvulsa.findMany({ where: { id: { in: avIds } }, select: { id: true, criadoPorNome: true } }) : [];
  const autores = Object.fromEntries(av.map((c) => [`AV${c.id}`, c.criadoPorNome || null]));
  return Response.json({ ...lev, autores, itens: itens.length, pedidos: new Set(itens.map((i) => i.pedidoNumero)).size });
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
