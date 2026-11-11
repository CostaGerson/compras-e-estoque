// v780 — #22: acervo de documentos (EMPRESA | ADM | REUNIAO) e dados cadastrais da Meridian
//   GET ?u=&area=ADM            → lista (anexos sem conteúdo)
//   GET ?u=&anexo=ID            → arquivo
//   GET ?u=&empresa=1           → dados da empresa
//   POST { usuarioId, acao: "salvar", doc } · { acao: "excluir", id } · { acao: "anexar", docId, nome, mime, conteudo } · { acao: "tirarAnexo", id } · { acao: "empresa", dados }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gerencial } from "@/lib/acesso";

const AREAS = ["EMPRESA", "ADM", "REUNIAO"];
const nome = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const dt = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? new Date(`${s}T00:00:00Z`) : null);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
async function quem(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, ativo: true, isMaster: true, diretoria: true, setor: true, permissoes: true } }).catch(() => null);
  return u && u.ativo ? u : null;
}
const podeEditar = (u, area) => gerencial(u) || (area !== "REUNIAO" && ["FINANCEIRO", "ADMINISTRATIVO"].includes(u.setor));
const negado = (m = "Sem permissão.") => Response.json({ error: m }, { status: 403 });

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await quem(sp.get("u"));
  if (!u) return negado();
  if (sp.get("anexo")) {
    const a = await prisma.docAcervoAnexo.findUnique({ where: { id: Number(sp.get("anexo")) } });
    if (!a) return new Response("Não encontrado.", { status: 404 });
    return new Response(Buffer.from(a.conteudo, "base64"), { headers: { "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nome)}`, "Cache-Control": "no-store" } });
  }
  if (sp.get("empresa")) {
    const c = await prisma.finConfig.findUnique({ where: { chave: "EMPRESA|DADOS" } }).catch(() => null);
    let d = {}; try { d = JSON.parse(c?.valor || "{}"); } catch {}
    return Response.json({ dados: d, podeEditar: podeEditar(u, "EMPRESA") });
  }
  const area = AREAS.includes(sp.get("area")) ? sp.get("area") : "ADM";
  const l = await prisma.docAcervo.findMany({ where: { area }, orderBy: [{ data: "desc" }, { id: "desc" }], include: { anexos: { select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } } });
  return Response.json({ docs: l.map((d) => ({ ...d, data: iso(d.data), validade: iso(d.validade) })), podeEditar: podeEditar(u, area) });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await quem(b.usuarioId);
  if (!u) return negado();
  if (b.acao === "empresa") {
    if (!podeEditar(u, "EMPRESA")) return negado();
    const dados = Object.fromEntries(Object.entries(b.dados || {}).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    const valor = JSON.stringify({ ...dados, atualizadoPor: nome(u), atualizadoEm: new Date().toISOString() });
    await prisma.finConfig.upsert({ where: { chave: "EMPRESA|DADOS" }, create: { chave: "EMPRESA|DADOS", valor }, update: { valor } });
    return Response.json({ ok: true });
  }
  if (b.acao === "salvar") {
    const x = b.doc || {}; const area = AREAS.includes(x.area) ? x.area : "ADM";
    if (!podeEditar(u, area)) return negado();
    const titulo = String(x.titulo || "").trim().toUpperCase();
    if (!titulo) return Response.json({ error: "Informe o título." }, { status: 400 });
    const data = { area, titulo, categoria: x.categoria ? String(x.categoria).toUpperCase() : null, data: dt(x.data), validade: dt(x.validade),
      participantes: x.participantes ? String(x.participantes).toUpperCase() : null, texto: x.texto || null, atualizadoPorNome: nome(u) };
    const d = x.id ? await prisma.docAcervo.update({ where: { id: Number(x.id) }, data }) : await prisma.docAcervo.create({ data: { ...data, criadoPorNome: nome(u) } });
    return Response.json({ ok: true, id: d.id });
  }
  if (b.acao === "excluir") {
    const d = await prisma.docAcervo.findUnique({ where: { id: Number(b.id) || 0 } });
    if (!d) return Response.json({ ok: true });
    if (!podeEditar(u, d.area)) return negado();
    await prisma.docAcervo.delete({ where: { id: d.id } });
    return Response.json({ ok: true });
  }
  if (b.acao === "anexar") {
    const d = await prisma.docAcervo.findUnique({ where: { id: Number(b.docId) || 0 } });
    if (!d) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    if (!podeEditar(u, d.area)) return negado();
    const tam = Buffer.byteLength(String(b.conteudo || ""), "base64");
    if (!tam) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
    if (tam > 40 * 1048576) return Response.json({ error: "Arquivo acima de 40 MB." }, { status: 400 });
    const a = await prisma.docAcervoAnexo.create({ data: { docId: d.id, nome: String(b.nome || "arquivo").slice(0, 200), mime: b.mime || null, tamanho: tam, conteudo: String(b.conteudo), criadoPorNome: nome(u) } });
    return Response.json({ ok: true, id: a.id });
  }
  if (b.acao === "tirarAnexo") {
    const a = await prisma.docAcervoAnexo.findUnique({ where: { id: Number(b.id) || 0 }, include: { doc: { select: { area: true } } } });
    if (!a) return Response.json({ ok: true });
    if (!podeEditar(u, a.doc.area)) return negado();
    await prisma.docAcervoAnexo.delete({ where: { id: a.id } });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
