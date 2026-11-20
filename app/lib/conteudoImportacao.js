// v1034 — Conteúdo de importação do pedido (RET 45.000047072-14, art. 15 · Resolução do Senado nº 13/2012).
// Até 40% → crédito presumido com recolhimento efetivo de 2%; acima → 5% interna / 2,5% interestadual.
//
// Conta: Σ (material importado consumido pelo pedido) ÷ valor de venda do pedido.
// · consumo: a demanda de cada item do pedido em Compras (FPP × quantidade) — CompraItem.demanda
// · de onde veio o material: PIC do pedido → OC → item da NF de compra ligado (OcItem.nfItem = "fiscalNotaId|idx");
//   material que saiu do estoque (sem OC do pedido) → última NF de compra do mesmo artigo
// · origem: campo orig do ICMS no XML da NF de compra
//     0/4 nacional → 0% · 5 nacional com conteúdo ≤ 40% → conta 40% · 3 nacional com conteúdo 40–70% → conta 70%
//     1/2/6/7 estrangeira e 8 nacional com conteúdo > 70% → 100%
//   (3, 5 e 8 pelo limite de cima da faixa: a FCI do fornecedor dá o número exato; aqui o cálculo erra para o lado seguro)
// · preço: valor unitário da OC (na unidade do artigo) → valor da demanda → valor unitário da NF
import { prisma } from "@/lib/prisma";
import { parseXmlNfe } from "@/lib/nf";

export const LIMITE_CI = 40;
const PESO_ORIG = { 0: 0, 4: 0, 5: 0.4, 3: 0.7, 8: 1, 1: 1, 2: 1, 6: 1, 7: 1 };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
export const pesoOrigem = (o) => (o == null || o === "" ? null : PESO_ORIG[String(o)] ?? null);
export const ORIGEM_TXT = { 0: "nacional", 1: "estrangeira (importação direta)", 2: "estrangeira (comprada no Brasil)", 3: "nacional, conteúdo importado 40–70%",
  4: "nacional (PPB)", 5: "nacional, conteúdo importado ≤ 40%", 6: "estrangeira sem similar (CAMEX)", 7: "estrangeira sem similar (CAMEX), comprada no Brasil", 8: "nacional, conteúdo importado > 70%" };

// ---------- itens das NFs de compra (cache por chamada) ----------
function leitor() {
  const cache = new Map();
  return async (fiscalNotaId) => {
    const id = Number(fiscalNotaId);
    if (!cache.has(id)) {
      const n = await prisma.fiscalNota.findUnique({ where: { id }, select: { id: true, numero: true, emissao: true, parceiro: true, xml: true } });
      let itens = [];
      if (n?.xml) { try { itens = parseXmlNfe(n.xml).itens; } catch { itens = []; } }
      cache.set(id, n ? { id: n.id, numero: n.numero, emissao: n.emissao, parceiro: n.parceiro, itens } : null);
    }
    return cache.get(id);
  };
}

// última compra do artigo com XML (material que saiu do estoque)
async function ultimaCompraDoArtigo(artigoId, ler) {
  const oi = await prisma.ocItem.findFirst({ where: { artigoId, nfItem: { not: null } }, orderBy: { id: "desc" }, select: { nfItem: true, valorUnitario: true } });
  if (oi?.nfItem) {
    const [nfId, idx] = oi.nfItem.split("|").map(Number);
    const nf = await ler(nfId);
    const it = nf?.itens?.[idx];
    if (it) return { nf, it, valorUnitario: Number(oi.valorUnitario) || null };
  }
  // NF lançada no estoque (Compras) → mesma chave no movimento fiscal
  const ni = await prisma.nfItem.findFirst({ where: { artigoId }, orderBy: { id: "desc" }, select: { descricaoNf: true, valorUnitario: true, nf: { select: { chave: true } } } });
  if (ni?.nf?.chave) {
    const fn = await prisma.fiscalNota.findFirst({ where: { chave: ni.nf.chave, xml: { not: null } }, select: { id: true } });
    const nf = fn && await ler(fn.id);
    if (nf?.itens?.length) {
      const alvo = norm(ni.descricaoNf);
      const it = nf.itens.find((x) => norm(x.xProd) === alvo) || (nf.itens.length === 1 ? nf.itens[0] : null);
      if (it) return { nf, it, valorUnitario: Number(ni.valorUnitario) || null };
    }
  }
  return null;
}

