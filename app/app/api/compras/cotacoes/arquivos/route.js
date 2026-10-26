// v481 — arquivos das cotações
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const MAX = 15 * 1024 * 1024;
// GET ?id= → abre/baixa o arquivo
export async function GET(req) {
  const id = Number(new URL(req.url).searchParams.get("id")) || 0;
  const a = await prisma.cotacaoArquivo.findUnique({ where: { id } });
  if (!a) return new Response("Não encontrado.", { status: 404 });
  return new Response(Buffer.from(a.conteudo, "base64"), { headers: { "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
}
// POST { cotacaoId, nome, mime, conteudo (base64), quem }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const c = await prisma.cotacao.findUnique({ where: { id: Number(b.cotacaoId) || 0 }, select: { id: true } });
  if (!c) return Response.json({ error: "Cotação não encontrada." }, { status: 400 });
  const conteudo = String(b.conteudo || "").replace(/^data:[^,]*,/, "");
  const tamanho = Math.floor((conteudo.length * 3) / 4);
  if (!conteudo) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  if (tamanho > MAX) return Response.json({ error: `${b.nome}: arquivo maior que 15 MB.` }, { status: 400 });
  const a = await prisma.cotacaoArquivo.create({ data: { cotacaoId: c.id, nome: String(b.nome || "arquivo").slice(0, 200), mime: b.mime || null, tamanho, conteudo, criadoPorNome: b.quem || null } });
  return Response.json({ ok: true, id: a.id });
}
// DELETE { id }
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  await prisma.cotacaoArquivo.deleteMany({ where: { id: Number(b.id) || 0 } });
  return Response.json({ ok: true });
}
