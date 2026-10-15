// v234 — Capacidade → Matriz: cria uma SIMULAÇÃO (cópia da oficial) com o cenário escolhido.
//   A (manter a equipe): % de freelancer do cenário A na produção da simulação
//   B (recomendado): % de freelancer do B + funcionários hipotéticos nos setores com contratação,
//      com o SALÁRIO PREVISTO do setor (Capacidade); o resto segue as regras da Matriz (encargos, provisões)
//      e os valores digitados (VT, VR, plano de saúde, assistência) são a média dos funcionários da companhia
import { prisma } from "@/lib/prisma";
import { calcFuncionario } from "@/lib/matriz";
import { planoMensal } from "@/lib/capacidadeMensal";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
export const SETOR_DEPTO = { CORTE: "COR", COSTURA: "COS", SILK: "SIL", BORDADO: "BOR", "EXPEDIÇÃO": "EXP", "LOGÍSTICA": "LOG" };
export const CHAVE_SALARIOS = "CAPACIDADE|SALARIOS";
// v238 — despesas que crescem com o número de pessoas (proporcional ao headcount)
export const POR_PESSOA = /(INSUMO|PADARIA|CONFRATERNIZ|ÁGUA|AGUA|ENERGIA|KIT NATALINO|SEGURO VIDA|PCMSO)/i;
export function escalarPorPessoa(dados, antes, depois, cenario) {
  if (!antes || depois === antes) return [];
  const f = depois / antes, mudou = [];
  for (const bloco of ["vidaVegetativa", "logistica", "administracao", "sistemas"]) {
    dados[bloco] = (dados[bloco] || []).map((i) => {
      if (i.ativo === false || !POR_PESSOA.test(String(i.natureza || ""))) return i;
      const novo = r2((Number(i.valor) || 0) * f);
      mudou.push({ natureza: i.natureza, de: Number(i.valor) || 0, para: novo });
      return { ...i, valor: novo, obs: [i.obs, `Simulação ${cenario}: × ${f.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} (${antes} → ${depois} pessoas)`].filter(Boolean).join(" · ") };
    });
  }
  return mudou;
}

// médias dos funcionários CLT ativos da Matriz (valores digitados e regras por funcionário)
export function mediasPessoal(dados) {
  const l = (dados?.pessoal || []).filter((p) => p.ativo !== false && p.regime === "CLT");
  const m = (k) => r2(media(l.map((p) => Number(p[k]) || 0)));
  const descontam = l.filter((p) => p.descontaVt).length;
  return { vt: m("vt"), vr: m("vr"), ps: m("ps"), assPct: Math.round(media(l.map((p) => Number(p.assPct) || 0)) * 10000) / 10000,
    descontaVt: descontam * 2 >= l.length, salario: m("salario"), n: l.length };
}
export function salarioMedioDepto(dados, depto) {
  const l = (dados?.pessoal || []).filter((p) => p.ativo !== false && p.regime === "CLT" && p.depto === depto).map((p) => Number(p.salario) || 0).filter((x) => x > 0);
  return l.length ? r2(media(l)) : null;
}

export function funcionarioHipotetico({ setor, depto, salario, medias, i, cenario, inicio }) {
  return {
    id: `sim${cenario}${depto}${i}${Date.now().toString(36)}`,
    nome: `SIMULAÇÃO ${cenario} · ${setor} ${i}`, cargo: "CONTRATAÇÃO PREVISTA", depto, regime: "CLT",
    salario: r2(salario), bonus: 0, vt: medias.vt, descontaVt: medias.descontaVt, vr: medias.vr, ps: medias.ps, assPct: medias.assPct,
    saldoLivre: 0, rFerias: 0, ativo: true, hipotetico: true, admissao: inicio || null,
    obs: `Hipotético (Capacidade × freelancer, cenário ${cenario}). Salário previsto do setor; VT, VR, plano e assistência = média da companhia.`,
  };
}

// custo mensal (Matriz) de uma contratação no setor, com o salário previsto
export function custoContratacao(dados, setor, salarioPrevisto) {
  const depto = SETOR_DEPTO[setor];
  if (!depto || !dados?.parametros) return null;
  const sal = Number(salarioPrevisto) || salarioMedioDepto(dados, depto);
  if (!sal) return null;
  const f = funcionarioHipotetico({ setor, depto, salario: sal, medias: mediasPessoal(dados), i: 1, cenario: "B" });
  return { custo: r2(calcFuncionario(f, dados.parametros).total), salario: sal, previsto: !!Number(salarioPrevisto) };
}

export async function lerSalarios() {
  const c = await prisma.finConfig.findUnique({ where: { chave: CHAVE_SALARIOS } }).catch(() => null);
  try { return JSON.parse(c?.valor || "{}") || {}; } catch { return {}; }
}
export async function salvarSalarios(d) {
  const limpo = Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [String(k).toUpperCase(), r2(String(v).replace(/\./g, "").replace(",", "."))]).filter(([, v]) => v > 0));
  await prisma.finConfig.upsert({ where: { chave: CHAVE_SALARIOS }, create: { chave: CHAVE_SALARIOS, valor: JSON.stringify(limpo) }, update: { valor: JSON.stringify(limpo) } });
  return limpo;
}

