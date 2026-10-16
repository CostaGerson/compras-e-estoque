"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import MetasPagina from "./metas";
import Capacidade from "./capacidade";
import {
  Target, Factory, Receipt, Wallet, BarChart3, History, ArrowLeft, Pencil, Save, X,
  Upload, Loader2, ChevronLeft, ChevronRight, ChevronDown, Grid3x3,
} from "lucide-react";

/* Paleta Meridian */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41", trilho: "#E9EDF3", marca: "#C3CBD6",
};
/* Canais da receita — ordem validada para daltonismo. Não troque a ordem sem revalidar. */
const CORES_SEG = ["#2E7CD6", "#FF6B1A", "#0E9384", "#C08401", "#DD2590"];

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(0)}%`);
const pct1 = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
// 1.284 · 12,9 mil · 4,2 mi — para o número grande do card
const compacto = (v, unidade) => {
  const x = Number(v) || 0;
  const pre = unidade === "R$" ? "R$ " : "";
  if (Math.abs(x) >= 1e6) return `${pre}${(x / 1e6).toFixed(2).replace(".", ",")} mi`;
  if (Math.abs(x) >= 1e4) return `${pre}${(x / 1e3).toFixed(1).replace(".", ",")} mil`;
  return unidade === "R$" ? `R$ ${brl(x)}` : inteiro(x);
};
const valorCheio = (v, unidade) => (unidade === "R$" ? `R$ ${brl(v)}` : `${inteiro(v)} peças`);

const mesesTxt = (n) => `${n} ${n === 1 ? "mês lançado" : "meses lançados"}`;

const api = async (url, method, body) => {
  const r = await fetch(url, method ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro na operação.");
  return d;
};
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });

/* ============================================================ */
export default function Gestao({ user, master, money, irMatriz, telaInicial }) {
  const [tela, setTela] = useState(telaInicial?.v ? { v: telaInicial.v, ano: telaInicial.ano } : { v: "painel" });
  const voltar = () => setTela({ v: "painel" });
  return (
    <div>
      {tela.v !== "painel" && (
        <div className="flex items-center gap-1 text-sm mb-4">
          <button onClick={voltar} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}>
            <ArrowLeft size={15} /> Voltar
          </button>
          <button onClick={voltar} className="hover:underline" style={{ color: C.sub }}>Gestão</button>
          <ChevronRight size={14} style={{ color: C.sub }} />
          <span>{tela.v === "metas" ? `Metas de ${tela.ano}` : tela.v === "capacidade" ? "Capacidade × freelancer" : `Relatório de KPIs ${tela.ano}`}</span>
        </div>
      )}
      {tela.v === "painel"
        ? <Painel user={user} master={master} money={money} irMatriz={irMatriz} abrirCapacidade={() => setTela({ v: "capacidade" })} abrirRelatorio={(ano) => setTela({ v: "relatorio", ano })} abrirMetas={(ano) => setTela({ v: "metas", ano })} />
        : tela.v === "metas" ? <MetasPagina key={`metas-${tela.ano}-${tela.t || ""}`} user={user} anoInicial={tela.ano} freelaInicial={tela.freela} rascunho={tela.rascunho} irMatriz={irMatriz}
            irCapacidade={(mt) => setTela({ v: "capacidade", metas: mt || null })} />
        : tela.v === "capacidade" ? <Capacidade user={user} irMatriz={irMatriz} metasTela={tela.metas}
            voltarMetas={tela.metas ? () => setTela({ v: "metas", ano: tela.metas.ano, rascunho: tela.metas.rascunho, t: Date.now() }) : null}
            usarNaMeta={(p) => setTela({ v: "metas", ano: tela.metas?.ano || new Date().getFullYear(), rascunho: tela.metas?.rascunho, freela: Math.round(p * 10000) / 100, t: Date.now() })} />
        : <Relatorio key={tela.ano} user={user} master={master} money={money} anoInicial={tela.ano} abrirMetas={(ano) => setTela({ v: "metas", ano })} />}
    </div>
  );
}

/* ---------------- PAINEL (tela inicial da Gestão) ---------------- */
function Painel({ user, master, money, abrirRelatorio, abrirMetas, irMatriz, abrirCapacidade }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setErro("");
    try { setD(await api(`/api/kpi/painel?u=${user.id}&ano=${ano}&mes=${mes}`)); }
    catch (e) { setErro(e.message); setD(null); }
  };
  useEffect(() => { setD(null); carregar(); }, [ano, mes]);

  const andar = (n) => {
    let m = mes + n, a = ano;
    if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; }
    setAno(a); setMes(m);
  };

  const anoAnterior = (d?.anos || []).find((x) => x < ano) ?? ano - 1;

  return (
    <div>
      {/* período */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 rounded-lg px-1" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <button onClick={() => andar(-1)} className="p-1.5" style={{ color: C.sub }} title="Mês anterior"><ChevronLeft size={16} /></button>
          <div className="px-2 font-semibold" style={{ color: C.navy, minWidth: 140, textAlign: "center" }}>
            {MESES_LONGO[mes - 1]} / {ano}
          </div>
          <button onClick={() => andar(1)} className="p-1.5" style={{ color: C.sub }} title="Próximo mês"><ChevronRight size={16} /></button>
        </div>
        {d && (
          <div className="text-xs" style={{ color: C.sub }}>
            {d.calendario.fechado
              ? "Ano fechado"
              : `${d.calendario.decorridos} ${d.calendario.decorridos === 1 ? "mês decorrido" : "meses decorridos"} · ${d.calendario.restantes} para fechar o ano`}
          </div>
        )}
        <div className="flex-1" />
        {d?.podeEditar && abrirCapacidade && (
          <button onClick={abrirCapacidade} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, color: C.navy, background: C.panel }}
            title="Capacidade × freelancer: quanto gastar e quantos contratar para a meta"><Factory size={15} /> Capacidade</button>
        )}
        {irMatriz && (
          <button onClick={irMatriz} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: "#fff" }}
            title="Abre a Matriz de custos (Financeiro)"><Grid3x3 size={15} /> Matriz de custos</button>
        )}
        {d?.podeEditar && (
          <button onClick={() => abrirMetas(ano)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ border: `1px solid ${C.accent}`, color: C.accent }}>
            <Target size={15} /> Metas de {ano}
          </button>
        )}
        {abrirRelatorio && (
          <button onClick={() => abrirRelatorio(ano)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }} title="Relatório de KPIs do ano">
            <BarChart3 size={15} /> KPIs de {ano}
          </button>
        )}
      </div>

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {d && (
        <>
          {/* ---- os 5 KPIs do mês ---- */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {d.kpis.map((k) => (
              <CardKpi key={k.chave} k={k} mes={mes} ano={ano} user={user} master={master || d.veValores} money={money} />
            ))}
            {!d.restrito && <CardReceitaCanais canais={d.canais} total={d.receitaMes} master={master} money={money} />}
            {d.restrito && !d.kpis.length && (
              <div className="rounded-xl p-5 text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>
                <b style={{ color: C.navy }}>Metas e evolução da meta do seu setor</b><br />Entram aqui quando o cronômetro do chão de fábrica estiver no ar.
              </div>
            )}
          </div>

          {/* ---- indicadores do ano ---- */}
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>
              INDICADORES DO ANO · {ano} ATÉ AQUI
            </div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Indicador rotulo="Ticket médio" valor={master || d.veValores ? `R$ ${brl(d.anuais.ticketMedio)}` : "•••••"}
              detalhe={`faturamento ÷ peças faturadas`} delta={d.anuais.vsAnterior?.ticketMedio} anoRef={anoAnterior} Ico={Receipt} />
            <Indicador rotulo="Média mensal de peças faturadas" valor={d.anuais.mediaPecasFaturadas == null ? "—" : inteiro(d.anuais.mediaPecasFaturadas)}
              detalhe={mesesTxt(d.anuais.bases?.pecasFaturadas || 0)} delta={d.anuais.vsAnterior?.mediaPecasFaturadas} anoRef={anoAnterior} Ico={Factory} />
            <Indicador rotulo="Média mensal de faturamento" valor={d.anuais.mediaFaturamento == null ? "—" : master || d.veValores ? compacto(d.anuais.mediaFaturamento, "R$") : "•••••"}
              detalhe={mesesTxt(d.anuais.bases?.faturamento || 0)} delta={d.anuais.vsAnterior?.mediaFaturamento} anoRef={anoAnterior} Ico={Wallet} />
          </div>

          {!d.restrito && <>
          {/* ---- acesso aos relatórios ---- */}
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>RELATÓRIO DE KPIs</div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <CardAcesso Ico={BarChart3} titulo={`KPIs ${ano}`} sub="Vendas, faturamento e receita do ano corrente, mês a mês, contra a meta"
              onClick={() => abrirRelatorio(ano)} destaque />
            <CardAcesso Ico={History} titulo="Histórico" sub={`Anos fechados — ${(d.anos || []).filter((a) => a < ano).join(", ") || "sem histórico"}`}
              onClick={() => abrirRelatorio(anoAnterior)} />
          </div>
          </>}
        </>
      )}

    </div>
  );
}

/* cor do medidor pelo quanto da meta foi atingido */
function corMeta(p) {
  if (p === null || p === undefined) return [C.sub, C.trilho];
  if (p >= 1) return [C.green, "#CDEBDA"];
  if (p >= 0.8) return [C.accent, "#FFE0CC"];
  if (p >= 0.5) return [C.yellow, "#F6E6BC"];
  return [C.red, "#F7CFCB"];
}

/* Card de KPI: número + medidor contra a meta + os 12 meses do ano */
/* Medidor circular: trilho = passo claro da mesma cor; o texto do meio usa cor de texto, não a da série */
function Rosca({ p, cor, trilho, tamanho = 96, espessura = 11 }) {
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const cheio = Math.max(0, Math.min(1, p || 0));
  const c = tamanho / 2;
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="shrink-0"
      role="img" aria-label={p === null ? "sem meta" : `${Math.round(p * 100)}% da meta`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={trilho} strokeWidth={espessura} />
      {cheio > 0 && (
        <circle cx={c} cy={c} r={r} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={`${circ * cheio} ${circ}`} transform={`rotate(-90 ${c} ${c})`} />
      )}
      <text x={c} y={c} textAnchor="middle" dominantBaseline="central"
        style={{ fill: C.text, fontSize: 19, fontWeight: 600 }}>
        {p === null ? "—" : `${Math.round(p * 100)}%`}
      </text>
      <text x={c} y={c + 17} textAnchor="middle" dominantBaseline="central"
        style={{ fill: C.sub, fontSize: 9.5 }}>
        {p === null ? "sem meta" : "da meta"}
      </text>
    </svg>
  );
}

function CardKpi({ k, mes, ano, user, master, money }) {
  const [hover, setHover] = useState(null);
  const [ranking, setRanking] = useState(null);   // mês aberto no ranking de clientes
  const esconder = k.unidade === "R$" && !master;
  const comRanking = !!user && ["vendasPecas", "vendasValor", "faturamentoValor", "receitaValor"].includes(k.chave) && !esconder;
  const temValor = k.valor !== null && k.valor !== undefined;
  const p = temValor && k.meta ? k.valor / k.meta : null;
  const [cor, trilho] = corMeta(p);
  
  const i = hover === null ? mes - 1 : hover;
  const vSerie = k.serie[i], mSerie = k.metaSerie[i];

  return (
    <div className="rounded-xl p-4 flex flex-col relative" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${cor}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold" style={{ color: C.sub }}>
          {k.rotulo} <span style={{ fontWeight: 400 }}>({k.unidade === "R$" ? "R$" : "peças"})</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
          style={{ background: k.derivado ? C.blueSoft : C.panel2, color: k.derivado ? C.blue : C.sub }} title={k.fonte}>
          {k.derivado ? "= faturadas" : "manual"}
        </span>
      </div>

      {/* medidor circular + número do mês */}
      <div className="mt-2 flex items-center gap-4">
        <Rosca p={p} cor={cor} trilho={trilho} />
        <div className="min-w-0">
          {comRanking && temValor ? (
            <button onClick={() => setRanking(ranking ? null : mes)} title="Ver os 10 maiores clientes do mês"
              className="font-semibold flex items-center gap-1" style={{ fontSize: 28, lineHeight: 1.1, color: C.text }}>
              {compacto(k.valor, k.unidade)}
              <ChevronDown size={18} style={{ color: C.accent, transform: ranking ? "rotate(180deg)" : "none" }} />
            </button>
          ) : (
          <div className="font-semibold" style={{ fontSize: 28, lineHeight: 1.1, color: temValor ? C.text : C.sub }}>
            {!temValor ? "—" : esconder ? "•••••" : compacto(k.valor, k.unidade)}
          </div>
          )}
          <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>
            {k.meta ? (esconder ? "meta •••••" : `meta ${compacto(k.meta, k.unidade)}`) : "sem meta no mês"}
          </div>
          {p !== null && k.meta && (
            <div className="text-[11px]" style={{ color: p >= 1 ? C.green : C.sub }}>
              {p >= 1
                ? `${esconder ? "•••••" : compacto(k.valor - k.meta, k.unidade)} acima`
                : `faltam ${esconder ? "•••••" : compacto(k.meta - k.valor, k.unidade)}`}
            </div>
          )}
        </div>
      </div>

      {/* os 12 meses do ano: cinza = outros meses, laranja = o mês aberto, traço = meta */}
      <div className="mt-3">
        <MiniColunas serie={k.serie} metaSerie={k.metaSerie} destaque={mes - 1} hover={hover} setHover={setHover} cor={cor}
          onClique={comRanking ? (i) => k.serie[i] != null && setRanking(i + 1) : null} />
        <div className="text-[11px] mt-1" style={{ color: C.sub, minHeight: 16 }}>
          {hover === null
            ? k.fonte
            : `${MESES[i]}: ${vSerie == null ? "sem lançamento" : esconder ? "•••••" : valorCheio(vSerie, k.unidade)}${mSerie ? ` · meta ${esconder ? "•••••" : valorCheio(mSerie, k.unidade)}` : ""}${comRanking && vSerie != null ? " · clique para ver os clientes" : ""}`}
        </div>
      </div>
      {ranking && <RankingClientes user={user} ano={ano} mes={ranking} kpi={k.chave} rotulo={`${k.rotulo}${k.unidade === "R$" ? "" : " (peças)"}`} onClose={() => setRanking(null)} />}
    </div>
  );
}

/* Menu suspenso: os 10 clientes que mais compraram peças no mês */
function RankingClientes({ user, ano, mes, kpi, rotulo, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    setD(null); setErro("");
    api(`/api/kpi/clientes?u=${user.id}&ano=${ano}&mes=${mes}&kpi=${kpi}`).then(setD).catch((e) => setErro(e.message || "Erro"));
  }, [ano, mes, kpi]);
  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, []);
  const max = Math.max(1, ...(d?.top || []).map((x) => x.valor));
  const fmt = (v) => (d?.unidade === "R$" ? `R$ ${brl(v)}` : inteiro(v));
  return (
    <div ref={ref} className="absolute left-3 right-3 z-30 rounded-xl p-3 shadow-xl" style={{ top: 96, background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold" style={{ color: C.navy }}>Top 10 clientes · {rotulo} · {MESES_LONGO[mes - 1]}/{ano}</div>
        <button onClick={onClose} style={{ color: C.sub }}><X size={14} /></button>
      </div>
      {erro && <div className="text-xs" style={{ color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="text-xs" style={{ color: C.sub }}>Carregando…</div>}
      {d && !d.top.length && <div className="text-xs" style={{ color: C.sub }}>{d.vazio || `Nada por cliente registrado neste mês. Fonte: ${d.fonte.toLowerCase()}.`}</div>}
      {d && d.top.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            {d.top.map((c, i) => (
              <div key={c.cliente} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums" style={{ color: i < 3 ? C.accent : C.sub, width: 18 }}>{i + 1}º</span>
                  <span className="flex-1 truncate" title={c.cliente} style={{ color: C.text }}>{c.cliente}</span>
                  <span className="font-semibold tabular-nums" style={{ color: C.text }}>{fmt(c.valor)}</span>
                </div>
                <div className="h-1 rounded-full mt-0.5" style={{ marginLeft: 26, background: C.trilho }}>
                  <div className="h-1 rounded-full" style={{ width: `${(c.valor / max) * 100}%`, background: i < 3 ? C.accent : C.marca }} />
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] mt-2 pt-2" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
            {fmt(d.top.reduce((s, x) => s + x.valor, 0))} de {fmt(d.total)}{d.unidade === "R$" ? "" : " peças"} · {d.clientes} {d.clientes === 1 ? "cliente" : "clientes"} no mês
            <div>Fonte: {d.fonte.toLowerCase()}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* 12 colunas finas + marca da meta; hover devolve o índice do mês */
function MiniColunas({ serie, metaSerie, destaque, hover, setHover, cor, onClique }) {
  const alt = 52;
  const max = Math.max(1, ...serie.map((v) => v || 0), ...metaSerie.map((v) => v || 0));
  return (
    <div className="flex items-end gap-[3px]" style={{ height: alt }} onMouseLeave={() => setHover(null)}>
      {serie.map((v, i) => {
        const h = ((v || 0) / max) * alt;
        const hm = ((metaSerie[i] || 0) / max) * alt;
        const atual = i === destaque;
        const ativo = hover === i;
        return (
          <div key={i} className="relative flex-1 flex items-end" style={{ height: alt, cursor: onClique && v != null ? "pointer" : "default" }}
            onMouseEnter={() => setHover(i)} onClick={onClique ? () => onClique(i) : undefined}>
            {/* marca da meta */}
            {hm > 0 && <div className="absolute left-0 right-0" style={{ bottom: Math.min(alt - 2, hm), height: 2, background: C.marca, borderRadius: 2 }} />}
            <div style={{
              width: "100%", height: Math.max(v ? 3 : 0, h),
              background: atual ? cor : ativo ? C.sub : C.trilho,
              borderRadius: "4px 4px 0 0",
            }} />
          </div>
        );
      })}
    </div>
  );
}

/* Receita do mês repartida por canal */
function CardReceitaCanais({ canais, total, master, money }) {
  const [hover, setHover] = useState(null);
  const ativos = canais.filter((c) => c.valor > 0);
  const soma = ativos.reduce((s, c) => s + c.valor, 0) || 0;
  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${C.navy}` }}>
      <div className="text-xs font-semibold" style={{ color: C.sub }}>Receita por canal</div>
      <div className="mt-1 font-semibold" style={{ fontSize: 30, lineHeight: 1.1, color: soma ? C.text : C.sub }}>
        {!soma ? "—" : master ? compacto(soma, "R$") : "•••••"}
      </div>

      {soma > 0 ? (
        <>
          <div className="flex mt-3 rounded-full overflow-hidden" style={{ height: 10, gap: 2 }}>
            {ativos.map((c, i) => (
              <div key={c.segmento} title={c.segmento}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                style={{ width: `${(c.valor / soma) * 100}%`, background: c.cor || CORES_SEG[i % CORES_SEG.length], opacity: hover === null || hover === i ? 1 : 0.45 }} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            {ativos.map((c, i) => (
              <div key={c.segmento} className="flex items-center gap-2 text-xs"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}>
                <span className="shrink-0 rounded" style={{ width: 10, height: 10, background: c.cor || CORES_SEG[i % CORES_SEG.length] }} />
                <span className="flex-1 truncate" style={{ color: C.text }}>{c.segmento}</span>
                <span style={{ color: C.sub }}>{pct(c.valor / soma)}</span>
                <span className="font-medium tabular-nums" style={{ color: C.text, minWidth: 92, textAlign: "right" }}>
                  {master ? `R$ ${brl(c.valor)}` : "•••••"}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs mt-3" style={{ color: C.sub }}>Sem receita lançada neste mês.</div>
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, delta, anoRef, Ico }) {
  const bom = delta === null || delta === undefined ? null : delta >= 0;
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: C.sub }}>
        <Ico size={14} style={{ color: C.accent }} /> {rotulo}
      </div>
      <div className="mt-1 font-semibold" style={{ fontSize: 26, lineHeight: 1.15, color: C.text }}>{valor}</div>
      <div className="flex items-center gap-2 text-[11px] mt-1" style={{ color: C.sub }}>
        <span>{detalhe}</span>
        {bom !== null && (
          <span className="px-1.5 rounded font-semibold" style={{ background: bom ? C.greenSoft : C.redSoft, color: bom ? C.green : C.red }}>
            {delta >= 0 ? "+" : ""}{pct1(delta)} vs {anoRef}
          </span>
        )}
      </div>
    </div>
  );
}

function CardAcesso({ Ico, titulo, sub, onClick, destaque }) {
  return (
    <button onClick={onClick} className="rounded-xl p-4 text-left flex items-start gap-3"
      style={{ background: C.panel, border: `1px solid ${destaque ? C.accent : C.line}` }}>
      <span className="rounded-lg p-2 shrink-0" style={{ background: destaque ? C.accentSoft : C.panel2 }}>
        <Ico size={18} style={{ color: destaque ? C.accent : C.navy }} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold" style={{ color: C.text }}>{titulo}</span>
        <span className="block text-xs mt-0.5" style={{ color: C.sub }}>{sub}</span>
      </span>
    </button>
  );
}

/* ---------------- RELATÓRIO DE KPIs (no formato da planilha) ---------------- */
function Relatorio({ user, master, money, anoInicial, abrirMetas }) {
  const [ano, setAno] = useState(anoInicial || new Date().getFullYear());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [editar, setEditar] = useState(null);   // { mes }
  const impInp = useRef(null);
  const [importando, setImportando] = useState(false);

  const carregar = async () => {
    setErro("");
    try { setD(await api(`/api/kpi?u=${user.id}&ano=${ano}`)); }
    catch (e) { setErro(e.message); setD(null); }
  };
  useEffect(() => { setD(null); carregar(); }, [ano]);

  const importar = async (file) => {
    if (!file) return;
    setImportando(true);
    try {
      const r = await api("/api/kpi/importar", "POST", { usuarioId: user.id, conteudo: await readB64(file) });
      setAviso({ tipo: "ok", texto: `Importado: ${r.meses} mês(es), ${r.receitas} linha(s) de receita${r.metas.length ? `, metas de ${r.metas.join(" e ")}` : ""}.${r.avisos?.length ? " " + r.avisos.join(" ") : ""}` });
      carregar();
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
    setImportando(false);
  };

  if (erro) return <div className="p-3 rounded" style={{ background: C.redSoft, color: C.red }}>{erro}</div>;
  if (!d) return <div style={{ color: C.sub }}>Carregando…</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.navy }}>
          {d.anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="text-xs" style={{ color: C.sub }}>
          comparado com {d.anoAnterior} · {d.calendario.fechado ? "ano fechado" : `${d.calendario.restantes} ${d.calendario.restantes === 1 ? "mês" : "meses"} para fechar`}
        </div>
        <div className="flex-1" />
        {d.podeEditar && (
          <>
            <input ref={impInp} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={() => impInp.current?.click()} disabled={importando}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: C.panel2, color: C.navy, opacity: importando ? 0.5 : 1 }}>
              {importando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Importar Excel
            </button>
            <button onClick={() => abrirMetas(ano)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ border: `1px solid ${C.accent}`, color: C.accent }}>
              <Target size={15} /> Metas do ano
            </button>
          </>
        )}
      </div>

      {aviso && (
        <div className="p-3 rounded mb-4 flex items-start gap-2 text-sm"
          style={{ background: aviso.tipo === "ok" ? C.greenSoft : C.redSoft, color: aviso.tipo === "ok" ? C.green : C.red }}>
          <div className="flex-1">{aviso.texto}</div>
          <button onClick={() => setAviso(null)}><X size={14} /></button>
        </div>
      )}

      <ResumoAno d={d} master={master} />

      <TabelaVendas d={d} master={master} onEditar={(m) => d.podeEditar && setEditar({ mes: m })} />
      <TabelaFaturamento d={d} master={master} onEditar={(m) => d.podeEditar && setEditar({ mes: m })} />
      <TabelaReceita d={d} master={master} onEditar={(m) => d.podeEditar && setEditar({ mes: m })} />

      {editar && <LancamentoModal user={user} d={d} mes={editar.mes} onClose={() => setEditar(null)}
        onSalvo={(novo) => { setD((x) => ({ ...novo, anos: x.anos, podeEditar: x.podeEditar, segmentosPadrao: x.segmentosPadrao })); setEditar(null); }} />}
    </div>
  );
}

