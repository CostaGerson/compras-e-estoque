// v654 — tarefa de layout: GET ?u= → OP dos itens · POST { usuarioId, acao: marcar|enviar|aprovar|reprovar, idx, arquivoId, motivo }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivo } from "@/lib/tarefas";
import { ehMaster } from "@/lib/acesso";
import { opDaTarefa, marcarLayout, enviarAprovacao, decidirLayout } from "@/lib/layoutFluxo";

const pode = (t, u) => !!t && !!u && (t.responsavelId === u.id || t.criadoPorId === u.id || ehMaster(u) || !!u.diretoria);

export async function GET(req, { params }) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  const t = await prisma.tarefa.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!t?.layout || !pode(t, u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  // arquivos do pedido / do item para a OP (quem tem a tarefa, mesmo sem acesso ao lançamento)
  if (sp.get("anexo") || sp.get("item") != null && sp.get("k") != null) {
    const ppId = Number(t.layout.ppId) || 0;
    let nome = "arquivo", mime = null, b64 = null;
    if (sp.get("anexo")) { const a = await prisma.ppAnexo.findFirst({ where: { id: Number(sp.get("anexo")), ppId } }); if (a) { nome = a.nome; mime = a.tipo; b64 = a.base64; } }
    else { const its = await prisma.ppItem.findMany({ where: { ppId }, orderBy: { id: "asc" }, select: { anexosJson: true } }); const a = (its[Number(sp.get("item"))]?.anexosJson || [])[Number(sp.get("k"))]; if (a) { nome = a.nome; mime = a.mime; b64 = a.base64; } }
    if (!b64) return new Response("Não encontrado.", { status: 404 });
    return new Response(Buffer.from(String(b64).replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(nome)}"` } });
  }
  return Response.json(await opDaTarefa(t));
}

export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  const t = await prisma.tarefa.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!t?.layout || !pode(t, u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  let r;
  if (b.acao === "marcar") r = await marcarLayout(t, b.idx, b.arquivoId, !!b.remover);   // v736 — remover: tira o arquivo do item
  else if (b.acao === "enviar") r = await enviarAprovacao(t, u);
  else if (b.acao === "aprovar") r = await decidirLayout(t, u, true);
  else if (b.acao === "reprovar") r = await decidirLayout(t, u, false, b.motivo);
  else r = { error: "Ação?" };
  return Response.json(r, { status: r.error ? 400 : 200 });
}
