"use client";
// v424 — avisos, confirmações e perguntas no meio da tela, na identidade do sistema (substitui alert/confirm/prompt do navegador)
//   alerta(msg) · await confirmar(msg) → true/false · await perguntar(msg, padrao) → texto ou null
import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, HelpCircle, X } from "lucide-react";

const C = { panel: "#FFFFFF", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", red: "#D92D20", redSoft: "#FDECEA", blueSoft: "#EAF2FC", blue: "#2E7CD6" };

let fila = [];
let ouvinte = null;
const abrir = (d) => new Promise((ok) => { fila = [...fila, { ...d, ok, id: Math.random() }]; ouvinte?.(fila); });
const txt = (m) => (m instanceof Error ? m.message : m == null ? "" : String(m));

export function alerta(msg, opts = {}) { return abrir({ tipo: "alerta", msg: txt(msg), ...opts }); }
export function confirmar(msg, opts = {}) { return abrir({ tipo: "confirmar", msg: txt(msg), ...opts }); }
export function perguntar(msg, padrao = "", opts = {}) { return abrir({ tipo: "perguntar", msg: txt(msg), padrao: padrao ?? "", ...opts }); }

const perigoso = (m) => /\b(excluir|apagar|remover|cancelar|deletar|desfazer|dispensar|devolver|estornar|zerar|limpar)\b/i.test(m);

export default function Dialogos() {
  const [l, setL] = useState([]);
  useEffect(() => { ouvinte = setL; setL(fila); return () => { ouvinte = null; }; }, []);
  const d = l[0];
  const [valor, setValor] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (d) { setValor(d.padrao ?? ""); setTimeout(() => ref.current?.focus(), 30); } }, [d?.id]);
  if (!d) return null;
  const fechar = (res) => { fila = fila.slice(1); setL(fila); d.ok(res); };
  const cancelar = () => fechar(d.tipo === "confirmar" ? false : d.tipo === "perguntar" ? null : undefined);
  const aceitar = () => fechar(d.tipo === "confirmar" ? true : d.tipo === "perguntar" ? valor : undefined);
  const [linha1, ...resto] = d.msg.split("\n");
  const titulo = d.titulo || (d.tipo === "alerta" ? (/erro|não foi|nao foi|falh|inválid|invalid/i.test(d.msg) ? "Atenção" : "Aviso") : d.tipo === "perguntar" ? "Informe" : "Confirmar");
  const vermelho = d.perigo ?? (d.tipo === "confirmar" && perigoso(d.msg));
  const Ico = d.tipo === "alerta" ? (titulo === "Atenção" ? AlertTriangle : Info) : d.tipo === "perguntar" ? HelpCircle : AlertTriangle;
  const corIco = vermelho || titulo === "Atenção" ? C.red : d.tipo === "alerta" ? C.blue : C.accent;
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1000, background: "rgba(0,30,65,.45)" }}
      onKeyDown={(e) => { if (e.key === "Escape") cancelar(); if (e.key === "Enter" && d.tipo !== "perguntar") { e.preventDefault(); aceitar(); } }}>
      <div className="rounded-xl w-full max-w-md shadow-2xl" style={{ background: C.panel, border: `1px solid ${C.line}` }} role="dialog" aria-modal="true">
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 36, height: 36, background: corIco === C.red ? C.redSoft : corIco === C.blue ? C.blueSoft : C.accentSoft }}><Ico size={18} style={{ color: corIco }} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold" style={{ color: C.navy }}>{titulo}</div>
            <div className="text-sm mt-1 whitespace-pre-wrap" style={{ color: C.text }}>{linha1}</div>
            {resto.length > 0 && <div className="text-sm mt-1 whitespace-pre-wrap" style={{ color: C.sub }}>{resto.join("\n").trim()}</div>}
          </div>
          <button onClick={cancelar} title="Fechar"><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {d.tipo === "perguntar" && (
          <div className="px-5 pt-3">
            <input ref={ref} value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aceitar(); } }}
              className="w-full px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }} />
          </div>
        )}
        <div className="flex justify-end gap-2 px-5 py-4">
          {d.tipo !== "alerta" && <button onClick={cancelar} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.panel }}>{d.cancelar || "Cancelar"}</button>}
          <button ref={d.tipo === "perguntar" ? null : ref} onClick={aceitar} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: vermelho ? C.red : C.accent, color: "#fff" }}>
            {d.okTexto || (d.tipo === "alerta" ? "Ok" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
