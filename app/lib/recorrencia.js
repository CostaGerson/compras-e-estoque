// v169 — regras de recorrência das Tarefas (usado no navegador e no servidor)
export const TIPOS_REC = [
  ["NENHUMA", "Não se repete"], ["DIARIA", "Todo dia útil (seg a sex)"], ["SEMANAL", "Toda semana"], ["QUINZENAL", "A cada 15 dias (quinzenal)"],
  ["MENSAL_DIA", "Todo mês no dia…"], ["MENSAL_NTH", "Todo mês na… (1ª segunda, última terça…)"], ["ANUAL", "Todo ano"],
];
export const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const ORDINAIS = [[1, "1ª"], [2, "2ª"], [3, "3ª"], [4, "4ª"], [-1, "última"]];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const somaDia = (s, n) => iso(new Date(dUTC(s).getTime() + n * 86400000));
const dow = (s) => dUTC(s).getUTCDay();
const ultimoDiaMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();   // m = 1..12

export function descreverRecorrencia(r) {
  if (!r || !r.tipo || r.tipo === "NENHUMA") return "";
  const fim = r.ate ? ` até ${r.ate.split("-").reverse().join("/")}` : "";
  switch (r.tipo) {
    case "DIARIA": return `todo dia útil${fim}`;
    case "SEMANAL": return `toda ${DIAS_SEMANA[r.dow]}${fim}`;
    case "QUINZENAL": return `a cada 15 dias (${DIAS_SEMANA[r.dow]})${fim}`;
    case "MENSAL_DIA": return `todo dia ${r.dia} do mês${fim}`;
    case "MENSAL_NTH": return `toda ${(ORDINAIS.find(([n]) => n === Number(r.n)) || [0, "?"])[1]} ${DIAS_SEMANA[r.dow]} do mês${fim}`;
    case "ANUAL": return `todo ano em ${r.dia} de ${MESES[(r.mes || 1) - 1]}${fim}`;
    default: return "";
  }
}

// normaliza a regra a partir da data inicial (preenche o que faltar)
export function normalizarRegra(r, inicio) {
  if (!r || !r.tipo || r.tipo === "NENHUMA") return null;
  const d = dUTC(inicio);
  const o = { tipo: r.tipo };
  if (["SEMANAL", "QUINZENAL", "MENSAL_NTH"].includes(r.tipo)) o.dow = r.dow === undefined || r.dow === "" ? d.getUTCDay() : Number(r.dow);
  if (["MENSAL_DIA", "ANUAL"].includes(r.tipo)) o.dia = Number(r.dia) || d.getUTCDate();
  if (r.tipo === "ANUAL") o.mes = Number(r.mes) || d.getUTCMonth() + 1;
  if (r.tipo === "MENSAL_NTH") o.n = Number(r.n) || Math.min(4, Math.ceil(d.getUTCDate() / 7));
  if (r.ate && /^\d{4}-\d{2}-\d{2}$/.test(r.ate)) o.ate = r.ate;
  return o;
}

function nthDoMes(a, m, n, w) {   // n = 1..4 ou -1 (última); w = dia da semana
  if (n === -1) {
    const u = ultimoDiaMes(a, m);
    for (let d = u; d > u - 7; d--) if (new Date(Date.UTC(a, m - 1, d)).getUTCDay() === w) return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  let cont = 0;
  for (let d = 1; d <= ultimoDiaMes(a, m); d++) {
    if (new Date(Date.UTC(a, m - 1, d)).getUTCDay() === w && ++cont === n) return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

// datas da série entre `de` e `ate` (inclusive), começando na data inicial da série
export function datasDaSerie(r, inicio, de, ate) {
  if (!r) return [];
  const fim = r.ate && r.ate < ate ? r.ate : ate;
  const ini = inicio > de ? inicio : de;
  const out = [];
  if (ini > fim) return out;
  if (r.tipo === "DIARIA") { for (let d = ini; d <= fim; d = somaDia(d, 1)) { const w = dow(d); if (w > 0 && w < 6) out.push(d); } }
  else if (r.tipo === "SEMANAL") { for (let d = ini; d <= fim; d = somaDia(d, 1)) if (dow(d) === r.dow) out.push(d); }
  else if (r.tipo === "QUINZENAL") {
    let p = inicio; while (dow(p) !== r.dow) p = somaDia(p, 1);
    for (; p <= fim; p = somaDia(p, 14)) if (p >= ini) out.push(p);
  } else if (r.tipo === "MENSAL_DIA" || r.tipo === "MENSAL_NTH" || r.tipo === "ANUAL") {
    let a = Number(ini.slice(0, 4)), m = Number(ini.slice(5, 7));
    for (let i = 0; i < 400; i++) {
      let d = null;
      if (r.tipo === "MENSAL_DIA") d = `${a}-${String(m).padStart(2, "0")}-${String(Math.min(r.dia, ultimoDiaMes(a, m))).padStart(2, "0")}`;
      else if (r.tipo === "MENSAL_NTH") d = nthDoMes(a, m, Number(r.n), r.dow);
      else if (m === r.mes) d = `${a}-${String(m).padStart(2, "0")}-${String(Math.min(r.dia, ultimoDiaMes(a, m))).padStart(2, "0")}`;
      if (d && d > fim) break;
      if (d && d >= ini) out.push(d);
      m++; if (m > 12) { m = 1; a++; }
      if (`${a}-${String(m).padStart(2, "0")}-01` > fim) break;
    }
  }
  return out;
}
