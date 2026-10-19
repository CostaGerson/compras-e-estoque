"use client";
// v182 — Produção › Análises operacionais. Corte: custo do setor (pessoal pela Matriz + freelancers identificados) ÷ peças processadas,
// comparado com a meta (peças estimadas) e com o custo de terceirizar. Mesma mecânica da planilha "Análise Corte".
import React, { useState, useEffect, useRef } from "react";
import { Upload, Loader2, Save, Scissors, PackageCheck, AlertTriangle, ChevronDown, ChevronRight, Construction, Shirt, Paintbrush, Sparkles } from "lucide-react";
import { CoresContas as C } from "./contas";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeMes = (c) => (c ? `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}` : "");
const brl = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n2 = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => `${n2((Number(v) || 0) * 100, d)}%`;
const int = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const numBR = (v) => { const t = String(v ?? "").trim(); return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); };
const editado = (v, auto) => v !== "" && v != null && Math.abs(numBR(v) - r2(auto)) >= 0.01;
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}

export function EmConstrucaoOp({ titulo, texto }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: C.panel, border: `1px dashed ${C.line}` }}>
      <Construction size={30} className="mx-auto mb-2" style={{ color: C.accent }} />
      <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
      <div className="text-sm mt-1" style={{ color: C.sub }}>{texto || "Análise em construção. Mande a planilha que vocês usam hoje para eu montar no mesmo formato do corte."}</div>
    </div>
  );
}

