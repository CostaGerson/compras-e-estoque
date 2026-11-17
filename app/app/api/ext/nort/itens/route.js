// v906 — NORT → ERP: itens conhecidos pelo nome, com a equivalência (Item Padrão), a FPP e o custo, e os saldos por depósito
//   GET ?estoque=1 → só os que têm estoque
export const dynamic = "force-dynamic";
import { autorizadoNort, listarItens } from "@/lib/nortInteg";

export async function GET(req) {
  if (!(await autorizadoNort(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const l = await listarItens({ soEstoque: !!sp.get("estoque") });
  return Response.json({ ok: true, itens: l.map((i) => ({ nome: i.nome, sku: i.sku, indexado: !!i.itemPadrao, itemPadrao: i.itemPadrao?.codigo || i.itemPadrao?.nome || null,
    fpp: i.fppNumero, custoUnit: i.custoUnit, sede: i.sede, loja: i.loja, minimo: i.minimo })) });
}