function ResumoAno({ d, master }) {
  const cx = (meta, real) => (meta ? real / meta : null);
  const itens = [
    { rot: "Vendas", real: d.totais.vendas, meta: d.metas.vendas, gap: d.gap.vendas, un: "R$" },
    { rot: "Faturamento", real: d.totais.faturamento, meta: d.metas.faturamento, gap: d.gap.faturamento, un: "R$" },
    { rot: "Receita", real: d.totais.receita, meta: d.metas.receita, gap: d.gap.receita, un: "R$" },
  ];
  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      {itens.map((it) => {
        const p = cx(it.meta, it.real);
        const [cor, trilho] = corMeta(p);
        return (
          <div key={it.rot} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-xs font-semibold" style={{ color: C.sub }}>{it.rot} acumulado</div>
            <div className="mt-1 font-semibold" style={{ fontSize: 24, color: C.text }}>{master ? compacto(it.real, it.un) : "•••••"}</div>
            <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: trilho }}>
              <div style={{ width: `${Math.min(100, Math.max(0, (p || 0) * 100))}%`, height: "100%", background: cor, borderRadius: 999 }} />
            </div>
            <div className="text-[11px] mt-1" style={{ color: C.sub }}>
              {it.meta ? `${pct(p)} da meta de ${master ? compacto(it.meta, it.un) : "•••••"}` : "sem meta cadastrada"}
            </div>
            {it.gap?.gap != null && (
              <div className="text-[11px] mt-0.5" style={{ color: it.gap.gap > 0 ? C.sub : C.green }}>
                {it.gap.gap > 0
                  ? `faltam ${master ? compacto(it.gap.gap, it.un) : "•••••"}${it.gap.mtg ? ` · ${master ? compacto(it.gap.mtg, it.un) : "•••••"} por mês até dezembro` : ""}`
                  : `meta batida — ${master ? compacto(-it.gap.gap, it.un) : "•••••"} acima`}
              </div>
            )}
          </div>
        );
      })}
      <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="text-xs font-semibold" style={{ color: C.sub }}>Ticket médio do ano</div>
        <div className="mt-1 font-semibold" style={{ fontSize: 24, color: C.text }}>{master ? `R$ ${brl(d.ticketMedio)}` : "•••••"}</div>
        <div className="text-[11px] mt-2" style={{ color: C.sub }}>
          {inteiro(d.totais.pecasFaturadas)} peças faturadas · média de {d.mediaMensal.pecasFaturadas == null ? "—" : inteiro(d.mediaMensal.pecasFaturadas)}/mês em {mesesTxt(d.mediaMensal.bases?.pecasFaturadas || 0)}
        </div>
      </div>
    </div>
  );
}

