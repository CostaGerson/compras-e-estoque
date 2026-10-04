// DRE gerencial do mês (no formato da planilha do Igor) e painel de previsão.
// Cada grupo é a soma de várias contas-caixa; o de–para é editável e tem um padrão por código.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// ---- grupos da operação (na ordem da planilha) ----
export const GRUPOS_OPERACAO = [
  { k: "RECEITA", n: "01. Receita", sinal: 1, ajuda: "Vendas, serviço de facção, antecipação de duplicatas e venda de patrimônio — a devolução de venda abate aqui" },
  { k: "CMV", n: "02. CMV", sinal: -1, ajuda: "Tecido, aviamento, insumos, pessoal e freelancers de produção, facção, frete — o que varia com a produção" },
  { k: "DESPESA_ADM", n: "04. Despesa adm e vegetativa", sinal: -1, ajuda: "Estrutura que roda independente de vender: vida vegetativa, pessoal adm, pró-labore, manutenção, designer" },
  { k: "IMPOSTOS_JUROS", n: "06. Impostos e juros", sinal: -1, ajuda: "Imposto, taxas, juros e despesa financeira — o principal da dívida não entra aqui" },
  { k: "INVESTIMENTO", n: "08. Investimento", sinal: -1, ajuda: "Reforma, maquinário, patrimônio, planta e reserva de capital" },
];
// ---- recursos externos (não são operação: entram e saem do caixa) ----
export const GRUPOS_EXTERNOS = [
  { k: "EXT_BANCARIO", n: "Empréstimo bancário" },
  { k: "EXT_SOCIOS", n: "Empréstimo sócios" },
  { k: "EXT_FACTORING", n: "Factoring" },
  { k: "EXT_CAPITAL", n: "Capital social" },
  { k: "EXT_MUTUO", n: "Mútuo" },
  { k: "EXT_SEM_JUROS", n: "Investimento externo sem juros" },
];
export const GRUPO_FORA = { k: "FORA", n: "Fora da DRE", ajuda: "Transferência entre contas e conciliação — não entra em lugar nenhum" };

export const TODOS_GRUPOS = [...GRUPOS_OPERACAO, ...GRUPOS_EXTERNOS, GRUPO_FORA];
export const nomeGrupo = (k) => (TODOS_GRUPOS.find((g) => g.k === k) || {}).n || k;

// De–para oficial: é o mesmo que o sistema antigo da Meridian usa, conta por conta.
// Quem não está aqui cai no palpite por código e aparece marcada para conferência no de–para.
export const MAPA_OFICIAL = {
  // 01. RECEITA
  1111000: "RECEITA", 1112000: "RECEITA", 1113000: "RECEITA", 1114000: "RECEITA", 1115000: "RECEITA",
  1116000: "RECEITA", 1118000: "RECEITA", 1121000: "RECEITA", 1122000: "RECEITA", 1150000: "RECEITA",
  1210000: "RECEITA", 1220000: "RECEITA",
  2141000: "RECEITA",            // devolução de venda abate a receita
  // 02. CMV
  2111100: "CMV", 2111210: "CMV", 2111220: "CMV", 2111310: "CMV", 2111320: "CMV", 2111330: "CMV",
  2111340: "CMV", 2111400: "CMV", 2111500: "CMV",
  2112100: "CMV", 2112200: "CMV", 2112300: "CMV", 2112400: "CMV", 2112500: "CMV", 2112600: "CMV", 2112700: "CMV",
  2113100: "CMV", 2113200: "CMV", 2113310: "CMV", 2113320: "CMV", 2113330: "CMV", 2113400: "CMV",
  2113500: "CMV", 2113600: "CMV", 2113700: "CMV",
  2114100: "CMV", 2114200: "CMV", 2114300: "CMV", 2114400: "CMV", 2114600: "CMV", 2114700: "CMV",
  // facção por tipo de peça e DTF — tudo CMV
  2114610: "CMV", 2114620: "CMV", 2114630: "CMV", 2114640: "CMV", 2114650: "CMV",
  2114660: "CMV", 2114670: "CMV", 2114680: "CMV", 2114690: "CMV", 2114930: "CMV",
  2114800: "CMV", 2114910: "CMV", 2114920: "CMV",
  2117100: "CMV", 2117200: "CMV", 2117300: "CMV", 2117400: "CMV", 2117510: "CMV", 2117520: "CMV",
  2117530: "CMV", 2117600: "CMV", 2118000: "CMV", 2210000: "CMV",
  // 04. DESPESA ADM E VEGETATIVA
  2114500: "DESPESA_ADM",        // designer
  2116100: "DESPESA_ADM", 2116200: "DESPESA_ADM", 2116300: "DESPESA_ADM",
  2121000: "DESPESA_ADM", 2122000: "DESPESA_ADM", 2123200: "DESPESA_ADM", 2123300: "DESPESA_ADM",
  2124000: "DESPESA_ADM", 2125000: "DESPESA_ADM", 2126000: "DESPESA_ADM", 2127000: "DESPESA_ADM",
  2128100: "DESPESA_ADM", 2128200: "DESPESA_ADM", 2128300: "DESPESA_ADM",
  2220000: "DESPESA_ADM", 2240000: "DESPESA_ADM",
  // 06. IMPOSTOS E JUROS
  2115100: "IMPOSTOS_JUROS", 2132000: "IMPOSTOS_JUROS", 2134000: "IMPOSTOS_JUROS",
  2135000: "IMPOSTOS_JUROS", 2230000: "IMPOSTOS_JUROS",
  // 08. INVESTIMENTO
  2123100: "INVESTIMENTO",       // reforma
  2133100: "INVESTIMENTO", 2133200: "INVESTIMENTO", 2133300: "INVESTIMENTO", 2133400: "INVESTIMENTO",
  // RECURSOS EXTERNOS — entrada e pagamento do principal
  1131000: "EXT_BANCARIO", 2131100: "EXT_BANCARIO",
  1132000: "EXT_SOCIOS", 2131200: "EXT_SOCIOS",
  1133000: "EXT_FACTORING", 2131300: "EXT_FACTORING",
  1134000: "EXT_CAPITAL", 2131400: "EXT_CAPITAL",
  1135000: "EXT_MUTUO", 2131500: "EXT_MUTUO",
  1117000: "EXT_SEM_JUROS", 1140000: "EXT_SEM_JUROS",
  // FORA DA DRE
  3000000: "FORA",
  2111200: "FORA", 2111300: "FORA", 2113000: "FORA", 2123000: "FORA",   // contas antigas, inativas
};

