"use client";
// v812 — Comercial: "Solicitar lançamento" pede ao PCP o lançamento do pedido
// v857 — vai só para o Leandro (PCP) como TAREFA na agenda dele, atribuída por quem pediu; só um campo de observação.
//   O aviso da nova demanda chega nas mensagens dele; quem pediu acompanha a tarefa (criada por ele) na própria agenda/Tarefas.
import React, { useState, useEffect } from "react";
import { X, Send, Loader2, Paperclip, Upload } from "lucide-react";
import { alerta } from "./dialogo";
import { setorTarefaDe } from "@/lib/acesso";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", green: "#12A150", greenSoft: "#E7F6EE" };
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function SolicitarLancamento({ user, onClose }) {
  const [leandro, setLeandro] = useState(undefined);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [arqs, setArqs] = useState([]);   // v857 — anexos (vão para a tarefa)
  const [arrastando, setArrastando] = useState(false);
  const lerArq = (f) => new Promise((ok) => { const rd = new FileReader(); rd.onload = () => ok({ nome: f.name, mime: f.type || null, tamanho: f.size, conteudo: String(rd.result).split(",")[1] || "" }); rd.onerror = () => ok(null); rd.readAsDataURL(f); });
  const adicionar = async (lista) => {
    const fs = Array.from(lista || []);
    const grandes = fs.filter((f) => f.size > 40 * 1048576);
    if (grandes.length) alerta(`Acima de 40 MB (não entra): ${grandes.map((f) => f.name).join(", ")}`);
    const lidos = (await Promise.all(fs.filter((f) => f.size <= 40 * 1048576).map(lerArq))).filter(Boolean);
    setArqs((a) => [...a, ...lidos]);
  };
  const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  useEffect(() => {
    fetch("/api/usuarios/lista").then((r) => r.json()).then((l) => {
      const us = Array.isArray(l) ? l : [];
      setLeandro(us.find((u) => semAc(u.nome).startsWith("LEANDRO") && u.setor === "PCP") || us.find((u) => semAc(u.nome).startsWith("LEANDRO")) || null);
    }).catch(() => setLeandro(null));
  }, []);
  const nome = (u) => `${u?.nome || ""} ${u?.sobrenome || ""}`.trim();
  const enviar = async () => {
    if (!leandro) return alerta("Não encontrei o Leandro no cadastro de usuários.");
    setEnviando(true);
    const quem = nome(user).toUpperCase();
    const tarefa = {
      titulo: `LANÇAR PEDIDO · solicitado por ${quem}`,
      descricao: obs.trim() ? obs.trim() : null,
      setor: setorTarefaDe(leandro), responsavelId: leandro.id, prazo: hojeIso(), tipo: "PADRAO",
    };
    const r = await fetch("/api/tarefas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, tarefa }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setEnviando(false); return alerta(d.error || "Não consegui criar a tarefa para o Leandro."); }
    const tid = d.tarefa?.id, falhas = [];
    for (const a of arqs) {
      const ra = tid ? await fetch(`/api/tarefas/${tid}/arquivos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, nome: a.nome, mime: a.mime, conteudo: a.conteudo }) }).catch(() => null) : null;
      if (!ra?.ok) falhas.push(a.nome);
    }
    setEnviando(false);
    if (falhas.length) alerta(`A tarefa foi criada, mas estes arquivos não subiram: ${falhas.join(", ")}`);
    setFeito(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-xl max-h-[92vh] flex flex-col" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b style={{ color: C.navy }}>Solicitar lançamento de pedido</b>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {feito ? <div className="p-6 text-sm text-center">
            <div className="font-semibold mb-1" style={{ color: C.green }}>Solicitação enviada para {nome(leandro)}.</div>
            <div style={{ color: C.sub }}>Virou uma tarefa na agenda dele para hoje, atribuída por você{arqs.length ? `, com ${arqs.length} anexo(s)` : ""}. Acompanhe em Tarefas.</div>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Fechar</button>
          </div>
          : <div className="p-5 overflow-auto space-y-3">
            <div>
              <div className="text-xs mb-1.5" style={{ color: C.sub }}>Para (PCP)</div>
              {leandro === undefined ? <span className="text-xs" style={{ color: C.sub }}>Carregando…</span>
                : leandro ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: C.navy, color: "#fff" }}>{nome(leandro)}</span>
                  : <span className="text-xs" style={{ color: "#D92D20" }}>Leandro não encontrado no cadastro de usuários.</span>}
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: C.sub }}>Observações</div>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={6} placeholder="Algo que o PCP precise saber para lançar (opcional)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none leading-6" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: C.sub }}>Anexos</div>
              <label onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files); }}
                className="flex flex-col items-center justify-center gap-1 rounded-lg py-4 cursor-pointer text-xs text-center"
                style={{ border: `2px dashed ${arrastando ? C.accent : C.line}`, background: arrastando ? C.accentSoft : C.panel2, color: C.sub }}>
                <Upload size={18} style={{ color: C.accent }} />
                <span><b style={{ color: C.text }}>Arraste os arquivos aqui</b> ou clique para escolher · vários de uma vez (até 40 MB cada)</span>
                <input type="file" multiple className="hidden" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
              </label>
              {arqs.length > 0 && <div className="mt-2 space-y-1">{arqs.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: C.panel2 }}>
                  <Paperclip size={12} style={{ color: C.sub }} /><span className="flex-1 truncate" style={{ color: C.text }}>{a.nome}</span>
                  <span style={{ color: C.sub }}>{kb(a.tamanho)}</span>
                  <button type="button" onClick={() => setArqs((l) => l.filter((_, j) => j !== i))} style={{ color: "#D92D20" }}><X size={13} /></button>
                </div>))}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando || !leandro} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: enviando || !leandro ? 0.6 : 1 }}>
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar ao PCP</button>
            </div>
          </div>}
      </div>
    </div>
  );
}