const Th = ({ children, dir }) => (
  <th className={`px-2 py-2 font-semibold whitespace-nowrap ${dir ? "text-center" : "text-left"}`} style={{ color: C.sub }}>{children}</th>
);
const Td = ({ children, dir, forte, cor }) => (
  <td className={`px-2 py-1.5 whitespace-nowrap tabular-nums ${dir ? "text-center" : "text-left"}`}
    style={{ color: cor || C.text, fontWeight: forte ? 600 : 400 }}>{children}</td>
);
function Secao({ titulo, children }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>{titulo}</div>
        <div className="flex-1 h-px" style={{ background: C.line }} />
      </div>
      <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>{children}</div>
    </div>
  );
}
const corMom = (v) => (v === null || v === undefined ? C.sub : v >= 1 ? C.green : C.red);
const mon = (v, master) => (v === null || v === undefined ? "—" : master ? brl(v) : "•••••");

// v223 — YoY do mês, acumulado YoY, atingido × meta do mês e acumulado × meta
function indicadores(linhas, atual, anterior, meta) {
  let aA = 0, aP = 0, aM = 0, temP = false, temM = false;
  const meses = linhas.map((l) => {
    const a = atual(l), p = anterior(l), m = meta(l);
    if (a == null) return { yoy: null, acYoy: null, ating: null, acAting: null };
    aA += a; if (p != null) { aP += p; temP = true; } if (m != null) { aM += m; temM = true; }
    return { yoy: p ? a / p : null, acYoy: temP && aP ? aA / aP : null, ating: m ? a / m : null, acAting: temM && aM ? aA / aM : null };
  });
  const tri = [0, 1, 2, 3].map((t) => {
    const ls = linhas.slice(t * 3, t * 3 + 3).filter((l) => atual(l) != null);
    const sa = ls.reduce((x, l) => x + atual(l), 0), sm = ls.reduce((x, l) => x + (meta(l) || 0), 0);
    return { ating: ls.length && sm ? sa / sm : null };
  });
  return { meses, tri };
}
const xFmt = (v) => (v == null ? "—" : `${v.toFixed(2)}x`);
const pctFmt = (v) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);
const metaMesGestao = (mensal, anual) => (mensal != null ? mensal : anual != null ? anual / 12 : null);

