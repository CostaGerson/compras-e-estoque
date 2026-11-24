// v1086 — Compras › Devoluções: devolver itens da OC, OD (ordem de devolução) e crédito com o fornecedor
export const dynamic = "force-dynamic";
import * as D from "@/lib/devolucoes";

const resp = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
// GET → painel · ?boletos=fornecedorId · ?saldos=1,2,3
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  try {
    if (q.get("boletos")) return resp(await D.boletosDoFornecedor(q.get("boletos")));
    if (q.get("saldos") != null) return resp({ saldos: await D.saldos(String(q.get("saldos")).split(",")) });
    return resp(await D.painel());
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
// POST { acao: devolver | od | cancelar | boletos | reservar | decidirNf, … , quem }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const quem = b.quem ? String(b.quem).toUpperCase().slice(0, 80) : null;
  try {
    switch (b.acao) {
      case "devolver": return resp(await D.devolverItens(b, quem));
      case "od": return resp(await D.gerarOd(b.ids, quem, b.obs));
      case "cancelar": return resp(await D.cancelarDevolucao(b.id, quem));
      case "boletos": return resp(await D.usarEmBoletos(b.fornecedorId, b.itens, quem));
      case "reservar": return resp(await D.reservarNaOc(b.ocId, quem));
      case "decidirNf": return resp(await D.decidirNf(b.ocId, b.decisao, quem));
      default: return Response.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (e) { console.log("devolucoes:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}
