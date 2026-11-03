// v619 — entrada no estoque das NFs de compra (parametrização: nome da NF → artigo interno)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { itensParaParametrizar, darEntrada, pendentesEstoque } from "@/lib/nfEstoque";

const usuario = async (id) => { const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, ativo: true } }); return u?.ativo ? u : null; };
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u=&id= → itens da NF com a sugestão · GET ?u= → NFs pendentes
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuario(sp.get("u")))) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  try {
    if (sp.get("id")) return Response.json(await itensParaParametrizar(sp.get("id")));
    return Response.json({ pendentes: await pendentesEstoque() });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
// POST { usuarioId, id, itens: [{ idx, dados }], dispensar } → dá entrada no estoque
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuario(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  try {
    const r = await darEntrada(b.id, { itens: b.itens, dispensar: !!b.dispensar, quem: nomeU(u), quemId: u.id });
    return Response.json(r, { status: r.error ? 400 : 200 });
  } catch (e) { console.log("fiscal/estoque:", e); return Response.json({ error: e.message }, { status: 500 }); }
}