function LinhaTrimestre({ cols }) {
  return (
    <tr style={{ background: C.panel2, borderTop: `1px solid ${C.line}` }}>
      {cols.map((c, i) => <Td key={i} dir={i > 0} forte>{c}</Td>)}
    </tr>
  );
}

function TabelaVendas({ d, master, onEditar }) {
  const ind = indicadores(d.linhas, (l) => l.vendas.atual, (l) => l.vendas.anterior, (l) => metaMesGestao(l.metaVendasValor, d.metas.vendas));
  return (
    <Secao titulo={`VENDAS ${d.ano} — PEDIDOS LANÇADOS NO MÊS`}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 760 }}>
        <thead><tr style={{ background: C.panel2 }}>
          <Th>Mês</Th><Th dir>{d.anoAnterior}</Th><Th dir>{d.ano}</Th><Th dir>Peças</Th><Th dir>YoY mês</Th><Th dir>Acumulado YoY</Th><Th dir>Meta do mês</Th><Th dir>Atingido × meta</Th><Th dir>Acumulado × meta</Th><Th></Th>
        </tr></thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <React.Fragment key={l.mes}>
              <tr style={{ borderTop: `1px solid ${C.line}` }}>
                <Td forte>{l.nome}</Td>
                <Td dir cor={C.sub}>{mon(l.vendas.anterior, master)}</Td>
                <Td dir forte>{mon(l.vendas.atual, master)}</Td>
                <Td dir>{l.vendas.pecas == null ? "—" : inteiro(l.vendas.pecas)}</Td>
                <Td dir cor={corMom(ind.meses[i].yoy)}>{xFmt(ind.meses[i].yoy)}</Td>
                <Td dir cor={corMom(ind.meses[i].acYoy)}>{xFmt(ind.meses[i].acYoy)}</Td>
                <Td dir cor={C.sub}>{mon(metaMesGestao(l.metaVendasValor, d.metas.vendas), master)}</Td>
                <Td dir cor={corMom(ind.meses[i].ating)}>{pctFmt(ind.meses[i].ating)}</Td>
                <Td dir cor={corMom(ind.meses[i].acAting)}>{pctFmt(ind.meses[i].acAting)}</Td>
                <td className="px-2"><button onClick={() => onEditar(l.mes)} title="Lançar/corrigir" style={{ color: C.sub }}><Pencil size={13} /></button></td>
              </tr>
              {i % 3 === 2 && (() => { const t = d.trimestres[(i - 2) / 3]; return (
                <LinhaTrimestre cols={[t.nome, mon(t.vendas.anterior, master), mon(t.vendas.atual, master), "", t.vendas.mom ? `${t.vendas.mom.toFixed(2)}x` : "—", "", "", pctFmt(ind.tri[(i - 2) / 3].ating), "", ""]} />
              ); })()}
            </React.Fragment>
          ))}
          {!!d.semNota?.vendas && (
            <tr style={{ borderTop: `1px solid ${C.line}` }}>
              <Td cor={C.sub}>SEM NOTA</Td><Td dir></Td><Td dir cor={C.sub}>{mon(d.semNota.vendas, master)}</Td>
              <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
            </tr>
          )}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <Td forte>TOTAL</Td><Td dir></Td><Td dir forte>{mon(d.totais.vendas, master)}</Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
          <tr>
            <Td cor={C.sub}>MÉDIA MENSAL<span style={{ fontWeight: 400 }}> · {mesesTxt(d.mediaMensal.bases?.vendas || 0)}</span></Td>
            <Td dir></Td><Td dir cor={C.sub}>{mon(d.mediaMensal.vendas, master)}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
        </tbody>
      </table>
    </Secao>
  );
}

