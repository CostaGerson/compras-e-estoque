"use client";
// v785 — Reunião mensal de gestão: apresentação interativa no padrão da apresentação mensal (PDF de agosto/2026).
//   Uma reunião por mês, ligada à tarefa recorrente "REUNIÃO DE GESTÃO · MM/AAAA": as pautas da tarefa ficam na lateral
//   e podem ser incluídas aqui ou na tarefa (é o mesmo registro). A reunião de um mês apresenta os números do mês anterior,
//   lidos na hora do sistema (KPIs, análises de corte/expedição, endividamento, DRE, fluxo e painel). Textos e observações
//   são editados direto na tela e ficam salvos na reunião.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, Plus, Loader2, Landmark, Eye, EyeOff, ExternalLink } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { Acervo } from "./acervo";

const N = "#001E41", L = "#FF6B1A", AZ = "#2E5C9A", CZ = "#667085", LN = "#E4E7EC", VD = "#12A150", VM = "#D92D20";
const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const M3 = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const brl = (v, d = 2) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: d, maximumFractionDigits: d }));
const mi = (v) => (v == null ? "—" : Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M` : brl(v, 0));
const pct = (v, d = 2) => (v == null || !isFinite(v) ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const W = 1280, H = 720;

async function j(url) { const r = await fetch(url, { cache: "no-store" }); const x = await r.json().catch(() => ({})); if (!r.ok || x.error) throw new Error(x.error || `Erro ${r.status}`); return x; }

export default function ReuniaoGestao({ user, irMatriz, mesInicial }) {
  const [aba, setAba] = useState("apresentacao");
  return (
    <div>
      <div className="flex gap-1 mb-3" style={{ borderBottom: `1px solid ${LN}` }}>
        {[["apresentacao", "Reunião do mês"], ["atas", "Atas e materiais"]].map(([k, t]) => (
          <button key={k} onClick={() => setAba(k)} className="px-4 py-2 text-sm font-semibold" style={{ color: aba === k ? L : CZ, borderBottom: aba === k ? `2px solid ${L}` : "2px solid transparent", marginBottom: -1 }}>{t}</button>))}
      </div>
      {aba === "apresentacao" ? <Reuniao user={user} irMatriz={irMatriz} mesInicial={mesInicial} /> : <Acervo user={user} area="REUNIAO" />}
    </div>
  );
}

function Reuniao({ user, irMatriz, mesInicial }) {
  const [mes, setMes] = useState(mesInicial || null);
  const [R, setR] = useState(null);
  const [erro, setErro] = useState("");
  const [D, setD] = useState(null);
  const [i, setI] = useState(0);
  const [tela, setTela] = useState(false);
  const textos = useRef({});
  const pend = useRef({}), timer = useRef(null);
  const ler = (m) => { setR(null); setErro(""); j(`/api/reuniao?u=${user.id}${m ? `&mes=${m}` : ""}`).then((x) => { setR(x); textos.current = { ...(x.apresentacao?.textos || {}) }; if (!m) setMes(x.mes); }).catch((e) => setErro(e.message)); };
  useEffect(() => { ler(mes); }, [mes]);
  // dados do mês de referência (todos em paralelo; o que falhar fica vazio no slide)
  useEffect(() => {
    if (!R) return;
    setD(null);
    const [ra, rm] = R.ref.split("-").map(Number);
    const u = user.id, s = (p) => j(p).catch((e) => ({ _erro: e.message }));
    Promise.all([
      s(`/api/kpi?u=${u}&ano=${ra}`), s(`/api/kpi/clientes?u=${u}&ano=${ra}&mes=${rm}&kpi=faturamentoValor`), s(`/api/fin/dre?u=${u}&competencia=${R.ref}`),
      s(`/api/fin/alavancagem?u=${u}`), s(`/api/fin/painel?u=${u}&competencia=${R.mes}`), s(`/api/producao/analises?u=${u}&setor=CORTE&competencia=${R.ref}`),
      s(`/api/producao/analises?u=${u}&setor=EXPEDICAO&competencia=${R.ref}`), s(`/api/fin/lancamentos?u=${u}&competencia=${R.ref}`),
    ]).then(([kpi, cli, dre, alav, painel, corte, exp, lanc]) => setD({ kpi, cli, dre, alav, painel, corte, exp, lanc, ra, rm }));
  }, [R?.ref]);
  const salvar = (k, v) => {
    textos.current[k] = v; pend.current[k] = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const t = pend.current; pend.current = {};
      try { await fetch("/api/reuniao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, tarefaId: R.tarefa.id, textos: t }) }); } catch (e) { alerta(`Não salvou o texto: ${e.message}`); }
    }, 800);
  };
  const ctx = { D, R, txt: (k) => textos.current[k], salvar, editavel: !tela, irMatriz };
  const slides = useMemo(() => (R ? montarSlides(R) : []), [R]);
  useEffect(() => {
    const f = (e) => { if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT") return; if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(slides.length - 1, x + 1)); if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1)); if (e.key === "Escape") setTela(false); };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, [slides.length]);

  if (erro) return <div className="text-sm" style={{ color: VM }}>{erro}</div>;
  if (!R) return <Loader2 size={18} className="animate-spin" style={{ color: CZ }} />;
  const [ra, rm] = R.ref.split("-").map(Number);
  const S = slides[i];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Landmark size={18} style={{ color: N }} />
        <div className="text-base font-bold" style={{ color: N }}>{R.tarefa.titulo}</div>
        <span className="text-xs" style={{ color: CZ }}>· {dBR(R.dataReuniao)} {R.tarefa.hora || ""} · apresenta os números de <b>{MESES[rm - 1].toLowerCase()}/{ra}</b></span>
        <div className="flex-1" />
        <select value={R.mes} onChange={(e) => setMes(e.target.value)} className="px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${LN}` }}>
          {[...new Set([R.mes, ...R.meses, ...proximosMeses()])].sort().reverse().map((m) => <option key={m} value={m}>Reunião {m.slice(5)}/{m.slice(0, 4)}</option>)}
        </select>
        <button onClick={() => setTela(true)} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold" style={{ background: N, color: "#fff" }}><Maximize2 size={14} /> Apresentar</button>
      </div>
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <Palco>{S && <S.C {...ctx} />}</Palco>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => setI((x) => Math.max(0, x - 1))} className="p-1.5 rounded" style={{ border: `1px solid ${LN}` }}><ChevronLeft size={16} /></button>
            <span className="text-xs" style={{ color: CZ }}>{i + 1} / {slides.length} · {S?.t}</span>
            <button onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))} className="p-1.5 rounded" style={{ border: `1px solid ${LN}` }}><ChevronRight size={16} /></button>
            {!D && <span className="text-xs flex items-center gap-1" style={{ color: CZ }}><Loader2 size={12} className="animate-spin" /> lendo os números…</span>}
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
            {slides.map((x, k) => (
              <button key={k} onClick={() => setI(k)} className="shrink-0 rounded text-left px-2 py-1.5 text-[10px] font-semibold" style={{ width: 120, height: 54, background: k === i ? N : "#fff", color: k === i ? "#fff" : N, border: `1px solid ${k === i ? N : LN}` }}>
                <div style={{ color: k === i ? "#FFB27A" : L }}>{x.g}</div>{x.t}</button>))}
          </div>
        </div>
        <Pautas user={user} R={R} onMudou={() => ler(R.mes)} />
      </div>
      {tela && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "#000" }} onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}>
          <div style={{ width: "100vw", maxWidth: "calc(100vh * 16 / 9)" }}><Palco>{S && <S.C {...ctx} editavel={false} />}</Palco></div>
          <button onClick={(e) => { e.stopPropagation(); setTela(false); }} className="absolute top-3 right-3 p-2 rounded-full" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}><X size={18} /></button>
          <div className="absolute bottom-3 right-4 text-xs" style={{ color: "rgba(255,255,255,.6)" }}>{i + 1} / {slides.length} · ← → para navegar · Esc para sair</div>
        </div>
      )}
    </div>
  );
}
const proximosMeses = () => { const h = new Date(); return [0, 1].map((k) => { const d = new Date(Date.UTC(h.getFullYear(), h.getMonth() + k, 1)); return d.toISOString().slice(0, 7); }); };

