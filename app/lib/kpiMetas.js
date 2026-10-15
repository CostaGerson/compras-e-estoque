// v213 — Página de METAS da Gestão: meta anual de cada natureza e a distribuição mês a mês.
// As metas daqui vão para o campo META dos KPIs e para a Matriz oficial (lib/matrizMetas.js).
import { prisma } from "@/lib/prisma";
import { relatorio, anosDisponiveis } from "@/lib/kpi";
import { derivarMetas } from "@/lib/kpiMetasCalc";

// natureza → onde fica a meta do ano (KpiAno), a do mês (KpiMes) e o realizado (linha do relatório)
export const NATUREZAS = [
  { k: "vendasValor", grupo: "Vendas", rotulo: "Vendas (R$)", un: "R$", ano: "metaVendas", mes: "metaVendasValor", real: (l) => l.vendas.atual },
  { k: "vendasPecas", grupo: "Vendas", rotulo: "Vendas (peças)", un: "pc", ano: "metaVendasPecas", mes: "metaVendasPecas", real: (l) => l.vendas.pecas },
  { k: "faturamentoValor", grupo: "Faturamento", rotulo: "Faturamento (R$)", un: "R$", ano: "metaFaturamento", mes: "metaFaturamentoValor", real: (l) => l.faturamento.atual },
  { k: "faturamentoPecas", grupo: "Faturamento", rotulo: "Faturamento (peças faturadas)", un: "pc", ano: "metaPecasFaturadas", mes: "metaFaturamentoPecas", real: (l) => l.faturamento.pecas },
  { k: "receitaValor", grupo: "Receita", rotulo: "Receita (R$)", un: "R$", ano: "metaReceita", mes: "metaReceitaValor", real: (l) => l.receita.total },
  { k: "pecasProduzidas", grupo: "Produção", rotulo: "Peças produzidas", un: "pc", ano: "metaPecasProduzidas", mes: "metaPecasProduzidas", real: (l) => (l.producao.proprio ? l.producao.pecas : null) },
];
const num = (v) => (v == null || v === "" ? null : Number(v));
const r2 = (v) => Math.round(Number(v) * 100) / 100;

