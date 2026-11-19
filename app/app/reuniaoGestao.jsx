"use client";
// v785 — Reunião mensal de gestão: apresentação interativa no padrão da apresentação mensal (PDF de agosto/2026).
//   Uma reunião por mês, ligada à tarefa recorrente "REUNIÃO DE GESTÃO · MM/AAAA": as pautas da tarefa ficam na lateral
//   e podem ser incluídas aqui ou na tarefa (é o mesmo registro). A reunião de um mês apresenta os números do mês anterior,
//   lidos na hora do sistema (KPIs, análises de corte/expedição, endividamento, DRE, fluxo e painel). Textos e observações
//   são editados direto na tela e ficam salvos na reunião.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, Plus, Loader2, Landmark, Eye, EyeOff, ExternalLink, Type, Heading1, Heading2, Link2, ImagePlus, Trash2, GripVertical, FilePlus2, Save, Copy } from "lucide-react";
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
  // v1008 — estrutura da apresentação (ordem, duplicados, excluídos), versão salva e dados congelados por slide
  const [estrutura, setEstrutura] = useState(null);
  const [snap, setSnap] = useState({});
  const [salvoEm, setSalvoEm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mudancas, setMudancas] = useState(null);   // [{ id, titulo, n, exemplos }]
  const [arrastando, setArrastando] = useState(null);
  const ler = (m) => {
    setR(null); setErro(""); setMudancas(null);
    j(`/api/reuniao?u=${user.id}${m ? `&mes=${m}` : ""}`).then((x) => {
      setR(x); textos.current = { ...(x.apresentacao?.textos || {}) };
      setEstrutura(Array.isArray(x.apresentacao?.estrutura) ? x.apresentacao.estrutura : null);
      setSnap(desempacotar(x.snapshot)); setSalvoEm(x.snapshot?.em || null);
      if (!m) setMes(x.mes);
    }).catch((e) => setErro(e.message));
  };
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
  const post = async (corpo) => { const r = await fetch("/api/reuniao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, tarefaId: R.tarefa.id, ...corpo }) }); const x = await r.json().catch(() => ({})); if (!r.ok || x.error) throw new Error(x.error || `Erro ${r.status}`); return x; };
  const salvar = (k, v) => {
    textos.current[k] = v; pend.current[k] = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const t = pend.current; pend.current = {};
      try { await post({ textos: t }); } catch (e) { alerta(`Não salvou o texto: ${e.message}`); }
    }, 800);
  };
  // páginas em branco (conteúdo); a posição vem da estrutura
  const [paginas, setPaginas] = useState([]);
  useEffect(() => { setPaginas(Array.isArray(R?.apresentacao?.paginas) ? R.apresentacao.paginas : []); }, [R]);
  const tPag = useRef(null);
  const gravarPaginas = (l) => {
    setPaginas(l);
    clearTimeout(tPag.current);
    tPag.current = setTimeout(async () => { try { await post({ paginas: l }); } catch (e) { alerta(`Não salvou a página: ${e.message}`); } }, 700);
  };
  const mudarPagina = (id, fn) => gravarPaginas(paginas.map((pg) => (pg.id === id ? fn(pg) : pg)));
  const base = useMemo(() => (R ? montarSlides(R).map((x) => ({ ...x, chave: `${x.g}|${x.t}` })) : []), [R]);
  // ordem: a estrutura salva; sem ela, os slides padrão com as páginas em branco depois do slide onde foram criadas
  const ordem = useMemo(() => {
    const porChave = Object.fromEntries(base.map((x) => [x.chave, x]));
    if (estrutura) return estrutura.filter((s) => (s.pagina ? paginas.some((p) => p.id === s.pagina) : porChave[s.base]));
    const out = [];
    const extra = (ch) => paginas.filter((pg) => pg.apos === ch).forEach((pg) => { out.push({ id: `PG|${pg.id}`, pagina: pg.id }); extra(`PG|${pg.id}`); });
    for (const x of base) { out.push({ id: x.chave, base: x.chave }); extra(x.chave); }
    for (const pg of paginas) if (!out.some((o) => o.pagina === pg.id)) out.push({ id: `PG|${pg.id}`, pagina: pg.id });
    return out;
  }, [base, estrutura, paginas]);
  const slides = useMemo(() => ordem.map((s) => {
    if (s.pagina) {
      const pg = paginas.find((p) => p.id === s.pagina);
      const tit = (pg?.elementos || []).find((e) => e.tipo === "TITULO")?.texto;
      return { ...s, g: "PÁGINA", t: tit || "Página em branco", deps: [], C: (p) => <PaginaBranca {...p} id={s.pagina} /> };
    }
    const b = base.find((x) => x.chave === s.base);
    return { ...b, ...s, deps: b.deps || [], dup: s.dup };
  }), [ordem, base, paginas]);
  const gravarEstrutura = async (l) => { setEstrutura(l); try { await post({ estrutura: l }); } catch (e) { alerta(`Não salvou a ordem dos slides: ${e.message}`); } };
  const materializar = () => ordem.map((s) => ({ ...s }));
  const novoId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const novaPagina = () => {
    const id = novoId("p");
    const l = materializar(); l.splice(i + 1, 0, { id: `PG|${id}`, pagina: id });
    setPaginas((ps) => { const n = [...ps, { id, apos: "", elementos: [] }]; post({ paginas: n }).catch((e) => alerta(e.message)); return n; });
    gravarEstrutura(l); setI(i + 1);
  };
  const duplicar = (k) => {
    const s = ordem[k]; const l = materializar();
    if (s.pagina) {
      const pg = paginas.find((p) => p.id === s.pagina); const id = novoId("p");
      const n = [...paginas, { id, apos: "", elementos: (pg?.elementos || []).map((e) => ({ ...e, id: novoId("e") })) }];
      setPaginas(n); post({ paginas: n }).catch((e) => alerta(e.message));
      l.splice(k + 1, 0, { id: `PG|${id}`, pagina: id });
    } else {
      // cópia de slide de dados: mesmos números, textos e observações próprios (começam iguais aos do original)
      const id = novoId("d"); const pre = s.pre || "";
      const copia = {};
      for (const [kk, v] of Object.entries(textos.current)) if (pre ? kk.startsWith(pre) : !kk.includes(":")) copia[`${id}:${pre ? kk.slice(pre.length) : kk}`] = v;
      Object.assign(textos.current, copia); if (Object.keys(copia).length) post({ textos: copia }).catch(() => null);
      l.splice(k + 1, 0, { id, base: s.base, dup: true, pre: `${id}:` });
      if (snap[s.id]) setSnap((x) => ({ ...x, [id]: snap[s.id] }));
    }
    gravarEstrutura(l); setI(k + 1);
  };
  const excluir = async (k) => {
    const s = slides[k];
    if (!(await confirmar(`Excluir o slide "${s.t}" desta apresentação?${s.pagina ? " O conteúdo da página é apagado." : " Os números continuam no sistema; o slide só sai desta reunião."}`))) return;
    const l = materializar().filter((_, q) => q !== k);
    if (s.pagina) gravarPaginas(paginas.filter((p) => p.id !== s.pagina));
    gravarEstrutura(l); setI(Math.max(0, Math.min(k, l.length - 1)));
  };
  const mover = (de, para) => { if (de === para || de == null) return; const l = materializar(); const [x] = l.splice(de, 1); l.splice(para, 0, x); gravarEstrutura(l); setI(para); };
  // dados de cada slide: os congelados na versão salva; slide novo usa os do sistema
  const dadosDe = (s) => {
    if (!D) return null;
    const c = snap[s.id];
    return c ? { ...D, ...c.dados } : D;
  };
  const salvarVersao = async () => {
    if (!D) return alerta("Aguarde a leitura dos números para salvar.");
    setSalvando(true);
    try {
      clearTimeout(timer.current); const t = pend.current; pend.current = {};
      const est = materializar();
      const novo = {};
      for (const s of slides) novo[s.id] = snap[s.id] || { dados: Object.fromEntries((s.deps || []).map((d) => [d, D[d]])), em: new Date().toISOString() };
      const x = await post({ textos: t, estrutura: est, paginas, snapshot: empacotar(novo) });
      setEstrutura(est); setSnap(novo); setSalvoEm(x.salvoEm || new Date().toISOString()); setMudancas([]);
    } catch (e) { alerta(`Não salvou: ${e.message}`); }
    setSalvando(false);
  };
  // ao abrir: o que mudou nos dados desde a versão salva (por slide)
  useEffect(() => {
    if (!D || mudancas !== null || !Object.keys(snap).length) return;
    const l = [];
    for (const s of slides) {
      const c = snap[s.id]; if (!c) continue;
      // KPIs: só os meses até o de referência e as metas (o mês corrente muda todo dia e não aparece na reunião)
      const norm = (d, v) => (d === "kpi" && v && !v._erro ? { linhas: (v.linhas || []).filter((l) => l.mes <= D.rm), metas: v.metas } : v);
      const dif = (s.deps || []).filter((d) => D[d] && !D[d]._erro && c.dados?.[d] && !c.dados[d]._erro).flatMap((d) => diferencas(norm(d, c.dados[d]), norm(d, D[d]), ROTULO_FONTE[d] || d));
      if (dif.length) l.push({ id: s.id, titulo: `${s.g} · ${s.t}`, n: dif.length, exemplos: dif.slice(0, 4) });
    }
    setMudancas(l);
  }, [D, snap, slides.length]);
  const atualizar = async (ids) => {
    const novo = { ...snap };
    for (const s of slides) if (ids.includes(s.id)) novo[s.id] = { dados: Object.fromEntries((s.deps || []).map((d) => [d, D[d]])), em: new Date().toISOString() };
    setSnap(novo); setMudancas([]);
    try { const x = await post({ snapshot: empacotar(novo) }); setSalvoEm(x.salvoEm || salvoEm); } catch (e) { alerta(`Não salvou a atualização: ${e.message}`); }
  };
  const S = slides[Math.min(i, slides.length - 1)];
  const ctxDe = (s) => {
    const pre = s?.pre || "";
    return { D: s ? dadosDe(s) : D, R, txt: (k) => (pre ? textos.current[pre + k] ?? textos.current[k] : textos.current[k]), salvar: (k, v) => salvar(pre + k, v), editavel: !tela, irMatriz, user, paginas, mudarPagina, chaveSlide: s?.id };
  };
  useEffect(() => {
    const f = (e) => { if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT" || e.target?.isContentEditable) return; if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(slides.length - 1, x + 1)); if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1)); if (e.key === "Escape") setTela(false); };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, [slides.length]);
  // faixa de miniaturas: perto das bordas ela anda sozinha
  const faixa = useRef(null), rolar = useRef(0);
  useEffect(() => { const t = setInterval(() => { if (rolar.current && faixa.current) faixa.current.scrollLeft += rolar.current; }, 16); return () => clearInterval(t); }, []);
  const naFaixa = (e) => { const r = faixa.current?.getBoundingClientRect(); if (!r) return; const x = e.clientX - r.left, z = 110; rolar.current = x > r.width - z ? Math.ceil(((x - (r.width - z)) / z) * 14) : x < z ? -Math.ceil(((z - x) / z) * 14) : 0; };
  useEffect(() => { const el = faixa.current?.querySelector(`[data-mini="${i}"]`); el?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" }); }, [i]);

  if (erro) return <div className="text-sm" style={{ color: VM }}>{erro}</div>;
  if (!R) return <Loader2 size={18} className="animate-spin" style={{ color: CZ }} />;
  const [ra, rm] = R.ref.split("-").map(Number);
  const ii = Math.min(i, slides.length - 1);
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
        <span className="text-[11px]" style={{ color: CZ }}>{salvoEm ? `versão salva ${new Date(salvoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "ainda não salva"}</span>
        <button onClick={salvarVersao} disabled={salvando} title="Salva a apresentação e congela os números de cada slide (depois o sistema avisa o que mudou)" className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold" style={{ background: L, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button>
        <button onClick={novaPagina} title="Cria uma página em branco logo depois desta" className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold" style={{ border: `1px solid ${N}`, color: N, background: "#fff" }}><FilePlus2 size={14} /> Página em branco</button>
        <button onClick={() => setTela(true)} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold" style={{ background: N, color: "#fff" }}><Maximize2 size={14} /> Apresentar</button>
      </div>
      {mudancas?.length > 0 && <AvisoMudancas l={mudancas} onAtualizar={atualizar} onManter={() => setMudancas([])} />}
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <Palco>{S && <S.C key={S.id} {...ctxDe(S)} />}</Palco>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => setI((x) => Math.max(0, x - 1))} className="p-1.5 rounded" style={{ border: `1px solid ${LN}` }}><ChevronLeft size={16} /></button>
            <span className="text-xs" style={{ color: CZ }}>{ii + 1} / {slides.length} · {S?.t}{S?.dup ? " (cópia)" : ""}{S && snap[S.id] ? " · números da versão salva" : ""}</span>
            <button onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))} className="p-1.5 rounded" style={{ border: `1px solid ${LN}` }}><ChevronRight size={16} /></button>
            {!D && <span className="text-xs flex items-center gap-1" style={{ color: CZ }}><Loader2 size={12} className="animate-spin" /> lendo os números…</span>}
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => duplicar(ii)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: N }}><Copy size={12} /> duplicar</button>
              <button onClick={() => excluir(ii)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: VM }}><Trash2 size={12} /> excluir</button>
            </div>
          </div>
          <div ref={faixa} onMouseMove={naFaixa} onMouseLeave={() => { rolar.current = 0; }} className="flex gap-2 mt-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {slides.map((x, k) => (
              <div key={x.id} data-mini={k} draggable onDragStart={(e) => { setArrastando(k); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setArrastando(null)}
                onDragOver={(e) => { e.preventDefault(); naFaixa(e); }} onDrop={(e) => { e.preventDefault(); mover(arrastando, k); setArrastando(null); }}
                onClick={() => setI(k)} title={`${x.g} · ${x.t} — arraste para mudar a ordem`} className="group relative shrink-0 rounded-md text-left px-2 py-1.5 cursor-pointer select-none"
                style={{ width: 132, height: 62, background: k === ii ? N : "#fff", color: k === ii ? "#fff" : N, border: `1px solid ${k === ii ? N : arrastando != null && arrastando !== k ? L : LN}`, opacity: arrastando === k ? 0.4 : 1, overflow: "hidden" }}>
                <div className="text-[9px] font-bold truncate" style={{ color: k === ii ? "#FFB27A" : L, letterSpacing: 0.3 }}>{k + 1} · {x.g}</div>
                <div className="text-[10.5px] font-semibold leading-tight mt-0.5" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.t}{x.dup ? " (cópia)" : ""}</div>
                <div className="absolute right-1 bottom-1 hidden group-hover:flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); duplicar(k); }} title="Duplicar" className="rounded p-0.5" style={{ background: "rgba(255,255,255,.9)", color: N }}><Copy size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); excluir(k); }} title="Excluir" className="rounded p-0.5" style={{ background: "rgba(255,255,255,.9)", color: VM }}><Trash2 size={11} /></button>
                </div>
              </div>))}
          </div>
        </div>
        <Pautas user={user} R={R} onMudou={() => ler(R.mes)} />
      </div>
      {tela && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "#000" }} onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}>
          <div style={{ width: "100vw", maxWidth: "calc(100vh * 16 / 9)" }}><Palco>{S && <S.C key={S.id} {...ctxDe(S)} editavel={false} />}</Palco></div>
          <button onClick={(e) => { e.stopPropagation(); setTela(false); }} className="absolute top-3 right-3 p-2 rounded-full" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}><X size={18} /></button>
          <div className="absolute bottom-3 right-4 text-xs" style={{ color: "rgba(255,255,255,.6)" }}>{ii + 1} / {slides.length} · ← → para navegar · Esc para sair</div>
        </div>
      )}
    </div>
  );
}
// versão salva compacta: cada conjunto de dados igual é guardado uma vez só (vários slides usam os mesmos KPIs)
function empacotar(snap) {
  const pool = [], idx = new Map(), slides = {};
  for (const [id, c] of Object.entries(snap || {})) {
    const refs = {};
    for (const [d, v] of Object.entries(c?.dados || {})) { const k = JSON.stringify(v ?? null); if (!idx.has(k)) { idx.set(k, pool.length); pool.push(v ?? null); } refs[d] = idx.get(k); }
    slides[id] = { refs, em: c?.em || null };
  }
  return { pool, slides };
}
function desempacotar(x) {
  const out = {};
  const sl = x?.slides?.slides ? x.slides : x;   // gravado como { em, por, slides: { pool, slides } }
  const pool = sl?.pool || [], ss = sl?.slides || {};
  for (const [id, c] of Object.entries(ss)) out[id] = { dados: Object.fromEntries(Object.entries(c.refs || {}).map(([d, k]) => [d, pool[k]])), em: c.em };
  return out;
}
const ROTULO_FONTE = { kpi: "KPIs", cli: "Clientes do mês", dre: "DRE", alav: "Endividamento", painel: "Painel do mês", corte: "Análise de corte", exp: "Análise de expedição", lanc: "Fluxo de caixa" };
// números que mudaram entre a versão salva e o sistema agora (strings e datas não contam)
function diferencas(a, b, rot, cam = "", out = []) {
  if (out.length > 60) return out;
  if (typeof a === "number" || typeof b === "number") {
    const x = Number(a) || 0, y = Number(b) || 0;
    if (Math.abs(x - y) > 0.005 && !/(^|\.)(em|ts|hora|tempo|ms)$/i.test(cam)) out.push({ fonte: rot, campo: cam, de: a, para: b });
    return out;
  }
  if (a && typeof a === "object" && b && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diferencas(a[k], b[k], rot, cam ? `${cam}.${k}` : k, out);
  }
  return out;
}
const fmtNum = (v) => (v == null ? "—" : typeof v === "number" ? (Math.abs(v) >= 100 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })) : String(v));
const campoLegivel = (c) => String(c).replace(/^linhas\.(\d+)\./, (_, k) => `${M3[Number(k)] || `linha ${Number(k) + 1}`} · `).replace(/\.(\d+)\./g, (_, k) => ` #${Number(k) + 1} · `).replace(/\./g, " · ");
function AvisoMudancas({ l, onAtualizar, onManter }) {
  const [marc, setMarc] = useState(() => new Set(l.map((x) => x.id)));
  return (
    <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: "#FFF8E1", border: "1px solid #F5C54255" }}>
      <div className="font-bold mb-1" style={{ color: N }}>Os números mudaram desde a última versão salva em {l.length} slide(s). Atualizar?</div>
      <div className="text-xs mb-2" style={{ color: CZ }}>Só os slides marcados são atualizados; os outros continuam com os números da versão salva.</div>
      <div className="flex flex-col gap-1.5 mb-2" style={{ maxHeight: 220, overflowY: "auto" }}>
        {l.map((x) => (
          <label key={x.id} className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={marc.has(x.id)} onChange={() => setMarc((m) => { const n = new Set(m); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n; })} className="mt-0.5" />
            <span><b style={{ color: N }}>{x.titulo}</b> · {x.n} valor(es) mudaram
              <span className="block" style={{ color: CZ }}>{x.exemplos.map((e) => `${e.fonte} · ${campoLegivel(e.campo)}: ${fmtNum(e.de)} → ${fmtNum(e.para)}`).join("  ·  ")}{x.n > x.exemplos.length ? " …" : ""}</span></span>
          </label>))}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onManter} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ border: `1px solid ${LN}`, background: "#fff", color: CZ }}>Manter a versão salva</button>
        <button onClick={() => onAtualizar([...marc])} disabled={!marc.size} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: L, color: "#fff", opacity: marc.size ? 1 : 0.5 }}>Atualizar {marc.size} slide(s)</button>
      </div>
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
      {!escuro && <Logo inline />}
    </div>
  );
}
// v1007 — logo padrão no canto superior direito de todas as páginas
function Logo({ inline }) {
  const img = <img src="/meridian-wordmark.svg" alt="MERIDIAN" style={{ height: 22, opacity: 0.9, display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />;
  return inline ? img : <div style={{ position: "absolute", right: 40, top: 30, pointerEvents: "none" }}>{img}</div>;
}
// texto editável direto no slide (salvo na reunião)
function Txt({ k, txt, salvar, editavel, ph, style, linhas = 4, padrao = "" }) {
  const [v, setV] = useState(txt(k) ?? padrao);
  useEffect(() => { setV(txt(k) ?? padrao); }, [k]);
  const base = { width: "100%", resize: "none", border: editavel ? `1px dashed ${LN}` : "1px solid transparent", borderRadius: 6, padding: "6px 8px", fontSize: 14, lineHeight: 1.45, background: editavel ? "#FAFBFC" : "transparent", outline: "none", fontFamily: "inherit", color: "#1F2733", whiteSpace: "pre-wrap", ...style };
  if (!editavel) return <div style={{ ...base, minHeight: 0 }}>{v || ""}</div>;
  return <textarea value={v} placeholder={ph} rows={linhas} onChange={(e) => { setV(e.target.value); salvar(k, e.target.value); }} style={base} />;
}
// v1008 — observação do slide: na apresentação aparece numa caixinha amarela bem clara (vazia não aparece)
const Obs = (p) => {
  const v = p.txt(`${p.chave}.obs`);
  if (!p.editavel && !String(v || "").trim()) return null;
  return (
    <div style={{ position: "absolute", left: 40, right: 40, bottom: 16 }}>
      <Txt {...p} k={`${p.chave}.obs`} ph="Observações deste slide (aparecem na apresentação numa caixa amarela)…" linhas={2}
        style={{ fontSize: 13, background: "#FFF9DB", border: `1px ${p.editavel ? "dashed" : "solid"} #F2DC8C`, borderRadius: 8, padding: "8px 12px", color: "#5C4A00" }} />
    </div>
  );
};
// v1008 — tabela no visual do sistema: cabeçalho claro, linhas finas, cantos arredondados
function Tab({ cols, linhas, rodape, larg, fs = 12 }) {
  const th = (c) => ({ background: "#EEF2F8", color: c.cor || N, padding: "7px 10px", textAlign: c.r ? "right" : "left", fontWeight: 700, whiteSpace: "nowrap", fontSize: fs - 1, letterSpacing: 0.3, textTransform: "uppercase", borderBottom: `1px solid #DCE3EE` });
  return (
    <div style={{ border: `1px solid ${LN}`, borderRadius: 10, overflow: "hidden", width: larg || "100%", background: "#fff" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: fs }}>
        <thead><tr>{cols.map((c, k) => <th key={k} style={th(c)}>{c.t}</th>)}</tr></thead>
        <tbody>{linhas.map((l, k) => <tr key={k} style={{ background: l._cor || (l._b ? "#F3F6FB" : k % 2 ? "#FAFBFD" : "#fff") }}>{l.c.map((v, q) => <td key={q} style={{ padding: "5px 10px", borderBottom: `1px solid #EEF1F5`, textAlign: cols[q]?.r ? "right" : "left", fontWeight: l._b ? 700 : 400, whiteSpace: "nowrap", color: l._fg?.[q] || (q === 0 ? N : "#1F2733"), fontVariantNumeric: "tabular-nums" }}>{v}</td>)}</tr>)}</tbody>
        {rodape && <tfoot>{rodape.map((l, k) => <tr key={k} style={{ background: "#EEF2F8", fontWeight: 700, color: N }}>{l.map((v, q) => <td key={q} style={{ padding: "6px 10px", textAlign: cols[q]?.r ? "right" : "left", whiteSpace: "nowrap", borderTop: k ? "none" : `1px solid #DCE3EE`, fontVariantNumeric: "tabular-nums" }}>{v}</td>)}</tr>)}</tfoot>}
      </table>
    </div>
  );
}
// v1008 — card de indicador: faixa de cor no topo, rótulo discreto e valor em destaque
const Caixa = ({ t, v, cor = L, sub }) => (
  <div style={{ border: `1px solid ${LN}`, borderTop: `4px solid ${cor}`, borderRadius: 10, background: "#fff", padding: "10px 14px", minWidth: 170, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: CZ, letterSpacing: 0.6, textTransform: "uppercase" }}>{t}</div>
    <div style={{ fontWeight: 800, fontSize: 20, color: N, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
    {sub && <div style={{ fontSize: 11, color: CZ, marginTop: 2 }}>{sub}</div>}
  </div>
);
// v1008 — acumulado até o mês de referência: meta, realizado, gap e MTG pelos meses ainda em aberto (12 − mês de referência)
function acumulado(k, campo, rm) {
  const ls = (k?.linhas || []).filter((l) => l.mes <= rm);
  const v = (l) => (campo === "vendas" ? l.vendas?.atual : campo === "faturamento" ? l.faturamento?.atual : l.receita?.total);
  const meses = ls.filter((l) => v(l) != null).length;
  const extra = campo === "vendas" ? Number(k?.semNota?.vendas) || 0 : campo === "faturamento" ? Number(k?.semNota?.faturamento) || 0 : 0;
  const real = ls.reduce((s0, l) => s0 + (Number(v(l)) || 0), 0) + extra;
  const meta = Number(k?.metas?.[campo]) || 0;
  const rest = Math.max(0, 12 - rm);
  const gap = meta ? meta - real : null;
  return { real, meta, gap, rest, mtg: gap != null && rest ? gap / rest : null, media: meses ? real / meses : null, meses };
}
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

// v1008 — gráficos: meta (barra clara) × realizado (verde quando bate, laranja quando não) com o % de atingimento em cada mês
const kk = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M` : `${Math.round(v / 1000)}k`);
function BarrasMeta({ rotulos, real, meta, larg = 846, alt = 430 }) {
  const max = Math.max(1, ...real.map((v) => v || 0), ...meta);
  const n = rotulos.length, top = 40, base = alt - 40, ah = base - top, gw = (larg - 70) / n, bw = Math.min(40, gw * 0.62);
  const y = (v) => base - (v / max) * ah;
  return (
    <svg width={larg} height={alt}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={60} x2={larg - 10} y1={base - f * ah} y2={base - f * ah} stroke="#EEF1F5" /><text x={54} y={base - f * ah + 4} fontSize={10} textAnchor="end" fill={CZ}>{kk(max * f)}</text></g>)}
      <g><rect x={60} y={8} width={12} height={12} rx={3} fill="#DCE3EE" /><text x={78} y={18} fontSize={12} fill={CZ}>Meta</text>
        <rect x={130} y={8} width={12} height={12} rx={3} fill={VD} /><text x={148} y={18} fontSize={12} fill={CZ}>Realizado (bateu)</text>
        <rect x={270} y={8} width={12} height={12} rx={3} fill={L} /><text x={288} y={18} fontSize={12} fill={CZ}>Realizado (abaixo)</text></g>
      {rotulos.map((r, k) => {
        const x = 60 + k * gw + (gw - bw) / 2, v = real[k], m = meta[k] || 0, p0 = v != null && m ? v / m : null;
        return (
          <g key={k}>
            <rect x={x} y={y(m)} width={bw} height={base - y(m)} rx={5} fill="#E6EBF3" />
            {v != null && <rect x={x + bw * 0.18} y={y(v)} width={bw * 0.64} height={base - y(v)} rx={4} fill={p0 != null && p0 >= 1 ? VD : L} />}
            {p0 != null && <text x={x + bw / 2} y={Math.min(y(v), y(m)) - 6} fontSize={11} fontWeight={700} textAnchor="middle" fill={p0 >= 1 ? VD : L}>{Math.round(p0 * 100)}%</text>}
            <text x={x + bw / 2} y={base + 18} fontSize={12} textAnchor="middle" fill={N} fontWeight={600}>{r}</text>
            {v != null && <text x={x + bw / 2} y={base + 32} fontSize={9.5} textAnchor="middle" fill={CZ}>{kk(v)}</text>}
          </g>);
      })}
    </svg>
  );
}
function BarrasComp({ rotulos, ant, atu, nomes, larg = 846, alt = 430 }) {
  const max = Math.max(1, ...ant, ...atu.map((v) => v || 0));
  const n = rotulos.length, top = 40, base = alt - 40, ah = base - top, gw = (larg - 70) / n, bw = Math.min(22, gw * 0.36);
  const y = (v) => base - (v / max) * ah;
  return (
    <svg width={larg} height={alt}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={60} x2={larg - 10} y1={base - f * ah} y2={base - f * ah} stroke="#EEF1F5" /><text x={54} y={base - f * ah + 4} fontSize={10} textAnchor="end" fill={CZ}>{kk(max * f)}</text></g>)}
      <g><rect x={60} y={8} width={12} height={12} rx={3} fill="#B9C6DA" /><text x={78} y={18} fontSize={12} fill={CZ}>{nomes[0]}</text>
        <rect x={130} y={8} width={12} height={12} rx={3} fill={AZ} /><text x={148} y={18} fontSize={12} fill={CZ}>{nomes[1]}</text></g>
      {rotulos.map((r, k) => {
        const x = 60 + k * gw + (gw - bw * 2 - 4) / 2, a = ant[k] || 0, v = atu[k], g = v != null && a ? v / a - 1 : null;
        return (
          <g key={k}>
            <rect x={x} y={y(a)} width={bw} height={base - y(a)} rx={4} fill="#B9C6DA" />
            {v != null && <rect x={x + bw + 4} y={y(v)} width={bw} height={base - y(v)} rx={4} fill={AZ} />}
            {g != null && <text x={x + bw + 2} y={Math.min(y(a), y(v)) - 6} fontSize={11} fontWeight={700} textAnchor="middle" fill={g >= 0 ? VD : VM}>{g >= 0 ? "+" : ""}{Math.round(g * 100)}%</text>}
            <text x={x + bw + 2} y={base + 18} fontSize={12} textAnchor="middle" fill={N} fontWeight={600}>{r}</text>
          </g>);
      })}
    </svg>
  );
}
function Rosca({ v, cor = VD, tam = 96 }) {
  const r = tam / 2 - 8, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, v || 0));
  return (
    <svg width={tam} height={tam} style={{ flexShrink: 0 }}>
      <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="#EEF1F6" strokeWidth={10} />
      <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke={cor} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${tam / 2} ${tam / 2})`} />
      <text x={tam / 2} y={tam / 2 + 6} textAnchor="middle" fontSize={18} fontWeight={800} fill={N}>{Math.round((v || 0) * 100)}%</text>
    </svg>
  );
}

/* ---------------- slides ---------------- */
function montarSlides(R) {
  const [ra, rm] = R.ref.split("-").map(Number);
  const MES = MESES[rm - 1];
  const sl = [];
  const add = (g, t, C, deps = []) => sl.push({ g, t, C, deps });
  const addD = (deps, g, t, C) => add(g, t, C, deps);   // v1008 — deps: fontes de dados do slide (versão salva / o que mudou)
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
      <Logo />
      <div style={{ position: "absolute", left: 40, top: 26, right: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 26, color: AZ }}>PESSOAS E PROCESSOS</div>
        <Txt {...p} k="pp.tema.titulo" ph="TÍTULO (ex.: FRENTE DE RECRUTAMENTO OPERACIONAL)" linhas={1} style={{ fontWeight: 700, fontSize: 17, color: N, padding: "2px 6px" }} />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 120 }}><Txt {...p} k="pp.tema.texto" ph="Texto do tema…" linhas={18} style={{ fontSize: 16 }} /></div>
    </>));
  for (const [setor, nome] of [["corte", "ANALISE CORTE"], ["exp", "ANALISE EXPEDIÇÃO"]]) addD([setor], "PESSOAS E PROCESSOS", nome.toLowerCase().replace("analise", "Análise"), (p) => {
    const x = p.D?.[setor];
    const c = x?.calc, a = x?.analise;
    return (
      <>
        <Cab g="PESSOAS E PROCESSOS" t={nome} />
        {!p.D || !x || x._erro ? <Sem x={p.D ? x : null} /> : !a ? <div style={{ position: "absolute", left: 40, top: 120, color: CZ }}>Análise de {nome.toLowerCase().slice(8)} de {MES.toLowerCase()} ainda não lançada (Operação › Análises operacionais).</div> : (
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
      const A = acumulado(k, "vendas", rm);
      rod = [["TOTAL", brl(ls.reduce((s, l) => s + (l.vendas?.anterior || 0), 0)), brl(A.real), "", "", brl(k.metas?.vendas), ""], ["MÉDIA MENSAL", "", brl(A.media), "", "", "", ""]];
      metaTot = k.metas?.vendas; gap = A;
    } else if (tipo === "fat") {
      cols = [{ t: "Mês" }, { t: String(ant), r: 1 }, { t: String(ra), r: 1 }, { t: "Meta (R$)", r: 1 }, { t: "Meta (pç)", r: 1 }, { t: "MoM", r: 1 }, { t: "Acumulado", r: 1 }, { t: "Peças fat.", r: 1 }];
      linhas = ls.map((l) => ({ c: [M3[l.mes - 1], brl(l.faturamento?.anterior), ate(l.mes) ? brl(l.faturamento?.atual) : "", brl(l.faturamento?.metaValor), num(l.faturamento?.metaPecas), ate(l.mes) ? pct(l.faturamento?.mom) : "", ate(l.mes) ? pct(l.faturamento?.acumulado) : "", ate(l.mes) ? num(l.faturamento?.pecas) : ""], _b: l.mes === rm }));
      const A = acumulado(k, "faturamento", rm);
      const pcs = ls.filter((l) => l.mes <= rm).reduce((s0, l) => s0 + (Number(l.faturamento?.pecas) || 0), 0);
      rod = [["TOTAL", brl(ls.reduce((s, l) => s + (l.faturamento?.anterior || 0), 0)), brl(A.real), brl(k.metas?.faturamento), "", "", "", num(pcs)], ["MÉDIA MENSAL", "", brl(A.media), "", "", "", "", num(A.meses ? Math.round(pcs / A.meses) : 0)], ["TICKET MÉDIO", "", brl(pcs ? A.real / pcs : null), "", "", "", "", ""]];
      metaTot = k.metas?.faturamento; gap = A;
    } else {
      const segs = k.segmentos || [];
      cols = [{ t: "Mês" }, ...segs.map((s) => ({ t: s, r: 1 })), { t: String(ra), r: 1 }, { t: String(ant), r: 1 }, { t: "PoP", r: 1 }, { t: "Meta", r: 1 }];
      linhas = ls.map((l) => ({ c: [M3[l.mes - 1], ...segs.map((s) => (ate(l.mes) ? brl(l.receita?.segmentos?.[s] || 0) : "")), ate(l.mes) ? brl(l.receita?.total) : "", brl(l.receita?.anterior), ate(l.mes) ? pct(l.receita?.pop) : "", brl(l.metaReceitaValor)], _b: l.mes === rm }));
      const A = acumulado(k, "receita", rm);
      rod = [["TOTAL", ...segs.map(() => ""), brl(A.real), "", "", brl(k.metas?.receita)]];
      metaTot = k.metas?.receita; gap = A;
    }
    return (
      <>
        <Cab g="KPIS" t={titulo} />
        <div style={{ position: "absolute", left: 40, top: 96, right: 250 }}><Tab cols={cols} linhas={linhas} rodape={rod} fs={tipo === "rec" ? 11 : 12} /></div>
        <div style={{ position: "absolute", right: 40, top: 96, width: 190, display: "flex", flexDirection: "column", gap: 12 }}>
          <Caixa t="META" v={brl(metaTot, 0)} /><Caixa t="REALIZADO" v={brl(gap?.real, 0)} cor={VD} sub={metaTot ? `${pct(gap.real / metaTot, 1)} da meta · até ${M3[rm - 1]}` : `até ${M3[rm - 1]}`} />
          <Caixa t="GAP" v={brl(gap?.gap, 0)} cor={N} /><Caixa t="MTG" v={gap?.rest ? brl(gap?.mtg, 0) : "—"} sub={gap?.rest ? `por mês nos ${gap.rest} mês(es) em aberto` : "ano fechado"} />
        </div>
        <Obs {...p} chave={`kpi.${tipo}`} />
      </>
    );
  };
  add("KPIS", "Vendas", kpiSlide("vendas", "VENDAS"), ["kpi"]);
  add("KPIS", "Faturamento", kpiSlide("fat", "FATURAMENTO"), ["kpi"]);
  add("KPIS", "Receita", kpiSlide("rec", "RECEITA"), ["kpi"]);
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
        {/* v1008 — contratos em grade de 3 colunas; totais alinhados no topo, à direita */}
        <div style={{ position: "absolute", left: 40, right: 290, top: 100, display: "grid", gridTemplateColumns: `repeat(${itens.length > 6 ? 4 : 3}, 1fr)`, gap: 12, alignContent: "start" }}>
          {itens.map((c) => (
            <div key={c.id} style={{ border: `1px solid ${LN}`, borderRadius: 10, overflow: "hidden", background: "#fff", fontSize: 11 }}>
              <div style={{ background: "#EEF2F8", color: N, fontWeight: 800, padding: "6px 10px", fontSize: 11.5, letterSpacing: 0.3, borderBottom: "1px solid #DCE3EE", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
              <div style={{ padding: "4px 0" }}>
                {[["Capital contratado", brl(c.capital)], ["Contratado em", dBR(c.inicio)], ["Taxa (a.m.)", c.taxaMensal != null ? `${String(c.taxaMensal).replace(".", ",")}%` : "—"], ["Parcela mensal", brl(c.parcela ?? c.mensal)], ["Prazo", c.prazoMeses ? `${c.prazoMeses} meses` : "—"], ["Débito total", brl(c.debitoTotal)], ["Já pago", c.parcelasPagas != null ? `${c.parcelasPagas} parcelas` : "—"], ["A vencer", brl(c.aVencer ?? c.saldoCapital)], ["Pagar até", dBR(c.pagarAte)]].map(([l, v], q) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 10px", background: q === 7 ? "#FFF4EC" : "transparent" }}><span style={{ color: CZ }}>{l}</span><b style={{ color: q === 7 ? L : N, fontVariantNumeric: "tabular-nums" }}>{v}</b></div>))}
              </div>
            </div>))}
          {!itens.length && <div style={{ color: CZ }}>Nenhum contrato neste grupo.</div>}
        </div>
        <div style={{ position: "absolute", right: 40, top: 100, width: 230, display: "flex", flexDirection: "column", gap: 12 }}>
          <Caixa t={`TOTAL ${titulo.split(" - ")[1] || ""}`} v={brl(total)} cor={N} sub={`${itens.length} contrato(s)`} />
          <Caixa t="PARCELAS POR MÊS" v={brl(itens.reduce((s0, c) => s0 + (Number(c.parcela ?? c.mensal) || 0), 0))} cor={AZ} />
          <Caixa t="ALAVANCAGEM TOTAL" v={brl(a.totais?.alavancagem)} cor={L} sub="todos os grupos" />
        </div>
        <Obs {...p} chave={chave} />
      </>
    );
  };
  add("KPIS", "Endividamento LP", div(["GIRO_LP"], "ENDIVIDAMENTO - LP", "div.lp"), ["alav"]);
  add("KPIS", "Mútuos CP", div(["MUTUO_GIRO", "ARREMATE_W3"], "ENDIVIDAMENTO - MUTUOS CP", "div.mutuo"), ["alav"]);
  add("KPIS", "Investimento", div(["INVESTIMENTO"], "ENDIVIDAMENTO - INVESTIMENTO", "div.inv"), ["alav"]);
  addD(["alav"], "KPIS", "Tributário", (p) => {
    const a = p.D?.alav;
    if (!p.D || !a || a._erro) return <><Cab g="KPIS" t="ENDIVIDAMENTO - TRIBUTÁRIO" /><Sem x={p.D ? a : null} /></>;
    return (
      <>
        <Cab g="KPIS" t="ENDIVIDAMENTO - TRIBUTÁRIO" />
        <div style={{ position: "absolute", left: 40, right: 290, top: 100, display: "flex", flexDirection: "column", gap: 14 }}>
          {(a.tributos || []).map((g) => (
            <div key={g.grupo} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}><Tab cols={[{ t: g.label }, { t: "Saldo", r: 1 }, { t: "Parcela", r: 1 }, { t: "Situação" }]}
                linhas={(g.itens || []).map((i) => ({ c: [i.descricao, brl(i.calculo?.saldo ?? i.valor), i.parcelaMensal ? brl(i.parcelaMensal) : "—", i.parcelado ? `parcelado · ${i.calculo?.parcelasRestantes ?? "?"} restantes` : i.exigivel ? "exigível" : "não exigível"] }))} /></div>
              <div style={{ width: 160 }}><Caixa t="TOTAL" v={brl(g.total)} cor={AZ} /></div>
            </div>))}
        </div>
        <div style={{ position: "absolute", right: 40, top: 100, width: 230, display: "flex", flexDirection: "column", gap: 12 }}>
          <Caixa t="TOTAL IMPOSTOS" v={brl(a.totais?.tributos)} cor={N} />
          <Caixa t="ALAVANCAGEM TOTAL" v={brl(a.totais?.alavancagem)} cor={L} sub="todos os grupos" />
        </div>
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
  addD(["kpi"], "RELATÓRIO COMERCIAL", "Resumo executivo", (p) => {
    const k = p.D?.kpi; if (!p.D || !k || k._erro) return <><Cab g="RELATÓRIO COMERCIAL" t={`RESUMO EXECUTIVO · ${ra}`} /><Sem x={p.D ? k : null} /></>;
    const A = acumulado(k, "vendas", rm);
    const ls = k.linhas || [];
    const l = ls.find((x) => x.mes === rm) || {};
    const metaMes = Number(l.metaVendasValor) || 0, realMes = Number(l.vendas?.atual) || 0, pm = metaMes ? realMes / metaMes : null;
    const ult3 = ls.filter((x) => x.mes <= rm && x.mes > rm - 3).map((x) => Number(x.vendas?.atual) || 0);
    const media3 = ult3.length ? ult3.reduce((a, b) => a + b, 0) / ult3.length : 0;
    const projecao = A.real + media3 * A.rest;
    const C2 = ({ t, v, s, cor }) => (
      <div style={{ flex: 1, background: "#fff", border: `1px solid ${LN}`, borderTop: `4px solid ${cor}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: CZ, fontWeight: 700 }}>{t}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: cor === N ? N : cor, marginTop: 6, lineHeight: 1.1 }}>{v}</div>
        {s && <div style={{ fontSize: 12, color: CZ, marginTop: 4 }}>{s}</div>}
      </div>);
    return (
      <>
        <Cab g="RELATÓRIO COMERCIAL" t={`RESUMO EXECUTIVO · ${ra}`} />
        <div style={{ position: "absolute", left: 40, right: 40, top: 100, display: "flex", gap: 14 }}>
          <C2 t="META ANUAL" v={mi(A.meta)} cor={N} s={`${mi(A.meta / 12)} por mês em média`} />
          <C2 t={`REALIZADO ATÉ ${M3[rm - 1]}`} v={mi(A.real)} cor={VD} s={`${pct(A.meta ? A.real / A.meta : null, 1)} da meta anual`} />
          <C2 t="GAP PARA A META" v={mi(A.gap)} cor={L} s={A.meta ? `faltam ${pct(A.gap / A.meta, 1)} da meta anual` : null} />
          <C2 t="MTG · POR MÊS" v={A.rest ? mi(A.mtg) : "—"} cor={N} s={A.rest ? `nos ${A.rest} mês(es) em aberto` : "ano fechado"} />
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 262, display: "flex", gap: 14 }}>
          <div style={{ flex: 1.4, background: "#fff", border: `1px solid ${LN}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: CZ, fontWeight: 700 }}>META DO MÊS · {M3[rm - 1]}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: N }}>{brl(realMes, 0)}</div>
              <div style={{ fontSize: 14, color: CZ }}>de {brl(metaMes, 0)}</div>
            </div>
            <div style={{ height: 12, background: "#EEF1F6", borderRadius: 6, marginTop: 14, overflow: "hidden" }}><div style={{ width: `${Math.min(100, (pm || 0) * 100)}%`, height: "100%", background: pm >= 1 ? VD : L, borderRadius: 6 }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
              <b style={{ color: pm >= 1 ? VD : L }}>{pm != null ? `${Math.round(pm * 100)}% da meta` : "—"}</b>
              <span style={{ color: CZ }}>{pm == null ? "" : pm >= 1 ? `superou em ${brl(realMes - metaMes, 0)}` : `faltaram ${brl(metaMes - realMes, 0)}`}</span>
            </div>
          </div>
          <div style={{ width: 230, background: "#fff", border: `1px solid ${LN}`, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Rosca v={A.meta ? A.real / A.meta : 0} cor={VD} />
            <div><div style={{ fontSize: 11, letterSpacing: 1.2, color: CZ, fontWeight: 700 }}>ATINGIMENTO ANUAL</div><div style={{ fontSize: 12, color: CZ, marginTop: 4 }}>{mi(A.real)} de {mi(A.meta)}</div></div>
          </div>
          <div style={{ flex: 1, background: "#fff", border: `1px solid ${LN}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: CZ, fontWeight: 700 }}>PROJEÇÃO DE FECHAMENTO</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: projecao >= A.meta ? VD : L, marginTop: 8 }}>{mi(projecao)}</div>
            <div style={{ fontSize: 12, color: CZ, marginTop: 4 }}>ritmo dos últimos {ult3.length} meses ({mi(media3)}/mês) · {A.meta ? pct(projecao / A.meta, 0) : "—"} da meta</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 430 }}>
          <Txt {...p} k="com.destaque" padrao={`Destaque: para bater a meta anual, é necessário vender ${mi(A.mtg)} por mês nos ${A.rest} mês(es) em aberto — no ritmo atual (${mi(media3)}/mês) o ano fecha em ${mi(projecao)}.`} linhas={3} style={{ background: "#F5F7FB", border: `1px solid ${LN}`, borderRadius: 10, padding: "10px 14px", fontSize: 15 }} />
        </div>
        <Obs {...p} chave="com.resumo" />
      </>
    );
  });
  // v1008 — gráficos com leitura gerencial: atingimento por mês, acumulado × meta, tendência, melhor/pior mês e projeção
  addD(["kpi"], "RELATÓRIO COMERCIAL", "Meta × realizado mensal", (p) => {
    const k = p.D?.kpi; if (!p.D || !k || k._erro) return <><Cab g="RELATÓRIO COMERCIAL" t="META × REALIZADO · MENSAL" /><Sem x={p.D ? k : null} /></>;
    const ls = (k.linhas || []).slice(0, 12);
    const real = ls.map((l) => (l.mes <= rm ? Number(l.vendas?.atual) || 0 : null)), meta = ls.map((l) => Number(l.metaVendasValor) || 0);
    const fe = ls.filter((l) => l.mes <= rm);
    const at = fe.map((l) => ({ m: l.mes, r: Number(l.vendas?.atual) || 0, mt: Number(l.metaVendasValor) || 0 })).map((x) => ({ ...x, p: x.mt ? x.r / x.mt : null }));
    const acima = at.filter((x) => x.p != null && x.p >= 1).length;
    const melhor = [...at].sort((a, b) => b.r - a.r)[0], pior = [...at].sort((a, b) => a.r - b.r)[0];
    const rAc = at.reduce((s0, x) => s0 + x.r, 0), mAc = at.reduce((s0, x) => s0 + x.mt, 0);
    const pecas = fe.reduce((s0, l) => s0 + (Number(l.vendas?.pecas) || 0), 0);
    const pecasMes = Number(fe.find((l) => l.mes === rm)?.vendas?.pecas) || 0;
    const media = at.length ? rAc / at.length : 0;
    const ult3 = at.slice(-3), media3 = ult3.length ? ult3.reduce((s0, x) => s0 + x.r, 0) / ult3.length : 0;
    return (<>
      <Cab g="RELATÓRIO COMERCIAL" t="META × REALIZADO · MENSAL (VENDAS)" />
      <div style={{ position: "absolute", left: 40, top: 100, width: 860, height: 470, background: "#fff", border: `1px solid ${LN}`, borderRadius: 12, padding: "10px 6px 0" }}>
        <BarrasMeta rotulos={ls.map((l) => M3[l.mes - 1])} real={real} meta={meta} larg={846} alt={430} />
      </div>
      <div style={{ position: "absolute", right: 40, top: 100, width: 300, display: "flex", flexDirection: "column", gap: 10 }}>
        <Caixa t={`ACUMULADO ATÉ ${M3[rm - 1]}`} v={mi(rAc)} cor={rAc >= mAc ? VD : L} sub={`${pct(mAc ? rAc / mAc : null, 1)} das metas mensais somadas (${mi(mAc)})`} />
        <Caixa t="MESES ACIMA DA META" v={`${acima} de ${at.length}`} cor={acima >= at.length / 2 ? VD : L} />
        <Caixa t="TENDÊNCIA" v={`${media3 >= media ? "▲" : "▼"} ${pct(media ? media3 / media - 1 : null, 1)}`} cor={media3 >= media ? VD : VM} sub={`últimos 3 meses ${mi(media3)}/mês × média do ano ${mi(media)}`} />
        <Caixa t="MELHOR · PIOR MÊS" v={`${melhor ? M3[melhor.m - 1] : "—"} · ${pior ? M3[pior.m - 1] : "—"}`} cor={AZ} sub={melhor ? `${mi(melhor.r)} · ${mi(pior.r)}` : null} />
        <Caixa t="PREÇO MÉDIO POR PEÇA" v={brl(pecasMes ? (Number(fe.find((l) => l.mes === rm)?.vendas?.atual) || 0) / pecasMes : null)} cor={N} sub={`no ano: ${brl(pecas ? rAc / pecas : null)} · ${num(pecas)} peças`} />
      </div>
      <Obs {...p} chave="com.meta" /></>);
  });
  addD(["kpi"], "RELATÓRIO COMERCIAL", `Comparativo ${ra - 1} × ${ra}`, (p) => {
    const k = p.D?.kpi; if (!p.D || !k || k._erro) return <><Cab g="RELATÓRIO COMERCIAL" t={`COMPARATIVO ${ra - 1} × ${ra}`} /><Sem x={p.D ? k : null} /></>;
    const ls = (k.linhas || []).slice(0, 12);
    const ant = ls.map((l) => Number(l.vendas?.anterior) || 0), atu = ls.map((l) => (l.mes <= rm ? Number(l.vendas?.atual) || 0 : null));
    const fe = ls.filter((l) => l.mes <= rm).map((l) => ({ m: l.mes, a: Number(l.vendas?.anterior) || 0, r: Number(l.vendas?.atual) || 0 })).map((x) => ({ ...x, g: x.a ? x.r / x.a - 1 : null }));
    const sa = fe.reduce((s0, x) => s0 + x.a, 0), sr = fe.reduce((s0, x) => s0 + x.r, 0);
    const cresc = fe.filter((x) => x.g != null && x.g > 0).length;
    const maior = [...fe].filter((x) => x.g != null).sort((a, b) => b.g - a.g)[0], menor = [...fe].filter((x) => x.g != null).sort((a, b) => a.g - b.g)[0];
    const restoAnt = ls.filter((l) => l.mes > rm).reduce((s0, l) => s0 + (Number(l.vendas?.anterior) || 0), 0);
    return (<>
      <Cab g="RELATÓRIO COMERCIAL" t={`COMPARATIVO ${ra - 1} × ${ra} (VENDAS)`} />
      <div style={{ position: "absolute", left: 40, top: 100, width: 860, height: 470, background: "#fff", border: `1px solid ${LN}`, borderRadius: 12, padding: "10px 6px 0" }}>
        <BarrasComp rotulos={ls.map((l) => M3[l.mes - 1])} ant={ant} atu={atu} nomes={[String(ra - 1), String(ra)]} larg={846} alt={430} />
      </div>
      <div style={{ position: "absolute", right: 40, top: 100, width: 300, display: "flex", flexDirection: "column", gap: 10 }}>
        <Caixa t={`CRESCIMENTO ATÉ ${M3[rm - 1]}`} v={`${sr >= sa ? "▲" : "▼"} ${pct(sa ? sr / sa - 1 : null, 1)}`} cor={sr >= sa ? VD : VM} sub={`${mi(sr)} em ${ra} × ${mi(sa)} em ${ra - 1}`} />
        <Caixa t="MESES COM CRESCIMENTO" v={`${cresc} de ${fe.length}`} cor={cresc >= fe.length / 2 ? VD : L} />
        <Caixa t="MAIOR ALTA" v={maior ? `${M3[maior.m - 1]} · ${pct(maior.g, 0)}` : "—"} cor={VD} sub={maior ? `${mi(maior.r)} × ${mi(maior.a)}` : null} />
        <Caixa t="MAIOR QUEDA" v={menor ? `${M3[menor.m - 1]} · ${pct(menor.g, 0)}` : "—"} cor={VM} sub={menor ? `${mi(menor.r)} × ${mi(menor.a)}` : null} />
        <Caixa t={`${ra - 1} NO RESTO DO ANO`} v={mi(restoAnt)} cor={AZ} sub={`referência para ${ls.filter((l) => l.mes > rm).map((l) => M3[l.mes - 1]).join("/") || "—"}`} />
      </div>
      <Obs {...p} chave="com.comp" /></>);
  });
  addD(["cli"], "RELATÓRIO COMERCIAL", "Clientes do mês", (p) => {
    const c = p.D?.cli; if (!p.D || !c || c._erro) return <><Cab g="RELATÓRIO COMERCIAL" t={`CLIENTES · ${MES}/${ra}`} /><Sem x={p.D ? c : null} /></>;
    const top = c.top || [];
    const tot = Number(c.total) || 0, top5 = top.slice(0, 5).reduce((s0, x) => s0 + (Number(x.valor) || 0), 0);
    return (<><Cab g="RELATÓRIO COMERCIAL" t={`CLIENTES · ${MES}/${ra} · FATURAMENTO POR CLIENTE`} />
      <div style={{ position: "absolute", left: 40, right: 290, top: 100, display: "flex", gap: 16 }}>
        {[top.slice(0, Math.ceil(top.length / 2)), top.slice(Math.ceil(top.length / 2))].map((col, q) => <div key={q} style={{ flex: 1 }}><Tab cols={[{ t: "Cliente" }, { t: "Valor", r: 1 }, { t: "%", r: 1 }]} linhas={col.map((x) => ({ c: [String(x.cliente || "").slice(0, 34), brl(x.valor), tot ? pct((Number(x.valor) || 0) / tot, 1) : "—"] }))} fs={12} /></div>)}
      </div>
      <div style={{ position: "absolute", right: 40, top: 100, width: 230, display: "flex", flexDirection: "column", gap: 12 }}>
        <Caixa t="FATURADO NO MÊS" v={brl(tot)} cor={L} sub={`${c.clientes || top.length} cliente(s)`} />
        <Caixa t="CONCENTRAÇÃO TOP 5" v={tot ? pct(top5 / tot, 1) : "—"} cor={tot && top5 / tot > 0.6 ? VM : AZ} sub={tot && top5 / tot > 0.6 ? "dependência alta de poucos clientes" : "do faturamento do mês"} />
        <Caixa t="TICKET MÉDIO POR CLIENTE" v={brl((c.clientes || top.length) ? tot / (c.clientes || top.length) : null)} cor={N} />
        {top[0] && <Caixa t="MAIOR CLIENTE" v={String(top[0].cliente || "").slice(0, 22)} cor={VD} sub={`${brl(top[0].valor)} · ${tot ? pct(top[0].valor / tot, 1) : ""}`} />}
      </div>
      <Obs {...p} chave="com.cli" /></>);
  });
  // financeiro
  addD(["dre"], "FINANCEIRO", "DRE mês", (p) => {
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
  addD(["lanc", "dre"], "FINANCEIRO", "Fluxo de caixa mês", (p) => {
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
  addD(["painel"], "FINANCEIRO", "Painel mês subsequente", (p) => {
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


/* ---------------- v1007 — página em branco ---------------- */
// elementos em coordenadas do slide (1280×720): TITULO e SUBTITULO no padrão do cabeçalho, TEXTO (caixa como as de Pessoas e processos),
// LINK (abre a página da web) e IMAGEM (upload ou Ctrl+V; vira anexo da tarefa da reunião). Tudo arrasta; caixa, link e imagem redimensionam.
const PADRAO = {
  TITULO: { w: 760, h: 40, texto: "TÍTULO" }, SUBTITULO: { w: 600, h: 28, texto: "SUBTÍTULO" }, TEXTO: { w: 1200, h: 160, texto: "" },
  LINK: { w: 360, h: 32, texto: "Abrir link" }, IMAGEM: { w: 420, h: 280, texto: "" },
};
const ESTILO = {
  TITULO: { fontWeight: 800, fontSize: 26, color: AZ, letterSpacing: 0.5, lineHeight: 1.2 },
  SUBTITULO: { fontWeight: 700, fontSize: 17, color: N, lineHeight: 1.25 },
  TEXTO: { fontSize: 14, lineHeight: 1.45, color: "#1F2733" },
  LINK: { fontSize: 15, fontWeight: 600, color: "#2E7CD6", textDecoration: "underline" },
};
async function reduzirImagem(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const f = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const tipo = /png/i.test(file.type) ? "image/png" : "image/jpeg";
    return { dataUrl: c.toDataURL(tipo, 0.88), w: c.width, h: c.height, tipo };
  } finally { URL.revokeObjectURL(url); }
}
function PaginaBranca({ id, paginas, mudarPagina, editavel, user, R }) {
  const pg = (paginas || []).find((x) => x.id === id) || { elementos: [] };
  const els = pg.elementos || [];
  const [sel, setSel] = useState(null);
  const [subindo, setSubindo] = useState(false);
  const area = useRef(null);
  const mudar = (fn) => mudarPagina(id, (p) => ({ ...p, elementos: fn(p.elementos || []) }));
  const upd = (eid, campos) => mudar((l) => l.map((e) => (e.id === eid ? { ...e, ...campos } : e)));
  const escala = () => { const r = area.current?.getBoundingClientRect(); return r && r.width ? r.width / W : 1; };
  const add = (tipo, extra = {}) => {
    const eid = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const p0 = PADRAO[tipo], n = els.length;
    const y = tipo === "TITULO" ? 26 : tipo === "SUBTITULO" ? 64 : 110 + (n % 6) * 24;
    mudar((l) => [...l, { id: eid, tipo, x: 40, y, w: p0.w, h: p0.h, texto: p0.texto, url: "", ...extra }]);
    setSel(eid);
  };
  const addImagem = async (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    setSubindo(true);
    try {
      const r0 = await reduzirImagem(file);
      const r = await fetch(`/api/tarefas/${R.tarefa.id}/arquivos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, nome: `pagina-${id}-${file.name || "print.png"}`, mime: r0.tipo, conteudo: r0.dataUrl.split(",")[1] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.arquivo?.id) throw new Error(j.error || `Erro ${r.status}`);
      const f = Math.min(1, 560 / r0.w, 400 / r0.h);
      add("IMAGEM", { arquivoId: j.arquivo.id, w: Math.round(r0.w * f), h: Math.round(r0.h * f) });
    } catch (e) { alerta(`Não foi possível inserir a imagem: ${e.message}`); }
    setSubindo(false);
  };
  // Ctrl+V com imagem (print) entra na página aberta; Delete tira o elemento selecionado
  useEffect(() => {
    if (!editavel) return;
    const colar = (e) => { const it = [...(e.clipboardData?.items || [])].find((x) => x.kind === "file" && /^image\//.test(x.type)); if (!it) return; e.preventDefault(); addImagem(it.getAsFile()); };
    const tecla = (e) => { if (!sel || !(e.key === "Delete")) return; if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT") return; mudar((l) => l.filter((x) => x.id !== sel)); setSel(null); };
    document.addEventListener("paste", colar); window.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("paste", colar); window.removeEventListener("keydown", tecla); };
  });
  // arrastar (mover) e redimensionar com o mouse, convertendo para as coordenadas do slide
  const arrastar = (e, el, modo) => {
    e.preventDefault(); e.stopPropagation(); setSel(el.id);
    const k = escala(), x0 = e.clientX, y0 = e.clientY, b = { x: el.x, y: el.y, w: el.w, h: el.h };
    const razao = el.tipo === "IMAGEM" && b.h ? b.w / b.h : null;
    let ult = null;
    const mv = (ev) => {
      const dx = (ev.clientX - x0) / k, dy = (ev.clientY - y0) / k;
      if (modo === "mover") ult = { x: Math.round(Math.max(-b.w + 20, Math.min(W - 20, b.x + dx))), y: Math.round(Math.max(0, Math.min(H - 16, b.y + dy))) };
      else { let w = Math.max(40, b.w + dx), h = Math.max(20, b.h + dy); if (razao && !ev.shiftKey) h = w / razao; ult = { w: Math.round(w), h: Math.round(h) }; }
      const no = area.current?.querySelector(`[data-el="${el.id}"]`);
      if (no) { if (ult.x != null) { no.style.left = `${ult.x}px`; no.style.top = `${ult.y}px`; } else { no.style.width = `${ult.w}px`; no.style.height = `${ult.h}px`; } }
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); if (ult) upd(el.id, ult); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const src = (el) => `/api/tarefas/${R.tarefa.id}/arquivos?u=${user.id}&arquivo=${el.arquivoId}`;
  const urlOk = (u) => (/^https?:\/\//i.test(u) ? u : u ? `https://${u}` : "");
  return (
    <div ref={area} style={{ position: "absolute", inset: 0 }} onPointerDown={() => editavel && setSel(null)}>
      <Logo />
      {editavel && (
        <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "absolute", left: 40, bottom: 14, display: "flex", gap: 8, zIndex: 50, fontSize: 13 }}>
          {[["TITULO", "Título", Heading1], ["SUBTITULO", "Subtítulo", Heading2], ["TEXTO", "Caixa de texto", Type], ["LINK", "Link", Link2]].map(([t, r, I]) => (
            <button key={t} onClick={() => add(t)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: `1px solid ${LN}`, background: "#fff", color: N, fontWeight: 600 }}><I size={14} /> {r}</button>))}
          <label style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: `1px solid ${LN}`, background: "#fff", color: N, fontWeight: 600, cursor: "pointer" }}>
            {subindo ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} Imagem
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addImagem(f); }} /></label>
          <span style={{ alignSelf: "center", color: CZ, fontSize: 12 }}>Ctrl+V cola print · arraste pelo ⠿ · Delete tira o selecionado</span>
        </div>)}
      {!els.length && editavel && <div style={{ position: "absolute", left: 0, right: 0, top: 320, textAlign: "center", color: CZ, fontSize: 16 }}>Página em branco — use os botões abaixo para inserir título, subtítulo, caixas de texto, links e imagens.</div>}
      {els.map((el) => {
        const on = editavel && sel === el.id;
        const caixa = { position: "absolute", left: el.x, top: el.y, width: el.w, ...(el.tipo === "TITULO" || el.tipo === "SUBTITULO" ? { minHeight: el.h } : { height: el.h }),
          outline: on ? `2px solid ${L}` : editavel ? `1px dashed ${el.tipo === "TEXTO" ? "transparent" : "#C9D2DE"}` : "none", borderRadius: 6, zIndex: on ? 20 : 10 };
        const alca = editavel && <div title="Arrastar" onPointerDown={(e) => arrastar(e, el, "mover")} style={{ position: "absolute", left: -22, top: 2, width: 18, height: 22, cursor: "move", color: on ? L : CZ, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 4, border: `1px solid ${LN}` }}><GripVertical size={13} /></div>;
        const tam = editavel && el.tipo !== "TITULO" && el.tipo !== "SUBTITULO" && <div title="Redimensionar (Shift solta a proporção da imagem)" onPointerDown={(e) => arrastar(e, el, "tam")} style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: on ? L : "#C9D2DE", borderRadius: 3, cursor: "nwse-resize" }} />;
        const tirar = on && <button title="Tirar" onPointerDown={(e) => e.stopPropagation()} onClick={() => { mudar((l) => l.filter((x) => x.id !== el.id)); setSel(null); }} style={{ position: "absolute", right: -10, top: -10, width: 20, height: 20, borderRadius: 10, background: VM, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>;
        if (el.tipo === "IMAGEM") return (
          <div key={el.id} data-el={el.id} style={caixa} onPointerDown={(e) => { if (editavel) arrastar(e, el, "mover"); }}>
            <img src={src(el)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "fill", display: "block", borderRadius: 4, userSelect: "none", pointerEvents: "none" }} />
            {alca}{tam}{tirar}
          </div>);
        if (el.tipo === "LINK") return (
          <div key={el.id} data-el={el.id} style={{ ...caixa, display: "flex", alignItems: "center" }} onPointerDown={(e) => { if (editavel) { e.stopPropagation(); setSel(el.id); } }}>
            {editavel ? <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 2 }}>
                <input value={el.texto} onChange={(e) => upd(el.id, { texto: e.target.value })} placeholder="Texto do link" style={{ ...ESTILO.LINK, border: "none", outline: "none", background: "transparent", width: "100%", fontFamily: "inherit" }} />
                {on && <input value={el.url} onChange={(e) => upd(el.id, { url: e.target.value })} placeholder="https://endereço da página" autoFocus={!el.url} style={{ fontSize: 12, border: `1px solid ${LN}`, borderRadius: 4, padding: "2px 6px", outline: "none", fontFamily: "inherit" }} />}
              </div>
              : <a href={urlOk(el.url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ ...ESTILO.LINK, display: "flex", alignItems: "center", gap: 6 }}><ExternalLink size={15} /> {el.texto || el.url}</a>}
            {alca}{tam}{tirar}
          </div>);
        const est = ESTILO[el.tipo] || ESTILO.TEXTO;
        const ehTexto = el.tipo === "TEXTO";
        const base = { ...est, width: "100%", fontFamily: "inherit", whiteSpace: "pre-wrap", ...(ehTexto ? { border: editavel ? `1px dashed ${LN}` : "1px solid transparent", borderRadius: 6, padding: "6px 8px", background: editavel ? "#FAFBFC" : "transparent", height: "100%", overflow: "hidden" } : { padding: "2px 4px" }) };
        return (
          <div key={el.id} data-el={el.id} style={caixa} onPointerDown={(e) => { if (editavel) { e.stopPropagation(); setSel(el.id); } }}>
            {editavel ? <textarea value={el.texto} onChange={(e) => upd(el.id, { texto: el.tipo === "TEXTO" ? e.target.value : e.target.value.toUpperCase() })} rows={1}
                placeholder={ehTexto ? "Texto…" : el.tipo === "TITULO" ? "TÍTULO" : "SUBTÍTULO"} style={{ ...base, resize: "none", outline: "none", ...(ehTexto ? {} : { border: "none", background: "transparent", height: el.h, overflow: "hidden" }) }} />
              : <div style={base}>{el.texto}</div>}
            {alca}{tam}{tirar}
          </div>);
      })}
    </div>
  );
}
