"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Target, Factory, Receipt, Wallet, BarChart3, History, ArrowLeft, Pencil, Save, X,
  Upload, Loader2, ChevronLeft, ChevronRight,
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
export default function Gestao({ user, master, money }) {
  const [tela, setTela] = useState({ v: "painel" });
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
          <span>Relatório de KPIs {tela.ano}</span>
        </div>
      )}
      {tela.v === "painel"
        ? <Painel user={user} master={master} money={money} abrirRelatorio={(ano) => setTela({ v: "relatorio", ano })} />
        : <Relatorio key={tela.ano} user={user} master={master} money={money} anoInicial={tela.ano} />}
    </div>
  );
}

/* ---------------- PAINEL (tela inicial da Gestão) ---------------- */
function Painel({ user, master, money, abrirRelatorio }) {
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
      </div>

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {d && (
        <>
          {/* ---- os 5 KPIs do mês ---- */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {d.kpis.map((k) => (
              <CardKpi key={k.chave} k={k} mes={mes} master={master} money={money} />
            ))}
            <CardReceitaCanais canais={d.canais} total={d.receitaMes} master={master} money={money} />
          </div>

          {/* ---- indicadores do ano ---- */}
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>
              INDICADORES DO ANO · {ano} ATÉ AQUI
            </div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Indicador rotulo="Ticket médio" valor={master ? `R$ ${brl(d.anuais.ticketMedio)}` : "•••••"}
              detalhe={`faturamento ÷ peças faturadas`} delta={d.anuais.vsAnterior?.ticketMedio} anoRef={anoAnterior} Ico={Receipt} />
            <Indicador rotulo="Média mensal de peças faturadas" valor={d.anuais.mediaPecasFaturadas == null ? "—" : inteiro(d.anuais.mediaPecasFaturadas)}
              detalhe={mesesTxt(d.anuais.bases?.pecasFaturadas || 0)} delta={d.anuais.vsAnterior?.mediaPecasFaturadas} anoRef={anoAnterior} Ico={Factory} />
            <Indicador rotulo="Média mensal de faturamento" valor={d.anuais.mediaFaturamento == null ? "—" : master ? compacto(d.anuais.mediaFaturamento, "R$") : "•••••"}
              detalhe={mesesTxt(d.anuais.bases?.faturamento || 0)} delta={d.anuais.vsAnterior?.mediaFaturamento} anoRef={anoAnterior} Ico={Wallet} />
          </div>

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
function CardKpi({ k, mes, master, money }) {
  const [hover, setHover] = useState(null);
  const temValor = k.valor !== null && k.valor !== undefined;
  const p = temValor && k.meta ? k.valor / k.meta : null;
  const [cor, trilho] = corMeta(p);
  const esconder = k.unidade === "R$" && !master;

  const i = hover === null ? mes - 1 : hover;
  const vSerie = k.serie[i], mSerie = k.metaSerie[i];

  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${cor}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold" style={{ color: C.sub }}>
          {k.rotulo} <span style={{ fontWeight: 400 }}>({k.unidade === "R$" ? "R$" : "peças"})</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ background: C.panel2, color: C.sub }} title={k.fonte}>
          manual
        </span>
      </div>

      <div className="mt-1 font-semibold" style={{ fontSize: 30, lineHeight: 1.1, color: temValor ? C.text : C.sub }}>
        {!temValor ? "—" : esconder ? "•••••" : compacto(k.valor, k.unidade)}
      </div>

      {/* medidor contra a meta */}
      <div className="mt-3">
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: trilho }}>
          <div style={{ width: `${Math.min(100, Math.max(0, (p || 0) * 100))}%`, height: "100%", background: cor, borderRadius: 999 }} />
        </div>
        <div className="flex justify-between text-[11px] mt-1" style={{ color: C.sub }}>
          <span>{p === null ? "sem meta no mês" : `${pct(p)} da meta`}</span>
          <span>{k.meta ? (esconder ? "•••••" : `meta ${compacto(k.meta, k.unidade)}`) : ""}</span>
        </div>
      </div>

      {/* os 12 meses do ano: cinza = outros meses, laranja = o mês aberto, traço = meta */}
      <div className="mt-3">
        <MiniColunas serie={k.serie} metaSerie={k.metaSerie} destaque={mes - 1} hover={hover} setHover={setHover} cor={cor} />
        <div className="text-[11px] mt-1" style={{ color: C.sub, minHeight: 16 }}>
          {hover === null
            ? k.fonte
            : `${MESES[i]}: ${vSerie == null ? "sem lançamento" : esconder ? "•••••" : valorCheio(vSerie, k.unidade)}${mSerie ? ` · meta ${esconder ? "•••••" : valorCheio(mSerie, k.unidade)}` : ""}`}
        </div>
      </div>
    </div>
  );
}

