"use client";
// v213 — Página de METAS (Gestão): meta anual por natureza e distribuição mês a mês.
// Meta anual nova → redistribui os meses mantendo a proporção atual, ou pela distribuição histórica.
// Mês alterado à mão fica travado; os demais recebem a sugestão para fechar a meta do ano.
import React, { useState, useEffect, useRef } from "react";
import { Lock, Unlock, Save, Loader2, History, RotateCcw, Target } from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const JANELAS = [["total", "Todo o período registrado"], ["dois", "Últimos 2 anos"], ["um", "Último ano"]];
const api = async (url, method, body) => {
  const r = await fetch(url, method ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro na operação.");
  return d;
};
const r2 = (v) => Math.round(Number(v) * 100) / 100;
const arred = (un, v) => (un === "pc" ? Math.round(v) : r2(v));
const fmt = (un, v) => (v == null || v === "" ? "" : un === "pc" ? Math.round(Number(v)).toLocaleString("pt-BR") : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const ler = (t) => { const s = String(t ?? "").trim(); if (!s) return null; const x = Number(s.replace(/\./g, "").replace(",", ".")); return isNaN(x) ? null : x; };

// distribui o que falta da meta do ano entre os meses livres, na proporção dos pesos
export function redistribuir(un, anual, meses, travados, pesos) {
  if (anual == null) return meses;
  const livres = [...Array(12).keys()].filter((i) => !travados.has(i));
  if (!livres.length) return meses;
  const fixo = [...travados].reduce((s, i) => s + (Number(meses[i]) || 0), 0);
  const resto = anual - fixo;
  const p = livres.map((i) => Math.max(0, Number(pesos?.[i]) || 0));
  const sp = p.reduce((s, x) => s + x, 0);
  const novo = [...meses];
  livres.forEach((i, k) => { novo[i] = arred(un, resto * (sp ? p[k] / sp : 1 / livres.length)); });
  // sobra do arredondamento vai para o maior mês livre
  const dif = arred(un, anual - novo.reduce((s, x) => s + (Number(x) || 0), 0));
  if (dif) { const maior = livres.reduce((m, i) => (Number(novo[i]) > Number(novo[m]) ? i : m), livres[0]); novo[maior] = arred(un, Number(novo[maior]) + dif); }
  return novo;
}

function Campo({ un, valor, onCommit, estilo, titulo, grande }) {
  const [t, setT] = useState(fmt(un, valor));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setT(fmt(un, valor)); }, [valor, un]);
  return (
    <input value={t} title={titulo} inputMode="decimal"
      onFocus={(e) => { foco.current = true; e.target.select(); }}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => { foco.current = false; const v = ler(t); if ((v ?? null) !== (valor ?? null)) onCommit(v); else setT(fmt(un, valor)); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      className={`w-full rounded-lg px-2 py-1.5 text-right tabular-nums outline-none ${grande ? "text-base font-bold" : "text-sm"}`}
      style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text, ...estilo }} />
  );
}