// analise = resultado de analisarCapacidade (com a meta); cenario "A" | "B"
// v242 — pecasMes: peças de cada mês (fechados = realizado; abertos = meta) → viabilidade e ano inteiro na simulação
export async function criarSimulacao({ analise, cenario, ano, mes, quem, pecasMes }) {
  const T0 = analise?.total?.[cenario];
  if (!T0) throw new Error("Informe a meta de peças: sem ela não há cenário para levar.");
  const temPeriodo = Array.isArray(pecasMes) && pecasMes.length === 12;
  const plano = temPeriodo ? planoMensal({ setores: analise.setores, pecasMes: pecasMes.map((x) => Number(x) || 0), ano: analise.anoMetas, fechados: analise.fechados || [], semContratar: cenario === "A" }) : null;
  const T = plano ? { ...T0, pct: plano.periodo.pct ?? T0.pct } : T0;
  const of = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!of) throw new Error("Matriz oficial não encontrada.");
  const { dadosComMetas } = await import("@/lib/matrizMetas");
  const base = await dadosComMetas(of.dados).catch(() => of.dados);
  const dados = JSON.parse(JSON.stringify(base));
  const pr = (dados.producao ||= {});
  if (analise.meta) pr.metaPecas = analise.meta;
  pr.razaoInternaAuto = false;
  pr.razaoInternaManual = Math.round((1 - (T.pct || 0)) * 10000) / 10000;   // % de freelancer do cenário
  const inicio = ano && mes ? `${ano}-${String(mes).padStart(2, "0")}-01` : null;
  const criados = [];
  if (cenario === "B") {
    const salarios = await lerSalarios();
    const medias = mediasPessoal(dados);
    for (const s of analise.setores) {
      // v242 — com o período: quem o plano mês a mês mantém no pico (contratados ainda não desligados); sem ele, o do mês de referência
      const n = plano ? plano.periodo.picoContratados[s.setor] || 0 : s.B?.contratar || 0, depto = SETOR_DEPTO[s.setor];
      if (!n || !depto) continue;
      const sal = Number(salarios[s.setor]) || salarioMedioDepto(dados, depto) || medias.salario;
      for (let i = 1; i <= n; i++) {
        const f = funcionarioHipotetico({ setor: s.setor, depto, salario: sal, medias, i, cenario, inicio });
        dados.pessoal = [...(dados.pessoal || []), f];
        criados.push({ setor: s.setor, salario: sal, previsto: !!Number(salarios[s.setor]) });
      }
    }
  }
  // v242 — o ANO da simulação: meses fechados = realizado (vem da oficial na tela); meses em aberto = meta de cada mês (peças × ticket)
  if (temPeriodo) {
    const tk = Number(pr.ticketMedio) || 0;
    const mgO = base.metasGestao || {};
    const fech = analise.fechados || mgO.fechados || [];
    dados.fechamento = { porMes: true, mes: mgO.mes || null, fechados: fech, realizado: mgO.realizado || [],
      fatMeses: pecasMes.map((p, i) => (fech[i] ? mgO.fatMeses?.[i] ?? (Number(p) || 0) * tk : (Number(p) || 0) * tk)),
      pcsMeses: pecasMes.map((p) => Number(p) || 0) };
    const abertos = pecasMes.filter((_, i) => !fech[i]);
    if (abertos.length) pr.metaPecas = Math.round(abertos.reduce((t, x) => t + (Number(x) || 0), 0) / abertos.length);   // média do período em aberto
  }
  // v238 — insumos, padaria, confraternização, água, energia… acompanham o número de pessoas
  const ativos = (l) => (l || []).filter((p) => p.ativo !== false).length;
  const escaladas = criados.length ? escalarPorPessoa(dados, ativos(base.pessoal), ativos(dados.pessoal), cenario) : [];
  const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const ref = ano && mes ? ` · REF ${String(mes).padStart(2, "0")}/${ano}` : "";
  const pcs = pr.metaPecas ? ` · ${Math.round(pr.metaPecas).toLocaleString("pt-BR")} PÇ/MÊS${temPeriodo ? " (MÉDIA DO PERÍODO EM ABERTO)" : ""}` : "";
  const nome = `SIMULAÇÃO ${cenario} · ${data}${ref}${pcs}`;
  dados.simulacaoCapacidade = { cenario, meta: analise.meta, pctFreelancer: T.pct, contratados: criados.length, ano: ano || null, mes: mes || null, criadoEm: new Date().toISOString() };
  const m = await prisma.finMatriz.create({ data: { nome, oficial: false, dados, atualizadoPor: quem || "CAPACIDADE" } });
  return { id: m.id, nome, contratados: criados.length, criados, pct: T.pct, escaladas };
}
