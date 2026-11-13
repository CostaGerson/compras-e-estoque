"use client";
// v670 — Dados › Itens KM: todos os itens cadastrados no KM (o agente do PC da fábrica manda de hora em hora), só leitura.
//   Lista ordenável e com busca; clique abre o detalhe (texto do último detalhe de produção, parâmetros, NCM, GTIN).
//   "Criar item padrão" já leva código, nome, parâmetros, NCM, GTIN e preço para o cadastro de itens padrão.
import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Loader2, Plus, RefreshCw } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { ItemPadraoModal } from "./itensPadrao";   // v774 — #56: item do KM edita na mesma tela do item padrão
import { partesTecido } from "@/lib/pedidoLanc";   // v809

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", green: "#12A150", red: "#D92D20" };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dh = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const fmtNcm = (n) => (n && n.length === 8 ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : n || "—");

// v774 — #57: a lista junta os itens do KM e os criados no sistema (pelo pedido ou no cadastro), com o código automático;
//   #56: clicar abre a edição do item padrão (item do KM sem cadastro ainda: "Editar item" cria o cadastro e abre)
export default function ItensKm({ user, componentes = {} }) {
  const [d0, setD] = useState(null);
  const [ips, setIps] = useState(null);
  const [editar, setEditar] = useState(null);   // id do item padrão
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ k: "codigo", dir: 1 });
  const [lim, setLim] = useState(300);
  const [abrir, setAbrir] = useState(null);
  const ler = () => {
    setD(null); fetch("/api/km/itens", { cache: "no-store" }).then((r) => r.json()).then(setD).catch((e) => setD({ erro: e.message, itens: [] }));
    fetch("/api/itens-padrao", { cache: "no-store" }).then((r) => r.json()).then((l) => setIps(Array.isArray(l) ? l : [])).catch(() => setIps([]));
  };
  const d = useMemo(() => {
    if (!d0) return null;
    const porKm = new Map((ips || []).filter((i) => i.codigo).map((i) => [String(i.codigo).toUpperCase(), i]));
    const km = (d0.itens || []).map((i) => ({ ...i, padrao: porKm.get(String(i.codigo).toUpperCase()) || null, origem: "KM" }));
    const noKm = new Set(km.map((i) => String(i.codigo).toUpperCase()));
    const sis = (ips || []).filter((i) => !i.codigo || !noKm.has(String(i.codigo).toUpperCase())).map((i) => ({
      codigo: i.codigoPadrao || i.codigo || `#${i.id}`, nome: i.nomeInterno, ncm: i.ncm, gtin: i.gtin, unidade: "UN", preco: i.precoAtual,
      parametros: Object.entries(i.parametros || {}).map(([t, v]) => ({ t, v: typeof v === "object" ? partesTecido(v).join(" · ") : v })),
      usos: null, kmSyncEm: i.updatedAt, padrao: i, origem: "SISTEMA" }));
    return { ...d0, itens: [...km, ...sis] };
  }, [d0, ips]);
  useEffect(() => { ler(); }, []);
  const lista = useMemo(() => {
    const pal = norm(q).split(/\s+/).filter(Boolean);
    const l = (d?.itens || []).filter((i) => !pal.length || pal.every((w) => norm([i.codigo, i.nome, i.ncm, i.gtin, ...(i.parametros || []).map((p) => `${p.t} ${p.v}`)].join(" ")).includes(w)));
    const v = { padrao: (i) => i.padrao?.codigoPadrao || "", codigo: (i) => i.codigo, nome: (i) => i.nome, ncm: (i) => i.ncm || "", gtin: (i) => i.gtin || "", unidade: (i) => i.unidade || "", preco: (i) => i.preco ?? -1, usos: (i) => i.usos || 0, params: (i) => (i.parametros || []).length, sync: (i) => i.kmSyncEm || "" };
    const f = v[sort.k] || v.codigo;
    return [...l].sort((a, b) => { const x = f(a), y = f(b); return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true })) * sort.dir; });
  }, [d, q, sort]);
  const Th = ({ k, children, cls = "" }) => <th onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }))} className={`px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${cls}`}>{children}{sort.k === k ? (sort.dir > 0 ? " ▲" : " ▼") : ""}</th>;
  const comNcm = (d?.itens || []).filter((i) => i.ncm).length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 px-2 rounded flex-1 min-w-64" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setLim(300); }} placeholder="Código, nome, NCM, parâmetro…" className="py-1.5 text-sm outline-none flex-1" />
          {q && <button onClick={() => setQ("")} style={{ color: C.sub }}><X size={13} /></button>}
        </div>
        <button onClick={ler} className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }} title="Atualizar"><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>
        {d ? <>{lista.length} de {(d.itens || []).length} item(ns) (KM e sistema) · {comNcm} com NCM · clique na linha para editar, no título para ordenar</> : null}
        {d?.sync?.em && <> · última leitura do KM {dh(d.sync.em)} ({d.sync.gravados ?? d.sync.recebidos} itens)</>}
        {d && !(d.itens || []).length && !d.erro && <> · ainda não chegou nenhum item: o agente do PC da fábrica manda de hora em hora (minuto 10)</>}
      </div>
      {!d && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {d?.erro && <div className="text-sm" style={{ color: C.red }}>{d.erro}</div>}
      {d && lista.length > 0 && (
        <div className="rounded-lg overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm">
            <thead style={{ background: C.panel2, color: C.sub }} className="text-xs text-left">
              <tr><Th k="codigo">Código</Th><Th k="padrao">Cód. sistema</Th><Th k="nome">Nome</Th><Th k="ncm">NCM</Th><Th k="gtin">GTIN/EAN</Th><Th k="unidade">Unid.</Th><Th k="params">Parâmetros</Th><Th k="preco">Últ. preço</Th><Th k="usos">Usos</Th><Th k="sync">Atualizado</Th></tr>
            </thead>
            <tbody>
              {lista.slice(0, lim).map((i) => (
                <tr key={`${i.origem}-${i.codigo}`} onClick={() => (i.padrao ? setEditar(i.padrao.id) : setAbrir(i.codigo))} className="cursor-pointer hover:bg-gray-50 whitespace-nowrap" style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-3 py-1.5 font-semibold" style={{ color: C.navy }}>{i.codigo}{i.origem === "SISTEMA" && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: C.accentSoft, color: C.accent }}>sistema</span>}</td>
                  <td className="px-3 py-1.5 text-xs tabular-nums" style={{ color: i.padrao?.codigoPadrao ? C.text : C.sub }}>{i.padrao?.codigoPadrao || "—"}</td>
                  <td className="px-3 py-1.5" style={{ maxWidth: 380 }}><div className="truncate" title={i.nome}>{i.nome}</div></td>
                  <td className="px-3 py-1.5 tabular-nums text-xs" style={{ color: i.ncm ? C.text : C.sub }}>{fmtNcm(i.ncm)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-xs" style={{ color: C.sub }}>{i.gtin || "—"}</td>
                  <td className="px-3 py-1.5 text-xs" style={{ color: C.sub }}>{i.unidade || "—"}</td>
                  <td className="px-3 py-1.5 text-xs" style={{ color: C.sub, maxWidth: 260 }}><div className="truncate" title={(i.parametros || []).map((p) => `${p.t}: ${p.v}`).join("\n")}>{(i.parametros || []).length ? `${i.parametros.length} · ${i.parametros.slice(0, 2).map((p) => p.t).join(", ")}${i.parametros.length > 2 ? "…" : ""}` : "—"}</div></td>
                  <td className="px-3 py-1.5 tabular-nums text-xs">{brl(i.preco)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-xs" style={{ color: C.sub }}>{i.usos || 0}</td>
                  <td className="px-3 py-1.5 text-xs" style={{ color: C.sub }}>{dh(i.kmSyncEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > lim && <button onClick={() => setLim((n) => n + 500)} className="w-full py-2 text-xs font-semibold" style={{ color: C.accent, borderTop: `1px solid ${C.line}` }}>mostrar mais ({lista.length - lim} restantes)</button>}
        </div>
      )}
      {abrir && <DetalheKm codigo={abrir} user={user} onClose={() => setAbrir(null)} onEditar={(id) => { setAbrir(null); ler(); setEditar(id); }} />}
      {editar && <ItemPadraoModal id={editar} user={user} componentes={componentes} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); ler(); }} />}
    </div>
  );
}

function DetalheKm({ codigo, user, onClose, onEditar }) {
  const [p, setP] = useState(null);
  const [criando, setCriando] = useState(false);
  useEffect(() => { fetch(`/api/km/itens?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" }).then((r) => r.json()).then(setP).catch(() => setP({ error: "Erro ao ler." })); }, [codigo]);
  const criarPadrao = async () => {
    setCriando(true);
    const parametros = Object.fromEntries((p.parametros || []).filter((x) => x && x.t && x.v).map((x) => [String(x.t).toUpperCase(), x.v]));
    const r = await fetch("/api/itens-padrao", { method: "POST", headers: { "Content-Type": "application/json", "x-usuario-id": String(user?.id || "") },
      body: JSON.stringify({ nomeInterno: p.nome, nomeNf: p.nome, codigo: p.codigo, parametros, ncm: p.ncm, gtin: p.gtin, precoAtual: p.preco != null ? Number(p.preco).toFixed(2) : "" }) });
    const j = await r.json().catch(() => ({}));
    setCriando(false);
    if (!r.ok) return alerta(j.error || "Erro ao abrir a edição.");
    onEditar?.(j.id);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onMouseDown={onClose}>
      <div className="rounded-xl w-full max-w-3xl p-5 overflow-y-auto" style={{ background: "#F5F6F8", maxHeight: "90vh" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0"><div className="text-xs" style={{ color: C.sub }}>Item do KM</div>
            <div className="text-lg font-bold" style={{ color: C.navy }}>{codigo}{p?.nome ? ` · ${p.nome}` : ""}</div></div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={20} /></button>
        </div>
        {!p && <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />}
        {p?.error && <div className="text-sm" style={{ color: C.red }}>{p.error}</div>}
        {p && !p.error && <>
          <div className="grid gap-3 text-sm rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}`, gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
            {[["NCM", fmtNcm(p.ncm)], ["GTIN/EAN", p.gtin || "—"], ["Unidade", p.unidade || "—"], ["Último preço", brl(p.preco)], ["Usado em pedidos", p.usos || 0]].map(([l, v]) => (
              <div key={l}><div className="text-xs" style={{ color: C.sub }}>{l}</div><div className="font-semibold">{v}</div></div>))}
          </div>
          <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>Parâmetros de produção ({(p.parametros || []).length})</div>
            {(p.parametros || []).length ? <div className="grid gap-x-4 gap-y-1 text-xs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {p.parametros.map((x, k) => <div key={k} className="flex gap-2 py-0.5" style={{ borderBottom: `1px dashed ${C.line}` }}><span className="shrink-0 font-semibold" style={{ color: C.sub, minWidth: 100 }}>{x.t}</span><span>{x.v}</span></div>)}
            </div> : <div className="text-xs" style={{ color: C.sub }}>Sem parâmetros no último detalhe de produção.</div>}
          </div>
          {p.detalhe && <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>Detalhe (último pedido)</div>
            <pre className="text-xs whitespace-pre-wrap" style={{ color: C.text, fontFamily: "inherit" }}>{p.detalhe}</pre>
          </div>}
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: C.sub }}>Atualizado do KM em {dh(p.kmSyncEm)} · "Editar item" abre a mesma edição dos itens padrão (com código, parâmetros, NCM e preço do KM)</span>
            <span className="flex-1" />
            <button onClick={criarPadrao} disabled={criando} className="px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff", opacity: criando ? 0.6 : 1 }}><Plus size={14} /> Editar item</button>
          </div>
        </>}
      </div>
    </div>
  );
}
