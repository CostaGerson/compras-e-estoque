// v310 — Painel de previsão (refeito). O painel da competência C é a PREVISÃO DO MÊS SEGUINTE (M = C+1).
// Posição automática (contas a pagar e a receber, ao vivo):
//   - a pagar: atrasadas (vencidas e em aberto), no mês M (inclui previsões), total em aberto SEM previsões;
//   - a receber: REAL = em aberto sem antecipados; VIRTUAL = real + antecipados ainda não liquidados (regra v186);
//     atrasado por modalidade = EM COBRANÇA (aberto vencido) + EM EXECUÇÃO (status EXECUCAO). Perdas não entram.
// Seleções guardadas no painel: prioridade (contas a pagar atrasadas que serão pagas no mês) e quitação provável
// (recebíveis atrasados que devem entrar no mês). Bancos já vêm com os limites. Cenários são calculados.
// Salvar grava os dados e um retrato (snapshot) datado; o painel seguinte compara previsto × realizado.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
export const mesSeguinte = (c) => { const d = new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)), 1)); return d.toISOString().slice(0, 7); };
const mesAnterior = (c) => { const d = new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 2, 1)); return d.toISOString().slice(0, 7); };
const fimDoMes = (m) => iso(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)));

// bancos padrão (limites de cheque especial) — o saldo é preenchido no painel
export const ALIQ_IMPOSTOS_ANDAMENTO = 0.091;   // v371 — impostos sobre os pedidos em andamento no cenário LB
export const BANCOS_PADRAO = [
  ["BRADESCO", 50000], ["ITAU", 22819], ["ITAU CX AVAL", 7000], ["CAIXA", 10000], ["C6", 15000], ["INTER", 0], ["BB", 1000],
].map(([nome, limite], i) => ({ id: i + 1, nome, saldo: 0, limite, tomado: null }));

const PAINEL_VAZIO = {
  bancos: [], prioridade: [], quitacaoProvavel: [],
  receberPrevisao: null,
  pedidosEntregar: null, recebimentoMes: null, pedidosAndamento: null, antecipacaoDisp: null, cmvAndamento: null, passivoTributario: null, entregasMes: null, recebimentosMes: null, andamento: null,
  infoRelevante: "", salvos: [], atualizadoAuto: null,
  lbVendaPatrimonio: null, lbPassivoTrabalhista: null, lbMesOperacao: null,   // v364 — cenário LB
};
// Campos digitados (a tela e o salvar usam esta lista)
export const CAMPOS_MANUAIS = ["cmvAndamento", "passivoTributario", "receberPrevisao", "pedidosEntregar", "recebimentoMes", "pedidosAndamento", "antecipacaoDisp", "infoRelevante", "lbVendaPatrimonio", "lbPassivoTrabalhista", "lbMesOperacao"];

const SEL = { id: true, tipo: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, previsao: true,
  antecipadoForma: true, cobranca: true, liquidadoEm: true, recompraId: true, dataPagamento: true, valorPago: true, numeroDoc: true, recorrenciaId: true };
const tOut = (t, mod) => ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: r2(t.valor), vencimento: iso(t.vencimento), numeroDoc: t.numeroDoc || null, previsao: !!t.previsao, modalidade: mod || null, pagoParcial: t.pagoParcial || null });
const soma = (l) => r2(l.reduce((s, t) => s + Number(t.valor), 0));
const antecipado = (t) => !!t.antecipadoForma || t.cobranca === "DESCONTADO";

function calcBancos(lista) {
  const bancos = (lista && lista.length ? lista : BANCOS_PADRAO).map((b, i) => {
    const saldo = r2(b.saldo), limite = r2(b.limite);
    const tomado = r2(Math.max(0, -saldo));   // v355 — cheque em uso = saldo negativo
    return { id: b.id ?? i + 1, nome: String(b.nome || "").toUpperCase(), saldo, limite, tomado, disponivel: r2(Math.max(0, saldo) + Math.max(0, limite - tomado)) };
  });
  const s = (k) => r2(bancos.reduce((a, b) => a + b[k], 0));
  return { bancos, caixa: { saldoGeral: s("saldo"), saldoPositivo: r2(bancos.reduce((a, b) => a + Math.max(0, b.saldo), 0)), limiteTotal: s("limite"), limiteTomado: s("tomado"), disponivelTotal: s("disponivel") } };
}