function TabelaFaturamento({ d, master, onEditar }) {
  const ind = indicadores(d.linhas, (l) => l.faturamento.atual, (l) => l.faturamento.anterior, (l) => metaMesGestao(l.faturamento.metaValor, d.metas.faturamento));
  return (
    <Secao titulo={`FATURAMENTO ${d.ano} — NOTAS EMITIDAS`}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 980 }}>
        <thead><tr style={{ background: C.panel2 }}>
          <Th>Mês</Th><Th dir>{d.anoAnterior}</Th><Th dir>{d.ano}</Th><Th dir>Meta R$</Th><Th dir>Meta peças</Th>
          <Th dir>YoY mês</Th><Th dir>Acumulado YoY</Th><Th dir>Atingido × meta</Th><Th dir>Acumulado × meta</Th><Th dir>Peças faturadas (= produzidas)</Th>
          <Th></Th>
        </tr></thead>
        <tbody>
          {d.linhas.map((l, i) => {
            const pMeta = l.faturamento.metaValor && l.faturamento.atual ? l.faturamento.atual / l.faturamento.metaValor : null;
            return (
              <React.Fragment key={l.mes}>
                <tr style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td forte>{l.nome}</Td>
                  <Td dir cor={C.sub}>{mon(l.faturamento.anterior, master)}</Td>
                  <Td dir forte cor={pMeta == null ? C.text : pMeta >= 1 ? C.green : C.text}>{mon(l.faturamento.atual, master)}</Td>
                  <Td dir cor={C.sub}>{mon(l.faturamento.metaValor, master)}</Td>
                  <Td dir cor={C.sub}>{l.faturamento.metaPecas == null ? "—" : inteiro(l.faturamento.metaPecas)}</Td>
                  <Td dir cor={corMom(ind.meses[i].yoy)}>{xFmt(ind.meses[i].yoy)}</Td>
                  <Td dir cor={corMom(ind.meses[i].acYoy)}>{xFmt(ind.meses[i].acYoy)}</Td>
                  <Td dir cor={corMom(ind.meses[i].ating)}>{pctFmt(ind.meses[i].ating)}</Td>
                  <Td dir cor={corMom(ind.meses[i].acAting)}>{pctFmt(ind.meses[i].acAting)}</Td>
                  <Td dir>{l.faturamento.pecas == null ? "—" : inteiro(l.faturamento.pecas)}</Td>
                  <td className="px-2"><button onClick={() => onEditar(l.mes)} title="Lançar/corrigir" style={{ color: C.sub }}><Pencil size={13} /></button></td>
                </tr>
                {i % 3 === 2 && (() => { const t = d.trimestres[(i - 2) / 3]; return (
                  <LinhaTrimestre cols={[t.nome, mon(t.faturamento.anterior, master), mon(t.faturamento.atual, master),
                    mon(t.faturamento.metaValor, master), inteiro(t.faturamento.metaPecas),
                    t.faturamento.mom ? `${t.faturamento.mom.toFixed(2)}x` : "—", "", pctFmt(ind.tri[(i - 2) / 3].ating), "", inteiro(t.faturamento.pecas), ""]} />
                ); })()}
              </React.Fragment>
            );
          })}
          {!!d.semNota?.faturamento && (
            <tr style={{ borderTop: `1px solid ${C.line}` }}>
              <Td cor={C.sub}>SEM NOTA</Td><Td dir></Td><Td dir cor={C.sub}>{mon(d.semNota.faturamento, master)}</Td>
              <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
            </tr>
          )}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <Td forte>TOTAL</Td><Td dir></Td><Td dir forte>{mon(d.totais.faturamento, master)}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td>
            <Td dir forte>{inteiro(d.totais.pecasFaturadas)}</Td><td />
          </tr>
          <tr>
            <Td cor={C.sub}>MÉDIA MENSAL<span style={{ fontWeight: 400 }}> · {mesesTxt(d.mediaMensal.bases?.faturamento || 0)}</span></Td>
            <Td dir></Td><Td dir cor={C.sub}>{mon(d.mediaMensal.faturamento, master)}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td>
            <Td dir cor={C.sub}>{d.mediaMensal.pecasFaturadas == null ? "—" : inteiro(d.mediaMensal.pecasFaturadas)}</Td>
