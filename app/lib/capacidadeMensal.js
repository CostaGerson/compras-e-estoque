// v230 — Capacidade mês a mês para a meta (puro: roda na tela de Metas, ao vivo).
// Por setor, com a produtividade do histórico (peças por trabalhador) e a diária do freelancer:
//   necessários no mês = peças da meta ÷ peças por trabalhador
// Regras (decisão do usuário):
//   · contratar quando a necessidade passa de 1 freelancer por dia útil por MAIS de um mês útil inteiro
//     (2 meses seguidos ou mais) — risco trabalhista acima da economia do freelancer; pico de 1 mês fica com freelancer
//   · depois do período, demitir o excedente quando sobra ≥ 1 pessoa por 2 meses seguidos ou mais
//     (só quem foi contratado no plano — a equipe atual não entra na conta de demissão)
import { diasUteis } from "@/lib/diasUteis";

const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

// v234 — fechados[m]: mês já realizado no KPI — só mostra; contratar/desligar só nos meses em aberto
// v242 — semContratar: cenário A (manter a equipe: tudo o que falta vira freelancer, mês a mês)
export function planoMensal({ setores, pecasMes, ano, fechados = [], semContratar = false }) {
  const comps = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const du = comps.map(diasUteis);
  const linhas = [];
  for (const s of setores || []) {
    if (!s.porTrab || !s.diaria) continue;
    const base = Math.round(s.pessoas || 0);
    const nec = pecasMes.map((p) => (p ? p / s.porTrab : 0));
    let H = base;
    const meses = [];
    for (let m = 0; m < 12; m++) {
      let contratar = 0, demitir = 0;
      // contratação: necessidade extra > 1 neste mês e no seguinte (com a equipe de agora)
      const ext = (k) => (k < 12 ? nec[k] - H : 0);
      if (!semContratar && !fechados[m] && ext(m) > 1 && ext(m + 1) > 1) {
        // contrata o que se mantém pelo período (menor necessidade inteira enquanto passar de 1)
        let k = m, menor = Infinity;
        while (k < 12 && ext(k) > 1) { menor = Math.min(menor, Math.floor(ext(k) + 0.01)); k++; }
        contratar = Math.max(1, menor);
        H += contratar;
      }
      // demissão: sobra ≥ 1 neste mês e no seguinte, só entre os contratados no plano
      const sobra = (k) => (k < 12 ? H - nec[k] : H - nec[11]);
      if (!fechados[m] && !contratar && H > base && sobra(m) >= 1 && sobra(m + 1) >= 1) {
        let k = m, menor = Infinity;
        while (k < 12 && sobra(k) >= 1) { menor = Math.min(menor, Math.floor(sobra(k) + 0.01)); k++; }
        demitir = Math.min(H - base, Math.max(1, menor));
        H -= demitir;
      }
      const freeDia = Math.max(0, Math.ceil(nec[m] - H - 0.01));   // v237: freelancer sempre arredondado para cima
      // v234 — quem entra no plano custa o salário previsto do setor (com encargos da Matriz); sem ele, o custo médio do setor
      const folha = base * (s.custoPessoa || 0) + Math.max(0, H - base) * (s.custoContratacao || s.custoPessoa || 0);
      const freelancer = freeDia * du[m] * s.diaria;
      meses.push({ fechado: !!fechados[m], comp: comps[m], necessarios: r1(nec[m]), equipe: H, contratar, demitir, freeDia: r1(freeDia), diarias: Math.round(freeDia * du[m]),
        folha: Math.round(folha), freelancer: Math.round(freelancer), ociosos: r1(Math.max(0, H - nec[m])) });
    }
    linhas.push({ setor: s.setor, base, porTrab: s.porTrab, diaria: s.diaria, meses });
  }
  const total = comps.map((c, m) => {
    const t = { comp: c, diasUteis: du[m], contratar: 0, demitir: 0, freeDia: 0, folha: 0, freelancer: 0, equipe: 0 };
    for (const l of linhas) { const x = l.meses[m]; t.contratar += x.contratar; t.demitir += x.demitir; t.freeDia += x.freeDia; t.folha += x.folha; t.freelancer += x.freelancer; t.equipe += x.equipe; }
    t.freeDia = Math.round(t.freeDia); t.pct = t.folha + t.freelancer > 0 ? t.freelancer / (t.folha + t.freelancer) : null;
    return t;
  });
  const ano_ = { folha: total.reduce((a, t) => a + t.folha, 0), freelancer: total.reduce((a, t) => a + t.freelancer, 0), contratar: total.reduce((a, t) => a + t.contratar, 0), demitir: total.reduce((a, t) => a + t.demitir, 0) };
  ano_.pct = ano_.folha + ano_.freelancer > 0 ? ano_.freelancer / (ano_.folha + ano_.freelancer) : null;
  // v242 — período em aberto (o que dá para mexer): totais, pico de freelancers/dia e quadro contratado no pico por setor
  const ab = total.filter((_, m) => !fechados[m]);
  const periodo = { meses: ab.length, folha: ab.reduce((a, t) => a + t.folha, 0), freelancer: ab.reduce((a, t) => a + t.freelancer, 0),
    contratar: ab.reduce((a, t) => a + t.contratar, 0), demitir: ab.reduce((a, t) => a + t.demitir, 0),
    picoFreeDia: ab.reduce((a, t) => Math.max(a, t.freeDia), 0), diarias: linhas.reduce((a, l) => a + l.meses.filter((x) => !x.fechado).reduce((b, x) => b + x.diarias, 0), 0),
    picoContratados: Object.fromEntries(linhas.map((l) => [l.setor, Math.max(0, ...l.meses.filter((x) => !x.fechado).map((x) => x.equipe - l.base))])) };
  // v253 — freelancers por dia útil, em média, no período (entram na conta das despesas por pessoa)
  periodo.diasUteis = ab.reduce((a, t) => a + t.diasUteis, 0);
  periodo.freeDiaMedio = periodo.diasUteis ? periodo.diarias / periodo.diasUteis : 0;
  periodo.custo = periodo.folha + periodo.freelancer;
  periodo.pct = periodo.custo > 0 ? periodo.freelancer / periodo.custo : null;
  return { linhas, total, ano: ano_, periodo };
}
