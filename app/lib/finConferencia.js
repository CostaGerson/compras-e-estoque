// v211 — Conferência de integração: o mesmo número em telas diferentes, lado a lado.
// Cada verificação diz de onde vem cada valor (tela → fonte) e se batem (tolerância R$ 1,00).
import { prisma } from "@/lib/prisma";
import { calcularMatriz } from "@/lib/matriz";
import { dreAno } from "@/lib/finDreAno";
import { panorama } from "@/lib/alavancagem";
import { previaMatriz } from "@/lib/alavancagemMatriz";
import { montarMatrizRec } from "@/lib/finMatrizRecDb";
import { IMPOSTOS_VENDAS } from "@/lib/finImpostosVendas";
import { ehGuia } from "@/lib/finGuias";
import { painel as painelMes } from "@/lib/finDre";
import { somaMes, mesAtual } from "@/lib/finTitulos";

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const num = (v) => (v == null ? null : Number(v));
const TOL = 1;
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const NAO_VENDA = /REMESSA|DEVOLU|RETORNO/;

// status de um conjunto de valores que deveriam ser iguais (nulos = sem dado, não comparam)
function comparar(valores) {
  const v = valores.filter((x) => x != null);
  if (v.length < 2) return "SEM_DADO";
  return Math.max(...v) - Math.min(...v) <= TOL ? "OK" : "DIVERGE";
}
const chk = (grupo, nome, fontes, obs, status) => ({ grupo, nome, fontes, obs: obs || null, status: status || comparar(fontes.map((f) => f.valor)) });

