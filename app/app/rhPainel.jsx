"use client";
// v168 — RH: painel de gestão (assiduidade, pontualidade, horas extras), gráficos, dados acionáveis,
// importação do cartão de ponto com crítica e justificativa, medalhas de tempo de casa.
import React, { useState, useEffect, useRef } from "react";
import {
  Loader2, Upload, X, ChevronDown, AlertTriangle, CheckCircle2, Clock, Timer, CalendarCheck, Award, Trash2, FileText,
  ShieldAlert, TrendingUp, Users2, Plus, Medal,
} from "lucide-react";
import { Soltar, ModalContas as Modal, CoresContas as C } from "./contas";
import { podeImportar } from "@/lib/acesso";

const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro na operação.");
  return j;
};
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(file); });
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_L = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeComp = (c, longo) => (c ? `${(longo ? MESES_L : MESES)[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}` : "—");
export const horas = (min) => (min == null ? "—" : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`);
export const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const TRILHO = "#E4E7EC";
// faixas: ≥ 97% verde · ≥ 92% amarelo · abaixo, vermelho
export const corPct = (v) => (v == null ? C.sub : v >= 97 ? C.green : v >= 92 ? C.yellow : C.red);
const corHE = (min, lim) => (min == null ? C.sub : min > lim ? C.red : min > lim / 2 ? C.yellow : C.green);

/* ======================= painel de gestão (topo do RH) ======================= */
export function PainelRH({ user, p, comp, setComp }) {
  const [aberto, setAberto] = useState(null);   // indicador com a estratificação aberta
  if (!p) return <div className="flex items-center gap-2 text-sm mb-4" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando indicadores…</div>;
  const g = p.geral;
  const pend = (p.pendencias || []).filter((x) => !x.justificativa).length;
  const IND = [
    { k: "assiduidade", rot: "Assiduidade geral", Ico: CalendarCheck, val: pct(g?.assiduidade), cor: corPct(g?.assiduidade),
      sub: g ? `${g.faltas} falta(s) · ${g.atestados} atestado(s) em ${g.previstos - g.pendentes} dia(s) previstos` : "sem ponto importado", ord: (a, b) => (a.assiduidade ?? 999) - (b.assiduidade ?? 999), cel: (r) => pct(r.assiduidade), cc: (r) => corPct(r.assiduidade), det: (r) => `${r.faltas} falta(s) · ${r.atestados} atestado(s)` },
    { k: "pontualidade", rot: "Pontualidade geral", Ico: Clock, val: pct(g?.pontualidade), cor: corPct(g?.pontualidade),
      sub: g ? `${g.atrasos} atraso(s) · ${horas(g.minAtraso)} no total · pontual: antes do horário ou até 5 min depois` : "—", ord: (a, b) => (a.pontualidade ?? 999) - (b.pontualidade ?? 999), cel: (r) => pct(r.pontualidade), cc: (r) => corPct(r.pontualidade), det: (r) => `${r.atrasos} atraso(s) · ${horas(r.minAtraso)}` },
    { k: "he", rot: "Horas extras gerais", Ico: Timer, val: g ? horas(g.he) : "—", cor: g ? (g.diasAcima2h ? C.red : C.navy) : C.sub,
      sub: g ? `custo estimado R$ ${brl(g.custoHE)} (50%) · ${g.diasAcima2h} dia(s) acima de 2 h` : "—", ord: (a, b) => b.he - a.he, cel: (r) => horas(r.he), cc: (r) => corHE(r.he, p.limiteHE), det: (r) => `R$ ${brl(r.custoHE)}${r.diasAcima2h ? ` · ${r.diasAcima2h} dia(s) > 2 h` : ""}` },
    { k: "pend", rot: "Pendências de ponto", Ico: ShieldAlert, val: String(pend), cor: pend ? C.red : C.green,
      sub: pend ? "dias sem registro ou mês sem cartão — justifique em Ponto" : "tudo registrado ou justificado", lista: true },
  ];
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TrendingUp size={18} style={{ color: C.accent }} />
        <div className="font-bold" style={{ color: C.navy }}>Gestão de pessoas</div>
        <div className="text-xs" style={{ color: C.sub }}>pelo cartão de ponto · clique no número para ver por funcionário</div>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs" style={{ color: C.sub }}>Mês</span>
          <select value={comp || ""} onChange={(e) => setComp(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
            {!p.competencias.length && <option value="">sem ponto importado</option>}
            {[...p.competencias].reverse().map((c) => <option key={c} value={c}>{nomeComp(c, true)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {IND.map((i) => (
          <div key={i.k} className="rounded-xl p-4 relative" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${i.cor}` }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.sub }}><i.Ico size={14} /> {i.rot}</div>
            <button onClick={() => g && setAberto(aberto === i.k ? null : i.k)} disabled={!g} className="font-semibold flex items-center gap-1 mt-1" style={{ fontSize: 28, lineHeight: 1.15, color: g ? C.text : C.sub }}>
              {i.val} {g && <ChevronDown size={18} style={{ color: C.accent, transform: aberto === i.k ? "rotate(180deg)" : "none" }} />}
            </button>
            <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>{i.sub}</div>
            {aberto === i.k && (i.lista
              ? <ListaPendencias p={p} onClose={() => setAberto(null)} />
              : <Estratificacao titulo={`${i.rot} · ${nomeComp(comp, true)}`} linhas={[...p.ranking].sort(i.ord)} cel={i.cel} cc={i.cc} det={i.det} deptos={p.deptos} onClose={() => setAberto(null)} />)}
          </div>
        ))}
      </div>
      {/* gráficos: ocupam o lugar do antigo calendário */}
      <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Grafico titulo="Assiduidade e pontualidade (%)" serie={p.series} linhas={[["assiduidade", C.green, "Assiduidade"], ["pontualidade", C.blue, "Pontualidade"]]} min={80} max={100} sufixo="%" comp={comp} onClique={setComp} />
        <Grafico titulo="Horas extras por mês (h)" serie={p.series} barras={["he", C.accent, "Horas extras"]} comp={comp} onClique={setComp} />
      </div>
    </div>
  );
}

function useFora(ref, onClose) {
  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, []);
}

