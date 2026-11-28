// v628 — Dados › Tributário
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gerencial } from "@/lib/acesso";
import { dadosTributarios, salvarEmpresa, salvarNatureza, excluirNatureza, salvarProduto } from "@/lib/tributario";

const usuario = async (id) => { const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 } }); return u?.ativo ? u : null; };
const pode = (u) => u && (gerencial(u) || u.setor === "FINANCEIRO");
const podeFaturar = (u) => pode(u) || /ADM/.test(String(u?.setor || ""));   // v1192 — NF-e do pedido: financeiro, gestão e ADM
export async function GET(req) {
  const u = await usuario(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  if (sp.get("acao") === "levantamento") {   // v936 — o que o KM emitiu (XMLs de saída), para a troca de emissor
    if (!pode(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
    const { levantamentoFiscal } = await import("@/lib/levantamentoFiscal");
    return Response.json(await levantamentoFiscal({ meses: Number(sp.get("meses")) || 12, empresa: sp.get("empresa") === "NORT" ? "NORT" : "MERIDIAN" }));
  }
  // v1189 — NF-e emitidas pelo ERP
  if (sp.get("acao") === "nfe") { const { listarEmissoes } = await import("@/lib/nfeEmissao"); return Response.json({ notas: await listarEmissoes(sp.get("empresa") || null) }); }
  if (sp.get("acao") === "nfePedido") {   // v1192 — rascunho da NF-e do pedido + NF-e já emitidas para ele
    if (!podeFaturar(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
    const { rascunhoNfePedido, nfesDoPedido } = await import("@/lib/nfePedido");
    const r = await rascunhoNfePedido(sp.get("numero"), sp.get("empresa") === "NORT" ? "NORT" : "MERIDIAN");
    return Response.json({ ...r, emitidas: await nfesDoPedido(sp.get("numero")) }, { status: r.error ? 404 : 200 });
  }
  if (sp.get("acao") === "danfe") {   // v1190
    if (!podeFaturar(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
    const { xmlEmissao } = await import("@/lib/nfeEmissao"); const x = await xmlEmissao(sp.get("id"));
    if (!x) return Response.json({ error: "NF-e não encontrada." }, { status: 404 });
    const { htmlDanfe } = await import("@/lib/danfe");
    return new Response(htmlDanfe(x.xml, { autoPrint: sp.get("imprimir") !== "0" }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (sp.get("acao") === "nfeXml") {
    if (!podeFaturar(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
    const { xmlEmissao } = await import("@/lib/nfeEmissao"); const x = await xmlEmissao(sp.get("id"));
    if (!x) return Response.json({ error: "NF-e não encontrada." }, { status: 404 });
    return new Response(x.xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${x.nome}"` } });
  }
  return Response.json(await dadosTributarios());
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuario(b.usuarioId);
  if (b.acao === "emitirPedido") {   // v1192
    if (!podeFaturar(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
    try { const { emitirNfePedido } = await import("@/lib/nfePedido"); const r = await emitirNfePedido(b.numero, b.nota || {}, u.nome); return Response.json(r, { status: r.error ? 400 : 200 }); }
    catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
  }
  if (!pode(u)) return Response.json({ error: "Só o financeiro/gestão altera os dados tributários." }, { status: 403 });
  // v1188 — certificado A1 e teste de comunicação com a SEFAZ-MG
  if (b.acao === "certificado") {
    try { const { salvarCertificado } = await import("@/lib/nfeCert"); const r = await salvarCertificado(b.empresa, b.conteudo, b.senha, u.nome); return Response.json(r, { status: r.error ? 400 : 200 }); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
  }
  if (b.acao === "excluirCertificado") { const { excluirCertificado } = await import("@/lib/nfeCert"); return Response.json(await excluirCertificado(b.empresa)); }
  if (b.acao === "testarSefaz") {
    try { const { statusServico } = await import("@/lib/nfeSefaz"); return Response.json(await statusServico(b.empresa, b.ambiente)); }
    catch (e) { return Response.json({ ok: false, erro: e.message }); }
  }
  if (b.acao === "emitirTeste") {
    try { const { emitirTeste } = await import("@/lib/nfeEmissao"); const r = await emitirTeste(b.empresa === "NORT" ? "NORT" : "MERIDIAN", u.nome); return Response.json(r, { status: r.error ? 400 : 200 }); }
    catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
  }
  const r = b.acao === "empresa" ? await salvarEmpresa(b.dados, prisma, b.empresaId) : b.acao === "produto" ? await salvarProduto(b.dados || {}) : b.acao === "excluirNatureza" ? await excluirNatureza(b.id) : await salvarNatureza(b.dados || {});
  return Response.json(r, { status: r.error ? 400 : 200 });
}
