export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { listarFretes, registrarEntrega, desfazerEntrega, arquivoFrete } from "@/lib/fretes";

// v557 — fretes (CT-e) da Análise da logística
// GET ?u=&guia=COMPRA|ENTREGA|BAIXADOS&de=&ate=&busca=          → lista
// GET ?u=&id=&arq=cte-xml|cte-pdf|nf-xml|nf-pdf[&nf=chave]       → arquivo
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  if (sp.get("arq")) {
    const a = await arquivoFrete(sp.get("id"), sp.get("arq"), sp.get("nf"));
    if (!a) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    return new Response(a.buf, { headers: {
      "Content-Type": a.pdf ? "application/pdf" : "application/xml; charset=utf-8",
      "Content-Disposition": `${a.pdf && !sp.get("baixar") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
    } });
  }
  return Response.json(await listarFretes({ guia: sp.get("guia") || "COMPRA", de: sp.get("de"), ate: sp.get("ate"), busca: sp.get("busca") }));
}

// POST { usuarioId, acao: "entrega", id, data, obs } | { usuarioId, acao: "desfazer", id }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const r = b.acao === "entrega" ? await registrarEntrega(b.id, b, nomeU(u)) : b.acao === "desfazer" ? await desfazerEntrega(b.id) : { error: "Ação inválida." };
  return Response.json(r, { status: r.error ? 400 : 200 });
}
