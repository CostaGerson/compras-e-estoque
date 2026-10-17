// v270 — realidade atual da operação para a Matriz (oficial e simulações):
//   contribuição bruta por peça (Análises operacionais: corte + personalização + costura + expedição, média dos últimos 3 meses)
//   e o % de freelancer oficial (folha × freelancers do extrato, últimos 3 meses fechados).
import { resumoVolta } from "@/lib/opAnalise";

export async function operacaoReal() {
  const r = await resumoVolta().catch(() => null);
  if (!r) return null;
  const s = r.setores || {};
  return {
    bruta: r.producao ?? r.total ?? 0, logistica: r.logistica || 0, logMeses: r.setores?.LOGISTICA?.meses || [], liquida: r.liquida || 0, pctFree: r.freelancer?.pct ?? null,
    meses: r.freelancer?.meses || [], folha: r.freelancer?.folha || 0, freelancer: r.freelancer?.freelancer || 0,
    etapas: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { valor: v.valor, meses: v.meses, base: v.base }])),
    em: new Date().toISOString(),
  };
}
export async function comOperacaoReal(dados) {
  const op = await operacaoReal().catch(() => null);
  return op ? { ...dados, operacaoReal: op } : dados;
}
