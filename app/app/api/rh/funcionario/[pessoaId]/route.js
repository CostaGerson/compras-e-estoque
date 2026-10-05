export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioRH, negadoRH, nomeUsuario } from "@/lib/rh";

const LIMITE = 15 * 1024 * 1024;
const ficha = (pessoaId) => prisma.rhFuncionario.upsert({ where: { pessoaId }, create: { pessoaId }, update: {} });

// GET ?u=        → ficha (dados, foto) + lista de documentos
// GET ?u=&doc=ID → o arquivo
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioRH(sp.get("u")))) return negadoRH();
  const f = await ficha(params.pessoaId);
  if (sp.get("doc")) {
    const d = await prisma.rhDocumento.findFirst({ where: { id: Number(sp.get("doc")), funcionarioId: f.id } });
    if (!d) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    return new Response(Buffer.from(d.conteudo, "base64"), { headers: {
      "Content-Type": d.mime || "application/octet-stream",
      "Content-Disposition": `${sp.get("baixar") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(d.nome)}`,
    } });
  }
  const docs = await prisma.rhDocumento.findMany({ where: { funcionarioId: f.id }, orderBy: { createdAt: "desc" },
    select: { id: true, tipo: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true } });
  return Response.json({ ...f, documentos: docs });
}

// PUT { usuarioId, nomeCompleto?, dados?, foto? } → atualiza a ficha
export async function PUT(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  await ficha(params.pessoaId);
  const data = { atualizadoPorNome: nomeUsuario(u) };
  if (b.nomeCompleto !== undefined) data.nomeCompleto = String(b.nomeCompleto || "").toUpperCase() || null;
  if (b.dados !== undefined) data.dados = b.dados || {};
  if (b.foto !== undefined) {
    if (b.foto && b.foto.length > 4 * 1024 * 1024) return Response.json({ error: "Foto muito grande (máx. 3 MB)." }, { status: 400 });
    data.foto = b.foto || null;
  }
  const f = await prisma.rhFuncionario.update({ where: { pessoaId: params.pessoaId }, data });
  return Response.json({ ok: true, ficha: f });
}

// POST { usuarioId, tipo, nome, mime, conteudo } → documento novo
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  const f = await ficha(params.pessoaId);
  const conteudo = String(b.conteudo || "");
  const tamanho = Math.floor(conteudo.length * 3 / 4);
  if (!conteudo || !b.nome) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  if (tamanho > LIMITE) return Response.json({ error: `${b.nome}: arquivo maior que 15 MB.` }, { status: 400 });
  const d = await prisma.rhDocumento.create({
    data: { funcionarioId: f.id, tipo: String(b.tipo || "OUTRO").toUpperCase(), nome: String(b.nome).slice(0, 200), mime: b.mime || null, tamanho, conteudo, criadoPorNome: nomeUsuario(u) },
    select: { id: true, tipo: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true },
  });
  return Response.json(d);
}

// DELETE { usuarioId, docId }
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioRH(b.usuarioId))) return negadoRH();
  const f = await prisma.rhFuncionario.findUnique({ where: { pessoaId: params.pessoaId } });
  if (f) await prisma.rhDocumento.deleteMany({ where: { id: Number(b.docId), funcionarioId: f.id } });
  return Response.json({ ok: true });
}
