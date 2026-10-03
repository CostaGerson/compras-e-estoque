// Alavancagem: contratos de dívida (parcelados, mútuos e investimentos), limites de crédito e tributos.
// O sistema calcula tudo a partir de capital, taxa, prazo e datas; os campos "...Informado" guardam
// o que veio da planilha, e a tela aponta onde o lançado não bate com o cálculo.
import { prisma } from "@/lib/prisma";
import { CONTRATOS_SEED, LIMITES_SEED, TRIBUTOS_SEED } from "@/lib/alavancagemSeed";

export const TIPOS = {
  PARCELADO: { label: "Parcelado", ajuda: "Parcela fixa por mês até quitar." },
  MUTUO: { label: "Mútuo", ajuda: "Juros todo mês e o capital inteiro no vencimento." },
  INVESTIMENTO: { label: "Investimento", ajuda: "Compra parcelada de máquina/equipamento, com entrada." },
};
export const GRUPOS = {
  GIRO_LP: "Capital de giro · longo prazo",
  MUTUO_GIRO: "Mútuos · giro",
  ARREMATE_W3: "Mútuos · arremate W3",
  INVESTIMENTO: "Investimentos",
};
export const ORDEM_GRUPOS = ["GIRO_LP", "MUTUO_GIRO", "ARREMATE_W3", "INVESTIMENTO"];
export const GRUPOS_TRIBUTO = { RFB: "Receita Federal", PGFN: "Dívida ativa (PGFN)", ESTADUAL: "Tributos estaduais", OUTRO: "Outros" };

const n = (v) => (v === null || v === undefined ? null : Number(v));
const r2 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);
const dia = (v) => (v ? new Date(v) : null);
const MS_DIA = 86400000;

// meses completos entre duas datas (mesmo dia do mês conta)
export function mesesEntre(de, ate) {
  if (!de || !ate) return 0;
  const a = new Date(de), b = new Date(ate);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
}
export function somaMeses(data, meses) {
  const d = new Date(data);
  const dia0 = d.getUTCDate();
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
  const ultimo = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(dia0, ultimo));
  return x;
}

