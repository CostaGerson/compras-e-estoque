// DRE do ano até o momento (só os meses já lançados) e a evolução da dívida.
// Alimenta os indicadores que aparecem acima dos cards de meses da análise financeira mensal.
import { prisma } from "@/lib/prisma";
import { mapaDeContas, GRUPOS_EXTERNOS } from "@/lib/finDre";
import { mesesEntre } from "@/lib/alavancagem";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n = (v) => (v == null ? null : Number(v));
const fimDoMes = (ano, mes) => new Date(ano, mes, 0, 23, 59, 59);   // mes 1..12
const CHAVES_EXT = GRUPOS_EXTERNOS.map((g) => g.k);

// ---------------- dívida numa data ----------------
// Saldo de capital a vencer de um contrato numa data qualquer (serve para a série histórica).
export function saldoContratoEm(c, ref, hoje = new Date()) {
  const dc = c.dataContrato ? new Date(c.dataContrato) : null;
  if (dc && dc > ref) return 0;                       // o contrato ainda não existia
  if (c.quitado && ref >= hoje) return 0;             // quitado: zera de hoje em diante

  if (c.tipo === "MUTUO") {
    const v = c.vencimentoUnico ? new Date(c.vencimentoUnico) : null;
    if (v && v <= ref) return c.quitado ? 0 : r2(c.capital);   // vencido e não pago continua devendo
    return r2(c.capital);
  }
  const parcela = Number(c.parcela || 0);
  const prazo = Number(c.prazoMeses || 0);
  const inicio = c.inicioPagamento ? new Date(c.inicioPagamento) : null;
  if (!parcela || !prazo) return c.quitado ? 0 : r2(c.capital);
  if (!inicio) return r2(parcela * prazo);
  const pagas = Math.max(0, Math.min(prazo, mesesEntre(inicio, ref) + 1));
  return r2(parcela * (prazo - pagas));
}

// Parcela que pesa no mês daquela data.
export function mensalContratoEm(c, ref, hoje = new Date()) {
  if (!saldoContratoEm(c, ref, hoje)) return 0;
  if (c.tipo === "MUTUO") return r2(Number(c.capital || 0) * (Number(c.taxaMensal || 0) / 100));
  return r2(c.parcela);
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
export function posicaoEm(contratos, tributos, ref, hoje = new Date()) {
  const divida = r2(contratos.reduce((s, c) => s + saldoContratoEm(c, ref, hoje), 0));
  const trib = r2(tributos.reduce((s, t) => s + saldoTributoEm(t, ref), 0));
  const mensal = r2(
    contratos.reduce((s, c) => s + mensalContratoEm(c, ref, hoje), 0) +
    tributos.reduce((s, t) => s + (t.parcelado && saldoTributoEm(t, ref) > 0 ? Number(t.parcelaMensal || 0) : 0), 0)
  );
  return { divida, tributos: trib, total: r2(divida + trib), mensal };
}

// ---------------- DRE do ano ----------------
export async function dreAno(ano, hoje = new Date()) {
  const a = Number(ano);
  const [contas, lanc, paineis, contratos, tributos] = await Promise.all([
    mapaDeContas(),
    prisma.finLancamento.findMany({
      where: { competencia: { startsWith: `${a}-` }, desmembrado: false, substituido: false },
      select: { competencia: true, contaId: true, valor: true },
    }),
    prisma.finMesPainel.findMany({ where: { competencia: { startsWith: `${a}-` } }, select: { competencia: true, saldoInicial: true } }),
    prisma.finContrato.findMany({ where: { ativo: true } }),
    prisma.finTributo.findMany(),
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
    const alav = posicaoEm(contratos, tributos, ref, hoje);
    if (!m) { meses.push({ competencia: comp, mes: i, lancado: false, lancamentos: 0, alavancagem: alav }); continue; }
    const g = m.g;
    const receita = r2(g.RECEITA || 0), cmv = r2(g.CMV || 0);
    const margem = r2(receita + cmv);
    const adm = r2(g.DESPESA_ADM || 0);
    const ebitda = r2(margem + adm);
    const impostos = r2(g.IMPOSTOS_JUROS || 0);
    const lucro = r2(ebitda + impostos);
    const investimento = r2(g.INVESTIMENTO || 0);
    const resultado = r2(lucro + investimento);
    const externo = r2(CHAVES_EXT.reduce((s, k) => s + (g[k] || 0), 0));
    const saldoInicial = saldoDe[comp] ?? null;
    meses.push({
      competencia: comp, mes: i, lancado: true, lancamentos: m.n,
      receita, cmv, margem, adm, ebitda, impostos, lucro, investimento, resultado,
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
    impostos: soma("impostos"), lucro: soma("lucro"), investimento: soma("investimento"),
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
  const agora = posicaoEm(contratos, tributos, fimDoMes(a, ultimoMes), hoje);
  const abertura = posicaoEm(contratos, tributos, fimDoMes(a - 1, 12), hoje);
  const anoAnterior = posicaoEm(contratos, tributos, fimDoMes(a - 1, ultimoMes), hoje);
  const evolucao = [];
  for (let i = 1; i <= 12; i++) {
    evolucao.push({
      mes: i,
      atual: posicaoEm(contratos, tributos, fimDoMes(a, i), hoje).total,
      anterior: posicaoEm(contratos, tributos, fimDoMes(a - 1, i), hoje).total,
    });
  }
  const varPct = (de, para) => (de ? (para - de) / de : null);

  return {
    ano: a, meses, totais,
    alavancagem: {
      atual: agora, abertura, anoAnterior,
      mesReferencia: ultimoMes,
      variacaoAno: r2(agora.total - abertura.total),
      variacaoAnoPct: varPct(abertura.total, agora.total),
      variacaoAnoAnterior: r2(agora.total - anoAnterior.total),
      variacaoAnoAnteriorPct: varPct(anoAnterior.total, agora.total),
      evolucao,
      contratos: contratos.length,
      tributos: tributos.length,
    },
  };
}