function CardNatureza({ n, set, original }) {
  const [hist, setHist] = useState(false);   // mostra a opção de distribuição histórica (depois de mexer na meta do ano)
  const [jan, setJan] = useState("total");
  const total = n.meses.reduce((s, x) => s + (Number(x) || 0), 0);
  const dif = n.anual == null ? 0 : arred(n.un, n.anual - total);
  const H = n.historico?.[jan];
  const somaH = H?.medias ? H.medias.reduce((s, x) => s + x, 0) : 0;
  const mult = H?.medias && n.anual ? n.anual / somaH : null;

  const mudarAnual = (v) => {
    setHist(true);
    set({ ...n, anual: v == null ? null : arred(n.un, v), meses: redistribuir(n.un, v, n.meses, n.travados, n.pesos) });
  };
  const usarHist = () => {
    if (!H?.medias) return;
    set({ ...n, pesos: H.medias, fonte: jan, meses: redistribuir(n.un, n.anual, n.meses, n.travados, H.medias) });
  };
  const mudarMes = (i, v) => {
    const trav = new Set(n.travados); trav.add(i);
    const meses = [...n.meses]; meses[i] = v == null ? 0 : arred(n.un, v);
    set({ ...n, travados: trav, meses: redistribuir(n.un, n.anual, meses, trav, n.pesos) });
  };
  const soltar = (i) => {
    const trav = new Set(n.travados); trav.delete(i);
    set({ ...n, travados: trav, meses: redistribuir(n.un, n.anual, n.meses, trav, n.pesos) });
  };
  const mexido = JSON.stringify([n.anual, n.meses]) !== JSON.stringify([original.anual, original.meses]);

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${mexido ? C.accent : C.line}` }}>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>{n.grupo.toUpperCase()}</div>
          <div className="font-bold" style={{ color: C.navy }}>{n.rotulo}</div>
        </div>
        <label className="block" style={{ width: 200 }}>
          <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>Meta do ano{n.un === "R$" ? " (R$)" : " (peças)"}</div>
          <Campo un={n.un} valor={n.anual} onCommit={mudarAnual} grande />
        </label>
        {mexido && <button onClick={() => { setHist(false); set({ ...original, travados: new Set(), pesos: original.meses }); }} title="Voltar ao que está gravado"
          className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs" style={{ color: C.sub }}><RotateCcw size={13} /> desfazer</button>}
      </div>

      {hist && n.anual != null && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg mb-3 text-xs" style={{ background: C.blueSoft }}>
          <History size={14} style={{ color: C.blue }} />
          <span style={{ color: C.navy }}>Usar distribuição histórica:</span>
          <select value={jan} onChange={(e) => setJan(e.target.value)} className="rounded px-2 py-1 text-xs" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
            {JANELAS.map(([k, t]) => <option key={k} value={k} disabled={!n.historico?.[k]?.medias}>{t}{n.historico?.[k]?.anos?.length ? ` (${n.historico[k].anos.slice().sort().join(", ")})` : " — sem dado"}</option>)}
          </select>
          <button onClick={usarHist} disabled={!H?.medias} className="px-3 py-1 rounded font-semibold text-white" style={{ background: H?.medias ? C.blue : C.sub }}>Aplicar</button>
          {mult != null && <span style={{ color: C.sub }}>multiplicador sobre a média histórica: <b style={{ color: C.navy }}>{mult.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}×</b></span>}
        </div>
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
        {MESES.map((m, i) => {
          const trav = n.travados.has(i);
          const sug = !trav && mexido && Number(n.meses[i]) !== Number(original.meses[i]);
          return (
            <label key={m} className="block">
              <div className="flex items-center text-[11px] font-semibold mb-1" style={{ color: C.sub }}>
                <span className="flex-1">{m}</span>
                {trav ? <button type="button" onClick={() => soltar(i)} title="Valor fixado por você — clique para soltar e receber a sugestão" style={{ color: C.navy }}><Lock size={11} /></button>
                  : sug ? <span style={{ color: C.accent, fontSize: 10 }}>sugestão</span> : null}
              </div>
              <Campo un={n.un} valor={n.meses[i]} onCommit={(v) => mudarMes(i, v)}
                estilo={trav ? { borderColor: C.navy, fontWeight: 700 } : sug ? { borderColor: C.accent, color: C.accent, background: C.accentSoft } : {}} />
              {n.fonte && n.historico?.[n.fonte]?.medias && <div className="text-[10px] text-right mt-0.5" style={{ color: C.sub }}>hist. {fmt(n.un, n.historico[n.fonte].medias[i])}</div>}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: C.sub }}>
        <span>Soma dos meses: <b style={{ color: C.text }}>{fmt(n.un, total)}</b></span>
        {dif !== 0 && n.anual != null && <span style={{ color: C.red }}>diferença para a meta do ano: <b>{fmt(n.un, dif)}</b> {n.travados.size === 12 ? "(todos os meses fixados — solte um para fechar)" : ""}</span>}
        {n.travados.size > 0 && <span><Lock size={10} className="inline" /> {n.travados.size} mês(es) fixado(s) por você</span>}
      </div>
    </div>
  );
}

export default function MetasPagina({ user, anoInicial }) {
  const [ano, setAno] = useState(anoInicial || new Date().getFullYear());
  const [orig, setOrig] = useState(null);
  const [nats, setNats] = useState(null);
  const [margem, setMargem] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  const montar = (d) => {
    setOrig(d);
    setNats(d.naturezas.map((n) => ({ ...n, travados: new Set(), pesos: n.meses })));
    setMargem(d.margem != null ? r2(d.margem * 100) : null);
    setTicket(d.ticket != null ? r2(d.ticket) : null);
  };
  useEffect(() => {
    setNats(null); setErro("");
    api(`/api/kpi/metas?u=${user.id}&ano=${ano}`).then(montar).catch((e) => setErro(e.message));
  }, [ano]);

  const salvar = async () => {
    setSalvando(true); setErro(""); setAviso("");
    try {
      const metas = Object.fromEntries(nats.map((n) => [n.k, { anual: n.anual, meses: n.meses }]));
      montar(await api("/api/kpi/metas", "POST", { usuarioId: user.id, ano, metas, margem: margem == null ? "" : String(margem), ticket: ticket == null ? "" : String(ticket) }));
      setAviso("Metas gravadas. Já valem nos KPIs e na Matriz de custos.");
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setAno(ano - 1)} className="px-3 py-2 font-bold" style={{ color: C.sub }}>‹</button>
          <div className="px-4 py-2 font-bold text-lg flex items-center gap-2" style={{ color: C.navy }}><Target size={16} style={{ color: C.accent }} /> Metas de {ano}</div>
          <button onClick={() => setAno(ano + 1)} className="px-3 py-2 font-bold" style={{ color: C.sub }}>›</button>
        </div>
        <div className="text-xs flex-1" style={{ color: C.sub }}>
          Mude a meta do ano e os meses se ajustam mantendo a proporção (ou use a distribuição histórica). Mês alterado à mão fica fixo e os outros recebem a sugestão para fechar o ano.
        </div>
        {nats && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar metas
        </button>}
      </div>
      {erro && <div className="p-3 rounded mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && <div className="p-3 rounded mb-4 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {!nats && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {nats && (
        <>
          <div className="rounded-xl p-4 mb-4 flex flex-wrap items-end gap-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex-1 min-w-[180px]">
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>RESULTADO</div>
              <div className="font-bold" style={{ color: C.navy }}>Margem de contribuição</div>
            </div>
            <label className="block" style={{ width: 200 }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>Meta (%)</div>
              <Campo un="R$" valor={margem} onCommit={setMargem} grande />
            </label>
          </div>
          {(() => {
            const f = nats.find((n) => n.k === "faturamentoValor"), p = nats.find((n) => n.k === "faturamentoPecas");
            const impl = f?.anual && p?.anual ? f.anual / p.anual : null;
            const dif = impl != null && ticket != null && Math.abs(impl - ticket) >= 0.01;
            return (
              <div className="rounded-xl p-4 mb-4 flex flex-wrap items-end gap-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>FATURAMENTO</div>
                  <div className="font-bold" style={{ color: C.navy }}>Ticket médio (R$ por peça)</div>
                  {impl != null && <div className="text-xs mt-1" style={{ color: dif ? C.yellow : C.sub }}>
                    Implícito nas metas do ano (faturamento ÷ peças faturadas): <b>R$ {fmt("R$", impl)}</b>
                    {dif && <> · <button onClick={() => setTicket(r2(impl))} className="font-semibold underline" style={{ color: C.accent }}>usar este</button></>}
                  </div>}
                </div>
                <label className="block" style={{ width: 200 }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>Meta do ano (R$)</div>
                  <Campo un="R$" valor={ticket} onCommit={setTicket} grande />
                </label>
              </div>
            );
          })()}
          {nats.map((n, i) => (
            <CardNatureza key={n.k} n={n} original={orig.naturezas[i]} set={(x) => setNats((l) => l.map((y, k) => (k === i ? x : y)))} />
          ))}
        </>
      )}
    </div>
  );
}