/* 12 colunas finas + marca da meta; hover devolve o índice do mês */
function MiniColunas({ serie, metaSerie, destaque, hover, setHover, cor }) {
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
          <div key={i} className="relative flex-1 flex items-end" style={{ height: alt, cursor: "default" }}
            onMouseEnter={() => setHover(i)}>
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
function Relatorio({ user, master, money, anoInicial }) {
  const [ano, setAno] = useState(anoInicial || new Date().getFullYear());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [editar, setEditar] = useState(null);   // { mes }
  const [metas, setMetas] = useState(false);
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
            <button onClick={() => setMetas(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
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
      {metas && <MetasModal user={user} d={d} onClose={() => setMetas(false)}
        onSalvo={(novo) => { setD((x) => ({ ...novo, anos: x.anos, podeEditar: x.podeEditar, segmentosPadrao: x.segmentosPadrao })); setMetas(false); }} />}
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
  <th className={`px-2 py-2 font-semibold whitespace-nowrap ${dir ? "text-right" : "text-left"}`} style={{ color: C.sub }}>{children}</th>
);
const Td = ({ children, dir, forte, cor }) => (
  <td className={`px-2 py-1.5 whitespace-nowrap tabular-nums ${dir ? "text-right" : "text-left"}`}
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

function LinhaTrimestre({ cols }) {
  return (
    <tr style={{ background: C.panel2, borderTop: `1px solid ${C.line}` }}>
      {cols.map((c, i) => <Td key={i} dir={i > 0} forte>{c}</Td>)}
    </tr>
  );
}

function TabelaVendas({ d, master, onEditar }) {
  return (
    <Secao titulo={`VENDAS ${d.ano} — PEDIDOS LANÇADOS NO MÊS`}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 760 }}>
        <thead><tr style={{ background: C.panel2 }}>
          <Th>Mês</Th><Th dir>{d.anoAnterior}</Th><Th dir>{d.ano}</Th><Th dir>Peças</Th><Th dir>MoM</Th><Th dir>Acumulado</Th><Th dir>Meta do mês</Th><Th></Th>
        </tr></thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <React.Fragment key={l.mes}>
              <tr style={{ borderTop: `1px solid ${C.line}` }}>
                <Td forte>{l.nome}</Td>
                <Td dir cor={C.sub}>{mon(l.vendas.anterior, master)}</Td>
                <Td dir forte>{mon(l.vendas.atual, master)}</Td>
                <Td dir>{l.vendas.pecas == null ? "—" : inteiro(l.vendas.pecas)}</Td>
                <Td dir cor={corMom(l.vendas.mom)}>{l.vendas.mom == null ? "—" : `${l.vendas.mom.toFixed(2)}x`}</Td>
                <Td dir cor={corMom(l.vendas.acumulado)}>{l.vendas.acumulado == null ? "—" : `${l.vendas.acumulado.toFixed(2)}x`}</Td>
                <Td dir cor={C.sub}>{mon(l.metaVendasValor, master)}</Td>
                <td className="px-2"><button onClick={() => onEditar(l.mes)} title="Lançar/corrigir" style={{ color: C.sub }}><Pencil size={13} /></button></td>
              </tr>
              {i % 3 === 2 && (() => { const t = d.trimestres[(i - 2) / 3]; return (
                <LinhaTrimestre cols={[t.nome, mon(t.vendas.anterior, master), mon(t.vendas.atual, master), "", t.vendas.mom ? `${t.vendas.mom.toFixed(2)}x` : "—", "", "", ""]} />
              ); })()}
            </React.Fragment>
          ))}
          {!!d.semNota?.vendas && (
            <tr style={{ borderTop: `1px solid ${C.line}` }}>
              <Td cor={C.sub}>SEM NOTA</Td><Td dir></Td><Td dir cor={C.sub}>{mon(d.semNota.vendas, master)}</Td>
              <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
            </tr>
          )}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <Td forte>TOTAL</Td><Td dir></Td><Td dir forte>{mon(d.totais.vendas, master)}</Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
          <tr>
            <Td cor={C.sub}>MÉDIA MENSAL<span style={{ fontWeight: 400 }}> · {mesesTxt(d.mediaMensal.bases?.vendas || 0)}</span></Td>
            <Td dir></Td><Td dir cor={C.sub}>{mon(d.mediaMensal.vendas, master)}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
        </tbody>
      </table>
    </Secao>
  );
}