// números ao vivo das contas (para o mês M)
async function posicao(M, hoje) {
  const ini = `${M}-01`, fim = fimDoMes(M);
  const [pagar0, receberAb, receberAnt, receberExec] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo: "PAGAR", status: "ABERTO" }, select: { ...SEL, chaveImport: true }, orderBy: { vencimento: "asc" } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "ABERTO" }, select: SEL, orderBy: { vencimento: "asc" } }),
    // v338 — virtual igual ao contas a receber: todo antecipado que o cliente ainda não pagou (com ou sem recompra)
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "PAGO", liquidadoEm: null, OR: [{ antecipadoForma: { not: null } }, { cobranca: "DESCONTADO" }] }, select: SEL, orderBy: { vencimento: "asc" } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "EXECUCAO" }, select: SEL, orderBy: { vencimento: "asc" } }),
  ]);
  // v338 — conta da semana com baixas parciais: vale só o SALDO (valor − itens já pagos), como no contas a pagar
  const semIds = pagar0.filter((t) => String(t.chaveImport || "").startsWith("SEMANA|")).map((t) => t.id);
  const itensPagos = semIds.length ? await prisma.finSemanaItem.findMany({ where: { tituloId: { in: semIds }, pago: true }, select: { tituloId: true, valor: true } }).catch(() => []) : [];
  const pagoDe = {}; for (const i of itensPagos) pagoDe[i.tituloId] = (pagoDe[i.tituloId] || 0) + Number(i.valor || 0);
  const pagar = pagar0.map((t) => (pagoDe[t.id] > 0 ? { ...t, valor: r2(Number(t.valor) - pagoDe[t.id]), pagoParcial: r2(pagoDe[t.id]) } : t)).filter((t) => Number(t.valor) > 0.009);
  const venc = (t) => iso(t.vencimento);
  const noMes = (t) => venc(t) >= ini && venc(t) <= fim;
  const depois = (t) => venc(t) > fim;
  const vencido = (t) => venc(t) < hoje;

  const real = receberAb.filter((t) => !antecipado(t));
  const antAbertos = receberAb.filter(antecipado);                // antecipado ainda marcado como aberto (raro): só no virtual
  const virtuais = [...antAbertos, ...receberAnt];                 // antecipados não liquidados
  const cobranca = real.filter(vencido);
  const bloco = (filtro) => {
    const rl = real.filter(filtro), vt = virtuais.filter(filtro), cb = cobranca.filter(filtro), ex = receberExec.filter(filtro);
    return { real: soma(rl), virtual: r2(soma(rl) + soma(vt)), antecipados: soma(vt), cobranca: soma(cb), execucao: soma(ex),
      qtd: rl.length, qtdAntecipados: vt.length, qtdCobranca: cb.length, qtdExecucao: ex.length };
  };
  // v341 — referência para a antecipação: a receber em aberto, a vencer, não antecipado e que não é previsão
  const antecipaveis = real.filter((t) => !vencido(t) && !t.previsao);
  // v346/v348 — contas a pagar REAL × VIRTUAL (um mês a mais de operação: M+1)
  //   real: em aberto depois do mês M, sem previsões; parcelas de contrato de dívida só até M+1 (as seguintes estão na quitação)
  //   virtual: real + previsões de M+1 (inclui a parcela dos contratos em M+1)
  //            + quitação do saldo devedor das dívidas não tributárias DESCONTADAS as parcelas que já estão no contas a pagar até M+1
  //            + CMV dos pedidos em andamento + passivo trabalhista (digitados; campo passivoTributario)
  const recsDivida = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { startsWith: "MATRIZ|dividas|CONTRATO:" } }, select: { id: true, chaveOrigem: true } }).catch(() => []);
  const { contratoDaChave, cronograma: cronDe, posicaoApos } = await import("@/lib/alavancagemAmort");
  const contratoDaRec = Object.fromEntries(recsDivida.map((r) => [r.id, contratoDaChave(r.chaveOrigem)]));
  const ehDivida = (t) => t.recorrenciaId && contratoDaRec[t.recorrenciaId] != null;
  const M1 = mesSeguinte(M), ini1 = `${M1}-01`, fim1 = fimDoMes(M1);
  const ateM1 = (t) => venc(t) <= fim1;
  // v371 — real: a vencer (de hoje em diante) a partir do mês, sem previsões; o que já venceu está em "contas atrasadas" (não duplica)
  const pagarReal = pagar.filter((t) => !vencido(t) && (noMes(t) || depois(t)) && !t.previsao && (!ehDivida(t) || ateM1(t)));
  // v371 — previsões a vencer até o fim de M+1 (resto do mês + um mês de operação); vencidas estão nas atrasadas
  const prevProx = pagar.filter((t) => t.previsao && !vencido(t) && venc(t) <= fim1);
  // parcelas de cada contrato que já contam em algum card (atrasadas, mês, real, previsões de M+1)
  const abertasAte = {};
  for (const t of pagar) if (ehDivida(t) && ateM1(t)) { const c = contratoDaRec[t.recorrenciaId]; abertasAte[c] = (abertasAte[c] || 0) + 1; }
  let quitacao = { total: 0, contratos: [], erro: null };
  try {
    const { panorama } = await import("@/lib/alavancagem");
    const pn = await panorama(new Date(`${fim}T12:00:00Z`));
    const cs = pn.grupos.flatMap((g) => g.itens.map((x) => {
      if (x.quitado) return null;
      const k = abertasAte[x.id] || 0;
      let saldo = Number(x.amort?.saldoDevedor ?? x.saldoCapital ?? 0);
      if (k && x.amort && !x.amort.bullet) { try { saldo = posicaoApos(cronDe(x.bruto), (x.amort.parcelasPagas || 0) + k).saldoDevedor; } catch {} }
      return { grupo: g.label, nome: x.nome, credor: x.credor, saldo: r2(saldo), parcelasDescontadas: k };
    })).filter((x) => x && x.saldo > 0.009);
    quitacao = { total: r2(cs.reduce((a, x) => a + x.saldo, 0)), contratos: cs, erro: null };
  } catch (e) { quitacao.erro = e.message; }
  // v364 — cenário LB: quitar hoje tudo o que está na alavancagem; as parcelas dessas dívidas já lançadas (não previsão) saem do cenário geral, então não contam de novo
  let dividasLB = { quitacaoHoje: 0, lancadas: 0, liquido: 0, contratos: [], erro: null };
  try {
    const { panorama } = await import("@/lib/alavancagem");
    const pnH = await panorama(new Date());
    const cs = pnH.grupos.flatMap((g) => g.itens.filter((x) => !x.quitado).map((x) => ({ grupo: g.label, nome: x.nome, credor: x.credor, saldo: r2(Number(x.amort?.saldoDevedor ?? x.saldoCapital ?? 0)) }))).filter((x) => x.saldo > 0.009);
    const quitacaoHoje = r2(cs.reduce((a, x) => a + x.saldo, 0));
    const lancadas = soma(pagar.filter((t) => ehDivida(t) && !t.previsao));
    dividasLB = { quitacaoHoje, lancadas, liquido: r2(Math.max(0, quitacaoHoje - lancadas)), contratos: cs, erro: null };
  } catch (e) { dividasLB.erro = e.message; }
  // v370 — base para digitar o CMV em andamento: peças em aberto (PCP) × ritmo de produção do ano (expedição)
  let producao = { pecasAberto: null, pecasAno: 0, mesesAno: 0, mediaMes: 0, mesesOperacao: null, cronoEm: null };
  try {
    const sync = await prisma.finConfig.findUnique({ where: { chave: "CRONO|SYNC" } }).catch(() => null);
    let sj = {}; try { sj = JSON.parse(sync?.valor || "{}"); } catch {}
    const { pecasExpedicao } = await import("@/lib/opAnalise");
    const pe = await pecasExpedicao(Number(M.slice(0, 4)));
    const meses = Object.entries(pe).filter(([c, v]) => c <= M && v > 0);
    const pecasAno = meses.reduce((a, [, v]) => a + v, 0);
    const mediaMes = meses.length ? Math.round(pecasAno / meses.length) : 0;
    const pecasAberto = sj.pecasEmProducao ?? null;
    producao = { pecasAberto, pecasAno, mesesAno: meses.length, mediaMes, mesesOperacao: pecasAberto != null && mediaMes ? Math.round((pecasAberto / mediaMes) * 10) / 10 : null, cronoEm: sj.em || null };
  } catch (e) { producao.erro = e.message; }
  const pagarVirtual = { mesSeguinte: M1, producao, real: soma(pagarReal), qtdReal: pagarReal.length, previsoesProx: soma(prevProx), qtdPrevisoesProx: prevProx.length,
    quitacao, parcelasDividaFora: soma(pagar.filter((t) => depois(t) && ehDivida(t) && !ateM1(t))) };
  const pagarSemPrev = pagar.filter((t) => !t.previsao);
  const pagarAtras = pagar.filter(vencido);   // v311 — atrasadas incluem previsões
  const pagarMes = pagar.filter(noMes);
  return {
    antecipaveis: { valor: soma(antecipaveis), qtd: antecipaveis.length },
    receber: {
      geral: bloco(() => true),
      mes: bloco(noMes),
      foraMes: bloco(depois),
      atrasado: { total: r2(soma(cobranca) + soma(receberExec)), cobranca: soma(cobranca), execucao: soma(receberExec), qtdCobranca: cobranca.length, qtdExecucao: receberExec.length },
    },
    pagar: {
      atrasadas: soma(pagarAtras), qtdAtrasadas: pagarAtras.length,
      mes: soma(pagarMes), mesPrevisoes: soma(pagarMes.filter((t) => t.previsao)), qtdMes: pagarMes.length,
      totalSemPrevisao: soma(pagarSemPrev),
      virtual: pagarVirtual,
      dividasLB,
    },
    listas: {
      pagarAtrasadas: pagarAtras.map((t) => tOut(t)),
      receberAtrasados: [...cobranca.map((t) => tOut(t, "COBRANCA")), ...receberExec.map((t) => tOut(t, "EXECUCAO"))],
      receberMesIds: real.filter(noMes).map((t) => t.id),
      pagarMesIds: pagarMes.map((t) => t.id),
    },
  };
}

