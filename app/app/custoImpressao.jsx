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
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-lg font-bold" style={{ color: C.navy }}>Custo de {M.titulo.toLowerCase()}</div>
          <div className="text-xs" style={{ color: C.sub }}>Custo do metro linear pelos insumos e composição de custo por peça.{d.em ? ` Atualizado em ${new Date(d.em).toLocaleString("pt-BR")}${d.por ? ` por ${d.por}` : ""}.` : ""}{tipo === "SUBLIMACAO" ? " O total do metro linear é o custo do metro de papel nas FPPs." : ""}</div>
        </div>
        <div className="flex-1" />
        <button onClick={async () => { if (await confirmar("Voltar aos valores das planilhas originais? (só grava ao salvar)")) { const x = padraoDe(tipo); setP(x.params); setLs(x.linhas); setMudou(true); } }} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.sub }}><RotateCcw size={13} /> Valores da planilha</button>
        <button onClick={salvar} disabled={!mudou || salvando} className="text-sm px-4 py-1.5 rounded-lg font-semibold flex items-center gap-1.5" style={{ background: mudou ? C.accent : C.panel2, color: mudou ? "#fff" : C.sub }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(320px, 400px) 1fr", alignItems: "start" }}>
        {/* custo do metro linear */}
        <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2.5 text-sm font-bold" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}>Custo metro linear</div>
          {M.secoes.map((s) => (
            <div key={s.t} className="px-4 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-bold uppercase mb-1" style={{ color: C.sub }}>{s.t}</div>
              {s.campos.map(([k, l, t]) => (
                <div key={k} className="flex items-center gap-2 py-0.5">
                  <span className="text-xs flex-1" style={{ color: C.text }}>{l}</span>
                  <input value={txt(p[k])} onChange={(e) => setCampo(k, t === "txt" ? e.target.value : e.target.value)} inputMode={t === "txt" ? "text" : "decimal"}
                    className="text-xs px-2 py-1 rounded text-right" style={{ ...inp, width: t === "txt" ? 150 : 110 }} />
                </div>
              ))}
              {s.calc.map(([k, l]) => (
                <div key={k} className="flex items-center gap-2 py-0.5">
                  <span className="text-xs flex-1" style={{ color: C.sub }}>{l}</span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: C.navy }}>{/PorM|Total$/.test(k) ? brl(c[k], 4) : nf(c[k], 0)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="px-4 py-3 flex items-center" style={{ background: C.panel2 }}>
            <span className="text-sm font-bold flex-1" style={{ color: C.navy }}>Total (metro linear)</span>
            <span className="text-base font-bold tabular-nums" style={{ color: C.accent }}>{brl(c.total, 4)}</span>
          </div>
        </div>
        {/* composição por peça */}
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2.5 text-sm font-bold" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}>Composição de custo por peça</div>
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.sub, background: C.panel2 }}>
              <th className="text-left px-3 py-2">Nome da arte</th>
              {col.map(([k, l]) => <th key={k} className="text-right px-2 py-2">{l}</th>)}
              <th className="text-right px-2 py-2">Material impressão</th><th className="text-right px-2 py-2">M.O. impressão</th><th className="text-right px-2 py-2">Custo recorte</th><th className="text-right px-2 py-2">Custo prensagem</th>
              <th className="text-right px-3 py-2">Custo total</th><th />
            </tr></thead>
            <tbody>
              {ls.map((l, i) => { const x = calcLinha(l, c.total); return (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-3 py-1"><input value={l.nome || ""} onChange={(e) => setL(i, "nome", e.target.value.toUpperCase())} className="w-full px-2 py-1 rounded" style={{ ...inp, minWidth: 210 }} /></td>
                  {col.map(([k]) => <td key={k} className="px-1 py-1"><input value={txt(l[k])} onChange={(e) => setL(i, k, e.target.value)} inputMode="decimal" className="px-2 py-1 rounded text-right" style={{ ...inp, width: 78 }} /></td>)}
                  <td className="px-2 py-1 text-right tabular-nums" style={{ color: C.navy }}>{brl(x.material, 4)}</td>
                  {["mo", "recorte", "prensagem"].map((k) => <td key={k} className="px-1 py-1"><input value={txt(l[k])} onChange={(e) => setL(i, k, e.target.value)} inputMode="decimal" placeholder="0,00" className="px-2 py-1 rounded text-right" style={{ ...inp, width: 78 }} /></td>)}
                  <td className="px-3 py-1 text-right font-bold tabular-nums" style={{ color: C.accent }}>{brl(x.total, 4)}</td>
                  <td className="px-1"><button onClick={() => { setLs((a) => a.filter((_, j) => j !== i)); setMudou(true); }} title="Tirar a linha" style={{ color: C.sub }}><Trash2 size={13} /></button></td>
                </tr>); })}
            </tbody>
          </table>
          <button onClick={() => { setLs((a) => [...a, { nome: "", mo: "", recorte: "", prensagem: "" }]); setMudou(true); }} className="m-3 text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><Plus size={13} /> Arte</button>
          <div className="px-4 pb-3 text-[11px]" style={{ color: C.sub }}>Material impressão = total do metro linear ÷ {tipo === "DTF" ? "estampas" : "unidades"} por metro · Custo total = material + M.O. + recorte + prensagem.</div>
        </div>
      </div>
    </div>
  );
}
