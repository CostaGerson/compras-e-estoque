// v1085 — ERP → sistema de produção da NORT (Gerson): demandas de DTF e sublimação de todos os canais.
//   GET ?desde=ISO&status=NOVA,RECEBIDA&pedido=&metodo=DTF|SUBLIMACAO   cabeçalho X-Api-Key = token da NORT (o mesmo de /api/ext/nort/*)
//   Sem "desde": todas as abertas (sem ENTREGUE/CANCELADA). Ver claude/integracao-dtf-sublimacao.md.
export const dynamic = "force-dynamic";
import { autorizadoNort } from "@/lib/nortInteg";
import { sincronizarRecentes, listarDemandas } from "@/lib/personalizacaoExt";

export async function GET(req) {
  if (!(await autorizadoNort(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    await sincronizarRecentes();
    const demandas = await listarDemandas({ desde: q.get("desde"), status: q.get("status"), pedido: q.get("pedido"), metodo: q.get("metodo") });
    return Response.json({ ok: true, versao: 1, geradoEm: new Date().toISOString(), total: demandas.length, demandas });
  } catch (e) { console.log("ext/personalizacao:", e.message); return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}
