export const dynamic = "force-dynamic";
import { usuarioRH, negadoRH } from "@/lib/rh";
import { lancarIfood } from "@/lib/rhLancamentos";

// POST { usuarioId, empresa, valor, vencimento, pix?, relatorio:{nome,conteudo}, boleto?:{nome,conteudo} }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  const r = await lancarIfood(b, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
