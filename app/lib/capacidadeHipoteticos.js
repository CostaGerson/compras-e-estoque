// v248 — funções puras dos funcionários hipotéticos (rodam no servidor — Simulação B — e na tela de Metas, ao vivo)
import { calcFuncionario } from "@/lib/matriz";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
export const SETOR_DEPTO = { CORTE: "COR", COSTURA: "COS", SILK: "SIL", BORDADO: "BOR", "EXPEDIÇÃO": "EXP", "LOGÍSTICA": "LOG" };
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

// v248 — põe na matriz (MUTA dados) os contratados do cenário: n por setor (pico do plano), com o salário previsto
//   e escala as despesas por pessoa. salarios = { SETOR: valor } (previsto); sem ele, média do depto / companhia
export function aplicarContratados(dados, contratados, { salarios = {}, cenario = "B", inicio = null } = {}) {
  const ativos = (l) => (l || []).filter((p) => p.ativo !== false).length;
  const antes = ativos(dados.pessoal);
  const medias = mediasPessoal(dados);
  const criados = [];
  for (const [setor, n] of Object.entries(contratados || {})) {
    const depto = SETOR_DEPTO[setor];
    if (!n || !depto) continue;
    const sal = Number(salarios[setor]) || salarioMedioDepto(dados, depto) || medias.salario;
    for (let i = 1; i <= n; i++) {
      dados.pessoal = [...(dados.pessoal || []), funcionarioHipotetico({ setor, depto, salario: sal, medias, i, cenario, inicio })];
      criados.push({ setor, salario: sal, previsto: !!Number(salarios[setor]) });
    }
  }
  const escaladas = criados.length ? escalarPorPessoa(dados, antes, ativos(dados.pessoal), cenario) : [];
  return { criados, escaladas };
}
