"use client";
// v420 — Produção › Gestão: indicadores do PCP (a cada 1 min), lista por fase do processo e o pedido em tela grande
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X, ChevronUp, ChevronDown, FileText, Pencil, MessageSquare, Send, RefreshCw, AlertTriangle } from "lucide-react";
import { FppResumo } from "./compras";
import { alerta } from "./dialogo";   // v424 — popups do sistema
import { ImportarNfs } from "./adm";   // v450 — Incluir faturamento (XML e PDF, como no movimento fiscal)

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41", trilho: "#E9EDF3",
};
const FASE_TXT = { COMPRAS: "Compras", CORTE: "Corte", PERSONALIZACAO: "Personalização", COSTURA: "Costura", EXPEDICAO: "Expedição", CONCLUIDO: "Concluído", FORA: "Fora do PCP" };
const FASE_COR = { COMPRAS: C.yellow, CORTE: C.blue, PERSONALIZACAO: "#7C5CD6", COSTURA: "#0E8F8F", EXPEDICAO: C.accent, CONCLUIDO: C.green, FORA: C.sub };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : "—");
const dh = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const dOnly = (s) => (!s ? "—" : /^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? dBR(s) : new Date(s).toLocaleDateString("pt-BR"));
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "—");
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ");

function Pizza({ p, cor, tam = 92 }) {
  const r = tam / 2 - 6, c = tam / 2, circ = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p || 0));
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} className="shrink-0">
      <circle cx={c} cy={c} r={r} fill="none" stroke={C.trilho} strokeWidth={11} />
      {v > 0 && <circle cx={c} cy={c} r={r} fill="none" stroke={cor} strokeWidth={11} strokeLinecap={v < 1 ? "round" : "butt"} strokeDasharray={`${circ * v} ${circ}`} transform={`rotate(-90 ${c} ${c})`} />}
      <text x={c} y={c} textAnchor="middle" dominantBaseline="central" style={{ fill: C.text, fontSize: 18, fontWeight: 600 }}>{Math.round(v * 100)}%</text>
    </svg>
  );
}
function CardKpi({ rotulo, n, total, cor, ativo, onClick, sub, pecas }) {
  return (
    <button onClick={onClick} className="rounded-xl p-4 flex items-center gap-4 text-left w-full" style={{ background: C.panel, border: `1px solid ${ativo ? cor : C.line}`, borderTop: `3px solid ${cor}`, boxShadow: ativo ? `0 0 0 2px ${cor}33` : "none" }}>
      <Pizza p={total ? n / total : 0} cor={cor} />
      <div>
        <div className="text-xs font-semibold" style={{ color: C.sub }}>{rotulo}</div>
        <div className="font-semibold" style={{ fontSize: 28, lineHeight: 1.1, color: C.text }}>{n}</div>
        <div className="text-[11px]" style={{ color: C.sub }}>{sub || `de ${total} pedido(s)`}</div>
        {pecas != null && <div className="text-xs font-semibold mt-0.5" style={{ color: C.text }}>{Number(pecas).toLocaleString("pt-BR")} peças</div>}
      </div>
    </button>
  );
}
const Chip = ({ cor, fundo, children }) => <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ color: cor, background: fundo || C.panel2 }}>{children}</span>;
// v450 — a faturar / NF aguardando contas / crítica
const ChipFaturar = ({ f }) => (f === "A_FATURAR" ? <Chip cor="#fff" fundo={C.accent}>A faturar</Chip> : f === "NF_SEM_CONTAS" ? <Chip cor={C.yellow} fundo={C.yellowSoft}>NF sem contas</Chip> : null);
const ChipStatus = ({ s }) => (s === "ATRASADO" ? <Chip cor={C.red} fundo={C.redSoft}>Atrasado</Chip> : <Chip cor={C.green} fundo={C.greenSoft}>Em dia</Chip>);
const ChipFase = ({ f }) => <Chip cor={FASE_COR[f] || C.sub} fundo={C.panel2}>{FASE_TXT[f] || f}</Chip>;

