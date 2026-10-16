// v275 — freelancers/dia ajustados à mão na simulação: recalcula freelancer/mês e % freelancer
// freelancer/mês = freelancers/dia × dias úteis médios × diária · % = Σfree ÷ (Σfolha + Σfree)
// folha do setor = a do cenário aplicado (B inclui as contratações); setor sem diária fica com o valor de hoje.
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function freeDiaBase(s, cen) {
  if (s.semDiaria) return null;
  if (cen === "A" && s.A) return s.A.freeDia;
  if (cen === "B" && s.B) return s.B.freeDia;
  return s.freeDia ?? 0;
}

export function calcularAjuste(cap, cen, ajustes = {}) {
  const du = Number(cap?.diasUteisMedio) || 21;
  let folha = 0, free = 0;
  const setores = (cap?.setores || []).map((s) => {
    const fl = cen === "B" && s.B ? Number(s.B.folha) || 0 : Number(s.folha) || 0;
    if (s.semDiaria) { folha += fl; free += Number(s.freelancer) || 0; return { setor: s.setor, semDiaria: true, folha: r2(fl), freelancer: r2(s.freelancer) }; }
    const base = freeDiaBase(s, cen) || 0;
    const q = ajustes[s.setor] != null ? Math.max(0, Number(ajustes[s.setor]) || 0) : base;
    // sem mexer no setor, vale o freelancer do cenário (hoje = o realmente pago na média dos 3 meses)
    const fr = q === base ? Number(cen === "A" && s.A ? s.A.freelancer : cen === "B" && s.B ? s.B.freelancer : s.freelancer) || 0 : q * du * (Number(s.diaria) || 0);
    folha += fl; free += fr;
    return { setor: s.setor, base, freeDia: q, folha: r2(fl), freelancer: r2(fr), pct: fl + fr > 0 ? fr / (fl + fr) : null };
  });
  const pct = folha + free > 0 ? Math.round((free / (folha + free)) * 10000) / 10000 : 0;
  return { setores, folha: r2(folha), freelancer: r2(free), pct, diasUteis: du };
}
