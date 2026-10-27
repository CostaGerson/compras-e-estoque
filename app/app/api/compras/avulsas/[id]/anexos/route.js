// v515 — anexos da compra avulsa (imagens, PDFs): lista, abrir/baixar, enviar e excluir
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { hashB64 } from "@/lib/finHash";

const LIMITE = 15 * 1024 * 1024;   // 15 MB por arquivo
const CAMPOS = { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true };

// GET            → lista (sem o conteúdo)
// GET ?anexo=ID  → o arquivo (inline; &baixar=1 baixa)
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  const avulsaId = Number(params.id);
  if (sp.get("anexo")) {
    const a = await prisma.compraAvulsaAnexo.findFirst({ where: { id: Number(sp.get("anexo")), avulsaId } });
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    return new Response(Buffer.from(a.conteudo, "base64"), { headers: {
      "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `${sp.get("baixar") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
      "Cache-Control": "private, max-age=3600",
    } });
  }
  const l = await prisma.compraAvulsaAnexo.findMany({ where: { avulsaId }, orderBy: { createdAt: "asc" }, select: CAMPOS });
  return Response.json(l);
}

// POST { nome, mime, conteudo (base64), quem }
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const avulsaId = Number(params.id);
  if (!(await prisma.compraAvulsa.findUnique({ where: { id: avulsaId }, select: { id: true } }))) return Response.json({ error: "Compra avulsa não encontrada." }, { status: 404 });
  const conteudo = String(b.conteudo || "").replace(/^data:[^,]*,/, "");
  const tamanho = Math.floor(conteudo.length * 3 / 4);
  if (!conteudo || !b.nome) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  if (tamanho > LIMITE) return Response.json({ error: `${b.nome}: arquivo maior que 15 MB.` }, { status: 400 });
  const hash = hashB64(conteudo);
  const igual = await prisma.compraAvulsaAnexo.findFirst({ where: { avulsaId, hash }, select: CAMPOS });
  if (igual) return Response.json({ ...igual, repetido: true });
  const a = await prisma.compraAvulsaAnexo.create({ data: { avulsaId, nome: String(b.nome).slice(0, 200), mime: b.mime || null, tamanho, conteudo, hash, criadoPorNome: b.quem || null }, select: CAMPOS });
  return Response.json(a);
}

// DELETE { anexoId }
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  await prisma.compraAvulsaAnexo.deleteMany({ where: { id: Number(b.anexoId), avulsaId: Number(params.id) } });
  return Response.json({ ok: true });
}
