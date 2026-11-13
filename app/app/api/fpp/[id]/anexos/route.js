// v665 — anexos da FPP: GET (lista) · GET ?arquivo=id (baixa) · POST { nome, mime, base64, quem } · DELETE ?anexo=id
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  const fppId = Number(params.id) || 0;
  const arq = new URL(req.url).searchParams.get("arquivo");
  if (arq) {
    const a = await prisma.fppAnexo.findFirst({ where: { id: Number(arq), fppId } });
    if (!a) return new Response("Não encontrado.", { status: 404 });
    return new Response(Buffer.from(a.base64, "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
  }
  // v806 — ?aplicacao=uid → arquivos daquela estampa · ?aplicacao=todas → todos com uid · sem o parâmetro → só os anexos gerais
  const ap = new URL(req.url).searchParams.get("aplicacao");
  const l = await prisma.fppAnexo.findMany({ where: { fppId, aplicacaoUid: ap === "todas" ? { not: null } : ap || null }, orderBy: { id: "asc" }, select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true, aplicacaoUid: true } });
  return Response.json(l, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req, { params }) {
  const fppId = Number(params.id) || 0;
  if (!(await prisma.fpp.findUnique({ where: { id: fppId }, select: { id: true } }))) return Response.json({ error: "FPP não encontrada." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const base64 = String(b.base64 || "").replace(/^data:[^,]+,/, "");
  if (!base64) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  const tam = Math.floor(base64.length * 3 / 4);
  if (tam > 20 * 1048576) return Response.json({ error: "Arquivo acima de 20 MB." }, { status: 400 });
  const a = await prisma.fppAnexo.create({ data: { fppId, nome: String(b.nome || "arquivo").slice(0, 200), mime: b.mime || null, tamanho: tam, base64, criadoPorNome: b.quem || null, aplicacaoUid: b.aplicacao ? String(b.aplicacao).slice(0, 40) : null } });
  return Response.json({ ok: true, id: a.id });
}

export async function DELETE(req, { params }) {
  const id = Number(new URL(req.url).searchParams.get("anexo")) || 0;
  await prisma.fppAnexo.deleteMany({ where: { id, fppId: Number(params.id) || 0 } });
  return Response.json({ ok: true });
}
