"use client";
// v812 — Comercial: "Solicitar lançamento" abre uma mensagem do sistema para o PCP com o roteiro do pedido
import React, { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { alerta } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", green: "#12A150", greenSoft: "#E7F6EE" };
const MODELO = `SOLICITAÇÃO DE LANÇAMENTO DE PEDIDO
Cliente (nome e CNPJ):
OC do cliente:
FPP:
Itens (descrição · grade por tamanho · valor unitário):
- 
Prazo de entrega:
Pagamento:
Entrega (endereço / retirada):
Observações:`;

export default function SolicitarLancamento({ user, onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [para, setPara] = useState(new Set());
  const [texto, setTexto] = useState(MODELO);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(0);
  useEffect(() => {
    fetch("/api/usuarios/lista").then((r) => r.json()).then((l) => {
      const us = (Array.isArray(l) ? l : []).filter((u) => u.id !== user.id);
      setUsuarios(us);
      setPara(new Set(us.filter((u) => u.setor === "PCP").map((u) => u.id)));   // padrão: o PCP
    }).catch(() => {});
  }, []);
  const pcp = usuarios.filter((u) => u.setor === "PCP"), outros = usuarios.filter((u) => u.setor !== "PCP");
  const marca = (id) => setPara((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const enviar = async () => {
    if (!para.size) return alerta("Escolha quem recebe a solicitação.");
    if (texto.trim() === MODELO.trim()) return alerta("Preencha os dados do pedido antes de enviar.");
    setEnviando(true);
    let ok = 0;
    for (const id of para) {
      const r = await fetch("/api/mensagens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deId: user.id, paraId: id, texto: texto.trim() }) }).catch(() => null);
      if (r?.ok) ok++;
    }
    setEnviando(false);
    if (!ok) return alerta("Não consegui enviar a mensagem.");
    setFeito(ok);
  };
  const nome = (u) => `${u.nome || ""} ${u.sobrenome || ""}`.trim();
  const chip = (u) => <button key={u.id} type="button" onClick={() => marca(u.id)} className="px-2.5 py-1 rounded-full text-xs font-semibold"
    style={para.has(u.id) ? { background: C.navy, color: "#fff", border: `1px solid ${C.navy}` } : { background: "#fff", color: C.sub, border: `1px solid ${C.line}` }}>{nome(u)}</button>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-xl max-h-[92vh] flex flex-col" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b style={{ color: C.navy }}>Solicitar lançamento de pedido</b>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {feito ? <div className="p-6 text-sm text-center">
            <div className="font-semibold mb-1" style={{ color: C.green }}>Solicitação enviada para {feito} pessoa(s).</div>
            <div style={{ color: C.sub }}>Ela aparece em Mensagens › Enviadas; a resposta chega na sua caixa de mensagens.</div>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Fechar</button>
          </div>
          : <div className="p-5 overflow-auto space-y-3">
            <div>
              <div className="text-xs mb-1.5" style={{ color: C.sub }}>Para (PCP)</div>
              <div className="flex flex-wrap gap-1.5">{pcp.length ? pcp.map(chip) : <span className="text-xs" style={{ color: C.sub }}>Nenhum usuário do PCP — escolha abaixo.</span>}</div>
              {outros.length > 0 && <details className="mt-2"><summary className="text-xs cursor-pointer" style={{ color: C.sub }}>outras pessoas</summary><div className="flex flex-wrap gap-1.5 mt-1.5">{outros.map(chip)}</div></details>}
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: C.sub }}>Mensagem</div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={14} className="w-full px-3 py-2 rounded-lg text-sm outline-none leading-6" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: enviando ? 0.6 : 1 }}>
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar ao PCP</button>
            </div>
          </div>}
      </div>
    </div>
  );
}
