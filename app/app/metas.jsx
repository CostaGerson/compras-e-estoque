"use client";
// v213 — Página de METAS (Gestão): meta anual por natureza e distribuição mês a mês.
// Meta anual nova → redistribui os meses mantendo a proporção atual, ou pela distribuição histórica.
// Mês alterado à mão fica travado; os demais recebem a sugestão para fechar a meta do ano.
import React, { useState, useEffect, useRef } from "react";
import { Lock, Unlock, Save, Loader2, History, RotateCcw, Target } from "lucide-react";
import { derivarMetas } from "@/lib/kpiMetasCalc";
import { numBR } from "@/lib/numBR";
import { calcularMatriz } from "@/lib/matriz";
import { aplicarMetas } from "@/lib/matrizMetasCalc";
import { CardMetasResultado } from "./matriz";
import CapacidadeMensal from "./capacidadeMensal";
import { planoMensal } from "@/lib/capacidadeMensal";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const JANELAS = [["total", "Todo o período registrado"], ["dois", "Últimos 2 anos"], ["um", "Último ano"]];
const api = async (url, method, body) => {
  const r = await fetch(url, method ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro na operação.");
  return d;
};
const r2 = (v) => Math.round(Number(v) * 100) / 100;
const arred = (un, v) => (un === "pc" ? Math.round(v) : r2(v));
const fmt = (un, v) => (v == null || v === "" ? "" : un === "pc" ? Math.round(Number(v)).toLocaleString("pt-BR") : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const ler = (t) => numBR(String(t ?? "").trim());   // v230.1

// distribui o que falta da meta do ano entre os meses livres, na proporção dos pesos
export function redistribuir(un, anual, meses, travados, pesos) {
  if (anual == null) return meses;
  const livres = [...Array(12).keys()].filter((i) => !travados.has(i));
  if (!livres.length) return meses;
  const fixo = [...travados].reduce((s, i) => s + (Number(meses[i]) || 0), 0);
  const resto = anual - fixo;
  const p = livres.map((i) => Math.max(0, Number(pesos?.[i]) || 0));
  const sp = p.reduce((s, x) => s + x, 0);
  const novo = [...meses];
  livres.forEach((i, k) => { novo[i] = arred(un, resto * (sp ? p[k] / sp : 1 / livres.length)); });
  // sobra do arredondamento vai para o maior mês livre
  const dif = arred(un, anual - novo.reduce((s, x) => s + (Number(x) || 0), 0));
  if (dif) { const maior = livres.reduce((m, i) => (Number(novo[i]) > Number(novo[m]) ? i : m), livres[0]); novo[maior] = arred(un, Number(novo[maior]) + dif); }
  return novo;
}

function Campo({ un, valor, onCommit, estilo, titulo, grande, travado }) {
  const [t, setT] = useState(fmt(un, valor));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setT(fmt(un, valor)); }, [valor, un]);
  return (
    <input value={t} title={titulo} inputMode="decimal" disabled={travado} readOnly={travado}
      onFocus={(e) => { foco.current = true; e.target.select(); }}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => { foco.current = false; const v = ler(t); if ((v ?? null) !== (valor ?? null)) onCommit(v); else setT(fmt(un, valor)); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      className={`w-full rounded-lg px-2 py-1.5 text-right tabular-nums outline-none ${grande ? "text-base font-bold" : "text-sm"}`}
      style={{ border: `1px solid ${C.line}`, background: travado ? C.panel2 : C.panel, color: travado ? C.sub : C.text, cursor: travado ? "not-allowed" : undefined, ...estilo }} />
  );
}

// v232 — card de meta: cabeçalho, informações (rótulo à esquerda, valor à direita) e o campo sempre no rodapé
function CardMeta({ rotulo, titulo, sub, campo, valor, onCommit, children }) {
  return (
    <div className="rounded-xl p-4 flex flex-col min-w-0" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>{rotulo}</div>
      <div className="font-bold leading-tight mt-0.5" style={{ color: C.navy }}>{titulo}</div>
      {sub && <div className="text-[11px] leading-snug" style={{ color: C.sub }}>{sub}</div>}
      <div className="flex-1 flex flex-col gap-1 text-xs mt-2.5" style={{ color: C.text }}>{children}</div>
      <div className="flex items-center justify-between gap-3 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: C.sub }}>{campo}</span>
        <div style={{ width: 150 }}><Campo un="R$" valor={valor} onCommit={onCommit} grande /></div>
      </div>
    </div>
  );
}
function Linha({ k, v, acao }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate" style={{ color: C.sub }} title={k}>{k}</span>
      <span className="whitespace-nowrap">
        <b className="tabular-nums" style={{ color: C.text }}>{v}</b>
        {acao && <button onClick={acao[1]} className="ml-2 font-semibold underline" style={{ color: C.accent }}>{acao[0]}</button>}
      </span>
    </div>
  );
}