function Estratificacao({ titulo, linhas, cel, cc, det, deptos, onClose }) {
  const ref = useRef(null);
  useFora(ref, onClose);
  return (
    <div ref={ref} className="absolute left-2 right-2 z-30 rounded-xl p-3 shadow-xl" style={{ top: 92, background: C.panel, border: `1px solid ${C.line}`, maxHeight: 380, overflowY: "auto", minWidth: 280 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold" style={{ color: C.navy }}>{titulo}</div>
        <button onClick={onClose} style={{ color: C.sub }}><X size={14} /></button>
      </div>
      {!linhas.length && <div className="text-xs" style={{ color: C.sub }}>Ninguém com ponto neste mês.</div>}
      <div className="flex flex-col gap-1.5">
        {linhas.map((r, i) => (
          <div key={r.pessoaId} className="text-xs flex items-center gap-2">
            <span className="font-bold tabular-nums" style={{ color: C.sub, width: 18 }}>{i + 1}º</span>
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold" style={{ color: C.text }} title={r.nomeCompleto || r.nome}>{r.nome}</div>
              <div className="truncate text-[10px]" style={{ color: C.sub }}>{(deptos[r.depto] || r.depto || "").replace(/^\d+\.\s*/, "")} · {det(r)}</div>
            </div>
            <span className="font-bold tabular-nums" style={{ color: cc(r) }}>{cel(r)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListaPendencias({ p, onClose }) {
  const ref = useRef(null);
  useFora(ref, onClose);
  const l = (p.pendencias || []).filter((x) => !x.justificativa);
  return (
    <div ref={ref} className="absolute left-2 right-2 z-30 rounded-xl p-3 shadow-xl" style={{ top: 92, background: C.panel, border: `1px solid ${C.line}`, maxHeight: 380, overflowY: "auto", minWidth: 280 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold" style={{ color: C.navy }}>Pendências sem justificativa · {nomeComp(p.competencia, true)}</div>
        <button onClick={onClose} style={{ color: C.sub }}><X size={14} /></button>
      </div>
      {!l.length && <div className="text-xs" style={{ color: C.green }}>Nenhuma pendência.</div>}
      {l.map((x) => (
        <div key={x.chave} className="text-xs py-1" style={{ borderTop: `1px solid ${C.line}` }}>
          <b style={{ color: C.text }}>{x.nome}</b> · {x.data ? dBR(x.data) : nomeComp(x.competencia, true)} · <span style={{ color: C.red }}>{x.tipo}</span>
          <div className="text-[10px]" style={{ color: C.sub }}>{x.detalhe}</div>
        </div>
      ))}
      <div className="text-[11px] mt-2 pt-2" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>Para justificar, abra o card <b>Ponto</b>.</div>
    </div>
  );
}

// gráfico de linhas (percentuais) ou de barras (horas), 12 meses; clicar no mês muda o painel
function Grafico({ titulo, serie, linhas, barras, min = 0, max, sufixo = "", comp, onClique }) {
  const [hover, setHover] = useState(null);
  const W = 520, H = 170, PL = 34, PR = 10, PT = 12, PB = 24;
  const n = serie.length;
  const valores = linhas ? linhas.flatMap(([k]) => serie.map((s) => s[k])).filter((v) => v != null) : serie.map((s) => s[barras[0]] || 0);
  const vMax = max ?? Math.max(1, ...valores) * 1.15;
  const vMin = linhas ? Math.min(min, ...valores.map((v) => Math.floor(v / 5) * 5)) : 0;
  const x = (i) => PL + (n <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
  const y = (v) => PT + (1 - (v - vMin) / (vMax - vMin || 1)) * (H - PT - PB);
  const bw = Math.max(6, Math.min(30, (W - PL - PR) / Math.max(1, n) - 8));
  const xb = (i) => PL + ((i + 0.5) * (W - PL - PR)) / Math.max(1, n);
  const ticks = [vMin, (vMin + vMax) / 2, vMax];
  const h = hover != null ? serie[hover] : null;
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3 mb-1">
        <div className="text-xs font-semibold" style={{ color: C.sub }}>{titulo}</div>
        <div className="ml-auto flex gap-3">
          {(linhas || [barras]).map(([k, cor, rot]) => <span key={k} className="flex items-center gap-1 text-[11px]" style={{ color: C.sub }}><span style={{ width: 10, height: 3, background: cor, borderRadius: 2 }} /> {rot}</span>)}
        </div>
      </div>
      {!n ? <div className="text-xs py-10 text-center" style={{ color: C.sub }}>Importe os cartões de ponto para ver a evolução.</div> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t, i) => <g key={i}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke={TRILHO} strokeDasharray="3 3" /><text x={PL - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill={C.sub}>{Math.round(t)}{sufixo}</text></g>)}
          {serie.map((s, i) => (
            <g key={s.competencia} onMouseEnter={() => setHover(i)} onClick={() => onClique?.(s.competencia)} style={{ cursor: "pointer" }}>
              <rect x={(linhas ? x(i) : xb(i)) - (W - PL - PR) / Math.max(1, n) / 2} y={PT} width={(W - PL - PR) / Math.max(1, n)} height={H - PT - PB} fill={s.competencia === comp ? "#FFF0E6" : "transparent"} />
              <text x={linhas ? x(i) : xb(i)} y={H - 8} textAnchor="middle" fontSize="9" fill={s.competencia === comp ? C.accent : C.sub} fontWeight={s.competencia === comp ? 700 : 400}>{MESES[Number(s.competencia.slice(5, 7)) - 1]}</text>
              {barras && <rect x={xb(i) - bw / 2} y={y(s[barras[0]] || 0)} width={bw} height={Math.max(0, H - PB - y(s[barras[0]] || 0))} rx="3" fill={s.competencia === comp ? barras[1] : "#FFC8A6"} />}
            </g>
          ))}
          {linhas && linhas.map(([k, cor]) => {
            const pts = serie.map((s, i) => (s[k] == null ? null : [x(i), y(s[k])])).filter(Boolean);
            return <g key={k} style={{ pointerEvents: "none" }}>
              <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" />
              {pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r="3" fill="#fff" stroke={cor} strokeWidth="2" />)}
            </g>;
          })}
        </svg>
      )}
      <div className="text-[11px]" style={{ color: C.sub, minHeight: 16 }}>
        {h ? `${nomeComp(h.competencia, true)}: ${linhas ? linhas.map(([k, , r]) => `${r.toLowerCase()} ${pct(h[k])}`).join(" · ") : `${String(h.he).replace(".", ",")} h extras`} · clique para abrir o mês` : "passe o mouse nos meses"}
      </div>
    </div>
  );
}

/* ======================= dados acionáveis (abaixo dos cards) ======================= */
const NIVEL = { ALTO: [C.red, C.redSoft], MEDIO: [C.yellow, C.yellowSoft], BAIXO: [C.blue, C.blueSoft] };
export function Acionaveis({ p, irPonto }) {
  if (!p) return null;
  const f = p.freelancer;
  const maxPct = Math.max(30, ...(f?.linhas || []).map((l) => l.pct || 0));
  return (
    <div className="grid gap-4 mt-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
      <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Users2 size={16} style={{ color: C.accent }} />
          <div className="font-bold text-sm" style={{ color: C.navy }}>Freelancer × folha por setor · {nomeComp(f.competencia, true)}</div>
          <span className="ml-auto text-xs font-bold" style={{ color: (f.total.pct || 0) > 30 ? C.red : C.text }}>{f.total.pct == null ? "—" : `${String(f.total.pct).replace(".", ",")}% no total`}</span>
        </div>
        {!f.linhas.length && <div className="text-xs py-6 text-center" style={{ color: C.sub }}>Sem lançamentos de pessoal de produção ou freelancer no mês.</div>}
        <table className="w-full text-xs">
          {f.linhas.length > 0 && <thead><tr style={{ color: C.sub }}><th className="text-left font-semibold py-1">Setor</th><th className="text-right font-semibold">Folha</th><th className="text-right font-semibold">Freelancer</th><th className="font-semibold text-left pl-3" style={{ width: "34%" }}>% sobre a folha</th></tr></thead>}
          <tbody>
            {f.linhas.map((l) => (
              <tr key={l.setor} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-1.5 font-semibold" style={{ color: C.text }}>{l.setor}</td>
                <td className="text-right tabular-nums" title={`fonte: ${l.fonteFolha}`}>{brl(l.folha)}{l.fonteFolha === "MATRIZ" && <sup style={{ color: C.sub }}>m</sup>}</td>
                <td className="text-right tabular-nums" title={`fonte: ${l.fonteFree}`}>{brl(l.freelancer)}</td>
                <td className="pl-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: TRILHO }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.min(100, ((l.pct ?? maxPct) / maxPct) * 100)}%`, background: l.pct == null || l.pct > 30 ? C.red : l.pct > 15 ? C.yellow : C.green }} />
                    </div>
                    <span className="tabular-nums font-bold w-12 text-right" style={{ color: l.pct == null || l.pct > 30 ? C.red : C.text }}>{l.pct == null ? "só free" : `${String(l.pct).replace(".", ",")}%`}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[11px] mt-2" style={{ color: C.sub }}>
          Folha e freelancer pelo extrato identificado do mês; sem extrato, a folha vem da Matriz (<sup>m</sup>) e o freelancer das contas da semana.
          {f.semSetor > 0 && ` Freelancer sem setor (conta 2117100): R$ ${brl(f.semSetor)}.`} Acima de 30% vale avaliar contratação.
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} style={{ color: C.accent }} />
          <div className="font-bold text-sm" style={{ color: C.navy }}>Alertas e próximas ações</div>
          <span className="ml-auto text-xs" style={{ color: C.sub }}>{p.alertas.length} item(ns)</span>
        </div>
        {!p.alertas.length && <div className="text-xs py-6 text-center flex items-center justify-center gap-1" style={{ color: C.green }}><CheckCircle2 size={14} /> Nada pedindo atenção.</div>}
        <div className="flex flex-col gap-1.5" style={{ maxHeight: 320, overflowY: "auto" }}>
          {p.alertas.map((a, i) => {
            const [cor, bg] = NIVEL[a.nivel] || NIVEL.BAIXO;
            const Ico = a.tipo === "MEDALHA" ? Award : a.tipo.startsWith("HE") ? Timer : a.tipo === "PONTO" ? ShieldAlert : a.tipo === "EXPERIENCIA" ? Clock : AlertTriangle;
            return (
              <button key={i} onClick={a.tipo === "PONTO" ? irPonto : undefined} className="text-left text-xs rounded-lg px-2.5 py-2 flex items-start gap-2" style={{ background: bg, cursor: a.tipo === "PONTO" ? "pointer" : "default" }}>
                <Ico size={14} style={{ color: cor, marginTop: 1 }} className="shrink-0" />
                <span className="flex-1" style={{ color: C.text }}>{a.texto}{a.valor ? ` · custo estimado R$ ${brl(a.valor)}` : ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ======================= medalhas ======================= */
export function Medalhas({ lista, tamanho = 18 }) {
  if (!lista?.length) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-1">
      {lista.map((m) => (
        <span key={m.anos} title={`${m.nome} · ${m.anos} ano(s) de casa${m.premio ? ` · ${m.premio}` : ""}`} className="inline-flex items-center justify-center rounded-full font-bold"
          style={{ width: tamanho + 4, height: tamanho + 4, background: m.cor, color: "#fff", fontSize: tamanho * 0.5, boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}>{m.anos}</span>
      ))}
    </div>
  );
}

// números do mês no card do carômetro
// números do período no card do carômetro — clicar num número abre a síntese
export function StatsFuncionario({ s, tempo, rotulo, limiteHE, onAbrir }) {
  const t = tempo;
  const cel = (k, rot, val, cor, tit) => (
    <span role="button" tabIndex={0} title={`${tit} — clique para ver a síntese`} onClick={(e) => { e.stopPropagation(); onAbrir?.(k); }}
      className="block rounded py-0.5 hover:bg-orange-50" style={{ cursor: onAbrir ? "pointer" : "default" }}>
      <span className="block" style={{ color: C.sub }}>{rot}</span><span className="block font-bold text-xs" style={{ color: cor }}>{val}</span>
    </span>
  );
  return (
    <div className="mt-2 pt-2 text-[10px]" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="grid grid-cols-3 gap-1">
        {cel("assiduidade", "Assid.", pct(s?.assiduidade ?? null), corPct(s?.assiduidade ?? null), "Assiduidade no período")}
        {cel("pontualidade", "Pont.", pct(s?.pontualidade ?? null), corPct(s?.pontualidade ?? null), "Pontualidade no período")}
        {cel("he", "H. extra", s ? horas(s.he) : "—", s ? corHE(s.he, limiteHE * Math.max(1, Math.round((s.dias || 30) / 30))) : C.sub, "Horas extras no período")}
      </div>
      <div className="mt-1.5" style={{ color: C.sub }}>
        {t ? <>desde <b style={{ color: C.text }}>{dBR(t.admissao)}</b> · {t.anos > 0 ? `${t.anos} ano(s)` : `${Math.max(0, Math.floor(t.dias / 30.44))} mês(es)`}</> : "admissão não cadastrada"}
      </div>
      {t && <Medalhas lista={t.medalhas} />}
      {t?.proxima && <div className="mt-0.5" style={{ color: C.sub }}>próxima: {t.proxima.nome} em {dBR(t.proxima.data)}</div>}
      {rotulo && <div className="mt-0.5" style={{ color: C.sub }}>{rotulo}</div>}
    </div>
  );
}

/* ---------- filtro de período (carômetro) ---------- */
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
export function periodoPadrao() { const h = hojeISO(); return { de: `${h.slice(0, 4)}-01-01`, ate: h }; }
export function atalhosPeriodo() {
  const h = hojeISO(), a = Number(h.slice(0, 4)), m = Number(h.slice(5, 7));
  const pm = m === 1 ? [a - 1, 12] : [a, m - 1];
  const ym = (y, mm) => `${y}-${String(mm).padStart(2, "0")}`;
  const d12 = new Date(); d12.setFullYear(d12.getFullYear() - 1); d12.setDate(d12.getDate() + 1);
  return [
    ["Ano atual", { de: `${a}-01-01`, ate: h }],
    ["Mês atual", { de: `${ym(a, m)}-01`, ate: h }],
    ["Mês anterior", { de: `${ym(...pm)}-01`, ate: `${ym(...pm)}-${ultimoDia(...pm)}` }],
    ["12 meses", { de: d12.toISOString().slice(0, 10), ate: h }],
    ["Ano anterior", { de: `${a - 1}-01-01`, ate: `${a - 1}-12-31` }],
  ];
}
export function FiltroPeriodo({ p, setP }) {
  const at = atalhosPeriodo();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs" style={{ color: C.sub }}>Período</span>
      <input type="date" value={p.de} onChange={(e) => e.target.value && setP({ ...p, de: e.target.value })} className="rounded-lg px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${C.line}` }} />
      <span className="text-xs" style={{ color: C.sub }}>a</span>
      <input type="date" value={p.ate} onChange={(e) => e.target.value && setP({ ...p, ate: e.target.value })} className="rounded-lg px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${C.line}` }} />
      {at.map(([t, v]) => (
        <button key={t} onClick={() => setP(v)} className="px-2 py-1 rounded-lg text-[11px] font-semibold"
          style={p.de === v.de && p.ate === v.ate ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
      ))}
    </div>
  );
}

/* ---------- síntese de um funcionário no período ---------- */
const DIA_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSem = (s) => DIA_SEM[new Date(`${s}T12:00:00Z`).getUTCDay()];
export function SinteseModal({ user, pessoa, periodo, foco, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api(`/api/rh/ponto?u=${user.id}&acao=sintese&pessoaId=${encodeURIComponent(pessoa.id)}&de=${periodo.de}&ate=${periodo.ate}`).then(setD).catch((e) => setErro(e.message));
  }, []);
  const t = d?.total;
  const datas = (l, f = (x) => dBR(x.data || x)) => l.map((x) => <span key={x.data || x} className="inline-block px-1.5 py-0.5 rounded mr-1 mb-1 text-[11px]" style={{ background: C.panel2 }}>{f(x)}</span>);
  const frase = () => {
    if (!t) return "Nenhum dia de ponto importado neste período.";
    const p = [];
    p.push(`No período de ${dBR(periodo.de)} a ${dBR(periodo.ate)}, ${pessoa.nome} tinha ${t.previstos - t.diasFerias >= 0 ? t.previstos : 0} dia(s) de trabalho previsto(s)`);
    p.push(t.faltas ? `faltou ${t.faltas} vez(es)` : "não faltou nenhuma vez");
    if (t.atestados) p.push(`apresentou ${t.atestados} atestado(s)`);
    p.push(t.atrasos ? `chegou atrasado(a) ${t.atrasos} vez(es), somando ${horas(t.minAtraso)}` : "não chegou atrasado(a)");
    p.push(t.he ? `fez ${horas(t.he)} de horas extras${t.diasAcima2h ? ` (${t.diasAcima2h} dia(s) acima de 2 h)` : ""}` : "não fez horas extras");
    if (t.diasFerias) p.push(`esteve ${t.diasFerias} dia(s) de férias (fora do cálculo)`);
    if (t.pendentes) p.push(`e há ${t.pendentes} dia(s) sem registro aguardando justificativa`);
    return p.join(", ").replace(/, ([^,]*)$/, " e $1") + ".";
  };
  const Bloco = ({ k, titulo, cor, children, vazio }) => (
    <div className="rounded-lg p-3 mb-2" style={{ border: `1px solid ${foco === k ? C.accent : C.line}`, background: foco === k ? C.accentSoft : C.panel }}>
      <div className="text-xs font-bold mb-1.5" style={{ color: cor || C.navy }}>{titulo}</div>
      {children || <div className="text-xs" style={{ color: C.sub }}>{vazio}</div>}
    </div>
  );
  return (
    <Modal titulo={`${pessoa.nome} · síntese do ponto`} icone={CalendarCheck} onClose={onClose} largura={760}>
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {d && <>
        <div className="text-sm mb-3 p-3 rounded-lg" style={{ background: C.panel2, color: C.text, lineHeight: 1.5 }}>{frase()}</div>
        {t && <div className="grid grid-cols-4 gap-2 mb-3">
          {[["Assiduidade", pct(t.assiduidade), corPct(t.assiduidade)], ["Pontualidade", pct(t.pontualidade), corPct(t.pontualidade)], ["Horas extras", horas(t.he), C.navy], ["Faltas · atrasos", `${t.faltas} · ${t.atrasos}`, t.faltas + t.atrasos ? C.red : C.green]].map(([r, v, c]) => (
            <div key={r} className="rounded-lg p-2 text-center" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px]" style={{ color: C.sub }}>{r}</div><div className="font-bold text-lg" style={{ color: c }}>{v}</div></div>
          ))}
        </div>}
        <Bloco k="assiduidade" titulo={`Faltas (${d.faltas.length})`} cor={d.faltas.length ? C.red : C.green} vazio="Nenhuma falta.">{d.faltas.length > 0 && <div>{datas(d.faltas, (x) => `${dBR(x.data)} ${diaSem(x.data)}${x.motivo ? ` · ${x.motivo}` : ""}`)}</div>}</Bloco>
        {(d.atestados.length > 0 || foco === "assiduidade") && <Bloco k="x" titulo={`Atestados (${d.atestados.length})`} vazio="Nenhum atestado.">{d.atestados.length > 0 && <div>{datas(d.atestados)}</div>}</Bloco>}
        {d.horasFalta.length > 0 && <Bloco k="x" titulo={`Saídas antecipadas / horas faltantes (${d.horasFalta.length} dia(s) · ${horas(d.horasFalta.reduce((a, x) => a + x.min, 0))})`}>{datas(d.horasFalta, (x) => `${dBR(x.data)} · ${horas(x.min)}`)}</Bloco>}
        <Bloco k="pontualidade" titulo={`Atrasos (${d.atrasos.length}${d.atrasos.length ? ` · ${horas(d.atrasos.reduce((a, x) => a + x.min, 0))}` : ""})`} cor={d.atrasos.length ? C.red : C.green} vazio="Nenhum atraso: todas as entradas foram antes do horário ou até 5 min depois.">
          {d.atrasos.length > 0 && <div>{datas(d.atrasos, (x) => `${dBR(x.data)} ${diaSem(x.data)} · entrou ${x.entrada} (previsto ${x.previsto}) · +${x.min} min`)}</div>}
        </Bloco>
        <Bloco k="he" titulo={`Horas extras (${d.extras.length} dia(s) · ${horas(d.extras.reduce((a, x) => a + x.min, 0))})`} vazio="Nenhuma hora extra.">
          {d.extras.length > 0 && <div>{datas(d.extras, (x) => `${dBR(x.data)} ${diaSem(x.data)} · ${horas(x.min)}${x.exced ? " ⚠" : ""}`)}<div className="text-[10px]" style={{ color: C.sub }}>⚠ = acima de 2 h no dia</div></div>}
        </Bloco>
        {d.ferias.length > 0 && <Bloco k="x" titulo={`Férias no período (${d.ferias.length} dia(s) — fora da assiduidade e da pontualidade)`} cor={C.blue}><div className="text-xs" style={{ color: C.sub }}>{dBR(d.ferias[0])} a {dBR(d.ferias[d.ferias.length - 1])}</div></Bloco>}
        {(d.pendentes.length > 0 || d.justificados.length > 0) && <Bloco k="x" titulo={`Crítica do ponto: ${d.pendentes.length} pendente(s) · ${d.justificados.length} justificado(s)`} cor={d.pendentes.length ? C.red : C.sub}>
          {datas([...d.pendentes.map((x) => ({ ...x, j: false })), ...d.justificados.map((x) => ({ ...x, j: true }))].sort((a, b) => (a.data < b.data ? -1 : 1)), (x) => `${dBR(x.data)} · ${x.j ? x.motivo : x.tipo}`)}
        </Bloco>}
      </>}
    </Modal>
  );
}

export function MedalhasModal({ user, lista, onClose, onSalvo }) {
  const [l, setL] = useState(lista.map((m) => ({ ...m })));
  const [st, setSt] = useState("");
  const set = (i, k, v) => setL((x) => x.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const salvar = async () => {
    setSt("Salvando…");
    try { const r = await api("/api/rh/painel", "POST", { usuarioId: user.id, acao: "medalhas", lista: l }); onSalvo(r.medalhas); }
    catch (e) { setSt(e.message); }
  };
  return (
    <Modal titulo="Medalhas de tempo de casa e premiações" icone={Award} onClose={onClose} largura={760}
      rodape={<>
        <span className="text-xs mr-auto" style={{ color: st.startsWith("Salv") ? C.sub : C.red }}>{st}</span>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={salvar} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
      </>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Cada marco aparece como medalha no card do carômetro, e o painel avisa 30 dias antes de alguém completar o marco. Defina a premiação de cada um.</div>
      <table className="w-full text-sm">
        <thead><tr className="text-xs" style={{ color: C.sub }}><th className="text-left font-semibold py-1 w-20">Anos</th><th className="text-left font-semibold">Medalha</th><th className="text-left font-semibold w-16">Cor</th><th className="text-left font-semibold">Premiação</th><th /></tr></thead>
        <tbody>
          {l.map((m, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="py-1.5 pr-2"><input type="number" min={1} value={m.anos} onChange={(e) => set(i, "anos", e.target.value)} className="w-16 rounded px-2 py-1 outline-none" style={{ border: `1px solid ${C.line}` }} /></td>
              <td className="pr-2"><input value={m.nome} onChange={(e) => set(i, "nome", e.target.value)} className="w-full rounded px-2 py-1 outline-none" style={{ border: `1px solid ${C.line}` }} /></td>
              <td className="pr-2"><input type="color" value={m.cor} onChange={(e) => set(i, "cor", e.target.value)} style={{ width: 40, height: 28 }} /></td>
              <td className="pr-2"><input value={m.premio || ""} onChange={(e) => set(i, "premio", e.target.value)} placeholder="a definir (ex.: certificado + vale-presente)" className="w-full rounded px-2 py-1 outline-none" style={{ border: `1px solid ${C.line}` }} /></td>
              <td><button onClick={() => setL((x) => x.filter((_, j) => j !== i))} style={{ color: C.sub }}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setL((x) => [...x, { anos: (x[x.length - 1]?.anos || 0) + 5, nome: "", cor: "#FF6B1A", premio: "" }])} className="mt-2 text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}><Plus size={13} /> Adicionar marco</button>
    </Modal>
  );
}

/* ======================= tela Ponto: importar, criticar, justificar ======================= */
export function PontoTela({ user, p, comp, setComp, recarregar }) {
  const [imp, setImp] = useState(null);      // null | [] | FileList
  const [lista, setLista] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [just, setJust] = useState(null);    // { chaves }
  const [jorn, setJorn] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const ref = useRef(null);
  const carregar = () => api(`/api/rh/ponto?u=${user.id}`).then((j) => { setLista(j.importacoes); setMotivos(j.motivos); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const ok = (m) => { setAviso(m); setTimeout(() => setAviso(""), 7000); carregar(); recarregar(); };
  const pend = (p?.pendencias || []);
  const abertas = pend.filter((x) => !x.justificativa);
  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const desfazer = async (x) => { try { await api("/api/rh/ponto", "POST", { usuarioId: user.id, acao: "desfazer", chave: x.chave }); recarregar(); } catch (e) { setErro(e.message); } };
  const excluir = async (x) => {
    if (!confirm(`Excluir o cartão de ${x.nome} (${dBR(x.inicio)} a ${dBR(x.fim)})? Os dias dele saem dos indicadores.`)) return;
    try { await api("/api/rh/ponto", "DELETE", { usuarioId: user.id, id: x.id }); ok("Cartão excluído."); } catch (e) { setErro(e.message); }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Soltar onArquivos={(fs) => setImp([...fs])} dica="Solte os cartões">
          <button onClick={() => setImp([])} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Upload size={15} /> Importar cartões de ponto</button>
        </Soltar>
        <button onClick={() => setJorn(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.panel, color: C.navy, border: `1px solid ${C.line}` }}><Clock size={15} style={{ color: C.accent }} /> Jornadas de trabalho</button>
        <div className="text-xs flex-1" style={{ color: C.sub, minWidth: 260 }}>PDF "Cartão de Ponto Calculado" do iPonto, um ou vários funcionários. O sistema confere o período e aponta os dias sem registro.</div>
        <span className="text-xs" style={{ color: C.sub }}>Mês</span>
        <select value={comp || ""} onChange={(e) => setComp(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
          {!(p?.competencias || []).length && <option value="">—</option>}
          {[...(p?.competencias || [])].reverse().map((c) => <option key={c} value={c}>{nomeComp(c, true)}</option>)}
        </select>
      </div>
      {aviso && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {/* crítica */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.panel, border: `1px solid ${abertas.length ? C.red + "66" : C.line}` }}>
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: abertas.length ? C.redSoft : C.panel2 }}>
          <ShieldAlert size={16} style={{ color: abertas.length ? C.red : C.green }} />
          <div className="text-sm font-bold" style={{ color: C.navy }}>Crítica do ponto · {nomeComp(comp, true)}</div>
          <span className="text-xs" style={{ color: C.sub }}>{abertas.length} sem justificativa · {pend.length - abertas.length} justificada(s)</span>
          {sel.size > 0 && <button onClick={() => setJust({ chaves: [...sel] })} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}>Justificar {sel.size} selecionada(s)</button>}
        </div>
        {!pend.length && <div className="p-6 text-center text-sm flex items-center justify-center gap-1" style={{ color: C.green }}><CheckCircle2 size={15} /> Nenhum dia sem registro neste mês.</div>}
        {pend.length > 0 && (
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.sub }}>
              <th className="px-3 py-2 w-8"><input type="checkbox" checked={abertas.length > 0 && abertas.every((x) => sel.has(x.chave))} onChange={(e) => setSel(e.target.checked ? new Set(abertas.map((x) => x.chave)) : new Set())} /></th>
              {["Funcionário", "Dia", "Crítica", "Detalhe", "Justificativa", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>{pend.map((x) => (
              <tr key={x.chave} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-3 py-1.5">{!x.justificativa && <input type="checkbox" checked={sel.has(x.chave)} onChange={() => toggle(x.chave)} />}</td>
                <td className="px-3 py-1.5 font-semibold">{x.nome}</td>
                <td className="px-3 py-1.5">{x.data ? dBR(x.data) : `mês ${nomeComp(x.competencia)}`}</td>
                <td className="px-3 py-1.5 font-semibold" style={{ color: x.justificativa ? C.sub : C.red }}>{x.tipo}</td>
                <td className="px-3 py-1.5" style={{ color: C.sub }}>{x.detalhe}</td>
                <td className="px-3 py-1.5">{x.justificativa
                  ? <span style={{ color: C.green }}><b>{x.justificativa.motivo}</b>{x.justificativa.texto ? ` · ${x.justificativa.texto}` : ""}<span style={{ color: C.sub }}> · {x.justificativa.por}</span></span>
                  : <button onClick={() => setJust({ chaves: [x.chave] })} className="font-semibold" style={{ color: C.accent }}>justificar</button>}</td>
                <td className="px-3 py-1.5">{x.justificativa && <button onClick={() => desfazer(x)} title="Desfazer a justificativa" className="text-[11px]" style={{ color: C.sub }}>desfazer</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* por funcionário no mês */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-4 py-2.5 text-sm font-bold" style={{ background: C.panel2, color: C.navy }}>Funcionários · {nomeComp(comp, true)}</div>
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub }}>{["Funcionário", "Dias previstos", "Faltas", "Atestados", "Assiduidade", "Atrasos", "Pontualidade", "Horas extras", "Dias > 2 h", "Custo HE"].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
          <tbody>{[...(p?.ranking || [])].sort((a, b) => a.nome.localeCompare(b.nome)).map((r) => (
            <tr key={r.pessoaId} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-3 py-1.5 font-semibold">{r.nome}</td>
              <td className="px-3 py-1.5 text-right">{r.previstos}{r.pendentes ? <span style={{ color: C.red }}> ({r.pendentes} pend.)</span> : ""}</td>
              <td className="px-3 py-1.5 text-right">{r.faltas}</td>
              <td className="px-3 py-1.5 text-right">{r.atestados}</td>
              <td className="px-3 py-1.5 text-right font-bold" style={{ color: corPct(r.assiduidade) }}>{pct(r.assiduidade)}</td>
              <td className="px-3 py-1.5 text-right">{r.atrasos}{r.minAtraso ? ` · ${horas(r.minAtraso)}` : ""}</td>
              <td className="px-3 py-1.5 text-right font-bold" style={{ color: corPct(r.pontualidade) }}>{pct(r.pontualidade)}</td>
              <td className="px-3 py-1.5 text-right font-bold" style={{ color: corHE(r.he, p.limiteHE) }}>{horas(r.he)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: r.diasAcima2h ? C.red : C.text }}>{r.diasAcima2h}</td>
              <td className="px-3 py-1.5 text-right">R$ {brl(r.custoHE)}</td>
            </tr>
          ))}</tbody>
        </table>
        {!(p?.ranking || []).length && <div className="p-6 text-center text-sm" style={{ color: C.sub }}>Nenhum cartão neste mês.</div>}
        <div className="px-4 py-2 text-[11px]" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
          Assiduidade = 1 − faltas ÷ dias previstos (atestado não conta como falta; dia pendente fica fora até ser justificado). Pontualidade = entradas antes do horário ou até 5 min depois ÷ dias com entrada. Custo de HE estimado a 50% sobre o salário ÷ 220.
        </div>
      </div>

      {/* cartões importados */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-4 py-2.5 text-sm font-bold" style={{ background: C.panel2, color: C.navy }}>Cartões importados</div>
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub }}>{["Funcionário", "Período", "Dias", "H. extra", "Arquivo", "Importado", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody>{(lista || []).map((x) => (
            <tr key={x.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-3 py-1.5 font-semibold">{x.nome}</td>
              <td className="px-3 py-1.5">{dBR(x.inicio)} a {dBR(x.fim)}</td>
              <td className="px-3 py-1.5">{x.dias}</td>
              <td className="px-3 py-1.5">{horas((x.totais?.extra || 0) + (x.totais?.exced || 0))}</td>
              <td className="px-3 py-1.5"><a href={`/api/rh/ponto?u=${user.id}&arquivo=${x.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ color: C.blue }}><FileText size={12} /> {x.arquivo}</a></td>
              <td className="px-3 py-1.5" style={{ color: C.sub }}>{new Date(x.createdAt).toLocaleString("pt-BR")} · {x.criadoPorNome || "—"}</td>
              <td className="px-3 py-1.5">{podeImportar(user) && <button onClick={() => excluir(x)} title="Excluir (só o master)" style={{ color: C.sub }}><Trash2 size={13} /></button>}</td>
            </tr>
          ))}</tbody>
        </table>
        {lista && !lista.length && <div className="p-6 text-center text-sm" style={{ color: C.sub }}>Nenhum cartão importado ainda.</div>}
      </div>

      {imp && <ImportarPonto user={user} iniciais={imp} onClose={() => setImp(null)} onFim={(m) => { setImp(null); ok(m); }} />}
      {jorn && <JornadasModal user={user} onClose={() => setJorn(false)} onFim={(m) => { setJorn(false); ok(m); }} />}
      {just && <JustificarModal user={user} chaves={just.chaves} motivos={motivos} onClose={() => setJust(null)} onFim={(m) => { setJust(null); setSel(new Set()); ok(m); }} />}
    </div>
  );
}

function ImportarPonto({ user, iniciais, onClose, onFim }) {
  // v168.2 — 1º passo: janela para arrastar/escolher vários PDFs · 2º passo: leitura, crítica e escolha do funcionário
  const [arquivos, setArquivos] = useState([]);      // File[] escolhidos
  const [arqs, setArqs] = useState([]);              // [{ nome, conteudo }] lidos
  const [r, setR] = useState(null);
  const [esc, setEsc] = useState({});   // `${arquivo}#${indice}` → pessoaId
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [arrasto, setArrasto] = useState(0);
  const inp = useRef(null);
  const adicionar = (fs) => {
    const novos = [...(fs || [])];
    const pdfs = novos.filter((f) => /\.pdf$/i.test(f.name));
    setErro(novos.length > pdfs.length ? `${novos.length - pdfs.length} arquivo(s) ignorado(s): só PDF do cartão de ponto.` : "");
    setArquivos((a) => [...a, ...pdfs.filter((f) => !a.some((x) => x.name === f.name && x.size === f.size))]);
  };
  useEffect(() => { if (iniciais?.length) adicionar(iniciais); }, []);
  const ler = async () => {
    setErro(""); setSt(`Lendo ${arquivos.length} arquivo(s)…`);
    try {
      const lista = await Promise.all(arquivos.map(async (f) => ({ nome: f.name, conteudo: await readB64(f) })));
      const itens = []; let pessoas = [];
      for (let i = 0; i < lista.length; i += 8) {          // em lotes, para não pesar a requisição
        setSt(`Lendo os cartões ${Math.min(i + 8, lista.length)}/${lista.length}…`);
        const j = await api("/api/rh/ponto", "POST", { usuarioId: user.id, acao: "analisar", arquivos: lista.slice(i, i + 8) });
        itens.push(...j.itens); pessoas = j.pessoas;
      }
      setArqs(lista);
      setR({ itens, pessoas });
      setEsc(Object.fromEntries(itens.filter((i) => !i.erro).map((i) => [`${i.arquivo}#${i.indice}`, i.pessoaId || ""])));
      setSt("");
    } catch (e) { setSt(""); setErro(e.message); }
  };
  const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const ev = (f) => (e) => { e.preventDefault(); e.stopPropagation(); f(e); };

  if (!r) return (
    <Modal titulo="Importar cartões de ponto" icone={Upload} onClose={onClose} largura={760}
      rodape={<>
        <span className="text-xs mr-auto" style={{ color: C.sub }}>{arquivos.length ? `${arquivos.length} arquivo(s) · ${kb(arquivos.reduce((a, f) => a + f.size, 0))}` : "nenhum arquivo"}</span>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={ler} disabled={!arquivos.length || !!st} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff", opacity: !arquivos.length || st ? 0.5 : 1 }}>
          {st && <Loader2 size={14} className="animate-spin" />} {st || `Ler ${arquivos.length || ""} cartão(ões)`}
        </button>
      </>}>
      <div onDragEnter={ev(() => setArrasto((n) => n + 1))} onDragOver={ev(() => {})} onDragLeave={ev(() => setArrasto((n) => Math.max(0, n - 1)))}
        onDrop={ev((e) => { setArrasto(0); adicionar(e.dataTransfer?.files); })} onClick={() => !st && inp.current?.click()}
        className="rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
        style={{ minHeight: 190, border: `2px dashed ${arrasto ? C.accent : C.line}`, background: arrasto ? C.accentSoft : C.panel2, padding: 24 }}>
        <Upload size={34} style={{ color: C.accent }} />
        <div className="font-semibold mt-2" style={{ color: C.navy }}>Arraste aqui os cartões de ponto</div>
        <div className="text-xs mt-1" style={{ color: C.sub }}>vários PDFs de uma vez (um por funcionário ou um PDF com vários) · ou <span style={{ color: C.accent, fontWeight: 600 }}>clique para escolher</span></div>
        <input ref={inp} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
      </div>
      {erro && <div className="p-2.5 rounded-lg mt-3 text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {arquivos.length > 0 && (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {arquivos.map((f, i) => (
            <div key={f.name + f.size} className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <FileText size={14} style={{ color: C.accent }} className="shrink-0" />
              <span className="flex-1 truncate" style={{ color: C.text }} title={f.name}>{f.name}</span>
              <span style={{ color: C.sub }}>{kb(f.size)}</span>
              {!st && <button onClick={() => setArquivos((a) => a.filter((_, j) => j !== i))} title="Tirar da lista" style={{ color: C.sub }}><X size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
  const validos = (r?.itens || []).filter((i) => !i.erro);
  const prontos = validos.filter((i) => esc[`${i.arquivo}#${i.indice}`]);
  const gravar = async () => {
    setSt("Gravando…"); setErro("");
    try {
      const itens = prontos.map((i) => ({ arquivo: i.arquivo, indice: i.indice, pessoaId: esc[`${i.arquivo}#${i.indice}`] }));
      const j = await api("/api/rh/ponto", "POST", { usuarioId: user.id, acao: "gravar", itens, arquivos: arqs.filter((a) => itens.some((i) => i.arquivo === a.nome)) });
      const okk = j.resultados.filter((x) => !x.erro);
      onFim(`${okk.length} cartão(ões) importado(s): ${okk.map((x) => `${x.nome} (${x.dias} dias${x.semRegistro ? `, ${x.semRegistro} sem registro` : ""})`).join(" · ")}${j.resultados.length - okk.length ? ` · ${j.resultados.length - okk.length} com erro` : ""}.`);
    } catch (e) { setSt(""); setErro(e.message); }
  };
  return (
    <Modal titulo="Importar cartões de ponto" icone={Upload} onClose={onClose} largura={1100}
      rodape={<>
        <button onClick={() => { setR(null); setErro(""); }} disabled={!!st} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.blue }}><Plus size={13} /> adicionar mais arquivos</button>
        <span className="text-xs mr-auto" style={{ color: C.sub }}>{validos.length ? `${prontos.length} de ${validos.length} cartão(ões) com funcionário escolhido` : ""}</span>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={gravar} disabled={!prontos.length || !!st} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff", opacity: !prontos.length || st ? 0.5 : 1 }}>
          {st === "Gravando…" && <Loader2 size={14} className="animate-spin" />} Importar
        </button>
      </>}>
      {st && <div className="flex items-center gap-2 text-sm mb-3" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> {st}</div>}
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="flex flex-col gap-3">
        {(r?.itens || []).map((i) => i.erro ? (
          <div key={i.arquivo} className="rounded-lg p-3 text-sm" style={{ background: C.redSoft, color: C.red }}><b>{i.arquivo}:</b> {i.erro}</div>
        ) : (
          <div key={`${i.arquivo}#${i.indice}`} className="rounded-xl p-3" style={{ border: `1px solid ${C.line}` }}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[260px]">
                <div className="font-bold text-sm" style={{ color: C.navy }}>{i.nome}</div>
                <div className="text-xs" style={{ color: C.sub }}>{i.cargo || "—"} · CPF {i.cpf || "—"} · admissão {dBR(i.admissao)} · {i.empresa || ""}</div>
                <div className="text-xs mt-0.5" style={{ color: C.sub }}>Período {dBR(i.inicio)} a {dBR(i.fim)} · {i.dias} dias · trabalhadas {horas(i.totais?.trab)} · extras {horas(i.he)} · {i.faltas} falta(s)</div>
                <div className="text-[11px] mt-0.5 font-semibold" style={{ color: i.prova === false ? C.red : C.green }}>{i.prova === false ? "Atenção: a soma dos dias não bate com o total do cartão" : i.prova ? "Soma dos dias confere com o total do cartão" : ""}</div>
                {i.jaImportado && <div className="text-[11px] mt-0.5 font-semibold" style={{ color: C.yellow }}>Este cartão já foi importado em {new Date(i.jaImportado.em).toLocaleString("pt-BR")} — importar de novo substitui.</div>}
              </div>
              <div style={{ minWidth: 260 }}>
                <div className="text-xs mb-1" style={{ color: C.sub }}>Funcionário na Matriz {i.por && <span style={{ color: i.duvida ? C.yellow : C.green }}>· achado pelo {i.por.toLowerCase()}{i.duvida ? " (confira)" : ""}</span>}</div>
                <select value={esc[`${i.arquivo}#${i.indice}`] || ""} onChange={(e) => setEsc((s) => ({ ...s, [`${i.arquivo}#${i.indice}`]: e.target.value }))}
                  className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={{ border: `1px solid ${esc[`${i.arquivo}#${i.indice}`] ? C.line : C.red}`, background: "#fff" }}>
                  <option value="">— escolha —</option>
                  {(r?.pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.nomeCompleto ? ` · ${p.nomeCompleto}` : ""} ({p.empresa})</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2 rounded-lg p-2 text-xs" style={{ background: i.critica.length ? C.redSoft : C.greenSoft }}>
              {!i.critica.length ? <span style={{ color: C.green }} className="flex items-center gap-1"><CheckCircle2 size={13} /> Nenhum dia sem registro no período.</span> : <>
                <div className="font-semibold mb-1" style={{ color: C.red }}>Crítica: {i.critica.length} dia(s) sem ponto registrado — depois de importar, justifique em Ponto (troca de sistema, ponto manual…)</div>
                <div className="flex flex-wrap gap-1">{i.critica.slice(0, 40).map((c) => <span key={c.data} className="px-1.5 py-0.5 rounded" style={{ background: "#fff", color: C.text }} title={c.detalhe}>{dBR(c.data)} · {c.tipo}</span>)}{i.critica.length > 40 && <span style={{ color: C.sub }}>+{i.critica.length - 40}</span>}</div>
              </>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function JustificarModal({ user, chaves, motivos, onClose, onFim }) {
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [st, setSt] = useState(false);
  const salvar = async () => {
    setSt(true); setErro("");
    try { const r = await api("/api/rh/ponto", "POST", { usuarioId: user.id, acao: "justificar", chaves, motivo, texto }); onFim(`${r.n} pendência(s) justificada(s) como ${motivo}.`); }
    catch (e) { setSt(false); setErro(e.message); }
  };
  return (
    <Modal titulo={`Justificar ${chaves.length} pendência(s)`} icone={ShieldAlert} onClose={onClose} largura={520}
      rodape={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={salvar} disabled={!motivo || st || (motivo === "OUTRO" && !texto.trim())} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: !motivo || st ? 0.5 : 1 }}>Justificar</button>
      </>}>
      <div className="text-xs mb-2" style={{ color: C.sub }}>Motivo</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {motivos.map((m) => (
          <button key={m} onClick={() => setMotivo(m)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={motivo === m ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}>{m}</button>
        ))}
      </div>
      <div className="text-[11px] mb-3" style={{ color: C.sub }}>
        Troca de sistema e ponto manual contam como dia trabalhado · atestado não conta como falta · falta entra na assiduidade.
      </div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Observação {motivo === "OUTRO" ? "(obrigatória)" : "(opcional)"}</div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}` }} placeholder="Ex.: ponto manual assinado pelo supervisor, arquivado no RH" />
      {erro && <div className="text-sm mt-2" style={{ color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* ---------- jornadas de trabalho por período (entrada prevista da pontualidade) ---------- */
function JornadasModal({ user, onClose, onFim }) {
  const [j, setJ] = useState(null);
  const [pessoas, setPessoas] = useState([]);
  const [erro, setErro] = useState("");
  useEffect(() => { api(`/api/rh/ponto?u=${user.id}&acao=jornadas`).then((r) => { setJ(r.jornadas); setPessoas(r.pessoas || []); }).catch((e) => setErro(e.message)); }, []);
  const alt = (lista, i, k, v) => setJ((x) => ({ ...x, [lista]: x[lista].map((y, n) => (n === i ? { ...y, [k]: v } : y)) }));
  const tira = (lista, i) => setJ((x) => ({ ...x, [lista]: x[lista].filter((_, n) => n !== i) }));
  const salvar = async () => { try { await api("/api/rh/ponto", "POST", { usuarioId: user.id, acao: "jornadas", jornadas: j }); onFim("Jornadas salvas: assiduidade e pontualidade recalculadas com o horário de cada período."); } catch (e) { setErro(e.message); } };
  const inpt = "rounded px-2 py-1 text-xs outline-none";
  const st = { border: `1px solid ${C.line}` };
  const linhas = (lista, pessoa) => (j[lista] || []).map((x, i) => (
    <div key={i} className="flex flex-wrap items-center gap-2 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
      {pessoa && <select value={x.pessoaId} onChange={(e) => { const p = pessoas.find((y) => y.id === e.target.value); alt(lista, i, "pessoaId", e.target.value); alt(lista, i, "nome", p?.nome || ""); }} className={inpt} style={{ ...st, minWidth: 170 }}>
        <option value="">— funcionário —</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
      <span className="text-xs" style={{ color: C.sub }}>de</span><input type="date" value={x.de || ""} onChange={(e) => alt(lista, i, "de", e.target.value || null)} className={inpt} style={st} />
      <span className="text-xs" style={{ color: C.sub }}>até</span><input type="date" value={x.ate || ""} onChange={(e) => alt(lista, i, "ate", e.target.value || null)} className={inpt} style={st} />
      <span className="text-xs" style={{ color: C.sub }}>entrada</span><input type="time" value={x.entrada || ""} onChange={(e) => alt(lista, i, "entrada", e.target.value)} className={inpt} style={st} />
      <span className="text-xs" style={{ color: C.sub }}>saída</span><input type="time" value={x.saida || ""} onChange={(e) => alt(lista, i, "saida", e.target.value)} className={inpt} style={st} />
      <button onClick={() => tira(lista, i)} style={{ color: C.sub }}><Trash2 size={13} /></button>
    </div>
  ));
  return (
    <Modal titulo="Jornadas de trabalho" icone={Clock} onClose={onClose} largura={780}
      rodape={<>
        {erro && <span className="text-xs mr-auto" style={{ color: C.red }}>{erro}</span>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={salvar} disabled={!j} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
      </>}>
      {!j && !erro && <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />}
      {j && <>
        <div className="text-xs mb-3" style={{ color: C.sub }}>O cartão de ponto traz um horário só. Aqui fica o horário de cada período (segunda a sexta) — é dele que sai a entrada prevista da pontualidade. Datas em branco = sem limite.</div>
        <div className="text-sm font-bold mb-1" style={{ color: C.navy }}>Jornada geral (todos)</div>
        {linhas("geral")}
        <button onClick={() => setJ((x) => ({ ...x, geral: [...x.geral, { de: null, ate: null, entrada: "08:00", saida: "18:00" }] }))} className="text-xs font-semibold flex items-center gap-1 mt-1 mb-4" style={{ color: C.accent }}><Plus size={13} /> período</button>
        <div className="text-sm font-bold mb-1" style={{ color: C.navy }}>Exceções por funcionário <span className="text-xs font-normal" style={{ color: C.sub }}>(têm prioridade sobre a geral)</span></div>
        {linhas("excecoes", true)}
        <button onClick={() => setJ((x) => ({ ...x, excecoes: [...x.excecoes, { pessoaId: "", nome: "", de: null, ate: null, entrada: "08:00", saida: "18:00" }] }))} className="text-xs font-semibold flex items-center gap-1 mt-1" style={{ color: C.accent }}><Plus size={13} /> exceção</button>
      </>}
    </Modal>
  );
}