export async function painel(competencia, hojeData = new Date()) {
  const hoje = typeof hojeData === "string" ? hojeData : hojeSP();
  const M = mesSeguinte(competencia);
  // v373 — pedido faturado (total ou parcial) depois da última atualização: refaz os números de pedidos em andamento,
  // para o valor não ficar ao mesmo tempo em "em andamento" e no contas a receber (onde a NF já entrou)
  try {
    const p0 = await prisma.finMesPainel.findUnique({ where: { competencia }, select: { dados: true } });
    const em = p0?.dados?.atualizadoAuto?.em;
    if (em) {
      const mud = await prisma.pedidoVenda.findMany({ where: { updatedAt: { gt: new Date(em) } }, select: { status: true, nfsFaturadas: true } });
      if (mud.some((x) => x.status === "FATURADO" || (Array.isArray(x.nfsFaturadas) && x.nfsFaturadas.length))) await atualizarPainel(competencia, "SISTEMA (PEDIDO FATURADO)");
    }
  } catch (e) { console.log("painel/pedidos faturados:", e.message); }
  const [p, pos, ant] = await Promise.all([
    prisma.finMesPainel.findUnique({ where: { competencia } }),
    posicao(M, hoje),
    prisma.finMesPainel.findUnique({ where: { competencia: mesAnterior(competencia) }, select: { dados: true } }),
  ]);
  const dados = { ...PAINEL_VAZIO, ...((p?.dados) || {}) };
  const { bancos, caixa } = calcBancos(dados.bancos);

  // seleções: só o que ainda está em aberto conta no valor
  const porIdPagar = Object.fromEntries(pos.listas.pagarAtrasadas.map((t) => [t.id, t]));
  const porIdRec = Object.fromEntries(pos.listas.receberAtrasados.map((t) => [t.id, t]));
  const prioridade = (dados.prioridade || []).map((id) => porIdPagar[id]).filter(Boolean);
  const quitacao = (dados.quitacaoProvavel || []).map((id) => porIdRec[id]).filter(Boolean);
  // v338 — o que já vence dentro do mês previsto está em "a pagar/receber no mês": não soma de novo
  const iniM = `${M}-01`;
  const totPrioridade = soma(prioridade), totQuitacao = soma(quitacao);   // v340 — o card mostra a soma da lista
  const extraPrior = soma(prioridade.filter((t) => t.vencimento < iniM)), extraQuit = soma(quitacao.filter((t) => t.vencimento < iniM));   // só isso entra a mais no cenário

  const n = (k) => Number(dados[k]) || 0;
  // cenários (calculados)
  // v371 — cenário geral = a receber geral + execução + pedidos em andamento − antecipação − a pagar geral (real + previsões + quitação das dívidas) − contas atrasadas
  const V = pos.pagar.virtual;
  const pagarGeral = r2(V.real + V.previsoesProx + (V.quitacao?.total || 0));
  const geral = r2(pos.receber.geral.real + pos.receber.atrasado.execucao + n("pedidosAndamento") - n("antecipacaoDisp") - pagarGeral - pos.pagar.atrasadas);
  const entradasMes = r2(pos.receber.mes.real + extraQuit + n("recebimentoMes") + n("antecipacaoDisp"));   // v357 — antecipação entra no mês
  const saidasMes = r2(pos.pagar.mes + extraPrior);
  const mes = r2(caixa.saldoPositivo + entradasMes - saidasMes);
  // v364 — LB (liquidação de balanço): geral + venda de patrimônio − passivo trabalhista − 1 mês de operação − quitação das dívidas
  // v371 — LB = cenário geral + venda de patrimônio − passivo trabalhista − CMV dos pedidos em andamento − impostos (9,1% do total em andamento)
  const impostosAndamento = r2((Number(dados.andamento?.valor) || 0) * ALIQ_IMPOSTOS_ANDAMENTO);
  const lb = r2(geral + n("lbVendaPatrimonio") - n("passivoTributario") - n("cmvAndamento") - impostosAndamento);
  const cenarios = {
    geral, mes, lb,
    cobrindo: r2(mes - caixa.limiteTomado),
    semCobrir: mes,
    antecipandoCobrindo: r2(mes - caixa.limiteTomado),   // v357 — antecipação já está em "mes"
    antecipandoSemCobrir: mes,
    memoria: { saldoPositivo: caixa.saldoPositivo, entradasMes, saidasMes, chequeEmUso: caixa.limiteTomado, antecipacao: n("antecipacaoDisp"),
      receberMes: pos.receber.mes.real, quitacao: totQuitacao, recebimentoEntregas: n("recebimentoMes"), pagarMes: pos.pagar.mes, prioridade: totPrioridade,
      receberReal: pos.receber.geral.real, execucao: pos.receber.atrasado.execucao, andamento: n("pedidosAndamento"), pagarSemPrevisao: pos.pagar.totalSemPrevisao },
  };

  const auto = {
    // compatibilidade (conferência, DFC)
    contasAtrasadas: pos.pagar.atrasadas, contasPagarMes: pos.pagar.mes, contasPagarTotal: pos.pagar.totalSemPrevisao,
    receberPosicaoGeral: pos.receber.geral.real, receberMesVigente: pos.receber.mes.real, receberAtrasadas: pos.receber.atrasado.cobranca,
  };
  return {
    competencia, mesPrevisto: M, hoje,
    saldoInicial: p?.saldoInicial != null ? Number(p.saldoInicial) : null,
    auto, pos: { receber: pos.receber, pagar: pos.pagar }, listas: { pagarAtrasadas: pos.listas.pagarAtrasadas, receberAtrasados: pos.listas.receberAtrasados },
    manual: { ...dados, salvos: undefined }, bancos, caixa,
    selecionados: { prioridade, quitacao, totPrioridade, totQuitacao },
    cenarios, antecipaveis: pos.antecipaveis,
    atrasadoReceber: pos.receber.atrasado.cobranca,
    salvos: (dados.salvos || []).map((s) => ({ em: s.em, por: s.por, cenarios: s.snapshot?.cenarios || null })),
    anteriorTemSalvo: !!(ant?.dados?.salvos || []).length,
    atualizadoPorNome: p?.atualizadoPorNome || null, atualizadoEm: p?.updatedAt || null,
    _listasMes: { receberMesIds: pos.listas.receberMesIds, pagarMesIds: pos.listas.pagarMesIds },
  };
}

