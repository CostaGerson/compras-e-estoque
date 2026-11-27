// v628 — Dados › Tributário
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gerencial } from "@/lib/acesso";
import { dadosTributarios, salvarEmpresa, salvarNatureza, excluirNatureza, salvarProduto } from "@/lib/tributario";

const usuario = async (id) => { const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 } }); return u?.ativo ? u : null; };
const pode = (u) => u && (gerencial(u) || u.setor === "FINANCEIRO");
export async function GET(req) {
  const u = await usuario(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  if (sp.get("acao") === "levantamento") {   // v936 — o que o KM emitiu (XMLs de saída), para a troca de emissor
    if (!pode(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
    const { levantamentoFiscal } = await import("@/lib/levantamentoFiscal");
    return Response.json(await levantamentoFiscal({ meses: Number(sp.get("meses")) || 12, empresa: sp.get("empresa") === "NORT" ? "NORT" : "MERIDIAN" }));
  }
  return Response.json(await dadosTributarios());
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuario(b.usuarioId);
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
  const r = b.acao === "empresa" ? await salvarEmpresa(b.dados, prisma, b.empresaId) : b.acao === "produto" ? await salvarProduto(b.dados || {}) : b.acao === "excluirNatureza" ? await excluirNatureza(b.id) : await salvarNatureza(b.dados || {});
  return Response.json(r, { status: r.error ? 400 : 200 });
}
