// v420 — Produção › Gestão: lista + detalhe do pedido, obs e comentários com marcação
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gestaoProducao, detalhePedido } from "@/lib/producaoGestao";

export async function GET(req) {
  const n = new URL(req.url).searchParams.get("numero");
  if (n) {
    const d = await detalhePedido(n);
    return d ? Response.json(d) : Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  return Response.json(await gestaoProducao());
}

// { acao: "obs", numero, obs } · { acao: "comentar", numero, texto, mencoes: [ids], autorId, autorNome }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const numero = String(b.numero || "");
  const p = await prisma.pedidoVenda.findFirst({ where: { numero }, select: { id: true, numero: true, cliente: true } });
  if (!p) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (b.acao === "obs") {
    await prisma.pedidoVenda.update({ where: { id: p.id }, data: { obs: String(b.obs || "").slice(0, 1000) || null, atualizadoPorNome: b.autorNome || null } });
    return Response.json({ ok: true });
  }
  if (b.acao === "comentar") {
    const texto = String(b.texto || "").trim().slice(0, 2000);
    if (!texto) return Response.json({ error: "Comentário vazio." }, { status: 400 });
    const ids = [...new Set((b.mencoes || []).map(Number).filter(Boolean))];
    const us = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids }, ativo: true }, select: { id: true, nome: true, sobrenome: true } }) : [];
    const c = await prisma.pedidoComentario.create({ data: { pedidoNumero: p.numero, autorId: b.autorId ? Number(b.autorId) : null, autorNome: b.autorNome || null, texto,
      mencoes: us.map((u) => ({ id: u.id, nome: [u.nome, u.sobrenome].filter(Boolean).join(" ") })) } });
    // quem foi marcado recebe mensagem
    const de = b.autorId ? Number(b.autorId) : null;
    if (de && us.length) await prisma.mensagem.createMany({ data: us.filter((u) => u.id !== de).map((u) => ({ deId: de, paraId: u.id, texto: `💬 Pedido ${p.numero} · ${p.cliente}: ${texto}`.slice(0, 2000) })) }).catch(() => null);
    return Response.json(c);
  }
  return Response.json({ error: "Ação?" }, { status: 400 });
}