function TabelaFaturamento({ d, master, onEditar }) {
  return (
    <Secao titulo={`FATURAMENTO ${d.ano} — NOTAS EMITIDAS`}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 980 }}>
        <thead><tr style={{ background: C.panel2 }}>
          <Th>Mês</Th><Th dir>{d.anoAnterior}</Th><Th dir>{d.ano}</Th><Th dir>Meta R$</Th><Th dir>Meta peças</Th>
          <Th dir>MoM</Th><Th dir>Acumulado</Th><Th dir>Peças faturadas</Th><Th dir>Produzidas</Th><Th></Th>
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
                  <Td dir cor={corMom(l.faturamento.mom)}>{l.faturamento.mom == null ? "—" : `${l.faturamento.mom.toFixed(2)}x`}</Td>
                  <Td dir cor={corMom(l.faturamento.acumulado)}>{l.faturamento.acumulado == null ? "—" : `${l.faturamento.acumulado.toFixed(2)}x`}</Td>
                  <Td dir>{l.faturamento.pecas == null ? "—" : inteiro(l.faturamento.pecas)}</Td>
                  <Td dir>{l.producao.pecas == null ? "—" : inteiro(l.producao.pecas)}</Td>
                  <td className="px-2"><button onClick={() => onEditar(l.mes)} title="Lançar/corrigir" style={{ color: C.sub }}><Pencil size={13} /></button></td>
                </tr>
                {i % 3 === 2 && (() => { const t = d.trimestres[(i - 2) / 3]; return (
                  <LinhaTrimestre cols={[t.nome, mon(t.faturamento.anterior, master), mon(t.faturamento.atual, master),
                    mon(t.faturamento.metaValor, master), inteiro(t.faturamento.metaPecas),
                    t.faturamento.mom ? `${t.faturamento.mom.toFixed(2)}x` : "—", "", inteiro(t.faturamento.pecas), "", ""]} />
                ); })()}
              </React.Fragment>
            );
          })}
          {!!d.semNota?.faturamento && (
            <tr style={{ borderTop: `1px solid ${C.line}` }}>
              <Td cor={C.sub}>SEM NOTA</Td><Td dir></Td><Td dir cor={C.sub}>{mon(d.semNota.faturamento, master)}</Td>
              <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
            </tr>
          )}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <Td forte>TOTAL</Td><Td dir></Td><Td dir forte>{mon(d.totais.faturamento, master)}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td>
            <Td dir forte>{inteiro(d.totais.pecasFaturadas)}</Td><Td dir forte>{inteiro(d.totais.pecasProduzidas)}</Td><td />
          </tr>
          <tr>
            <Td cor={C.sub}>MÉDIA MENSAL<span style={{ fontWeight: 400 }}> · {mesesTxt(d.mediaMensal.bases?.faturamento || 0)}</span></Td>
            <Td dir></Td><Td dir cor={C.sub}>{mon(d.mediaMensal.faturamento, master)}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td>
            <Td dir cor={C.sub}>{d.mediaMensal.pecasFaturadas == null ? "—" : inteiro(d.mediaMensal.pecasFaturadas)}</Td>
            <Td dir cor={C.sub}>{d.mediaMensal.pecasProduzidas == null ? "—" : inteiro(d.mediaMensal.pecasProduzidas)}</Td><td />
          </tr>
          <tr>
            <Td cor={C.sub}>TICKET MÉDIO</Td><Td dir></Td><Td dir forte>{master ? `R$ ${brl(d.ticketMedio)}` : "•••••"}</Td>
            <Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><Td dir></Td><td />
          </tr>
        </tbody>
      </table>
    </Secao>
  );
}