// grava os campos; com `retrato`, guarda também o painel calculado (snapshot) com a data
export async function salvarPainel(competencia, { saldoInicial, dados, quem, retrato = false }) {
  const atual = await prisma.finMesPainel.findUnique({ where: { competencia } });
  const novo = { ...PAINEL_VAZIO, ...((atual?.dados) || {}), ...(dados || {}) };
  novo.salvos = (atual?.dados?.salvos) || [];
  await prisma.finMesPainel.upsert({
    where: { competencia },
    create: { competencia, saldoInicial: saldoInicial ?? null, dados: novo, atualizadoPorNome: quem },
    update: { ...(saldoInicial !== undefined ? { saldoInicial } : {}), dados: novo, atualizadoPorNome: quem },
  });
  if (retrato) {
    const pn = await painel(competencia);
    const snapshot = { mesPrevisto: pn.mesPrevisto, pos: pn.pos, caixa: pn.caixa, bancos: pn.bancos, cenarios: pn.cenarios,
      selecionados: pn.selecionados, manual: { ...pn.manual, salvos: undefined, pedidosLista: undefined }, listasMes: pn._listasMes };
    novo.salvos = [...novo.salvos, { em: new Date().toISOString(), por: quem || null, snapshot }].slice(-30);
    await prisma.finMesPainel.update({ where: { competencia }, data: { dados: novo } });
  }
  return painel(competencia);
}

