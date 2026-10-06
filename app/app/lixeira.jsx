"use client";
// v139 — Lixeira de contas: excluídas ficam 30 dias para reativar ou excluir de vez
import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Search, RotateCcw, Trash2 } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", blue: "#2E7CD6", blueSoft: "#EAF2FC",
};
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};

export default function Lixeira({ user, onMudou }) {
  const [l, setL] = useState(null);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("TODOS");
  const [sel, setSel] = useState(() => new Set());
  const [st, setSt] = useState("");
  const [msg, setMsg] = useState(null);
  const [ordem, setOrdem] = useState(null);
  const carregar = () => api(`/api/fin/lixeira?u=${user.id}`).then((d) => { setL(d.itens); setSel(new Set()); }).catch((e) => setMsg({ erro: e.message }));
  useEffect(() => { carregar(); }, []);
  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    let x = (l || []).filter((i) => (tipo === "TODOS" || i.tipo === tipo) && (!q || [i.titulo, i.parceiro, i.excluidoPorNome].some((v) => String(v || "").toUpperCase().includes(q))));
    if (ordem) x = [...x].sort((a, b) => { const p = a[ordem.col] ?? "", q2 = b[ordem.col] ?? ""; return (typeof p === "number" ? p - q2 : String(p).localeCompare(String(q2), "pt-BR", { numeric: true })) * ordem.dir; });
    return x;
  }, [l, busca, tipo, ordem]);
  const clicar = (col) => setOrdem((o) => (!o || o.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null));
  const Th = ({ col, children, direita }) => (
    <th className={`px-3 py-2 ${direita ? "text-right" : ""}`}>
      <button onClick={() => clicar(col)} className={`inline-flex items-center gap-0.5 uppercase tracking-wide ${direita ? "flex-row-reverse" : ""}`} style={{ color: ordem?.col === col ? C.accent : C.sub }}>
        {children}<span className="text-[10px]">{ordem?.col === col ? (ordem.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
  const fazer = async (acao, ids) => {
    if (!ids.length) return;
    if (acao === "excluir" && !confirm(`Excluir definitivamente ${ids.length} conta(s)? Não dá para desfazer.`)) return;
    setSt(acao); setMsg(null);
    try {
      const r = await api("/api/fin/lixeira", "POST", { usuarioId: user.id, acao, ids });
      setMsg({ ok: `${r.feitos} conta(s) ${acao === "reativar" ? "reativada(s) — voltaram para o contas a pagar/receber" : "excluída(s) definitivamente"}.${r.avisos.length ? " " + r.avisos.join(" ") : ""}${r.erros.length ? " Erros: " + r.erros.join("; ") : ""}` });
      await carregar(); if (acao === "reativar" && onMudou) onMudou();
    } catch (e) { setMsg({ erro: e.message }); }
    setSt("");
  };
  const marcados = lista.filter((i) => sel.has(i.id)).map((i) => i.id);
  const todos = lista.length > 0 && lista.every((i) => sel.has(i.id));
  if (!l) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>;
  return (
    <div>
      <div className="text-xs mb-3 p-3 rounded-lg" style={{ background: C.panel2, color: C.text }}>
        Toda conta excluída (a pagar ou a receber) fica aqui por <b>30 dias</b>. Reativar devolve a conta com os anexos; depois de 30 dias ela é apagada de vez.
        Contas de recorrência e da semana excluídas aparecem como <b>canceladas</b> — reativar volta a conta para em aberto.
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, fornecedor/cliente…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}`, width: 260 }} />
        </div>
        {[["TODOS", "Todas"], ["PAGAR", "A pagar"], ["RECEBER", "A receber"]].map(([k, t]) => (
          <button key={k} onClick={() => setTipo(k)} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: tipo === k ? C.navy : C.panel2, color: tipo === k ? "#fff" : C.sub }}>{t}</button>
        ))}
        <div className="flex-1" />
        {marcados.length > 0 && <span className="text-xs" style={{ color: C.sub }}>{marcados.length} marcada(s)</span>}
        <button onClick={() => fazer("reativar", marcados)} disabled={!marcados.length || !!st} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.green, opacity: marcados.length ? 1 : 0.5 }}>
          {st === "reativar" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reativar
        </button>
        <button onClick={() => fazer("excluir", marcados)} disabled={!marcados.length || !!st} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.red, opacity: marcados.length ? 1 : 0.5 }}>
          {st === "excluir" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir definitivamente
        </button>
      </div>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={msg.erro ? { background: C.redSoft, color: C.red } : { background: C.greenSoft, color: C.green }}>{msg.erro || msg.ok}</div>}
      <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-left" style={{ background: C.panel2, color: C.sub }}>
            <th className="px-3 py-2 w-8"><input type="checkbox" checked={todos} onChange={(e) => setSel(e.target.checked ? new Set(lista.map((i) => i.id)) : new Set())} /></th>
            <Th col="excluidoEm">Excluída em</Th><Th col="tipo">Tipo</Th><Th col="titulo">Conta</Th><Th col="parceiro">Fornecedor / cliente</Th>
            <Th col="vencimento">Vencimento</Th><Th col="valor" direita>Valor</Th><Th col="diasRestantes" direita>Some em</Th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id} style={{ borderTop: `1px solid ${C.line}`, background: sel.has(i.id) ? C.accentSoft : undefined }}>
                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(i.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(i.id) : n.delete(i.id); return n; })} /></td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(i.excluidoEm).toLocaleDateString("pt-BR")}<div className="text-[11px]" style={{ color: C.sub }}>{i.excluidoPorNome || ""}</div></td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={i.tipo === "PAGAR" ? { background: C.redSoft, color: C.red } : { background: C.blueSoft, color: C.blue }}>{i.tipo === "PAGAR" ? "A PAGAR" : "A RECEBER"}</span>
                  {i.modo === "CANCELADA" && <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>cancelada</div>}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{i.titulo}<div className="text-[11px] font-normal" style={{ color: C.sub }}>era {i.status === "PAGO" ? "PAGA" : i.status === "ABERTO" ? "EM ABERTO" : i.status}</div></td>
                <td className="px-3 py-2">{i.parceiro}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dBR(i.vencimento)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{moeda(i.valor)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: i.diasRestantes <= 5 ? C.red : C.sub }}>{i.diasRestantes} dia(s)</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => fazer("reativar", [i.id])} title="Reativar" className="p-1" style={{ color: C.green }}><RotateCcw size={15} /></button>
                  <button onClick={() => fazer("excluir", [i.id])} title="Excluir definitivamente" className="p-1" style={{ color: C.red }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={9} className="px-3 py-6 text-center" style={{ color: C.sub }}>A lixeira está vazia.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
