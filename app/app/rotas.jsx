"use client";
// v425 — Logística › Rotas: calendário de demandas de rota, mapa do dia, montagem da rota com a melhor sequência, despacho e execução pelo motorista
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, MapPin, Truck, Bike, Car, Settings, Route as IcoRota, Send, CheckCircle2, Circle, ArrowUp, ArrowDown, AlertTriangle, Flag, Package, ShoppingBag, ExternalLink, Undo2, Home } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const somaDia = (s, n) => { const d = dUTC(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const inicioSemana = (s) => { const d = dUTC(s); const w = (d.getUTCDay() + 6) % 7; return somaDia(s, -w); };
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "—");
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const sc = (t) => { const s0 = String(t || "").toLocaleLowerCase("pt-BR"); return s0.charAt(0).toLocaleUpperCase("pt-BR") + s0.slice(1); };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};
const OBJ = { COLETA: ["Coleta", Package], ENTREGA: ["Entrega", Truck], COMPRA: ["Compra", ShoppingBag] };
const ST = { ABERTA: ["aberta", C.sub], NO_BLOCO: ["na rota", C.yellow], EM_EXECUCAO: ["em execução", C.accent], CONCLUIDA: ["concluída", C.green] };
const corDemanda = (d) => (d.status === "CONCLUIDA" ? { bg: C.greenSoft, bd: C.green, tx: C.text } : d.urgente ? { bg: C.redSoft, bd: C.red, tx: C.red } : d.frete ? { bg: C.blueSoft, bd: C.blue, tx: C.blue } : { bg: C.panel, bd: C.line, tx: C.text });
const ordenar = (l) => [...l].sort((a, b) => (b.urgente - a.urgente) || ((a.ordem ?? 99) - (b.ordem ?? 99)) || (a.janela?.[0] || "").localeCompare(b.janela?.[0] || "") || a.id - b.id);