// v337 — botão Atualizar: sincroniza as contas (antecipados) e puxa os pedidos do PCP/KM para o mês previsto.
// Preenche pedidos a entregar (saldo a faturar), a receber no mês (parcelas dos pedidos em M) e pedidos em andamento
// (tudo que os pedidos ainda vão gerar, sem as entradas já lançadas no contas a receber). Bancos e antecipação seguem digitados.
export async function atualizarPainel(competencia, quem) {
  const M = mesSeguinte(competencia);
  const avisos = [];
  // v338 — mesma limpeza do contas a pagar: compra lançada em dobro (NF XML + boleto/posição) fica só uma
  try { const { deduplicarComprasXml } = await import("@/lib/finDedupCompras"); const d = await deduplicarComprasXml(); if (d?.removidas) avisos.push(`${d.removidas} compra(s) lançada(s) em dobro unificada(s)`); }
  catch (e) { avisos.push(`Compras em dobro: ${e.message}`); }
  try { const { sincronizarAntecipados } = await import("@/lib/finAntecipados"); await sincronizarAntecipados(quem); }
  catch (e) { avisos.push(`Contas: ${e.message}`); }
  let resumo = null, crono = null, pedidos = [];
  try { const { listarPedidos } = await import("@/lib/pedidos"); const r = await listarPedidos({ competencia: M }); resumo = r.resumo; crono = r.crono; pedidos = r.pedidos || []; }
  catch (e) { avisos.push(`Pedidos: ${e.message}`); }
  if (crono && crono.ok === false) avisos.push(`PCP: ${crono.erro || "sem conexão"} (usei a última programação recebida)`);
  const dados = { atualizadoAuto: { em: new Date().toISOString(), por: quem || null, qtdPedidos: resumo?.qtdPedidos ?? null, avisos } };
  if (resumo) {
    // v341 — valor e quantidade de pedidos de cada linha (pedidos em andamento, sem os internos NORT)
    const and = pedidos.filter((p) => p.status === "ANDAMENTO" && !p.interno);
    const saldo = (p) => r2(p.vlEntregar != null ? p.vlEntregar : p.total);
    const ent = and.filter((p) => String(p.previsao?.base || "").slice(0, 7) === M && saldo(p) > 0);
    const rec = and.filter((p) => p.noMes > 0);
    const tot = and.filter((p) => saldo(p) > 0);
    const sm = (l, f) => r2(l.reduce((a, p) => a + f(p), 0));
    // v342 — lista dos pedidos (para abrir ao clicar): nº, cliente, peças, entrega prevista e parcelas
    const entIds = new Set(ent.map((p) => p.id)), recIds = new Set(rec.map((p) => p.id));
    dados.pedidosLista = tot.map((p) => ({
      id: p.id, numero: p.numero, cliente: p.cliente, pecas: p.qtEntregar != null ? p.qtEntregar : p.qtd || 0, entrega: p.entregaPrevista || p.despacho || p.previsao?.base || null, origem: p.entregaPrevista ? "PCP" : p.despacho ? "KM" : null, pronto: !!p.previsao?.pronto,
      atrasado: !!p.previsao?.atrasado, saldo: saldo(p), noMes: p.noMes || 0, ent: entIds.has(p.id), rec: recIds.has(p.id),
      parcelas: (p.previsao?.parcelas || []).map((x) => ({ data: x.data, valor: x.valor, tipo: x.tipo })),
    }));
    dados.entregasMes = { valor: sm(ent, saldo), qtd: ent.length };
    dados.recebimentosMes = { valor: sm(rec, (p) => p.noMes), qtd: rec.length };
    dados.andamento = { valor: sm(tot, saldo), qtd: tot.length, aReceber: resumo.aReceberPrevisto };
    // campos usados nos cenários
    Object.assign(dados, { pedidosEntregar: dados.entregasMes.valor, recebimentoMes: dados.recebimentosMes.valor, pedidosAndamento: resumo.aReceberPrevisto });
  }
  const pn = await salvarPainel(competencia, { dados, quem });
  return { ...pn, avisos };
}

