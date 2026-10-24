// v420 — Produção › Gestão: pedidos em andamento lidos do PCP do Maycon (a cada 1 min), fase do processo e em dia/atrasado
import { prisma } from "@/lib/prisma";
import { sincronizar, pcpDoPedido } from "@/lib/cronograma";
import { itensDoPedido } from "@/lib/compras";

export const FASES = ["COMPRAS", "CORTE", "PERSONALIZACAO", "COSTURA", "EXPEDICAO", "CONCLUIDO"];
export const FASE_TXT = { COMPRAS: "Compras", CORTE: "Corte", PERSONALIZACAO: "Personalização", COSTURA: "Costura", EXPEDICAO: "Expedição", CONCLUIDO: "Concluído", FORA: "Fora do PCP" };
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

// fase de um item do PCP pela situação + etapa atual
export function faseDe(situacao, etapa) {
  const s = sem(situacao), e = sem(etapa);
  if (/CONCLU|FINALIZ|ENTREGUE|FATUR/.test(s)) return "CONCLUIDO";
  if (/EXPEDI|EMBAL/.test(e)) return "EXPEDICAO";
  if (/COSTURA|ARREMATE|ACABAMENTO|FACCAO|PASSADORIA/.test(e)) return "COSTURA";
  if (/SILK|DTF|BORDADO|SUBLIMA|PERSONALIZ|ESTAMP|TRANSFER/.test(e)) return "PERSONALIZACAO";
  if (/CORTE/.test(e)) return "CORTE";
  if (/PRODU/.test(s)) return "CORTE";   // v423 — em produção sem etapa informada: já saiu de compras
  return "COMPRAS";   // levantamento, compras, a programar
}

function resumoPedido(p, hoje) {
  const ci = (Array.isArray(p.cronoItens) ? p.cronoItens : []).filter((i) => !i.complemento);
  const cp = Array.isArray(p.cronoCompras) ? p.cronoCompras : [];
  const nz = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  const fases = ci.map((i) => (cp.some((c) => nz(c.produto) === nz(i.produto)) && !/CONCLU/i.test(String(i.situacao || "")) ? "COMPRAS" : faseDe(i.situacao, i.etapa)));   // v421
  const idx = fases.length ? Math.min(...fases.map((f) => FASES.indexOf(f))) : -1;
  const fase = idx >= 0 ? FASES[idx] : "FORA";
  const prazo = iso(p.despacho) || iso(p.cronoPrazo);
  const previsto = iso(p.cronoFimProgramado) || iso(p.entregaPrevista);
  const atrasado = fase !== "CONCLUIDO" && !!prazo && (prazo < hoje || (!!previsto && previsto > prazo));
  const semana = !!prazo && prazo >= hoje && prazo <= somaDias(hoje, 6);
  const itens = itensDoPedido(p);
  return {
    numero: p.numero, cliente: p.cliente, oc: p.oc || null, vendedor: p.vendedor || null, total: r2(p.total),
    aFaturar: p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total),
    pecas: itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0), nItens: itens.length,
    itensTxt: itens.map((i) => `${i.codigo || ""} ${i.descricao || ""}`).join(" | "),
    prazo, previsto, fase, faseIdx: idx >= 0 ? idx : -1, status: atrasado ? "ATRASADO" : "EM DIA", semana,
    situacaoPcp: p.cronoSituacao || null,
  };
}

const CAMPOS_LISTA = { numero: true, cliente: true, oc: true, vendedor: true, total: true, vlEntregar: true, itens: true, despacho: true, cronoPrazo: true,
  cronoFimProgramado: true, entregaPrevista: true, cronoItens: true, cronoSituacao: true, cronoCompras: true, createdAt: true, emissao: true };

export async function gestaoProducao() {
  let sync = null; try { sync = await sincronizar({ intervaloMs: 60 * 1000 }); } catch (e) { sync = { ok: false, erro: e.message }; }
  const hoje = hojeBR();
  const ps = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false }, select: CAMPOS_LISTA, orderBy: [{ despacho: "asc" }, { numero: "asc" }] });
  // pedido antigo que não está no PCP (antes da integração com o KM) fica de fora, como no painel de pedidos
  const desde = process.env.KM_ENTRADA_DESDE || "2026-10-22";
  const lista = ps.filter((p) => !(p.cronoSituacao === "NÃO ESTÁ NO CRONOGRAMA" && (!p.emissao || iso(p.emissao) < desde) && new Date(p.createdAt) < new Date(`${desde}T00:00:00Z`)))
    .map((p) => resumoPedido(p, hoje));
  const total = lista.length;
  const cont = (f) => lista.filter(f).length;
  return {
    hoje, sync: sync ? { ok: sync.ok !== false, erro: sync.erro || null, em: sync.em || null } : null,
    kpis: { andamento: total, emDia: cont((p) => p.status === "EM DIA"), atrasados: cont((p) => p.status === "ATRASADO"), semana: cont((p) => p.semana) },
    pedidos: lista,
  };
}

