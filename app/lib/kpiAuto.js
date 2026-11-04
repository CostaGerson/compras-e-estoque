// v618 — KPIs da Gestão calculados pelo sistema (a partir de KPI_AUTO_DESDE; antes disso valem os números lançados/importados):
//   vendas (R$ e peças)      → pedidos lançados no mês (emissão), sem os internos e cancelados; serviço entra no R$, não nas peças
//   faturamento (R$ e peças) → NFs de saída de venda emitidas no mês (sem remessa, devolução, retorno e canceladas)
//   peças produzidas         → = peças faturadas (um indicador só, como já era) · ticket médio = faturamento ÷ peças
//   receitas                 → continuam da DRE do período (total e por canal), em lib/kpi.js
import { prisma } from "@/lib/prisma";
import { lerNfItens } from "@/lib/pedidos";

export const KPI_AUTO_DESDE = process.env.KPI_AUTO_DESDE || "2026-11";
const NAO_VENDA = /REMESSA|DEVOLU|RETORNO|CANCEL|BONIFIC|AMOSTRA|CONSERTO|INDUSTRIALIZ/;
const CLIENTE_REMESSA = /JS T[EÊ]XTIL|FONTESLOG/;   // remessas, não vendas (mesma regra do histórico de 2026)
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const compDe = (d) => new Date(d).toISOString().slice(0, 7);
const hojeComp = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
export const ehMesAuto = (ano, mes) => { const c = `${ano}-${String(mes).padStart(2, "0")}`; return c >= KPI_AUTO_DESDE && c <= hojeComp(); };

const pecasDoPedido = (p) => {
  if (p.tipoPedido === "SERVIÇO") return 0;
  if (p.qtd != null && Number(p.qtd) > 0) return Number(p.qtd);
  return (Array.isArray(p.itens) ? p.itens : []).reduce((s, i) => s + (Number(i.qtd) || (i.grade || []).reduce((a, g) => a + (Number(g.qtd) || 0), 0)), 0);
};
const pedidoConta = (p) => !p.interno && p.status !== "CANCELADO" && !CLIENTE_REMESSA.test(sem(p.cliente));
const nfDeVenda = (n) => !NAO_VENDA.test(sem(n.natureza)) && !NAO_VENDA.test(sem(n.motivo));

// pedidos do ano emitidos a partir do início da automação
async function pedidosDoAno(ano) {
  const ini = `${ano}-01` > KPI_AUTO_DESDE ? `${ano}-01` : KPI_AUTO_DESDE;
  const de = new Date(`${ini}-01T00:00:00Z`);
  const ate = new Date(`${ano + 1}-01-01T00:00:00Z`);
  if (de >= ate) return [];
  return (await prisma.pedidoVenda.findMany({ where: { emissao: { gte: de, lt: ate } },
    select: { numero: true, cliente: true, emissao: true, total: true, qtd: true, itens: true, interno: true, status: true, tipoPedido: true } })).filter(pedidoConta);
}
async function nfsDoAno(ano) {
  const de = new Date(`${ano}-01-01T00:00:00Z`), ate = new Date(`${ano + 1}-01-01T00:00:00Z`);
  return (await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", emissao: { gte: de, lt: ate } },
    select: { emissao: true, valor: true, natureza: true, motivo: true, temXml: true, xml: true, chaveRegistro: true } })).filter(nfDeVenda);
}

// { [mes]: { vendasValor, vendasPecas, faturamentoValor, pecasFaturadas } } — só os meses automáticos
export async function kpiAutomatico(ano) {
  const out = {};
  const meses = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => ehMesAuto(ano, m));
  if (!meses.length) return out;
  for (const m of meses) out[m] = { vendasValor: 0, vendasPecas: 0, faturamentoValor: 0, pecasFaturadas: 0 };
  const [peds, nfs] = await Promise.all([pedidosDoAno(ano), nfsDoAno(ano)]);
  for (const p of peds) {
    const m = Number(compDe(p.emissao).slice(5, 7)); if (!out[m]) continue;
    out[m].vendasValor = r2(out[m].vendasValor + Number(p.total || 0));
    out[m].vendasPecas += pecasDoPedido(p);
  }
  for (const n of nfs) {
    const m = Number(compDe(n.emissao).slice(5, 7)); if (!out[m]) continue;
    out[m].faturamentoValor = r2(out[m].faturamentoValor + Number(n.valor || 0));
    if (n.temXml && n.xml) out[m].pecasFaturadas += Math.round(lerNfItens(n.xml).itens.reduce((a, i) => a + (Number(i.qtd) || 0), 0));
  }
  return out;
}

// junta os automáticos nos meses do KpiMes (metas e observações continuam as lançadas)
export function aplicarAutomatico(ano, meses, auto) {
  const porMes = Object.fromEntries(meses.map((x) => [x.mes, x]));
  for (const [m, a] of Object.entries(auto)) {
    const x = porMes[m] || { ano, mes: Number(m) };
    porMes[m] = { ...x, vendasValor: a.vendasValor, vendasPecas: a.vendasPecas, faturamentoValor: a.faturamentoValor || null, pecasFaturadas: a.pecasFaturadas || null, automatico: true };
  }
  return Object.values(porMes).sort((a, b) => a.mes - b.mes);
}

// ranking de vendas por cliente nos meses automáticos
export async function rankingVendasPedidos(ano, mes, kpi) {
  const de = new Date(Date.UTC(ano, mes - 1, 1)), ate = new Date(Date.UTC(ano, mes, 1));
  const ps = (await prisma.pedidoVenda.findMany({ where: { emissao: { gte: de, lt: ate } },
    select: { cliente: true, cnpj: true, total: true, qtd: true, itens: true, interno: true, status: true, tipoPedido: true } })).filter(pedidoConta);
  return ps.map((p) => ({ cliente: p.cliente, cnpj: p.cnpj || null, v: kpi === "vendasValor" ? Number(p.total || 0) : pecasDoPedido(p) }));
}

// v674 — ranking de faturamento por cliente nos meses automáticos (Movimento fiscal, NFs de saída de venda)
export async function rankingFaturamentoNfs(ano, mes) {
  const de = new Date(Date.UTC(ano, mes - 1, 1)), ate = new Date(Date.UTC(ano, mes, 1));
  const nfs = (await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", emissao: { gte: de, lt: ate } }, select: { parceiro: true, documento: true, valor: true, natureza: true, motivo: true } })).filter(nfDeVenda);
  return nfs.map((n) => ({ cliente: n.parceiro, cnpj: n.documento || null, v: Number(n.valor || 0) }));
}
