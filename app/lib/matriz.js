// ===================== MATRIZ DE CUSTOS · motor de cálculo =====================
// Reproduz a planilha "Matriz" (aba Negócio) com as correções combinadas com o Igor:
//  · total do funcionário NÃO soma a CONTAGEM e desconta o VT uma vez só;
//  · plano de saúde só na coluna PS de cada funcionário;
//  · operação precificada = pessoal fora dos departamentos DIR e ADM (pelo depto, não pela linha);
//  · razão interna da produção calculada pela tabela Pessoal x Freelancer (ou manual).
// Usado no navegador (cálculo ao vivo) e no servidor. Não depende do banco.

export const DEPTOS = [
  ["DIR", "1. Diretoria"], ["ADM", "2. Administrativo"], ["COR", "3. Corte"], ["SIL", "4. Silk"],
  ["BOR", "5. Bordado"], ["COS", "6. Costura"], ["EXP", "7. Expedição"], ["LOG", "8. Logística"],
];
export const DEPTOS_FORA_OPERACAO = ["DIR", "ADM"];
export const REGIMES = {
  CLT: "CLT",
  DIRETOR: "Diretor (pró-labore)",
  ESTAGIO: "Estágio",
};

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const soma = (l, f) => l.reduce((s, x) => s + n(f(x)), 0);

// ---------- um funcionário (uma linha da aba Pessoal) ----------
export function calcFuncionario(f, par) {
  const F = n(f.salario), G = n(f.bonus);
  const clt = f.regime === "CLT", dir = f.regime === "DIRETOR", est = f.regime === "ESTAGIO";
  const encargos = !est;                                   // estágio não tem INSS/FGTS
  const inssPatronal = encargos ? par.inssPatronal * F : 0; // I = 20% × salário
  const inssFunc = encargos ? par.inssFunc * F : 0;         // J = 7,5% × salário
  const fgts = encargos ? par.fgts * F : 0;                 // K = 8% × salário
  const vt = n(f.vt);                                       // L
  const vtDesc = f.descontaVt ? -par.vtDesconto * F : 0;    // M = −6% × salário
  const liquido = F + vtDesc - inssFunc;                    // H = F + M − J
  const vr = n(f.vr), ps = n(f.ps);                         // N, O
  const ass = n(f.assPct) * F;                              // P = % × salário
  const saldoLivre = n(f.saldoLivre);                       // Q
  const decimo = dir ? (F + G) / 12 : F / 12;               // R = 13º (diretor: salário + bônus)
  const ferias = est ? 0 : F / 12 + F / 36;                 // S = 1/12 + 1/3 de férias
  const aviso = clt ? F / 12 : 0;                           // T
  const multa = clt ? fgts * par.multaFgts : 0;             // U = 40% do FGTS
  const rFerias = n(f.rFerias);                             // V
  const provisoes = decimo + ferias + aviso + multa + rFerias;
  // custo para a empresa = líquido + INSS func (recolhido) + encargos + benefícios + provisões
  // (o desconto de VT já está dentro do líquido — não é descontado de novo)
  const total = G + liquido + inssPatronal + inssFunc + fgts + vt + vr + ps + ass + saldoLivre + provisoes;
  return { F, G, liquido, inssPatronal, inssFunc, fgts, vt, vtDesc, vr, ps, ass, saldoLivre, decimo, ferias, aviso, multa, rFerias, provisoes, total };
}

// ---------- tabela Pessoal x Freelancer ----------
export function calcFreelancer(tab) {
  const linhas = (tab || []).map((m) => {
    const custo = n(m.pessoal) + n(m.freelancer);
    return { ...m, custo, custoPeca: n(m.pecas) ? custo / n(m.pecas) : 0 };
  });
  const tot = { pessoal: soma(linhas, (l) => l.pessoal), freelancer: soma(linhas, (l) => l.freelancer), custo: soma(linhas, (l) => l.custo), pecas: soma(linhas, (l) => l.pecas) };
  tot.custoPeca = tot.pecas ? tot.custo / tot.pecas : 0;
  return { linhas, tot };
}

