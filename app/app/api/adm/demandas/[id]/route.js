export const dynamic = "force-dynamic";
import { usuarioAdm, negadoAdm, atualizar, excluir } from "@/lib/admDemandas";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";

// v425 — GET ?u= → arquivo da cotação de frete
export async function GET(req, { params }) {
  const u = await usuarioAtivoFin(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
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
