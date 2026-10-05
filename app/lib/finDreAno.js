// DRE do ano até o momento (só os meses já lançados) e a evolução da dívida.
// Alimenta os indicadores que aparecem acima dos cards de meses da análise financeira mensal.
import { prisma } from "@/lib/prisma";
import { mapaDeContas, GRUPOS_EXTERNOS } from "@/lib/finDre";
import { mesesEntre } from "@/lib/alavancagem";
import { cronograma, posicaoApos, baixasPorContrato, pagasEm } from "@/lib/alavancagemAmort";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n = (v) => (v == null ? null : Number(v));
const fimDoMes = (ano, mes) => new Date(ano, mes, 0, 23, 59, 59);   // mes 1..12
const CHAVES_EXT = GRUPOS_EXTERNOS.map((g) => g.k);

// ---------------- dívida numa data ----------------
// Quantas parcelas o calendário diz que já venceram até a data.
const pagasPorData = (c) => (ref) => {
  const prazo = Number(c.prazoMeses) || 0;
  const inicio = c.inicioPagamento ? new Date(c.inicioPagamento) : null;
  if (!inicio || !prazo) return 0;
  return Math.max(0, Math.min(prazo, mesesEntre(inicio, ref) + 1));
};

// Posição completa de um contrato numa data: a vencer (com juros), principal, juros e amortização.
// `baixa` são os títulos pagos daquele contrato — quando existem, mandam mais que o calendário.
export function posicaoContratoEm(c, ref, hoje = new Date(), baixa = null) {
  const vazio = { aVencer: 0, saldoDevedor: 0, jurosPagos: 0, amortizado: 0, jurosAVencer: 0, parcelasPagas: 0, mensal: 0 };
  const dc = c.dataContrato ? new Date(c.dataContrato) : null;
  if (dc && dc > ref) return vazio;                   // o contrato ainda não existia
  if (c.quitado && ref >= hoje) return vazio;         // quitado: zera de hoje em diante

  const cron = cronograma(c);
  if (c.tipo === "MUTUO") {
    const v = c.vencimentoUnico ? new Date(c.vencimentoUnico) : null;
    if (v && v <= ref && c.quitado) return vazio;
    const capital = r2(c.capital);
    const meses = dc ? Math.max(0, mesesEntre(dc, ref)) : 0;
    return {
      aVencer: capital, saldoDevedor: capital, jurosPagos: r2(cron.parcela * meses),
      amortizado: 0, jurosAVencer: null, parcelasPagas: meses, mensal: cron.parcela,
    };
  }
  if (!cron.linhas.length) {
    const cap = c.quitado ? 0 : r2(c.capital);
    return { ...vazio, aVencer: cap, saldoDevedor: cap };
  }
  const pagas = pagasEm(ref, baixa, pagasPorData(c));
  const p = posicaoApos(cron, pagas);
  return { ...p, mensal: p.aVencer > 0 ? cron.parcela : 0 };
}

// Saldo a vencer (base da planilha de alavancagem: parcela × parcelas restantes).
export function saldoContratoEm(c, ref, hoje = new Date(), baixa = null) {
  return posicaoContratoEm(c, ref, hoje, baixa).aVencer;
}

// Parcela que pesa no mês daquela data.
export function mensalContratoEm(c, ref, hoje = new Date(), baixa = null) {
  return posicaoContratoEm(c, ref, hoje, baixa).mensal;
}

// Saldo de um parcelamento de tributo numa data.
export function saldoTributoEm(t, ref) {
  const valor = Number(t.valor || 0);
  if (!t.parcelado) return r2(valor);
  const parcela = Number(t.parcelaMensal || 0);
  const parcelas = Number(t.parcelas || 0);
  const inicio = t.inicio ? new Date(t.inicio) : null;
  if (!parcela || !inicio) return r2(valor);
  const pagas = t.parcelasPagas != null && ref >= new Date()
    ? Number(t.parcelasPagas)
    : Math.max(0, Math.min(parcelas || Infinity, mesesEntre(inicio, ref) + 1));
  return r2(Math.max(0, valor - parcela * pagas));
}

// Posição de alavancagem numa data: dívida de contratos + parcelamentos de tributos.
export function posicaoEm(contratos, tributos, ref, hoje = new Date(), baixas = {}) {
  const pos = contratos.map((c) => posicaoContratoEm(c, ref, hoje, baixas[c.id]));
  const soma = (k) => r2(pos.reduce((s, p) => s + (p[k] || 0), 0));
  const divida = soma("aVencer");
  const trib = r2(tributos.reduce((s, t) => s + saldoTributoEm(t, ref), 0));
  const mensal = r2(
    soma("mensal") +
    tributos.reduce((s, t) => s + (t.parcelado && saldoTributoEm(t, ref) > 0 ? Number(t.parcelaMensal || 0) : 0), 0)
  );
  return {
    divida, tributos: trib, total: r2(divida + trib), mensal,
    principal: soma("saldoDevedor"),            // dívida sem os juros que ainda vão correr
    jurosAVencer: r2(divida - soma("saldoDevedor")),
    jurosPagos: soma("jurosPagos"),             // acumulado desde o início de cada contrato
    amortizado: soma("amortizado"),
  };
}