export async function conferencia(ano = new Date().getFullYear(), hoje = new Date()) {
  const a = Number(ano);
  const pref = `${a}-`;
  const de = new Date(Date.UTC(a, 0, 1)), ate = new Date(Date.UTC(a + 1, 0, 1));
  const [kAno, kMes, kRec, kVc, rec, nfs, fisc, matrizOf, dre] = await Promise.all([
    prisma.kpiAno.findUnique({ where: { ano: a } }),
    prisma.kpiMes.findMany({ where: { ano: a } }),
    prisma.kpiReceita.findMany({ where: { ano: a } }),
    prisma.kpiVendaCliente.groupBy({ by: ["mes", "kpi"], where: { ano: a }, _sum: { valor: true, pecas: true } }),
    prisma.finRecebimento.groupBy({ by: ["competencia", "bloco"], where: { competencia: { startsWith: pref } }, _sum: { valor: true } }),
    prisma.finNfSaida.findMany({ where: { emissao: { gte: de, lt: ate } }, select: { emissao: true, valor: true, natureza: true } }),
    prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", empresa: "MERIDIAN", competencia: { startsWith: pref } }, select: { competencia: true, valor: true, natureza: true, acao: true } }),
    prisma.finMatriz.findFirst({ where: { oficial: true } }),
    dreAno(a, hoje),
  ]);
  const checks = [];
  const tabelas = [];

  // ---------------- 1. METAS: botão METAS (Gestão) → campo META do KPI → Matriz ----------------
  // v212: a Matriz oficial puxa as metas do botão METAS (mês da análise); simulação de meta é em cenário
  let M = null, pr = {};
  if (matrizOf?.dados) {
    try {
      const { dadosComMetas } = await import("@/lib/matrizMetas");
      const dd = await dadosComMetas(matrizOf.dados, hoje);
      M = calcularMatriz(dd); pr = dd.producao || {};
    } catch { M = null; }
  }
  const metaFatGestao = num(kAno?.metaFaturamento);
  const metaMesFat = (m) => { const x = kMes.find((k) => k.mes === m); return x?.metaFaturamentoValor != null ? Number(x.metaFaturamentoValor) : metaFatGestao != null ? metaFatGestao / 12 : null; };
  const metaMesPcs = (m) => { const x = kMes.find((k) => k.mes === m); const an = num(kAno?.metaPecasFaturadas); return x?.metaFaturamentoPecas != null ? Number(x.metaFaturamentoPecas) : an != null ? an / 12 : null; };
  const somaMetasMes = metaFatGestao != null || kMes.some((k) => k.metaFaturamentoValor != null) ? r2([...Array(12)].reduce((s, _, i) => s + (metaMesFat(i + 1) || 0), 0)) : null;
  checks.push(chk("Metas", "Meta de faturamento: METAS do ano × soma das metas dos meses (KPI)", [
    { tela: "Gestão › METAS", fonte: "meta de faturamento do ano", valor: metaFatGestao },
    { tela: "Gestão › KPI (campo META)", fonte: "Σ meta de cada mês (mês sem meta própria = ano ÷ 12)", valor: somaMetasMes },
  ]));
  const mesHoje = hoje.getFullYear() === a ? hoje.getMonth() + 1 : 12;
  checks.push(chk("Metas", `Meta de faturamento de ${MESES[mesHoje - 1]}/${a}`, [
    { tela: "Gestão › KPI (campo META)", fonte: "meta do mês", valor: metaMesFat(mesHoje) != null ? r2(metaMesFat(mesHoje)) : null },
    { tela: "Matriz de custos (meta do mês)", fonte: "puxada de METAS", valor: M ? r2(M.metaMensal) : null },
  ]));
  checks.push(chk("Metas", `Meta de peças faturadas de ${MESES[mesHoje - 1]}/${a}`, [
    { tela: "Gestão › KPI (campo META)", fonte: "meta de peças do mês", un: "pc", valor: metaMesPcs(mesHoje) != null ? Math.round(metaMesPcs(mesHoje)) : null },
    { tela: "Matriz de custos (Produção)", fonte: "puxada de METAS", un: "pc", valor: pr.metaPecas != null ? Number(pr.metaPecas) : null },
  ], "Quantidade de peças."));
  checks.push(chk("Metas", "Margem de contribuição", [
    { tela: "Gestão › METAS", fonte: "margem (%)", valor: kAno?.metaMargem != null ? r2(Number(kAno.metaMargem) * 100) : null },
    { tela: "Matriz de custos (Produção)", fonte: "margem (%)", valor: pr.margemContribuicao != null ? r2(Number(pr.margemContribuicao) * 100) : null },
  ], "Em %. Sem margem em METAS, a Matriz usa a dela."));

  // ---------------- 2. RECEITA por mês ----------------
  const recBloco = (comp, blocos) => r2(rec.filter((x) => x.competencia === comp && blocos.includes(x.bloco)).reduce((s, x) => s + Number(x._sum.valor || 0), 0));
  const temRec = (comp) => rec.some((x) => x.competencia === comp);
  const linhasRec = [], linhasFat = [], linhasVen = [];
  for (let m = 1; m <= 12; m++) {
    const comp = `${a}-${String(m).padStart(2, "0")}`;
    const kr = kRec.filter((x) => x.mes === m);
    const kpiRec = kr.length ? r2(kr.reduce((s, x) => s + Number(x.valor), 0)) : null;
    const recebidos = temRec(comp) ? recBloco(comp, ["CREDITO", "BOLETO"]) : null;
    const confirmar = temRec(comp) ? recBloco(comp, ["CONFIRMAR"]) : null;
    const dm = dre.meses[m - 1];
    const dreRec = dm?.lancado ? dm.receita : null;
    linhasRec.push({ mes: MESES[m - 1], valores: [kpiRec, dreRec, recebidos, confirmar], status: comparar([kpiRec, dreRec]) });

    const km = kMes.find((x) => x.mes === m);
    const kpiFat = num(km?.faturamentoValor);
    const nfMes = nfs.filter((n) => n.emissao.getUTCMonth() + 1 === m);
    const nfVenda = nfMes.length ? r2(nfMes.filter((n) => !NAO_VENDA.test(n.natureza || "")).reduce((s, n) => s + Number(n.valor), 0)) : null;
    const fMes = fisc.filter((n) => n.competencia === comp);
    const fiscVenda = fMes.length ? r2(fMes.filter((n) => !NAO_VENDA.test(String(n.natureza || "").toUpperCase())).reduce((s, n) => s + Number(n.valor), 0)) : null;
    const stF = comparar([kpiFat, nfVenda, fiscVenda]);   // v212: faturamento é manual por enquanto — NF só como referência
    linhasFat.push({ mes: MESES[m - 1], valores: [kpiFat, nfVenda, fiscVenda, km?.pecasFaturadas ?? null], status: stF === "DIVERGE" ? "INFO" : stF });

    const vv = kVc.find((x) => x.mes === m && x.kpi === "vendasValor"), vp = kVc.find((x) => x.mes === m && x.kpi === "vendasPecas");
    const vendR = num(km?.vendasValor), vendRCli = vv ? r2(vv._sum.valor) : null;
    const vendP = km?.vendasPecas ?? null, vendPCli = vp ? Number(vp._sum.pecas || 0) : null;
    linhasVen.push({ mes: MESES[m - 1], valores: [vendR, vendRCli, vendP, vendPCli], status: comparar([vendR, vendRCli]) === "DIVERGE" || comparar([vendP, vendPCli]) === "DIVERGE" ? "DIVERGE" : comparar([vendR, vendRCli]) === "OK" || comparar([vendP, vendPCli]) === "OK" ? "OK" : "SEM_DADO" });
  }
  tabelas.push({ grupo: "Receita", titulo: "Receita realizada do mês (o KPI passa a usar a DRE)",
    colunas: ["Gestão › KPI (preenchido à mão)", "DRE / Análise financeira (grupo Receita)", "Recebimentos (créditos + boletos) — referência", "Recebimentos › A confirmar — referência"],
    fontes: ["KpiReceita — o que está lançado hoje", "FinLancamento do extrato, contas do grupo RECEITA — agora é o realizado do KPI", "FinRecebimento CREDITO+BOLETO (base dos impostos e do ranking)", "FinRecebimento CONFIRMAR (sócios, NORT, antecipação)"],
    comparadas: [0, 1], linhas: linhasRec });
  tabelas.push({ grupo: "Faturamento", titulo: "Faturamento do mês (manual até o sistema emitir NF — NFs só como referência)",
    colunas: ["Gestão (KPI faturamento)", "NFs de saída (Contabilidade · ranking)", "NFs de saída (Fiscal)", "Peças faturadas (KPI)"],
    fontes: ["KpiMes.faturamentoValor (digitado/importado)", "FinNfSaida por emissão, sem remessa/devolução/retorno", "FiscalNota SAÍDA MERIDIAN, sem remessa/devolução/retorno", "KpiMes.pecasFaturadas (não compara)"],
    comparadas: [0, 1, 2], linhas: linhasFat });
  tabelas.push({ grupo: "Vendas", titulo: "Vendas do mês (manual até o lançamento de pedidos) × ranking de clientes",
    colunas: ["Gestão (KPI vendas R$)", "Ranking de clientes (vendas R$)", "Gestão (KPI vendas peças)", "Ranking de clientes (peças)"],
    fontes: ["KpiMes.vendasValor", "Σ KpiVendaCliente vendasValor", "KpiMes.vendasPecas", "Σ KpiVendaCliente vendasPecas"],
    comparadas: [[0, 1], [2, 3]], linhas: linhasVen });

  // totais do ano
  const soma = (l, i) => { const v = l.map((x) => x.valores[i]).filter((x) => x != null); return v.length ? r2(v.reduce((s, x) => s + x, 0)) : null; };
  checks.push(chk("Receita", `Receita acumulada ${a}`, [
    { tela: "Gestão › KPI (preenchido)", fonte: "Σ KpiReceita", valor: soma(linhasRec, 0) },
    { tela: "Análise financeira (Indicadores do ano)", fonte: "Σ DRE Receita", valor: dre.totais.meses ? dre.totais.receita : null },
  ], "Só soma os meses que têm dado em cada fonte — veja a tabela mês a mês."));

  // ---------------- 3. IMPOSTOS SOBRE VENDAS ----------------
  const recsImp = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: Object.keys(IMPOSTOS_VENDAS) } } });
  const titsImp = recsImp.length ? await prisma.finTitulo.findMany({ where: { recorrenciaId: { in: recsImp.map((r) => r.id) }, status: "ABERTO", competencia: { startsWith: pref } }, orderBy: { competencia: "asc" } }) : [];
  for (const t of titsImp) {
    const r = recsImp.find((x) => x.id === t.recorrenciaId), g = IMPOSTOS_VENDAS[r.chaveOrigem];
    const base = somaMes(t.competencia, -1);
    const esperado = r2(recBloco(base, ["CREDITO", "BOLETO"]) * g.pct);
    const ajustado = t.pontual || t.valorConfirmado;
    checks.push(chk("Impostos", `${g.titulo} · ${t.competencia}`, [
      { tela: "Contas a pagar", fonte: ajustado ? "valor da guia (ajustado à mão)" : "previsão automática", valor: r2(t.valor) },
      { tela: "Recebimentos", fonte: `${(g.pct * 100).toLocaleString("pt-BR")}% × recebimentos de ${base}`, valor: esperado },
    ], ajustado ? "Guia lançada à mão: diferença é esperada (vale a guia)." : null, ajustado ? "INFO" : undefined));
  }

  // ---------------- 4. MATRIZ ⇄ RECORRENTES ⇄ CONTAS A PAGAR ----------------
  const mr = await montarMatrizRec().catch(() => ({ error: true }));
  if (!mr.error) {
    const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: mr.propostas.map((p) => p.chave) } } });
    const totRec = r2(recs.filter((r) => r.ativo && !ehGuia(r.chaveOrigem)).reduce((s, r) => s + Number(r.valor), 0));
    checks.push(chk("Matriz × Recorrentes", "Total mensal da Matriz × recorrências espelho", [
      { tela: "Matriz de custos", fonte: "Σ itens que viram conta (folha, encargos, custos, dívidas)", valor: r2(mr.propostas.filter((p) => !ehGuia(p.chave)).reduce((s, p) => s + Number(p.valor || 0), 0)) },
      { tela: "Contas a pagar › Recorrentes", fonte: "Σ recorrências ativas com origem na Matriz", valor: totRec },
    ], "Sem INSS/FGTS (seguem a última guia lançada, não a Matriz)."));
    const div = mr.propostas.filter((p) => !p.jaExiste || (p.mudou && !p.valorGuia));
    checks.push({ grupo: "Matriz × Recorrentes", nome: "Itens da Matriz sem espelho ou diferentes na guia Recorrentes", cols: ["Matriz", "Recorrentes"], status: div.length || mr.obsoletas.length ? "DIVERGE" : "OK",
      fontes: [], obs: div.length || mr.obsoletas.length ? "Se abrir o contas a pagar, o espelho corrige sozinho." : null,
      itens: [...div.map((p) => ({ nome: p.titulo, a: r2(p.valor), b: p.valorAtual, nota: p.jaExiste ? "diferente" : "falta na Recorrentes" })),
              ...mr.obsoletas.map((o) => ({ nome: o.titulo, a: null, b: o.valor, nota: "saiu da Matriz" }))] });
    // recorrência × contas em aberto (deste mês em diante, não ajustadas à mão)
    const ids = recs.map((r) => r.id);
    const tits = ids.length ? await prisma.finTitulo.findMany({ where: { recorrenciaId: { in: ids }, status: "ABERTO", competencia: { gte: mesAtual() }, pontual: false, valorConfirmado: false, vencimentoOriginal: null }, select: { id: true, titulo: true, competencia: true, valor: true, recorrenciaId: true } }) : [];
    const porId = Object.fromEntries(recs.map((r) => [r.id, r]));
    const ruins = tits.filter((t) => { const r = porId[t.recorrenciaId]; return r && /^MATRIZ\|(vidaVegetativa|logistica|administracao|sistemas|dividas)\|/.test(r.chaveOrigem) && Math.abs(Number(t.valor) - Number(r.valor)) > 0.009; });
    checks.push({ grupo: "Matriz × Recorrentes", nome: "Contas a pagar em aberto × recorrência (custos únicos, sem ajuste à mão)", cols: ["Recorrentes", "Contas a pagar"], status: ruins.length ? "DIVERGE" : "OK", fontes: [],
      obs: ruins.length ? "Realinhadas automaticamente ao abrir o contas a pagar (v211)." : null,
      itens: ruins.map((t) => ({ nome: `${t.titulo} · ${t.competencia}`, a: r2(porId[t.recorrenciaId].valor), b: r2(t.valor), nota: "conta ≠ recorrência" })) });
    const ajustadas = await prisma.finTitulo.count({ where: { recorrenciaId: { in: ids }, status: "ABERTO", competencia: { gte: mesAtual() }, pontual: true } });
    checks.push({ grupo: "Matriz × Recorrentes", nome: "Contas ajustadas só no contas a pagar (não voltam para Matriz/Recorrentes)", status: "INFO", fontes: [], obs: `${ajustadas} conta(s) em aberto com ajuste pontual — regra: o contas a pagar não altera a Matriz.` });
  }
  if (M) {
    const blocos = M.blocos;
    checks.push({ grupo: "Matriz × Recorrentes", nome: "Custo do negócio (Matriz)", status: "INFO", fontes: [{ tela: "Matriz de custos", fonte: "operação + dívidas", valor: r2(M.custoNegocio) }],
      obs: `Pessoal ${r2(blocos.pessoal).toLocaleString("pt-BR")} · vida vegetativa ${r2(blocos.vidaVegetativa).toLocaleString("pt-BR")} · logística ${r2(blocos.logistica).toLocaleString("pt-BR")} · adm ${r2(blocos.administracao).toLocaleString("pt-BR")} · sistemas ${r2(blocos.sistemas).toLocaleString("pt-BR")} · dívidas ${r2(blocos.dividas).toLocaleString("pt-BR")}` });
  }

  // ---------------- 5. DÍVIDAS: Matriz × Alavancagem × Indicadores ----------------
  const [prev, pano, contratos, tributos] = await Promise.all([
    previaMatriz().catch(() => []), panorama(hoje).catch(() => null),
    prisma.finContrato.findMany({ where: { ativo: true } }), prisma.finTributo.findMany(),
  ]);
  const difC = prev.filter((p) => p.estado !== "IGUAL");
  checks.push({ grupo: "Dívidas", nome: "Parcela dos contratos: Matriz › Dívidas × Alavancagem", cols: ["Alavancagem", "Matriz"], status: difC.length ? "DIVERGE" : "OK", fontes: [],
    obs: difC.length ? "Use \"Sincronizar com a Matriz\" na Alavancagem." : null,
    itens: difC.map((p) => ({ nome: p.nome, a: p.valor, b: p.valorAtual, nota: p.estado === "NOVO" ? "falta na Matriz" : "valor diferente" })) });
  if (pano) {
    const pos = dre.alavancagem?.atual;
    checks.push(chk("Dívidas", "Saldo de tributos parcelados", [
      { tela: "Alavancagem", fonte: "Σ FinTributo.valor", valor: pano.totais.tributos },
      { tela: "Análise financeira (Indicadores)", fonte: "saldo − parcelas já vencidas", valor: pos ? pos.tributos : null },
    ], "Bases diferentes: a Alavancagem mostra o valor cadastrado; os Indicadores descontam as parcelas vencidas."));
    checks.push(chk("Dívidas", "Dívida de contratos", [
      { tela: "Alavancagem", fonte: "saldo de capital (parcelas pagas do cadastro)", valor: pano.totais.dividaCapital },
      { tela: "Análise financeira (Indicadores)", fonte: "a vencer (baixas no contas a pagar)", valor: pos ? pos.divida : null },
    ]));
    const parc = (matrizOf?.dados?.dividas || []).filter((i) => /^PARC(FED|EST):/.test(String(i.id || "")) && i.ativo !== false);
    for (const i of parc) {
      const dig = (x) => String(x || "").replace(/\D/g, "");
      const k = dig(String(i.id).split(":")[1]);
      const t = tributos.find((x) => (k.length >= 6 && dig(`${x.descricao} ${x.observacao || ""}`).includes(k)) || String(x.descricao || "").toUpperCase() === String(i.natureza || "").toUpperCase());
      checks.push(chk("Dívidas", `Parcela ${i.natureza}`, [
        { tela: "Matriz › Dívidas", fonte: i.id, valor: r2(i.valor) },
        { tela: "Alavancagem (tributo)", fonte: "parcela mensal do cadastro", valor: t ? num(t.parcelaMensal) : null },
      ]));
    }
  }

  // ---------------- 6. SALDOS: DRE saldo final × saldo inicial do mês seguinte ----------------
  const pain = await prisma.finMesPainel.findMany({ where: { competencia: { gte: `${a}-01`, lte: `${a + 1}-01` } } });
  const saldoIni = Object.fromEntries(pain.map((p) => [p.competencia, num(p.saldoInicial)]));
  const bancos = (p) => (Array.isArray(p?.dados?.bancos) && p.dados.bancos.length ? r2(p.dados.bancos.reduce((s, b) => s + Number(b.saldo || 0), 0)) : null);
  const linhasSaldo = [];
  for (const dm of dre.meses) {
    const prox = somaMes(dm.competencia, 1);
    linhasSaldo.push({ mes: MESES[dm.mes - 1], valores: [dm.lancado ? dm.saldoFinal : null, saldoIni[prox] ?? null, bancos(pain.find((p) => p.competencia === dm.competencia))],
      status: dm.lancado && saldoIni[dm.competencia] != null ? comparar([dm.saldoFinal, saldoIni[prox] ?? null]) : "SEM_DADO" });
  }
  tabelas.push({ grupo: "Saldos", titulo: "Saldo final do mês × saldo inicial do mês seguinte",
    colunas: ["DRE: saldo final do mês", "Painel: saldo inicial do mês seguinte", "Painel do mês: saldo dos bancos (informativo)"],
    fontes: ["saldo inicial + resultado + externos (mês sem saldo inicial não compara)", "FinMesPainel.saldoInicial (digitado)", "FinMesPainel.dados.bancos (digitado)"],
    comparadas: [0, 1], linhas: linhasSaldo });

  // ---------------- 7. ATRASADOS ----------------
  const comp = mesAtual();
  const p = await painelMes(comp, hoje).catch(() => null);
  if (p) {
    const ks = ["atrasadoImpostos", "atrasadoMateriaPrima", "atrasadoPrestadores", "atrasadoOutros"];
    const preench = ks.some((k) => p.manual[k] != null && p.manual[k] !== "");
    checks.push(chk("Atrasados", `Contas a pagar atrasadas (${comp})`, [
      { tela: "Painel do mês (automático)", fonte: "contas a pagar em aberto vencidas", valor: p.auto.contasAtrasadas },
      { tela: "Painel do mês (abertura digitada)", fonte: "impostos + matéria-prima + prestadores + outros", valor: preench ? r2(ks.reduce((s, k) => s + Number(p.manual[k] || 0), 0)) : null },
    ]));
    const { visaoAtraso } = await import("@/lib/finAtraso");
    const va = await visaoAtraso().catch(() => null);
    const totAtraso = va ? r2((va.atrasadas || []).reduce((s, t) => s + Number(t.valor || 0), 0)) : null;
    checks.push(chk("Atrasados", "Contas a receber atrasadas", [
      { tela: "Painel do mês", fonte: p.manual.receberAtrasadasManual != null ? "valor digitado" : "contas a receber vencidas", valor: r2(p.atrasadoReceber) },
      { tela: "Financeiro › Atrasados", fonte: "títulos em cobrança", valor: totAtraso },
    ]));
  }

  const resumo = { OK: 0, DIVERGE: 0, INFO: 0, SEM_DADO: 0 };
  for (const c of checks) resumo[c.status]++;
  for (const t of tabelas) for (const l of t.linhas) resumo[l.status]++;
  return { ano: a, geradoEm: new Date().toISOString(), resumo, checks, tabelas };
}