export default function Rotas({ user }) {
  const H = hojeISO();
  const [modo, setModo] = useState("semana");
  const [ref, setRef] = useState(H);
  const [dia, setDia] = useState(H);
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [marc, setMarc] = useState(new Set());
  const [montar, setMontar] = useState(null);   // { ids, bloco? }
  const [cfgFab, setCfgFab] = useState(false);
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7));
  const dias = useMemo(() => {
    if (modo === "semana") { const i = inicioSemana(ref); return Array.from({ length: 7 }, (_, k) => somaDia(i, k)); }
    const p = `${ref.slice(0, 7)}-01`, i = inicioSemana(p);
    const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const n = Math.ceil((Math.round((dUTC(fim) - dUTC(i)) / 864e5) + 1) / 7) * 7;
    return Array.from({ length: n }, (_, k) => somaDia(i, k));
  }, [modo, ref]);
  const de = dias[0] < dia ? dias[0] : dia, ate = dias[dias.length - 1] > dia ? dias[dias.length - 1] : dia;
  const carregar = () => api(`/api/rotas?u=${user.id}&de=${de}&ate=${ate}`).then(setD).catch((e) => setD((x) => x || { erro: e.message, demandas: [], blocos: [], motoristas: [] }));
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [de, ate]);
  const porDia = useMemo(() => (d?.demandas || []).reduce((a, x) => { (a[x.data] ||= []).push(x); return a; }, {}), [d]);
  const doDia = ordenar(porDia[dia] || []);
  const blocosDia = (d?.blocos || []).filter((b) => b.data === dia || (b.status === "EM_EXECUCAO" && b.data < dia && dia === H));
  const mover = (n) => setRef(modo === "semana" ? somaDia(ref, 7 * n) : new Date(Date.UTC(ano, mes - 1 + n, 1)).toISOString().slice(0, 10));
  const titulo = modo === "semana" ? `${dBR(dias[0])} a ${dBR(dias[6])} · ${MESES[Number(dias[3].slice(5, 7)) - 1]} ${dias[3].slice(0, 4)}` : `${MESES[mes - 1]} de ${ano}`;
  const pode = !!d?.podeMontar;
  const minhaRota = (d?.blocos || []).find((b) => b.status === "EM_EXECUCAO" && d?.pessoaId && b.motoristaId === d.pessoaId);
  const novaNoDia = (x) => { setDia(x); setForm({ data: x }); };
  const tog = (id) => setMarc((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => { setMarc(new Set()); }, [dia]);

  return (
    <div className="space-y-4">
      {/* cabeçalho */}
      <div className="flex items-center gap-2 flex-wrap">
        <IcoRota size={22} style={{ color: C.accent }} />
        <div className="text-xl font-bold mr-2" style={{ color: C.navy }}>Rotas</div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["semana", "Semana"], ["mes", "Mês"]].map(([k, t]) => <button key={k} onClick={() => setModo(k)} className="px-3 py-1.5 text-xs font-semibold" style={{ background: modo === k ? C.navy : C.panel, color: modo === k ? "#fff" : C.sub }}>{t}</button>)}
        </div>
        <button onClick={() => mover(-1)} className="p-1.5 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><ChevronLeft size={15} /></button>
        <button onClick={() => { setRef(H); setDia(H); }} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel }}>Hoje</button>
        <button onClick={() => mover(1)} className="p-1.5 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><ChevronRight size={15} /></button>
        <div className="text-sm font-semibold" style={{ color: C.text }}>{titulo}</div>
        <div className="ml-auto flex items-center gap-2">
          {pode && <button onClick={() => setCfgFab(true)} title="Endereço da fábrica (saída e retorno das rotas)" className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.sub }}><Settings size={13} /> Fábrica</button>}
          <button onClick={() => novaNoDia(dia)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Demanda de rota</button>
        </div>
      </div>
      {d?.erro && <div className="text-sm" style={{ color: C.red }}>{d.erro}</div>}
      {pode && d && !d.fabrica && <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}><AlertTriangle size={14} /> Cadastre o endereço da fábrica (botão Fábrica): é o ponto de saída e de retorno das rotas.</div>}

      {minhaRota && <MinhaRota bloco={minhaRota} demandas={(d?.demandas || []).filter((x) => x.blocoId === minhaRota.id)} user={user} onMudou={carregar} />}

      {/* calendário */}
      {!d ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div> : modo === "semana" ? (
        <div className="flex gap-2" style={{ minHeight: 230 }}>
          {dias.map((x, i) => {
            const l = ordenar(porDia[x] || []);
            const grande = x === H;
            const sel = x === dia;
            return (
              <div key={x} onClick={() => novaNoDia(x)} className="rounded-xl p-2 cursor-pointer flex flex-col min-w-0 transition-all"
                style={{ flex: grande ? 2.2 : 1, background: grande ? "#FFF8F3" : C.panel, border: `${sel ? 2 : 1}px solid ${sel ? C.accent : C.line}` }} title="Clique para criar uma demanda neste dia">
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: grande ? C.accent : C.sub }}>{DIAS[i]}</span>
                  <span className={grande ? "text-xl font-bold" : "text-sm font-bold"} style={{ color: grande ? C.accent : C.text }}>{x.slice(8, 10)}</span>
                  {grande && <span className="text-[11px] font-semibold" style={{ color: C.accent }}>hoje</span>}
                  {l.length > 0 && <span className="ml-auto text-[11px]" style={{ color: C.sub }}>{l.length}</span>}
                </div>
                <div className="space-y-1 flex-1">
                  {l.slice(0, grande ? 12 : 6).map((y) => <MiniDemanda key={y.id} x={y} grande={grande} onClick={(e) => { e.stopPropagation(); setDia(x); setForm(y); }} />)}
                  {l.length > (grande ? 12 : 6) && <div className="text-[11px]" style={{ color: C.sub }}>+{l.length - (grande ? 12 : 6)}</div>}
                  {!l.length && <div className="text-[11px] mt-2 text-center" style={{ color: "#B0B7C3" }}><Plus size={12} className="inline" /> nova demanda</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
          {DIAS.map((x) => <div key={x} className="text-[11px] font-semibold px-1" style={{ color: C.sub }}>{x}</div>)}
          {dias.map((x) => {
            const l = ordenar(porDia[x] || []);
            const fora = x.slice(5, 7) !== ref.slice(5, 7);
            return (
              <div key={x} onClick={() => novaNoDia(x)} className="rounded-lg p-1.5 cursor-pointer min-w-0" style={{ minHeight: 86, background: x === H ? "#FFF8F3" : C.panel, border: `${x === dia ? 2 : 1}px solid ${x === dia ? C.accent : C.line}`, opacity: fora ? 0.5 : 1 }}>
                <div className="text-xs font-bold mb-1" style={{ color: x === H ? C.accent : C.text }}>{x.slice(8, 10)}</div>
                {l.slice(0, 3).map((y) => <MiniDemanda key={y.id} x={y} onClick={(e) => { e.stopPropagation(); setDia(x); setForm(y); }} />)}
                {l.length > 3 && <div className="text-[10px]" style={{ color: C.sub }}>+{l.length - 3}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* mapa e demandas do dia */}
      {d && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(320px,1fr)" }}>
          <MapasDia demandas={doDia} fabrica={d.fabrica} dia={dia} />
          <div className="space-y-3 min-w-0">
            <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div className="text-sm font-bold flex-1" style={{ color: C.navy }}>{dia === H ? "Hoje" : dBR(dia)} · {doDia.length} demanda(s)</div>
                {pode && marc.size > 0 && <button onClick={() => setMontar({ ids: [...marc] })} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: C.navy, color: "#fff" }}><IcoRota size={13} /> Montar rota ({marc.size})</button>}
              </div>
              {!doDia.length && <div className="px-4 py-6 text-center text-xs" style={{ color: C.sub }}>Nenhuma demanda. Clique no dia do calendário para criar.</div>}
              {doDia.map((x) => {
                const livre = x.status === "ABERTA" && !x.frete;
                const [stT, stC] = ST[x.status] || ST.ABERTA;
                const Ico = OBJ[x.objetivo]?.[1] || MapPin;
                const c = corDemanda(x);
                return (
                  <div key={x.id} className="flex items-start gap-2 px-3 py-2" style={{ borderTop: `1px solid ${C.line}`, background: x.urgente && x.status !== "CONCLUIDA" ? C.redSoft : x.frete ? C.blueSoft : undefined }}>
                    {pode ? <input type="checkbox" disabled={!livre} checked={marc.has(x.id)} onChange={() => tog(x.id)} className="mt-1" title={livre ? "Selecionar para montar a rota" : x.frete ? "Frete: contratado à parte" : "Já está numa rota"} /> : <span className="w-3" />}
                    <button onClick={() => setForm(x)} className="flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-1" style={{ color: c.tx }}><Ico size={13} /> {OBJ[x.objetivo]?.[0]} · {sc(x.destinoNome)}{x.urgente && <span className="text-[10px] font-bold ml-1">URGENTE</span>}</div>
                      <div className="text-[11px] truncate" style={{ color: C.sub }} title={x.endereco}>{x.endereco}</div>
                      <div className="text-[11px]" style={{ color: C.sub }}>
                        {sc(x.horario)}
                        {x.frete ? ` · frete ${x.freteTipo === "FRETEBRAS" ? `Fretebras (até R$ ${Number(x.freteValorMax || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${x.freteVolumes} vol.)` : `transportadora${x.cotacao ? (x.cotacao.status === "CONCLUIDA" ? ` · cotado R$ ${Number(x.cotacao.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${x.cotacao.prazo}` : " · aguardando cotação") : ""}`}` : x.motoristaNome ? ` · ${sc(x.motoristaNome)}${x.veiculo ? ` (${x.veiculo === "MOTO" ? "moto" : "carro"})` : ""}` : ""}
                        {x.lat == null && <span style={{ color: C.yellow }}> · fora do mapa</span>}
                      </div>
                    </button>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ color: stC, background: C.panel2 }}>{stT}{x.ordem ? ` · ${x.ordem}ª` : ""}</span>
                  </div>
                );
              })}
            </div>
            {blocosDia.map((b) => <BlocoCard key={b.id} b={b} demandas={(d.demandas || []).filter((x) => x.blocoId === b.id)} pode={pode} meu={d.pessoaId && b.motoristaId === d.pessoaId} user={user} onMudou={carregar} onEditar={() => setMontar({ ids: (d.demandas || []).filter((x) => x.blocoId === b.id).sort((a, z) => a.ordem - z.ordem).map((x) => x.id), bloco: b })} />)}
            <Motoristas l={d.motoristas || []} />
          </div>
        </div>
      )}

      {form && <DemandaForm user={user} inicial={form} motoristas={d?.motoristas || []} onClose={() => setForm(null)} onOk={() => { setForm(null); carregar(); }} />}
      {montar && <MontarRota user={user} ids={montar.ids} bloco={montar.bloco} demandas={d?.demandas || []} motoristas={d?.motoristas || []} dia={dia} onClose={() => setMontar(null)} onOk={() => { setMontar(null); setMarc(new Set()); carregar(); }} />}
      {cfgFab && <FabricaModal user={user} atual={d?.fabrica} onClose={() => setCfgFab(false)} onOk={() => { setCfgFab(false); carregar(); }} />}
    </div>
  );
}

function MiniDemanda({ x, grande, onClick }) {
  const c = corDemanda(x);
  const Ico = OBJ[x.objetivo]?.[1] || MapPin;
  return (
    <button onClick={onClick} className="w-full text-left rounded-md px-1.5 py-1 block min-w-0" style={{ background: c.bg, border: `1px solid ${c.bd}`, opacity: x.status === "CONCLUIDA" ? 0.7 : 1 }}>
      <div className="flex items-center gap-1 text-[11px] font-semibold min-w-0" style={{ color: c.tx }}>
        {x.status === "CONCLUIDA" ? <CheckCircle2 size={11} className="shrink-0" style={{ color: C.green }} /> : <Ico size={11} className="shrink-0" />}
        <span className="truncate" style={{ textDecoration: x.status === "CONCLUIDA" ? "line-through" : "none" }}>{sc(x.destinoNome)}</span>
      </div>
      {grande && <div className="text-[10px] truncate" style={{ color: C.sub }}>{OBJ[x.objetivo]?.[0]} · {x.horario}{x.motoristaNome ? ` · ${sc(x.motoristaNome.split(" ")[0])}` : ""}</div>}
    </button>
  );
}

// ---------- mapas (Leaflet carregado sob demanda) ----------
let _leaflet = null;
function carregarLeaflet() {
  if (_leaflet) return _leaflet;
  _leaflet = new Promise((ok, nok) => {
    if (window.L) return ok(window.L);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = () => ok(window.L); s.onerror = nok; document.head.appendChild(s);
  });
  return _leaflet;
}
const LIMITES = { RMBH: [[-20.4, -44.45], [-19.5, -43.6]], MG: [[-22.95, -51.05], [-14.2, -39.85]], BR: [[-33.8, -73.9], [5.3, -34.8]] };
const TITULO_MAPA = { RMBH: "Região metropolitana de BH", MG: "Minas Gerais", BR: "Brasil" };
function Mapa({ area, pontos, fabrica, altura = 360 }) {
  const ref = useRef(null), mapa = useRef(null), camada = useRef(null);
  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !ref.current) return;
      if (!mapa.current) {
        mapa.current = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap © CARTO", subdomains: "abcd", maxZoom: 19 }).addTo(mapa.current);
        camada.current = L.layerGroup().addTo(mapa.current);
      }
      const m = mapa.current; camada.current.clearLayers();
      const pts = [];
      if (fabrica?.lat != null && area === "RMBH") {
        L.marker([fabrica.lat, fabrica.lng], { icon: L.divIcon({ className: "", html: `<div style="background:#001E41;color:#fff;border-radius:6px;padding:2px 6px;font:600 11px Montserrat,sans-serif;white-space:nowrap;box-shadow:0 1px 3px #0005">Fábrica</div>`, iconAnchor: [24, 10] }) }).addTo(camada.current);
        pts.push([fabrica.lat, fabrica.lng]);
      }
      for (const p of pontos) {
        const cor = p.cor || "#FF6B1A";
        L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
          html: `<div style="width:26px;height:26px;border-radius:13px;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px #0006;color:#fff;font:700 11px Montserrat,sans-serif;display:flex;align-items:center;justify-content:center">${p.num ?? ""}</div>` }) })
          .bindTooltip(p.rotulo, { direction: "top", offset: [0, -12] }).addTo(camada.current);
        pts.push([p.lat, p.lng]);
      }
      m.fitBounds(LIMITES[area], { padding: [8, 8] });
      if (pts.length && area !== "BR") { const b = L.latLngBounds(pts); if (pts.length > 1) m.fitBounds(b.pad(0.25), { maxZoom: 13 }); }
      setTimeout(() => m.invalidateSize(), 50);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [area, JSON.stringify(pontos), fabrica?.lat]);
  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);
  return <div ref={ref} className="rounded-lg overflow-hidden" style={{ height: altura, background: "#E9EDF3", zIndex: 0 }} />;
}
function MapasDia({ demandas, fabrica }) {
  const ponto = (x, i) => ({ lat: x.lat, lng: x.lng, num: x.ordem || "", rotulo: `${OBJ[x.objetivo]?.[0]} · ${x.destinoNome} · ${x.horario}`, cor: x.status === "CONCLUIDA" ? C.green : x.urgente ? C.red : x.frete ? C.blue : C.accent });
  const com = demandas.filter((x) => x.lat != null);
  const rmbh = com.filter((x) => x.regiao === "RMBH" || !x.regiao).map(ponto);
  const mg = com.filter((x) => x.regiao === "MG").map(ponto);
  const br = com.filter((x) => x.regiao === "BR").map(ponto);
  const lateral = br.length ? "BR" : mg.length ? "MG" : null;
  return (
    <div className="rounded-xl p-3 grid gap-3" style={{ background: C.panel, border: `1px solid ${C.line}`, gridTemplateColumns: lateral ? "minmax(0,1.6fr) minmax(0,1fr)" : "1fr" }}>
      <div className="min-w-0">
        <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>{TITULO_MAPA.RMBH} · {rmbh.length} ponto(s)</div>
        <Mapa area="RMBH" pontos={rmbh} fabrica={fabrica} altura={lateral ? 380 : 420} />
      </div>
      {lateral && (
        <div className="min-w-0">
          <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>Fora da RMBH · {TITULO_MAPA[lateral]} · {lateral === "BR" ? br.length + mg.length : mg.length} ponto(s)</div>
          <Mapa area={lateral} pontos={lateral === "BR" ? [...br, ...mg] : mg} altura={380} />
        </div>
      )}
    </div>
  );
}

