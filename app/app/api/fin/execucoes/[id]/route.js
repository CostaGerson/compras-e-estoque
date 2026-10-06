export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { detalheExecucao, salvarExecucao, salvarEvolucao, anexarExecucao } from "@/lib/finAtraso";

// GET ?u=            → execução com contas, evoluções e anexos
// GET ?u=&anexo=ID   → baixa o anexo
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const an = Number(sp.get("anexo"));
  if (an) {
    const a = await prisma.finExecucaoAnexo.findFirst({ where: { id: an, execucaoId: Number(params.id) } });
    if (!a) return new Response("Anexo não encontrado.", { status: 404 });
    const mime = a.mime || "application/octet-stream";
    return new Response(Buffer.from(a.conteudo, "base64"), { headers: {
      "Content-Type": mime, "Content-Disposition": `${/pdf|image/.test(mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nome)}` } });
  }
  const d = await detalheExecucao(params.id);
  return d ? Response.json(d) : Response.json({ error: "Execução não encontrada." }, { status: 404 });
}

// PATCH { usuarioId, titulo, processo, cliente, vara, advogado, dataAbertura, observacao, status }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  return Response.json(await salvarExecucao(params.id, b));
}

// POST { usuarioId, acao: "evolucao", competencia, texto } | { acao: "anexos", arquivos: [{ nome, mime, conteudo }] }
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  try {
    if (b.acao === "evolucao") return Response.json(await salvarEvolucao(params.id, b.competencia, b.texto, nomeU(u)));
    if (b.acao === "anexos") { await anexarExecucao(params.id, b.arquivos, nomeU(u)); return Response.json(await detalheExecucao(params.id)); }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}

// DELETE { usuarioId, anexoId }
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  await prisma.finExecucaoAnexo.deleteMany({ where: { id: Number(b.anexoId), execucaoId: Number(params.id) } });
  return Response.json(await detalheExecucao(params.id));
}
