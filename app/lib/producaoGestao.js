// v420 — Produção › Gestão: pedidos em andamento lidos do PCP do Maycon (a cada 1 min), fase do processo e em dia/atrasado
import { prisma } from "@/lib/prisma";
import { sincronizar, pcpDoPedido } from "@/lib/cronograma";
import { itensDoPedido } from "@/lib/compras";

export const FASES = ["COMPRAS", "PROGRAMAR", "CORTE", "PERSONALIZACAO", "COSTURA", "EXPEDICAO", "CONCLUIDO"];   // v621 — A programar
export const FASE_TXT = { COMPRAS: "Compras", PROGRAMAR: "A programar", CORTE: "Corte", PERSONALIZACAO: "Personalização", COSTURA: "Costura", EXPEDICAO: "Expedição", CONCLUIDO: "Concluído", FORA: "Fora do PCP" };
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
  if (/PROGRAMAR/.test(s)) return "PROGRAMAR";   // v633 — recebido pelo PCP em A PROGRAMAR continua em "A programar" (não volta para Compras)
  return "COMPRAS";   // levantamento, compras
}

function resumoPedido(p, hoje) {
  const ci = (Array.isArray(p.cronoItens) ? p.cronoItens : []).filter((i) => !i.complemento);
  const cp = Array.isArray(p.cronoCompras) ? p.cronoCompras : [];
  const nz = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  // v633 — pedido do sistema: aviamento pendente no PCP não devolve o item para Compras (só a matéria-prima principal bloqueia, e essa já foi garantida aqui)
  const fases = ci.map((i) => (p.fonte !== "SISTEMA" && cp.some((c) => nz(c.produto) === nz(i.produto)) && !/CONCLU/i.test(String(i.situacao || "")) ? "COMPRAS" : faseDe(i.situacao, i.etapa)));   // v421
  // v618 — pedido lançado no sistema: até o PCP receber (A PROGRAMAR) a fase vem do nosso sistema = Compras; depois, do PCP do Maycon
  let idx = fases.length ? Math.min(...fases.map((f) => FASES.indexOf(f))) : -1;
  // v621 — serviço e item liberado (aguardando o PCP receber) = A programar
  if (idx < 0 && p.fonte === "SISTEMA") idx = FASES.indexOf(p.tipoPedido === "SERVIÇO" || (p.sitCompras || p.cronoSituacao || "") === "A PROGRAMAR" || /^LIBERADO/.test(p.cronoSituacao || "") ? "PROGRAMAR" : "COMPRAS");
  const fase = idx >= 0 ? FASES[idx] : "FORA";
  const prazo = iso(p.despacho) || iso(p.cronoPrazo);
  const previsto = iso(p.cronoFimProgramado) || iso(p.entregaPrevista);
  const atrasado = fase !== "CONCLUIDO" && !!prazo && (prazo < hoje || (!!previsto && previsto > prazo));
  const semana = !!prazo && prazo >= hoje && prazo <= somaDias(hoje, 6);
  const itens = itensDoPedido(p);
  // v450 — concluído na expedição (PCP) = a faturar; NF subida sem contas = aguardando contas;
  // parcial com saldo e o pedido fora do PCP do Maycon = crítica
  const parcial = Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length > 0;
  const saldoPecas = p.qtEntregar != null ? Number(p.qtEntregar) : null;
  const saldoValor = p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total);
  const faturar = p.faturamentoPendente ? "NF_SEM_CONTAS" : p.cronoConcluido ? "A_FATURAR" : null;
  // v555 — peças concluídas na expedição sem NF casada
  const ciP = ci.filter((i) => Number(i.pecas ?? i.qtd) > 0);
  const concl = ciP.filter((i) => faseDe(i.situacao, i.etapa) === "CONCLUIDO").reduce((a, i) => a + (Number(i.pecas ?? i.qtd) || 0), 0);
  const fatPecas = (Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []).reduce((a, n) => a + (Number(n.pecas) || 0), 0);
  const semNf = !p.faturamentoPendente && concl > fatPecas ? concl - fatPecas : 0;
  const critica = parcial && (saldoPecas == null ? saldoValor > 0 : saldoPecas > 0) && p.cronoSituacao === "NÃO ESTÁ NO CRONOGRAMA"
    ? `Faturamento parcial: o saldo (${saldoPecas != null ? `${saldoPecas} peça(s), ` : ""}${saldoValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) não está no PCP do Maycon`
    : semNf ? `${semNf} peça(s) concluída(s) na expedição sem NF casada` : null;
  return {
    faturar, critica, parcial, pecasConcluidas: concl, pecasFaturadas: fatPecas, pecasSemNf: semNf,
    numero: p.numero, cliente: p.cliente, oc: p.oc || null, vendedor: p.vendedor || null, total: r2(p.total),
    aFaturar: p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total),
    pecas: itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0), nItens: itens.length,
    itensTxt: itens.map((i) => `${i.codigo || ""} ${i.descricao || ""}`).join(" | "),
    // v651 — programado para terminar depois da entrega
    criticaPrazo: fase !== "CONCLUIDO" && prazo && previsto && previsto > prazo ? `Previsão de término (${previsto.split("-").reverse().join("/")}) depois da entrega (${prazo.split("-").reverse().join("/")}) · ${Math.round((new Date(previsto) - new Date(prazo)) / 864e5)} dia(s) de atraso previsto` : null,
    prazo, previsto, fase, faseIdx: idx >= 0 ? idx : -1, status: atrasado ? "ATRASADO" : "EM DIA", semana,
    situacaoPcp: p.cronoSituacao || null,
  };
}

