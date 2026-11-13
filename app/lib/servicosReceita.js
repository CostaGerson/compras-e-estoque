// v826 — receita de serviço: cada tipo de serviço tem a sua conta-caixa de receita (grupo RECEITA da DRE)
import { prisma } from "@/lib/prisma";

import { SERVICOS, servicoDe } from "@/lib/servicosLista";
export { SERVICOS, servicoDe };

// rateio da conta a receber de um pedido de serviço: por tipo de serviço, proporcional ao valor de cada item
export async function rateioDoPedido(numero) {
  if (!numero) return null;
  const pp = await prisma.pp.findFirst({ where: { numero: String(numero) }, orderBy: { id: "desc" }, select: { tipoPedido: true, itens: { select: { descricao: true, parametrosJson: true, valorTotal: true, valorUnitario: true, quantidade: true } } } }).catch(() => null);
  if (!pp || pp.tipoPedido !== "SERVIÇO" || !pp.itens?.length) return null;
  const porConta = new Map();
  let total = 0;
  for (const it of pp.itens) {
    let tipo = null; try { tipo = JSON.parse(it.parametrosJson || "{}").TIPO_SERVICO || null; } catch {}
    const s = servicoDe(tipo, it.descricao);
    if (!s) continue;
    const v = Number(it.valorTotal) || Number(it.valorUnitario) * Number(it.quantidade) || 0;
    porConta.set(s.conta, (porConta.get(s.conta) || 0) + (v > 0 ? v : 1));
    total += v > 0 ? v : 1;
  }
  if (!porConta.size) return null;
  const contas = await prisma.finConta.findMany({ where: { codigo: { in: [...porConta.keys()] } }, select: { id: true, codigo: true } });
  const id = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
  const l = [...porConta.entries()].filter(([c]) => id[c]).map(([c, v]) => ({ contaId: id[c], pct: Math.round((v / total) * 10000) / 100 }));
  if (!l.length) return null;
  const soma = l.reduce((s, x) => s + x.pct, 0);
  l[l.length - 1].pct = Math.round((l[l.length - 1].pct + 100 - soma) * 100) / 100;
  return l;
}

// contas a receber de pedidos de serviço ainda em aberto que estão na VENDA DE UNIFORMES → conta do serviço (uma vez por processo)
let feito = false;
export async function realocarReceitasServico() {
  if (feito) return; feito = true;
  const peds = await prisma.pp.findMany({ where: { tipoPedido: "SERVIÇO", numero: { not: null } }, select: { numero: true } });
  for (const { numero } of peds) {
    const rateio = await rateioDoPedido(numero);
    if (!rateio) continue;
    await prisma.finTitulo.updateMany({ where: { tipo: "RECEBER", status: "ABERTO", chaveImport: { startsWith: `PED|${numero}|` } }, data: { rateio } });
  }
}
