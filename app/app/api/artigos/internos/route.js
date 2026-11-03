// v625 — artigos internos (tipos de malha e tecido plano)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { tiposInternos, CATS_TIPO } from "@/lib/artigosInternos";

export async function GET() { return Response.json(await tiposInternos(prisma)); }
// POST { categoria, nome } cria · { id, nome } renomeia
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const nome = String(b.nome || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!nome) return Response.json({ error: "Informe o nome." }, { status: 400 });
  try {
    if (b.id) return Response.json(await prisma.artigoTipoInterno.update({ where: { id: Number(b.id) }, data: { nome } }));
    if (!CATS_TIPO.includes(b.categoria)) return Response.json({ error: "Categoria inválida." }, { status: 400 });
    const ja = await prisma.artigoTipoInterno.findUnique({ where: { categoria_nome: { categoria: b.categoria, nome } } });
    if (ja) return Response.json(ja.ativo ? ja : await prisma.artigoTipoInterno.update({ where: { id: ja.id }, data: { ativo: true } }));
    return Response.json(await prisma.artigoTipoInterno.create({ data: { categoria: b.categoria, nome } }));
  } catch (e) { return Response.json({ error: String(e.code) === "P2002" ? "Já existe com esse nome." : e.message }, { status: 400 }); }
}
// DELETE { id } — inativa
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  await prisma.artigoTipoInterno.update({ where: { id: Number(b.id) || 0 }, data: { ativo: false } }).catch(() => null);
  return Response.json({ ok: true });
}
