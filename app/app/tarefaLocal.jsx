"use client";
// v1043 — sugestão #101: endereço na tarefa (só endereços reconhecidos pelo Google Maps), "de onde você sai",
// tempo de deslocamento, saída sugerida (com aviso no celular na hora de sair) e botões Waze / Google Maps.
// Também a tela Dados › Endereços particulares (favoritos de cada usuário; só quem cadastrou vê).
import React, { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Star, Trash2, Pencil, Plus, X, Loader2, Car, Check } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = {
  panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", red: "#D92D20", navy: "#001E41",
};
const inp = "w-full rounded-lg px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
};
const URL_L = (user, qs = "") => `/api/tarefas/local?u=${user.id}${qs ? `&${qs}` : ""}`;
const minDe = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmm = (m) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
export const saidaDe = (hora, l) => (minDe(hora) == null || !l || l.deslocMin == null ? null : hhmm(minDe(hora) - Math.ceil(l.deslocMin) - (l.antecedenciaMin ?? 5)));
export const linkWaze = (l) => `https://waze.com/ul?ll=${l.lat},${l.lng}&navigate=yes`;
export const linkMaps = (l) => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}&travelmode=driving`;

let _favs = null;   // cache dos endereços particulares do usuário (na sessão da página)
function useFavoritos(user) {
  const [l, setL] = useState(_favs);
  const carregar = () => api(URL_L(user)).then((j) => { _favs = j.favoritos || []; setL(_favs); }).catch(() => setL([]));
  useEffect(() => { if (!_favs) carregar(); }, []);
  return [l || [], carregar];
}

// campo com sugestões do Google; só aceita o endereço escolhido na lista (onEscolher recebe { endereco, lat, lng, nome })
export function EnderecoMaps({ user, valor, onEscolher, placeholder = "Digite e escolha o endereço na lista do Google", autoFocus }) {
  const [q, setQ] = useState(valor || "");
  const [sug, setSug] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sessao = useRef(null), t = useRef(null), digitou = useRef(false);
  useEffect(() => { setQ(valor || ""); }, [valor]);
  useEffect(() => {
    if (!digitou.current) return;
    clearTimeout(t.current);
    const s = q.trim();
    if (s.length < 4) { setSug([]); return; }
    t.current = setTimeout(() => {
      if (!sessao.current) sessao.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
      fetch(URL_L(user, `auto=${encodeURIComponent(s)}&sessao=${sessao.current}`)).then((r) => r.json()).then((l) => {
        if (!digitou.current) return;
        if (Array.isArray(l)) { setErr(""); setSug(l); } else setErr(l?.error || "Google não respondeu.");
      }).catch((e) => setErr(e.message));
    }, 350);
    return () => clearTimeout(t.current);
  }, [q]);
  const escolher = async (x) => {
    digitou.current = false; setSug([]); setBusy(true);
    try {
      const g = await api(URL_L(user, `lugar=${encodeURIComponent(x.placeId)}&sessao=${sessao.current || ""}&digitado=${encodeURIComponent(q)}`));
      sessao.current = null;
      if (g?.lat == null) throw new Error("O Google não devolveu a localização desse endereço.");
      setQ(g.endereco);
      onEscolher({ endereco: g.endereco, lat: g.lat, lng: g.lng, nome: x.principal && !/^\d/.test(x.principal) && !g.endereco.startsWith(x.principal) ? x.principal : null });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const pendente = digitou.current && q.trim() && q !== valor;
  return (
    <div className="relative">
      <div className="relative">
        <MapPin size={15} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: C.sub }} />
        <input autoFocus={autoFocus} value={q} onChange={(e) => { digitou.current = true; setQ(e.target.value); }} onBlur={() => setTimeout(() => setSug([]), 200)}
          placeholder={placeholder} className={inp} style={{ ...inpS, paddingLeft: 28, minHeight: 40, borderColor: pendente ? C.accent : C.line }} />
        {busy && <Loader2 size={14} className="animate-spin absolute right-2 top-1/2 -translate-y-1/2" style={{ color: C.sub }} />}
      </div>
      {sug.length > 0 && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-lg shadow-lg max-h-72 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {sug.map((x) => (
            <button key={x.placeId} type="button" onMouseDown={(e) => { e.preventDefault(); escolher(x); }} className="flex items-start gap-2 w-full text-left px-3 py-2.5 hover:bg-gray-50">
              <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: C.sub }} />
              <span className="min-w-0"><span className="block text-sm truncate" style={{ color: C.text }}>{x.principal || x.texto}</span><span className="block text-[11px] truncate" style={{ color: C.sub }}>{x.secundario}</span></span>
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-right" style={{ color: "#9AA3B2" }}>Google</div>
        </div>
      )}
      {pendente && !sug.length && !err && <div className="text-[11px] mt-1" style={{ color: C.accent }}>Escolha o endereço na lista do Google — endereço digitado à mão não vale.</div>}
      {err && <div className="text-[11px] mt-1" style={{ color: C.red }}>Google: {err}</div>}
    </div>
  );
}

// botões grandes (bons de tocar no celular): abrem o app com o destino já em rota
export function BotoesNavegar({ local, compacto }) {
  if (!local?.lat) return null;
  const cls = compacto ? "px-2.5 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <div className="flex gap-2">
      <a href={linkWaze(local)} target="_blank" rel="noreferrer" className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg font-bold ${cls}`} style={{ background: "#33CCFF", color: "#fff", minHeight: compacto ? 32 : 44 }}><Navigation size={compacto ? 13 : 16} /> Waze</a>
      <a href={linkMaps(local)} target="_blank" rel="noreferrer" className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg font-bold ${cls}`} style={{ background: "#1A73E8", color: "#fff", minHeight: compacto ? 32 : 44 }}><MapPin size={compacto ? 13 : 16} /> Google Maps</a>
    </div>
  );
}

// bloco do formulário da tarefa. local = null | { endereco, lat, lng, nome?, origem?, deslocMin?, km?, antecedenciaMin, aceito }
export function LocalTarefa({ user, local, hora, prazo, onChange }) {
  const [aberto, setAberto] = useState(!!local);
  const [favs, recarregar] = useFavoritos(user);
  const [outra, setOutra] = useState(false);
  const [salvarComo, setSalvarComo] = useState("");
  const [calc, setCalc] = useState(false);
  const [errT, setErrT] = useState("");
  const l = local || null;
  const lref = useRef(l); lref.current = l;   // valor mais novo (o cálculo do trajeto volta depois)
  const set = (patch) => onChange(l ? { ...l, ...patch } : null);
  // tempo de deslocamento: recalcula quando muda origem, destino, dia ou horário (trânsito previsto na hora de sair)
  const chave = l?.origem && l?.lat ? `${l.origem.lat},${l.origem.lng}|${l.lat},${l.lng}|${prazo}|${hora}` : "";
  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    const tm = setTimeout(async () => {
      setCalc(true); setErrT("");
      try {
        const ini = minDe(hora);
        const quando = ini != null && prazo ? new Date(new Date(`${prazo}T${hora}:00-03:00`).getTime() - ((l.deslocMin || 30) + (l.antecedenciaMin ?? 5)) * 60e3).toISOString() : null;
        const r = await api("/api/tarefas/local", "POST", { usuarioId: user.id, acao: "tempo", de: l.origem, para: l, quando });
        if (vivo && lref.current) onChange({ ...lref.current, deslocMin: r.min, km: r.km });
      } catch (e) { if (vivo) { setErrT(e.message); if (lref.current) onChange({ ...lref.current, deslocMin: null, km: null, aceito: false }); } }
      if (vivo) setCalc(false);
    }, 400);
    return () => { vivo = false; clearTimeout(tm); };
  }, [chave]);

  if (!aberto) return (
    <button type="button" onClick={() => setAberto(true)} className="flex items-center gap-1.5 mb-3 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: C.panel2, color: C.navy }}><MapPin size={14} /> Adicionar endereço</button>
  );
  const saida = saidaDe(hora, l);
  const escolherOrigem = async (o, fav) => {
    setOutra(false);
    set({ origem: { ...o, ...(fav ? { nome: fav.nome, favoritoId: fav.id } : {}) }, deslocMin: null, km: null });
    if (!fav && salvarComo.trim()) {
      try { await api("/api/tarefas/local", "POST", { usuarioId: user.id, acao: "salvar", endereco: { ...o, nome: salvarComo } }); setSalvarComo(""); recarregar(); }
      catch (e) { alerta(e.message); }
    }
  };
  return (
    <div className="rounded-lg p-3 mb-3" style={{ background: C.panel2, border: l ? `1px solid ${C.blue}` : "1px solid transparent" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.text }}><MapPin size={14} style={{ color: C.blue }} /> Endereço da tarefa</span>
        <button type="button" onClick={() => { onChange(null); setAberto(false); }} className="text-[11px] flex items-center gap-0.5" style={{ color: C.sub }}><X size={12} /> tirar</button>
      </div>
      <EnderecoMaps user={user} valor={l?.endereco || ""} onEscolher={(g) => onChange({ antecedenciaMin: 5, ...(l || {}), ...g, nome: g.nome || null, complemento: null, deslocMin: null, km: null })} />
      {l?.nome && <div className="text-[11px] mt-1" style={{ color: C.sub }}>{l.nome}</div>}
      {l && <input value={l.complemento || ""} onChange={(e) => set({ complemento: e.target.value.slice(0, 80) })} placeholder="Complemento (sala, apto, bloco…) — opcional" className={`${inp} mt-1.5`} style={{ ...inpS, minHeight: 40 }} />}
      {l && <>
        <div className="mt-2"><BotoesNavegar local={l} compacto /></div>
        {!hora
          ? <div className="text-[11px] mt-2" style={{ color: C.sub }}>Coloque o horário da tarefa para calcular a hora de sair.</div>
          : <>
            <div className="text-xs mt-3 mb-1 font-semibold" style={{ color: C.text }}>De onde você vai sair?</div>
            <div className="flex flex-wrap gap-1.5">
              {favs.map((f) => { const on = l.origem?.favoritoId === f.id; return (
                <button key={f.id} type="button" onClick={() => escolherOrigem({ endereco: f.endereco, complemento: f.complemento || null, lat: f.lat, lng: f.lng }, f)} className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1" style={on ? { background: C.navy, color: "#fff" } : { background: "#fff", color: C.text, border: `1px solid ${C.line}` }}>
                  <Star size={12} /> {f.nome}</button>); })}
              <button type="button" onClick={() => setOutra(true)} className="px-3 py-2 rounded-lg text-xs font-semibold" style={l.origem && !l.origem.favoritoId ? { background: C.navy, color: "#fff" } : { background: "#fff", color: C.accent, border: `1px solid ${C.accent}` }}>
                {l.origem && !l.origem.favoritoId ? "Outro endereço ✓" : "Outro endereço"}</button>
            </div>
            {l.origem && !l.origem.favoritoId && !outra && <div className="text-[11px] mt-1" style={{ color: C.sub }}>Saindo de {l.origem.endereco}</div>}
            {!favs.length && <div className="text-[11px] mt-1" style={{ color: C.sub }}>Dica: cadastre CASA, FÁBRICA… em Dados › Endereços particulares (ou salve aqui ao escolher outro endereço).</div>}
            {outra && <div className="mt-2 rounded-lg p-2" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <input value={salvarComo} onChange={(e) => setSalvarComo(e.target.value)} placeholder="Salvar nos meus endereços como… (opcional, ex.: CASA)" className={`${inp} mb-1.5`} style={inpS} />
              <EnderecoMaps user={user} valor="" autoFocus placeholder="Endereço de saída" onEscolher={(g) => escolherOrigem(g, null)} />
            </div>}
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <label className="text-xs" style={{ color: C.sub }}>Chegar antes (min)
                <input value={l.antecedenciaMin ?? 5} onChange={(e) => set({ antecedenciaMin: Math.min(600, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)) })} inputMode="numeric" className={`${inp} mt-1`} style={{ ...inpS, width: 90, minHeight: 40 }} />
              </label>
              {calc && <span className="text-xs flex items-center gap-1 pb-2" style={{ color: C.sub }}><Loader2 size={13} className="animate-spin" /> calculando o trajeto…</span>}
              {!calc && l.deslocMin != null && <span className="text-xs pb-2" style={{ color: C.text }}><Car size={13} className="inline -mt-0.5" /> {l.deslocMin} min{l.km != null ? ` · ${String(l.km).replace(".", ",")} km` : ""} · <b>sair às {saida}</b></span>}
            </div>
            {errT && <div className="text-[11px] mt-1" style={{ color: C.red }}>{errT}</div>}
            {l.deslocMin != null && saida && (l.aceito
              ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: C.greenSoft, color: C.green }}>
                <Check size={14} /> <b>Saída às {saida}</b> — aviso no celular na hora de sair.
                <button type="button" onClick={() => set({ aceito: false })} className="underline ml-auto" style={{ color: C.sub }}>desfazer</button></div>
              : <button type="button" onClick={() => set({ aceito: true })} className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold" style={{ background: C.accent, color: "#fff", minHeight: 44 }}>
                <Check size={15} /> Aceitar saída às {saida} (aviso no celular)</button>)}
          </>}
      </>}
    </div>
  );
}

// detalhe da tarefa: endereço + saída + botões
export function LocalDetalhe({ t }) {
  const l = t?.local;
  if (!l?.lat) return null;
  const saida = l.aceito ? saidaDe(t.hora, l) : null;
  return (
    <div className="rounded-lg p-3 mb-3" style={{ background: C.blueSoft }}>
      <div className="flex items-start gap-1.5 text-sm mb-2" style={{ color: C.text }}><MapPin size={15} className="mt-0.5 shrink-0" style={{ color: C.blue }} />
        <span className="min-w-0">{l.nome && <b className="block">{l.nome}</b>}<span>{l.endereco}</span>{l.complemento && <span className="block font-semibold">{l.complemento}</span>}
          {l.deslocMin != null && <span className="block text-xs mt-0.5" style={{ color: C.sub }}>{l.origem?.nome ? `De ${l.origem.nome}: ` : l.origem ? "Da origem: " : ""}{l.deslocMin} min{l.km != null ? ` · ${String(l.km).replace(".", ",")} km` : ""}{saida ? ` · sair às ${saida}` : ""} · chegar {l.antecedenciaMin ?? 5} min antes</span>}
        </span></div>
      <BotoesNavegar local={l} />
    </div>
  );
}

// Dados › Endereços particulares
export default function EnderecosParticulares({ user }) {
  const [l, setL] = useState(null);
  const [ed, setEd] = useState(null);   // { id?, nome, endereco, lat, lng }
  const [st, setSt] = useState(false);
  const carregar = () => api(URL_L(user)).then((j) => { _favs = j.favoritos || []; setL(_favs); }).catch((e) => { alerta(e.message); setL([]); });
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    setSt(true);
    try { await api("/api/tarefas/local", "POST", { usuarioId: user.id, acao: "salvar", endereco: ed }); setEd(null); carregar(); } catch (e) { alerta(e.message); }
    setSt(false);
  };
  const excluir = async (x) => {
    if (!(await confirmar(`Excluir o endereço ${x.nome}?`))) return;
    try { await api("/api/tarefas/local", "POST", { usuarioId: user.id, acao: "excluir", id: x.id }); carregar(); } catch (e) { alerta(e.message); }
  };
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Endereços particulares</h2>
        <button onClick={() => setEd({ nome: "", endereco: "", lat: null, lng: null })} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Novo</button>
      </div>
      <p className="text-sm mb-4" style={{ color: C.sub }}>Seus pontos de saída (casa, fábrica…), usados nas tarefas com endereço para calcular a hora de sair. Só você vê.</p>
      {ed && <div className="rounded-lg p-3 mb-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <label className="block text-xs mb-2" style={{ color: C.sub }}>Nome<input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="CASA" className={`${inp} mt-1`} style={{ ...inpS, minHeight: 40 }} autoFocus /></label>
        <div className="text-xs mb-1" style={{ color: C.sub }}>Endereço</div>
        <EnderecoMaps user={user} valor={ed.endereco} onEscolher={(g) => setEd((x) => ({ ...x, endereco: g.endereco, lat: g.lat, lng: g.lng }))} />
        <input value={ed.complemento || ""} onChange={(e) => setEd({ ...ed, complemento: e.target.value.slice(0, 80) })} placeholder="Complemento (sala, apto, bloco…) — opcional" className={`${inp} mt-2`} style={{ ...inpS, minHeight: 40 }} />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => setEd(null)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
          <button onClick={salvar} disabled={st || !ed.lat || !ed.nome.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.navy, color: "#fff" }}>{st ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>}
      {!l ? <Loader2 className="animate-spin" size={18} style={{ color: C.sub }} />
        : !l.length ? <div className="text-sm" style={{ color: C.sub }}>Nenhum endereço cadastrado.</div>
        : <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
          {l.map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <Star size={15} style={{ color: C.accent }} />
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold" style={{ color: C.text }}>{x.nome}</div><div className="text-xs truncate" style={{ color: C.sub }}>{x.endereco}{x.complemento ? ` · ${x.complemento}` : ""}</div></div>
              <button onClick={() => setEd({ id: x.id, nome: x.nome, endereco: x.endereco, complemento: x.complemento || "", lat: x.lat, lng: x.lng })} className="p-2" style={{ color: C.sub }} title="Editar"><Pencil size={15} /></button>
              <button onClick={() => excluir(x)} className="p-2" style={{ color: C.red }} title="Excluir"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>}
    </div>
  );
}