// ---------- matriz inteira ----------
export function calcularMatriz(d) {
  const par = d.parametros;
  const pr = d.producao;
  const ativos = (d.pessoal || []).filter((p) => p.ativo !== false);
  const pessoas = ativos.map((p) => ({ ...p, c: calcFuncionario(p, par) }));
  const totPessoal = soma(pessoas, (p) => p.c.total);
  const porDepto = Object.fromEntries(DEPTOS.map(([k]) => [k, soma(pessoas.filter((p) => p.depto === k), (p) => p.c.total)]));

  const bloco = (l) => soma((l || []).filter((i) => i.ativo !== false), (i) => i.valor);
  const vidaVegetativa = bloco(d.vidaVegetativa);
  const logistica = bloco(d.logistica);
  const administracao = bloco(d.administracao);
  const sistemas = bloco(d.sistemas);
  const dividas = bloco(d.dividas);

  // CUSTO DA OPERAÇÃO (K38) e CUSTO DO NEGÓCIO (K51)
  const custoOperacao = vidaVegetativa + totPessoal + logistica + administracao + sistemas;
  const custoNegocio = custoOperacao + dividas;
  // OPERAÇÃO PRECIFICADA (E27): pessoal fora de DIR/ADM
  const operacaoPrecificada = soma(pessoas.filter((p) => !DEPTOS_FORA_OPERACAO.includes(p.depto)), (p) => p.c.total);
  const custoAdministrativo = custoNegocio - operacaoPrecificada; // K52

  // PRODUÇÃO
  const fe = calcFreelancer(d.freelancer?.expedicao), fc = calcFreelancer(d.freelancer?.corte);
  const totGeral = fe.tot.custo + fc.tot.custo, totFree = fe.tot.freelancer + fc.tot.freelancer;
  const pctFreelancer = totGeral ? totFree / totGeral : 0;           // L3
  const razaoInterna = pr.razaoInternaAuto ? 1 - pctFreelancer : n(pr.razaoInternaManual);
  const razaoProd = n(pr.custoPeca) * razaoInterna;                   // E29
  const razaoLog = n(pr.razaoLog);                                    // E31
  const custoPecaInterno = razaoProd + razaoLog;

  // METAS E RESULTADO
  const metaFatAnual = n(pr.metaPecas) * n(pr.ticketMedio) * 12;      // M48
  const pecasCobrem = custoPecaInterno ? operacaoPrecificada / custoPecaInterno : 0;
  const balanco = pecasCobrem ? n(pr.metaPecas) / pecasCobrem : 0;    // R48
  const admAnual = custoAdministrativo * 12;                          // S52
  const lucroCenario = metaFatAnual ? (metaFatAnual * n(pr.margemContribuicao) - admAnual) / metaFatAnual : 0; // K55
  const lucroCenarioR = lucroCenario * metaFatAnual;                  // S55
  const lucroRealR = lucroCenarioR + (balanco - 1) * operacaoPrecificada * 12;
  const lucroReal = metaFatAnual ? lucroRealR / metaFatAnual : 0;     // K56
  // BREAKEVEN: meta de peças que zera o lucro real
  const divBe = n(pr.ticketMedio) * n(pr.margemContribuicao) + custoPecaInterno;
  const breakevenPecas = divBe > 0 ? custoNegocio / divBe : 0;
  const metaMensal = metaFatAnual / 12;

  // RESERVA CDB: provisões do pessoal + itens marcados
  const marcados = [...(d.vidaVegetativa || []), ...(d.logistica || []), ...(d.administracao || []), ...(d.sistemas || [])].filter((i) => i.cdb && i.ativo !== false);
  const cdbPessoal = soma(pessoas, (p) => p.c.provisoes);
  const cdb = cdbPessoal + soma(marcados, (i) => i.valor);

  const dias = n(par.diasUteis) || 22;
  return {
    pessoas, porDepto, fe, fc,
    blocos: { vidaVegetativa, pessoal: totPessoal, logistica, administracao, sistemas, dividas },
    custoOperacao, custoOperacaoDia: custoOperacao / dias, custoNegocio, custoNegocioDia: custoNegocio / dias,
    operacaoPrecificada, custoAdministrativo,
    pctFreelancer, razaoInterna, razaoProd, razaoLog, custoPecaInterno,
    metaFatAnual, metaMensal, metaDia: metaMensal / dias, pecasCobrem, balanco,
    lucroCenario, lucroCenarioR, lucroReal, lucroRealR, breakevenPecas,
    cdb, cdbPessoal, cdbItens: marcados, headcount: pessoas.length,
  };
}

// ---------- "Como é calculado" (texto exibido no sistema) ----------
export const FORMULAS = {
  pessoal: [
    ["Líquido", "Salário + desconto de VT − INSS do funcionário"],
    ["INSS patronal", "20% × salário (estágio: não tem)"],
    ["INSS funcionário", "7,5% × salário (estágio: não tem)"],
    ["FGTS", "8% × salário (estágio: não tem)"],
    ["Desconto VT", "−6% × salário, só para quem tem o desconto marcado"],
    ["ASS", "% de assiduidade × salário"],
    ["13º", "salário ÷ 12 (diretor: (salário + bônus) ÷ 12)"],
    ["Férias", "salário ÷ 12 + salário ÷ 36 (1/3 de férias). Estágio: não tem"],
    ["Aviso", "salário ÷ 12 (só CLT)"],
    ["Multa", "40% do FGTS (só CLT)"],
    ["Total", "bônus + líquido + INSS patronal + INSS funcionário + FGTS + VT + VR + PS + ASS + saldo livre + 13º + férias + aviso + multa + R. férias. O desconto de VT entra uma vez só (dentro do líquido)."],
  ],
  painel: [
    ["Custo da operação", "vida vegetativa + pessoal + logística/manutenção + administração + sistemas"],
    ["Custo do negócio", "custo da operação + dívidas"],
    ["Operação precificada", "custo do pessoal fora dos departamentos DIR e ADM"],
    ["Custo administrativo", "custo do negócio − operação precificada"],
    ["Diário", "mensal ÷ dias úteis"],
    ["Razão interna", "1 − % freelancer (tabela Pessoal x Freelancer), ou valor manual"],
    ["Razão custo prod.", "custo de produção por peça × razão interna"],
    ["Meta de faturamento (ano)", "meta de peças × ticket médio × 12"],
    ["Balanço meta x custo op.", "meta de peças ÷ (operação precificada ÷ (razão prod. + razão log.))"],
    ["Lucro no cenário", "(faturamento anual × margem de contribuição − custo administrativo × 12) ÷ faturamento anual"],
    ["Lucro real", "(lucro no cenário em R$ + (balanço − 1) × operação precificada × 12) ÷ faturamento anual"],
    ["Breakeven", "meta de peças que zera o lucro real = custo do negócio ÷ (ticket × margem + razão prod. + razão log.)"],
    ["Reserva CDB", "provisões do pessoal (13º, férias, aviso, multa, R. férias) + itens marcados como CDB"],
  ],
};