const CAMPOS_LISTA = { numero: true, cliente: true, oc: true, vendedor: true, total: true, vlEntregar: true, itens: true, despacho: true, cronoPrazo: true,
  cronoFimProgramado: true, entregaPrevista: true, cronoItens: true, cronoSituacao: true, cronoCompras: true, createdAt: true, emissao: true,
  cronoConcluido: true, nfsFaturadas: true, qtEntregar: true, faturamentoPendente: true, fonte: true, tipoPedido: true };   // v450 · v618 fonte

export async function gestaoProducao() {
  let sync = null; try { sync = await sincronizar({ intervaloMs: 60 * 1000 }); } catch (e) { sync = { ok: false, erro: e.message }; }
  // v554 — confere o faturamento com o movimento de saída e as NFs do KM (no máximo a cada 3 min)
  // v556 — casamento automático desligado: só remove (uma vez) os que foram feitos sozinhos
  try { await (await import("@/lib/faturamentoCasamento")).removerCasamentosAutomaticos(); } catch (e) { console.log("producao/remover-auto:", e.message); }
  const hoje = hojeBR();
  const ps = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false }, select: CAMPOS_LISTA, orderBy: [{ despacho: "asc" }, { numero: "asc" }] });
  // pedido antigo que não está no PCP (antes da integração com o KM) fica de fora, como no painel de pedidos
  const desde = process.env.KM_ENTRADA_DESDE || "2026-10-22";
  // v627 — situação em compras dos pedidos do sistema lida na hora (atendido pelo estoque → A programar sem esperar o PCP)
  try { const { situacaoComprasSistema } = await import("@/lib/compras"); const sc = await situacaoComprasSistema(ps); for (const p of ps) if (sc[p.numero]) p.sitCompras = sc[p.numero]; } catch (e) { console.log("producao/sitCompras:", e.message); }
  const lista = ps.filter((p) => p.fonte === "SISTEMA" || !(p.cronoSituacao === "NÃO ESTÁ NO CRONOGRAMA" && (!p.emissao || iso(p.emissao) < desde) && new Date(p.createdAt) < new Date(`${desde}T00:00:00Z`)))
    .map((p) => resumoPedido(p, hoje));
  const total = lista.length;
  const cont = (f) => lista.filter(f).length;
  return {
    hoje, sync: sync ? { ok: sync.ok !== false, erro: sync.erro || null, em: sync.em || null } : null,
    kpis: { andamento: total, emDia: cont((p) => p.status === "EM DIA"), atrasados: cont((p) => p.status === "ATRASADO"), semana: cont((p) => p.semana),
      faturar: cont((p) => p.faturar === "A_FATURAR"), criticas: cont((p) => !!p.critica) },   // v450
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
  // v638 — guia OP: parâmetros de produção, tipo de peça e foto de cada item (a foto vem do lançamento) + anexos do lançamento
  const pp = await prisma.pp.findFirst({ where: { numero: p.numero }, orderBy: { id: "desc" },
    select: { id: true, origem: true, arquivoPedidoPdf: true, arquivoOpPdf: true, itens: { select: { id: true, codigo: true, fotoBase64: true, anexosJson: true }, orderBy: { id: "asc" } },
      anexos: { select: { id: true, nome: true, tipo: true, categoria: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } } }).catch(() => null);
  const brutos = Array.isArray(p.itens) ? p.itens : [];
  const ppIts = pp?.itens || [];
  const ppItDe = (idx, cod) => (ppIts.length === brutos.length ? ppIts[idx] : ppIts.find((x) => cod && x.codigo === cod)) || null;
  const fotoDe = (idx, cod) => ppItDe(idx, cod)?.fotoBase64 || null;
  // v650 — arquivos do item: só nome/tipo (o arquivo vem por /api/pp/:id?item=&k=)
  const anexosItemDe = (idx, cod) => { const x = ppItDe(idx, cod); return x && Array.isArray(x.anexosJson) ? x.anexosJson.map((a, k) => ({ itemId: x.id, k, nome: a.nome, mime: a.mime || null })) : []; };
  const itensOut = itens.map((i, idx) => {
    const v = porChave[i.chave];
    const bruto = brutos[idx] || {};
    const c = ci.find((x) => String(x.itemCode || "") === String(i.chave).split("#")[0]);
    return { chave: i.chave, codigo: i.codigo, descricao: i.descricao, qtd: i.qtd, preco: i.preco, grade: i.grade,
      fppId: v?.fppId || null, fppNumero: v?.fppNumero || null, compra: v?.status || null,
      fase: c ? faseDe(c.situacao, c.etapa) : null, etapa: c?.etapa || null, situacao: c?.situacao || null,
      tipoPeca: bruto.tipoPeca || null, parametros: Array.isArray(bruto.parametros) ? bruto.parametros.filter((x) => x && x.t && x.v) : [], foto: fotoDe(idx, i.codigo), anexos: anexosItemDe(idx, i.codigo),
      op: c?.op || null, previsto: c?.fimProgramado || c?.entrega || null };
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
  let fin = null; try { fin = await (await import("@/lib/faturamentoCasamento")).financeiroPedido(p); } catch (e) { console.log("producao/financeiro:", e.message); }   // v555
  const comentarios = await prisma.pedidoComentario.findMany({ where: { pedidoNumero: p.numero }, orderBy: { createdAt: "asc" } });
  const pecasTotal = itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);
  return {
    ...r, emissao: iso(p.emissao), obs: p.obs || "", condicao: p.condicao || null, criadoPorNome: p.criadoPorNome || null,
    itens: itensOut, ocorrencias: oc, erroPcp, fonte: p.fonte || null, tipoPedido: p.tipoPedido || null, nfObs: p.nfObs || null,
    pp: pp ? { id: pp.id, origem: pp.origem || null, temPv: !!pp.arquivoPedidoPdf, temOp: !!pp.arquivoOpPdf } : null,
    anexos: pp?.anexos || [],
    faturamento: { nfs, faturado: r2(nfs.reduce((s, n) => s + n.valor, 0)), pecasPendentes: p.qtEntregar != null ? p.qtEntregar : pecasTotal,
      valorPendente: p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total), pecasTotal, pecasConcluidas: r.pecasConcluidas, pecasFaturadas: r.pecasFaturadas,
      casadas: fin?.nfs || [], fretes: fin?.fretes || [], contasTotal: fin?.contasTotal || 0, recebido: fin?.recebido || 0, emAberto: fin?.emAberto || 0 },
    comentarios,
  };
}
