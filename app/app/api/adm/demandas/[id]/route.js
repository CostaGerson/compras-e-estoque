export const dynamic = "force-dynamic";
import { usuarioAdm, negadoAdm, atualizar, excluir } from "@/lib/admDemandas";

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