function TabelaReceita({ d, master, onEditar }) {
  return (
    <Secao titulo={`RECEITA ${d.ano} — COBRANÇAS RECEBIDAS, POR CANAL`}>
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 900 }}>
        <thead><tr style={{ background: C.panel2 }}>
          <Th>Mês</Th>
          {d.segmentos.map((s, i) => (
            <th key={s} className="px-2 py-2 font-semibold text-right whitespace-nowrap" style={{ color: C.sub }}>
              <span className="inline-block rounded mr-1 align-middle" style={{ width: 8, height: 8, background: CORES_SEG[i % CORES_SEG.length] }} />
              {s}
            </th>
          ))}
          <Th dir>Total {d.ano}</Th><Th dir>Total {d.anoAnterior}</Th><Th dir>PoP</Th><Th></Th>
        </tr></thead>
        <tbody>
          {d.linhas.map((l) => (
            <tr key={l.mes} style={{ borderTop: `1px solid ${C.line}` }}>
              <Td forte>{l.nome}</Td>
              {d.segmentos.map((s) => <Td key={s} dir cor={l.receita.segmentos[s] ? C.text : C.sub}>{l.receita.segmentos[s] ? mon(l.receita.segmentos[s], master) : "—"}</Td>)}
              <Td dir forte>{mon(l.receita.total, master)}</Td>
              <Td dir cor={C.sub}>{mon(l.receita.anterior, master)}</Td>
              <Td dir cor={corMom(l.receita.pop)}>{l.receita.pop == null ? "—" : `${l.receita.pop.toFixed(2)}x`}</Td>
              <td className="px-2"><button onClick={() => onEditar(l.mes)} title="Lançar/corrigir" style={{ color: C.sub }}><Pencil size={13} /></button></td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <Td forte>TOTAL</Td>
            {d.segmentos.map((s) => (
              <Td key={s} dir forte>{mon(d.linhas.reduce((acc, l) => acc + (l.receita.segmentos[s] || 0), 0), master)}</Td>
            ))}
            <Td dir forte>{mon(d.totais.receita, master)}</Td><Td dir></Td><Td dir></Td><td />
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
    vendasValor: l.vendas.atual, vendasPecas: l.vendas.pecas, pecasProduzidas: l.producao.pecas,
    faturamentoValor: l.faturamento.atual, pecasFaturadas: l.faturamento.pecas,
    metaVendasValor: l.metaVendasValor, metaFaturamentoValor: l.faturamento.metaValor,
    metaFaturamentoPecas: l.faturamento.metaPecas, metaPecasProduzidas: l.producao.meta,
    metaReceitaValor: l.metaReceitaValor, observacao: l.observacao || "",
  };
  const [f, setF] = useState(() => Object.fromEntries(Object.entries(ini).map(([k, v]) => [k, v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v])));
  const [rec, setRec] = useState(() => {
    const o = {};
    d.segmentos.forEach((s) => (o[s] = l.receita.segmentos[s] != null ? String(l.receita.segmentos[s]).replace(".", ",") : ""));
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
        <Campo rotulo="Peças produzidas" valor={f.pecasProduzidas} onChange={set("pecasProduzidas")} />
        <Campo rotulo="Faturamento (R$)" valor={f.faturamentoValor} onChange={set("faturamentoValor")} />
        <Campo rotulo="Peças faturadas" valor={f.pecasFaturadas} onChange={set("pecasFaturadas")} />
      </div>

      <div className="text-xs font-bold tracking-wider mt-5 mb-2" style={{ color: C.navy }}>METAS DO MÊS</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Campo rotulo="Meta de vendas (R$)" valor={f.metaVendasValor} onChange={set("metaVendasValor")} dica="usa a do ano ÷ 12" />
        <Campo rotulo="Meta de faturamento (R$)" valor={f.metaFaturamentoValor} onChange={set("metaFaturamentoValor")} />
        <Campo rotulo="Meta de peças" valor={f.metaFaturamentoPecas} onChange={set("metaFaturamentoPecas")} />
        <Campo rotulo="Meta de produção (peças)" valor={f.metaPecasProduzidas} onChange={set("metaPecasProduzidas")} dica="usa a do ano ÷ 12" />
        <Campo rotulo="Meta de receita (R$)" valor={f.metaReceitaValor} onChange={set("metaReceitaValor")} dica="usa a do ano ÷ 12" />
      </div>

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

function MetasModal({ user, d, onClose, onSalvo }) {
  const [f, setF] = useState({
    vendas: d.metas.vendas ?? "", faturamento: d.metas.faturamento ?? "", receita: d.metas.receita ?? "",
    pecasFaturadas: d.metas.pecasFaturadas ?? "", pecasProduzidas: d.metas.pecasProduzidas ?? "",
    semNotaVendas: d.semNota?.vendas || "", semNotaFaturamento: d.semNota?.faturamento || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setSalvando(true); setErro("");
    try { onSalvo(await api("/api/kpi", "POST", { usuarioId: user.id, ano: d.ano, metas: f })); }
    catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo={`Metas de ${d.ano}`} onClose={onClose} largura={560}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>
        A meta do ano vale como meta mensal dividida por 12, a não ser que o mês tenha meta própria lançada.
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Campo rotulo="Meta de vendas (R$)" valor={f.vendas} onChange={set("vendas")} />
        <Campo rotulo="Meta de faturamento (R$)" valor={f.faturamento} onChange={set("faturamento")} />
        <Campo rotulo="Meta de receita (R$)" valor={f.receita} onChange={set("receita")} />
        <Campo rotulo="Meta de peças faturadas" valor={f.pecasFaturadas} onChange={set("pecasFaturadas")} />
        <Campo rotulo="Meta de peças produzidas" valor={f.pecasProduzidas} onChange={set("pecasProduzidas")} />
      </div>
      <div className="text-xs font-bold tracking-wider mt-5 mb-1" style={{ color: C.navy }}>SEM NOTA</div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>
        Valor do ano que não cai em nenhum mês. Entra no total, como na planilha.
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Campo rotulo="Vendas sem nota (R$)" valor={f.semNotaVendas} onChange={set("semNotaVendas")} />
        <Campo rotulo="Faturamento sem nota (R$)" valor={f.semNotaFaturamento} onChange={set("semNotaFaturamento")} />
      </div>
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
