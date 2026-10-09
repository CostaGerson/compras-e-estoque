export const dynamic = "force-dynamic";
import { usuarioRH, negadoRH } from "@/lib/rh";
import { planoFerias, salvar, excluir } from "@/lib/rhFerias";

// GET ?u=&ano= → plano do ano, saldos e alertas
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioRH(sp.get("u"));
  if (!u) return negadoRH();
  const ano = Number(sp.get("ano")) || new Date().getFullYear();
  try { return Response.json(await planoFerias(ano)); } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

// POST { usuarioId, ferias: { id?, pessoaId | coletiva + pessoas[], inicio, fim, status, abono, obs, todaColetiva } }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  const r = await salvar(b.ferias || {}, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}

// DELETE { usuarioId, id, todaColetiva }
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  return Response.json(await excluir(b.id, b.todaColetiva));
}