const Kpi = ({ t, v, sub, cor }) => (
  <div className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
    <div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{t}</div>
    <div className="text-lg font-bold tabular-nums" style={{ color: cor || C.navy }}>{v}</div>
    {sub && <div className="text-[11px]" style={{ color: C.sub }}>{sub}</div>}
  </div>
);
const KpiDestaque = ({ t, v, sub, cor, onClick }) => (
  <div onClick={onClick} title={onClick ? "Clique para ver o valor de cada item" : undefined} className={`rounded-xl p-3 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`} style={{ background: C.panel, border: `1px solid ${C.line}` }}>
    <div className="text-[11px] font-semibold uppercase" style={{ color: cor }}>{t}</div>
    <div className="text-lg font-bold tabular-nums" style={{ color: cor }}>{v}</div>
    {sub && <div className="text-[11px]" style={{ color: C.sub }}>{sub}</div>}
  </div>
);
// v289 — composição da média: valor de cada item (tipo de peça) que formou o número do card
function ComposicaoMedia({ d, onClose }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);
  const qtd = d.itens.reduce((s, x) => s + x.qtd, 0), tot = d.itens.reduce((s, x) => s + (x.total ?? x.valor * x.qtd), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.35)" }} onClick={onClose}>
      <div className="rounded-2xl p-5 w-full max-w-xl max-h-[85vh] overflow-auto" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 mb-1">
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase" style={{ color: d.cor }}>{d.titulo}</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: d.cor }}>{d.valor}</div>
          </div>
          <button onClick={onClose} className="text-sm px-2" style={{ color: C.sub }}>✕</button>
        </div>
        <div className="text-[11px] mb-3" style={{ color: C.sub }}>{d.explica}</div>
        <table className="w-full text-sm">
          <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
            {["Item", "Peças", "% das peças", "Valor / peça", "Total"].map((h, i) => <th key={h} className={`py-1.5 text-xs font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>{d.itens.map((x) => (
            <tr key={x.k} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-1.5">{x.n}</td>
              <td className="text-right tabular-nums">{int(x.qtd)}</td>
              <td className="text-right tabular-nums" style={{ color: C.sub }}>{qtd ? pct(x.qtd / qtd) : "—"}</td>
              <td className="text-right tabular-nums font-semibold" style={{ color: d.cor }}>{brl(x.valor)}</td>
              <td className="text-right tabular-nums">{brl(x.total ?? x.valor * x.qtd)}</td>
            </tr>))}</tbody>
          <tfoot><tr className="font-bold">
            <td className="py-2">Média ponderada</td><td className="text-right tabular-nums">{int(qtd)}</td><td />
            <td className="text-right tabular-nums" style={{ color: d.cor }}>{qtd ? brl(tot / qtd) : "—"}</td><td className="text-right tabular-nums">{brl(tot)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}
const inp = "rounded px-2 py-1 text-sm text-right tabular-nums";
const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };

const TXT = {
  CORTE: { titulo: "Análise do corte", Ico: Scissors, de: "do corte", imp: "Importar planilha do corte",
    ajuda: <>Importe a exportação do sistema de produção (<i>analise-corte_AAAA-MM-DD_a_AAAA-MM-DD.xlsx</i>) — o mês vem do nome do arquivo — ou a planilha histórica do ano (uma aba por mês).</> },
  EXPEDICAO: { titulo: "Análise da expedição", Ico: PackageCheck, de: "da expedição", imp: "Importar planilha da expedição",
    ajuda: <>Peças expedidas por categoria no mês. Importe a planilha do ano (uma aba por mês) ou preencha as quantidades à mão; pessoal e freelancers vêm do sistema.</> },
  // v254 — preenchidas à mão: folha do mês, freelancers e peças feitas internamente
  COSTURA: { titulo: "Análise da costura", Ico: Shirt, de: "da costura", manual: true, volta: "valor de mercado de cada peça × peças costuradas", dentro: "costurar dentro",
    ajuda: <>Preencha a folha do mês, os freelancers e as peças <b>costuradas internamente</b> por tipo. Valor de mercado = preço da facção por peça (para comparar com terceirizar).</> },
  // v255 — silk e bordado importam a exportação do sistema de produção; folha e freelancers à mão
  SILK: { titulo: "Análise do silk", Ico: Paintbrush, de: "do silk", volta: "R$ 0,80 por cor × cores aplicadas", dentro: "estampar dentro", imp: "Importar planilha do silk", unid: "cor·peça", cor: "cor", cores: "cores aplicadas", insumo: "tinta", unids: "Cores aplicadas (cor × peça)",
    ajuda: <>Importe a exportação do sistema de produção (<i>analise-silk_AAAA-MM-DD_a_AAAA-MM-DD.xlsx</i>) — o mês vem do nome do arquivo. As peças internas vão para a grade por nº de cores (7 ou mais entram em 6+); as terceirizadas ficam separadas. Depois preencha a folha e os freelancers do mês.</> },
  // v291 — bordado por PEÇA até termos o custo por bordado: valor de mercado = terceirizado médio da peça (tabela de preços)
  BORDADO: { titulo: "Análise do bordado", Ico: Sparkles, de: "do bordado", volta: "valor terceirizado médio da peça × peças bordadas dentro", dentro: "bordar dentro", imp: "Importar planilha do bordado", insumo: "linha e entretela · DRE 2112700",
    ajuda: <>Importe a planilha do bordado do mês (<i>bordados_mês.xlsx</i>, itens concluídos com <b>R$ / peça</b> da tabela de preços) — o mês vem das datas de conclusão. As peças feitas dentro entram por tipo, com o valor terceirizado médio de cada tipo; as de terceiros ficam só informativas. Pessoal = folha do bordado pela Matriz; insumo = DRE do mês (2112700), quando aparecer.</> },
};

// v254 — Personalização: silk e bordado (DTF e sublimação depois)
export function AnalisePersonalizacao({ user }) {
  const [sub, setSub] = useState("SILK");
  return (
    <div>
      <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: C.panel2 }}>
        {[["SILK", "Silk"], ["BORDADO", "Bordado"]].map(([k, t]) => (
          <button key={k} onClick={() => setSub(k)} className="px-4 py-1.5 rounded-md text-sm font-semibold"
            style={{ background: sub === k ? C.panel : "transparent", color: sub === k ? C.accent : C.sub, boxShadow: sub === k ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{t}</button>
        ))}
      </div>
      <AnaliseCorte key={sub} user={user} setor={sub} />
    </div>
  );
}
export default function AnaliseCorte({ user, setor = "CORTE" }) {
  const T = TXT[setor] || TXT.CORTE;
  const [comp, setComp] = useState(null);
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);          // campos editáveis
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [verDet, setVerDet] = useState(false);
  const [atualizado, setAtualizado] = useState(null);
  const inpRef = useRef(null);

  // v259 — campos que acompanham o sistema (Matriz, identificação do extrato/contas da semana, planilha) enquanto não forem alterados à mão
  const AUTO = { pessoalManual: "pessoal", freelancerManual: "freelancer", insumoManual: "insumo" };
  const carregar = async (c, { silencioso = false } = {}) => {
    if (!silencioso) setErro("");
    try {
      const j = await api(`/api/producao/analises?u=${user.id}&setor=${setor}${c ? `&competencia=${c}` : ""}`);
      if (!c) { const ult = j.competencias[j.competencias.length - 1] || mesAnterior(); setComp(ult); return; }
      setD(j); setAtualizado(new Date());
      const a = j.analise;
      // recarga em segundo plano: mantém o que está sendo digitado e só renova os valores automáticos
      if (silencioso && a) {
        setF((x) => {
          if (!x) return x;
          const novo = { ...x };
          for (const [k, ak] of Object.entries(AUTO)) if (!x._man?.[k]) novo[k] = r2(j.auto?.[ak]);
          return novo;
        });
        return;
      }
      setF(a ? {
        _man: { pessoalManual: a.pessoalManual != null, freelancerManual: a.freelancerManual != null, insumoManual: a.insumoManual != null },
        qtds: { ...(a.qtds || {}) }, mercado: { ...(j.calc ? Object.fromEntries((j.calc.colunas || j.calc.categorias).map((x) => [x.k, x.mercado])) : {}) },
        pecasEstimadas: a.pecasEstimadas ?? 13000, custoMeta: a.custoMeta ?? "", // v256 — pessoal e freelancers vêm preenchidos com o valor do sistema e podem ser alterados
        pessoalManual: a.pessoalManual ?? r2(j.auto?.pessoal), freelancerManual: a.freelancerManual ?? r2(j.auto?.freelancer),
        insumoManual: a.insumoManual ?? r2(j.auto?.insumo),
        meta: a.meta || "", causas: a.causas || "", providencias: a.providencias || "",
      } : null);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { carregar(null); }, []);
  useEffect(() => { if (comp) carregar(comp); }, [comp]);
  // v285 — retorno à operação e valor cobrado na FPP do setor (média dos últimos 6 meses, a mesma das Análises e da FPP)
  const [rf, setRf] = useState(null);
  const [det, setDet] = useState(null);   // v289 — composição do card
  const carregarRf = () => api(`/api/producao/analises?u=${user.id}&acao=retornoFpp`).then(setRf).catch(() => setRf(null));
  useEffect(() => { carregarRf(); }, []);
  useEffect(() => { if (aviso) carregarRf(); }, [aviso]);
  // v259 — ao voltar para a tela (ou a cada 2 min com ela aberta) relê o sistema: identificações novas entram na hora
  const compRef = useRef(comp); compRef.current = comp;
  useEffect(() => {
    const rel = () => { if (compRef.current && document.visibilityState === "visible") carregar(compRef.current, { silencioso: true }); };
    window.addEventListener("focus", rel); document.addEventListener("visibilitychange", rel);
    const t = setInterval(rel, 120000);
    return () => { window.removeEventListener("focus", rel); document.removeEventListener("visibilitychange", rel); clearInterval(t); };
  }, []);

  const importar = async (files) => {
    const file = [...(files || [])][0];
    if (!file) return;
    setSt("Lendo a planilha…"); setErro(""); setAviso("");
    try {
      const j = await api("/api/producao/analises", "POST", { usuarioId: user.id, setor, acao: "importar", nome: file.name, conteudo: await readB64(file), competencia: comp });
      setAviso(j.tipo === "HISTORICO"
        ? `Histórico importado: ${j.meses.length} mês(es) — ${j.meses.map((m) => `${nomeMes(m.competencia)} (${int(m.total)} pç${m.preservado ? ", peças da exportação mantidas" : ""})`).join(", ")}.`
        : `${nomeMes(j.meses[0].competencia)}: ${int(j.meses[0].total)} peças importadas${j.meses[0].semCategoria ? ` · ${int(j.meses[0].semCategoria)} sem categoria ficaram fora` : ""}.`);
      const alvo = j.tipo === "HISTORICO" ? j.meses[j.meses.length - 1].competencia : j.meses[0].competencia;
      if (alvo === comp) carregar(comp); else setComp(alvo);
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const salvar = async () => {
    setSt("Salvando…"); setErro("");
    // v259 — só grava como manual o campo que foi alterado à mão; os demais seguem o sistema (identificação do extrato, Matriz, planilha)
    const { _man, ...resto } = f;
    const campos = { ...resto };
    for (const [k, ak] of Object.entries(AUTO)) campos[k] = _man?.[k] && editado(f[k], d?.auto?.[ak]) ? f[k] : "";
    if (!d?.grade && setor !== "BORDADO") campos.insumoManual = "";
    try {
      const j = await api("/api/producao/analises", "POST", { usuarioId: user.id, setor, acao: "salvar", competencia: comp, campos }); setD(j); setAtualizado(new Date());
      setF((x) => ({ ...x, _man: Object.fromEntries(Object.keys(AUTO).map((k) => [k, campos[k] !== ""])) }));
      setAviso("Análise salva."); setTimeout(() => setAviso(""), 2500);
    }
    catch (e) { setErro(e.message); }
    setSt("");
  };
  const criarVazia = async () => {
    setSt("Criando…");
    try { const j = await api("/api/producao/analises", "POST", { usuarioId: user.id, setor, acao: "salvar", competencia: comp, campos: { pecasEstimadas: 13000 } }); setD(j); carregar(comp); } catch (e) { setErro(e.message); }
    setSt("");
  };
  const s = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const sAuto = (k, v, manual = true) => setF((x) => ({ ...x, [k]: v, _man: { ...(x._man || {}), [k]: manual } }));
  const sQ = (k, v) => setF((x) => ({ ...x, qtds: { ...x.qtds, [k]: v } }));
  const sM = (k, v) => setF((x) => ({ ...x, mercado: { ...x.mercado, [k]: v } }));

  const c = d?.calc;
  const minMes = (() => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - 6); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; })();   // v286
  const meses = [...new Set([...(d?.competencias || []), comp].filter(Boolean))].sort().reverse();
  const G = !!d?.grade;   // v257 — silk/bordado: sem peças estimadas; compara com o mercado e mostra o custo por cor/milheiro
  // v261 — sem parâmetros estimados (peças estimadas / custo fixo): todas as análises comparam com o mercado (terceirizar)
  const bom = c && c.incorrido <= c.mediaTerc;
  const INS = G || setor === "BORDADO";   // v291 — setores com insumo no custo
  const MES3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mesesTxt = (l) => (l || []).map((m) => `${MES3[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`).join(", ");
  const chaveResumo = { CORTE: "CORTE", EXPEDICAO: "EXPEDICAO", COSTURA: "COSTURA", SILK: "PERSONALIZACAO", BORDADO: "PERSONALIZACAO" }[setor];
  const rr = rf?.resumo?.setores?.[chaveResumo];
  const pctFree = rf?.resumo?.freelancer?.pct || 0;
  const fs = rf?.fpp?.[setor];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 mr-2"><T.Ico size={20} style={{ color: C.accent }} /><div className="text-lg font-bold" style={{ color: C.navy }}>{T.titulo}</div></div>
        <select value={comp || ""} onChange={(e) => setComp(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={inpS}>
          {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
        <input type="month" min={minMes} value={comp || ""} onChange={(e) => e.target.value && e.target.value >= minMes && setComp(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={inpS} title="Outro mês" />
        <div className="flex-1" />
        {!T.manual && <>
          <input ref={inpRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { importar(e.target.files); e.target.value = ""; }} />
          <button onClick={() => inpRef.current?.click()} disabled={!!st} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>
            {st ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {T.imp}
          </button>
        </>}
        {T.manual && st && <Loader2 size={16} className="animate-spin" style={{ color: C.accent }} />}
        {f && <button onClick={salvar} disabled={!!st} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.navy }}><Save size={14} /> Salvar</button>}
      </div>
      <div className="text-[11px] mb-3" style={{ color: C.sub }}>
        {T.ajuda}
      </div>
      {erro && <div className="p-2.5 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && <div className="p-2.5 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {/* v182.1 — resumo do ano: todos os meses importados */}
      {d?.serie?.length > 0 && (
        <div className="rounded-xl p-4 mb-4 overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Últimos 6 meses · {d.serie.length} mês(es) com análise <span className="font-normal text-[11px]" style={{ color: C.sub }}>— só eles contam para a precificação; o mês corrente aparece, mas não entra nas médias</span></div>
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.sub }}>{["Mês", "Peças", "Pessoal", "Freelancers", ...(INS ? ["Insumos"] : []), "Custo do setor", "Incorrido/pç", ...(G ? [`Incorrido/${T.cor}`] : []), T.volta ? "Contrib./pç" : "Mercado/pç", "Retorno", ""].map((h, i) => <th key={i} className={`py-1 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>{d.serie.map((x) => { const ref = x.mediaTerc; const ok = x.incorrido <= ref; const sel = x.competencia === comp; return (
              <tr key={x.competencia} onClick={() => setComp(x.competencia)} className="cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, background: sel ? C.panel2 : "transparent", fontWeight: sel ? 700 : 400 }}>
                <td className="py-1.5" style={{ color: sel ? C.accent : C.text }}>{nomeMes(x.competencia)}</td>
                <td className="text-right tabular-nums">{int(x.pecas)}</td>
                <td className="text-right tabular-nums" title={x.fontePessoal === "PLANILHA" ? "da planilha" : "Matriz de custos"}>{x.pessoal ? brl(x.pessoal) : "—"}{x.fontePessoal === "PLANILHA" && <span style={{ color: C.sub }}> ·P</span>}</td>
                <td className="text-right tabular-nums" title={x.fonteFree === "PLANILHA" ? `planilha ${brl(x.freelancer)} × sistema ${brl(x.freeSistema)}` : "identificados no sistema"}>
                  {brl(x.freelancer)}{x.fonteFree === "PLANILHA" && <span style={{ color: C.sub }}> ·P</span>}
                  {Math.abs(x.difFree) >= 1 && <div className="text-[10px] font-semibold" style={{ color: C.yellow }}>sistema {brl(x.freeSistema)} ({x.difFree > 0 ? "+" : "−"}{brl(Math.abs(x.difFree))})</div>}
                </td>
                {INS && <td className="text-right tabular-nums">{x.insumo ? brl(x.insumo) : "—"}</td>}
                <td className="text-right tabular-nums">{x.custoTotal ? brl(x.custoTotal) : "—"}</td>
                <td className="text-right tabular-nums">{x.incorrido ? brl(x.incorrido) : "—"}</td>
                {G && <td className="text-right tabular-nums font-semibold">{x.custoUnid ? brl(x.custoUnid) : "—"}</td>}
                <td className="text-right tabular-nums" style={{ color: C.sub }}>{ref ? brl(ref) : "—"}</td>
                <td className="text-right tabular-nums font-semibold" style={{ color: !x.incorrido ? C.sub : x.retornoPct >= 0 ? C.green : C.red }}>{x.mediaTerc && x.incorrido ? pct(x.retornoPct) : "—"}</td>
                <td className="w-28 pl-2"><div className="h-2.5 rounded relative" style={{ background: C.panel2 }}>
                  <div className="h-2.5 rounded" style={{ width: `${Math.min(100, (x.incorrido / Math.max(...d.serie.map((y) => Math.max(y.incorrido, y.mediaTerc)), 0.01)) * 100)}%`, background: ok ? C.green : C.red }} />
                </div></td>
              </tr>); })}</tbody>
          </table>
          <div className="text-[11px] mt-1" style={{ color: C.sub }}>Clique no mês para abrir. ·P = valor da planilha (meses antigos); sem ·P = sistema (Matriz e freelancers identificados). Em amarelo, o freelancer que o sistema registrou quando difere da planilha — vale o da planilha. Retorno = (terceirizado − custo do setor) ÷ terceirizado.</div>
        </div>
      )}

      {d && !d.analise && (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: C.panel, border: `1px dashed ${C.line}`, color: C.sub }}>
          Sem análise de {nomeMes(comp)}. {T.manual ? <button onClick={criarVazia} className="underline font-semibold" style={{ color: C.accent }}>Começar o preenchimento</button> : <>Importe a planilha {T.de} ou <button onClick={criarVazia} className="underline font-semibold" style={{ color: C.accent }}>preencha à mão</button>.</>}
        </div>
      )}

      {c && f && (
        <>
          {/* cenário interno × estimado */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <Kpi t={T.manual || d.grade ? "Peças feitas internamente" : "Peças processadas"} v={int(c.pecas)} sub={d.analise.semCategoria ? `${int(d.analise.semCategoria)} sem categoria fora da análise` : d.analise.arquivoNome || ""} />
            <Kpi t="Custo total do setor" v={brl(c.custoTotal)} sub={`pessoal ${brl(c.pessoal)} + freelancers ${brl(c.freelancer)}${INS ? ` + insumos ${brl(c.insumo)}` : ""}`} />
            <Kpi t="Custo incorrido / peça" v={brl(c.incorrido)} cor={bom ? C.green : C.red} sub={c.mediaTerc ? `mercado ${brl(c.mediaTerc)} / peça` : "preencha o valor de mercado"} />
            {G && <Kpi t={`Custo incorrido / ${T.cor}`} v={brl(c.custoUnid)} cor={c.custoUnid <= c.mercadoUnid ? C.green : C.red} sub={`${int(c.unidades)} ${T.cores} · mercado ${brl(c.mercadoUnid)}`} />}
              {/* v262 — costura/silk/bordado: o valor de mercado é o que se cobra da operação; é o que volta para o setor */}
              {T.volta && <Kpi t="Contribuição bruta à operação" v={brl(c.terceirizado)} cor={C.navy}
                sub={`${brl(c.mediaTerc)} por peça${G && c.unidades ? ` · ${brl(c.mercadoUnid)} por ${T.cor}` : ""} — ${T.volta}`} />}
              <Kpi t="Retorno interno" v={brl(c.economiaTerc)} cor={c.economiaTerc >= 0 ? C.green : C.red} sub={`${pct(c.retornoPct)} do terceirizado (${brl(c.terceirizado)})`} />
              {/* v285 — retorno à operação e valor cobrado na FPP (média dos últimos 6 meses) */}
              {rf && <KpiDestaque t={`Retorno à operação / peça${chaveResumo === "PERSONALIZACAO" ? " (silk + bordado)" : ""}`} cor={C.navy}
                onClick={rr?.base === "SETOR" && rr.categorias?.length ? () => setDet({ titulo: "Retorno à operação / peça", cor: C.navy, valor: brl(rr.valor), itens: rr.categorias,
                  explica: `Custo real do setor (pessoal + freelancers) rateado por tipo de peça pelo peso de mercado · ${mesesTxt(rr.meses)}` }) : undefined}
                v={rr?.meses?.length ? brl(rr.valor) : "—"}
                sub={rr?.meses?.length ? <>líquido {brl(rr.valor * (1 - pctFree))} (− {pct(pctFree, 2)} freelancers) · {rr.base === "SETOR" ? "custo real por peça operada" : "mercado por peça produzida"} · {mesesTxt(rr.meses)}</> : "sem análise nos últimos 6 meses"} />}
              {rf && <KpiDestaque t="Valor cobrado na FPP" cor={C.accent}
                onClick={fs?.categorias?.length ? () => setDet({ titulo: "Valor cobrado na FPP", cor: C.accent, valor: `${brl(fs.porPeca)} / pç`, itens: fs.categorias,
                  explica: `${["CORTE", "EXPEDICAO"].includes(setor) ? "Custo real do setor rateado por tipo de peça pelo peso de mercado" : "Valor de mercado por tipo de peça"} — é o valor de cada item nos parâmetros da FPP · ${mesesTxt(rf.fpp.meses)}` }) : undefined}
                v={setor === "SILK" ? `${brl(fs?.porCor)} / cor` : fs?.porPeca != null ? `${brl(fs.porPeca)} / pç` : "—"}
                sub={setor === "SILK" ? <>contribuição ÷ cores aplicadas · {mesesTxt(rf.fpp.meses)}</>
                  : setor === "BORDADO" && !fs?.categorias?.length ? "sem bordado importado nos meses da FPP"
                  : fs?.categorias?.length ? <>{setor === "BORDADO" ? "referência (na FPP o bordado é informado no item) · " : ""}{fs.categorias.slice(0, 3).map((x) => `${x.n.toLowerCase()} ${brl(x.valor)}`).join(" · ")}{fs.categorias.length > 3 ? ` · +${fs.categorias.length - 3}` : ""} · média ponderada {mesesTxt(rf.fpp.meses)}</>
                  : "sem mês completo (corte e expedição) para a FPP"} />}
          </div>
          {det && <ComposicaoMedia d={det} onClose={() => setDet(null)} />}

          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Custo do setor no mês</div>
              <table className="w-full text-xs"><tbody>
                {[["pessoalManual", "Pessoal (custo total da folha)", d.auto?.pessoal, "Matriz"],
                  ["freelancerManual", `Freelancers ${T.de}`, d.auto?.freelancer, String(d.auto?.fonteFree || "—").toLowerCase()],
                  ...(INS ? [["insumoManual", `Insumos (${T.insumo})`, d.auto?.insumo, setor === "BORDADO" ? "DRE do mês" : c.extra?.tintaUnit != null ? `planilha: ${brl(c.extra.tintaUnit)}/${T.unid}` : "planilha"]] : [])].map(([k, rot, auto, fonte]) => {
                  const ed = !!f._man?.[k] && editado(f[k], auto);
                  return (
                    <tr key={k}><td className="py-1">{rot}
                        <div className="text-[10px]" style={{ color: ed ? C.yellow : C.sub }}>
                          {ed ? <>alterado · sistema {brl(auto)} ({fonte}) <button onClick={() => sAuto(k, r2(auto), false)} className="underline font-semibold" style={{ color: C.accent }}>voltar ao do sistema</button></> : <>do sistema ({fonte}){atualizado ? ` · atualizado ${atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
                        </div></td>
                      <td />
                      <td className="text-right pl-2"><input value={f[k]} onChange={(e) => sAuto(k, e.target.value)} className={inp} style={{ ...inpS, width: 110, borderColor: ed ? C.yellow : C.line }} /></td></tr>);
                })}
              </tbody></table>
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>{G && <>Insumos vêm da planilha importada (custo por {T.unid} × {T.cores}) e entram no custo do setor. </>}Pessoal e freelancers já vêm preenchidos com o do sistema: pessoal pela Matriz de custos (salário, encargos, benefícios e provisões dos funcionários {T.de}) e freelancers {T.de} identificados no extrato. Altere se precisar e salve; sem alteração, o valor continua acompanhando o sistema.</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Interno × terceirizado</div>
              <table className="w-full text-xs"><tbody>
                <tr><td className="py-1">{T.volta ? <>Contribuição bruta à operação <span style={{ color: "inherit", opacity: .7 }}>({T.volta})</span></> : "Custo se terceirizado (valor de mercado × peças)"}</td><td className="text-right font-semibold">{brl(c.terceirizado)}</td></tr>
                <tr><td className="py-1">{T.volta ? "Contribuição bruta por peça" : "Média da peça terceirizada"}</td><td className="text-right">{brl(c.mediaTerc)}</td></tr>
                <tr><td className="py-1">Custo interno do mês</td><td className="text-right">{brl(c.custoTotal)}</td></tr>
                <tr><td className="py-1 font-semibold">{c.economiaTerc >= 0 ? "Economia de" : "Sobrecusto de"} {T.dentro || "cortar dentro"}</td>
                  <td className="text-right font-bold" style={{ color: c.economiaTerc >= 0 ? C.green : C.red }}>{brl(Math.abs(c.economiaTerc))}</td></tr>
                {c.extra && <>
                  {c.unidades > 0 && <>
                    <tr style={{ borderTop: `1px solid ${C.line}` }}><td className="py-1">{T.unids}</td><td className="text-right tabular-nums">{int(c.unidades)}</td></tr>
                    {c.extra.mercadoUnit != null && <tr><td className="py-1">Mercado por {T.unid}</td><td className="text-right tabular-nums">{brl(c.extra.mercadoUnit)}</td></tr>}
                  </>}
                                    {c.extra.terceirizado?.pecas > 0 && (
                    <tr style={{ borderTop: `1px solid ${C.line}` }}><td className="py-1">Terceirizado no mês <span style={{ color: C.sub }}>({int(c.extra.terceirizado.pecas)} pç · {Object.keys(c.extra.terceirizado.fornecedores || {}).join(", ")})</span></td>
                      <td className="text-right tabular-nums font-semibold">{c.extra.terceirizado.valor != null ? brl(c.extra.terceirizado.valor) : "—"}</td></tr>)}
                  {c.extra.terceirizado?.pecas > 0 && <tr><td className="py-1">% feito dentro <span style={{ color: C.sub }}>(peças)</span></td><td className="text-right tabular-nums">{pct(c.pecas / (c.pecas + c.extra.terceirizado.pecas))}</td></tr>}
                </>}
              </tbody></table>
            </div>
          </div>

          {/* v254 — grade peça × nível (silk: cores; bordado: milheiro de pontos) */}
          {d.grade && c.colunas && (
            <div className="rounded-xl overflow-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <table className="w-full text-xs" style={{ minWidth: 220 + c.colunas.length * 78 }}>
                <thead>
                  <tr style={{ background: C.panel2, color: C.sub }}>
                    <th className="px-2 py-2 text-left font-semibold">Peça / {d.grade.titulo}</th>
                    {c.colunas.map((x) => <th key={x.k} className="px-1 py-2 text-right font-semibold">{x.n}</th>)}
                    <th className="px-2 py-2 text-right font-semibold">Total</th><th className="px-2 py-2 text-right font-semibold">%</th>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2 py-1 font-semibold" style={{ color: C.sub }}>Valor unit. mercado (R$)</td>
                    {c.colunas.map((x) => <td key={x.k} className="px-1 py-1 text-right"><input value={f.mercado[x.k] ?? ""} onChange={(e) => sM(x.k, e.target.value.replace(",", "."))} className={inp} style={{ ...inpS, width: 66 }} /></td>)}
                    <td /><td />
                  </tr>
                </thead>
                <tbody>
                  {c.linhas.map((p) => (
                    <tr key={p.k} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="px-2 py-1 font-semibold">{p.n}</td>
                      {c.colunas.map((x) => { const k = `${p.k}__${x.k}`; return (
                        <td key={k} className="px-1 py-1 text-right"><input value={f.qtds[k] ?? ""} onChange={(e) => sQ(k, e.target.value.replace(/\D/g, ""))} className={inp} style={{ ...inpS, width: 66 }} /></td>); })}
                      <td className="px-2 py-1 text-right tabular-nums font-semibold">{p.qtd ? int(p.qtd) : "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums" style={{ color: C.sub }}>{p.qtd ? pct(p.concentracao) : ""}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.line}` }}>
                    <td className="px-2 py-1.5 font-bold">Total</td>
                    {c.colunas.map((x) => <td key={x.k} className="px-1 text-right font-bold tabular-nums">{x.qtd ? int(x.qtd) : "—"}</td>)}
                    <td className="px-2 text-right font-bold tabular-nums">{int(c.pecas)}</td><td className="px-2 text-right">100%</td>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${C.line}`, color: C.sub }}>
                    <td className="px-2 py-1">Concentração</td>
                    {c.colunas.map((x) => <td key={x.k} className="px-1 text-right tabular-nums">{x.qtd ? pct(x.concentracao) : ""}</td>)}<td /><td />
                  </tr>
                  <tr style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2 py-1 font-semibold">Valor interno / peça</td>
                    {c.colunas.map((x) => <td key={x.k} className="px-1 text-right tabular-nums font-semibold">{x.mercado ? brl(x.valorInterno) : "—"}</td>)}
                    <td className="px-2 text-right" colSpan={2} style={{ color: C.sub }}>média {brl(c.incorrido)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-[11px] px-3 py-2" style={{ color: C.sub }}>Quantidades = peças feitas internamente no mês. Valor interno / peça = (valor de mercado do nível ÷ média da peça terceirizada) × custo incorrido por peça: quanto custou, dentro, uma peça com aquele nº de {d.grade.titulo.toLowerCase()}. Salve para recalcular.</div>
            </div>
          )}

          {/* por categoria */}
          {!d.grade && <div className="rounded-xl overflow-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs" style={{ minWidth: 760 }}>
              <thead><tr style={{ background: C.panel2, color: C.sub }}>
                {["Peça", "Qtde", "Concentração", "Valor unit. mercado", "% da média", "Valor interno no mês"].map((h, i) => <th key={h} className={`px-2 py-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {c.categorias.map((x) => (
                  <tr key={x.k} style={{ borderTop: `1px solid ${C.line}`, opacity: x.qtd ? 1 : 0.55 }}>
                    <td className="px-2 py-1 font-semibold">{x.n}</td>
                    <td className="px-2 py-1 text-right"><input value={f.qtds[x.k] ?? ""} onChange={(e) => sQ(x.k, e.target.value.replace(/\D/g, ""))} className={inp} style={{ ...inpS, width: 80 }} /></td>
                    <td className="px-2 py-1 text-right tabular-nums">{pct(x.concentracao)}</td>
                    <td className="px-2 py-1 text-right"><input value={f.mercado[x.k] ?? ""} onChange={(e) => sM(x.k, e.target.value.replace(",", "."))} className={inp} style={{ ...inpS, width: 80 }} /></td>
                    <td className="px-2 py-1 text-right tabular-nums">{n2(x.fator * 100, 1)}%</td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold">{x.mercado ? brl(x.valorInterno) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${C.line}` }}><td className="px-2 py-1.5 font-bold">Total</td><td className="px-2 text-right font-bold tabular-nums">{int(c.pecas)}</td><td className="px-2 text-right">100%</td><td /><td /><td className="px-2 text-right" style={{ color: C.sub }}>peça média {brl(c.incorrido)}</td></tr>
              </tbody>
            </table>
            <div className="text-[11px] px-3 py-2" style={{ color: C.sub }}>Valor interno no mês = (valor de mercado ÷ média da peça terceirizada) × custo incorrido por peça — o custo de cada tipo de peça feita dentro, proporcional ao preço de mercado. As quantidades e valores de mercado podem ser ajustados (salve para recalcular).</div>
          </div>}

          {/* conclusão */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {[["meta", "Meta financeira"], ["causas", "Causas / mérito"], ["providencias", "Providência"]].map(([k, t]) => (
              <div key={k} className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-[11px] font-semibold uppercase mb-1" style={{ color: C.sub }}>{t}</div>
                <textarea value={f[k]} onChange={(e) => s(k)(e.target.value.toUpperCase())} rows={3} className="w-full rounded px-2 py-1 text-xs" style={{ ...inpS, textAlign: "left", resize: "vertical" }} />
              </div>
            ))}
          </div>

          {/* conferência */}
          {Array.isArray(d.analise.detalhe) && d.analise.detalhe.length > 0 && (
            <div className="rounded-xl mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <button onClick={() => setVerDet((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold" style={{ color: C.navy }}>
                {verDet ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Conferência · {d.analise.detalhe.length} linha(s) importada(s)
                {d.analise.semCategoria > 0 && <span className="ml-2 flex items-center gap-1 text-xs font-semibold" style={{ color: C.yellow }}><AlertTriangle size={13} /> {int(d.analise.semCategoria)} peça(s) sem categoria</span>}
              </button>
              {verDet && (
                <div className="overflow-auto px-4 pb-3" style={{ maxHeight: 400 }}>
                  <table className="w-full text-xs"><thead><tr style={{ color: C.sub }}>{["Pedido", "Cliente", "Produto", "Categoria", "Qtde", ...(d.grade ? [d.grade.titulo, "Origem"] : []), ...(setor === "BORDADO" ? ["R$ / peça", "Valor", "Origem"] : []), "Concluído"].map((h) => <th key={h} className="text-left py-1 font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{d.analise.detalhe.map((l, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.line}`, color: l.categoria === "SEM_CATEGORIA" ? C.yellow : C.text }}>
                        <td className="py-1">{l.pedido}</td><td>{l.cliente}</td><td>{l.produto}</td><td>{l.categoria === "SEM_CATEGORIA" ? "sem categoria" : (d.grade ? d.grade.pecas : d.categorias).find((x) => x.k === l.categoria)?.n}</td><td className="text-right pr-2">{int(l.qtde)}</td>
                        {d.grade && <><td className="text-right pr-2">{l.nivel}</td><td style={{ color: /terceir/i.test(l.origem || "") ? C.sub : C.text }}>{l.origem}</td></>}
                        {setor === "BORDADO" && <><td className="text-right pr-2 tabular-nums">{l.preco != null ? brl(l.preco) : "—"}</td><td className="text-right pr-2 tabular-nums">{l.valor != null ? brl(l.valor) : "—"}</td><td style={{ color: /terceir/i.test(l.origem || "") ? C.sub : C.text }}>{l.origem}</td></>}<td>{l.concluido}</td>
                      </tr>))}</tbody></table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
