// v216 — coerência das metas (cálculo puro, usado na tela e no servidor):
//   vendas (peças) é a meta que você define · peças faturadas = peças vendidas do mês (produzidas = faturadas)
//   vendas R$ e faturamento R$ = peças × ticket médio · receita do mês = faturamento do mês anterior (JAN = DEZ do ano anterior)
const r2 = (v) => Math.round(Number(v) * 100) / 100;
const soma = (l) => (l.some((x) => x != null) ? l.reduce((s, x) => s + (Number(x) || 0), 0) : null);

export function derivarMetas(vendasPecas, ticket, receitaJan) {
  const vp = (vendasPecas || []).slice(0, 12).map((x) => (x == null || x === "" ? null : Math.round(Number(x))));
  while (vp.length < 12) vp.push(null);
  const tk = ticket == null || ticket === "" ? null : Number(ticket);
  const rs = vp.map((p) => (p == null || tk == null ? null : r2(p * tk)));
  const rec = rs.map((_, i) => (i === 0 ? (receitaJan == null ? null : r2(receitaJan)) : rs[i - 1]));
  const lin = (meses, pc) => { const s = soma(meses); return { meses, anual: s == null ? null : pc ? Math.round(s) : r2(s) }; };
  return {
    vendasPecas: lin(vp, true), vendasValor: lin(rs),
    faturamentoPecas: lin(vp, true), faturamentoValor: lin(rs),
    receitaValor: lin(rec),
  };
}
