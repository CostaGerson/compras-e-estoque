// v757 — demanda com aprovação (arte finalista): GET ?u= → arquivos da rodada · POST { usuarioId, acao: enviar|aprovar|reprovar, motivo }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivo } from "@/lib/tarefas";
import { arquivosDaRodada, enviarParaAprovacao, decidirAprovacao, versoesAprovacao } from "@/lib/tarefaAprovacao";
import { zipSync } from "fflate";

const A_ORIG = (t) => (t.aprovacao?.etapa === "APROVACAO" ? Number(t.aprovacao.origemId) || t.id : t.id);
const pode = (t, u) => !!t && !!u && (t.responsavelId === u.id || t.criadoPorId === u.id || !!u.isMaster || Number(t.aprovacao?.solicitanteId) === u.id);

export async function GET(req, { params }) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  const t = await prisma.tarefa.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!t?.aprovacao || !pode(t, u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  // v788 — arquivo de uma versão: ?arquivo=id (um) ou ?versao=tarefaId&zip=1 (todos da versão em .zip)
  if (sp.get("arquivo") || sp.get("zip")) {
    const vs = await versoesAprovacao(t), ids = new Set(vs.map((v) => v.tarefaId));
    if (sp.get("arquivo")) {
      const a = await prisma.tarefaArquivo.findUnique({ where: { id: Number(sp.get("arquivo")) || 0 } });
      if (!a || !ids.has(a.tarefaId)) return new Response("Não encontrado.", { status: 404 });
      return new Response(Buffer.from(a.conteudo, "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
    }
    const v = vs.find((x) => x.tarefaId === Number(sp.get("versao")));
    if (!v) return new Response("Não encontrado.", { status: 404 });
    const l = await prisma.tarefaArquivo.findMany({ where: { tarefaId: v.tarefaId }, orderBy: { id: "asc" } });
    const usados = {}, arqs = {};
    for (const x of l) {
      let n = String(x.nome || `arquivo-${x.id}`).replace(/[\\/:*?"<>|]/g, "_");
      if (usados[n.toLowerCase()]) { const i = n.lastIndexOf("."); n = i > 0 ? `${n.slice(0, i)} (${x.id})${n.slice(i)}` : `${n} (${x.id})`; }
      usados[n.toLowerCase()] = 1; arqs[n] = [new Uint8Array(Buffer.from(x.conteudo, "base64")), { level: 0 }];
    }
    return new Response(Buffer.from(zipSync(arqs)), { headers: { "Cache-Control": "no-store", "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="demanda-${Number(A_ORIG(t))}-V${v.versao}.zip"` } });
  }
  return Response.json({ arquivos: await arquivosDaRodada(t), aprovacao: t.aprovacao, versoes: await versoesAprovacao(t) });
}

export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  const t = await prisma.tarefa.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!t?.aprovacao || !pode(t, u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  let r;
  if (b.acao === "enviar") r = await enviarParaAprovacao(t, u);
  else if (b.acao === "aprovar") r = await decidirAprovacao(t, u, true);
  else if (b.acao === "reprovar") r = await decidirAprovacao(t, u, false, b.motivo);
  else r = { error: "Ação?" };
  return Response.json(r, { status: r.error ? 400 : 200 });
}
