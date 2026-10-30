export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP, ppParaUsuario, nomeQuem } from "@/lib/pp";
import { salvarPp, efetivarPedido, faturarPedido, criticas } from "@/lib/pedidoEfetivar";   // v595

export async function GET(req, { params }) {
  const u = await usuarioPP(req, "ve");
  if (!u) return negadoPP();
  const id = Number(params.id);
  // v320 — ?arquivo=arquivoPedidoPdf|arquivoOpPdf|arquivoPcPdf|arquivoLancPdf → o PDF
  // v595 — ?anexo=ID → o arquivo anexado
  const anx = new URL(req.url).searchParams.get("anexo");
  if (anx) {
    const a = await prisma.ppAnexo.findFirst({ where: { id: Number(anx), ppId: id } });
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    return new Response(Buffer.from(a.base64, "base64"), { headers: { "Content-Type": a.tipo || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
  }
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
    include: { itens: { orderBy: { id: "asc" } }, anexos: { select: { id: true, nome: true, tipo: true, categoria: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } },
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

// v595 — salvar alterações (mantém o id e os anexos)
export async function PUT(req, { params }) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  try {
    const id = await salvarPp(Number(params.id), await req.json(), nomeQuem(u));
    const pp = await prisma.pp.findUnique({ where: { id }, include: { itens: true } });
    return Response.json({ id, ...criticas(pp) });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

// v595 — { acao: "efetivar" } · { acao: "faturar", nf, emissaoNf, entrega }
export async function POST(req, { params }) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "efetivar") return Response.json(await efetivarPedido(Number(params.id), nomeQuem(u)));
    if (b.acao === "faturar") return Response.json(await faturarPedido(Number(params.id), b, nomeQuem(u)));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { console.log("pp acao:", e); return Response.json({ error: e.message }, { status: 500 }); }
}
