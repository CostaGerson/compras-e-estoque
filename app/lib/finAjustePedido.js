// v824 — recebimento diferente do previsto numa parcela de pedido: propõe redistribuir o saldo nas parcelas em aberto
//   para o total do pedido continuar o mesmo (as parcelas do pedido têm chaveImport "PED|<numero>|…").
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export async function ajusteParcelasPedido(t) {
  if (!t || t.tipo !== "RECEBER" || t.status !== "PAGO" || !String(t.chaveImport || "").startsWith("PED|")) return null;
  if (t.valorPago == null || Math.abs(Number(t.valorPago) - Number(t.valor)) < 0.01) return null;
  const numero = String(t.chaveImport).split("|")[1];
  const tits = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", chaveImport: { startsWith: `PED|${numero}|` }, status: { not: "CANCELADO" } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] });
  const abertas = tits.filter((x) => x.status === "ABERTO");
  if (!abertas.length) return null;
  // v831 — total = valor do pedido (não a soma das parcelas, que muda a cada ajuste); sem o pedido, a soma
  const ped = await prisma.pedidoVenda.findUnique({ where: { numero }, select: { total: true } }).catch(() => null);
  const pp = await prisma.pp.findFirst({ where: { numero }, orderBy: { id: "desc" }, select: { valorTotal: true } }).catch(() => null);
  const total = r2(Number(pp?.valorTotal) || Number(ped?.total) || tits.reduce((s, x) => s + Number(x.valor), 0));
  const recebido = r2(tits.filter((x) => x.status !== "ABERTO").reduce((s, x) => s + Number(x.valorPago ?? x.valor), 0));
  const restante = r2(Math.max(0, total - recebido));
  if (Math.abs(abertas.reduce((s, x) => s + Number(x.valor), 0) - restante) < 0.01) return null;   // já fecha o total: nada a ajustar
  const base = Math.floor((restante / abertas.length) * 100) / 100;
  const sug = abertas.map((x, i) => (i === abertas.length - 1 ? r2(restante - base * (abertas.length - 1)) : base));
  return {
    numero, total, recebido, restante, diferenca: r2(Number(t.valorPago) - Number(t.valor)), cliente: t.parceiro,
    pagas: tits.filter((x) => x.status !== "ABERTO").map((x) => ({ id: x.id, titulo: x.titulo, valor: r2(x.valor), recebido: r2(x.valorPago ?? x.valor), data: iso(x.dataPagamento) })),
    abertas: abertas.map((x, i) => ({ id: x.id, titulo: x.titulo, vencimento: iso(x.vencimento), valorAtual: r2(x.valor), valor: sug[i] })),
  };
}

// grava os novos valores das parcelas em aberto; valor 0 cancela a parcela
export async function aplicarAjustePedido(itens, quem) {
  let n = 0;
  for (const it of itens || []) {
    const t = await prisma.finTitulo.findUnique({ where: { id: Number(it.id) } });
    if (!t || t.status !== "ABERTO" || !String(t.chaveImport || "").startsWith("PED|")) continue;
    const v = r2(it.valor);
    if (Math.abs(v - Number(t.valor)) < 0.01) continue;
    const nota = `VALOR AJUSTADO DE R$ ${Number(t.valor).toFixed(2)} PARA R$ ${v.toFixed(2)} (RECEBIMENTO DIFERENTE NUMA PARCELA DO PEDIDO) POR ${quem || "—"}`;
    await prisma.finTitulo.update({ where: { id: t.id }, data: v > 0
      ? { valor: v, valorConfirmado: true, observacao: [t.observacao, nota].filter(Boolean).join(" · ").slice(0, 4000), atualizadoPorNome: quem }
      : { status: "CANCELADO", observacao: [t.observacao, `CANCELADA: SALDO DO PEDIDO JÁ RECEBIDO · ${quem || "—"}`].filter(Boolean).join(" · ").slice(0, 4000), atualizadoPorNome: quem } });
    n++;
  }
  return { ajustadas: n };
}
