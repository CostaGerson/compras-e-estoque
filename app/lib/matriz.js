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
  ["NORT", "9. NORT (loja)"],   // folha da NORT, bancada pela Meridian — contas NORT próprias
];
export const DEPTOS_FORA_OPERACAO = ["DIR", "ADM", "NORT"];
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
  // v224 — na oficial, o % de freelancer é a meta da página Metas (Gestão); sem ela, a tabela Pessoal x Freelancer
  const mgF = d.metasGestao?.pctFreelancer;
  const pctFreelancer = mgF != null ? n(mgF) : totGeral ? totFree / totGeral : 0;           // L3
  const razaoInterna = mgF != null || pr.razaoInternaAuto ? 1 - pctFreelancer : n(pr.razaoInternaManual);
  // v245 — razão interna manual (ex.: simulação da Capacidade): o % de freelancer exibido é o complemento dela, não o da tabela
  const pctFreelancerUsado = mgF != null || pr.razaoInternaAuto ? pctFreelancer : 1 - razaoInterna;
  const razaoProd = n(pr.custoPeca) * razaoInterna;                   // E29
  const razaoLog = n(pr.razaoLog);                                    // E31
  const custoPecaInterno = razaoProd + razaoLog;

  // METAS E RESULTADO
  // v215 — na oficial, o ano é a meta do ano da Gestão (METAS) e o mês é a meta do mês da análise
  const mg = d.metasGestao || null;
  const metaFatAnual = mg?.fatAno != null ? n(mg.fatAno) : n(pr.metaPecas) * n(pr.ticketMedio) * 12;      // M48
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
  const metaMensal = mg?.fatMes != null ? n(mg.fatMes) : metaFatAnual / 12;

  // v239 — FECHAMENTO DO ANO (oficial com metas da Gestão): meses fechados = lucro realizado da DRE;
  //        meses em aberto = simulação da Matriz com a meta do mês (faturamento × margem − custo adm + ganho/perda de escala)
  // v240 — cenário: usa o realizado da oficial (d.fechamento) e simula os meses em aberto com a própria meta (peças × ticket)
  // v247 — cenário: "peças faturadas (mês)" = MÉDIA DO ANO. Meses em aberto se ajustam para que (realizado + abertos) ÷ 12 = essa média
  //        (simulação da Capacidade: mantém a distribuição de cada mês, escalada; demais cenários: divide igual entre os abertos)
  const fechCen = (() => {
    const f = d.fechamento;
    if (!f?.realizado && !f?.porMes) return null;
    const fe = f.fechados || [], tk0 = n(pr.ticketMedio);
    const pcsF = (f.pcsMeses || []).map((p, i) => (fe[i] ? (p != null ? n(p) : tk0 ? n(f.fatMeses?.[i]) / tk0 : 0) : null));
    const fechSum = pcsF.reduce((t, x) => t + (x || 0), 0), nAb = fe.filter((x, i) => !x && i < 12).length || Array(12).fill(0).filter((_, i) => !fe[i]).length;
    const resto = Math.max(0, n(pr.metaPecas) * 12 - fechSum);
    const baseAb = f.porMes ? (f.pcsMeses || []).reduce((t, p, i) => t + (fe[i] ? 0 : n(p)), 0) : 0;
    const pcsMeses = Array.from({ length: 12 }, (_, i) => (fe[i] ? pcsF[i] : f.porMes && baseAb ? n(f.pcsMeses[i]) * resto / baseAb : nAb ? resto / nAb : 0));
    const fatMeses = pcsMeses.map((p, i) => (fe[i] ? n(f.fatMeses?.[i]) : p * tk0));
    return { ...f, pcsMeses, fatMeses };
  })();
  const fch = mg?.fatMeses && Array.isArray(mg.realizado) ? mg : fechCen;
  let projecao = null;
  if (fch) {
    const tk = n(pr.ticketMedio), mc = n(pr.margemContribuicao);
    const simMes = (f, p) => {
      const pc = p != null ? n(p) : tk ? n(f) / tk : 0;
      const cen = n(f) * mc - custoAdministrativo;
      return { cen, real: cen + (pecasCobrem ? pc / pecasCobrem - 1 : 0) * operacaoPrecificada };
    };
    const meses = fch.fatMeses.map((f, i) => {
      const r = fch.realizado[i];
      const pcs = fch.pcsMeses?.[i] != null ? n(fch.pcsMeses[i]) : tk ? n(f) / tk : 0;
      if (r) return { mes: i + 1, tipo: "REALIZADO", fat: n(f), pcs, cen: n(r.lucro), real: n(r.lucro), res: n(r.resultado ?? r.lucro) };
      const s = simMes(f, fch.pcsMeses?.[i]);
      return { mes: i + 1, tipo: fch.fechados?.[i] ? "FECHADO_SEM_DRE" : "SIMULADO", fat: n(f), pcs, ...s, res: s.real };   // simulado: sem investimento/NORT previstos
    });
    const somaK = (k) => meses.reduce((a, x) => a + x[k], 0);
    const atual = meses[(n(fch.mes) || 1) - 1] || meses[0];
    // v244 — cenário (sem metas da Gestão): coluna MÊS = média mensal do ano (ano ÷ 12); oficial: o mês da análise
    const media = true;   // v246: sempre média mensal do ano (ano ÷ 12) — oficial e cenários coerentes
    projecao = { porMes: !!fch.porMes, media, meses, cenAno: somaK("cen"), realAno: somaK("real"), resAno: somaK("res"), fatAno: somaK("fat"), pcsAno: somaK("pcs"),
      cenMes: media ? somaK("cen") / 12 : atual.cen, realMes: media ? somaK("real") / 12 : atual.real, resMes: media ? somaK("res") / 12 : atual.res,
      nReal: meses.filter((x) => x.tipo === "REALIZADO").length, nSim: meses.filter((x) => x.tipo !== "REALIZADO").length,
      semDre: meses.filter((x) => x.tipo === "FECHADO_SEM_DRE").map((x) => x.mes) };
  }

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
    pctFreelancer: pctFreelancerUsado, pctFreelancerTabela: pctFreelancer, razaoInterna, razaoProd, razaoLog, custoPecaInterno,
    metaFatAnual, metaMensal, metaDia: metaMensal / dias, pecasCobrem, balanco,
    lucroCenario, lucroCenarioR, lucroReal, lucroRealR, breakevenPecas, projecao,
    // v239 — com projeção: o ano = realizado + simulado (o resultado "puro" da Matriz continua acima)
    anoCenarioR: projecao ? projecao.cenAno : lucroCenarioR, anoRealR: projecao ? projecao.realAno : lucroRealR,
    anoCenario: projecao && (mg ? metaFatAnual : projecao.fatAno) ? projecao.cenAno / (mg ? metaFatAnual : projecao.fatAno) : lucroCenario,
    anoReal: projecao && (mg ? metaFatAnual : projecao.fatAno) ? projecao.realAno / (mg ? metaFatAnual : projecao.fatAno) : lucroReal,
    mesFat: projecao?.media ? projecao.fatAno / 12 : metaMensal, mesPcs: projecao?.media ? projecao.pcsAno / 12 : null, pcsAnoProj: projecao ? projecao.pcsAno : null,
    anoResultadoR: projecao ? projecao.resAno : null, mesResultadoR: projecao ? projecao.resMes : null, fatAnoProj: projecao ? (mg ? metaFatAnual : projecao.fatAno) : metaFatAnual,
    mesCenarioR: projecao ? projecao.cenMes : lucroCenarioR / 12, mesRealR: projecao ? projecao.realMes : lucroRealR / 12,
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
    ["Adiantamento", "quem tem a caixa marcada recebe 20% do líquido no dia 20; o restante vai no salário (5º dia útil). Não muda o custo, só a data de pagamento."],
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
