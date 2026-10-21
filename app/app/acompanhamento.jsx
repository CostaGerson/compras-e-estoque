"use client";
// v381 — Comercial › Acompanhamento: pedidos do vendedor (master/diretoria: todos) com a situação no PCP
import React, { useEffect, useMemo, useState } from "react";
import { Search, Loader2, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
};
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const SIT = {
  LEVANTAMENTO: [C.sub, C.panel2], "A PROGRAMAR": [C.yellow, C.yellowSoft], "EM PRODUÇÃO": [C.blue, C.blueSoft], "CONCLUÍDO": [C.green, C.greenSoft],
  FATURADO: [C.green, C.greenSoft], CANCELADO: [C.sub, C.panel2], "FORA DO PCP": [C.red, C.redSoft], "SEM PCP": [C.sub, C.panel2],
};
const PROG = { ATRASADO: [C.red, C.redSoft, AlertTriangle, "Atrasado"], ADIANTADO: [C.green, C.greenSoft, CheckCircle2, "Adiantado"], OK: [C.blue, C.blueSoft, CheckCircle2, "Em dia"], SEM: [C.sub, C.panel2, Clock, "Sem programação"] };

export default function Acompanhamento({ user }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [todos, setTodos] = useState(false);
  const [busca, setBusca] = useState("");
  const [fSit, setFSit] = useState("");
  const [aberto, setAberto] = useState(null);

  const carregar = async () => {
    setErro(""); setD(null);
    try {
      const r = await fetch(`/api/comercial/acompanhamento?u=${user.id}${todos ? "&todos=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setErro(j.error || "Erro ao carregar."); return; }
      setD(j);
    } catch { setErro("Falha de conexão."); }
  };
  useEffect(() => { carregar(); }, [todos]);

  const lista = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return (d?.pedidos || []).filter((p) => (!fSit || p.situacao === fSit) && (!b || `${p.numero} ${p.cliente} ${p.vendedor || ""}`.toUpperCase().includes(b)));
  }, [d, busca, fSit]);
  const cont = useMemo(() => { const m = {}; for (const p of d?.pedidos || []) m[p.situacao] = (m[p.situacao] || 0) + 1; return m; }, [d]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-lg font-bold" style={{ color: C.navy }}>Acompanhamento de pedidos</div>
          <div className="text-xs" style={{ color: C.sub }}>{d?.todos ? "Todos os vendedores (master/diretoria)." : `Seus pedidos${d?.vendedor ? ` · ${d.vendedor}` : ""}.`} Situação = a do item menos avançado no PCP.</div>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> incluir faturados</label>
        <button onClick={carregar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.panel2, color: C.navy }}><RefreshCw size={13} /> Atualizar</button>
      </div>

      {d && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(cont).map(([k, n]) => { const [c, bg] = SIT[k] || SIT["SEM PCP"]; return (
            <button key={k} onClick={() => setFSit(fSit === k ? "" : k)} className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ color: fSit === k ? "#fff" : c, background: fSit === k ? c : bg }}>{k} · {n}</button>); })}
          <div className="flex items-center gap-2 rounded-lg px-3 py-1" style={{ background: C.panel, border: `1px solid ${C.line}`, minWidth: 240 }}>
            <Search size={13} style={{ color: C.sub }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pedido, cliente…" className="flex-1 text-sm outline-none" />
          </div>
        </div>
      )}

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}><Loader2 size={16} className="animate-spin inline" /> Carregando…</div>}
      {d && (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ minWidth: 820 }}>
            <thead><tr style={{ background: C.panel2, color: C.sub }}>
              {["", "Pedido", "Emissão", "Cliente", ...(d.todos ? ["Vendedor"] : []), "Itens", "Valor total", "Entrega", "Situação"].map((h, i) => (
                <th key={i} className={`px-3 py-2 font-semibold ${h === "Valor total" ? "text-right" : "text-left"}`}>{h}</th>))}
            </tr></thead>
            <tbody>
              {!lista.length && <tr><td colSpan={9} className="px-3 py-8 text-center" style={{ color: C.sub }}>Nenhum pedido{busca || fSit ? " com estes filtros" : ""}.</td></tr>}
              {lista.map((p) => { const [c, bg] = SIT[p.situacao] || SIT["SEM PCP"]; const ab = aberto === p.numero; return (
                <React.Fragment key={p.numero}>
                  <tr onClick={() => setAberto(ab ? null : p.numero)} className="cursor-pointer" style={{ height: 44, borderTop: `1px solid ${C.line}`, background: ab ? C.panel2 : undefined }}>
                    <td className="px-3">{ab ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                    <td className="px-3 font-bold" style={{ color: C.navy }}>{p.numero}</td>
                    <td className="px-3 whitespace-nowrap">{dBR(p.emissao)}</td>
                    <td className="px-3" style={{ maxWidth: 320 }}><div className="truncate" title={p.cliente}>{p.cliente}</div></td>
                    {d.todos && <td className="px-3" style={{ color: C.sub }}>{p.vendedor || "—"}</td>}
                    <td className="px-3 tabular-nums">{p.itens || "—"}</td>
                    <td className="px-3 text-right tabular-nums font-semibold">{p.total ? brl(p.total) : "—"}</td>
                    <td className="px-3 whitespace-nowrap">{dBR(p.entrega)}</td>
                    <td className="px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: c, background: bg }}>{p.situacao}{p.etapa ? ` · ${p.etapa}` : ""}</span>
                      {p.parcial && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: C.yellow, background: C.yellowSoft }}>faturado em parte</span>}
                    </td>
                  </tr>
                  {ab && <tr style={{ background: C.panel2 }}><td colSpan={9} className="px-4 pb-4 pt-1"><DetalhePcp user={user} numero={p.numero} /></td></tr>}
                </React.Fragment>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetalhePcp({ user, numero }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [abertoItem, setAbertoItem] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/comercial/acompanhamento?u=${user.id}&numero=${encodeURIComponent(numero)}`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!vivo) return; if (!r.ok) setErro(j.error || "Erro"); else setD(j); })
      .catch(() => vivo && setErro("Falha de conexão."));
    return () => { vivo = false; };
  }, [numero]);
  if (erro) return <div className="p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>;
  if (!d) return <div className="text-xs py-2" style={{ color: C.sub }}><Loader2 size={13} className="animate-spin inline" /> Lendo o PCP…</div>;
  if (!d.itens.length) return <div className="text-xs py-2" style={{ color: C.sub }}>Este pedido não está no PCP.</div>;
  return (
    <div className="rounded-lg overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      {d.agrupado && <div className="px-3 py-1.5 text-[11px]" style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>Produzido junto com outros pedidos na OP {d.ops.join(", ")} (agrupamento).</div>}
      <table className="w-full text-xs">
        <thead><tr style={{ color: C.sub }}>
          {["Peça", "Peças", "Situação", "Desde", "Programação", "Entrega"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>
          {d.itens.map((i) => { const [c, bg] = SIT[i.situacao] || SIT["SEM PCP"]; const [pc, pbg, PI, pt] = PROG[i.prog?.k] || PROG.SEM; const ab = abertoItem === i.itemCode; return (
            <React.Fragment key={i.itemCode}>
              <tr className="cursor-pointer" onClick={() => setAbertoItem(ab ? null : i.itemCode)} style={{ borderTop: `1px solid ${C.line}`, opacity: i.complemento ? 0.7 : 1 }}>
                <td className="px-3 py-1.5"><div className="font-semibold" style={{ color: C.text }}>{i.produto}</div>
                  <div className="text-[10px]" style={{ color: C.sub }}>{i.itemCode}{i.complemento ? " · complemento (corte)" : ""}{i.prestador ? ` · ${i.prestador}` : ""}</div></td>
                <td className="px-3 py-1.5 tabular-nums">{i.complemento ? `corte ${i.quantidade}` : i.pecas}</td>
                <td className="px-3 py-1.5 whitespace-nowrap"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: c, background: bg }}>{i.situacao}{i.etapa && i.situacao === "EM PRODUÇÃO" ? ` · ${i.etapa}` : ""}</span></td>
                <td className="px-3 py-1.5 whitespace-nowrap">{dBR(i.desde)}</td>
                <td className="px-3 py-1.5"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: pc, background: pbg }}><PI size={11} /> {pt}</span>
                  <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>{i.prog?.t}</div></td>
                <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: i.entrega && i.situacao !== "CONCLUÍDO" && i.entrega < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) ? C.red : C.text }}
                  title={i.entrega && i.situacao !== "CONCLUÍDO" && i.entrega < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) ? "prazo de entrega já passou" : undefined}>{dBR(i.entrega)}</td>
              </tr>
              {ab && i.etapas.length > 0 && (
                <tr><td colSpan={6} className="px-6 pb-2">
                  <table className="w-full text-[11px]"><thead><tr style={{ color: C.sub }}>
                    {["Etapa", "Prestador", "Programado", "Real", ""].map((h) => <th key={h} className="py-0.5 text-left font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{i.etapas.map((e, k) => (
                      <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}>
                        <td className="py-0.5">{e.etapa}{e.subetapa ? ` · ${e.subetapa}` : ""}</td><td className="py-0.5" style={{ color: C.sub }}>{e.prestador || "—"}</td>
                        <td className="py-0.5">{dBR(e.inicio)} → {dBR(e.planejadoFim)}</td><td className="py-0.5">{dBR(e.entrada)} → {e.saida ? dBR(e.saida) : "em curso"}</td>
                        <td className="py-0.5" style={{ color: e.concluida ? C.green : C.blue }}>{e.concluida ? "concluída" : "aberta"}</td>
                      </tr>))}</tbody></table>
                </td></tr>
              )}
            </React.Fragment>
          ); })}
        </tbody>
      </table>
    </div>
  );
}