// Grupo de uma conta: o de–para oficial manda; sem ele, um palpite pelo começo do código.
export function grupoPadrao(codigo, nome = "") {
  const c = String(codigo || "").trim();
  if (MAPA_OFICIAL[c]) return MAPA_OFICIAL[c];
  if (c.startsWith("1")) return "RECEITA";
  if (c.startsWith("2")) return "DESPESA_ADM";
  return "FORA";
}
export const temMapaOficial = (codigo) => !!MAPA_OFICIAL[String(codigo || "").trim()];

export async function mapaDeContas() {
  const [contas, mapa] = await Promise.all([
    prisma.finConta.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true, ativo: true } }),
    prisma.finDreMapa.findMany(),
  ]);
  const porId = Object.fromEntries(mapa.map((m) => [m.contaId, m.grupo]));
  return contas.map((c) => ({
    ...c,
    grupo: porId[c.id] || grupoPadrao(c.codigo, c.nome),
    manual: !!porId[c.id],
    // conta que não está no de–para oficial nem foi ajustada à mão: pede conferência
    conferir: !porId[c.id] && !temMapaOficial(c.codigo),
  }));
}

// ---- DRE do mês ----
export async function dre(competencia) {
  const [contas, lanc, painel] = await Promise.all([
    mapaDeContas(),
    prisma.finLancamento.findMany({
      where: { competencia, desmembrado: false, substituido: false },
      select: { contaId: true, valor: true },
    }),
    prisma.finMesPainel.findUnique({ where: { competencia } }),
  ]);
  const grupoDe = Object.fromEntries(contas.map((c) => [c.id, c.grupo]));
  const nomeDe = Object.fromEntries(contas.map((c) => [c.id, `${c.codigo} · ${c.nome}`]));

  const porGrupo = {}, porConta = {};
  let semConta = 0;
  for (const l of lanc) {
    const v = Number(l.valor);
    if (!l.contaId) { semConta += v; continue; }
    const g = grupoDe[l.contaId] || "FORA";
    porGrupo[g] = r2((porGrupo[g] || 0) + v);
    (porConta[g] = porConta[g] || {});
    porConta[g][l.contaId] = r2((porConta[g][l.contaId] || 0) + v);
  }
  const detalhe = (g) => Object.entries(porConta[g] || {})
    .map(([id, v]) => ({ contaId: Number(id), nome: nomeDe[id] || "—", valor: r2(v) }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

  const receita = r2(porGrupo.RECEITA || 0);
  const cmv = r2(porGrupo.CMV || 0);
  const margem = r2(receita + cmv);
  const adm = r2(porGrupo.DESPESA_ADM || 0);
  const ebitda = r2(margem + adm);
  const impostos = r2(porGrupo.IMPOSTOS_JUROS || 0);
  const lucro = r2(ebitda + impostos);
  const investimento = r2(porGrupo.INVESTIMENTO || 0);
  const resultado = r2(lucro + investimento);
  const saldoInicial = painel?.saldoInicial != null ? Number(painel.saldoInicial) : 0;
  const saldoOperacao = r2(saldoInicial + resultado);

  // recursos externos: entrada = positivos, pagamento = negativos
  const externos = GRUPOS_EXTERNOS.map((g) => {
    const itens = detalhe(g.k);
    const entrada = r2(itens.filter((i) => i.valor > 0).reduce((s, i) => s + i.valor, 0));
    const pagamento = r2(-itens.filter((i) => i.valor < 0).reduce((s, i) => s + i.valor, 0));
    return { ...g, entrada, pagamento, itens };
  });
  const entradaExterna = r2(externos.reduce((s, e) => s + e.entrada, 0));
  const pagamentoExterno = r2(externos.reduce((s, e) => s + e.pagamento, 0));
  const resultadoExterno = r2(entradaExterna - pagamentoExterno);

  return {
    competencia, saldoInicial,
    operacao: {
      receita, cmv, margem, adm, ebitda, impostos, lucro, investimento, resultado, saldoOperacao,
      margemPct: receita ? margem / receita : null,
      ebitdaPct: receita ? ebitda / receita : null,
      lucroPct: receita ? lucro / receita : null,
    },
    detalhes: Object.fromEntries([...GRUPOS_OPERACAO, GRUPO_FORA].map((g) => [g.k, detalhe(g.k)])),
    externos, entradaExterna, pagamentoExterno, resultadoExterno,
    saldoFinal: r2(saldoOperacao + resultadoExterno),
    fora: r2(porGrupo.FORA || 0),
    semConta: r2(semConta),
    lancamentos: lanc.length,
  };
}

// ---- painel de previsão: o que vem das contas + o que é digitado ----
const PAINEL_VAZIO = {
  bancos: [],
  // abertura das contas atrasadas (o total vem das contas a pagar)
  atrasadoImpostos: null, atrasadoMateriaPrima: null, atrasadoPrestadores: null, atrasadoOutros: null, prioridadeMes: null,
  // contas a receber: o que o sistema não sabe
  receberPrevisao: null, receberLitigio: null, receberQuitacaoProvavel: null, receberForaMes: null,
  receberAtrasadasManual: null, atrasoProvavel: null,
  // carteira e caixa
  pedidosEntregar: null, pedidosAndamento: null, recebimentoMes: null, antecipacaoDisp: null,
  // cenários (sugeridos pelo sistema, sobrescrevíveis)
  cenarioGeral: null, cenarioMes: null, cobrindoCheque: null, semCobrir: null,
  antecipandoCobrindo: null, antecipandoSemCobrir: null,
  infoRelevante: "",
};
// Campos manuais do painel, na ordem e nos blocos em que aparecem na tela.
export const CAMPOS_PAINEL = [
  { bloco: "Contas atrasadas", ajuda: "O total vem do contas a pagar; aqui você abre por natureza.", campos: [
    ["atrasadoImpostos", "Impostos"], ["atrasadoMateriaPrima", "Matéria-prima"],
    ["atrasadoPrestadores", "Prestadores"], ["atrasadoOutros", "Outros"],
    ["prioridadeMes", "Prioridade do mês"],
  ] },
  { bloco: "Contas a receber", ajuda: "Posição geral, mês vigente e atrasadas vêm do contas a receber.", campos: [
    ["receberPrevisao", "Previsão (ainda sem título)"], ["receberLitigio", "Em litígio"],
    ["receberQuitacaoProvavel", "Quitação provável"], ["receberForaMes", "Fora do mês"],
    ["atrasoProvavel", "Atraso provável"],
  ] },
  { bloco: "Carteira e caixa", campos: [
    ["pedidosEntregar", "Pedidos a entregar"], ["pedidosAndamento", "Pedidos em andamento"],
    ["recebimentoMes", "Recebimento no mês"], ["antecipacaoDisp", "Antecipação disponível"],
  ] },
  { bloco: "Cenários", ajuda: "O sistema sugere; o valor que você digitar manda.", campos: [
    ["cenarioGeral", "Cenário geral"], ["cenarioMes", "Cenário do mês"],
    ["cobrindoCheque", "Cobrindo o cheque"], ["semCobrir", "Sem cobrir"],
    ["antecipandoCobrindo", "Antecipando e cobrindo"], ["antecipandoSemCobrir", "Antecipando sem cobrir"],
  ] },
];

export async function painel(competencia, hoje = new Date()) {
  const [p, pagar, receber] = await Promise.all([
    prisma.finMesPainel.findUnique({ where: { competencia } }),
    prisma.finTitulo.findMany({ where: { tipo: "PAGAR", status: "ABERTO" }, select: { valor: true, vencimento: true, competencia: true } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "ABERTO" }, select: { valor: true, vencimento: true, competencia: true } }),
  ]);
  const soma = (l) => r2(l.reduce((s, t) => s + Number(t.valor), 0));
  const vencido = (t) => new Date(t.vencimento) < hoje;

  const auto = {
    contasAtrasadas: soma(pagar.filter(vencido)),
    contasPagarMes: soma(pagar.filter((t) => t.competencia === competencia)),
    contasPagarTotal: soma(pagar),
    receberPosicaoGeral: soma(receber),
    receberMesVigente: soma(receber.filter((t) => t.competencia === competencia)),
    receberAtrasadas: soma(receber.filter(vencido)),
  };

  const dados = { ...PAINEL_VAZIO, ...((p?.dados) || {}) };

  // Cada banco: saldo (pode ser negativo = cheque usado), limite contratado e limite já tomado.
  // Disponível = o que sobra de saldo positivo + o que ainda dá para tomar de limite.
  const bancos = (dados.bancos || []).map((b, i) => {
    const saldo = r2(b.saldo), limite = r2(b.limite);
    const tomado = b.tomado == null ? r2(Math.max(0, -saldo)) : r2(b.tomado);
    return {
      id: b.id ?? i + 1, nome: String(b.nome || "").toUpperCase(),
      saldo, limite, tomado, disponivel: r2(Math.max(0, saldo) + Math.max(0, limite - tomado)),
    };
  });
  const saldoGeral = r2(bancos.reduce((s, b) => s + b.saldo, 0));
  const limiteTotal = r2(bancos.reduce((s, b) => s + b.limite, 0));
  const limiteTomado = r2(bancos.reduce((s, b) => s + b.tomado, 0));
  const disponivelTotal = r2(bancos.reduce((s, b) => s + b.disponivel, 0));

  // Cenários: o sistema sugere a conta, o usuário pode sobrescrever.
  const atrasadoReceber = Number(dados.receberAtrasadasManual ?? auto.receberAtrasadas) || 0;
  const sug = {
    cenarioGeral: r2(auto.receberPosicaoGeral - auto.contasPagarTotal + saldoGeral),
    cenarioMes: r2(auto.receberMesVigente + disponivelTotal - auto.contasPagarMes),
  };

  // projeção simples do mês: o que tenho + o que entra − o que sai
  const entra = (dados.recebimentoMes ?? auto.receberMesVigente) || 0;
  const projecao = r2(disponivelTotal + Number(entra) - auto.contasPagarMes);

  return {
    competencia,
    saldoInicial: p?.saldoInicial != null ? Number(p.saldoInicial) : null,
    auto,
    manual: dados,
    bancos,
    caixa: { saldoGeral, limiteTotal, limiteTomado, disponivelTotal },
    sugestao: sug,
    atrasadoReceber,
    projecao,
    atualizadoPorNome: p?.atualizadoPorNome || null,
    atualizadoEm: p?.updatedAt || null,
  };
}

export async function salvarPainel(competencia, { saldoInicial, dados, quem }) {
  const atual = await prisma.finMesPainel.findUnique({ where: { competencia } });
  const novo = { ...((atual?.dados) || PAINEL_VAZIO), ...(dados || {}) };
  await prisma.finMesPainel.upsert({
    where: { competencia },
    create: { competencia, saldoInicial: saldoInicial ?? null, dados: novo, atualizadoPorNome: quem },
    update: { ...(saldoInicial !== undefined ? { saldoInicial } : {}), dados: novo, atualizadoPorNome: quem },
  });
  return painel(competencia);
}

export async function salvarMapa(contaId, grupo) {
  if (!TODOS_GRUPOS.some((g) => g.k === grupo)) return { ok: false, erro: "Grupo inválido." };
  await prisma.finDreMapa.upsert({
    where: { contaId: Number(contaId) },
    create: { contaId: Number(contaId), grupo },
    update: { grupo },
  });
  return { ok: true };
}