export default function ProducaoGestao({ user, atalhos, ir, abrirPedido }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState(null);
  const [q, setQ] = useState("");
  const [ord, setOrd] = useState({ k: "fase", dir: 1 });
  const [aberto, setAberto] = useState(null);
  useEffect(() => { if (abrirPedido?.numero) setAberto(String(abrirPedido.numero)); }, [abrirPedido?.t]);   // v450 — vindo da tarefa FATURAR
  const carregar = () => fetch("/api/producao/gestao").then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); const t = setInterval(carregar, 60 * 1000); return () => clearInterval(t); }, []);

  const lista = useMemo(() => {
    if (!d) return [];
    const termos = sem(q).split(/\s+/).filter(Boolean);
    let l = d.pedidos.filter((p) => !filtro || (filtro === "emDia" ? p.status === "EM DIA" : filtro === "atrasados" ? p.status === "ATRASADO" : filtro === "semana" ? p.semana : filtro === "faturar" ? p.faturar === "A_FATURAR" : filtro === "criticas" ? !!p.critica : true));
    if (termos.length) l = l.filter((p) => { const hay = sem(`${p.numero} ${p.cliente} ${p.oc || ""} ${p.itensTxt} ${p.total.toFixed(2)} ${p.total.toFixed(2).replace(".", ",")}`); return termos.every((t) => hay.includes(t)); });
    const val = { fase: (p) => (p.faseIdx < 0 ? 99 : p.faseIdx), numero: (p) => p.numero, cliente: (p) => p.cliente || "", pecas: (p) => p.pecas, total: (p) => p.total,
      prazo: (p) => p.prazo || "9", previsto: (p) => p.previsto || "9", status: (p) => (p.status === "ATRASADO" ? 0 : 1) };
    const f = val[ord.k] || val.fase;
    return [...l].sort((a, b) => { const x = f(a), y = f(b); const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y)); return (c || String(a.prazo || "9").localeCompare(String(b.prazo || "9"))) * ord.dir; });
  }, [d, filtro, q, ord]);

  const Th = ({ k, children, w }) => (
    <th onClick={() => setOrd((o) => ({ k, dir: o.k === k ? -o.dir : 1 }))} className="text-left px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ width: w }}>
      <span className="inline-flex items-center gap-1">{children}{ord.k === k && (ord.dir > 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
    </th>
  );
  const k = d?.kpis;
  const pc = (f) => (d ? d.pedidos.filter(f).reduce((s0, p) => s0 + (Number(p.pecas) || 0), 0) : 0);   // v422 — peças por card
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="text-xs flex-1 flex items-center gap-2" style={{ color: C.sub }}>
          Lido do PCP a cada minuto{d?.sync?.em ? ` · última leitura ${dh(d.sync.em)}` : ""}
          {d?.sync?.erro && <span className="flex items-center gap-1" style={{ color: C.red }}><AlertTriangle size={12} /> {d.sync.erro}</span>}
          <button onClick={carregar} title="Atualizar" className="p-1 rounded" style={{ color: C.sub }}><RefreshCw size={13} /></button>
        </div>
        {(atalhos || []).map((a) => {
          const Ico = a.icon;
          return <button key={a.key} onClick={() => ir(a.key)} title={a.desc} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text }}>{Ico && <Ico size={13} />} {a.label}</button>;
        })}
      </div>
      {erro && <div className="text-sm mb-3" style={{ color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Lendo o PCP…</div>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <CardKpi rotulo="Pedidos em andamento" n={k.andamento} total={k.andamento} cor={C.navy} ativo={!filtro} onClick={() => setFiltro(null)} sub="total" pecas={pc(() => true)} />
            <CardKpi rotulo="Em dia" n={k.emDia} total={k.andamento} cor={C.green} ativo={filtro === "emDia"} onClick={() => setFiltro(filtro === "emDia" ? null : "emDia")} pecas={pc((p) => p.status === "EM DIA")} />
            <CardKpi rotulo="Atrasados" n={k.atrasados} total={k.andamento} cor={C.red} ativo={filtro === "atrasados"} onClick={() => setFiltro(filtro === "atrasados" ? null : "atrasados")} pecas={pc((p) => p.status === "ATRASADO")} />
            <CardKpi rotulo="Entrega na semana" n={k.semana} total={k.andamento} cor={C.accent} ativo={filtro === "semana"} onClick={() => setFiltro(filtro === "semana" ? null : "semana")} sub={`de ${k.andamento} · próximos 7 dias`} pecas={pc((p) => p.semana)} />
            <CardKpi rotulo="A faturar" n={k.faturar || 0} total={k.andamento} cor={C.accent} ativo={filtro === "faturar"} onClick={() => setFiltro(filtro === "faturar" ? null : "faturar")} sub={k.criticas ? `${k.criticas} com crítica` : "concluídos no PCP"} pecas={pc((p) => p.faturar === "A_FATURAR")} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-semibold flex-1" style={{ color: C.navy }}>{lista.length} pedido(s){filtro ? ` · ${{ emDia: "em dia", atrasados: "atrasados", semana: "entrega na semana", faturar: "a faturar", criticas: "com crítica" }[filtro]}` : ""}</div>
            <div className="flex items-center gap-2 px-2 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
              <Search size={14} style={{ color: C.sub }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, nº do pedido, valor ou item…" className="py-1.5 text-sm outline-none w-72" />
              {q && <button onClick={() => setQ("")} style={{ color: C.sub }}><X size={13} /></button>}
            </div>
          </div>
          <div className="rounded-lg overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-sm">
              <thead style={{ background: C.panel2, color: C.sub }} className="text-xs">
                <tr><Th k="numero">Pedido</Th><Th k="cliente">Cliente</Th><Th k="pecas">Peças</Th><Th k="total">Valor</Th><Th k="prazo">Entrega</Th><Th k="previsto">Prev. término</Th><Th k="fase">Fase</Th><Th k="status">Status</Th></tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.numero} onClick={() => setAberto(p.numero)} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: C.navy }}>{p.numero}</td>
                    <td className="px-3 py-2" style={{ color: C.text }}>{p.cliente}<div className="text-[11px] truncate" style={{ color: C.sub, maxWidth: 380 }} title={p.itensTxt}>{p.nItens} item(ns){p.oc ? ` · OC ${p.oc}` : ""}</div></td>
                    <td className="px-3 py-2 tabular-nums">{p.pecas}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{brl(p.total)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{dBR(p.prazo)}{p.semana && <span className="ml-1 text-[10px] font-bold" style={{ color: C.accent }}>semana</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.previsto && p.prazo && p.previsto > p.prazo ? C.red : C.text }}>{dBR(p.previsto)}</td>
                    <td className="px-3 py-2"><ChipFase f={p.fase} /></td>
                    <td className="px-3 py-2"><div className="flex items-center gap-1 flex-wrap"><ChipStatus s={p.status} /><ChipFaturar f={p.faturar} />{p.critica && <span title={p.critica}><AlertTriangle size={14} style={{ color: C.red }} /></span>}</div></td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm" style={{ color: C.sub }}>Nenhum pedido.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {aberto && <PedidoTela numero={aberto} user={user} onClose={() => setAberto(null)} />}
    </div>
  );
}

