"use client";
// v157 — DFC · fluxo de caixa futuro (regime de caixa), por dia, com sugestões de operação
import React, { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Lightbulb, Info, Landmark } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const DSEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const somaDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); const x = new Date(a, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const segunda = (iso) => { const [a, m, d] = iso.split("-").map(Number); const w = new Date(a, m - 1, d).getDay(); return somaDias(iso, w === 0 ? -6 : 1 - w); };
const fimMes = (iso) => { const [a, m] = iso.split("-").map(Number); return `${a}-${String(m).padStart(2, "0")}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; };
const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };
const NIVEL = { ALERTA: [AlertTriangle, C.red, C.redSoft], OPERACAO: [Lightbulb, C.accent, C.accentSoft], AVISO: [Info, C.yellow, C.yellowSoft], OK: [CheckCircle2, C.green, C.greenSoft] };

function Kpi({ rotulo, valor, sub, cor }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>{rotulo}</div>
      <div className="text-xl font-bold mt-1" style={{ color: cor || C.navy }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}

export default function Dfc({ user }) {
  const [dIni, setDIni] = useState(hojeISO());
  const [dFim, setDFim] = useState(fimMes(hojeISO()));
  const [ap, setAp] = useState(true);
  const [ar, setAr] = useState(false);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState({});
  const [soMov, setSoMov] = useState(true);
  useEffect(() => {
    setD(null);
    fetch(`/api/fin/dfc?u=${user.id}&dIni=${dIni}&dFim=${dFim < dIni ? dIni : dFim}&ap=${ap ? 1 : 0}&ar=${ar ? 1 : 0}`).then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setD(j); setErro(""); }).catch((e) => setErro(e.message));
  }, [dIni, dFim, ap, ar]);
  const h = hojeISO();
  const atalhos = [["Hoje", h, h], ["Semana atual", segunda(h), somaDias(segunda(h), 6)], ["Mês", `${h.slice(0, 7)}-01`, fimMes(h)]];
  const r = d?.resumo;
  const dias = d ? d.dias.filter((x) => !soMov || x.entradas || x.saidas || x.data === d.resumo.ini || x.data === d.resumo.fim) : [];
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="text-xs" style={{ color: C.sub }}>De<input type="date" value={dIni} onChange={(e) => e.target.value && setDIni(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Até<input type="date" value={dFim} min={dIni} onChange={(e) => e.target.value && setDFim(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <div className="flex gap-1 pb-0.5">
          {atalhos.map(([t, a, b]) => (
            <button key={t} onClick={() => { setDIni(a); setDFim(b); }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={dIni === a && dFim === b ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}55` } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
          ))}
        </div>
        <div className="flex-1" />
        <label className="text-xs flex items-center gap-1.5" style={{ color: C.sub }}><input type="checkbox" checked={ap} onChange={(e) => setAp(e.target.checked)} /> atrasados a pagar entram hoje</label>
        <label className="text-xs flex items-center gap-1.5" style={{ color: C.sub }}><input type="checkbox" checked={ar} onChange={(e) => setAr(e.target.checked)} /> atrasados a receber entram hoje</label>
        <label className="text-xs flex items-center gap-1.5" style={{ color: C.sub }}><input type="checkbox" checked={soMov} onChange={(e) => setSoMov(e.target.checked)} /> só dias com movimento</label>
      </div>
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Calculando…</div>}
      {d && (
        <>
          <div className="rounded-xl p-3 mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs" style={{ background: C.navy, color: "#fff" }}>
            <span className="flex items-center gap-1.5 font-semibold"><Landmark size={14} style={{ color: C.accent }} /> Caixa atual {moeda(d.caixa.saldo)}</span>
            {d.caixa.bancos.map((b) => <span key={b.nome} style={{ color: "rgba(255,255,255,.75)" }}>{b.nome}: {moeda(b.saldo)}{b.limite ? ` · limite livre ${moeda(b.livre)}` : ""}</span>)}
            <span style={{ color: "rgba(255,255,255,.6)" }}>{d.caixa.origem ? `do Painel de previsão de ${d.caixa.origem.competencia.split("-").reverse().join("/")} · ${new Date(d.caixa.origem.em).toLocaleDateString("pt-BR")}` : "sem caixa informado"}</span>
          </div>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
            <Kpi rotulo="Saldo inicial" valor={moeda(r.saldoInicial)} sub={`em ${dBR(r.ini)}`} cor={r.saldoInicial < 0 ? C.red : C.navy} />
            <Kpi rotulo="Entradas" valor={moeda(r.entradas)} sub="contas a receber" cor={C.green} />
            <Kpi rotulo="Saídas" valor={moeda(r.saidas)} sub="contas a pagar" cor={C.red} />
            <Kpi rotulo="Resultado do período" valor={moeda(r.resultado)} cor={r.resultado < 0 ? C.red : C.green} />
            <Kpi rotulo="Saldo final" valor={moeda(r.saldoFinal)} sub={`em ${dBR(r.fim)}`} cor={r.saldoFinal < 0 ? C.red : C.navy} />
            <Kpi rotulo="Menor saldo" valor={r.menorSaldo ? moeda(r.menorSaldo.valor) : "—"} sub={r.menorSaldo ? `em ${dBR(r.menorSaldo.data)}${r.diasNegativos ? ` · ${r.diasNegativos} dia(s) negativo(s)` : ""}` : ""} cor={r.menorSaldo?.valor < 0 ? C.red : C.navy} />
          </div>
          {r.sugestoes.length > 0 && (
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              {r.sugestoes.map((s, i) => {
                const [Ico, cor, bg] = NIVEL[s.nivel] || NIVEL.AVISO;
                return (
                  <div key={i} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${cor}44` }}>
                    <div className="flex items-center gap-1.5 text-sm font-bold mb-1" style={{ color: cor }}><Ico size={15} /> {s.titulo}</div>
                    <div className="text-xs" style={{ color: C.text }}>{s.texto}</div>
                    {s.titulos?.length > 0 && <div className="text-[11px] mt-1.5" style={{ color: C.sub }}>Maiores: {s.titulos.map((t) => `${t.parceiro} ${moeda(t.valor)} (${dBR(t.vencimento)})`).join(" · ")}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-sm">
              <thead><tr className="text-xs uppercase tracking-wide text-left" style={{ background: C.panel2, color: C.sub }}>
                <th className="px-3 py-2 w-8" /><th className="px-3 py-2">Dia</th><th className="px-3 py-2 text-right">Entradas</th><th className="px-3 py-2 text-right">Saídas</th>
                <th className="px-3 py-2 text-right">Resultado do dia</th><th className="px-3 py-2 text-right">Saldo projetado</th>
              </tr></thead>
              <tbody>
                {dias.map((x) => {
                  const ab = aberto[x.data], tem = x.receber.length || x.pagar.length;
                  return (
                    <React.Fragment key={x.data}>
                      <tr style={{ borderTop: `1px solid ${C.line}`, background: x.saldo < 0 ? C.redSoft : x.data === r.hoje ? C.accentSoft : undefined, cursor: tem ? "pointer" : "default" }}
                        onClick={() => tem && setAberto((a) => ({ ...a, [x.data]: !a[x.data] }))}>
                        <td className="px-3 py-2" style={{ color: C.sub }}>{tem ? (ab ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: C.navy }}>{dBR(x.data)} <span className="font-normal text-xs" style={{ color: C.sub }}>{DSEM[new Date(`${x.data}T12:00:00`).getDay()]}{x.data === r.hoje ? " · hoje" : ""}</span></td>
                        <td className="px-3 py-2 text-right" style={{ color: x.entradas ? C.green : C.sub }}>{x.entradas ? moeda(x.entradas) : "—"}</td>
                        <td className="px-3 py-2 text-right" style={{ color: x.saidas ? C.red : C.sub }}>{x.saidas ? moeda(x.saidas) : "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold" style={{ color: x.resultado < 0 ? C.red : x.resultado > 0 ? C.green : C.sub }}>{moeda(x.resultado)}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color: x.saldo < 0 ? C.red : C.navy }}>{moeda(x.saldo)}</td>
                      </tr>
                      {ab && [...x.receber.map((t) => ({ ...t, e: true })), ...x.pagar].map((t) => (
                        <tr key={`${x.data}-${t.id}`} className="text-xs" style={{ background: C.panel2 }}>
                          <td />
                          <td className="px-3 py-1.5" colSpan={1}><span className="font-semibold" style={{ color: t.e ? C.green : C.red }}>{t.e ? "▲ receber" : "▼ pagar"}</span>{t.atrasado && <span style={{ color: C.yellow }}> · atrasada ({dBR(t.vencimento)})</span>}{t.previsao && <span style={{ color: C.sub }}> · previsão</span>}</td>
                          <td className="px-3 py-1.5" colSpan={2}><b style={{ color: C.navy }}>{t.titulo}</b> <span style={{ color: C.sub }}>· {t.parceiro}</span></td>
                          <td className="px-3 py-1.5 text-right font-semibold" style={{ color: t.e ? C.green : C.red }}>{t.e ? "" : "−"}{moeda(t.valor)}</td>
                          <td />
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                <tr style={{ borderTop: `2px solid ${C.line}`, background: C.panel2 }}>
                  <td /><td className="px-3 py-2 font-bold" style={{ color: C.navy }}>Total do período</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: C.green }}>{moeda(r.entradas)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: C.red }}>{moeda(r.saidas)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: r.resultado < 0 ? C.red : C.green }}>{moeda(r.resultado)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: r.saldoFinal < 0 ? C.red : C.navy }}>{moeda(r.saldoFinal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-[11px] mt-2" style={{ color: C.sub }}>
            Regime de caixa: contas em aberto pelo vencimento. O saldo é projetado a partir de hoje com o caixa do Painel de previsão; um período futuro já começa com tudo que entra e sai até ele. Clique no dia para ver as contas.
          </div>
        </>
      )}
    </div>
  );
}
