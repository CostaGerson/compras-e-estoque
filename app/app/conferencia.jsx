"use client";
// v211 — Conferência de integração: o mesmo número em telas diferentes, lado a lado
import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Info, MinusCircle, RefreshCw } from "lucide-react";
import { CoresContas as C } from "./contas";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const ST = {
  OK: { t: "Bate", cor: C.green, bg: C.greenSoft, I: CheckCircle2 },
  DIVERGE: { t: "Diverge", cor: C.red, bg: C.redSoft, I: AlertTriangle },
  INFO: { t: "Informativo", cor: C.blue, bg: C.blueSoft, I: Info },
  SEM_DADO: { t: "Sem dado", cor: C.sub, bg: C.panel2, I: MinusCircle },
};
const Selo = ({ s }) => { const x = ST[s] || ST.SEM_DADO; return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap" style={{ background: x.bg, color: x.cor }}><x.I size={12} /> {x.t}</span>; };

export default function Conferencia({ user, ano: ano0 }) {
  const [ano, setAno] = useState(ano0 || new Date().getFullYear());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [so, setSo] = useState(false);   // só divergências
  const [rk, setRk] = useState(0);
  useEffect(() => {
    setD(null); setErro("");
    fetch(`/api/fin/conferencia?u=${user.id}&ano=${ano}`).then((r) => r.json()).then((j) => (j.error ? setErro(j.error) : setD(j))).catch((e) => setErro(e.message));
  }, [ano, rk]);

  const grupos = d ? [...new Set([...d.checks.map((c) => c.grupo), ...d.tabelas.map((t) => t.grupo)])] : [];
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setAno(ano - 1)} className="px-3 py-2 font-bold" style={{ color: C.sub }}>‹</button>
          <div className="px-4 py-2 font-bold text-lg">{ano}</div>
          <button onClick={() => setAno(ano + 1)} disabled={ano >= new Date().getFullYear()} className="px-3 py-2 font-bold" style={{ color: C.sub, opacity: ano >= new Date().getFullYear() ? 0.3 : 1 }}>›</button>
        </div>
        <button onClick={() => setRk((x) => x + 1)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} /> Refazer</button>
        <label className="flex items-center gap-1.5 text-sm" style={{ color: C.sub }}><input type="checkbox" checked={so} onChange={(e) => setSo(e.target.checked)} /> só divergências</label>
        {d && <div className="flex gap-2 ml-auto text-xs">
          {["DIVERGE", "OK", "INFO", "SEM_DADO"].map((k) => <span key={k} className="px-2 py-1 rounded font-semibold" style={{ background: ST[k].bg, color: ST[k].cor }}>{d.resumo[k]} {ST[k].t.toLowerCase()}</span>)}
        </div>}
      </div>
      <div className="text-xs mb-4" style={{ color: C.sub }}>Cada linha mostra o mesmo número em telas diferentes e de onde ele vem. Tolerância de R$ 1,00. Regras: metas vêm do botão METAS da Gestão (KPI e Matriz); receita realizada vem da DRE; vendas e faturamento são manuais por enquanto. Matriz ⇄ Recorrentes se falam; o contas a pagar só recebe e nada corrigido ou reprogramado lá é sobrescrito.</div>
      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Conferindo…</div>}
      {d && grupos.map((g) => {
        const cs = d.checks.filter((c) => c.grupo === g && (!so || c.status === "DIVERGE"));
        const ts = d.tabelas.filter((t) => t.grupo === g && (!so || t.linhas.some((l) => l.status === "DIVERGE")));
        if (!cs.length && !ts.length) return null;
        return (
          <div key={g} className="mb-6">
            <div className="font-bold mb-2" style={{ color: C.navy }}>{g}</div>
            {ts.map((t) => (
              <div key={t.titulo} className="rounded-lg mb-3 overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="px-3 py-2 text-sm font-semibold">{t.titulo}</div>
                <table className="w-full text-xs">
                  <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
                    <th className="text-left px-3 py-1.5">Mês</th>
                    {t.colunas.map((c, i) => <th key={i} className="text-right px-3 py-1.5 font-semibold" title={t.fontes[i]}>{c}<div className="font-normal" style={{ fontSize: 10 }}>{t.fontes[i]}</div></th>)}
                    <th className="px-3 py-1.5"></th>
                  </tr></thead>
                  <tbody>{t.linhas.filter((l) => !so || l.status === "DIVERGE").map((l) => (
                    <tr key={l.mes} style={{ borderBottom: `1px solid ${C.line}`, background: l.status === "DIVERGE" ? "#FFF8F7" : undefined }}>
                      <td className="px-3 py-1.5 font-semibold">{l.mes}</td>
                      {l.valores.map((v, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{v == null ? "—" : t.titulo.includes("Vendas") && i >= 2 || t.titulo.includes("Faturamento") && i === 3 ? Number(v).toLocaleString("pt-BR") : brl(v)}</td>)}
                      <td className="px-3 py-1.5 text-right"><Selo s={l.status} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
            {cs.map((c, k) => (
              <div key={k} className="rounded-lg mb-2 p-3" style={{ background: C.panel, border: `1px solid ${c.status === "DIVERGE" ? C.red : C.line}` }}>
                <div className="flex items-center gap-2 mb-1"><span className="text-sm font-semibold flex-1">{c.nome}</span><Selo s={c.status} /></div>
                {c.fontes.length > 0 && <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(c.fontes.length, 3)}, minmax(0, 1fr))` }}>
                  {c.fontes.map((f, i) => (
                    <div key={i} className="rounded p-2 text-xs" style={{ background: C.panel2 }}>
                      <div className="font-semibold" style={{ color: C.navy }}>{f.tela}</div>
                      <div style={{ color: C.sub }}>{f.fonte}</div>
                      <div className="text-sm font-bold tabular-nums mt-0.5">{f.un === "pc" && f.valor != null ? Number(f.valor).toLocaleString("pt-BR") : brl(f.valor)}</div>
                    </div>
                  ))}
                </div>}
                {c.itens?.length > 0 && <table className="w-full text-xs mt-2">{c.cols && <thead><tr style={{ color: C.sub }}><th></th><th className="text-right font-semibold">{c.cols[0]}</th><th className="text-right font-semibold">{c.cols[1]}</th><th></th></tr></thead>}<tbody>{c.itens.map((it, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="py-1">{it.nome}</td>
                    <td className="py-1 text-right tabular-nums">{brl(it.a)}</td>
                    <td className="py-1 text-right tabular-nums">{brl(it.b)}</td>
                    <td className="py-1 pl-3" style={{ color: C.sub }}>{it.nota}</td>
                  </tr>
                ))}</tbody></table>}
                {c.obs && <div className="text-xs mt-1.5" style={{ color: C.sub }}>{c.obs}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
