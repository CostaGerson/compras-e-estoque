// v417 — compras avulsas (operação ou complemento de um pedido): itens com nome, quantidade, fornecedor e "bom para"
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { notificar } from "@/lib/push";   // v472
import { sincronizarAvulsa } from "@/lib/compras";   // v419 — vai para o levantamento

const up = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const n = (v) => { const x = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
const STATUS = ["ABERTA", "COMPRADA", "RECEBIDA", "CANCELADA"];

function limpar(b) {
  const itens = (Array.isArray(b.itens) ? b.itens : []).filter((i) => up(i.nome)).map((i) => ({
    nome: up(i.nome), quantidade: n(i.quantidade), unidade: ["UN", "M", "KG", "PC"].includes(i.unidade) ? i.unidade : "UN",
    fornecedorId: i.fornecedorId ? Number(i.fornecedorId) : null, fornecedorNome: up(i.fornecedorNome) || null,
    bomPara: /^\d{4}-\d{2}-\d{2}$/.test(String(i.bomPara || "")) ? i.bomPara : null, recebido: !!i.recebido,
  }));
  return {
    numero: String(b.numero || "").trim() || null, destino: b.destino === "PEDIDO" ? "PEDIDO" : "OPERACAO",
    pedidoRef: b.destino === "PEDIDO" ? String(b.pedidoRef || "").trim() || null : null,
    pedidoCliente: b.destino === "PEDIDO" ? String(b.pedidoCliente || "").trim() || null : null,   // v471
    obs: String(b.obs || "").trim() || null, itens,
  };
}

// v472 — avulsa recebida: aviso ao Leandro (encarregado do PCP) por mensagem e notificação no celular
async function avisarRecebida(c, porId) {
  const us = (await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true } }))
    .filter((u) => /(^|\s)LEANDRO(\s|$)/.test(`${u.nome || ""} ${u.sobrenome || ""}`.toUpperCase()));
  if (!us.length) return;
  const itens = (Array.isArray(c.itens) ? c.itens : []).map((i) => `${i.nome} (${String(i.quantidade).replace(".", ",")} ${String(i.unidade || "").toLowerCase()})`);
  const nome = `AVULSA ${c.numero || `#${c.id}`}${c.destino === "PEDIDO" && c.pedidoRef ? ` · PEDIDO ${c.pedidoRef}` : ""}`;
  for (const u of us) {
    const de = Number(porId) || u.id;
    await prisma.mensagem.create({ data: { deId: de, paraId: u.id, texto: `COMPRA ${nome} RECEBIDA NA FÁBRICA: ${itens.join("; ")}.`.slice(0, 2000) } }).catch(() => null);
    await notificar(u.id, { titulo: `Compra ${nome} recebida ✅`, texto: itens.slice(0, 3).join("; ") + (itens.length > 3 ? ` e mais ${itens.length - 3}` : ""), tag: `avulsa-${c.id}` }).catch(() => null);
  }
}

export async function GET(req) {
  // v471 — busca de pedidos em andamento (nº ou cliente) para ligar a avulsa ao pedido
  const q = new URL(req.url).searchParams.get("pedidos");
  if (q != null) {
    const t = String(q).trim();
    const l = await prisma.pedidoVenda.findMany({
      where: { status: "ANDAMENTO", ...(t ? { OR: [{ numero: { contains: t, mode: "insensitive" } }, { cliente: { contains: t, mode: "insensitive" } }] } : {}) },
      orderBy: [{ emissao: "desc" }], take: 15, select: { numero: true, cliente: true, qtd: true, total: true, emissao: true },
    });
    return Response.json(l.map((p) => ({ ...p, total: Number(p.total), emissao: p.emissao ? p.emissao.toISOString().slice(0, 10) : null })));
  }
  const l = await prisma.compraAvulsa.findMany({ where: { status: { not: "CANCELADA" } }, orderBy: { createdAt: "desc" } });
  return Response.json(l);
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const d = limpar(b);
  if (!d.itens.length) return Response.json({ error: "Inclua ao menos um item com nome." }, { status: 400 });
  const c = await prisma.compraAvulsa.create({ data: { ...d, criadoPorNome: b.quem || null } });
  await sincronizarAvulsa(c);
  return Response.json(c);
}
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  const data = b.itens ? limpar(b) : {};
  if (STATUS.includes(b.status)) data.status = b.status;
  const ant = await prisma.compraAvulsa.findUnique({ where: { id }, select: { status: true } });
  const c = await prisma.compraAvulsa.update({ where: { id }, data });
  await sincronizarAvulsa(c);
  if (c.status === "RECEBIDA" && ant?.status !== "RECEBIDA") await avisarRecebida(c, b.usuarioId).catch((e) => console.log("avulsa/aviso:", e.message));   // v472
  return Response.json(c);
}
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const c = await prisma.compraAvulsa.update({ where: { id: Number(b.id) }, data: { status: "CANCELADA" } });
  await sincronizarAvulsa(c);
  return Response.json({ ok: true });
}