// médias mensais do realizado numa janela de anos (mês sem dado em nenhum ano = média dos outros meses)
function medias(porAno, anos) {
  const m = [];
  for (let i = 0; i < 12; i++) {
    const v = anos.map((a) => porAno[a]?.[i]).filter((x) => x != null && x > 0);
    m.push(v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
  }
  const ok = m.filter((x) => x != null);
  if (!ok.length) return null;
  const media = ok.reduce((s, x) => s + x, 0) / ok.length;
  return m.map((x) => r2(x ?? media));
}

// v234 — mês fechado = realizado preenchido no KPI (vendas, faturamento ou peças): a meta dele não muda mais
export async function mesesFechados(ano, rel) {
  const r = rel || (await relatorio(Number(ano)).catch(() => null));
  if (!r) return Array(12).fill(false);
  const tem = (v) => v != null && Number(v) > 0;
  return r.linhas.map((l) => tem(l.vendas?.atual) || tem(l.faturamento?.atual) || tem(l.faturamento?.pecas));
}

export async function metasDoAno(ano) {
  const a = Number(ano);
  const [kAno, kMes, anos] = await Promise.all([
    prisma.kpiAno.findUnique({ where: { ano: a } }),
    prisma.kpiMes.findMany({ where: { ano: a } }),
    anosDisponiveis(),
  ]);
  const passados = anos.filter((x) => x < a).sort((x, y) => y - x);
  const rels = {};
  for (const y of passados) rels[y] = await relatorio(y).catch(() => null);
  const mesDe = (m) => kMes.find((x) => x.mes === m) || {};

  let naturezas = NATUREZAS.map((n) => {
    const anual = num(kAno?.[n.ano]);
    let meses = [...Array(12)].map((_, i) => num(mesDe(i + 1)[n.mes]));
    // como está hoje: mês sem meta própria = ano ÷ 12; peças vendidas e produzidas herdam a meta de peças faturadas (regra antiga do KPI)
    const herda = (n.k === "vendasPecas" || n.k === "pecasProduzidas") && anual == null && meses.every((x) => x == null);
    let alvo = anual, derivado;
    if (herda) {
      const pf = NATUREZAS.find((x) => x.k === "faturamentoPecas");
      alvo = num(kAno?.[pf.ano]);
      // v216: vendas (peças) parte da distribuição mês a mês já digitada (peças produzidas), senão a de peças faturadas
      const prod = [...Array(12)].map((_, i) => num(mesDe(i + 1).metaPecasProduzidas));
      const usaProd = n.k === "vendasPecas" && prod.some((x) => x != null);
      if (usaProd && prod.every((x) => x != null)) alvo = prod.reduce((s2, x) => s2 + x, 0);
      const proprios = usaProd ? prod : [...Array(12)].map((_, i) => num(mesDe(i + 1)[pf.mes]));
      derivado = proprios.map((x) => x == null);
      meses = proprios.map((x) => x ?? (alvo != null ? alvo / 12 : null));
    } else {
      derivado = meses.map((x) => x == null);
      meses = meses.map((x) => x ?? (anual != null ? anual / 12 : null));
    }
    meses = meses.map((x) => (x == null ? null : n.un === "pc" ? Math.round(x) : r2(x)));
    // sobra do arredondamento do "ano ÷ 12" vai para o último mês derivado (a soma fecha com a meta do ano)
    if (alvo != null && derivado.some(Boolean) && meses.every((x) => x != null)) {
      const dif = alvo - meses.reduce((s, x) => s + x, 0);
      const ult = derivado.lastIndexOf(true);
      if (Math.abs(dif) >= 0.005) meses[ult] = n.un === "pc" ? Math.round(meses[ult] + dif) : r2(meses[ult] + dif);
    }
    const soma = meses.some((x) => x != null) ? meses.reduce((s, x) => s + (x || 0), 0) : null;

    const porAno = {};
    for (const y of passados) if (rels[y]) porAno[y] = rels[y].linhas.map((l) => { const v = n.real(l); return v == null ? null : Number(v); });
    const comDado = passados.filter((y) => porAno[y]?.some((x) => x != null && x > 0));
    const historico = {
      total: { anos: comDado, medias: medias(porAno, comDado) },
      dois: { anos: comDado.filter((y) => y >= a - 2), medias: medias(porAno, comDado.filter((y) => y >= a - 2)) },
      um: { anos: comDado.filter((y) => y === a - 1), medias: medias(porAno, comDado.filter((y) => y === a - 1)) },
    };
    return { k: n.k, grupo: n.grupo, rotulo: n.rotulo, un: n.un, anual: anual ?? (soma != null ? (n.un === "pc" ? Math.round(soma) : r2(soma)) : null), anualGravado: anual != null, meses, historico };
  });
  // v221 — vendas R$ sem histórico próprio: a distribuição histórica usa o faturamento realizado (mesma unidade, R$)
  const nv = naturezas.find((x) => x.k === "vendasValor"), nf = naturezas.find((x) => x.k === "faturamentoValor");
  for (const j of ["total", "dois", "um"]) {
    if (!nv.historico[j].medias && nf.historico[j].medias) nv.historico[j] = { ...nf.historico[j], fonte: "faturamento realizado" };
  }
  // v216 — ticket em uso: a meta de ticket; sem ela, faturamento ÷ peças do ano
  const tkMeta = num(kAno?.metaTicketMedio);
  const fA = num(kAno?.metaFaturamento), pA = num(kAno?.metaPecasFaturadas);
  const ticket = tkMeta ?? (fA != null && pA ? Math.round((fA / pA) * 100) / 100 : null);
  // ticket realizado: faturamento ÷ peças faturadas do ano até agora (e o do ano anterior)
  const rAtual = await relatorio(a).catch(() => null);
  const tkReal = (r) => (r && r.ticketMedio != null ? { valor: Math.round(r.ticketMedio * 100) / 100, meses: r.mediaMensal?.bases?.faturamento || 0 } : null);
  const ticketRealizado = { atual: tkReal(rAtual), anterior: tkReal(rels[a - 1] || null) };
  const fechados = await mesesFechados(a, rAtual);
  return { ano: a, fechados, margem: num(kAno?.metaMargem), ticket, ticketGravado: tkMeta != null, ticketRealizado, receitaJan: await receitaJaneiro(a),
    freelancer: { meta: num(kAno?.metaPctFreelancer), ...(await sugestaoFreelancer().catch(() => ({}))) }, naturezas };
}

// v224 — sugestão do % de freelancer: o real da análise folha × freelancer (último mês fechado e média de 3 meses)
async function sugestaoFreelancer() {
  const { freelancerXFolha } = await import("@/lib/rhPainel");
  const { mesAtual, somaMes } = await import("@/lib/finTitulos");
  const meses = [1, 2, 3].map((k) => somaMes(mesAtual(), -k));
  const rs = [];
  for (const c of meses) { const r = await freelancerXFolha(c).catch(() => null); if (r?.total?.custo) rs.push({ comp: c, pct: r.total.pct / 100, freelancer: r.total.freelancer, custo: r.total.custo, previsto: r.previsto }); }
  const ult = rs[0] || null;
  const media = rs.length ? rs.reduce((s2, x) => s2 + x.freelancer, 0) / rs.reduce((s2, x) => s2 + x.custo, 0) : null;
  return { ultimo: ult ? { comp: ult.comp, pct: ult.pct } : null, media3: media != null ? { pct: Math.round(media * 10000) / 10000, meses: rs.length } : null,
    tabelaMatriz: rs[0]?.previsto != null ? rs[0].previsto / 100 : null };
}

// receita de JAN = faturamento de DEZ do ano anterior (meta do mês; sem ela, meta do ano ÷ 12; sem meta, o realizado)
async function receitaJaneiro(a) {
  const [kA, kD] = await Promise.all([
    prisma.kpiAno.findUnique({ where: { ano: a - 1 } }).catch(() => null),
    prisma.kpiMes.findUnique({ where: { ano_mes: { ano: a - 1, mes: 12 } } }).catch(() => null),
  ]);
  if (kD?.metaFaturamentoValor != null) return { valor: Number(kD.metaFaturamentoValor), fonte: `meta de faturamento DEZ/${a - 1}` };
  if (kA?.metaFaturamento != null) return { valor: r2(Number(kA.metaFaturamento) / 12), fonte: `meta de faturamento ${a - 1} ÷ 12` };
  if (kD?.faturamentoValor != null) return { valor: Number(kD.faturamentoValor), fonte: `faturamento realizado DEZ/${a - 1}` };
  return { valor: null, fonte: `sem faturamento de DEZ/${a - 1}` };
}

// v216 — grava pela regra de coerência: entra vendas (peças) + ticket; o resto é calculado (lib/kpiMetasCalc.js)
export async function salvarCoerente(ano, vendasValorMeses, ticket, margem, quem, pctFreelancer) {
  const a = Number(ano);
  const rj = await receitaJaneiro(a);
  // v234 — mês fechado mantém a meta gravada (vendas R$ e peças), qualquer que seja o que veio da tela
  const fech = await mesesFechados(a);
  const gravados = await prisma.kpiMes.findMany({ where: { ano: a } });
  const g = (m) => gravados.find((x) => x.mes === m) || {};
  const vv = [...Array(12)].map((_, i) => (fech[i] && g(i + 1).metaVendasValor != null ? Number(g(i + 1).metaVendasValor) : vendasValorMeses?.[i] ?? null));
  const pf = [...Array(12)].map((_, i) => (fech[i] && g(i + 1).metaFaturamentoPecas != null ? Number(g(i + 1).metaFaturamentoPecas) : null));
  const d = derivarMetas(vv, ticket, rj.valor, pf);
  const metas = Object.fromEntries(["vendasPecas", "vendasValor", "faturamentoPecas", "faturamentoValor", "receitaValor"].map((k) => [k, d[k]]));
  metas.pecasProduzidas = { anual: null, meses: Array(12).fill(null) };   // produzidas = faturadas: a meta própria sai
  const r = await salvarMetas(a, metas, margem, quem, ticket, pctFreelancer);
  // a receita de JAN do ano seguinte acompanha o faturamento de DEZ deste ano
  const prox = await prisma.kpiAno.findUnique({ where: { ano: a + 1 } }).catch(() => null);
  const dez = d.faturamentoValor.meses[11];
  if (prox && dez != null) {
    const jan = await prisma.kpiMes.findUnique({ where: { ano_mes: { ano: a + 1, mes: 1 } } }).catch(() => null);
    const antes = jan?.metaReceitaValor != null ? Number(jan.metaReceitaValor) : 0;
    await prisma.kpiMes.upsert({ where: { ano_mes: { ano: a + 1, mes: 1 } }, create: { ano: a + 1, mes: 1, metaReceitaValor: dez }, update: { metaReceitaValor: dez } });
    if (prox.metaReceita != null) await prisma.kpiAno.update({ where: { ano: a + 1 }, data: { metaReceita: r2(Number(prox.metaReceita) - antes + dez) } });
  }
  return r;
}

// grava: { k: { anual, meses[12] } } e margem (fração)
export async function salvarMetas(ano, metas, margem, quem, ticket, pctFreelancer) {
  const a = Number(ano);
  const dAno = {};
  if (margem !== undefined) dAno.metaMargem = margem;
  if (pctFreelancer !== undefined) dAno.metaPctFreelancer = pctFreelancer;
  if (ticket !== undefined) dAno.metaTicketMedio = ticket == null ? null : r2(ticket);
  const porMes = [...Array(12)].map(() => ({}));
  for (const n of NATUREZAS) {
    const x = metas?.[n.k];
    if (!x) continue;
    const v = num(x.anual);
    dAno[n.ano] = v == null ? null : n.un === "pc" ? Math.round(v) : r2(v);
    (x.meses || []).slice(0, 12).forEach((mv, i) => {
      const y = num(mv);
      porMes[i][n.mes] = y == null ? null : n.un === "pc" ? Math.round(y) : r2(y);
    });
  }
  await prisma.kpiAno.upsert({ where: { ano: a }, create: { ano: a, ...dAno }, update: dAno });
  for (let i = 0; i < 12; i++) {
    if (!Object.keys(porMes[i]).length) continue;
    const data = { ...porMes[i], atualizadoPorNome: quem || null };
    await prisma.kpiMes.upsert({ where: { ano_mes: { ano: a, mes: i + 1 } }, create: { ano: a, mes: i + 1, ...data }, update: data });
  }
  return metasDoAno(a);
}
