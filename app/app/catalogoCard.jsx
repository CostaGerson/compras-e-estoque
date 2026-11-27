"use client";
// v1165 — card do Catálogo Meridian (comercial e estoque): abre o catálogo (arquivo no Google Drive) em nova guia
import React, { useEffect, useState } from "react";
import { BookOpen, ExternalLink, RefreshCw } from "lucide-react";
import { alerta } from "./dialogo";

const C = { navy: "#001E41", accent: "#FF6B1A", sub: "#B8C4D6" };
export default function CatalogoCard({ compacto = false, card = false }) {
  const [st, setSt] = useState(null), [at, setAt] = useState(false);
  const carregar = () => fetch("/api/catalogo-meridian?info=1").then((r) => r.json()).then(setSt).catch(() => setSt({}));
  useEffect(() => { carregar(); }, []);
  const atualizar = async (e) => {
    e.stopPropagation(); setAt(true);
    const r = await fetch("/api/catalogo-meridian", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "atualizar" }) });
    const x = await r.json().catch(() => ({})); setAt(false);
    if (!r.ok || x.error) return alerta(x.error || "Não foi possível atualizar o catálogo.");
    setSt(x);
  };
  const quando = st?.em ? new Date(st.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  const abrir = () => window.open("/api/catalogo-meridian", "_blank", "noopener");
  // v1184 — mesmo formato dos outros cards da tela (fundo branco, ícone laranja, título e descrição)
  if (card) return (
    <div role="link" tabIndex={0} onClick={abrir} onKeyDown={(e) => e.key === "Enter" && abrir()}
      className="text-left rounded-2xl p-5 transition-shadow hover:shadow-lg flex flex-col min-w-0 cursor-pointer" style={{ background: "#FFFFFF", border: "1px solid #E4E7EC" }}>
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen size={22} style={{ color: C.accent }} className="shrink-0" />
        <div className="text-base font-bold truncate" style={{ color: "#1F2733" }}>Catálogo Meridian</div>
        <ExternalLink size={13} style={{ color: "#667085" }} className="shrink-0" />
        <button onClick={atualizar} title="Gerar de novo e atualizar no Drive" className="ml-auto shrink-0 rounded-md p-1" style={{ color: "#667085" }}>
          <RefreshCw size={13} className={at ? "animate-spin" : ""} /></button>
      </div>
      <div className="text-xs mt-1 mb-3" style={{ color: "#667085" }}>
        {st?.artigos ? `${st.artigos} artigos · ${st.fornecedores} fornecedores · ${st.cores} cores${quando ? ` · atualizado ${quando}` : ""}` : st ? "Todos os artigos das cartelas, por fornecedor ou por artigo" : "Carregando…"}
      </div>
    </div>
  );
  return (
    <div role="link" tabIndex={0} onClick={() => window.open("/api/catalogo-meridian", "_blank", "noopener")} onKeyDown={(e) => e.key === "Enter" && window.open("/api/catalogo-meridian", "_blank", "noopener")}
      className={`rounded-2xl ${compacto ? "p-3.5" : "p-5"} cursor-pointer transition-shadow hover:shadow-lg flex items-center gap-4`} style={{ background: C.navy, color: "#fff" }}>
      <div className="rounded-xl p-2.5 shrink-0" style={{ background: "rgba(255,107,26,.15)" }}><BookOpen size={compacto ? 20 : 24} style={{ color: C.accent }} /></div>
      <div className="flex-1 min-w-0">
        <div className="font-bold flex items-center gap-1.5">Catálogo <span style={{ color: C.accent }}>Meridian</span> <ExternalLink size={13} style={{ color: C.sub }} /></div>
        <div className="text-xs mt-0.5" style={{ color: C.sub }}>
          {st?.artigos ? `${st.artigos} artigos · ${st.fornecedores} fornecedores · ${st.cores} cores${quando ? ` · atualizado ${quando}` : ""}` : st ? "Todos os artigos das cartelas, por fornecedor ou por artigo" : "Carregando…"}
        </div>
      </div>
      <button onClick={atualizar} title="Gerar de novo e atualizar no Drive" className="shrink-0 rounded-lg p-2" style={{ border: "1px solid #33506F", color: C.sub }}>
        <RefreshCw size={14} className={at ? "animate-spin" : ""} /></button>
    </div>
  );
}