// palco 16:9 — o slide é desenhado em 1280×720 e escalado para a largura disponível
function Palco({ children }) {
  const ref = useRef(null);
  const [esc, setEsc] = useState(0.5);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setEsc(el.clientWidth / W)); ro.observe(el); return () => ro.disconnect(); }, []);
  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-lg shadow" style={{ aspectRatio: "16 / 9", background: "#fff" }}>
      <div style={{ width: W, height: H, transform: `scale(${esc})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0, fontFamily: "Montserrat, system-ui, sans-serif", color: "#1F2733" }}>{children}</div>
    </div>
  );
}

// pautas da tarefa (mesmo registro da agenda: incluir aqui aparece lá e vice-versa)
function Pautas({ user, R, onMudou }) {
  const [txt, setTxt] = useState("");
  const P = R.tarefa.pautas || [];
  const acao = async (a, extra) => {
    const r = await fetch(`/api/tarefas/${R.tarefa.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: a, ...extra }) });
    const x = await r.json().catch(() => ({})); if (!r.ok || x.error) return alerta(x.error || "Erro."); onMudou();
  };
  const COR = { FIXA: N, DECISAO: L, MANUAL: AZ };
  return (
    <div className="shrink-0 rounded-lg p-3" style={{ width: 280, background: "#fff", border: `1px solid ${LN}` }}>
      <div className="text-sm font-bold mb-1" style={{ color: N }}>Pautas ({P.length})</div>
      <div className="text-[11px] mb-2" style={{ color: CZ }}>As mesmas da tarefa da reunião na agenda.</div>
      <ol className="space-y-1.5 mb-3">
        {P.map((p, k) => (
          <li key={p.id} className="flex gap-2 text-xs items-start">
            <span className="font-bold shrink-0" style={{ color: COR[p.origem] || N }}>{k + 1}.</span>
            <span className="flex-1">{p.texto}{p.autor && p.origem !== "FIXA" ? <span style={{ color: CZ }}> · {p.autor}</span> : null}</span>
            {p.origem !== "FIXA" && <button onClick={async () => (await confirmar("Tirar esta pauta?")) && acao("tirarPauta", { pautaId: p.id })} style={{ color: CZ }}><X size={12} /></button>}
          </li>))}
      </ol>
      <div className="flex gap-1">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && txt.trim()) { await acao("pauta", { texto: txt }); setTxt(""); } }} placeholder="Nova pauta…" className="flex-1 rounded px-2 py-1.5 text-xs outline-none" style={{ border: `1px solid ${LN}` }} />
        <button disabled={!txt.trim()} onClick={async () => { await acao("pauta", { texto: txt }); setTxt(""); }} className="px-2 rounded text-xs font-semibold" style={{ background: N, color: "#fff", opacity: txt.trim() ? 1 : 0.5 }}><Plus size={12} /></button>
      </div>
    </div>
  );
}

