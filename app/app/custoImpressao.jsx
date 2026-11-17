"use client";
// v923 — Análises operacionais › Sublimação e DTF: custo do metro linear (insumos editáveis) e composição de custo por peça até o custo total.
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Plus, Trash2, RotateCcw } from "lucide-react";
import { CoresContas as C } from "./contas";
import { alerta, confirmar } from "./dialogo";
import { MODELOS, calcMetro, calcLinha, padraoDe, numCI } from "@/lib/custoImpressao";

const brl = (v, d = 2) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 2) })}`;
const nf = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
const txt = (v) => (v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v));

export default function CustoImpressao({ user, tipo }) {
  const M = MODELOS[tipo];
  const [d, setD] = useState(null);
  const [p, setP] = useState(null);
  const [ls, setLs] = useState([]);
  const [mudou, setMudou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const ler = () => fetch(`/api/producao/custoImpressao?u=${user.id}&tipo=${tipo}`).then((r) => r.json()).then((x) => { if (x.error) throw new Error(x.error); setD(x); setP(x.params); setLs(x.linhas); setMudou(false); }).catch((e) => setD({ error: e.message }));
  useEffect(() => { ler(); }, [tipo]);
  const { c } = useMemo(() => (p ? calcMetro(tipo, p) : { c: null }), [p, tipo]);
  if (!d) return <Loader2 className="animate-spin" size={18} />;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  const setCampo = (k, v) => { setP((x) => ({ ...x, [k]: v })); setMudou(true); };
  const setL = (i, k, v) => { setLs((a) => a.map((l, j) => (j === i ? { ...l, [k]: v } : l))); setMudou(true); };
  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch("/api/producao/custoImpressao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, tipo, params: p, linhas: ls }) });
      const x = await r.json(); if (!r.ok) throw new Error(x.error || "Erro.");
      setD(x); setP(x.params); setLs(x.linhas); setMudou(false);
      if (x.papel != null) alerta(`Salvo. O custo do metro de papel nas FPPs passou a ser ${brl(x.papel, 4)}/m.`);
    } catch (e) { alerta(e.message); }
    setSalvando(false);
  }
  const inp = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };
  const col = M.colunas;
  const NAVY = "#0C2342", STEEL = "#3D6799";
  const fmtCalc = (k, v) => (/PorM$/.test(k) || k === "total" ? brl(v, 4) : /Total$/.test(k) ? brl(v, 2) : nf(v, 0));
  const th = "px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide whitespace-nowrap";
  const campoNum = "w-full px-2 py-1.5 rounded-lg text-center text-xs tabular-nums outline-none focus:ring-2";
  return (
    <div>
      {/* v924 — visual moderno (cabeçalhos Oxford Blue, destaque laranja), campos padronizados e conteúdo centralizado */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-lg font-extrabold" style={{ color: NAVY }}>Custo de {M.titulo.toLowerCase()}</div>
          <div className="text-xs" style={{ color: C.sub }}>Custo do metro linear pelos insumos e composição de custo por peça.{d.em ? ` Atualizado em ${new Date(d.em).toLocaleString("pt-BR")}${d.por ? ` por ${d.por}` : ""}.` : ""}{tipo === "SUBLIMACAO" ? " O total do metro linear é o custo do metro de papel nas FPPs." : ""}</div>
        </div>
        <div className="flex-1" />
        <div className="rounded-xl px-4 py-2 text-right" style={{ background: NAVY }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9FB7D9" }}>Custo do metro linear</div>
          <div className="text-xl font-extrabold tabular-nums" style={{ color: "#fff" }}>{brl(c.total, 4)}</div>
        </div>
        <button onClick={async () => { if (await confirmar("Voltar aos valores das planilhas originais? (só grava ao salvar)")) { const x = padraoDe(tipo); setP(x.params); setLs(x.linhas); setMudou(true); } }} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.sub, background: "#fff" }}><RotateCcw size={13} /> Valores da planilha</button>
        <button onClick={salvar} disabled={!mudou || salvando} className="text-sm px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5" style={{ background: mudou ? C.accent : C.panel2, color: mudou ? "#fff" : C.sub }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", alignItems: "start" }}>
        {/* custo do metro linear — seções em duas colunas para caber na tela */}
        <div className="rounded-2xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 1px 3px rgba(12,35,66,.06)" }}>
          <div className="px-4 py-2.5 text-sm font-bold flex items-center" style={{ background: NAVY, color: "#fff" }}>Custo metro linear</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {M.secoes.map((s, si) => (
              <div key={s.t} className="px-3 py-2" style={{ borderBottom: `1px solid ${C.line}`, borderRight: si % 2 === 0 ? `1px solid ${C.line}` : "none" }}>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: STEEL }}>{s.t}</div>
                {s.campos.map(([k, l, t]) => (
                  <label key={k} className="grid items-center gap-2 py-0.5" style={{ gridTemplateColumns: "minmax(0,1fr) 112px" }}>
                    <span className="text-[11px] leading-tight" style={{ color: C.text }} title={l}>{l}</span>
                    <input value={txt(p[k])} onChange={(e) => setCampo(k, e.target.value)} inputMode={t === "txt" ? "text" : "decimal"} title={txt(p[k])}
                      className={campoNum} style={{ ...inp, "--tw-ring-color": C.accentSoft }} />
                  </label>
                ))}
                {s.calc.map(([k, l]) => (
                  <div key={k} className="grid items-center gap-2 py-0.5" style={{ gridTemplateColumns: "minmax(0,1fr) 112px" }}>
                    <span className="text-[11px] leading-tight" style={{ color: C.sub }}>{l}</span>
                    <span className="text-xs font-bold tabular-nums text-center" style={{ color: NAVY }}>{fmtCalc(k, c[k])}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 flex items-center" style={{ background: "#F1F6FE" }}>
            <span className="text-sm font-bold flex-1" style={{ color: NAVY }}>Total (metro linear)</span>
            <span className="text-lg font-extrabold tabular-nums" style={{ color: C.accent }}>{brl(c.total, 4)}</span>
          </div>
        </div>
        {/* composição por peça */}
        <div className="rounded-2xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 1px 3px rgba(12,35,66,.06)" }}>
          <div className="px-4 py-2.5 text-sm font-bold" style={{ background: NAVY, color: "#fff" }}>Composição de custo por peça</div>
          <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "30%" }} />{col.map(([k]) => <col key={k} />)}<col /><col /><col /><col /><col /><col style={{ width: 30 }} /></colgroup>
            <thead><tr style={{ color: STEEL, background: "#F1F6FE" }}>
              <th className={th}>Nome da arte</th>
              {col.map(([k, l]) => <th key={k} className={th}>{l}</th>)}
              <th className={th}>Material</th><th className={th}>M.O. impressão</th><th className={th}>Recorte</th><th className={th}>Prensagem</th>
              <th className={th}>Custo total</th><th />
            </tr></thead>
            <tbody>
              {ls.map((l, i) => { const x = calcLinha(l, c.total); return (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-2 py-1"><input value={l.nome || ""} onChange={(e) => setL(i, "nome", e.target.value.toUpperCase())} title={l.nome} className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-center outline-none" style={{ ...inp, color: NAVY }} /></td>
                  {col.map(([k]) => <td key={k} className="px-1 py-1"><input value={txt(l[k])} onChange={(e) => setL(i, k, e.target.value)} inputMode="decimal" className={campoNum} style={inp} /></td>)}
                  <td className="px-1 py-1 text-center tabular-nums font-semibold" style={{ color: STEEL }}>{brl(x.material, 4)}</td>
                  {["mo", "recorte", "prensagem"].map((k) => <td key={k} className="px-1 py-1"><input value={txt(l[k])} onChange={(e) => setL(i, k, e.target.value)} inputMode="decimal" placeholder="0,00" className={campoNum} style={inp} /></td>)}
                  <td className="px-1 py-1 text-center"><span className="inline-block px-2 py-1 rounded-lg font-extrabold tabular-nums" style={{ background: C.accentSoft, color: C.accent }}>{brl(x.total, 4)}</span></td>
                  <td className="text-center"><button onClick={() => { setLs((a) => a.filter((_, j) => j !== i)); setMudou(true); }} title="Tirar a linha" style={{ color: C.sub }}><Trash2 size={13} /></button></td>
                </tr>); })}
            </tbody>
          </table>
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => { setLs((a) => [...a, { nome: "", mo: "", recorte: "", prensagem: "" }]); setMudou(true); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><Plus size={13} /> Arte</button>
            <span className="text-[11px]" style={{ color: C.sub }}>Material = total do metro linear ÷ {tipo === "DTF" ? "estampas" : "unidades"} por metro · Custo total = material + M.O. + recorte + prensagem.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