<td />
          </tr>
          <tr>
            <Td cor={C.sub}>TICKET MÉDIO</Td><Td dir></Td><Td dir forte>{master ? `R$ ${brl(d.ticketMedio)}` : "•••••"}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
        </tbody>
      </table>
    </Secao>
  );
}

function TabelaReceita({ d, master, onEditar }) {
  const ind = indicadores(d.linhas, (l) => l.receita.total, (l) => l.receita.anterior, (l) => metaMesGestao(l.metaReceitaValor, d.metas.receita));
  return (
    <Secao titulo={`RECEITA ${d.ano} — COBRANÇAS RECEBIDAS, POR CANAL`}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 900 }}>
        <thead><tr style={{ background: C.panel2 }}>
          <Th>Mês</Th>
          {d.segmentos.map((s, i) => (
            <th key={s} className="px-2 py-2 font-semibold text-center whitespace-nowrap" style={{ color: C.sub }}>
              <span className="inline-block rounded mr-1 align-middle" style={{ width: 8, height: 8, background: CORES_SEG[i % CORES_SEG.length] }} />
              {s}
            </th>
          ))}
          <Th dir>Total {d.ano}</Th><Th dir>Total {d.anoAnterior}</Th><Th dir>YoY mês</Th><Th dir>Acumulado YoY</Th><Th dir>Meta do mês</Th><Th dir>Atingido × meta</Th><Th dir>Acumulado × meta</Th><Th></Th>
        </tr></thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <tr key={l.mes} style={{ borderTop: `1px solid ${C.line}` }}>
              <Td forte>{l.nome}</Td>
              {d.segmentos.map((s) => <Td key={s} dir cor={l.receita.segmentos[s] ? C.text : C.sub}>{l.receita.segmentos[s] ? mon(l.receita.segmentos[s], master) : "—"}</Td>)}
              <Td dir forte>{mon(l.receita.total, master)}</Td>
              <Td dir cor={C.sub}>{mon(l.receita.anterior, master)}</Td>
              <Td dir cor={corMom(ind.meses[i].yoy)}>{xFmt(ind.meses[i].yoy)}</Td>
              <Td dir cor={corMom(ind.meses[i].acYoy)}>{xFmt(ind.meses[i].acYoy)}</Td>
              <Td dir cor={C.sub}>{mon(metaMesGestao(l.metaReceitaValor, d.metas.receita), master)}</Td>
              <Td dir cor={corMom(ind.meses[i].ating)}>{pctFmt(ind.meses[i].ating)}</Td>
              <Td dir cor={corMom(ind.meses[i].acAting)}>{pctFmt(ind.meses[i].acAting)}</Td>
              <td className="px-2"><button onClick={() => onEditar(l.mes)} title="Lançar/corrigir" style={{ color: C.sub }}><Pencil size={13} /></button></td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <Td forte>TOTAL</Td>
            {d.segmentos.map((s) => (
              <Td key={s} dir forte>{mon(d.linhas.reduce((acc, l) => acc + (l.receita.segmentos[s] || 0), 0), master)}</Td>
            ))}
            <Td dir forte>{mon(d.totais.receita, master)}</Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
        </tbody>
      </table>
    </Secao>
  );
}