/* ---------------- peças dos slides ---------------- */
function Cab({ g, t, escuro }) {
  return (
    <div style={{ position: "absolute", left: 40, top: 26, right: 40, display: "flex", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 26, color: escuro ? "#fff" : AZ, letterSpacing: 0.5 }}>{g}</div>
        <div style={{ fontWeight: 700, fontSize: 17, color: escuro ? "#FFB27A" : N, marginTop: 2 }}>{t}</div>
      </div>
      <img src="/meridian-wordmark.svg" alt="" style={{ height: 22, opacity: escuro ? 0 : 0.9 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    </div>
  );
}
// texto editável direto no slide (salvo na reunião)
function Txt({ k, txt, salvar, editavel, ph, style, linhas = 4, padrao = "" }) {
  const [v, setV] = useState(txt(k) ?? padrao);
  useEffect(() => { setV(txt(k) ?? padrao); }, [k]);
  const base = { width: "100%", resize: "none", border: editavel ? `1px dashed ${LN}` : "1px solid transparent", borderRadius: 6, padding: "6px 8px", fontSize: 14, lineHeight: 1.45, background: editavel ? "#FAFBFC" : "transparent", outline: "none", fontFamily: "inherit", color: "#1F2733", whiteSpace: "pre-wrap", ...style };
  if (!editavel) return <div style={{ ...base, minHeight: 0 }}>{v || ""}</div>;
  return <textarea value={v} placeholder={ph} rows={linhas} onChange={(e) => { setV(e.target.value); salvar(k, e.target.value); }} style={base} />;
}
const Obs = (p) => (
  <div style={{ position: "absolute", left: 40, right: 40, bottom: 18 }}>
    <Txt {...p} k={`${p.chave}.obs`} ph="Observações deste slide (aparecem na apresentação)…" linhas={2} style={{ fontSize: 13 }} />
  </div>
);
function Tab({ cols, linhas, rodape, larg, fs = 12 }) {
  return (
    <table style={{ borderCollapse: "collapse", width: larg || "100%", fontSize: fs }}>
      <thead><tr>{cols.map((c, k) => <th key={k} style={{ background: c.cor || N, color: "#fff", padding: "5px 8px", textAlign: c.r ? "right" : "left", fontWeight: 700, whiteSpace: "nowrap" }}>{c.t}</th>)}</tr></thead>
      <tbody>{linhas.map((l, k) => <tr key={k} style={{ background: l._cor || (k % 2 ? "#F7F8FA" : "#fff") }}>{l.c.map((v, q) => <td key={q} style={{ padding: "3px 8px", borderBottom: `1px solid ${LN}`, textAlign: cols[q]?.r ? "right" : "left", fontWeight: l._b ? 700 : 400, whiteSpace: "nowrap", color: l._fg?.[q] || undefined }}>{v}</td>)}</tr>)}</tbody>
      {rodape && <tfoot>{rodape.map((l, k) => <tr key={k} style={{ background: "#EEF3FB", fontWeight: 700 }}>{l.map((v, q) => <td key={q} style={{ padding: "4px 8px", textAlign: cols[q]?.r ? "right" : "left", whiteSpace: "nowrap" }}>{v}</td>)}</tr>)}</tfoot>}
    </table>
  );
}
const Caixa = ({ t, v, cor = L, sub }) => (
  <div style={{ border: `2px solid ${N}`, borderRadius: 4, overflow: "hidden", minWidth: 170 }}>
    <div style={{ background: cor, color: "#fff", fontWeight: 800, fontSize: 13, padding: "4px 10px", textAlign: "center" }}>{t}</div>
    <div style={{ padding: "10px", textAlign: "center", fontWeight: 800, fontSize: 18, color: N }}>{v}{sub && <div style={{ fontSize: 11, fontWeight: 600, color: CZ }}>{sub}</div>}</div>
  </div>
);
const Sem = ({ x, msg }) => (!x ? <Carregando /> : x._erro ? <div style={{ position: "absolute", left: 40, top: 120, color: VM, fontSize: 15 }}>{msg || "Sem dados"}: {x._erro}</div> : null);
const Carregando = () => <div style={{ position: "absolute", left: 40, top: 120, color: CZ, fontSize: 15 }}>Lendo os números…</div>;

function Barras({ series, rotulos, alt = 360, larg = 1180, cores = [AZ, L], nomes }) {
  const max = Math.max(1, ...series.flat().map((v) => Math.abs(v || 0)));
  const n = rotulos.length, gw = (larg - 60) / n, bw = Math.min(26, (gw - 10) / series.length);
  return (
    <svg width={larg} height={alt + 60}>
      {nomes && nomes.map((nm, s) => <g key={s}><rect x={60 + s * 130} y={0} width={12} height={12} fill={cores[s]} /><text x={76 + s * 130} y={11} fontSize={12} fill={CZ}>{nm}</text></g>)}
      {rotulos.map((r, k) => (
        <g key={k}>
          {series.map((sr, s) => { const v = sr[k] || 0; const h = (Math.abs(v) / max) * (alt - 40); const x = 60 + k * gw + (gw - bw * series.length) / 2 + s * bw; return <g key={s}><rect x={x} y={alt - h + 20} width={bw - 2} height={h} fill={cores[s]} rx={2} />{v ? <text x={x + bw / 2} y={alt - h + 14} fontSize={9} textAnchor="middle" fill={CZ}>{Math.round(v / 1000)}k</text> : null}</g>; })}
          <text x={60 + k * gw + gw / 2} y={alt + 40} fontSize={12} textAnchor="middle" fill={N} fontWeight={600}>{r}</text>
        </g>))}
      <line x1={55} x2={larg} y1={alt + 20} y2={alt + 20} stroke={LN} />
    </svg>
  );
}

/* ---------------- slides ---------------- */
function montarSlides(R) {
  const [ra, rm] = R.ref.split("-").map(Number);
  const MES = MESES[rm - 1];
  const sl = [];
  const add = (g, t, C) => sl.push({ g, t, C });
  add("MERIDIAN", "Capa", () => (
    <div style={{ position: "absolute", inset: 0, background: N, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 90 }} />
      <div style={{ color: "#fff", letterSpacing: 6, fontSize: 18, marginTop: 120 }}>{MES} · {ra}</div>
    </div>));
  add("PESSOAS E PROCESSOS", "Contratações × demissões", (p) => (
    <>
      <Cab g="PESSOAS E PROCESSOS" t="CONTRATAÇÕES X DEMISSÕES" />
      <div style={{ position: "absolute", left: 40, right: 40, top: 100 }}>
        <Txt {...p} k="pp.contratacoes" ph="Admissões, demissões, contratações em andamento, freelancers…" linhas={8} />
        <div style={{ fontWeight: 700, fontSize: 17, color: N, margin: "14px 0 4px" }}>CLIMA ORGANIZACIONAL</div>
        <Txt {...p} k="pp.clima" ph="Clima organizacional no período…" linhas={3} />
        <div style={{ fontWeight: 700, fontSize: 17, color: N, margin: "14px 0 4px" }}>MELHORIAS E OUTROS</div>
        <Txt {...p} k="pp.melhorias" ph="Melhorias de processo, implantações, pendências…" linhas={5} />
      </div>
    </>));
  add("PESSOAS E PROCESSOS", "Tema livre", (p) => (
    <>
      <div style={{ position: "absolute", left: 40, top: 26, right: 40 }}>
        <div style={{ fontWeight: 800, fontSize: 26, color: AZ }}>PESSOAS E PROCESSOS</div>
        <Txt {...p} k="pp.tema.titulo" ph="TÍTULO (ex.: FRENTE DE RECRUTAMENTO OPERACIONAL)" linhas={1} style={{ fontWeight: 700, fontSize: 17, color: N, padding: "2px 6px" }} />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 120 }}><Txt {...p} k="pp.tema.texto" ph="Texto do tema…" linhas={18} style={{ fontSize: 16 }} /></div>
    </>));
  for (const [setor, nome] of [["corte", "ANALISE CORTE"], ["exp", "ANALISE EXPEDIÇÃO"]]) add("PESSOAS E PROCESSOS", nome.toLowerCase().replace("analise", "Análise"), (p) => {
    const x = p.D?.[setor];
    const c = x?.calc, a = x?.analise;
    return (
      <>
        <Cab g="PESSOAS E PROCESSOS" t={nome} />
        {!p.D || !x || x._erro ? <Sem x={p.D ? x : null} /> : !a ? <div style={{ position: "absolute", left: 40, top: 120, color: CZ }}>Análise de {nome.toLowerCase().slice(8)} de {MES.toLowerCase()} ainda não lançada (Produção › Análises operacionais).</div> : (
          <div style={{ position: "absolute", left: 40, right: 40, top: 96, display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <Tab cols={[{ t: "PEÇA" }, { t: "QTD", r: 1 }, { t: "CONCENTRAÇÃO", r: 1 }, { t: "MERCADO", r: 1 }, { t: "VALOR INTERNO", r: 1 }]}
                linhas={(c.categorias || []).filter((k) => k.qtd).map((k) => ({ c: [k.n, num(k.qtd), pct(k.concentracao, 0), brl(k.mercado), brl(k.valorInterno)] }))}
                rodape={[["TOTAL", num(c.pecas), "100%", "", ""]]} />
              <div style={{ fontSize: 12, color: CZ, marginTop: 8 }}>Histórico: {(x.serie || []).map((s) => `${s.competencia.slice(5)}/${s.competencia.slice(2, 4)} ${brl(s.incorrido)}/pç`).join(" · ")}</div>
            </div>
            <div style={{ width: 330, display: "flex", flexDirection: "column", gap: 10 }}>
              <Tab cols={[{ t: "CUSTO INTERNO" }, { t: "", r: 1 }]} linhas={[
                { c: ["Pessoal", brl(c.pessoal)] }, { c: ["Freelancer", brl(c.freelancer)] }, { c: ["Insumo", brl(c.insumo)] }, { c: ["Custo total", brl(c.custoTotal)], _b: 1 },
                { c: ["Peças processadas", num(c.pecas)] }, { c: ["Custo incorrido / pç", brl(c.incorrido)], _b: 1 }, { c: ["Estimado / pç", brl(c.estimado)] },
                { c: ["Terceirizado / pç", brl(c.mediaTerc)] }, { c: ["Resultado", pct(c.resultado, 0)], _fg: [null, c.resultado > 1 ? VM : VD] },
                { c: ["Impacto no resultado", brl(c.impacto)], _fg: [null, c.impacto < 0 ? VM : VD], _b: 1 }]} />
              {a.causas && <div style={{ fontSize: 12 }}><b style={{ color: N }}>Causas:</b> {a.causas}</div>}
              {a.providencias && <div style={{ fontSize: 12 }}><b style={{ color: N }}>Providências:</b> {a.providencias}</div>}
            </div>
          </div>)}
        <Obs {...p} chave={setor} />
      </>
    );
  });
  // KPIs
  const kpiSlide = (tipo, titulo) => (p) => {
    const k = p.D?.kpi;
    if (!p.D || !k || k._erro) return <><Cab g="KPIS" t={titulo} /><Sem x={p.D ? k : null} /></>;
    const ls = k.linhas || [];
    const ate = (m) => m <= rm;
    const ant = ra - 1;
    let cols, linhas, rod, metaTot, gap;
    if (tipo === "vendas") {
      cols = [{ t: "Mês" }, { t: String(ant), r: 1 }, { t: String(ra), r: 1 }, { t: "MoM", r: 1 }, { t: "Acumulado", r: 1 }, { t: "Meta", r: 1 }, { t: "Peças", r: 1 }];
      linhas = ls.map((l) => ({ c: [M3[l.mes - 1], brl(l.vendas?.anterior), ate(l.mes) ? brl(l.vendas?.atual) : "", ate(l.mes) ? pct(l.vendas?.mom) : "", ate(l.mes) ? pct(l.vendas?.acumulado) : "", brl(l.metaVendasValor), ate(l.mes) ? num(l.vendas?.pecas) : ""], _b: l.mes === rm }));
      rod = [["TOTAL", brl(ls.reduce((s, l) => s + (l.vendas?.anterior || 0), 0)), brl(k.totais?.vendas), "", "", brl(k.metas?.vendas), ""], ["MÉDIA MENSAL", "", brl(k.mediaMensal?.vendas), "", "", "", ""]];
      metaTot = k.metas?.vendas; gap = k.gap?.vendas;
    } else if (tipo === "fat") {
      cols = [{ t: "Mês" }, { t: String(ant), r: 1 }, { t: String(ra), r: 1 }, { t: "Meta (R$)", r: 1 }, { t: "Meta (pç)", r: 1 }, { t: "MoM", r: 1 }, { t: "Acumulado", r: 1 }, { t: "Peças fat.", r: 1 }];
      linhas = ls.map((l) => ({ c: [M3[l.mes - 1], brl(l.faturamento?.anterior), ate(l.mes) ? brl(l.faturamento?.atual) : "", brl(l.faturamento?.metaValor), num(l.faturamento?.metaPecas), ate(l.mes) ? pct(l.faturamento?.mom) : "", ate(l.mes) ? pct(l.faturamento?.acumulado) : "", ate(l.mes) ? num(l.faturamento?.pecas) : ""], _b: l.mes === rm }));
      rod = [["TOTAL", brl(ls.reduce((s, l) => s + (l.faturamento?.anterior || 0), 0)), brl(k.totais?.faturamento), brl(k.metas?.faturamento), "", "", "", num(k.totais?.pecasFaturadas)], ["MÉDIA MENSAL", "", brl(k.mediaMensal?.faturamento), "", "", "", "", num(Math.round(k.mediaMensal?.pecasFaturadas || 0))], ["TICKET MÉDIO", "", brl(k.ticketMedio), "", "", "", "", ""]];
      metaTot = k.metas?.faturamento; gap = k.gap?.faturamento;
    } else {
      const segs = k.segmentos || [];
      cols = [{ t: "Mês" }, ...segs.map((s) => ({ t: s, r: 1 })), { t: String(ra), r: 1 }, { t: String(ant), r: 1 }, { t: "PoP", r: 1 }, { t: "Meta", r: 1 }];
      linhas = ls.map((l) => ({ c: [M3[l.mes - 1], ...segs.map((s) => (ate(l.mes) ? brl(l.receita?.segmentos?.[s] || 0) : "")), ate(l.mes) ? brl(l.receita?.total) : "", brl(l.receita?.anterior), ate(l.mes) ? pct(l.receita?.pop) : "", brl(l.metaReceitaValor)], _b: l.mes === rm }));
      rod = [["TOTAL", ...segs.map(() => ""), brl(k.totais?.receita), "", "", brl(k.metas?.receita)]];
      metaTot = k.metas?.receita; gap = k.gap?.receita;
    }
    return (
      <>
        <Cab g="KPIS" t={titulo} />
        <div style={{ position: "absolute", left: 40, top: 96, right: 250 }}><Tab cols={cols} linhas={linhas} rodape={rod} fs={tipo === "rec" ? 11 : 12} /></div>
        <div style={{ position: "absolute", right: 40, top: 96, width: 190, display: "flex", flexDirection: "column", gap: 12 }}>
          <Caixa t="META" v={brl(metaTot, 0)} /><Caixa t="GAP" v={brl(gap?.gap, 0)} cor={N} /><Caixa t="MTG" v={brl(gap?.mtg, 0)} sub="média mensal necessária" />
        </div>
        <Obs {...p} chave={`kpi.${tipo}`} />
      </>
    );
  };
  add("KPIS", "Vendas", kpiSlide("vendas", "VENDAS"));
  add("KPIS", "Faturamento", kpiSlide("fat", "FATURAMENTO"));
  add("KPIS", "Receita", kpiSlide("rec", "RECEITA"));
  // endividamento
  const div = (grupos, titulo, chave) => (p) => {
    const a = p.D?.alav;
    if (!p.D || !a || a._erro) return <><Cab g="KPIS" t={titulo} /><Sem x={p.D ? a : null} /></>;
    const gs = (a.grupos || []).filter((g) => grupos.includes(g.grupo));
    const itens = gs.flatMap((g) => g.itens || []);
    const total = gs.reduce((s, g) => s + (g.compromisso || 0), 0);
    return (
      <>
        <Cab g="KPIS" t={titulo} />
        <div style={{ position: "absolute", right: 40, top: 22 }}><Caixa t="ALAVANCAGEM TOTAL" v={brl(a.totais?.alavancagem)} /></div>
        <div style={{ position: "absolute", left: 40, right: 260, top: 120, display: "flex", flexWrap: "wrap", gap: 10, alignContent: "flex-start" }}>
          {itens.map((c) => (
            <div key={c.id} style={{ width: itens.length > 8 ? 205 : 250, border: `1px solid ${LN}`, fontSize: 10.5 }}>
              <div style={{ background: N, color: "#fff", fontWeight: 700, padding: "3px 6px", fontSize: 11 }}>{c.nome}</div>
              {[["Capital contratado", brl(c.capital)], ["Contratado em", dBR(c.inicio)], ["Taxa contratada (a.m.)", c.taxaMensal != null ? `${String(c.taxaMensal).replace(".", ",")}%` : "—"], ["Parcela mensal", brl(c.parcela ?? c.mensal)], ["Prazo", c.prazoMeses ? `${c.prazoMeses} meses` : "—"], ["Débito total", brl(c.debitoTotal)], ["Já pago", c.parcelasPagas != null ? `${c.parcelasPagas} parcelas` : "—"], ["A vencer", brl(c.aVencer ?? c.saldoCapital)], ["Pagar até", dBR(c.pagarAte)]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "1px 6px", borderTop: `1px solid ${LN}` }}><span style={{ color: CZ }}>{l}</span><b>{v}</b></div>))}
            </div>))}
          {!itens.length && <div style={{ color: CZ }}>Nenhum contrato neste grupo.</div>}
        </div>
        <div style={{ position: "absolute", right: 40, top: 130 }}><Caixa t={`TOTAL ${titulo.split(" - ")[1] || ""}`} v={brl(total)} cor={N} /></div>
        <Obs {...p} chave={chave} />
      </>
    );
  };
  add("KPIS", "Endividamento LP", div(["GIRO_LP"], "ENDIVIDAMENTO - LP", "div.lp"));
  add("KPIS", "Mútuos CP", div(["MUTUO_GIRO", "ARREMATE_W3"], "ENDIVIDAMENTO - MUTUOS CP", "div.mutuo"));
  add("KPIS", "Investimento", div(["INVESTIMENTO"], "ENDIVIDAMENTO - INVESTIMENTO", "div.inv"));
  add("KPIS", "Tributário", (p) => {
    const a = p.D?.alav;
    if (!p.D || !a || a._erro) return <><Cab g="KPIS" t="ENDIVIDAMENTO - TRIBUTÁRIO" /><Sem x={p.D ? a : null} /></>;
    return (
      <>
        <Cab g="KPIS" t="ENDIVIDAMENTO - TRIBUTÁRIO" />
        <div style={{ position: "absolute", right: 40, top: 22 }}><Caixa t="ALAVANCAGEM TOTAL" v={brl(a.totais?.alavancagem)} /></div>
        <div style={{ position: "absolute", left: 40, right: 260, top: 120, display: "flex", flexDirection: "column", gap: 14 }}>
          {(a.tributos || []).map((g) => (
            <div key={g.grupo} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}><Tab cols={[{ t: g.label }, { t: "Saldo", r: 1 }, { t: "Parcela", r: 1 }, { t: "Situação" }]}
                linhas={(g.itens || []).map((i) => ({ c: [i.descricao, brl(i.calculo?.saldo ?? i.valor), i.parcelaMensal ? brl(i.parcelaMensal) : "—", i.parcelado ? `parcelado · ${i.calculo?.parcelasRestantes ?? "?"} restantes` : i.exigivel ? "exigível" : "não exigível"] }))} /></div>
              <Caixa t="TOTAL" v={brl(g.total)} cor={N} />
            </div>))}
        </div>
        <div style={{ position: "absolute", right: 40, top: 130 }}><Caixa t="TOTAL IMPOSTOS" v={brl(a.totais?.tributos)} cor={N} /></div>
        <Obs {...p} chave="div.trib" />
      </>
    );
  });
  // comercial
  add("RELATÓRIO COMERCIAL", "Performance de vendas", () => (
    <div style={{ position: "absolute", inset: 0, background: N, padding: 60 }}>
      <img src="/meridian-logo.svg" alt="" style={{ height: 40, margin: "60px auto 0", display: "block" }} />
      <div style={{ color: L, letterSpacing: 4, fontWeight: 700, fontSize: 14, marginTop: 120 }}>RELATÓRIO COMERCIAL</div>
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 40, marginTop: 12 }}>Performance de Vendas</div>
      <div style={{ color: "#B9C4D6", fontSize: 18, marginTop: 10 }}>{M3[rm - 1]} {ra} · MERIDIAN</div>
    </div>));
  add("RELATÓRIO COMERCIAL", "Resumo executivo", (p) => {
    const k = p.D?.kpi; if (!p.D || !k || k._erro) return <Sem x={p.D ? k : null} />;
    const meta = k.metas?.vendas || 0, real = k.totais?.vendas || 0;
    const l = (k.linhas || []).find((x) => x.mes === rm) || {};
    const metaMes = l.metaVendasValor || 0, realMes = l.vendas?.atual || 0;
    const C2 = ({ t, v, s, cor }) => <div style={{ flex: 1, background: "#F2F5FA", borderLeft: `5px solid ${cor}`, padding: "18px 20px" }}><div style={{ fontSize: 12, letterSpacing: 2, color: CZ }}>{t}</div><div style={{ fontSize: 30, fontWeight: 800, color: cor === N ? N : cor, marginTop: 8 }}>{v}</div>{s && <div style={{ fontSize: 13, color: CZ }}>{s}</div>}</div>;
    return (
      <>
        <div style={{ position: "absolute", left: 40, top: 30, fontWeight: 800, fontSize: 24, color: N }}>Resumo executivo · {ra}</div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 90, display: "flex", gap: 16 }}>
          <C2 t="META ANUAL" v={mi(meta)} cor={N} /><C2 t="REALIZADO" v={mi(real)} s={pct(meta ? real / meta : null, 1)} cor={VD} /><C2 t="GAP" v={mi(meta - real)} cor={L} /><C2 t="MÉDIA/MÊS" v={mi(k.gap?.vendas?.mtg)} s="necessária" cor={N} />
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 270, display: "flex", gap: 30, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: N }}>Meta do mês · {M3[rm - 1]}</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: N, marginTop: 10 }}>{brl(realMes)}</div>
            <div style={{ fontSize: 15, color: CZ }}>de {brl(metaMes)}</div>
            <div style={{ height: 14, background: "#EEF1F6", borderRadius: 7, marginTop: 14, overflow: "hidden" }}><div style={{ width: `${Math.min(100, metaMes ? (realMes / metaMes) * 100 : 0)}%`, height: "100%", background: L }} /></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: L }}>{metaMes ? Math.round((realMes / metaMes) * 100) : 0}%</div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: L, fontWeight: 700 }}>{realMes >= metaMes ? "META ATINGIDA" : `FALTOU ATINGIR ${brl(metaMes - realMes)}`}</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 520 }}><Txt {...p} k="com.destaque" padrao={`Destaque: para bater a meta anual, é necessário sustentar ${mi(k.gap?.vendas?.mtg)}/mês nos meses restantes.`} linhas={3} style={{ background: "#F2F5FA", fontSize: 15 }} /></div>
      </>
    );
  });
  add("RELATÓRIO COMERCIAL", "Meta × realizado mensal", (p) => {
    const k = p.D?.kpi; if (!p.D || !k || k._erro) return <Sem x={p.D ? k : null} />;
    const ls = k.linhas || [];
    return (<><div style={{ position: "absolute", left: 40, top: 30, fontWeight: 800, fontSize: 24, color: N }}>Meta vs Realizado · Mensal (vendas)</div>
      <div style={{ position: "absolute", left: 20, top: 90 }}><Barras nomes={["Meta", "Realizado"]} rotulos={ls.map((l) => M3[l.mes - 1])} series={[ls.map((l) => l.metaVendasValor || 0), ls.map((l) => (l.mes <= rm ? l.vendas?.atual || 0 : 0))]} /></div>
      <Obs {...p} chave="com.meta" /></>);
  });
  add("RELATÓRIO COMERCIAL", `Comparativo ${ra - 1} × ${ra}`, (p) => {
    const k = p.D?.kpi; if (!p.D || !k || k._erro) return <Sem x={p.D ? k : null} />;
    const ls = k.linhas || [];
    return (<><div style={{ position: "absolute", left: 40, top: 30, fontWeight: 800, fontSize: 24, color: N }}>Comparativo · {ra - 1} vs {ra} (vendas)</div>
      <div style={{ position: "absolute", left: 20, top: 90 }}><Barras nomes={[String(ra - 1), String(ra)]} rotulos={ls.map((l) => M3[l.mes - 1])} series={[ls.map((l) => l.vendas?.anterior || 0), ls.map((l) => (l.mes <= rm ? l.vendas?.atual || 0 : 0))]} /></div>
      <Obs {...p} chave="com.comp" /></>);
  });
  add("RELATÓRIO COMERCIAL", "Clientes do mês", (p) => {
    const c = p.D?.cli; if (!p.D || !c || c._erro) return <Sem x={p.D ? c : null} />;
    const top = c.top || [];
    return (<><div style={{ position: "absolute", left: 40, top: 30 }}><div style={{ fontWeight: 800, fontSize: 24, color: N }}>Clientes — {MES.charAt(0) + MES.slice(1).toLowerCase()}/{ra}</div><div style={{ fontSize: 13, color: CZ }}>Faturamento por cliente (NFs de saída) · {c.clientes} clientes no mês</div></div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 100, display: "flex", gap: 20 }}>
        {[top.slice(0, Math.ceil(top.length / 2)), top.slice(Math.ceil(top.length / 2))].map((col, q) => <div key={q} style={{ flex: 1 }}><Tab cols={[{ t: "Cliente" }, { t: "Valor", r: 1 }]} linhas={col.map((x) => ({ c: [x.cliente, brl(x.valor)] }))} fs={13} /></div>)}
      </div>
      <div style={{ position: "absolute", right: 40, top: 520, background: L, color: "#fff", fontWeight: 800, padding: "8px 18px", fontSize: 16 }}>TOTAL {brl(c.total)}</div>
      <Obs {...p} chave="com.cli" /></>);
  });
  // financeiro
  add("FINANCEIRO", "DRE mês", (p) => {
    const d = p.D?.dre; if (!p.D || !d || d._erro) return <><Cab g="FINANCEIRO" t="DRE MES" /><Sem x={p.D ? d : null} /></>;
    const o = d.operacao || {};
    const linhasO = [["SALDO INICIAL", d.saldoInicial], ["01. RECEITA", o.receita], ["02. CMV", o.cmv], [`03. MARGEM DE CONTRIBUIÇÃO (${pct(o.margemPct, 1)})`, o.margem, 1], ["04. DESPESA ADM E VEGETATIVA", o.adm], [`05. EBITDA (${pct(o.ebitdaPct, 1)})`, o.ebitda, 1], ["06. IMPOSTOS E JUROS", o.impostos], [`07. LUCRO LÍQUIDO (${pct(o.lucroPct, 1)})`, o.lucro, 1], ["08. INVESTIMENTO", o.investimento], ["RESULTADO OPERAÇÃO", o.resultado, 1]];
    const ex = d.externos || [];
    return (
      <>
        <Cab g="FINANCEIRO" t="DRE MES" />
        <div style={{ position: "absolute", left: 40, top: 96, width: 560 }}><Tab cols={[{ t: "OPERAÇÃO" }, { t: "VALOR", r: 1 }]} linhas={linhasO.map(([l, v, b]) => ({ c: [l, brl(v)], _b: b, _cor: b ? "#DCE6F5" : undefined, _fg: [null, v < 0 ? VM : VD] }))} fs={13} /></div>
        <div style={{ position: "absolute", left: 640, top: 96, right: 40 }}>
          <Tab cols={[{ t: "NEGÓCIO · RECURSOS EXTERNOS" }, { t: "ENTRADA", r: 1 }, { t: "PAGAMENTO", r: 1 }]} linhas={ex.map((x) => ({ c: [x.n, brl(x.entrada), brl(x.pagamento)] }))}
            rodape={[["TOTAL", brl(d.entradaExterna), brl(d.pagamentoExterno)], ["RESULTADO RECURSOS EXTERNOS", "", brl(d.resultadoExterno)], ["SALDO FINAL", "", brl(d.saldoFinal)]]} fs={13} />
        </div>
        <Obs {...p} chave="fin.dre" />
      </>
    );
  });
  add("FINANCEIRO", "Fluxo de caixa mês", (p) => {
    const l = p.D?.lanc, d = p.D?.dre;
    if (!p.D || !l || l._erro) return <><Cab g="FINANCEIRO" t="FLUXO DE CAIXA MES" /><Sem x={p.D ? l : null} /></>;
    const fora = new Set(((d?.detalhes?.FORA) || []).map((x) => x.contaId));
    const dias = {};
    for (const x of l.lancamentos || []) { if (x.desmembrado || x.substituido || fora.has(x.contaId)) continue; const k = x.data; const v = Number(x.valor) || 0; const o = (dias[k] ||= { e: 0, s: 0 }); if (v > 0) o.e += v; else o.s += v; }
    let saldo = d?.saldoInicial || 0;
    const ls = Object.keys(dias).sort().map((k) => { saldo += dias[k].e + dias[k].s; return { k, ...dias[k], saldo }; });
    const meio = Math.ceil(ls.length / 2);
    const T = (arr) => <Tab cols={[{ t: "DIA" }, { t: "ENTRADAS", r: 1, cor: VD }, { t: "SAÍDAS", r: 1, cor: VM }, { t: "RESULTADO", r: 1 }, { t: "SALDO", r: 1 }]} linhas={arr.map((x) => ({ c: [dBR(x.k).slice(0, 5), brl(x.e), brl(x.s), brl(x.e + x.s), brl(x.saldo)], _fg: [null, null, null, x.e + x.s < 0 ? VM : VD, x.saldo < 0 ? VM : null] }))} fs={11} />;
    const tE = ls.reduce((s, x) => s + x.e, 0), tS = ls.reduce((s, x) => s + x.s, 0);
    return (
      <>
        <Cab g="FINANCEIRO" t="FLUXO DE CAIXA MES (REALIZADO)" />
        <div style={{ position: "absolute", left: 40, right: 40, top: 96, display: "flex", gap: 16 }}><div style={{ flex: 1 }}>{T(ls.slice(0, meio))}</div><div style={{ flex: 1 }}>{T(ls.slice(meio))}</div></div>
        <div style={{ position: "absolute", left: 40, top: 610, fontSize: 14 }}><b>Total do mês:</b> entradas <b style={{ color: VD }}>{brl(tE)}</b> · saídas <b style={{ color: VM }}>{brl(tS)}</b> · resultado <b>{brl(tE + tS)}</b> (sem transferências entre contas)</div>
        <Obs {...p} chave="fin.fluxo" />
      </>
    );
  });
  add("FINANCEIRO", "Painel mês subsequente", (p) => {
    const x = p.D?.painel; if (!p.D || !x || x._erro) return <><Cab g="FINANCEIRO" t="PAINEL MES SUBSEQUENTE" /><Sem x={p.D ? x : null} /></>;
    const r = x.pos?.receber || {}, pg = x.pos?.pagar || {}, c = x.cenarios || {};
    const B = ({ t, v, cor = N, s }) => <div style={{ border: `1px solid ${LN}`, borderTop: `4px solid ${cor}`, padding: "8px 10px", background: "#fff" }}><div style={{ fontSize: 11, color: CZ, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 18, fontWeight: 800, color: cor === N ? N : cor }}>{brl(v)}</div>{s && <div style={{ fontSize: 10.5, color: CZ }}>{s}</div>}</div>;
    return (
      <>
        <Cab g="FINANCEIRO" t={`PAINEL MES SUBSEQUENTE · ${R.mes.slice(5)}/${R.mes.slice(0, 4)}`} />
        <div style={{ position: "absolute", left: 40, right: 40, top: 100, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <B t="A RECEBER NO MÊS" v={r.mes?.real} cor={VD} s={`${r.mes?.qtd || 0} títulos`} /><B t="A RECEBER · POSIÇÃO GERAL" v={r.geral?.real} cor={VD} s={`antecipados ${brl(r.geral?.antecipados)}`} />
          <B t="RECEBER EM ATRASO" v={r.atrasado?.total} cor={L} s={`cobrança ${brl(r.atrasado?.cobranca)} · execução ${brl(r.atrasado?.execucao)}`} /><B t="ANTECIPÁVEIS" v={x.antecipaveis?.valor} s={`${x.antecipaveis?.qtd || 0} títulos`} />
          <B t="A PAGAR NO MÊS" v={pg.mes} cor={VM} s={`${pg.qtdMes || 0} contas · previsões ${brl(pg.mesPrevisoes)}`} /><B t="CONTAS ATRASADAS" v={pg.atrasadas} cor={VM} s={`${pg.qtdAtrasadas || 0} contas`} />
          <B t="A PAGAR · TOTAL SEM PREVISÃO" v={pg.totalSemPrevisao} cor={VM} /><B t="CAIXA · LIMITE DISPONÍVEL" v={x.caixa?.disponivelTotal} s={`saldo ${brl(x.caixa?.saldoGeral)}`} />
          <B t="CENÁRIO DO MÊS" v={c.mes} cor={c.mes < 0 ? VM : VD} s="receber − pagar no mês" /><B t="CENÁRIO GERAL" v={c.geral} cor={c.geral < 0 ? VM : VD} /><B t="QUITAÇÃO DAS DÍVIDAS HOJE" v={pg.dividasLB?.quitacaoHoje} /><B t="CENÁRIO LB" v={c.lb} cor={c.lb < 0 ? VM : VD} />
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 430 }}>
          <div style={{ fontWeight: 700, color: N, marginBottom: 4 }}>INFO RELEVANTE</div>
          <Txt {...p} k="fin.painel.info" padrao={x.manual?.infoRelevante || ""} ph="Informações relevantes para o mês…" linhas={6} />
        </div>
      </>
    );
  });
  add("FINANCEIRO", "Matriz e simulação", (p) => (
    <>
      <Cab g="FINANCEIRO" t="" />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: N, textDecoration: "underline" }}>APRESENTAÇÃO DA MATRIZ ATUAL E SIMULAÇÃO</div>
        {p.irMatriz && <button onClick={(e) => { e.stopPropagation(); p.irMatriz(); }} style={{ background: L, color: "#fff", fontWeight: 700, padding: "10px 22px", borderRadius: 8, fontSize: 16 }}>Abrir a Matriz de custos ↗</button>}
      </div>
      <Obs {...p} chave="fin.matriz" />
    </>));
  add("MERIDIAN", "Encerramento", (p) => (
    <div style={{ position: "absolute", inset: 0, background: N, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 80 }} />
      <div style={{ width: 700, marginTop: 50 }}><Txt {...p} k="fim.texto" ph="Próximos passos / encaminhamentos (opcional)…" linhas={4} style={{ color: "#fff", background: "transparent", textAlign: "center", fontSize: 16 }} /></div>
    </div>));
  return sl;
}
