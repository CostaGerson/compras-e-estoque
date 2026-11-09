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
    return new Response(Buffer.from(a.base64, "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": a.tipo || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
  }
  // v650 — ?item=ID&k=n → arquivo n do item
  const itq = new URL(req.url).searchParams.get("item");
  if (itq) {
    const it = await prisma.ppItem.findFirst({ where: { id: Number(itq), ppId: id }, select: { anexosJson: true } });
    const a = Array.isArray(it?.anexosJson) ? it.anexosJson[Number(new URL(req.url).searchParams.get("k")) || 0] : null;
    if (!a?.base64) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    const m = String(a.base64).match(/^data:([^;,]+)[^,]*,/);
    return new Response(Buffer.from(String(a.base64).replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": a.mime || m?.[1] || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome || "arquivo")}"` } });
  }
  const arq = new URL(req.url).searchParams.get("arquivo");
  if (arq) {
    if (!["arquivoPedidoPdf", "arquivoOpPdf", "arquivoPcPdf", "arquivoLancPdf"].includes(arq)) return Response.json({ error: "Arquivo inválido." }, { status: 400 });
    const r = await prisma.pp.findUnique({ where: { id }, select: { numero: true, [arq]: true } });
    const pp1 = ppParaUsuario({ ...r }, u);
    const v = pp1?.[arq];
    if (!v) return Response.json({ error: "PDF não encontrado." }, { status: 404 });
    const nome = { arquivoPedidoPdf: "PV", arquivoOpPdf: "PP", arquivoPcPdf: "PC", arquivoLancPdf: "LANCAMENTO" }[arq];
    return new Response(Buffer.from(String(v).replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome} ${r.numero || id}.pdf"` } });
  }
  const pp = await prisma.pp.findUnique({
    where: { id },
    include: { itens: { orderBy: { id: "asc" } }, anexos: { select: { id: true, nome: true, tipo: true, categoria: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } },
  });
  if (!pp) return Response.json({ error: "PP não encontrado" }, { status: 404 });
  const { ppsRecebendoDetalhes } = await import("@/lib/dadosLink");   // v707
  const rec = pp.efetivadoEm ? {} : await ppsRecebendoDetalhes([pp.id]);
  return Response.json({ ...ppParaUsuario(pp, u), recebendoDetalhes: !!rec[pp.id] }, { headers: { "Cache-Control": "no-store" } });   // v660 — nunca devolve o lançamento antigo do cache
}

export async function DELETE(req, { params }) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const id = Number(params.id);
  // v671 — pedido com número (KM ou lançado) vai para a lixeira de pedidos: senão o KM / a lista o recriam
  const pp = await prisma.pp.findUnique({ where: { id }, select: { numero: true } });
  if (pp?.numero && (await prisma.pedidoVenda.findUnique({ where: { numero: pp.numero }, select: { id: true } }))) {
    const motivo = new URL(req.url).searchParams.get("motivo") || "";
    const { excluirPedido } = await import("@/lib/pedidoLixeira");
    const r = await excluirPedido(pp.numero, { motivo, quem: nomeQuem(u) });
    if (r.error) return Response.json(r, { status: 400 });
    return Response.json({ ok: true, lixeira: true });
  }
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
    if (b.acao === "efetivar") {
      const r = await efetivarPedido(Number(params.id), nomeQuem(u));
      // v654 — item sem layout: tarefa de criação de layout para o arte finalista (o pedido segue normal)
      const kmAss = r?.ok ? (await prisma.pp.findUnique({ where: { id: Number(params.id) }, select: { kmAssumidoEm: true } }))?.kmAssumidoEm : null;   // v730 — pedido do KM assumido: não pede layout
      if (r?.ok && !kmAss) { try { const { gerarCriacaoLayout } = await import("@/lib/layoutFluxo"); r.tarefaLayout = await gerarCriacaoLayout(Number(params.id), u); } catch (e) { console.log("layout:", e.message); } }
      return Response.json(r);
    }
    if (b.acao === "faturar") return Response.json(await faturarPedido(Number(params.id), b, nomeQuem(u)));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { console.log("pp acao:", e); return Response.json({ error: e.message }, { status: 500 }); }
}