// ---------- cálculo do pedido ----------
export async function conteudoImportacaoPedido(pedidoNumero) {
  const numero = String(pedidoNumero || "").trim();
  const itens = await prisma.compraItem.findMany({ where: { pedidoNumero: numero }, orderBy: { id: "asc" } });
  const ped = await prisma.pedidoVenda.findUnique({ where: { numero }, select: { total: true } }).catch(() => null);
  const venda = r2(ped?.total) || r2(itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valorUnitario || 0), 0));   // valor do pedido (PV); sem PV, soma dos itens
  const ler = leitor();

  // material comprado para o pedido: PIC (info.pedidos) → OC → item da NF
  const pics = await prisma.picItem.findMany({
    where: { artigoId: { in: [...new Set(itens.flatMap((i) => (Array.isArray(i.demanda) ? i.demanda : []).map((d) => Number(d.equiparadoA || d.artigoId)).filter(Boolean)))] } },
    select: { id: true, artigoId: true, info: true, ocItens: { select: { nfItem: true, valorUnitario: true, oc: { select: { numero: true, status: true } } } } },
  });
  const doPedido = (pi) => (Array.isArray(pi.info?.pedidos) ? pi.info.pedidos : []).some((x) => String(x.pedido) === numero);

  const linhas = [];
  for (const ci of itens) {
    for (const d of Array.isArray(ci.demanda) ? ci.demanda : []) {
      const artigoId = Number(d.equiparadoA || d.artigoId) || null;
      const qtd = Number(d.quantidade) || 0;
      if (!artigoId || qtd <= 0) continue;
      let fonte = null;
      for (const pi of pics.filter((p) => p.artigoId === artigoId && doPedido(p))) {
        for (const oi of pi.ocItens) {
          if (!oi.nfItem || oi.oc?.status === "CANCELADA") continue;
          const [nfId, idx] = oi.nfItem.split("|").map(Number);
          const nf = await ler(nfId);
          const it = nf?.itens?.[idx];
          if (it) { fonte = { nf, it, valorUnitario: Number(oi.valorUnitario) || null, via: `OC ${oi.oc.numero}` }; break; }
        }
        if (fonte) break;
      }
      if (!fonte) { const u = await ultimaCompraDoArtigo(artigoId, ler); if (u) fonte = { ...u, via: "ESTOQUE (última compra)" }; }
      const preco = fonte?.valorUnitario || Number(d.valorUnitario) || fonte?.it?.vUn || 0;
      const valor = r2(qtd * preco);
      const peso = pesoOrigem(fonte?.it?.orig);
      linhas.push({
        item: ci.chave, itemDescricao: ci.descricao || null, artigoId, material: [d.nome, d.cor].filter(Boolean).join(" · ") || `artigo ${artigoId}`, papel: d.papel || null,
        quantidade: Math.round(qtd * 1000) / 1000, unidade: d.unidade || null, valorUnitario: preco, valor,
        origem: fonte?.it?.orig ?? null, origemTxt: fonte?.it?.orig != null ? ORIGEM_TXT[fonte.it.orig] || `origem ${fonte.it.orig}` : null,
        importado: peso == null ? null : r2(valor * peso), identificado: peso != null,
        nf: fonte?.nf ? { numero: fonte.nf.numero, emissao: fonte.nf.emissao, fornecedor: fonte.nf.parceiro, item: fonte.it.xProd } : null, via: fonte?.via || null,
      });
    }
  }
  const importado = r2(linhas.reduce((s, l) => s + (l.importado || 0), 0));
  const semOrigem = r2(linhas.filter((l) => !l.identificado).reduce((s, l) => s + l.valor, 0));
  const material = r2(linhas.reduce((s, l) => s + l.valor, 0));
  const pct = venda > 0 ? r1((importado / venda) * 100) : null;
  const pctMax = venda > 0 ? r1(((importado + semOrigem) / venda) * 100) : null;   // se todo material sem origem fosse importado
  const situacao = pct == null || !linhas.length ? "SEM_DADOS" : pct > LIMITE_CI ? "ACIMA" : pctMax > LIMITE_CI ? "INCERTO" : "OK";
  return { pedido: numero, limite: LIMITE_CI, venda, material, importado, semOrigem, pct, pctMax, situacao,
    linhas: linhas.sort((a, b) => (b.importado || 0) - (a.importado || 0) || (a.identificado ? 1 : 0) - (b.identificado ? 1 : 0) || b.valor - a.valor) };
}
