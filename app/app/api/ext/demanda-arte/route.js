// v752 — Cronograma PCP: solicitação de desenvolvimento de arte → demanda na agenda do Maycon.
// POST { origem: "PCP", chave, responsavel, itens: [{ pedido, cliente, produto, qtd, tipos, detalhes: [texto] }] }
// Mesma chave duas vezes não duplica (devolve a que já existe com jaExistia: true).
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { criarDemandaArte } from "@/lib/demandaArteExt";

const autorizado = async (req) => { const tk = req.headers.get("x-api-key") || ""; return !!tk && tk === (await tokenExterno()); };

export async function POST(req) {
  if (!(await autorizado(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: "Corpo inválido (JSON)." }, { status: 400 });
  try {
    const r = await criarDemandaArte(b);
    return Response.json(r, { status: r.ok ? 200 : 422 });
  } catch (e) {
    console.log("ext/demanda-arte:", e.message);
    return Response.json({ ok: false, error: "Não foi possível criar a demanda no ERP." }, { status: 500 });
  }
}
