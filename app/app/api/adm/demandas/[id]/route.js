export const dynamic = "force-dynamic";
import { usuarioAdm, negadoAdm, atualizar, excluir } from "@/lib/admDemandas";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";

// v425 — GET ?u= → arquivo da cotação de frete · v450 — GET ?u=&prefill=1 → dados da demanda de rota de entrega do pedido
export async function GET(req, { params }) {
  const q = new URL(req.url).searchParams;
  const u = await usuarioAtivoFin(q.get("u"));
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
  if (q.get("prefill")) { const { prefillRota } = await import("@/lib/faturamentoFluxo"); const r = await prefillRota(params.id); return Response.json(r, { status: r.error ? 400 : 200 }); }
  const d = await prisma.admDemanda.findUnique({ where: { id: Number(params.id) }, select: { cotacao: true } });
  const c = d?.cotacao;
  if (!c?.anexo) return Response.json({ error: "Sem anexo." }, { status: 404 });
  return new Response(Buffer.from(c.anexo, "base64"), { headers: { "content-type": c.anexoMime || "application/octet-stream", "content-disposition": `inline; filename="${encodeURIComponent(c.anexoNome || "cotacao")}"` } });
}

// PATCH { usuarioId, status?, retorno?, titulo?, descricao?, prazo?, prioridade?, responsavelId? }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAdm(b.usuarioId);
  if (!u) return negadoAdm();
  if (b.acao === "forma") { const { escolherForma } = await import("@/lib/faturamentoFluxo"); const r = await escolherForma(params.id, b.forma); return Response.json(r, { status: r.error ? 400 : 200 }); }   // v450
  const r = await atualizar(params.id, b, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
// DELETE { usuarioId }
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAdm(b.usuarioId);
  if (!u) return negadoAdm();
  const r = await excluir(params.id, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
