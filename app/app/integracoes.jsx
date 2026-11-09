"use client";
// v732 — Integrações: token da API externa (PCP do Maycon) e os endereços que o usam, num lugar fácil de achar
import React, { useEffect, useState } from "react";
import { KeyRound, Copy, Eye, EyeOff, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", red: "#D92D20" };

export default function Integracoes({ user }) {
  const [d, setD] = useState(null);
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [oc, setOc] = useState(false);
  const api = (o = {}) => fetch("/api/compras/integracao", { cache: "no-store", ...o, headers: { "x-usuario-id": String(user?.id || "") } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Erro."); return j; });
  useEffect(() => { api().then(setD).catch((e) => setD({ erro: e.message })); }, []);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const copiar = (txt, k) => { navigator.clipboard?.writeText(txt); setCopiado(k); setTimeout(() => setCopiado(""), 1500); };
  const renovar = async () => {
    if (!(await confirmar("Gerar um token novo? O atual para de funcionar na hora: o PCP só volta a ler o ERP depois que o novo for colado lá."))) return;
    setOc(true);
    try { setD(await api({ method: "POST" })); setVer(true); } catch (e) { alerta(e.message); }
    setOc(false);
  };
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  if (d.erro) return <div className="text-sm" style={{ color: C.red }}>{d.erro}</div>;
  return (
    <div className="max-w-4xl">
      <div className="text-lg font-bold mb-1" style={{ color: C.navy }}>Integração</div>
      <div className="text-sm mb-4" style={{ color: C.sub }}>Token que o PCP (Maycon) usa para ler e gravar no ERP. É <b>um token só</b> para todos os endereços abaixo, enviado no cabeçalho <code>X-Api-Key</code>.</div>
      <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-2"><KeyRound size={16} style={{ color: C.accent }} /><span className="font-semibold" style={{ color: C.navy }}>Token da API (PCP)</span></div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-[260px] px-3 py-2 rounded text-sm break-all" style={{ background: C.panel2, color: C.text }}>{ver ? d.token : "•".repeat(24) + String(d.token).slice(-4)}</code>
          <button onClick={() => setVer((x) => !x)} className="px-3 py-2 rounded text-sm flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.sub }}>{ver ? <EyeOff size={14} /> : <Eye size={14} />} {ver ? "Ocultar" : "Mostrar"}</button>
          <button onClick={() => copiar(d.token, "tk")} className="px-3 py-2 rounded text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{copiado === "tk" ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copiado === "tk" ? "Copiado" : "Copiar token"}</button>
          {!d.fixoNoServidor && <button disabled={oc} onClick={renovar} className="px-3 py-2 rounded text-sm flex items-center gap-1" style={{ border: `1px solid ${C.red}`, color: C.red }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Gerar novo</button>}
        </div>
        {d.fixoNoServidor && <div className="text-xs mt-2" style={{ color: C.sub }}>Token fixo no servidor (COMPRAS_EXT_TOKEN no .env): para trocar, mude no .env da VPS.</div>}
        <div className="text-xs mt-2" style={{ color: C.sub }}>No PCP: Config → Integração com o ERP. Endereço base: <b>{origem}</b></div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-4 py-2 text-xs font-semibold" style={{ background: C.panel2, color: C.sub }}>Endereços que usam este token</div>
        {(d.endpoints || []).map((e) => (
          <div key={e.metodo + e.caminho} className="flex items-start gap-3 px-4 py-2.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5" style={{ background: e.metodo === "GET" ? "#EAF2FC" : "#FFF0E6", color: e.metodo === "GET" ? "#2E7CD6" : C.accent }}>{e.metodo}</span>
            <div className="flex-1 min-w-0"><code style={{ color: C.navy }}>{e.caminho}</code><div className="text-xs" style={{ color: C.sub }}>{e.desc}</div></div>
            <button onClick={() => copiar(origem + e.caminho, e.caminho)} title="Copiar endereço completo" className="p-1" style={{ color: copiado === e.caminho ? C.green : C.sub }}>{copiado === e.caminho ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