// ---------------- cálculo de um contrato ----------------
export function calcular(c, hoje = new Date()) {
  const tipo = c.tipo;
  const capital = n(c.capital) || 0;
  const taxa = n(c.taxaMensal) || 0;          // % a.m.
  const out = { id: c.id, tipo, grupo: c.grupo, nome: c.nome, credor: c.credor, capital, taxaMensal: taxa, avisos: [] };

  if (tipo === "MUTUO") {
    const venc = dia(c.vencimentoUnico);
    const contrato = dia(c.dataContrato);
    const dias = c.prazoDias != null ? Number(c.prazoDias)
      : (venc && contrato ? Math.round((venc - contrato) / MS_DIA) : null);
    const jurosMes = r2(capital * (taxa / 100));
    const jurosTotais = dias == null ? null : r2(jurosMes * (dias / 30));
    const valorAPagar = jurosTotais == null ? null : r2(capital + jurosTotais);
    const diasCorridos = contrato ? Math.max(0, Math.round((hoje - contrato) / MS_DIA)) : null;
    const jurosAcumulados = diasCorridos == null ? null : r2(Math.min(jurosMes * (diasCorridos / 30), jurosTotais ?? Infinity));
    Object.assign(out, {
      prazoDias: dias, vencimento: venc, jurosMes, jurosTotais, valorAPagar, jurosAcumulados,
      saldoCapital: c.quitado ? 0 : capital,                 // mútuo só amortiza no vencimento
      compromisso: c.quitado ? 0 : valorAPagar,
      diasRestantes: venc ? Math.round((venc - hoje) / MS_DIA) : null,
      vencido: !!venc && venc < hoje && !c.quitado,
      mensal: jurosMes,                                      // o que pesa no mês
    });
    const confere = (rot, calc, info) => {
      if (info == null || calc == null) return;
      if (Math.abs(calc - Number(info)) > 0.5) out.avisos.push(`${rot}: planilha ${Number(info).toFixed(2)} · cálculo ${calc.toFixed(2)}`);
    };
    confere("Juros ao mês", jurosMes, c.jurosMesInformado);
    confere("Juros totais", jurosTotais, c.jurosTotaisInformado);
    confere("Valor a pagar", valorAPagar, c.valorAPagarInformado);
    if (out.vencido) out.avisos.push("Vencido e ainda somando na alavancagem — baixe ou renegocie.");
    return out;
  }

  // parcelado e investimento
  const parcela = n(c.parcela) || 0;
  const prazo = Number(c.prazoMeses) || 0;
  const inicio = dia(c.inicioPagamento);
  const debitoTotal = r2(parcela * prazo);
  const pagasCalc = inicio ? Math.max(0, Math.min(prazo, mesesEntre(inicio, hoje) + 1)) : 0;
  const pagas = c.parcelasPagas != null ? Number(c.parcelasPagas)
    : c.parcelasPagasInformadas != null ? Number(c.parcelasPagasInformadas) : pagasCalc;
  const restantes = Math.max(0, prazo - pagas);
  const aVencer = r2(parcela * restantes);
  const pagarAte = inicio && prazo ? somaMeses(inicio, prazo - 1) : null;
  Object.assign(out, {
    parcela, prazoMeses: prazo, inicio, entrada: n(c.entrada),
    debitoTotal, parcelasPagas: pagas, parcelasPagasCalculadas: pagasCalc, parcelasRestantes: restantes,
    aVencer, pagarAte, saldoCapital: c.quitado ? 0 : aVencer, compromisso: c.quitado ? 0 : aVencer,
    jurosMes: null, mensal: restantes > 0 && !c.quitado ? parcela : 0,
    vencido: false,
  });
  const conf = (rot, calc, info, tol = 0.5) => {
    if (info == null || calc == null) return;
    if (Math.abs(calc - Number(info)) > tol) out.avisos.push(`${rot}: planilha ${Number(info).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · cálculo ${calc.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  };
  conf("Débito total", debitoTotal, c.debitoTotalInformado);
  conf("A vencer", aVencer, c.aVencerInformado);
  if (c.parcelasPagasInformadas != null && Math.abs(pagasCalc - Number(c.parcelasPagasInformadas)) > 1) {
    out.avisos.push(`Parcelas pagas: planilha ${c.parcelasPagasInformadas} · pelas datas ${pagasCalc}`);
  }
  if (c.pagarAteInformado && pagarAte) {
    const inf = new Date(c.pagarAteInformado);
    if (Math.abs(mesesEntre(pagarAte, inf)) >= 1 || Math.abs(mesesEntre(inf, pagarAte)) >= 1) {
      out.avisos.push(`Pagar até: planilha ${inf.toISOString().slice(0, 10).split("-").reverse().join("/")} · cálculo ${pagarAte.toISOString().slice(0, 10).split("-").reverse().join("/")}`);
    }
  }
  return out;
}

// ---------------- panorama ----------------
export async function panorama(hoje = new Date()) {
  const [contratos, limites, tributos] = await Promise.all([
    prisma.finContrato.findMany({ where: { ativo: true }, orderBy: [{ grupo: "asc" }, { id: "asc" }] }),
    prisma.finLimiteCredito.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { banco: "asc" }, { produto: "asc" }] }),
    prisma.finTributo.findMany({ orderBy: { id: "asc" } }),
  ]);

  const calc = contratos.map((c) => ({ ...calcular(c, hoje), quitado: c.quitado, observacao: c.observacao, naMatriz: c.naMatriz, contaCaixa: c.contaCaixa, dataContrato: c.dataContrato }));

  const grupos = ORDEM_GRUPOS.map((g) => {
    const itens = calc.filter((x) => x.grupo === g);
    return {
      grupo: g, label: GRUPOS[g], itens,
      capital: r2(itens.reduce((s, x) => s + (x.quitado ? 0 : x.capital), 0)),
      saldo: r2(itens.reduce((s, x) => s + (x.saldoCapital || 0), 0)),
      compromisso: r2(itens.reduce((s, x) => s + (x.compromisso || 0), 0)),
      mensal: r2(itens.reduce((s, x) => s + (x.mensal || 0), 0)),
    };
  }).filter((g) => g.itens.length);

  // tributos
  const tribPorGrupo = Object.entries(GRUPOS_TRIBUTO).map(([k, label]) => {
    const itens = tributos.filter((t) => t.grupo === k);
    return { grupo: k, label, itens, total: r2(itens.reduce((s, t) => s + Number(t.valor), 0)) };
  }).filter((g) => g.itens.length);
  const totalTributos = r2(tribPorGrupo.reduce((s, g) => s + g.total, 0));
  const mensalTributos = r2(tributos.reduce((s, t) => s + (t.parcelado ? Number(t.parcelaMensal || 0) : 0), 0));

  // posição de crédito: nos mútuos o utilizado vem dos contratos do credor
  const porCredor = {};
  calc.filter((x) => x.tipo === "MUTUO" && !x.quitado).forEach((x) => {
    const k = String(x.credor || "").toUpperCase();
    porCredor[k] = (porCredor[k] || 0) + x.capital;
  });
  const credito = limites.map((l) => {
    const usado = l.utilizado != null ? Number(l.utilizado)
      : l.produto.toUpperCase().includes("MUTUO") ? (porCredor[String(l.banco).toUpperCase()] || 0) : 0;
    const limite = Number(l.limite);
    return {
      id: l.id, banco: l.banco, produto: l.produto, limite, taxaMensal: n(l.taxaMensal),
      utilizado: r2(usado), disponivel: r2(limite - usado),
      uso: limite ? usado / limite : null,
      automatico: l.utilizado == null && l.produto.toUpperCase().includes("MUTUO"),
      observacao: l.observacao,
    };
  });
  const limiteTotal = r2(credito.reduce((s, c) => s + c.limite, 0));
  const usadoTotal = r2(credito.reduce((s, c) => s + c.utilizado, 0));

  const dividaCapital = r2(grupos.reduce((s, g) => s + g.saldo, 0));
  const compromisso = r2(grupos.reduce((s, g) => s + g.compromisso, 0));

  return {
    hoje: hoje.toISOString().slice(0, 10),
    grupos, tributos: tribPorGrupo, credito,
    totais: {
      dividaCapital, compromisso, tributos: totalTributos,
      alavancagem: r2(dividaCapital + totalTributos),            // mesma base da planilha
      alavancagemComJuros: r2(compromisso + totalTributos),
      mensal: r2(grupos.reduce((s, g) => s + g.mensal, 0) + mensalTributos),
      mensalTributos,
      limiteTotal, usadoTotal, disponivelTotal: r2(limiteTotal - usadoTotal),
      usoLimite: limiteTotal ? usadoTotal / limiteTotal : null,
    },
    avisos: calc.filter((x) => x.avisos.length).map((x) => ({ nome: x.nome, avisos: x.avisos })),
  };
}

// ---------------- carga inicial ----------------
export async function garantirContratos() {
  const ja = await prisma.finContrato.count();
  if (ja > 0) return false;
  for (const c of CONTRATOS_SEED) {
    await prisma.finContrato.create({
      data: {
        ...c,
        dataContrato: c.dataContrato ? new Date(c.dataContrato) : null,
        inicioPagamento: c.inicioPagamento ? new Date(c.inicioPagamento) : null,
        vencimentoUnico: c.vencimentoUnico ? new Date(c.vencimentoUnico) : null,
        pagarAteInformado: c.pagarAteInformado ? new Date(c.pagarAteInformado) : null,
        criadoPorNome: "IMPORTAÇÃO DA PLANILHA",
      },
    });
  }
  await prisma.finLimiteCredito.createMany({ data: LIMITES_SEED.map((l, i) => ({ ...l, ordem: i })), skipDuplicates: true });
  await prisma.finTributo.createMany({ data: TRIBUTOS_SEED, skipDuplicates: true });
  return true;
}

// ---------------- parcela sugerida para um contrato novo ----------------
// Price (parcela fixa) a partir de capital, taxa e prazo.
export function parcelaPrice(capital, taxaPct, meses) {
  const i = Number(taxaPct) / 100;
  const n0 = Number(meses);
  if (!capital || !n0) return null;
  if (!i) return r2(capital / n0);
  const f = Math.pow(1 + i, n0);
  return r2((capital * i * f) / (f - 1));
}
