export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP, ppParaUsuario } from "@/lib/pp";

export async function GET(req, { params }) {
  const u = await usuarioPP(req, "ve");
  if (!u) return negadoPP();
  const id = Number(params.id);
  // v320 — ?arquivo=arquivoPedidoPdf|arquivoOpPdf|arquivoPcPdf|arquivoLancPdf → o PDF
  const arq = new URL(req.url).searchParams.get("arquivo");
  if (arq) {
    if (!["arquivoPedidoPdf", "arquivoOpPdf", "arquivoPcPdf", "arquivoLancPdf"].includes(arq)) return Response.json({ error: "Arquivo inválido." }, { status: 400 });
    const r = await prisma.pp.findUnique({ where: { id }, select: { numero: true, [arq]: true } });
    const pp1 = ppParaUsuario({ ...r }, u);
    const v = pp1?.[arq];
    if (!v) return Response.json({ error: "PDF não encontrado." }, { status: 404 });
    const nome = { arquivoPedidoPdf: "PV", arquivoOpPdf: "PP", arquivoPcPdf: "PC", arquivoLancPdf: "LANCAMENTO" }[arq];
    return new Response(Buffer.from(String(v).replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome} ${r.numero || id}.pdf"` } });
  }
  const pp = await prisma.pp.findUnique({
    where: { id },
    include: { itens: { orderBy: { id: "asc" } } },
  });
  if (!pp) return Response.json({ error: "PP não encontrado" }, { status: 404 });
  return Response.json(ppParaUsuario(pp, u));
}

export async function DELETE(req, { params }) {
  if (!(await usuarioPP(req))) return negadoPP();
  const id = Number(params.id);
  await prisma.pp.delete({ where: { id } }); // itens em cascata
  return Response.json({ ok: true });
}
