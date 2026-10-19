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
export const BANCOS_PADRAO = [
  ["BRADESCO", 50000], ["ITAU", 22819], ["ITAU CX AVAL", 7000], ["CAIXA", 10000], ["C6", 15000], ["INTER", 0], ["BB", 1000],
].map(([nome, limite], i) => ({ id: i + 1, nome, saldo: 0, limite, tomado: null }));

const PAINEL_VAZIO = {
  bancos: [], prioridade: [], quitacaoProvavel: [],
  receberPrevisao: null,
  pedidosEntregar: null, recebimentoMes: null, pedidosAndamento: null, antecipacaoDisp: null,
  infoRelevante: "", salvos: [],
};
// Campos digitados (a tela e o salvar usam esta lista)
export const CAMPOS_MANUAIS = ["receberPrevisao", "pedidosEntregar", "recebimentoMes", "pedidosAndamento", "antecipacaoDisp", "infoRelevante"];

const SEL = { id: true, tipo: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, previsao: true,
  antecipadoForma: true, cobranca: true, liquidadoEm: true, recompraId: true, dataPagamento: true, valorPago: true, numeroDoc: true };
const tOut = (t, mod) => ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: r2(t.valor), vencimento: iso(t.vencimento), numeroDoc: t.numeroDoc || null, previsao: !!t.previsao, modalidade: mod || null });
const soma = (l) => r2(l.reduce((s, t) => s + Number(t.valor), 0));
const antecipado = (t) => !!t.antecipadoForma || t.cobranca === "DESCONTADO";

function calcBancos(lista) {
  const bancos = (lista && lista.length ? lista : BANCOS_PADRAO).map((b, i) => {
    const saldo = r2(b.saldo), limite = r2(b.limite);
    const tomado = b.tomado == null || b.tomado === "" ? r2(Math.max(0, -saldo)) : r2(b.tomado);
    return { id: b.id ?? i + 1, nome: String(b.nome || "").toUpperCase(), saldo, limite, tomado, disponivel: r2(Math.max(0, saldo) + Math.max(0, limite - tomado)) };
  });
  const s = (k) => r2(bancos.reduce((a, b) => a + b[k], 0));
  return { bancos, caixa: { saldoGeral: s("saldo"), saldoPositivo: r2(bancos.reduce((a, b) => a + Math.max(0, b.saldo), 0)), limiteTotal: s("limite"), limiteTomado: s("tomado"), disponivelTotal: s("disponivel") } };
}

// números ao vivo das contas (para o mês M)
async function posicao(M, hoje) {
  const ini = `${M}-01`, fim = fimDoMes(M);
  const [pagar, receberAb, receberAnt, receberExec] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo: "PAGAR", status: "ABERTO" }, select: SEL, orderBy: { vencimento: "asc" } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "ABERTO" }, select: SEL, orderBy: { vencimento: "asc" } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "PAGO", liquidadoEm: null, recompraId: null, OR: [{ antecipadoForma: { not: null } }, { cobranca: "DESCONTADO" }] }, select: SEL, orderBy: { vencimento: "asc" } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "EXECUCAO" }, select: SEL, orderBy: { vencimento: "asc" } }),
  ]);
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
  const pagarSemPrev = pagar.filter((t) => !t.previsao);
  const pagarAtras = pagar.filter(vencido);   // v311 — atrasadas incluem previsões
  const pagarMes = pagar.filter(noMes);
  return {
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
  const totPrioridade = soma(prioridade), totQuitacao = soma(quitacao);

  const n = (k) => Number(dados[k]) || 0;
  // cenários (calculados)
  const geral = r2(pos.receber.geral.real + pos.receber.atrasado.execucao + n("pedidosAndamento") - pos.pagar.totalSemPrevisao);
  const entradasMes = r2(pos.receber.mes.real + totQuitacao + n("recebimentoMes"));
  const saidasMes = r2(pos.pagar.mes + totPrioridade);
  const mes = r2(caixa.saldoPositivo + entradasMes - saidasMes);
  const cenarios = {
    geral, mes,
    cobrindo: r2(mes - caixa.limiteTomado),
    semCobrir: mes,
    antecipandoCobrindo: r2(mes - caixa.limiteTomado + n("antecipacaoDisp")),
    antecipandoSemCobrir: r2(mes + n("antecipacaoDisp")),
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
    cenarios,
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
      selecionados: pn.selecionados, manual: { ...pn.manual, salvos: undefined }, listasMes: pn._listasMes };
    novo.salvos = [...novo.salvos, { em: new Date().toISOString(), por: quem || null, snapshot }].slice(-30);
    await prisma.finMesPainel.update({ where: { competencia }, data: { dados: novo } });
  }
  return painel(competencia);
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
