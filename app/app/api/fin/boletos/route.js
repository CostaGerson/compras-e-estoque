// v1196 — cobrança Bradesco pelo ERP: instruções do boleto, remessa e impressão
export const dynamic = "force-dynamic";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { painelCobranca, solicitar, cancelarInstrucao, gerarRemessaPendentes, arquivoRemessa, boletosHtml, salvarConfig } from "@/lib/boletos";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioSoMaster(sp.get("u"), "contasReceber");
  if (!u) return soMaster();
  if (sp.get("remessa")) {
    const r = await arquivoRemessa(sp.get("remessa"));
    if (!r) return Response.json({ error: "Remessa não encontrada." }, { status: 404 });
    return new Response(Buffer.from(r.conteudo, "latin1"), { headers: { "Content-Type": "text/plain; charset=iso-8859-1", "Content-Disposition": `attachment; filename="${r.arquivo}"` } });
  }
  if (sp.get("boletos")) {
    const h = await boletosHtml(sp.get("boletos").split(","));
    if (!h) return new Response("Nenhuma das contas tem boleto (nosso número).", { status: 404 });
    return new Response(h, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return Response.json(await painelCobranca());
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasReceber");
  if (!u) return soMaster();
  const quem = nomeU(u);
  try {
    if (b.acao === "instrucao") {
      const ids = Array.isArray(b.ids) ? b.ids : [b.tituloId];
      const res = [];
      for (const id of ids) res.push({ id, ...(await solicitar(id, b.tipo, b.dados || {}, quem)) });
      const erros = res.filter((x) => x.error).map((x) => `conta ${x.id}: ${x.error}`);
      return Response.json({ ok: res.some((x) => x.ok), feitas: res.filter((x) => x.ok).length, erros }, { status: res.some((x) => x.ok) ? 200 : 400 });
    }
    if (b.acao === "cancelar") return Response.json(await cancelarInstrucao(b.id));
    if (b.acao === "remessa") { const r = await gerarRemessaPendentes(quem); return Response.json(r, { status: r.error ? 400 : 200 }); }
    if (b.acao === "config") { const r = await salvarConfig(b.dados || {}); return Response.json(r, { status: r.error ? 400 : 200 }); }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