/* ---------------- lançamento manual do mês ---------------- */
const Campo = ({ rotulo, valor, onChange, dica }) => (
  <label className="block">
    <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>{rotulo}</div>
    <input value={valor ?? ""} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={dica || "—"}
      className="w-full rounded-lg px-2 py-1.5 text-sm text-right tabular-nums"
      style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
  </label>
);

function LancamentoModal({ user, d, mes, onClose, onSalvo }) {
  const l = d.linhas[mes - 1];
  const ini = {
    vendasValor: l.vendas.atual, vendasPecas: l.vendas.pecas,
    faturamentoValor: l.faturamento.atual, pecasFaturadas: l.faturamento.pecas,
    observacao: l.observacao || "",
  };
  const [f, setF] = useState(() => Object.fromEntries(Object.entries(ini).map(([k, v]) => [k, v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v])));
  const [rec, setRec] = useState(() => {
    const o = {};
    d.segmentos.forEach((s) => { const m = l.receita.segmentosManual || l.receita.segmentos; o[s] = m[s] != null ? String(m[s]).replace(".", ",") : ""; });
    return o;
  });
  const [novoSeg, setNovoSeg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const novo = await api("/api/kpi", "PUT", {
        usuarioId: user.id, ano: d.ano, mes,
        campos: f,
        receita: Object.fromEntries(Object.entries(rec).map(([s, v]) => [s, v === "" ? null : v])),
      });
      onSalvo(novo);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  const total = Object.values(rec).reduce((s, v) => s + (Number(String(v).replace(/\./g, "").replace(",", ".")) || 0), 0);

  return (
    <Modal titulo={`Lançar ${MESES_LONGO[mes - 1]} / ${d.ano}`} onClose={onClose} largura={760}>
      <div className="text-xs mb-3 p-2 rounded" style={{ background: C.blueSoft, color: C.text }}>
        Enquanto os módulos de pedidos, NF de saída e chão de fábrica não existem, estes números são lançados à mão.
        Deixe em branco o que ainda não souber.
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Campo rotulo="Vendas (R$)" valor={f.vendasValor} onChange={set("vendasValor")} />
        <Campo rotulo="Vendas (peças)" valor={f.vendasPecas} onChange={set("vendasPecas")} />
        <Campo rotulo="Faturamento (R$)" valor={f.faturamentoValor} onChange={set("faturamentoValor")} />
        <Campo rotulo="Peças faturadas" valor={f.pecasFaturadas} onChange={set("pecasFaturadas")} />
      </div>
      <div className="text-[10px] mt-1" style={{ color: C.sub }}>Peças faturadas: com análise da expedição no mês, vêm dela (o valor digitado é ignorado).</div>

      <div className="text-xs mt-4 p-2 rounded" style={{ background: C.panel2, color: C.sub }}>As metas do mês são definidas na página <b>Metas</b> (vendas e ticket → faturamento e receita).</div>

      <div className="text-xs font-bold tracking-wider mt-5 mb-2" style={{ color: C.navy }}>RECEITA POR CANAL (R$)</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {Object.keys(rec).map((s, i) => (
          <label key={s} className="block">
            <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: C.sub }}>
              <span className="inline-block rounded" style={{ width: 8, height: 8, background: CORES_SEG[i % CORES_SEG.length] }} /> {s}
            </div>
            <input value={rec[s]} onChange={(e) => setRec((x) => ({ ...x, [s]: e.target.value }))} inputMode="decimal"
              className="w-full rounded-lg px-2 py-1.5 text-sm text-right tabular-nums"
              style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input value={novoSeg} onChange={(e) => setNovoSeg(e.target.value)} placeholder="NOVO CANAL"
          className="rounded-lg px-2 py-1 text-xs uppercase" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
        <button onClick={() => { const s = novoSeg.toUpperCase().trim(); if (s && !(s in rec)) setRec((x) => ({ ...x, [s]: "" })); setNovoSeg(""); }}
          className="text-xs font-semibold" style={{ color: C.accent }}>+ acrescentar canal</button>
        <div className="flex-1" />
        <div className="text-xs" style={{ color: C.sub }}>soma: <b style={{ color: C.text }}>R$ {brl(total)}</b></div>
      </div>

      <label className="block mt-4">
        <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Observação</div>
        <input value={f.observacao} onChange={set("observacao")} placeholder="EX.: MÊS COM FÉRIAS COLETIVAS"
          className="w-full rounded-lg px-2 py-1.5 text-sm uppercase" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
      </label>

      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          <Save size={15} /> {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ titulo, onClose, children, largura = 560 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto" style={{ background: "rgba(0,30,65,0.35)" }}>
      <div className="rounded-xl my-8" style={{ background: C.panel, width: "100%", maxWidth: largura }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