// ---------- pedido em tela grande ----------
let _usuarios = null;
function PedidoTela({ numero, user, onClose }) {
  const [p, setP] = useState(null);
  const [erro, setErro] = useState("");
  const [obs, setObs] = useState("");
  const [salvObs, setSalvObs] = useState(false);
  const [verFpp, setVerFpp] = useState(null);
  const [guia, setGuia] = useState("geral");   // v423 — visão geral | financeiro
  const [fatura, setFatura] = useState(false);   // v450 — Incluir faturamento
  const carregar = () => fetch(`/api/producao/gestao?numero=${encodeURIComponent(numero)}`).then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setP(x); setObs(x.obs || ""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [numero]);
  async function salvarObs() {
    setSalvObs(true);
    await fetch("/api/producao/gestao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "obs", numero, obs, autorNome: nomeU(user) }) });
    setSalvObs(false); carregar();
  }
  const editarFpp = (id) => { window.dispatchEvent(new CustomEvent("ce:ir", { detail: { v: "fpp", fppId: id, voltar: { v: "pedido", numero } } })); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-6xl flex flex-col overflow-hidden shadow-2xl" style={{ background: C.bg, maxHeight: "90vh" }}>
        <div className="flex items-start gap-3 px-5 py-3" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold" style={{ color: C.navy }}>Pedido {numero}</span>
              {p && <ChipStatus s={p.status} />}{p && <ChipFase f={p.fase} />}{p && <ChipFaturar f={p.faturar} />}
            </div>
            {p && <div className="text-sm" style={{ color: C.text }}>{p.cliente}</div>}
          </div>
          {p && <button onClick={() => setFatura(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: p.faturar === "A_FATURAR" ? C.accent : C.panel, color: p.faturar === "A_FATURAR" ? "#fff" : C.accent, border: `1px solid ${C.accent}` }}><FileText size={14} /> Incluir faturamento</button>}
          <button onClick={onClose}><X size={20} style={{ color: C.sub }} /></button>
        </div>
        {p?.critica && <div className="flex items-center gap-2 px-5 py-2 text-sm font-semibold" style={{ background: C.redSoft, color: C.red }}><AlertTriangle size={15} /> {p.critica}</div>}
        {p?.parcial && !p?.critica && p.faturamento?.valorPendente > 0 && <div className="px-5 py-2 text-xs" style={{ background: C.yellowSoft, color: C.yellow }}>Faturamento parcial: falta{p.faturamento.pecasPendentes != null ? ` ${p.faturamento.pecasPendentes} peça(s) ·` : ""} {brl(p.faturamento.valorPendente)} — o saldo segue acompanhado no PCP do Maycon.</div>}
        <div className="flex gap-1 px-5" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
          {[["geral", "Visão geral"], ["financeiro", "Financeiro"]].map(([k, t]) => (
            <button key={k} onClick={() => setGuia(k)} className="px-4 py-2 text-sm" style={{ color: guia === k ? C.accent : C.sub, fontWeight: guia === k ? 700 : 500, borderBottom: guia === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>{t}</button>
          ))}
        </div>
        {erro && <div className="p-5 text-sm" style={{ color: C.red }}>{erro}</div>}
        {!p && !erro && <div className="p-5 flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
        {p && guia === "financeiro" && (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="grid gap-3 text-sm" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
                {[["Valor do pedido", brl(p.total)], ["Condição", p.condicao || "—"], ["Faturado", brl(p.faturamento.faturado)], ["Pendente a faturar", brl(p.faturamento.valorPendente)]].map(([l, v]) => (
                  <div key={l}><div className="text-xs" style={{ color: C.sub }}>{l}</div><div className="font-semibold" style={{ color: C.text }}>{v}</div></div>
                ))}
              </div>
            </div>
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>Faturamento</div>
                <div className="grid gap-3 mb-2" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                  <div><div className="text-xs" style={{ color: C.sub }}>Faturado</div><div className="font-semibold">{brl(p.faturamento.faturado)}</div></div>
                  <div><div className="text-xs" style={{ color: C.sub }}>Peças pendentes de entrega</div><div className="font-semibold">{p.faturamento.pecasPendentes ?? "—"}</div></div>
                  <div><div className="text-xs" style={{ color: C.sub }}>Valor pendente a faturar</div><div className="font-semibold" style={{ color: C.accent }}>{brl(p.faturamento.valorPendente)}</div></div>
                </div>
                {p.faturamento.nfs.length ? p.faturamento.nfs.map((n) => (
                  <div key={n.numero} className="flex gap-3 text-xs py-1" style={{ borderTop: `1px solid ${C.line}` }}>
                    <span className="font-semibold">NF {n.numero}</span><span style={{ color: C.sub }}>{dOnly(n.emissao)}</span>{n.pecas ? <span style={{ color: C.sub }}>{n.pecas} pç</span> : null}<span className="ml-auto">{brl(n.valor)}</span>
                  </div>
                )) : <div className="text-xs" style={{ color: C.sub }}>Nenhuma NF emitida.</div>}
              </div>
          </div>
        )}
        {p && guia === "geral" && (
          <div className="flex-1 overflow-auto grid gap-4 p-4" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(320px,1fr)" }}>
            <div className="space-y-4 min-w-0">
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="grid gap-3 text-sm" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
                  {[["Cliente", p.cliente], ["OC do cliente", p.oc || "—"], ["Vendedor", p.vendedor || "—"], ["Condição", p.condicao || "—"],
                    ["Emissão", dBR(p.emissao)], ["Entrega", dBR(p.prazo)], ["Prev. término", dBR(p.previsto)], ["Valor", brl(p.total)]].map(([l, v]) => (
                    <div key={l} className="min-w-0"><div className="text-xs" style={{ color: C.sub }}>{l}</div><div className="font-semibold truncate" style={{ color: C.text }} title={String(v)}>{v}</div></div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="text-xs mb-1" style={{ color: C.sub }}>Observação</div>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.line}` }} />
                  {obs !== (p.obs || "") && <button onClick={salvarObs} disabled={salvObs} className="mt-1 px-3 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}>{salvObs ? "Salvando…" : "Salvar observação"}</button>}
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>Itens</div>
                {p.itens.map((i) => (
                  <div key={i.chave} className="flex items-center gap-3 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: C.text }}>{i.codigo ? `${i.codigo} · ` : ""}{i.descricao}</div>
                      <div className="text-xs" style={{ color: C.sub }}>{i.qtd} peças{i.preco ? ` · ${brl(i.preco)}/pç` : ""}{i.grade?.length ? ` · ${i.grade.map((g) => `${g.tam}:${g.qtd}`).join(" ")}` : ""}</div>
                    </div>
                    {i.fase && <ChipFase f={i.fase} />}
                    {i.fppId ? (
                      <div className="flex gap-1">
                        <button onClick={() => setVerFpp(i)} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.text }}><FileText size={12} /> FPP {fmtFpp(i.fppNumero)}</button>
                        <button onClick={() => editarFpp(i.fppId)} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.accent }}><Pencil size={12} /> Editar</button>
                      </div>
                    ) : <span className="text-xs" style={{ color: C.sub }}>sem FPP</span>}
                  </div>
                ))}
              </div>

            </div>

            <div className="space-y-4 min-w-0">
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>Ocorrências</div>
                {p.erroPcp && <div className="text-xs mb-2" style={{ color: C.red }}>PCP indisponível: {p.erroPcp}</div>}
                <div className="space-y-0">
                  {p.ocorrencias.map((o, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center"><span className="rounded-full mt-1" style={{ width: 10, height: 10, background: o.emCurso ? C.accent : FASE_COR[o.tipo] || C.navy }} />{i < p.ocorrencias.length - 1 && <span className="flex-1" style={{ width: 2, background: C.line }} />}</div>
                      <div className="pb-3 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: C.text }}>{o.titulo}{o.emCurso && <span className="ml-2 text-[11px]" style={{ color: C.accent }}>em curso</span>}</div>
                        <div className="text-xs" style={{ color: C.sub }}>
                          {o.tipo === "LANCAMENTO" ? dh(o.inicio) : `${dOnly(o.inicio)} → ${o.fim ? dOnly(o.fim) : o.previsto ? `previsto ${dOnly(o.previsto)}` : "…"}`}
                          {o.quem ? ` · ${o.quem}` : ""}
                        </div>
                        {o.obs && <div className="text-[11px]" style={{ color: C.sub }}>{o.obs}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Comentarios numero={numero} user={user} lista={p.comentarios} onNovo={carregar} />
            </div>
          </div>
        )}
        {verFpp && <FppResumo fppId={verFpp.fppId} item={verFpp} veValores onClose={() => setVerFpp(null)} onUsar={null} />}
        {fatura && <ImportarNfs user={user} pedidoNumero={numero} onClose={() => { setFatura(false); carregar(); }} onFim={() => { setFatura(false); carregar(); }} />}
      </div>
    </div>
  );
}

function Comentarios({ numero, user, lista, onNovo }) {
  const [txt, setTxt] = useState("");
  const [mencoes, setMencoes] = useState([]);
  const [us, setUs] = useState(_usuarios || []);
  const [sug, setSug] = useState(null);   // termo depois do @
  const [env, setEnv] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (!_usuarios) fetch("/api/usuarios/lista").then((r) => r.json()).then((l) => { _usuarios = Array.isArray(l) ? l : []; setUs(_usuarios); }).catch(() => {}); }, []);
  function mudar(v) {
    setTxt(v);
    const m = v.match(/@([\p{L}]*)$/u);
    setSug(m ? m[1] : null);
  }
  function marcar(u) {
    const nome = nomeU(u);
    setTxt((t) => t.replace(/@([\p{L}]*)$/u, `@${nome} `));
    setMencoes((m) => (m.some((x) => x.id === u.id) ? m : [...m, { id: u.id, nome }]));
    setSug(null); ref.current?.focus();
  }
  async function enviar() {
    if (!txt.trim()) return;
    setEnv(true);
    const ativos = mencoes.filter((m) => txt.includes(`@${m.nome}`));
    const r = await fetch("/api/producao/gestao", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "comentar", numero, texto: txt, mencoes: ativos.map((m) => m.id), autorId: user?.id, autorNome: nomeU(user) }) });
    setEnv(false);
    if (!r.ok) return alerta("Não foi possível comentar.");
    setTxt(""); setMencoes([]); onNovo();
  }
  const sugs = sug != null ? us.filter((u) => sem(nomeU(u)).includes(sem(sug))).slice(0, 6) : [];
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-sm font-bold mb-2 flex items-center gap-1" style={{ color: C.navy }}><MessageSquare size={14} /> Comentários</div>
      <div className="space-y-2 mb-3 max-h-72 overflow-auto">
        {!lista.length && <div className="text-xs" style={{ color: C.sub }}>Nenhum comentário.</div>}
        {lista.map((c) => (
          <div key={c.id} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
            <div className="text-[11px]" style={{ color: C.sub }}><b style={{ color: C.text }}>{c.autorNome || "—"}</b> · {dh(c.createdAt)}</div>
            <div className="text-sm whitespace-pre-wrap" style={{ color: C.text }}>{c.texto}</div>
          </div>
        ))}
      </div>
      <div className="relative">
        <textarea ref={ref} value={txt} onChange={(e) => mudar(e.target.value)} rows={3} placeholder="Escreva um comentário… use @ para marcar alguém"
          className="w-full px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.line}` }} />
        {sugs.length > 0 && (
          <div className="absolute z-10 left-0 right-0 rounded-md shadow-lg" style={{ background: "#fff", border: `1px solid ${C.line}`, bottom: "100%" }}>
            {sugs.map((u) => <button key={u.id} type="button" onMouseDown={(e) => { e.preventDefault(); marcar(u); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">{nomeU(u)} <span className="text-xs" style={{ color: C.sub }}>{u.setor || ""}</span></button>)}
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px]" style={{ color: C.sub }}>Quem for marcado recebe uma mensagem.</span>
          <button onClick={enviar} disabled={env || !txt.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff", opacity: txt.trim() ? 1 : 0.5 }}><Send size={12} /> Comentar</button>
        </div>
      </div>
    </div>
  );
}