// v313 — exclui um painel salvo (confere a data para não apagar outro)
export async function excluirSalvo(competencia, idx, em) {
  const p = await prisma.finMesPainel.findUnique({ where: { competencia } });
  const l = [...(p?.dados?.salvos || [])];
  if (!l[idx] || (em && l[idx].em !== em)) return false;
  l.splice(idx, 1);
  await prisma.finMesPainel.update({ where: { competencia }, data: { dados: { ...p.dados, salvos: l } } });
  return true;
}

export async function painelSalvo(competencia, idx = -1) {
  const p = await prisma.finMesPainel.findUnique({ where: { competencia }, select: { dados: true } });
  const l = p?.dados?.salvos || [];
  const s = idx < 0 ? l[l.length + idx] : l[idx];
  return s ? { competencia, em: s.em, por: s.por, ...s.snapshot } : null;
}

// previsto × realizado: o último painel salvo da competência C (previsão de M = C+1) contra o que as contas mostram em M
export async function previstoRealizado(competencia) {
  const s = await painelSalvo(competencia, -1);
  if (!s) return null;
  const M = s.mesPrevisto, ini = dUTC(`${M}-01`), fim = dUTC(fimDoMes(M));
  const pagos = await prisma.finTitulo.findMany({ where: { status: "PAGO", dataPagamento: { gte: ini, lte: fim } }, select: { id: true, tipo: true, valor: true, valorPago: true } });
  const v = (t) => Number(t.valorPago ?? t.valor) || 0;
  const recebido = r2(pagos.filter((t) => t.tipo === "RECEBER").reduce((a, t) => a + v(t), 0));
  const pago = r2(pagos.filter((t) => t.tipo === "PAGAR").reduce((a, t) => a + v(t), 0));
  const pagosIds = new Set(pagos.map((t) => t.id));
  const conf = (lista) => { const l = lista || []; const ok = l.filter((t) => pagosIds.has(t.id)); return { previsto: soma(l), qtd: l.length, realizado: soma(ok), qtdRealizado: ok.length }; };
  const idsMes = (ids) => { const l = (ids || []); return { qtd: l.length, realizados: l.filter((id) => pagosIds.has(id)).length }; };
  const prox = await prisma.finMesPainel.findUnique({ where: { competencia: M }, select: { dados: true } });
  const bancosReal = prox?.dados?.bancos?.length ? calcBancos(prox.dados.bancos).caixa : null;
  return {
    salvo: s, mes: M,
    realizado: {
      recebidoNoMes: recebido, pagoNoMes: pago, resultadoNoMes: r2(recebido - pago),
      quitacao: conf(s.selecionados?.quitacao), prioridade: conf(s.selecionados?.prioridade),
      receberMes: idsMes(s.listasMes?.receberMesIds), pagarMes: idsMes(s.listasMes?.pagarMesIds),
      bancos: bancosReal,
    },
  };
}
