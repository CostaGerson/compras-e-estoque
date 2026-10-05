export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";

const LIMITE = 15 * 1024 * 1024;   // 15 MB por arquivo

// GET ?u=           → lista dos anexos (sem o conteúdo)
// GET ?u=&anexo=ID  → o arquivo (abre/baixa no navegador)
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const tituloId = Number(params.id);
  if (sp.get("anexo")) {
    const a = await prisma.finTituloAnexo.findFirst({ where: { id: Number(sp.get("anexo")), tituloId } });
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    const buf = Buffer.from(a.conteudo, "base64");
    return new Response(buf, { headers: {
      "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `${sp.get("baixar") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
    } });
  }
  const l = await prisma.finTituloAnexo.findMany({ where: { tituloId }, orderBy: { createdAt: "asc" },
    select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true } });
  return Response.json({ anexos: l });
}

// POST { usuarioId, nome, mime, conteudo (base64) }
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const tituloId = Number(params.id);
  if (!(await prisma.finTitulo.findUnique({ where: { id: tituloId }, select: { id: true } }))) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  const conteudo = String(b.conteudo || "");
  const tamanho = Math.floor(conteudo.length * 3 / 4);
  if (!conteudo || !b.nome) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  if (tamanho > LIMITE) return Response.json({ error: `${b.nome}: arquivo maior que 15 MB.` }, { status: 400 });
  const a = await prisma.finTituloAnexo.create({ data: { tituloId, nome: String(b.nome).slice(0, 200), mime: b.mime || null, tamanho, conteudo, criadoPorNome: nomeU(u) },
    select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true } });
  return Response.json(a);
}

// DELETE { usuarioId, anexoId }
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  await prisma.finTituloAnexo.deleteMany({ where: { id: Number(b.anexoId), tituloId: Number(params.id) } });
  return Response.json({ ok: true });
}
