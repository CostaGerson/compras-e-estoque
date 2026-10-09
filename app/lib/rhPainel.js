// v168 — painel de gestão do RH: indicadores de ponto, gráficos, medalhas de tempo de casa e dados acionáveis
import { prisma } from "@/lib/prisma";
import { calcFuncionario, DEPTOS } from "@/lib/matriz";
import { mesAtual, somaMes } from "@/lib/finTitulos";
import { competenciasComPonto, apurar, indices, mesesSemCartao, pessoasParaPonto, LIMITE_HE_MES, fimDoMes } from "@/lib/rhPonto";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const hoje = () => new Date().toISOString().slice(0, 10);
const somaDia = (s, n) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

// ---------- medalhas de tempo de casa (premiação editável pelo RH/financeiro) ----------
const CHAVE_MEDALHAS = "RH|MEDALHAS";
export const MEDALHAS_PADRAO = [
  { anos: 1, nome: "BRONZE", cor: "#B7793E", premio: "" },
  { anos: 3, nome: "PRATA", cor: "#8A94A6", premio: "" },
  { anos: 5, nome: "OURO", cor: "#D4A017", premio: "" },
  { anos: 10, nome: "PLATINA", cor: "#5B8DB8", premio: "" },
  { anos: 15, nome: "DIAMANTE", cor: "#3FB6C9", premio: "" },
  { anos: 20, nome: "LENDA", cor: "#7A5AF8", premio: "" },
];
export async function lerMedalhas() {
  const c = await prisma.finConfig.findUnique({ where: { chave: CHAVE_MEDALHAS } });
  try { const l = JSON.parse(c?.valor || "null"); if (Array.isArray(l) && l.length) return l; } catch {}
  return MEDALHAS_PADRAO;
}
export async function salvarMedalhas(lista) {
  const l = (lista || []).map((m) => ({ anos: Math.max(1, Math.round(Number(m.anos) || 0)), nome: String(m.nome || "").toUpperCase().trim().slice(0, 30),
    cor: /^#[0-9A-F]{6}$/i.test(m.cor || "") ? m.cor : "#FF6B1A", premio: String(m.premio || "").toUpperCase().trim().slice(0, 300) }))
    .filter((m) => m.nome).sort((a, b) => a.anos - b.anos)
    .filter((m, i, a) => i === 0 || a[i - 1].anos !== m.anos);
  await prisma.finConfig.upsert({ where: { chave: CHAVE_MEDALHAS }, create: { chave: CHAVE_MEDALHAS, valor: JSON.stringify(l) }, update: { valor: JSON.stringify(l) } });
  return l;
}
// anos completos entre a admissão e a data
const anosEntre = (adm, ate) => {
  if (!adm) return null;
  const [a1, m1, d1] = adm.split("-").map(Number), [a2, m2, d2] = ate.split("-").map(Number);
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
};
export function tempoDeCasa(adm, medalhas, ref = hoje()) {
  if (!adm) return null;
  const anos = anosEntre(adm, ref);
  const ganhas = medalhas.filter((m) => anos >= m.anos);
  const prox = medalhas.find((m) => anos < m.anos) || null;
  let proxData = null;
  if (prox) { const [a, m, d] = adm.split("-").map(Number); proxData = `${a + prox.anos}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  const dias = Math.floor((new Date(`${ref}T00:00:00Z`) - new Date(`${adm}T00:00:00Z`)) / 86400000);
  return { admissao: adm, anos, meses: Math.floor((dias % 365.25) / 30.44), dias, medalhas: ganhas, proxima: prox ? { ...prox, data: proxData } : null };
}

// ---------- freelancer × folha por setor ----------
const SETORES_CUSTO = [
  { k: "CORTE", folha: "2113100", free: "2117200", depto: "COR" },
  { k: "COSTURA", folha: "2113500", free: "2117400", depto: "COS" },
  { k: "SILK", folha: "2113310", free: "2117510", depto: "SIL" },
  { k: "BORDADO", folha: "2113320", free: "2117520", depto: "BOR" },
  { k: "PRENSA", folha: "2113330", free: "2117530", depto: null },
  { k: "EXPEDIÇÃO", folha: "2113200", free: "2117300", depto: "EXP" },
  { k: "LOGÍSTICA", folha: "2113600", free: "2117600", depto: "LOG" },
];
const FREE_SETOR = { CORTE: "CORTE", COSTURA: "COSTURA", SILK: "SILK", BORDADO: "BORDADO", EXPEDICAO: "EXPEDIÇÃO", LOGISTICA: "LOGÍSTICA" };

export async function freelancerXFolha(comp) {
  const contas = await prisma.finConta.findMany({ where: { codigo: { in: [...SETORES_CUSTO.flatMap((s) => [s.folha, s.free]), "2117100"] } }, select: { id: true, codigo: true } });
  const idDe = Object.fromEntries(contas.map((c) => [c.codigo, c.id])), codDe = Object.fromEntries(contas.map((c) => [c.id, c.codigo]));
  const lanc = contas.length ? await prisma.finLancamento.findMany({ where: { competencia: comp, desmembrado: false, substituido: false, contaId: { in: contas.map((c) => c.id) } }, select: { contaId: true, valor: true } }) : [];
  const porCod = {};
  for (const l of lanc) porCod[codDe[l.contaId]] = (porCod[codDe[l.contaId]] || 0) - Number(l.valor);   // saídas vêm negativas
  // previsão (quando o extrato do mês ainda não foi identificado): Matriz para a folha, contas da semana para o freelancer
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  const par = m?.dados?.parametros || {};
  const fimC = fimDoMes(comp);
  const folhaMatriz = {};
  for (const p of m?.dados?.pessoal || []) {
    if (p.admissao && p.admissao > fimC) continue;
    if (p.ativo === false && (!p.demissao || p.demissao < `${comp}-01`)) continue;
    folhaMatriz[p.depto] = (folhaMatriz[p.depto] || 0) + calcFuncionario(p, par).total;
  }
  const semana = await prisma.finSemanaItem.findMany({
    where: { grupo: "FREELANCER", titulo: { vencimento: { gte: new Date(`${comp}-01T00:00:00Z`), lte: new Date(`${fimC}T00:00:00Z`) }, status: { not: "CANCELADO" } } },
    select: { setor: true, valor: true },
  }).catch(() => []);
  const freeSemana = {};
  for (const s of semana) { const k = FREE_SETOR[s.setor] || s.setor; freeSemana[k] = (freeSemana[k] || 0) + Number(s.valor); }
  const linhas = SETORES_CUSTO.map((s) => {
    const fReal = r2(porCod[s.folha] || 0), lReal = r2(porCod[s.free] || 0);
    const folha = fReal > 0 ? fReal : r2(s.depto ? folhaMatriz[s.depto] || 0 : 0);
    const free = lReal > 0 ? lReal : r2(freeSemana[s.k] || 0);
    return { setor: s.k, folha, freelancer: free, fonteFolha: fReal > 0 ? "EXTRATO" : "MATRIZ", fonteFree: lReal > 0 ? "EXTRATO" : free ? "CONTAS DA SEMANA" : "—",
      pct: folha > 0 ? Math.round((free / folha) * 1000) / 10 : free > 0 ? null : 0 };
  }).filter((l) => l.folha || l.freelancer);
  const semSetor = r2(porCod["2117100"] || 0);
  const tot = { folha: r2(linhas.reduce((a, l) => a + l.folha, 0)), freelancer: r2(linhas.reduce((a, l) => a + l.freelancer, 0) + semSetor) };
  tot.pct = tot.folha ? Math.round((tot.freelancer / tot.folha) * 1000) / 10 : null;
  return { competencia: comp, linhas, semSetor, total: tot };
}

// ---------- painel ----------
export async function painelRH(compPedida) {
  const comps = await competenciasComPonto();
  const comp = compPedida && comps.includes(compPedida) ? compPedida : comps[comps.length - 1] || null;
  const pessoas = await pessoasParaPonto();
  const medalhas = await lerMedalhas();
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } });
  const sal = Object.fromEntries((m?.dados?.pessoal || []).map((p) => [p.id, Number(p.salario) || 0]));
  const serie = comp ? comps.filter((c) => c <= comp).slice(-12) : [];
  const { porPessoa, pendencias, justs } = await apurar(serie);
  const nomeDe = Object.fromEntries(pessoas.map((p) => [p.id, p]));
  const somaComp = (c) => {
    const a = { previstos: 0, faltas: 0, atestados: 0, pendentes: 0, justificados: 0, atrasos: 0, baseAtraso: 0, minAtraso: 0, he: 0, exced: 0, diasAcima2h: 0, minFalta: 0, dias: 0 };
    for (const pid of Object.keys(porPessoa)) { const x = porPessoa[pid][c]; if (x) for (const k of Object.keys(a)) a[k] += x[k]; }
    return indices(a);
  };
  const geral = comp ? somaComp(comp) : null;
  const custoHE = (pid, min) => r2(((sal[pid] || 0) / 220) * 1.5 * (min / 60));
  const ranking = comp ? Object.keys(porPessoa).filter((pid) => porPessoa[pid][comp]).map((pid) => {
    const x = indices(porPessoa[pid][comp]);
    const p = nomeDe[pid] || {};
    return { pessoaId: pid, nome: p.nome || pid, nomeCompleto: p.nomeCompleto || null, depto: p.depto || null, empresa: p.empresa || null, foto: p.foto || null, ...x, custoHE: custoHE(pid, x.he) };
  }) : [];
  geral && (geral.custoHE = r2(ranking.reduce((a, r) => a + r.custoHE, 0)));
  const series = serie.map((c) => { const g = somaComp(c); return { competencia: c, assiduidade: g.assiduidade, pontualidade: g.pontualidade, he: Math.round(g.he / 6) / 10 }; });
  const ativos = pessoas.filter((p) => p.ativo !== false);
  const semCartao = mesesSemCartao(pessoas, serie, porPessoa, justs);
  const pendMes = [...pendencias, ...semCartao].filter((p) => !comp || p.competencia === comp);

  // carômetro: números do mês e tempo de casa
  const porFuncionario = {};
  for (const p of pessoas) {
    const x = comp && porPessoa[p.id]?.[comp] ? indices(porPessoa[p.id][comp]) : null;
    const adm = p.admissao || p.admissaoFicha || null;
    porFuncionario[p.id] = { assiduidade: x?.assiduidade ?? null, pontualidade: x?.pontualidade ?? null, he: x?.he ?? null, faltas: x?.faltas ?? null, atrasos: x?.atrasos ?? null, tempo: tempoDeCasa(adm, medalhas) };
  }

  // ---------- alertas acionáveis ----------
  const H = hoje(), em15 = somaDia(H, 15);
  const alertas = [];
  for (const r of ranking) {
    if (r.he > LIMITE_HE_MES) alertas.push({ tipo: "HE", nivel: "ALTO", pessoaId: r.pessoaId, texto: `${r.nome}: ${(r.he / 60).toFixed(1).replace(".", ",")} h extras no mês (acima de ${LIMITE_HE_MES / 60} h)`, valor: r.custoHE });
    if (r.diasAcima2h > 0) alertas.push({ tipo: "HE2H", nivel: "ALTO", pessoaId: r.pessoaId, texto: `${r.nome}: ${r.diasAcima2h} dia(s) com mais de 2 h extras (acima do limite legal diário)` });
    if (r.faltas >= 2) alertas.push({ tipo: "FALTA", nivel: "MEDIO", pessoaId: r.pessoaId, texto: `${r.nome}: ${r.faltas} faltas no mês — confira o desconto e a assiduidade` });
    if (r.atrasos >= 3) alertas.push({ tipo: "ATRASO", nivel: "MEDIO", pessoaId: r.pessoaId, texto: `${r.nome}: ${r.atrasos} atrasos no mês (${r.minAtraso} min)` });
  }
  for (const p of ativos) {
    const adm = p.admissao || p.admissaoFicha;
    if (!adm) { if (p.regime !== "DIRETOR") alertas.push({ tipo: "CADASTRO", nivel: "BAIXO", pessoaId: p.id, texto: `${p.nome}: sem data de admissão (sem medalha e sem prazo de experiência)` }); continue; }
    for (const [d, rot] of [[44, "45 dias"], [89, "90 dias"]]) {
      const v = somaDia(adm, d);
      if (v >= H && v <= em15) alertas.push({ tipo: "EXPERIENCIA", nivel: "ALTO", pessoaId: p.id, texto: `${p.nome}: contrato de experiência de ${rot} vence em ${v.split("-").reverse().join("/")} — prorrogar, efetivar ou desligar`, data: v });
    }
    const t = tempoDeCasa(adm, medalhas);
    if (t?.proxima?.data && t.proxima.data >= H && t.proxima.data <= somaDia(H, 30))
      alertas.push({ tipo: "MEDALHA", nivel: "BAIXO", pessoaId: p.id, texto: `${p.nome}: completa ${t.proxima.anos} ano(s) de casa em ${t.proxima.data.split("-").reverse().join("/")} — medalha ${t.proxima.nome}${t.proxima.premio ? ` · ${t.proxima.premio}` : " · premiação a definir"}`, data: t.proxima.data });
  }
  const pend = pendMes.filter((p) => !p.justificativa).length;
  if (pend) alertas.unshift({ tipo: "PONTO", nivel: "ALTO", texto: `${pend} pendência(s) de ponto sem justificativa em ${comp ? comp.split("-").reverse().join("/") : "—"}` });
  const peso = { ALTO: 0, MEDIO: 1, BAIXO: 2 };
  alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);

  const compFree = somaMes(mesAtual(), -1);
  return {
    competencias: comps, competencia: comp, geral, series, ranking, porFuncionario, medalhas,
    pendencias: pendMes.map((p) => ({ ...p, nome: nomeDe[p.pessoaId]?.nome || p.pessoaId })).sort((a, b) => (a.nome + (a.data || "")).localeCompare(b.nome + (b.data || ""))),
    alertas, freelancer: await freelancerXFolha(compFree), limiteHE: LIMITE_HE_MES,
    deptos: Object.fromEntries(DEPTOS),
  };
}
