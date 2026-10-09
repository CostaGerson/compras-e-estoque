export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivo, anexar, detalhe } from "@/lib/tarefas";
import { ehMaster } from "@/lib/acesso";

// GET ?u=&arquivo=id → baixa o arquivo (quem vê a demanda)
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!u || !(await detalhe(params.id, u))) return new Response("Sem acesso.", { status: 403 });
  const a = await prisma.tarefaArquivo.findFirst({ where: { id: Number(sp.get("arquivo")) || 0, tarefaId: Number(params.id) } });
  if (!a) return new Response("Não encontrado.", { status: 404 });
  return new Response(Buffer.from(a.conteudo, "base64"), { headers: { "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
}

// POST { usuarioId, nome, mime, conteudo }
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await anexar(params.id, b, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}

// DELETE { usuarioId, arquivoId } → quem anexou, quem criou a demanda ou o master
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const a = await prisma.tarefaArquivo.findFirst({ where: { id: Number(b.arquivoId) || 0, tarefaId: Number(params.id) }, include: { tarefa: { select: { criadoPorId: true } } } });
  if (!a) return Response.json({ ok: true });
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  if (!(ehMaster(u) || a.tarefa.criadoPorId === u.id || a.criadoPorNome === quem)) return Response.json({ error: "Só quem anexou, quem criou a demanda ou o master excluem." }, { status: 403 });
  await prisma.tarefaArquivo.delete({ where: { id: a.id } });
  return Response.json({ ok: true });
}
