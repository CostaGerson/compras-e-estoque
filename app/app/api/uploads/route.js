export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { listarUploads, podeExcluir, enviouEle, excluirUpload, conteudoUpload, mimeDe, ORIGENS, nomeUsuario } from "@/lib/uploads";

async function usuario(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true } });
  return u?.ativo ? u : null;
}
const master = (u) => !!(u.isMaster || u.setor === "FINANCEIRO");

// GET ?u=           → lista (master vê tudo; os demais, o que eles enviaram)
// GET ?u=&id=ARQ-12 → baixa o arquivo
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuario(sp.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const id = sp.get("id");
  const lista = await listarUploads();
  const meus = lista.filter((x) => master(u) || enviouEle(u, x));
  if (id) {
    if (!meus.some((x) => x.id === id)) return new Response("Sem acesso a este documento.", { status: 403 });
    const c = await conteudoUpload(id);
    if (!c) return new Response("Arquivo não encontrado.", { status: 404 });
    const mime = c.mime || mimeDe(c.nome);
    return new Response(c.buf, { headers: { "Content-Type": mime, "Content-Disposition": `${/pdf|image/.test(mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(c.nome)}` } });
  }
  return Response.json({ itens: meus.map((x) => ({ ...x, podeExcluir: podeExcluir(u, x) })), origens: ORIGENS, master: master(u), eu: nomeUsuario(u) });
}

// DELETE { usuarioId, id }
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuario(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const x = (await listarUploads()).find((y) => y.id === b.id);
  if (!x) return Response.json({ error: "Documento não encontrado (já excluído?)." }, { status: 404 });
  if (!podeExcluir(u, x)) return Response.json({ error: "Excluir documento importado: só o master." }, { status: 403 });
  try {
    await excluirUpload(b.id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao excluir." }, { status: 400 });
  }
}
