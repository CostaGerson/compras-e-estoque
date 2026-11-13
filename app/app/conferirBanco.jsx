"use client";
// v823 — Contas a receber › Conferir com o banco: arraste/cole o print ou PDF das cobranças em aberto do banco
import React, { useState } from "react";
import { X, Loader2, Upload, CheckCircle2, AlertTriangle, Landmark, Database, Pencil } from "lucide-react";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41",
  green: "#12A150", greenSoft: "#E7F6EE", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", blue: "#2E7CD6", blueSoft: "#EAF2FC" };
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
const GRUPOS = [
  ["DIVERGE", "Divergem", C.yellow, C.yellowSoft, AlertTriangle],
  ["SO_BANCO", "Só no banco", C.red, C.redSoft, Landmark],
  ["SO_SISTEMA", "Só no sistema", C.blue, C.blueSoft, Database],
  ["OK", "Conferem", C.green, C.greenSoft, CheckCircle2],
];

export default function ConferirBanco({ user, onClose, onEditar }) {
  const [arqs, setArqs] = useState([]);
  const [sobre, setSobre] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [r, setR] = useState(null);
  const [ver, setVer] = useState("");
  const add = async (files) => {
    const n = [];
    for (const f of [...(files || [])]) {
      if (!/^image\/|application\/pdf/.test(f.type)) continue;
      if (f.size > 15 * 1048576) { setErro(`${f.name}: maior que 15 MB.`); continue; }
      n.push({ nome: f.name || "print.png", mime: f.type, base64: await b64(f) });
    }
    if (n.length) { setArqs((a) => [...a, ...n]); setErro(""); }
  };
  const conferir = async () => {
    setLendo(true); setErro(""); setR(null);
    try {
      const j = await fetch("/api/fin/conferir-banco", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, arquivos: arqs }) }).then((x) => x.json());
      if (j.error) throw new Error(j.error);
      setR(j); setVer(j.resumo.diverge ? "DIVERGE" : j.resumo.soBanco ? "SO_BANCO" : j.resumo.soSistema ? "SO_SISTEMA" : "OK");
    } catch (e) { setErro(e.message); }
    setLendo(false);
  };
  const lista = (r?.linhas || []).filter((l) => !ver || l.grupo === ver);
  const R = r?.resumo;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}
      onPaste={(e) => { const fs = [...(e.clipboardData?.items || [])].filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter(Boolean); if (fs.length) { e.preventDefault(); add(fs); } }}>
      <div className="rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b style={{ color: C.navy }}>Conferir cobranças com o banco</b>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-5 overflow-auto">
          <label className="flex flex-col items-center justify-center gap-1 py-6 rounded-xl cursor-pointer text-sm text-center"
            style={{ border: `2px dashed ${sobre ? C.navy : C.line}`, background: sobre ? C.blueSoft : C.panel2, color: C.sub }}
            onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={(e) => { e.preventDefault(); setSobre(false); add(e.dataTransfer.files); }}>
            <Upload size={20} style={{ color: C.navy }} />
            <span><b style={{ color: C.navy }}>Arraste, cole (Ctrl+V) ou clique</b> para enviar o print ou o PDF da lista de cobranças em aberto do banco</span>
            <span className="text-xs">pode mandar várias páginas · a IA lê pagador, nº do documento, nosso número, vencimento e valor</span>
            <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          {arqs.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{arqs.map((a, k) => (
            <span key={k} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs" style={{ border: `1px solid ${C.line}` }}>{a.nome}
              <button onClick={() => setArqs((l) => l.filter((_, j) => j !== k))} style={{ color: C.red }}><X size={12} /></button></span>))}
            <button onClick={conferir} disabled={lendo} className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: lendo ? 0.6 : 1 }}>
              {lendo ? <><Loader2 size={14} className="animate-spin" /> Lendo e conferindo…</> : "Conferir"}</button>
          </div>}
          {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

          {R && <>
            <div className="text-xs mt-4 mb-2" style={{ color: C.sub }}>{R.lidas} cobrança(s) lidas no banco · {moeda(R.valorBanco)}{R.periodo ? ` · vencimentos de ${dBR(R.periodo[0])} a ${dBR(R.periodo[1])}` : ""}</div>
            <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              {GRUPOS.map(([g, t, cor, fundo, Ic]) => {
                const n = { OK: R.ok, DIVERGE: R.diverge, SO_BANCO: R.soBanco, SO_SISTEMA: R.soSistema }[g], v = { OK: R.vOk, DIVERGE: R.vDiverge, SO_BANCO: R.vSoBanco, SO_SISTEMA: R.vSoSistema }[g];
                return <button key={g} onClick={() => setVer(ver === g ? "" : g)} className="rounded-xl p-3 text-left" style={{ background: fundo, border: `${ver === g ? 2 : 1}px solid ${ver === g ? cor : "transparent"}` }}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase" style={{ color: cor }}><Ic size={14} />{t}</div>
                  <div className="text-xl font-bold" style={{ color: cor }}>{n}</div><div className="text-xs" style={{ color: C.sub }}>{moeda(v)}</div></button>;
              })}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase text-left" style={{ color: C.sub }}><th className="py-1.5 px-2">Banco</th><th className="py-1.5 px-2">Sistema</th><th className="py-1.5 px-2">Situação</th><th /></tr></thead>
              <tbody>
                {lista.map((l, k) => {
                  const g = GRUPOS.find((x) => x[0] === l.grupo);
                  return <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="py-2 px-2 align-top">{l.banco ? <><div className="font-semibold">{l.banco.pagador || "—"}</div>
                      <div className="text-xs" style={{ color: C.sub }}>doc {l.banco.documento || "—"}{l.banco.nossoNumero ? ` · NN ${l.banco.nossoNumero}` : ""} · vence {dBR(l.banco.vencimento)} · <b style={{ color: C.text }}>{moeda(l.banco.valor)}</b></div></> : <span style={{ color: C.sub }}>—</span>}</td>
                    <td className="py-2 px-2 align-top">{l.titulo ? <><div className="font-semibold">{l.titulo.titulo}</div>
                      <div className="text-xs" style={{ color: C.sub }}>{l.titulo.parceiro} · vence {dBR(l.titulo.vencimento)} · <b style={{ color: C.text }}>{moeda(l.titulo.valor)}</b> · {l.titulo.status === "PAGO" ? (l.titulo.antecipado ? "antecipada" : "recebida") : "em aberto"}</div></> : <span style={{ color: C.sub }}>—</span>}</td>
                    <td className="py-2 px-2 align-top text-xs"><span className="font-semibold" style={{ color: g[2] }}>{g[1]}</span>
                      {l.como && <div style={{ color: C.sub }}>casou por {l.como}</div>}
                      {(l.difs || []).map((d, j) => <div key={j} style={{ color: C.yellow }}>{d}</div>)}
                      {l.motivo && <div style={{ color: C.sub }}>{l.motivo}</div>}</td>
                    <td className="py-2 px-2 align-top text-right">{l.titulo && onEditar && <button onClick={() => onEditar(l.titulo.id)} title="Abrir a conta" style={{ color: C.blue }}><Pencil size={15} /></button>}</td>
                  </tr>;
                })}
                {!lista.length && <tr><td colSpan={4} className="py-6 text-center" style={{ color: C.sub }}>Nada neste grupo.</td></tr>}
              </tbody>
            </table>
            <div className="text-[11px] mt-3" style={{ color: C.sub }}>A leitura é feita por IA: confira no print as linhas que divergirem antes de alterar qualquer conta. "Só no sistema" considera boletos em aberto com vencimento entre a primeira e a última data do print.</div>
          </>}
        </div>
      </div>
    </div>
  );
}