function CardNatureza({ n, set, original, ticket }) {
  const [hist, setHist] = useState(false);   // mostra a opção de distribuição histórica (depois de mexer na meta do ano)
  const [jan, setJan] = useState("total");
  const total = n.meses.reduce((s, x) => s + (Number(x) || 0), 0);
  const dif = n.anual == null ? 0 : arred(n.un, n.anual - total);
  const H = n.historico?.[jan];
  const somaH = H?.medias ? H.medias.reduce((s, x) => s + x, 0) : 0;
  const mult = H?.medias && n.anual ? n.anual / somaH : null;

  const mudarAnual = (v) => {
    setHist(true);
    set({ ...n, anual: v == null ? null : arred(n.un, v), meses: redistribuir(n.un, v, n.meses, n.travados, n.pesos) });
  };
  const usarHist = () => {
    if (!H?.medias) return;
    set({ ...n, pesos: H.medias, fonte: jan, meses: redistribuir(n.un, n.anual, n.meses, n.travados, H.medias) });
  };
  const mudarMes = (i, v) => {
    const trav = new Set(n.travados); trav.add(i);
    const meses = [...n.meses]; meses[i] = v == null ? 0 : arred(n.un, v);
    set({ ...n, travados: trav, meses: redistribuir(n.un, n.anual, meses, trav, n.pesos) });
  };
  const fech = n.fechados || [];
  const soltar = (i) => {
    if (fech[i]) return;   // v234: mês fechado no KPI não solta
    const trav = new Set(n.travados); trav.delete(i);
    set({ ...n, travados: trav, meses: redistribuir(n.un, n.anual, n.meses, trav, n.pesos) });
  };
  const mexido = JSON.stringify([n.anual, n.meses]) !== JSON.stringify([original.anual, original.meses]);

  return (
    <div className="rounded-xl p-4 flex-1" style={{ background: C.panel, border: `1px solid ${mexido ? C.accent : C.line}` }}>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>{n.grupo.toUpperCase()}</div>
          <div className="font-bold" style={{ color: C.navy }}>{n.rotulo}</div>
        </div>
        <label className="block" style={{ width: 200 }}>
          <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>Meta do ano{n.un === "R$" ? " (R$)" : " (peças)"}</div>
          <Campo un={n.un} valor={n.anual} onCommit={mudarAnual} grande />
        </label>
        {ticket != null && n.un === "pc" && (
          <label className="block" style={{ width: 200 }}>
            <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>ou em R$ (÷ ticket)</div>
            <Campo un="R$" valor={n.anual == null ? null : r2(n.anual * ticket)} onCommit={(v) => mudarAnual(v == null ? null : v / ticket)} grande />
          </label>
        )}
        {ticket ? n.un === "R$" && (
          <label className="block" style={{ width: 200 }}>
            <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>ou em peças (× ticket)</div>
            <Campo un="pc" valor={n.anual == null ? null : Math.round(n.anual / ticket)} onCommit={(v) => mudarAnual(v == null ? null : v * ticket)} grande />
          </label>
        ) : null}
        {mexido && <button onClick={() => { setHist(false); set({ ...original, fechados: fech, travados: new Set(fech.map((f, i) => (f ? i : -1)).filter((i) => i >= 0)), pesos: original.meses }); }} title="Voltar ao que está gravado"
          className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs" style={{ color: C.sub }}><RotateCcw size={13} /> desfazer</button>}
      </div>

      {hist && n.anual != null && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg mb-3 text-xs" style={{ background: C.blueSoft }}>
          <History size={14} style={{ color: C.blue }} />
          <span style={{ color: C.navy }}>Usar distribuição histórica:</span>
          <select value={jan} onChange={(e) => setJan(e.target.value)} className="rounded px-2 py-1 text-xs" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
            {JANELAS.map(([k, t]) => <option key={k} value={k} disabled={!n.historico?.[k]?.medias}>{t}{n.historico?.[k]?.anos?.length ? ` (${n.historico[k].anos.slice().sort().join(", ")}${n.historico[k].fonte ? ` · ${n.historico[k].fonte}` : ""})` : " — sem dado"}</option>)}
          </select>
          <button onClick={usarHist} disabled={!H?.medias} className="px-3 py-1 rounded font-semibold text-white" style={{ background: H?.medias ? C.blue : C.sub }}>Aplicar</button>
          {mult != null && <span style={{ color: C.sub }}>multiplicador sobre a média histórica: <b style={{ color: C.navy }}>{mult.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}×</b></span>}
        </div>
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
        {MESES.map((m, i) => {
          const fechado = !!fech[i];
          const trav = n.travados.has(i) && !fechado;
          const sug = !trav && !fechado && mexido && Number(n.meses[i]) !== Number(original.meses[i]);
          return (
            <label key={m} className="block">
              <div className="flex items-center text-[11px] font-semibold mb-1" style={{ color: C.sub }}>
                <span className="flex-1">{m}</span>
                {fechado ? <span title="Mês fechado: entra o realizado do KPI (a meta mensal gravada continua no KPI para o atingido × meta)" className="flex items-center gap-0.5 text-[9px] font-bold" style={{ color: C.sub }}><Lock size={10} /> REALIZADO</span>
                  : trav ? <button type="button" onClick={() => soltar(i)} title="Valor fixado por você — clique para soltar e receber a sugestão" style={{ color: C.navy }}><Lock size={11} /></button>
                  : sug ? <span style={{ color: C.accent, fontSize: 10 }}>sugestão</span> : null}
              </div>
              <Campo un={n.un} valor={n.meses[i]} onCommit={(v) => mudarMes(i, v)} travado={fechado}
                estilo={trav ? { borderColor: C.navy, fontWeight: 700 } : sug ? { borderColor: C.accent, color: C.accent, background: C.accentSoft } : {}} />
              {ticket ? n.meses[i] != null && <div className="text-[10px] text-right mt-0.5" style={{ color: C.navy }}>{n.un === "pc" ? `R$ ${fmt("R$", n.meses[i] * ticket)}` : `${fmt("pc", n.meses[i] / ticket)} peças`}</div> : null}
              {n.fonte && n.historico?.[n.fonte]?.medias && <div className="text-[10px] text-right" style={{ color: C.sub }}>hist. {fmt(n.un, n.historico[n.fonte].medias[i])}</div>}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: C.sub }}>
        <span>Soma dos meses: <b style={{ color: C.text }}>{fmt(n.un, total)}</b></span>
        {dif !== 0 && n.anual != null && <span style={{ color: C.red }}>diferença para a meta do ano: <b>{fmt(n.un, dif)}</b> {n.travados.size === 12 ? "(todos os meses fixados — solte um em aberto para fechar)" : ""}</span>}
        {fech.some(Boolean) && <span><Lock size={10} className="inline" /> {fech.filter(Boolean).length} mês(es) fechado(s) com o realizado do KPI — o que falta da meta do ano vai para os meses em aberto</span>}
        {[...n.travados].filter((i) => !fech[i]).length > 0 && <span><Lock size={10} className="inline" /> {[...n.travados].filter((i) => !fech[i]).length} mês(es) fixado(s) por você</span>}
      </div>
    </div>
  );
}

export default function MetasPagina({ user, anoInicial, freelaInicial, irCapacidade }) {
  const [ano, setAno] = useState(anoInicial || new Date().getFullYear());
  const [orig, setOrig] = useState(null);
  const [vend, setVend] = useState(null);   // v221: vendas (R$) — a meta que você define
  const [margem, setMargem] = useState(null);
  const [freela, setFreela] = useState(null);   // v224: % freelancer (em %)
  const [ticket, setTicket] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [matriz, setMatriz] = useState(null);   // v219: matriz oficial para o impacto ao vivo
  const carregarMatriz = async () => {
    try {
      const l = await api(`/api/fin/matriz?u=${user.id}`);
      const of = l.find((x) => x.oficial);
      if (of) setMatriz((await api(`/api/fin/matriz/${of.id}?u=${user.id}`)).dados);
    } catch { setMatriz(null); }
  };
  useEffect(() => { carregarMatriz(); }, []);
  // v246 — capacidade da equipe (histórico de 3 meses) para os cenários A e B da meta, ao vivo
  const [cap, setCap] = useState(null);
  useEffect(() => { setCap(null); fetch(`/api/kpi/capacidade?u=${user.id}&meses=3&ano=${ano}`).then((r) => r.json()).then((d) => setCap(d.error ? null : d)).catch(() => setCap(null)); }, [ano]);

  const montar = (d) => {
    // v241 — a meta que você define é o FATURAMENTO (R$); sem ela gravada, vendas R$ ou peças faturadas × ticket
    let v = d.naturezas.find((n) => n.k === "faturamentoValor");
    if (v.meses.every((x) => x == null)) { const vv = d.naturezas.find((n) => n.k === "vendasValor"); if (vv.meses.some((x) => x != null)) v = { ...vv, k: "faturamentoValor", historico: v.historico }; }
    if (v.meses.every((x) => x == null) && d.ticket) {
      const p = d.naturezas.find((n) => n.k === "faturamentoPecas");
      const meses = p.meses.map((x) => (x == null ? null : r2(x * d.ticket)));
      v = { ...v, meses, anual: meses.some((x) => x != null) ? r2(meses.reduce((s2, x) => s2 + (x || 0), 0)) : null };
    }
    const fechados = d.fechados || Array(12).fill(false);
    const trav = new Set(fechados.map((f, i) => (f ? i : -1)).filter((i) => i >= 0));
    // v236/v241 — mês fechado entra com o REALIZADO (faturamento R$ do KPI); a meta do ano que falta vai para os meses em aberto
    const rv = d.realizado?.faturamentoValor || [];
    const comReal = v.meses.map((x, i) => (fechados[i] && rv[i] != null ? r2(rv[i]) : x));
    const base = { ...v, meses: comReal };
    const ajust = base.anual != null && trav.size ? redistribuir("R$", base.anual, comReal, trav, v.meses) : comReal;
    setOrig({ ...d, vend: base });
    setVend({ ...base, meses: ajust, rotulo: "Faturamento (R$)", grupo: "Meta que você define", fechados, travados: trav, pesos: v.meses });
    setMargem(d.margem != null ? r2(d.margem * 100) : null);
    setFreela(freelaInicial != null && !d.__salvo ? freelaInicial : d.freelancer?.meta != null ? r2(d.freelancer.meta * 100) : null);
    setTicket(d.ticket != null ? r2(d.ticket) : null);
  };
  useEffect(() => {
    setVend(null); setErro("");
    api(`/api/kpi/metas?u=${user.id}&ano=${ano}`).then(montar).catch((e) => setErro(e.message));
  }, [ano]);

  const salvar = async () => {
    setSalvando(true); setErro(""); setAviso("");
    try {
      montar(Object.assign(await api("/api/kpi/metas", "POST", { usuarioId: user.id, ano, metas: { faturamentoValor: { anual: vend.anual, meses: vend.meses } },
        margem: margem == null ? "" : margem, ticket: ticket == null ? "" : ticket, freelancer: freela == null ? "" : freela }), { __salvo: true }));
      setAviso("Metas gravadas. Já valem nos KPIs e na Matriz de custos.");
      carregarMatriz();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  // v234 — meses fechados: as peças da meta ficam como gravadas (o ticket só vale para os meses em aberto)
  const der = vend ? derivarMetas(vend.meses, ticket, orig?.receitaJan?.valor, orig?.realizado) : null;
  // v219 — impacto ao vivo na Matriz oficial: metas da tela (ainda não gravadas) × metas gravadas
  const vivo = (() => {
    if (!matriz || !der) return null;
    try {
      const hoje = new Date(), mesI = ano === hoje.getFullYear() ? hoje.getMonth() : 0;
      const pcsAno = der.faturamentoPecas.anual;
      const mg = { ...(matriz.metasGestao || {}), ano, nomeMes: `${MESES[mesI]}/${ano}`,
        fatAno: der.faturamentoValor.anual, fatMes: der.faturamentoValor.meses[mesI], pcsAno, pcsMedia: pcsAno ? pcsAno / 12 : null,
        ticket, fonteTicket: "ticket médio das Metas", margem: margem != null ? margem / 100 : matriz.metasGestao?.margem ?? null,
        pctFreelancer: freela != null ? freela / 100 : null,
        // v239 — fechamento do ano ao vivo: meses fechados = realizado (DRE, vindo da oficial); abertos = metas desta tela
        ...(matriz.metasGestao?.realizado && ano === matriz.metasGestao?.ano ? { mes: mesI + 1, fatMeses: der.faturamentoValor.meses, pcsMeses: der.faturamentoPecas.meses } : { realizado: null, fatMeses: null }) };
      const dv = aplicarMetas(matriz, mg);
      return { calc: calcularMatriz(dv), calcOf: calcularMatriz(matriz), pr: dv.producao, mg };
    } catch { return null; }
  })();
  const LINHAS = [
    ["faturamentoPecas", "Peças faturadas (= produzidas)", "pc", "faturamento R$ ÷ ticket · fechado: realizado"],
    ["vendasValor", "Vendas (R$)", "R$", "= faturamento do mês · fechado: realizado"],
    ["vendasPecas", "Vendas (peças)", "pc", "= peças faturadas · fechado: realizado"],
    ["receitaValor", "Receita (R$)", "R$", `= faturamento do mês anterior · JAN: ${orig?.receitaJan?.fonte || "—"}`],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setAno(ano - 1)} className="px-3 py-2 font-bold" style={{ color: C.sub }}>‹</button>
          <div className="px-4 py-2 font-bold text-lg flex items-center gap-2" style={{ color: C.navy }}><Target size={16} style={{ color: C.accent }} /> Metas de {ano}</div>
          <button onClick={() => setAno(ano + 1)} className="px-3 py-2 font-bold" style={{ color: C.sub }}>›</button>
        </div>
        <div className="text-xs flex-1" style={{ color: C.sub }}>
          Você define a meta de <b>faturamento (R$)</b> e o <b>ticket médio</b>; peças, vendas e receita saem daí. Meses já fechados no KPI entram com o realizado e ficam travados. Mude a meta do ano e os meses se ajustam (ou use a distribuição histórica); mês alterado à mão fica fixo e os outros recebem a sugestão.
        </div>
        {vend && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar metas
        </button>}
      </div>
      {erro && <div className="p-3 rounded mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && <div className="p-3 rounded mb-4 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {!vend && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {vend && (
        <>
        {/* v232 — linha de cima: 3 cards + vendas (esquerda) × Metas e resultado (direita), com a base alinhada */}
        <div className="grid gap-4 items-stretch grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <CardMeta rotulo="META QUE VOCÊ DEFINE" titulo="Ticket médio" sub="R$ por peça" campo="R$" valor={ticket} onCommit={setTicket}>
              {!orig.ticketGravado && orig.ticket != null && <div style={{ color: C.sub }}>Sugerido: faturamento ÷ peças das metas atuais.</div>}
              {orig.ticketRealizado?.atual && <Linha k={`Realizado ${ano} (${orig.ticketRealizado.atual.meses} ${orig.ticketRealizado.atual.meses === 1 ? "mês" : "meses"})`}
                v={`R$ ${fmt("R$", orig.ticketRealizado.atual.valor)}`}
                acao={Math.abs(orig.ticketRealizado.atual.valor - (ticket ?? 0)) >= 0.01 ? ["usar este", () => setTicket(orig.ticketRealizado.atual.valor)] : null} />}
              {orig.ticketRealizado?.anterior && <Linha k={`Realizado ${ano - 1}`} v={`R$ ${fmt("R$", orig.ticketRealizado.anterior.valor)}`} />}
            </CardMeta>
            <CardMeta rotulo="RESULTADO" titulo="Margem de contribuição" sub="sobre o faturamento" campo="Meta (%)" valor={margem} onCommit={setMargem}>
              <div style={{ color: C.sub }}>Entra na Matriz de custos como meta de margem do ano.</div>
            </CardMeta>
            {(() => {
              const F = orig.freelancer || {};
              const p = (v) => `${fmt("R$", v * 100)}%`;
              const nomeC = (c) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;
              // v246 — cenários da Capacidade para a meta desta tela (período em aberto inteiro)
              const per = cap && der ? (() => {
                const pm = der.faturamentoPecas.meses.map((x) => Number(x) || 0), fe = orig.fechados || [];
                const A = planoMensal({ setores: cap.setores, pecasMes: pm, ano, fechados: fe, semContratar: true }).periodo;
                const B = planoMensal({ setores: cap.setores, pecasMes: pm, ano, fechados: fe }).periodo;
                return A.meses ? { A, B } : null;
              })() : null;
              const usar = (v) => (v != null && Math.abs(v * 100 - (freela ?? -1)) >= 0.01 ? [`usar ${p(v)}`, () => setFreela(r2(v * 100))] : null);
              return (
                <CardMeta rotulo="PRODUÇÃO" titulo="% de freelancer" sub="cenários da capacidade para esta meta (período em aberto)" campo="Meta (%)" valor={freela} onCommit={setFreela}>
                  {per ? <>
                    <Linha k={`A · manter equipe (até ${per.A.picoFreeDia} free/dia)`} v={p(per.A.pct)} acao={usar(per.A.pct)} />
                    <Linha k={`B · recomendado (+${per.B.contratar}${per.B.demitir ? ` −${per.B.demitir}` : ""} pessoas)`} v={p(per.B.pct)} acao={usar(per.B.pct)} />
                  </> : <div style={{ color: C.sub }}>{cap ? "Sem meses em aberto ou sem dados de capacidade." : "Calculando cenários…"}</div>}
                  {F.media3 && <Linha k={`Real · média ${F.media3.meses} ${F.media3.meses === 1 ? "mês" : "meses"}`} v={p(F.media3.pct)} />}
                  {freelaInicial != null && <div className="font-semibold" style={{ color: C.accent }}>Trazido da análise de capacidade — confira e salve.</div>}
                  {irCapacidade && <button onClick={irCapacidade} className="font-semibold underline text-left" style={{ color: C.blue }}>Detalhar capacidade →</button>}
                </CardMeta>
              );
            })()}
          </div>
          <CardNatureza n={vend} original={orig.vend} set={setVend} ticket={ticket} />
        </div>
        {vivo && (
          <div className="relative min-h-[420px]">
            <div className="xl:absolute xl:inset-0 xl:overflow-y-auto h-full">
              <CardMetasResultado cheio calc={vivo.calc} calcOf={vivo.calcOf} pr={vivo.pr} mg={vivo.mg} rotuloRef="gravado"
                nota="Matriz oficial ao vivo com as metas desta tela, comparada com as gravadas." />
            </div>
          </div>
        )}
        </div>

          <div className="rounded-xl overflow-x-auto mt-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="px-4 pt-3 pb-1">
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>CALCULADAS (COERENTES COM FATURAMENTO E TICKET)</div>
              <div className="text-xs" style={{ color: C.sub }}>Não se editam aqui: mudam quando você muda o faturamento ou o ticket.</div>
            </div>
            <table className="w-full text-xs">
              <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
                <th className="text-left px-3 py-2">Meta</th>
                {MESES.map((m) => <th key={m} className="text-right px-2 py-2 font-semibold">{m}</th>)}
                <th className="text-right px-3 py-2 font-bold" style={{ color: C.navy }}>ANO</th>
              </tr></thead>
              <tbody>{LINHAS.map(([k, t, un, ajuda]) => (
                <tr key={k} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td className="px-3 py-2 whitespace-nowrap"><div className="font-semibold" style={{ color: C.navy }}>{t}</div><div className="text-[10px]" style={{ color: C.sub }}>{ajuda}</div></td>
                  {der[k].meses.map((v, i) => <td key={i} className="text-right px-2 py-2 tabular-nums">{v == null ? "—" : fmt(un, v)}</td>)}
                  <td className="text-right px-3 py-2 tabular-nums font-bold">{der[k].anual == null ? "—" : fmt(un, der[k].anual)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
      {vend && <CapacidadeMensal user={user} ano={ano} cap={cap} pecasMes={der.faturamentoPecas.meses} metaFreela={freela} irCapacidade={irCapacidade} fechados={orig?.fechados || []} />}
    </div>
  );
}
