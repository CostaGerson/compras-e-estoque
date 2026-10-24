// v417 — compras avulsas (operação ou complemento de um pedido): itens com nome, quantidade, fornecedor e "bom para"
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
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
    pedidoRef: b.destino === "PEDIDO" ? String(b.pedidoRef || "").trim() || null : null, obs: String(b.obs || "").trim() || null, itens,
  };
}

export async function GET() {
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
  const c = await prisma.compraAvulsa.update({ where: { id }, data });
  await sincronizarAvulsa(c);
  return Response.json(c);
}
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const c = await prisma.compraAvulsa.update({ where: { id: Number(b.id) }, data: { status: "CANCELADA" } });
  await sincronizarAvulsa(c);
  return Response.json({ ok: true });
}
