// v234 — Capacidade → Matriz: cria uma SIMULAÇÃO (cópia da oficial) com o cenário escolhido.
//   A (manter a equipe): % de freelancer do cenário A na produção da simulação
//   B (recomendado): % de freelancer do B + funcionários hipotéticos nos setores com contratação,
//      com o SALÁRIO PREVISTO do setor (Capacidade); o resto segue as regras da Matriz (encargos, provisões)
//      e os valores digitados (VT, VR, plano de saúde, assistência) são a média dos funcionários da companhia
import { prisma } from "@/lib/prisma";
import { planoMensal } from "@/lib/capacidadeMensal";

import { SETOR_DEPTO, POR_PESSOA, escalarPorPessoa, mediasPessoal, salarioMedioDepto, funcionarioHipotetico, custoContratacao, aplicarContratados } from "@/lib/capacidadeHipoteticos";
export { SETOR_DEPTO, POR_PESSOA, escalarPorPessoa, mediasPessoal, salarioMedioDepto, funcionarioHipotetico, custoContratacao };   // v248: puras em capacidadeHipoteticos

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const CHAVE_SALARIOS = "CAPACIDADE|SALARIOS";

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
// v250 — metas: { ticket, margem } da tela de Metas (ainda não gravadas) — prevalecem sobre as gravadas
export async function criarSimulacao({ analise, cenario, ano, mes, quem, pecasMes, metas }) {
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
  if (Number(metas?.ticket) > 0) pr.ticketMedio = Number(metas.ticket);
  if (metas?.margem != null && metas.margem !== "" && Number.isFinite(Number(metas.margem))) pr.margemContribuicao = Number(metas.margem);
  pr.razaoInternaAuto = false;
  pr.razaoInternaManual = Math.round((1 - (T.pct || 0)) * 10000) / 10000;   // % de freelancer do cenário
  const inicio = ano && mes ? `${ano}-${String(mes).padStart(2, "0")}-01` : null;
  let criados = [], escaladas = [];
  if (cenario === "B") {
    // v242 — com o período: quem o plano mês a mês mantém no pico (contratados ainda não desligados); sem ele, o do mês de referência
    const n = Object.fromEntries(analise.setores.map((s) => [s.setor, plano ? plano.periodo.picoContratados[s.setor] || 0 : s.B?.contratar || 0]));
    ({ criados, escaladas } = aplicarContratados(dados, n, { salarios: await lerSalarios(), cenario, inicio }));   // v238/v248: + despesas por pessoa
  }
  // v242 — o ANO da simulação: meses fechados = realizado (vem da oficial na tela); meses em aberto = meta de cada mês (peças × ticket)
  if (temPeriodo) {
    const tk = Number(pr.ticketMedio) || 0;
    const mgO = base.metasGestao || {};
    const anoSim = Number(ano || analise.anoMetas) || null, mesmoAno = !anoSim || Number(mgO.ano) === anoSim;   // v251: realizado só do mesmo ano
    const fech = analise.fechados || (mesmoAno ? mgO.fechados : null) || Array(12).fill(false);
    dados.fechamento = { porMes: true, ano: anoSim, mes: mesmoAno ? mgO.mes || null : 1, fechados: fech, realizado: mesmoAno ? mgO.realizado || [] : Array(12).fill(null),
      fatMeses: pecasMes.map((p, i) => (fech[i] ? mgO.fatMeses?.[i] ?? (Number(p) || 0) * tk : (Number(p) || 0) * tk)),
      pcsMeses: pecasMes.map((p) => Number(p) || 0) };
    const abertos = pecasMes.filter((_, i) => !fech[i]);
    pr.metaPecas = Math.round(pecasMes.reduce((t, x) => t + (Number(x) || 0), 0) / 12);   // v247: média do ANO (realizado + metas)
  }
  const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const ref = ano && mes ? ` · REF ${String(mes).padStart(2, "0")}/${ano}` : "";
  const pcs = pr.metaPecas ? ` · ${Math.round(pr.metaPecas).toLocaleString("pt-BR")} PÇ/MÊS${temPeriodo ? " (MÉDIA DO ANO)" : ""}` : "";
  const nome = `SIMULAÇÃO ${cenario} · ${data}${ref}${pcs}`;
  dados.simulacaoCapacidade = { cenario, meta: analise.meta, pctFreelancer: T.pct, contratados: criados.length, ano: ano || null, mes: mes || null, criadoEm: new Date().toISOString() };
  const m = await prisma.finMatriz.create({ data: { nome, oficial: false, dados, atualizadoPor: quem || "CAPACIDADE" } });
  return { id: m.id, nome, contratados: criados.length, criados, pct: T.pct, escaladas };
}
