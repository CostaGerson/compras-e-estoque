export const dynamic = "force-dynamic";
import { usuarioRH, negadoRH } from "@/lib/rh";
import { lancarContaRH } from "@/lib/rhLancamentos";

// POST { usuarioId, empresa, titulo, parceiro, documento?, valor, vencimento, observacao?, arquivos?:[{nome,mime,conteudo}] }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  const r = await lancarContaRH(b, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
