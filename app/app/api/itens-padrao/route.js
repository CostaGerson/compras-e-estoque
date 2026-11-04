// v647 — itens padrão: lista (com crítica do preço × FPP) e cadastro
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { listarItensPadrao, dadosItemPadrao, quemDe } from "@/lib/itensPadrao";

// GET ?q= (busca para o lançamento do pedido) · ?cliente=id
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  return Response.json(await listarItensPadrao({ q: sp.get("q"), cliente: sp.get("cliente") }));
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const quem = await quemDe(req);
  const d = await dadosItemPadrao(b);
  if (d.error) return Response.json(d, { status: 400 });
  const it = await prisma.itemPadrao.create({ data: { ...d, criadoPorNome: quem, atualizadoPorNome: quem } });
  return Response.json({ ok: true, id: it.id });
}
