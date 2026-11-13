// v647 — item padrão: detalhe, edição, exclusão e anexos (layout / tabela de medidas)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { detalheItemPadrao, dadosItemPadrao, quemDe } from "@/lib/itensPadrao";

export async function GET(req, { params }) {
  const id = Number(params.id);
  const anx = new URL(req.url).searchParams.get("anexo");
  if (anx) {
    const a = await prisma.itemPadraoAnexo.findFirst({ where: { id: Number(anx), itemId: id } });
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    return new Response(Buffer.from(a.base64, "base64"), { headers: { "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
  }
  const it = await detalheItemPadrao(id);
  return it ? Response.json(it) : Response.json({ error: "Item não encontrado." }, { status: 404 });
}

// { ...campos } · { acao: "anexar", tipo, nome, mime, base64 } · { acao: "tirarAnexo", anexoId }
export async function PUT(req, { params }) {
  const id = Number(params.id);
  const b = await req.json().catch(() => ({}));
  const quem = await quemDe(req);
  if (b.acao === "anexar") {
    if (!b.base64 || !["LAYOUT", "MEDIDAS"].includes(b.tipo)) return Response.json({ error: "Anexo inválido." }, { status: 400 });
    const base64 = String(b.base64).replace(/^data:[^,]+,/, "");
    const a = await prisma.itemPadraoAnexo.create({ data: { itemId: id, tipo: b.tipo, nome: String(b.nome || "anexo").slice(0, 200), mime: b.mime || null,
      tamanho: Math.round(base64.length * 0.75), base64, criadoPorNome: quem } });
    return Response.json({ ok: true, id: a.id });
  }
  // v810 — pedido: "salvar edições nos parâmetros no item padrão?" → só os parâmetros mudam
  if (b.acao === "parametros") {
    const p = b.parametros && typeof b.parametros === "object" ? Object.fromEntries(Object.entries(b.parametros).filter(([, v]) => v != null && v !== "")) : {};
    await prisma.itemPadrao.update({ where: { id }, data: { parametros: Object.keys(p).length ? p : null, atualizadoPorNome: quem } });
    return Response.json({ ok: true });
  }
  if (b.acao === "tirarAnexo") { await prisma.itemPadraoAnexo.deleteMany({ where: { id: Number(b.anexoId), itemId: id } }); return Response.json({ ok: true }); }
  const d = await dadosItemPadrao(b);
  if (d.error) return Response.json(d, { status: 400 });
  await prisma.itemPadrao.update({ where: { id }, data: { ...d, atualizadoPorNome: quem } });
  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  await prisma.itemPadrao.update({ where: { id: Number(params.id) }, data: { ativo: false, atualizadoPorNome: await quemDe(req) } });
  return Response.json({ ok: true });
}