// ---------- demanda de rota ----------
const inp = "w-full px-2.5 py-1.5 rounded-md text-sm";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
function L({ t, children, span }) { return <label className={`block min-w-0 ${span ? "col-span-2" : ""}`}><div className="text-xs mb-1" style={{ color: C.sub }}>{t}</div>{children}</label>; }
function Seg({ v, opts, on }) {
  return (
    <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
      {opts.map(([k, t]) => <button key={k} type="button" onClick={() => on(k)} className="flex-1 px-2 py-1.5 text-xs font-semibold" style={{ background: v === k ? C.accent : "#fff", color: v === k ? "#fff" : C.sub }}>{t}</button>)}
    </div>
  );
}
let _destinos = null;
function DemandaForm({ user, inicial, motoristas, onClose, onOk }) {
  const novo = !inicial.id;
  const trava = ["EM_EXECUCAO", "CONCLUIDA"].includes(inicial.status);
  const [f, setF] = useState({ objetivo: "ENTREGA", destinoTipo: "", destinoId: null, destinoNome: "", endereco: "", contato: "", telefone: "", horarioTipo: "MANHA", hora1: "", hora2: "",
    motoristaId: "", motoristaNome: "", veiculo: "CARRO", urgente: false, frete: false, freteTipo: "", obs: "", ...inicial,
    freteValorMax: inicial.freteValorMax != null ? String(inicial.freteValorMax).replace(".", ",") : "", freteVolumes: inicial.freteVolumes ?? "" });
  const [lista, setLista] = useState(_destinos || []);
  const [q, setQ] = useState(inicial.destinoNome || "");
  const [aberto, setAberto] = useState(false);
  const [salv, setSalv] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => { if (!_destinos) api(`/api/rotas?u=${user.id}&destinos=1`).then((l) => { _destinos = l; setLista(l); }).catch(() => {}); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const sug = useMemo(() => { const t = sem(q).trim(); return t.length < 2 ? [] : lista.filter((x) => sem(`${x.nome} ${x.endereco}`).includes(t)).slice(0, 12); }, [q, lista]);
  const escolher = (x) => { setQ(x.nome); setAberto(false); setF((s0) => ({ ...s0, destinoTipo: x.tipo, destinoId: x.id, destinoNome: x.nome, endereco: x.endereco || s0.endereco, contato: x.contato || "", telefone: x.telefone || "" })); };
  async function salvar() {
    setSalv(true); setErro("");
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "demanda", demanda: { ...f, destinoNome: f.destinoNome || q } });
      if (r.semMapa) await alerta("Demanda salva, mas o endereço não foi encontrado no mapa. Confira rua, número, cidade e UF para ela aparecer no mapa e entrar no cálculo da rota.");
      onOk();
    } catch (e) { setErro(e.message); setSalv(false); }
  }
  async function cancelar() {
    if (!(await confirmar(`Cancelar a demanda de ${inicial.destinoNome}?`))) return;
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "cancelar", id: inicial.id }); onOk(); } catch (e) { setErro(e.message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl" style={{ background: C.panel, borderTop: `4px solid ${f.urgente ? C.red : f.frete ? C.blue : C.accent}` }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>{novo ? "Nova demanda de rota" : `Demanda de rota #${inicial.id}`}</div>
          {!novo && inicial.status && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: (ST[inicial.status] || ST.ABERTA)[1] }}>{(ST[inicial.status] || ST.ABERTA)[0]}</span>}
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <fieldset disabled={trava} className="p-5 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <L t="Objetivo" span><Seg v={f.objetivo} opts={[["COLETA", "Coleta"], ["ENTREGA", "Entrega"], ["COMPRA", "Compra"]]} on={(v) => set("objetivo", v)} /></L>
          <div className="col-span-2 relative">
            <div className="text-xs mb-1" style={{ color: C.sub }}>Destinatário <span style={{ color: "#9AA3B2" }}>· terceirizados, fornecedores e clientes cadastrados</span></div>
            <input value={q} onChange={(e) => { setQ(e.target.value); set("destinoNome", e.target.value.toUpperCase()); set("destinoId", null); set("destinoTipo", "OUTRO"); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
              placeholder="Digite o nome…" className={inp} style={inpS} />
            {aberto && sug.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-md shadow-lg max-h-64 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                {sug.map((x) => (
                  <button key={`${x.tipo}${x.id}`} type="button" onMouseDown={(e) => { e.preventDefault(); escolher(x); }} className="block w-full text-left px-3 py-1.5 hover:bg-gray-50">
                    <div className="text-sm" style={{ color: C.text }}>{sc(x.nome)} <span className="text-[10px] px-1.5 rounded" style={{ background: C.panel2, color: C.sub }}>{sc(x.tipo)}</span></div>
                    <div className="text-[11px] truncate" style={{ color: x.endereco ? C.sub : C.yellow }}>{x.endereco || "sem endereço no cadastro"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <L t="Endereço" span><input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro, cidade - UF" className={inp} style={inpS} /></L>
          <L t="Contato"><input value={f.contato || ""} onChange={(e) => set("contato", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Telefone"><input value={f.telefone || ""} onChange={(e) => set("telefone", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Horário">
            <select value={f.horarioTipo} onChange={(e) => set("horarioTipo", e.target.value)} className={inp} style={inpS}>
              <option value="FIXO">Horário fixo</option><option value="MANHA">Manhã</option><option value="TARDE">Tarde</option>
              <option value="ATE">Até as…</option><option value="APOS">Após as…</option><option value="ENTRE">De … até …</option><option value="LIVRE">Qualquer horário</option>
            </select>
          </L>
          {["FIXO", "ATE", "APOS", "ENTRE"].includes(f.horarioTipo) && <L t={f.horarioTipo === "ENTRE" ? "De" : f.horarioTipo === "FIXO" ? "Às" : f.horarioTipo === "ATE" ? "Até as" : "Após as"}><input type="time" value={f.hora1 || ""} onChange={(e) => set("hora1", e.target.value)} className={inp} style={inpS} /></L>}
          {f.horarioTipo === "ENTRE" && <L t="Até"><input type="time" value={f.hora2 || ""} onChange={(e) => set("hora2", e.target.value)} className={inp} style={inpS} /></L>}
          {["FIXO", "ATE", "APOS"].includes(f.horarioTipo) && <div />}

          <div className="col-span-2 flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: f.urgente ? C.red : C.sub }}><input type="checkbox" checked={!!f.urgente} onChange={(e) => set("urgente", e.target.checked)} /> Urgente</label>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: f.frete ? C.blue : C.sub }}><input type="checkbox" checked={!!f.frete} onChange={(e) => set("frete", e.target.checked)} /> Frete (contratado à parte)</label>
          </div>
          {f.frete ? (
            <>
              <L t="Tipo de frete" span><Seg v={f.freteTipo} opts={[["TRANSPORTADORA", "Transportadora"], ["FRETEBRAS", "Fretebras"]]} on={(v) => set("freteTipo", v)} /></L>
              {f.freteTipo === "FRETEBRAS" && <L t="Valor máximo a pagar (R$)"><input value={f.freteValorMax} onChange={(e) => set("freteValorMax", e.target.value)} inputMode="decimal" className={inp} style={inpS} /></L>}
              {f.freteTipo && <L t="Número de volumes"><input value={f.freteVolumes} onChange={(e) => set("freteVolumes", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inp} style={inpS} /></L>}
              {f.freteTipo === "TRANSPORTADORA" && <div className="col-span-2 text-xs px-3 py-2 rounded" style={{ background: C.blueSoft, color: C.blue }}>
                {inicial.admDemandaId ? (inicial.cotacao?.status === "CONCLUIDA" ? `Cotado: R$ ${Number(inicial.cotacao.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · prazo ${inicial.cotacao.prazo} · ${inicial.cotacao.transportadoras}` : "Cotação pedida ao administrativo (ADM › Demandas ADM).")
                  : "Ao salvar, o administrativo recebe a demanda de cotar o frete (anexo da cotação, valor, prazo e transportadoras cotadas)."}</div>}
            </>
          ) : (
            <>
              <L t="Motorista">
                <select value={f.motoristaId || ""} onChange={(e) => { const m = motoristas.find((x) => x.id === e.target.value); setF((s0) => ({ ...s0, motoristaId: e.target.value, motoristaNome: m?.nome || "" })); }} className={inp} style={inpS}>
                  <option value="">A definir</option>
                  {motoristas.map((m) => <option key={m.id} value={m.id}>{sc(m.nome)}{m.origem === "FREELANCER" ? " (freelancer)" : ""}{m.emRota ? " · em rota" : ""}</option>)}
                </select>
              </L>
              <L t="Veículo"><Seg v={f.veiculo} opts={[["CARRO", "Carro"], ["MOTO", "Moto"]]} on={(v) => set("veiculo", v)} /></L>
            </>
          )}
          <L t="Observação" span><textarea value={f.obs || ""} onChange={(e) => set("obs", e.target.value)} rows={2} className={inp} style={inpS} /></L>
          {erro && <div className="col-span-2 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        </fieldset>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {!novo && !trava && <button onClick={cancelar} className="text-xs flex items-center gap-1" style={{ color: C.red }}><X size={13} /> Cancelar demanda</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button>
          {!trava && <button onClick={salvar} disabled={salv} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{salv && <Loader2 size={14} className="animate-spin" />} Salvar</button>}
        </div>
      </div>
    </div>
  );
}

// ---------- montar a rota: melhor sequência, ajuste da ordem e despacho ----------
function MontarRota({ user, ids, bloco, demandas, motoristas, dia, onClose, onOk }) {
  const porId = Object.fromEntries(demandas.map((x) => [x.id, x]));
  const sugMot = bloco?.motoristaId || demandas.find((x) => ids.includes(x.id) && x.motoristaId)?.motoristaId || "";
  const agora = new Date(); const hoje = hojeISO() === dia;
  const saidaPadrao = bloco?.saida || (hoje ? `${String(Math.max(8, agora.getHours() + (agora.getMinutes() > 30 ? 1 : 0))).padStart(2, "0")}:${agora.getMinutes() > 30 ? "00" : "30"}` : "08:00");
  const [mot, setMot] = useState(sugMot);
  const [veic, setVeic] = useState(bloco?.veiculo || demandas.find((x) => ids.includes(x.id) && x.veiculo)?.veiculo || "CARRO");
  const [saida, setSaida] = useState(saidaPadrao);
  const [ordem, setOrdem] = useState(ids);
  const [av, setAv] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [desp, setDesp] = useState(null);   // resultado do despacho (link do WhatsApp)
  const calc = async (acao, l = ordem) => {
    setOcup(true);
    try { const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao, ids: l, saida, veiculo: veic }); setAv(r); if (acao === "otimizar") setOrdem(r.ordem); } catch (e) { alerta(e.message); }
    setOcup(false);
  };
  useEffect(() => { calc(bloco ? "avaliar" : "otimizar", ids); }, []);
  useEffect(() => { if (av) calc("avaliar"); }, [saida, veic]);
  const mexer = (i, dir) => { const l = [...ordem]; const j = i + dir; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setOrdem(l); calc("avaliar", l); };
  const eta = Object.fromEntries((av?.etas || []).map((e) => [e.id, e]));
  const m = motoristas.find((x) => x.id === mot);
  async function salvar(despachar) {
    if (!mot) return alerta("Escolha o motorista.");
    if (despachar && m?.emRota && m.emRota !== bloco?.id) return alerta(`${sc(m.nome)} ainda está em outra rota. Ele fica disponível quando registrar o retorno à fábrica.`);
    setOcup(true);
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "bloco", id: bloco?.id, ordem, motoristaId: mot, veiculo: veic, saida });
      if (despachar) {
        const x = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "despachar", id: r.bloco.id });
        setDesp(x); setOcup(false); return;
      }
      onOk();
    } catch (e) { alerta(e.message); setOcup(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={desp ? onOk : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl" style={{ background: C.panel }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <IcoRota size={18} style={{ color: C.accent }} />
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>{bloco ? `Rota ${bloco.id}` : "Montar rota"} · {dBR(dia)}</div>
          <button onClick={desp ? onOk : onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {desp ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.green }}><CheckCircle2 size={18} /> Rota {desp.bloco.id} despachada · em execução</div>
            {desp.whatsapp ? (
              <a href={desp.whatsapp} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold" style={{ background: "#25D366", color: "#fff" }}><Send size={15} /> Enviar a rota no WhatsApp de {sc(desp.bloco.motoristaNome)}</a>
            ) : <div className="text-xs px-3 py-2 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>{sc(desp.bloco.motoristaNome)} não tem telefone cadastrado (ficha do RH ou cadastro do freelancer). Copie a mensagem abaixo.</div>}
            {(desp.bloco.links || []).map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm" style={{ color: C.blue }}><ExternalLink size={13} /> Abrir no Google Maps{desp.bloco.links.length > 1 ? ` (parte ${i + 1})` : ""}</a>)}
            <textarea readOnly value={desp.texto} rows={8} className="w-full px-2 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.sub }} />
            <div className="flex justify-end"><button onClick={onOk} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Concluir</button></div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 110px" }}>
              <label className="block"><div className="text-xs mb-1" style={{ color: C.sub }}>Motorista</div>
                <select value={mot} onChange={(e) => setMot(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>
                  <option value="">Escolha…</option>
                  {motoristas.map((x) => <option key={x.id} value={x.id}>{sc(x.nome)}{x.emRota && x.emRota !== bloco?.id ? " · em rota" : " · disponível"}</option>)}
                </select></label>
              <label className="block"><div className="text-xs mb-1" style={{ color: C.sub }}>Veículo</div>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                  {[["CARRO", Car], ["MOTO", Bike]].map(([k, I]) => <button key={k} onClick={() => setVeic(k)} className="flex-1 py-1.5 flex justify-center" style={{ background: veic === k ? C.accent : "#fff", color: veic === k ? "#fff" : C.sub }}><I size={15} /></button>)}
                </div></label>
              <label className="block"><div className="text-xs mb-1" style={{ color: C.sub }}>Saída</div><input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} className="w-full px-2 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }} /></label>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: C.sub }}>
              <span className="flex-1">{ocup ? <Loader2 size={13} className="animate-spin inline" /> : av ? <>Percurso estimado <b style={{ color: C.text }}>{String(av.km).replace(".", ",")} km</b> · retorno à fábrica por volta das <b style={{ color: C.text }}>{av.retorno}</b></> : ""}</span>
              <button onClick={() => calc("otimizar")} className="px-2.5 py-1 rounded font-semibold" style={{ border: `1px solid ${C.line}`, color: C.accent }}>Sugerir melhor ordem</button>
            </div>
            <div className="rounded-lg" style={{ border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: C.sub, background: C.panel2 }}><Home size={13} /> Saída da fábrica · {saida}</div>
              {ordem.map((id, i) => {
                const x = porId[id]; if (!x) return null; const e = eta[id];
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid ${C.line}`, background: x.urgente ? C.redSoft : undefined }}>
                    <span className="rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ width: 22, height: 22, background: C.accent, color: "#fff" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: x.urgente ? C.red : C.text }}>{OBJ[x.objetivo]?.[0]} · {sc(x.destinoNome)}</div>
                      <div className="text-[11px] truncate" style={{ color: C.sub }}>{x.endereco}</div>
                      <div className="text-[11px]" style={{ color: e?.atrasoMin ? C.red : C.sub }}>{sc(x.horario)}{e ? ` · chegada prevista ${e.chegada}${e.atrasoMin ? ` · ${e.atrasoMin} min fora do horário` : ""}` : ""}{x.lat == null ? " · sem localização (estimado)" : ""}</div>
                    </div>
                    <button onClick={() => mexer(i, -1)} disabled={i === 0} className="p-1 rounded" style={{ color: i === 0 ? "#C9CED6" : C.sub }}><ArrowUp size={14} /></button>
                    <button onClick={() => mexer(i, 1)} disabled={i === ordem.length - 1} className="p-1 rounded" style={{ color: i === ordem.length - 1 ? "#C9CED6" : C.sub }}><ArrowDown size={14} /></button>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: C.sub, background: C.panel2, borderTop: `1px solid ${C.line}` }}><Home size={13} /> Retorno à fábrica{av ? ` · ${av.retorno}` : ""}</div>
            </div>
            <div className="text-[11px]" style={{ color: C.sub }}>A ordem sugerida busca a menor distância respeitando o horário de cada demanda (distância estimada em linha reta, 15 min por parada). Use as setas para ajustar.</div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
              <button onClick={() => salvar(false)} disabled={ocup} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Salvar rota</button>
              <button onClick={() => salvar(true)} disabled={ocup} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}><Send size={14} /> Despachar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- blocos (rotas montadas) ----------
function BlocoCard({ b, demandas, pode, meu, user, onMudou, onEditar }) {
  const l = [...demandas].sort((a, z) => (a.ordem || 0) - (z.ordem || 0));
  const feitas = l.filter((x) => x.status === "CONCLUIDA").length;
  const cor = b.status === "EM_EXECUCAO" ? C.accent : b.status === "CONCLUIDO" ? C.green : C.yellow;
  const txt = b.status === "EM_EXECUCAO" ? "em execução" : b.status === "CONCLUIDO" ? "concluída" : "montada · não despachada";
  const acao = async (body, pergunta) => { if (pergunta && !(await confirmar(pergunta))) return; try { await api("/api/rotas", "POST", { usuarioId: user.id, ...body }); onMudou(); } catch (e) { alerta(e.message); } };
  return (
    <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${cor}` }}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold flex items-center gap-1" style={{ color: C.navy }}>Rota {b.id} · {sc(b.motoristaNome)} {b.veiculo === "MOTO" ? <Bike size={13} /> : <Car size={13} />}</div>
          <div className="text-[11px]" style={{ color: C.sub }}>{l.length} parada(s){b.distanciaKm ? ` · ~${String(b.distanciaKm).replace(".", ",")} km` : ""}{b.saida ? ` · saída ${b.saida}` : ""}{b.status === "EM_EXECUCAO" ? ` · ${feitas}/${l.length} concluídas` : ""}{b.retornoEm ? ` · retorno ${new Date(b.retornoEm).toLocaleTimeString("pt-BR", { timeStyle: "short" })}` : ""}</div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: C.panel2 }}>{txt}</span>
      </div>
      <div className="px-4 pb-2 space-y-1">
        {l.map((x) => (
          <div key={x.id} className="flex items-center gap-2 text-xs">
            {b.status === "EM_EXECUCAO" && (pode || meu)
              ? <button onClick={() => acao({ acao: "parada", id: x.id, desfazer: x.status === "CONCLUIDA" })} style={{ color: x.status === "CONCLUIDA" ? C.green : C.sub }}>{x.status === "CONCLUIDA" ? <CheckCircle2 size={15} /> : <Circle size={15} />}</button>
              : <span className="font-bold w-4 text-center" style={{ color: C.sub }}>{x.ordem}</span>}
            <span className="truncate" style={{ color: C.text, textDecoration: x.status === "CONCLUIDA" ? "line-through" : "none" }}>{OBJ[x.objetivo]?.[0]} · {sc(x.destinoNome)}</span>
            <span className="ml-auto whitespace-nowrap" style={{ color: C.sub }}>{x.horario}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
        {(b.links || []).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: C.blue }}><ExternalLink size={12} /> Maps{b.links.length > 1 ? ` ${i + 1}` : ""}</a>)}
        <div className="flex-1" />
        {b.status === "MONTAGEM" && pode && <>
          <button onClick={() => acao({ acao: "desfazerBloco", id: b.id }, `Desfazer a rota ${b.id}? As demandas voltam a ficar abertas.`)} className="text-xs flex items-center gap-1" style={{ color: C.red }}><Undo2 size={12} /> Desfazer</button>
          <button onClick={onEditar} className="text-xs px-2.5 py-1 rounded font-semibold" style={{ background: C.accent, color: "#fff" }}>Abrir / despachar</button>
        </>}
        {b.status === "EM_EXECUCAO" && (pode || meu) && <button disabled={feitas < l.length} onClick={() => acao({ acao: "retorno", id: b.id }, `Registrar o retorno de ${sc(b.motoristaNome)} à fábrica? A rota fecha e ele fica disponível para outra.`)}
          className="text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1" style={{ background: feitas < l.length ? C.panel2 : C.green, color: feitas < l.length ? C.sub : "#fff" }} title={feitas < l.length ? "Conclua todas as paradas primeiro" : ""}><Home size={12} /> Retorno à fábrica</button>}
      </div>
    </div>
  );
}

// visão do motorista: a rota dele em execução, com as paradas em sequência
function MinhaRota({ bloco, demandas, user, onMudou }) {
  const l = [...demandas].sort((a, z) => (a.ordem || 0) - (z.ordem || 0));
  const feitas = l.filter((x) => x.status === "CONCLUIDA").length;
  const prox = l.find((x) => x.status !== "CONCLUIDA");
  const acao = async (body, pergunta) => { if (pergunta && !(await confirmar(pergunta))) return; try { await api("/api/rotas", "POST", { usuarioId: user.id, ...body }); onMudou(); } catch (e) { alerta(e.message); } };
  return (
    <div className="rounded-xl p-4" style={{ background: C.navy, color: "#fff" }}>
      <div className="flex items-center gap-2 mb-3">
        <Truck size={18} />
        <div className="font-bold flex-1">Minha rota · {feitas}/{l.length} paradas concluídas</div>
        {(bloco.links || []).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1" style={{ background: "#fff", color: C.navy }}><ExternalLink size={12} /> Google Maps{bloco.links.length > 1 ? ` ${i + 1}` : ""}</a>)}
      </div>
      <div className="space-y-2">
        {l.map((x) => (
          <div key={x.id} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: x.status === "CONCLUIDA" ? "rgba(255,255,255,.08)" : x.id === prox?.id ? "#fff" : "rgba(255,255,255,.15)", color: x.id === prox?.id ? C.text : "#fff" }}>
            <span className="rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ width: 24, height: 24, background: x.status === "CONCLUIDA" ? C.green : C.accent, color: "#fff" }}>{x.ordem}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ textDecoration: x.status === "CONCLUIDA" ? "line-through" : "none" }}>{OBJ[x.objetivo]?.[0]} · {sc(x.destinoNome)}{x.urgente ? " · URGENTE" : ""}</div>
              <div className="text-xs opacity-80 truncate">{x.endereco}</div>
              <div className="text-xs opacity-80">{sc(x.horario)}{x.telefone ? ` · ${[x.contato, x.telefone].filter(Boolean).join(" · ")}` : ""}{x.obs ? ` · ${x.obs}` : ""}</div>
            </div>
            <button onClick={() => acao({ acao: "parada", id: x.id, desfazer: x.status === "CONCLUIDA" })} className="px-3 py-1.5 rounded-md text-xs font-semibold shrink-0" style={{ background: x.status === "CONCLUIDA" ? "transparent" : C.green, color: "#fff", border: x.status === "CONCLUIDA" ? "1px solid rgba(255,255,255,.4)" : "none" }}>
              {x.status === "CONCLUIDA" ? "Desfazer" : "Concluir"}
            </button>
          </div>
        ))}
        <button disabled={feitas < l.length} onClick={() => acao({ acao: "retorno", id: bloco.id }, "Confirmar o retorno à fábrica? A rota fecha.")} className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: feitas < l.length ? "rgba(255,255,255,.15)" : C.accent, color: "#fff", opacity: feitas < l.length ? 0.6 : 1 }}><Home size={15} /> Cheguei na fábrica</button>
      </div>
    </div>
  );
}

function Motoristas({ l }) {
  if (!l.length) return <div className="text-xs px-1" style={{ color: C.sub }}>Nenhum motorista na folha (cargo com "motorista") nem freelancer com função motorista.</div>;
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-xs font-semibold mb-2" style={{ color: C.sub }}>Motoristas</div>
      <div className="flex flex-wrap gap-2">
        {l.map((m) => (
          <span key={m.id} className="text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: m.emRota ? C.accentSoft : C.greenSoft, color: m.emRota ? C.accent : C.green }}>
            <span className="rounded-full" style={{ width: 7, height: 7, background: m.emRota ? C.accent : C.green }} /> {sc(m.apelido || m.nome)} · {m.emRota ? `em rota (${m.emRota})` : "disponível"}{!m.telefone ? " · sem telefone" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function FabricaModal({ user, atual, onClose, onOk }) {
  const [e, setE] = useState(atual?.endereco || "");
  const [ocup, setOcup] = useState(false);
  const salvar = async () => {
    setOcup(true);
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "fabrica", endereco: e }); onOk(); } catch (x) { alerta(x.message); setOcup(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(ev) => ev.stopPropagation()} className="rounded-xl w-full max-w-lg shadow-2xl p-5" style={{ background: C.panel }}>
        <div className="text-base font-bold mb-1" style={{ color: C.navy }}>Endereço da fábrica</div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>Ponto de saída e de retorno de todas as rotas.</div>
        <input autoFocus value={e} onChange={(ev) => setE(ev.target.value)} placeholder="Rua, número, bairro, cidade - UF" className="w-full px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={salvar} disabled={ocup || !e.trim()} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{ocup && <Loader2 size={14} className="animate-spin" />} Salvar</button>
        </div>
      </div>
    </div>
  );
}