// ---------------- DRE do ano ----------------
export async function dreAno(ano, hoje = new Date()) {
  const a = Number(ano);
  const [contas, lanc, paineis, contratos, tributos, baixas] = await Promise.all([
    mapaDeContas(),
    prisma.finLancamento.findMany({
      where: { competencia: { startsWith: `${a}-` }, desmembrado: false, substituido: false },
      select: { competencia: true, contaId: true, valor: true },
    }),
    prisma.finMesPainel.findMany({ where: { competencia: { startsWith: `${a}-` } }, select: { competencia: true, saldoInicial: true } }),
    prisma.finContrato.findMany({ where: { ativo: true } }),
    prisma.finTributo.findMany(),
    baixasPorContrato(),
  ]);
  const grupoDe = Object.fromEntries(contas.map((c) => [c.id, c.grupo]));
  const saldoDe = Object.fromEntries(paineis.map((p) => [p.competencia, n(p.saldoInicial)]));

  // soma por mês e por grupo
  const porMes = {};
  for (const l of lanc) {
    const m = (porMes[l.competencia] = porMes[l.competencia] || { n: 0, g: {} });
    m.n++;
    const g = (l.contaId && grupoDe[l.contaId]) || "FORA";
    m.g[g] = r2((m.g[g] || 0) + Number(l.valor));
  }

  const meses = [];
  for (let i = 1; i <= 12; i++) {
    const comp = `${a}-${String(i).padStart(2, "0")}`;
    const m = porMes[comp];
    const ref = fimDoMes(a, i);
    const alav = posicaoEm(contratos, tributos, ref, hoje, baixas);
    if (!m) { meses.push({ competencia: comp, mes: i, lancado: false, lancamentos: 0, alavancagem: alav }); continue; }
    const g = m.g;
    const receita = r2(g.RECEITA || 0), cmv = r2(g.CMV || 0);
    const margem = r2(receita + cmv);
    const adm = r2(g.DESPESA_ADM || 0);
    const ebitda = r2(margem + adm);
    const impostos = r2(g.IMPOSTOS_JUROS || 0);
    const lucro = r2(ebitda + impostos);
    const investimento = r2(g.INVESTIMENTO || 0);
    const nort = r2(g.NORT || 0);
    const resultado = r2(lucro + investimento + nort);
    const externo = r2(CHAVES_EXT.reduce((s, k) => s + (g[k] || 0), 0));
    const saldoInicial = saldoDe[comp] ?? null;
    meses.push({
      competencia: comp, mes: i, lancado: true, lancamentos: m.n,
      receita, cmv, margem, adm, ebitda, impostos, lucro, investimento, nort, resultado,
      externo, saldoInicial,
      saldoOperacao: r2((saldoInicial || 0) + resultado),
      saldoFinal: r2((saldoInicial || 0) + resultado + externo),
      alavancagem: alav,
    });
  }

  // ---- totais do ano: só os meses já lançados ----
  const feitos = meses.filter((m) => m.lancado);
  const soma = (k) => r2(feitos.reduce((s, m) => s + (m[k] || 0), 0));
  const receita = soma("receita");
  const totais = {
    meses: feitos.length,
    primeiro: feitos[0]?.competencia || null,
    ultimo: feitos[feitos.length - 1]?.competencia || null,
    receita, cmv: soma("cmv"), margem: soma("margem"), adm: soma("adm"), ebitda: soma("ebitda"),
    impostos: soma("impostos"), lucro: soma("lucro"), investimento: soma("investimento"), nort: soma("nort"),
    resultado: soma("resultado"), externo: soma("externo"),
    saldoInicial: feitos[0]?.saldoInicial ?? null,
  };
  totais.saldoOperacao = r2((totais.saldoInicial || 0) + totais.resultado);
  totais.saldoFinal = r2(totais.saldoOperacao + totais.externo);
  totais.margemPct = receita ? totais.margem / receita : null;
  totais.ebitdaPct = receita ? totais.ebitda / receita : null;
  totais.lucroPct = receita ? totais.lucro / receita : null;
  // média mensal sobre os meses lançados
  totais.mediaReceita = feitos.length ? r2(receita / feitos.length) : 0;
  totais.mediaLucro = feitos.length ? r2(totais.lucro / feitos.length) : 0;

  // ---- alavancagem: hoje, abertura do ano e mesmo ponto do ano anterior ----
  const ultimoMes = feitos.length ? feitos[feitos.length - 1].mes : hoje.getMonth() + 1;
  const agora = posicaoEm(contratos, tributos, fimDoMes(a, ultimoMes), hoje, baixas);
  const abertura = posicaoEm(contratos, tributos, fimDoMes(a - 1, 12), hoje, baixas);
  const anoAnterior = posicaoEm(contratos, tributos, fimDoMes(a - 1, ultimoMes), hoje, baixas);
  const evolucao = meses.map((m) => ({
    mes: m.mes,
    atual: m.alavancagem.total,
    anterior: posicaoEm(contratos, tributos, fimDoMes(a - 1, m.mes), hoje, baixas).total,
  }));
  const varPct = (de, para) => (de ? (para - de) / de : null);
  // o que foi pago de juros e o que de fato amortizou capital dentro do ano
  const jurosAno = r2(agora.jurosPagos - abertura.jurosPagos);
  const amortizacaoAno = r2(agora.amortizado - abertura.amortizado);

  return {
    ano: a, meses, totais,
    alavancagem: {
      atual: agora, abertura, anoAnterior,
      mesReferencia: ultimoMes,
      variacaoAno: r2(agora.total - abertura.total),
      variacaoAnoPct: varPct(abertura.total, agora.total),
      variacaoAnoAnterior: r2(agora.total - anoAnterior.total),
      variacaoAnoAnteriorPct: varPct(anoAnterior.total, agora.total),
      evolucao, jurosAno, amortizacaoAno,
      contratos: contratos.length,
      tributos: tributos.length,
    },
  };
}
