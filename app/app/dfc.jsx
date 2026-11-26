"use client";
// v157 — DFC · fluxo de caixa futuro (regime de caixa), por dia, com sugestões de operação
import React, { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

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
        {/* v1137 — dia único */}
        <label className="text-xs" style={{ color: C.sub }} title="Dia único: De e Até no mesmo dia">Dia<input type="date" value={dIni && dIni === dFim ? dIni : ""} onChange={(e) => { const v = e.target.value; if (v) { setDIni(v); setDFim(v); } }} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={{ ...inpS, ...(dIni && dIni === dFim ? { borderColor: C.accent } : {}) }} /></label>
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
          {/* v1140 — visão simples: uma linha de resumo e o caixa previsto dia a dia (sem cards de insights) */}
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-3 px-1 text-sm">
            <span style={{ color: C.sub }}>Saldo em {dBR(r.ini)} <b style={{ color: r.saldoInicial < 0 ? C.red : C.navy }}>{moeda(r.saldoInicial)}</b></span>
            <span style={{ color: C.sub }}>Entradas <b style={{ color: C.green }}>+{moeda(r.entradas)}</b></span>
            <span style={{ color: C.sub }}>Saídas <b style={{ color: C.red }}>−{moeda(r.saidas)}</b></span>
            <span style={{ color: C.sub }}>Saldo em {dBR(r.fim)} <b style={{ color: r.saldoFinal < 0 ? C.red : C.navy }}>{moeda(r.saldoFinal)}</b></span>
            {r.menorSaldo && r.menorSaldo.valor < 0 && <span className="text-xs" style={{ color: C.red }}>menor saldo {moeda(r.menorSaldo.valor)} em {dBR(r.menorSaldo.data)}</span>}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            {dias.map((x) => {
              const itens = [...x.receber.map((t) => ({ ...t, e: true })), ...x.pagar];
              const ab = aberto[x.data] ?? itens.length <= 12;   // dia com muitas contas começa fechado
              const hoje = x.data === r.hoje;
              return (
                <div key={x.data} style={{ borderTop: `1px solid ${C.line}` }}>
                  <button type="button" onClick={() => itens.length && setAberto((a) => ({ ...a, [x.data]: !ab }))}
                    className="w-full flex flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-2.5 text-left" style={{ background: hoje ? C.accentSoft : C.panel2, cursor: itens.length ? "pointer" : "default" }}>
                    <span className="flex items-center gap-1.5 font-bold" style={{ color: C.navy, minWidth: 150 }}>
                      {itens.length ? (ab ? <ChevronDown size={14} style={{ color: C.sub }} /> : <ChevronRight size={14} style={{ color: C.sub }} />) : <span style={{ width: 14 }} />}
                      {DSEM[new Date(`${x.data}T12:00:00`).getDay()]} {dBR(x.data).slice(0, 5)}{hoje && <span className="text-[11px] font-semibold" style={{ color: C.accent }}>hoje</span>}
                    </span>
                    <span className="text-xs" style={{ color: C.sub }}>{itens.length ? `${itens.length} conta(s)` : "sem movimento"}</span>
                    <span className="flex-1" />
                    {x.entradas > 0 && <span className="text-sm tabular-nums" style={{ color: C.green }}>+{moeda(x.entradas)}</span>}
                    {x.saidas > 0 && <span className="text-sm tabular-nums" style={{ color: C.red }}>−{moeda(x.saidas)}</span>}
                    <span className="text-sm tabular-nums font-bold text-right" style={{ color: x.saldo < 0 ? C.red : C.navy, minWidth: 150 }}>saldo {moeda(x.saldo)}</span>
                  </button>
                  {ab && itens.map((t) => (
                    <div key={`${x.data}-${t.e ? "r" : "p"}-${t.id}`} className="flex items-center gap-3 px-4 py-1.5 text-sm" style={{ borderTop: `1px solid ${C.line}66` }}>
                      <span className="w-4 text-center font-bold" style={{ color: t.e ? C.green : C.red }}>{t.e ? "+" : "−"}</span>
                      <span className="flex-1 min-w-0 truncate"><span style={{ color: C.text }}>{t.titulo}</span> <span style={{ color: C.sub }}>· {t.parceiro}</span>
                        {t.atrasado && <span className="text-xs" style={{ color: C.yellow }}> · venceu {dBR(t.vencimento)}</span>}{t.previsao && <span className="text-xs" style={{ color: C.sub }}> · previsão</span>}</span>
                      <span className="tabular-nums whitespace-nowrap" style={{ color: t.e ? C.green : C.red }}>{t.e ? "" : "−"}{moeda(t.valor)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {!dias.length && <div className="px-4 py-6 text-sm text-center" style={{ color: C.sub }}>Nada previsto no período.</div>}
          </div>
          <div className="text-[11px] mt-2" style={{ color: C.sub }}>
            Contas em aberto pelo vencimento, a partir do caixa {d.caixa.origem ? `do Painel de previsão (${dBR(d.caixa.origem.em)})` : "atual"}: {moeda(d.caixa.saldo)}. Clique no dia para abrir ou fechar as contas.
          </div>
        </>
      )}
    </div>
  );
}
