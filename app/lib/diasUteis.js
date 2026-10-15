// v230 — dias úteis (puro, usado no servidor e na tela)
// v229.1 — dias úteis de AAAA-MM: segunda a sexta, sem feriados nacionais (fixos + Carnaval, Sexta-feira Santa e Corpus Christi)
const FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
function pascoa(ano) {   // algoritmo de Meeus
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}
export function feriados(ano) {
  const p = pascoa(ano), dia = (n) => new Date(p + n * 86400000).toISOString().slice(5, 10);
  return new Set([...FIXOS, dia(-48), dia(-47), dia(-2), dia(60)]);   // carnaval (seg e ter), sexta-feira santa, corpus christi
}
export function diasUteis(comp) {
  const [a, m] = comp.split("-").map(Number);
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate(), F = feriados(a);
  let d = 0;
  for (let i = 1; i <= n; i++) {
    const dt = new Date(Date.UTC(a, m - 1, i)), w = dt.getUTCDay();
    if (w > 0 && w < 6 && !F.has(dt.toISOString().slice(5, 10))) d++;
  }
  return d;
}