// detalhe: dados do pedido, itens (com a FPP base de compras), ocorrências (lançamento, compras, etapas do PCP), faturamento e comentários
export async function detalhePedido(numero) {
  const p = await prisma.pedidoVenda.findFirst({ where: { numero: String(numero) } });
  if (!p) return null;
  const hoje = hojeBR();
  const r = resumoPedido(p, hoje);
  const itens = itensDoPedido(p);
  const vinc = await prisma.compraItem.findMany({ where: { pedidoNumero: p.numero } });
  const porChave = Object.fromEntries(vinc.map((v) => [v.chave, v]));
  const ci = Array.isArray(p.cronoItens) ? p.cronoItens : [];
  const itensOut = itens.map((i) => {
    const v = porChave[i.chave];
    const c = ci.find((x) => String(x.itemCode || "") === String(i.chave).split("#")[0]);
    return { chave: i.chave, codigo: i.codigo, descricao: i.descricao, qtd: i.qtd, preco: i.preco, grade: i.grade,
      fppId: v?.fppId || null, fppNumero: v?.fppNumero || null, compra: v?.status || null,
      fase: c ? faseDe(c.situacao, c.etapa) : null, etapa: c?.etapa || null, situacao: c?.situacao || null };
  });
  // ocorrências
  const oc = [];
  oc.push({ tipo: "LANCAMENTO", titulo: "Lançamento do pedido", inicio: p.createdAt, quem: p.criadoPorNome || null, obs: p.fonte ? `origem: ${p.fonte}` : null });
  if (vinc.length) {
    const ini = vinc.map((v) => v.createdAt).sort((a, b) => a - b)[0];
    const fins = vinc.map((v) => v.autorizadoEm || (["OC", "NF", "ENTREGUE"].includes(v.status) ? v.updatedAt : null));
    const fim = fins.every(Boolean) ? fins.sort((a, b) => b - a)[0] : null;
    oc.push({ tipo: "COMPRAS", titulo: "Compras", inicio: ini, fim, quem: vinc.find((v) => v.vinculadoPorNome)?.vinculadoPorNome || null,
      obs: `${vinc.length} item(ns) com FPP base · ${vinc.filter((v) => v.status === "ESTOQUE").length} atendido(s) pelo estoque` });
  }
  let pcp = null, erroPcp = null;
  try { pcp = await pcpDoPedido(p.numero); } catch (e) { erroPcp = e.message; }
  if (pcp) {
    const porFase = {};
    for (const e of pcp.etapas || []) {
      const f = faseDe("", e.etapa);
      const g = (porFase[f] ||= { inicio: null, fim: null, abertas: 0, etapas: new Set(), prestadores: new Set() });
      const fechada = e.concluida || !!e.saida;   // v423 — etapa com saída registrada está encerrada
      const ini = e.entrada || e.inicio; const fim = fechada ? (e.saida || e.planejadoFim) : null;
      if (ini && (!g.inicio || ini < g.inicio)) g.inicio = ini;
      if (fim && (!g.fim || fim > g.fim)) g.fim = fim;
      if (!fechada) { g.abertas++; if (e.planejadoFim && (!g.prev || e.planejadoFim > g.prev)) g.prev = e.planejadoFim; }
      if (e.etapa) g.etapas.add(e.etapa);
      if (e.prestador) g.prestadores.add(e.prestador);
    }
    for (const f of FASES) {
      const g = porFase[f]; if (!g) continue;
      oc.push({ tipo: f, titulo: FASE_TXT[f], inicio: g.inicio, fim: g.abertas ? null : g.fim, previsto: g.abertas ? g.prev || null : null,
        obs: [[...g.etapas].join(", "), g.prestadores.size ? `prestador: ${[...g.prestadores].join(", ")}` : ""].filter(Boolean).join(" · ") || null, emCurso: g.abertas > 0 });
    }
  }
  const nfs = Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length ? p.nfsFaturadas.map((n) => ({ numero: n.numero, emissao: n.emissao ? iso(n.emissao) : null, valor: r2(n.valor), pecas: n.pecas || null }))
    : Array.isArray(p.kmNfs) ? p.kmNfs.map((n) => ({ numero: n.numero, emissao: n.emissao ? String(n.emissao).slice(0, 10) : null, valor: r2(n.valor), pecas: null })) : [];
  const comentarios = await prisma.pedidoComentario.findMany({ where: { pedidoNumero: p.numero }, orderBy: { createdAt: "asc" } });
  const pecasTotal = itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);
  return {
    ...r, emissao: iso(p.emissao), obs: p.obs || "", condicao: p.condicao || null, criadoPorNome: p.criadoPorNome || null,
    itens: itensOut, ocorrencias: oc, erroPcp,
    faturamento: { nfs, faturado: r2(nfs.reduce((s, n) => s + n.valor, 0)), pecasPendentes: p.qtEntregar != null ? p.qtEntregar : pecasTotal,
      valorPendente: p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total) },
    comentarios,
  };
}
