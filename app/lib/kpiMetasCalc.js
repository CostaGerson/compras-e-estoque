// v216 — coerência das metas (cálculo puro, usado na tela e no servidor):
//   vendas R$ é a meta que você define (v221) · peças = R$ ÷ ticket · peças faturadas = peças vendidas (produzidas = faturadas)
//   faturamento R$ = vendas R$ do mês · receita do mês = faturamento do mês anterior (JAN = DEZ do ano anterior)
const r2 = (v) => Math.round(Number(v) * 100) / 100;
const soma = (l) => (l.some((x) => x != null) ? l.reduce((s, x) => s + (Number(x) || 0), 0) : null);

// v221 — a meta que você define é VENDAS EM R$: peças = R$ ÷ ticket; faturamento R$ = vendas R$ do mês
// v241 — a meta que você define é o FATURAMENTO em R$ (como na Matriz): peças = R$ ÷ ticket; vendas R$ = faturamento R$ do mês;
//   receita do mês = faturamento do mês anterior. fixos: meses fechados (realizado no KPI) — o que vier preenchido vale no lugar do derivado
//   ({ vendasValor[], vendasPecas[], faturamentoPecas[], faturamentoValor[] }; um array simples = peças, formato antigo)
export function derivarMetas(faturamentoValor, ticket, receitaJan, fixos) {
  const fx = Array.isArray(fixos) ? { vendasPecas: fixos, faturamentoPecas: fixos } : fixos || {};
  const fb = (faturamentoValor || []).slice(0, 12).map((x) => (x == null || x === "" ? null : r2(Number(x))));
  while (fb.length < 12) fb.push(null);
  const tk = ticket == null || ticket === "" || !Number(ticket) ? null : Number(ticket);
  const fix = (arr, base, inteiro) => base.map((v, i) => (arr?.[i] != null ? (inteiro ? Math.round(Number(arr[i])) : r2(Number(arr[i]))) : v));
  const fv = fix(fx.faturamentoValor, fb, false);
  const pc = fv.map((v) => (v == null || tk == null ? null : Math.round(v / tk)));
  const vv = fix(fx.vendasValor, fv, false);
  const vp = fix(fx.vendasPecas, pc, true), fp = fix(fx.faturamentoPecas, pc, true);
  const rec = fv.map((_, i) => (i === 0 ? (receitaJan == null ? null : r2(receitaJan)) : fv[i - 1]));
  const lin = (meses, inteiro) => { const s = soma(meses); return { meses, anual: s == null ? null : inteiro ? Math.round(s) : r2(s) }; };
  return {
    vendasValor: lin(vv), vendasPecas: lin(vp, true),
    faturamentoPecas: lin(fp, true), faturamentoValor: lin(fv),
    receitaValor: lin(rec),
  };
}
