"use client";
import { podeImportar, gerencial, tem, temAlguma } from "@/lib/acesso";
import Dfc from "./dfc";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Upload, FileText, Trash2, CheckCircle2, AlertTriangle, Clock, KeyRound, Eye, EyeOff, Plus, X, Lock, Save,
  FolderArchive, Loader2, Copy, HelpCircle, Scissors, Pencil, Tag, Search, RefreshCw, ListTree, Wand2,
  ChevronUp, ChevronDown, ChevronsUp, FlaskConical, ArrowUpDown, ShieldCheck, Link2, Undo2, ChevronRight as ChevR,
  LayoutDashboard, Sparkles, CalendarRange, Grid3x3, ArrowLeftRight, LineChart, Construction, BookOpen, ArrowLeft, TrendingUp, TrendingDown, PieChart as PieIco, FileStack,
  Building2, Database, Table2, Mail, Send, Download, FileSpreadsheet, Paperclip, FileCode2, CreditCard, Gauge,
} from "lucide-react";
import { unzipSync } from "fflate";
import MatrizCustos from "./matriz";
import ContasPagarReceber, { BaixasModal } from "./contas";
import Alavancagem from "./alavancagem";
import Transmissao from "./transmissao";
import Uploads from "./uploads";

/* Paleta Meridian (igual ao restante do sistema) */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41",
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nomeComp = (c) => { const [a, m] = c.split("-"); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const hojeISOf = () => new Date().toISOString().slice(0, 10);
// período padrão da identificação: o mês inteiro, ou do dia 1º de janeiro até hoje no modo anual
const periodoPadrao = (comp, ano) => {
  if (ano) {
    const h = hojeISOf();
    const fim = `${ano}-12-31`;
    return { de: `${ano}-01-01`, ate: h < fim ? h : fim };
  }
  const [a, m] = String(comp || "").split("-").map(Number);
  if (!a || !m) return { de: "", ate: "" };
  const ult = new Date(a, m, 0).getDate();
  return { de: `${comp}-01`, ate: `${comp}-${String(ult).padStart(2, "0")}` };
};
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const dataHora = (v) => { const d = new Date(v); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const u8ToB64 = (u8) => { let s = ""; const k = 0x8000; for (let i = 0; i < u8.length; i += k) s += String.fromCharCode.apply(null, u8.subarray(i, i + k)); return btoa(s); };
const readU8 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(new Uint8Array(fr.result)); fr.readAsArrayBuffer(file); });
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });

function statusCard(n, esperado, justificativa, arqs = []) {
  if (arqs.some((a) => a.prova && a.prova.ok === false)) return { k: "erro", label: "Erro de leitura", cor: C.red, bg: C.redSoft, Ico: AlertTriangle };
  if (n >= esperado) return { k: "ok", label: "Enviado", cor: C.green, bg: C.greenSoft, Ico: CheckCircle2 };
  if (justificativa) return { k: "just", label: n > 0 ? "Parcial · justificado" : "Justificado", cor: C.blue, bg: C.blueSoft, Ico: CheckCircle2 };
  if (n > 0) return { k: "parc", label: `Parcial ${n}/${esperado}`, cor: C.yellow, bg: C.yellowSoft, Ico: AlertTriangle };
  return { k: "pend", label: "Pendente", cor: C.red, bg: C.redSoft, Ico: Clock };
}

/* ============================================================ */
export default function Financeiro({ user }) {
  // tela: dash | meses | mes | contas | regras | senhas
  // v170 — quem não é master/diretoria vê só o operacional (documentos financeiros e contas)
  const ger = gerencial(user);
  const [tela, setTela] = useState({ v: "dash" });
  const [ano, setAno] = useState(new Date().getFullYear());
  const ir = (t) => { setTela(t); if (typeof window !== "undefined") document.querySelector("main .overflow-auto")?.scrollTo({ top: 0 }); };
  const migalhas = [{ t: "Financeiro", go: () => ir({ v: "dash" }) }];
  if (["meses", "mes", "identAno"].includes(tela.v)) migalhas.push({ t: `Análise financeira ${tela.v === "mes" ? tela.comp.slice(0, 4) : tela.v === "identAno" ? tela.ano : ano}`, go: () => ir({ v: "meses" }) });
  if (tela.v === "mes") migalhas.push({ t: nomeComp(tela.comp) });
  if (tela.v === "identAno") migalhas.push({ t: `Identificação ${tela.ano}${tela.nomeGrupoDre ? ` · ${tela.nomeGrupoDre}` : ""}` });
  if (["dados", "contas", "regras", "senhas"].includes(tela.v)) migalhas.push({ t: "Dados financeiros", go: () => ir({ v: "dados" }) });
  if (tela.v === "contas") migalhas.push({ t: "Plano de contas" });
  if (tela.v === "regras") migalhas.push({ t: "Palavras-chave" });
  if (tela.v === "senhas") migalhas.push({ t: "Senhas de PDF" });
  if (tela.v === "matriz") migalhas.push({ t: "Matriz de custos" });
  if (tela.v === "pagrec") migalhas.push({ t: "Contas a pagar e receber" });
  if (tela.v === "dfc") migalhas.push({ t: "DFC · fluxo de caixa futuro" });
  if (tela.v === "alavancagem") migalhas.push({ t: "Alavancagem" });
  if (tela.v === "credito") migalhas.push({ t: "Posição de crédito" });
  if (tela.v === "transmissao") migalhas.push({ t: "Transmissão de arquivos" });
  return (
    <div>
      {migalhas.length > 1 && (
        <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
          <button onClick={migalhas[migalhas.length - 2].go} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}><ArrowLeft size={15} /> Voltar</button>
          {migalhas.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevR size={13} style={{ color: C.sub }} />}
              {m.go && i < migalhas.length - 1 ? <button onClick={m.go} style={{ color: C.sub }}>{m.t}</button> : <span className="font-semibold">{m.t}</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      {tela.v === "dash" && (ger ? <FinDashboard user={user} ir={ir} /> : <FinOperacional user={user} ir={ir} />)}
      {tela.v === "dados" && <DadosFinanceiros user={user} ir={ir} />}
      {tela.v === "transmissao" && <PaginaTransmissao user={user} />}
      {tela.v === "meses" && (
        <AnaliseMensal user={user} ano={ano} setAno={setAno}
          abrir={(comp) => ir({ v: "mes", comp, aba: ger ? "dre" : "importacao" })}
          abrirGrupo={(grupoDre, nomeGrupoDre) => ir({ v: "identAno", ano, grupoDre, nomeGrupoDre })}
          abrirAlav={() => ir({ v: "alavancagem" })} />
      )}
      {tela.v === "identAno" && (
        <Identificacao key={`ano-${tela.ano}-${tela.grupoDre || ""}`} user={user} comp={`${tela.ano}-01`}
          ano={tela.ano} grupoDre={tela.grupoDre} nomeGrupoDre={tela.nomeGrupoDre} />
      )}
      {tela.v === "mes" && <MesFinanceiro user={user} tela={tela} setTela={setTela} />}
      {tela.v === "contas" && <PlanoContas user={user} />}
      {tela.v === "regras" && <Regras user={user} comp={mesAnterior()} />}
      {tela.v === "senhas" && <Senhas user={user} />}
      {tela.v === "matriz" && ger && <MatrizCustos user={user} />}
      {tela.v === "pagrec" && <ContasPagarReceber user={user} />}
      {tela.v === "alavancagem" && ger && <Alavancagem user={user} master aba="dividas" />}
      {tela.v === "credito" && ger && <Alavancagem user={user} master aba="credito" />}
      {tela.v === "dfc" && ger && <Dfc user={user} />}
    </div>
  );
}

/* ---------------- v173 — Transmissão de arquivos: botão pequeno → página com o card e o histórico ---------------- */
function BotaoTransmissao({ ir }) {
  return (
    <button onClick={() => ir({ v: "transmissao" })} title="Enviar documentos: o sistema identifica e leva cada um para o lugar certo"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-shadow hover:shadow-md"
      style={{ background: C.accent, color: "#fff" }}>
      <Upload size={14} /> Transmissão
    </button>
  );
}
function PaginaTransmissao({ user }) {
  const [tick, setTick] = useState(0);
  return (
    <div>
      <Transmissao user={user} Historico={ImportarHistorico} onMudou={() => setTick((t) => t + 1)} />
      <div className="text-sm font-bold mb-2 mt-6" style={{ color: C.navy }}>Histórico de documentos importados</div>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Os mesmos documentos da guia Dados › Uploads (tudo o que foi enviado fica guardado lá).</div>
      <Uploads key={tick} user={user} />
    </div>
  );
}

/* ---------------- v170 — início do financeiro para quem não é gerencial ---------------- */
function FinOperacional({ user, ir }) {
  const cards = [
    temAlguma(user, "contasPagar", "contasReceber") && ["pagrec", ArrowLeftRight, "Contas a pagar e receber", "Lançar, editar, excluir e importar títulos; vencimentos e baixas"],
    tem(user, "docsFinanceiros") && ["meses", CalendarRange, "Documentos financeiros", "Extratos, faturas, contratos e guias do mês: importação, identificação, contabilidade e recebimentos"],
  ].filter(Boolean);
  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <BotaoTransmissao ir={ir} />
        <button onClick={() => ir({ v: "dados" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.navy }}>
          <Database size={14} style={{ color: C.accent }} /> Dados
        </button>
      </div>
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {cards.map(([v, Ico, t, sub]) => (
          <button key={v} onClick={() => ir({ v })} className="text-left rounded-2xl p-5 transition-shadow hover:shadow-lg" style={{ background: C.navy, color: "#fff" }}>
            <Ico size={26} style={{ color: C.accent }} />
            <div className="text-lg font-bold mt-2">{t}</div>
            <div className="text-xs mt-1" style={{ color: "#9FB0C7" }}>{sub}</div>
          </button>
        ))}
      </div>
      {!cards.length && <div className="text-sm" style={{ color: C.sub }}>Seu usuário não tem permissões no financeiro.</div>}
      <div className="text-xs" style={{ color: C.sub }}>DRE, painéis, matriz de custos, DFC e alavancagem são dados gerenciais (master e diretoria).</div>
    </div>
  );
}

/* ---------------- DASHBOARD (dia · mês · ano) ---------------- */
function useResumo(user, ano, rk = 0) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setD(null); setErro("");
    fetch(`/api/fin/resumo?u=${user.id}&ano=${ano}`).then((r) => r.json().then((j) => (r.ok ? setD(j) : setErro(j.error || "Erro")))).catch(() => setErro("Falha de conexão."));
  }, [ano, rk]);
  return [d, erro];
}
const moeda = (n) => "R$ " + brl(n);

function Kpi({ rotulo, valor, cor, sub, Ico }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>{Ico && <Ico size={14} />} {rotulo}</div>
      <div className="text-xl font-bold mt-1" style={{ color: cor || C.text }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}

function BlocoPeriodo({ titulo, p }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-sm font-bold mb-3" style={{ color: C.navy }}>{titulo}</div>
      <div className="grid grid-cols-3 gap-3">
        <div><div className="text-[11px]" style={{ color: C.sub }}>Entradas</div><div className="font-bold" style={{ color: C.blue }}>{moeda(p.entradas)}</div></div>
        <div><div className="text-[11px]" style={{ color: C.sub }}>Saídas</div><div className="font-bold" style={{ color: C.red }}>{moeda(p.saidas)}</div></div>
        <div><div className="text-[11px]" style={{ color: C.sub }}>Resultado</div><div className="font-bold" style={{ color: p.resultado >= 0 ? C.green : C.red }}>{moeda(p.resultado)}</div></div>
      </div>
      <div className="text-[11px] mt-2" style={{ color: p.pend ? C.accent : C.sub }}>{p.n} lançamento(s){p.pend ? ` · ${p.pend} a identificar` : ""}</div>
    </div>
  );
}

function BarrasAno({ meses, onClick }) {
  const ks = Object.keys(meses);
  const max = Math.max(1, ...ks.map((k) => Math.max(meses[k].entradas, -meses[k].saidas)));
  const H = 140;
  return (
    <div className="flex items-end gap-2" style={{ height: H + 34 }}>
      {ks.map((k, i) => {
        const m = meses[k];
        const he = (m.entradas / max) * H, hs = (-m.saidas / max) * H;
        return (
          <button key={k} onClick={() => onClick(k)} className="flex-1 flex flex-col items-center gap-1 group" title={`${nomeComp(k)}\nEntradas ${moeda(m.entradas)}\nSaídas ${moeda(m.saidas)}\nResultado ${moeda(m.resultado)}`}>
            <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: H }}>
              <div style={{ width: "38%", height: Math.max(he, m.entradas ? 2 : 0), background: C.blue, borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
              <div style={{ width: "38%", height: Math.max(hs, m.saidas ? 2 : 0), background: C.red, borderRadius: "3px 3px 0 0", opacity: 0.75 }} />
            </div>
            <div className="text-[10px] font-semibold" style={{ color: C.sub }}>{MESES[i].slice(0, 3)}</div>
            <div className="text-[9px]" style={{ color: m.resultado >= 0 ? C.green : C.red }}>{m.n ? (m.resultado / 1000).toFixed(0) + "k" : ""}</div>
          </button>
        );
      })}
    </div>
  );
}

function FinDashboard({ user, ir }) {
  const anoAtual = new Date().getFullYear();
  const [d, erro] = useResumo(user, anoAtual);
  const [anual, erroAnual] = useAnual(user, anoAtual);
  const hoje = new Date();
  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <BotaoTransmissao ir={ir} />
        <button onClick={() => ir({ v: "dados" })} title="Plano de contas, palavras-chave e senhas de PDF"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-shadow hover:shadow-md"
          style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.navy }}>
          <Database size={14} style={{ color: C.accent }} /> Dados
        </button>
      </div>
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {[
          ["matriz", Grid3x3, "Matriz de custos", "Pessoal, estrutura, dívidas, metas e custo por peça"],
          ["pagrec", ArrowLeftRight, "Contas a pagar e receber", "Títulos em aberto, vencimentos e baixas"],
          ["dfc", LineChart, "DFC · fluxo de caixa futuro", "Saldo previsto por dia, com sugestões de operação"],
          ["meses", CalendarRange, "Análise financeira", "Indicadores do ano, DRE do mês, importação e identificação"],
          ["alavancagem", TrendingDown, "Alavancagem", "Contratos, mútuos, investimentos e passivo tributário"],
          ["credito", CreditCard, "Posição de crédito", "Limites por banco, utilizado e disponível"],
        ].map(([v, Ico, t, sub]) => (
          <button key={v} onClick={() => ir({ v })} className="text-left rounded-2xl p-5 transition-shadow hover:shadow-lg" style={{ background: C.navy, color: "#fff" }}>
            <Ico size={26} style={{ color: C.accent }} />
            <div className="text-lg font-bold mt-2">{t}</div>
            <div className="text-xs mt-1" style={{ color: "#9FB0C7" }}>{sub}</div>
          </button>
        ))}
      </div>
      {anual && <IndicadoresAno d={anual} ano={anoAtual}
        abrirGrupo={(grupoDre, nomeGrupoDre) => ir({ v: "identAno", ano: anoAtual, grupoDre, nomeGrupoDre })}
        abrirAlav={() => ir({ v: "alavancagem" })} />}
      {erroAnual && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erroAnual}</div>}

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {d && (
        <>
          <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <BlocoPeriodo titulo={`Hoje · ${hoje.toLocaleDateString("pt-BR")}`} p={d.periodo.dia} />
            <BlocoPeriodo titulo={`Mês · ${MESES[hoje.getMonth()]}/${anoAtual}`} p={d.periodo.mes} />
            <BlocoPeriodo titulo={`Ano · ${anoAtual}`} p={d.periodo.ano} />
          </div>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold" style={{ color: C.navy }}>Entradas × saídas por mês · {anoAtual}</div>
              <div className="flex gap-3 text-[11px]" style={{ color: C.sub }}>
                <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: C.blue, borderRadius: 2 }} /> Entradas</span>
                <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: C.red, borderRadius: 2 }} /> Saídas</span>
              </div>
            </div>
            <BarrasAno meses={d.meses} onClick={(k) => ir({ v: "mes", comp: k, aba: "dre" })} />
          </div>
          <div className="text-xs mt-3" style={{ color: C.sub }}>
            Valores pela data dos lançamentos, sem transferências entre contas (conciliação). Os KPIs definitivos deste painel ainda serão definidos.
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- DADOS FINANCEIROS ----------------
   Plano de contas, palavras-chave e senhas de PDF. Usado dentro do Financeiro (botão Dados)
   e na guia Dados › Dados financeiros. As duas telas leem e gravam a mesma base,
   então alterar numa altera na outra. */
const DADOS_FIN = [
  ["contas", BookOpen, "Plano de contas", "Contas-caixa da DRE"],
  ["regras", Wand2, "Palavras-chave", "Identificação automática"],
  ["senhas", KeyRound, "Senhas de PDF", "Abertura automática"],
];
export function DadosFinanceiros({ user, ir }) {
  const [sub, setSub] = useState(null);   // usado só quando aberto pela guia Dados (sem ir)
  if (!ir && sub) {
    const nome = DADOS_FIN.find((x) => x[0] === sub)?.[2];
    return (
      <div>
        <div className="flex items-center gap-1 text-sm mb-4">
          <button onClick={() => setSub(null)} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}><ArrowLeft size={15} /> Voltar</button>
          <button onClick={() => setSub(null)} style={{ color: C.sub }}>Dados financeiros</button>
          <ChevR size={13} style={{ color: C.sub }} />
          <span className="font-semibold">{nome}</span>
        </div>
        {sub === "contas" && <PlanoContas user={user} />}
        {sub === "regras" && <Regras user={user} comp={mesAnterior()} />}
        {sub === "senhas" && <Senhas user={user} />}
      </div>
    );
  }
  const abrir = (v) => (ir ? ir({ v }) : setSub(v));
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {DADOS_FIN.map(([v, Ico, t, s]) => (
        <button key={v} onClick={() => abrir(v)} className="flex items-center gap-3 text-left rounded-xl px-4 py-3 transition-shadow hover:shadow-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <Ico size={20} style={{ color: C.accent }} />
          <div>
            <div className="font-bold text-sm">{t}</div>
            <div className="text-xs" style={{ color: C.sub }}>{s}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------------- MÓDULOS EM CONSTRUÇÃO ---------------- */
function EmConstrucao({ titulo, Ico, texto }) {
  return (
    <div className="rounded-2xl p-10 text-center" style={{ background: C.panel, border: `1px dashed ${C.line}` }}>
      <Ico size={36} style={{ color: C.accent, margin: "0 auto" }} />
      <div className="text-lg font-bold mt-3" style={{ color: C.navy }}>{titulo}</div>
      <div className="text-sm mt-1 max-w-lg mx-auto" style={{ color: C.sub }}>{texto}</div>
      <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: C.accentSoft, color: C.accent }}>
        <Construction size={13} /> Em construção
      </div>
    </div>
  );
}
function PagarReceber() {
  const [aba, setAba] = useState("pagar");
  return (
    <div>
      <div className="flex gap-1 mb-5" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["pagar", "Contas a pagar", TrendingDown], ["receber", "Contas a receber", TrendingUp]].map(([k, t, I]) => (
          <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            <I size={15} /> {t}
          </button>
        ))}
      </div>
      {aba === "pagar"
        ? <EmConstrucao titulo="Contas a pagar" Ico={TrendingDown} texto="Fornecedores, impostos, folha e demais títulos: vencimento, valor, conta-caixa e baixa pelo extrato." />
        : <EmConstrucao titulo="Contas a receber" Ico={TrendingUp} texto="Pedidos e boletos de clientes: vencimento, valor, situação e baixa pela cobrança e pelo extrato." />}
    </div>
  );
}


/* ---------------- INDICADORES DO ANO (DRE + alavancagem) ---------------- */
const compactoBR = (v) => {
  const n = Number(v) || 0, a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};
const pctBR = (v) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

function useAnual(user, ano) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setD(null); setErro("");
    if (ano == null) return;   // v170 — sem painel gerencial
    fetch(`/api/fin/anual?u=${user.id}&ano=${ano}`)
      .then((r) => r.json().then((j) => (r.ok ? setD(j) : setErro(j.error || "Erro"))))
      .catch(() => setErro("Falha de conexão."));
  }, [ano]);
  return [d, erro];
}

function Ind({ rotulo, valor, pct, cor, forte, titulo, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} title={onClick ? `${titulo || rotulo} · clique para ver os lançamentos` : titulo}
      className={`rounded-lg px-3 py-2 text-left w-full${onClick ? " transition-shadow hover:shadow-md" : ""}`}
      style={{ background: forte ? C.panel2 : C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${cor || C.line}`, cursor: onClick ? "pointer" : "default" }}>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.sub }}>
        <span className="truncate">{rotulo}</span>
        {onClick && <Search size={10} className="shrink-0" style={{ color: C.accent }} />}
      </div>
      <div className={forte ? "font-bold" : "font-semibold"} style={{ fontSize: forte ? 17 : 15, color: cor || C.text, lineHeight: 1.3 }}>
        {compactoBR(valor)}
      </div>
      {pct != null && <div className="text-[10px]" style={{ color: C.sub }}>{pctBR(pct)} da receita</div>}
    </Tag>
  );
}

function IndicadoresAno({ d, ano, abrirGrupo, abrirAlav }) {
  const t = d.totais;
  const a = d.alavancagem;
  const nenhum = !t.meses;
  const ir = (grupo, nome) => abrirGrupo && abrirGrupo(grupo, nome);

  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-sm font-bold" style={{ color: C.navy }}>DRE de {ano} até o momento</div>
        <div className="text-xs" style={{ color: C.sub }}>
          {nenhum ? "nenhum mês lançado ainda"
            : `${t.meses} ${t.meses === 1 ? "mês lançado" : "meses lançados"} · ${nomeComp(t.primeiro)} a ${nomeComp(t.ultimo)}`}
        </div>
      </div>

      {nenhum ? (
        <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>
          Assim que você importar e identificar o primeiro mês, os indicadores do ano aparecem aqui.
        </div>
      ) : (
        <>
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Ind rotulo="Receita" valor={t.receita} cor={C.blue} titulo="Vendas, serviços e patrimônio, já líquidas de devolução"
              onClick={() => ir("RECEITA", "Receita")} />
            <Ind rotulo="CMV" valor={t.cmv} cor={C.red} pct={t.receita ? t.cmv / t.receita : null} titulo="Tudo que varia com a produção"
              onClick={() => ir("CMV", "CMV")} />
            <Ind rotulo="Margem de contribuição" valor={t.margem} cor={t.margem >= 0 ? C.green : C.red} pct={t.margemPct} forte />
            <Ind rotulo="Despesa adm e vegetativa" valor={t.adm} cor={C.red} pct={t.receita ? t.adm / t.receita : null}
              onClick={() => ir("DESPESA_ADM", "Despesa adm e vegetativa")} />
            <Ind rotulo="EBITDA" valor={t.ebitda} cor={t.ebitda >= 0 ? C.green : C.red} pct={t.ebitdaPct} forte />
            <Ind rotulo="Impostos e juros" valor={t.impostos} cor={C.red} pct={t.receita ? t.impostos / t.receita : null}
              onClick={() => ir("IMPOSTOS_JUROS", "Impostos e juros")} />
            <Ind rotulo="Lucro líquido" valor={t.lucro} cor={t.lucro >= 0 ? C.green : C.red} pct={t.lucroPct} forte />
            <Ind rotulo="Investimento" valor={t.investimento} cor={C.yellow} pct={t.receita ? t.investimento / t.receita : null}
              onClick={() => ir("INVESTIMENTO", "Investimento")} />
            <Ind rotulo="NORT (loja)" valor={t.nort || 0} cor={(t.nort || 0) >= 0 ? C.green : C.red} pct={t.receita ? (t.nort || 0) / t.receita : null}
              titulo="Receitas da NORT (caixa NORT) menos os custos da loja que a Meridian banca"
              onClick={() => ir("NORT", "NORT (loja)")} />
            <Ind rotulo="Resultado da operação" valor={t.resultado} cor={t.resultado >= 0 ? C.green : C.red} forte />
          </div>
          <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <Ind rotulo="Saldo da operação" valor={t.saldoOperacao} cor={t.saldoOperacao >= 0 ? C.green : C.red} forte
              titulo="Saldo inicial do primeiro mês lançado + resultado acumulado" />
            <Ind rotulo="Recursos externos" valor={t.externo} cor={t.externo >= 0 ? C.blue : C.red}
              titulo="Empréstimo, factoring, capital social e mútuo — entrada menos pagamento"
              onClick={() => ir("EXT_BANCARIO,EXT_SOCIOS,EXT_FACTORING,EXT_CAPITAL,EXT_MUTUO,EXT_SEM_JUROS", "Recursos externos")} />
            <Ind rotulo="Saldo final" valor={t.saldoFinal} cor={t.saldoFinal >= 0 ? C.green : C.red} forte />
            <Ind rotulo="Média mensal de receita" valor={t.mediaReceita} cor={C.blue} />
            <Ind rotulo="Alavancagem total" valor={a?.atual?.total} cor={C.red} forte
              titulo="Dívidas + tributos em aberto" onClick={abrirAlav} />
          </div>
        </>
      )}

    </div>
  );
}

/* ---------------- ANÁLISE MENSAL (cards do ano) ---------------- */
function AnaliseMensal({ user, ano, setAno, abrir, abrirGrupo, abrirAlav }) {
  const [rk, setRk] = useState(0);
  const [d, erro] = useResumo(user, ano, rk);
  const ger = gerencial(user);
  const [anual, erroAnual] = useAnual(user, ger ? ano : null);
  const [hist, setHist] = useState(false);
  const alavMes = useMemo(
    () => Object.fromEntries((anual?.meses || []).map((m) => [m.competencia, m.alavancagem])),
    [anual]
  );
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setAno(ano - 1)} className="px-3 py-2 font-bold" style={{ color: C.sub }}>‹</button>
          <div className="px-4 py-2 font-bold text-lg">{ano}</div>
          <button onClick={() => setAno(ano + 1)} disabled={ano >= new Date().getFullYear()} className="px-3 py-2 font-bold" style={{ color: C.sub, opacity: ano >= new Date().getFullYear() ? 0.3 : 1 }}>›</button>
        </div>
        <div className="text-sm flex-1" style={{ color: C.sub }}>Clique no mês para abrir a DRE, a importação e a identificação.</div>
      </div>
      {anual && <IndicadoresAno d={anual} ano={ano} abrirGrupo={abrirGrupo} abrirAlav={abrirAlav} />}
      {erroAnual && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erroAnual}</div>}
      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {d && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {Object.entries(d.meses).map(([k, m], i) => {
            const futuro = k > new Date().toISOString().slice(0, 7);
            const doc = m.docs;
            const temAlgo = m.n > 0 || doc.enviados > 0;
            const completo = (m.hist > 0 || (doc.pend === 0 && doc.erro === 0)) && m.pend === 0 && m.n > 0;
            const [stTxt, stCor, stBg] = futuro ? ["—", C.sub, C.panel2] : !temAlgo ? ["Sem dados", C.sub, C.panel2] : completo ? ["Completo", C.green, C.greenSoft] : ["Em andamento", C.accent, C.accentSoft];
            const pctId = m.n ? Math.round(((m.n - m.pend) / m.n) * 100) : 0;
            return (
              <button key={k} onClick={() => !futuro && abrir(k)} disabled={futuro} className="text-left rounded-xl p-4 transition-shadow hover:shadow-lg"
                style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${completo ? C.green : temAlgo ? C.accent : C.line}`, opacity: futuro ? 0.45 : 1 }}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-base">{MESES[i]}</div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: stCor, background: stBg }}>{stTxt}</span>
                </div>
                {temAlgo ? (
                  <>
                    {ger && <div className="grid grid-cols-2 gap-1 mt-3 text-xs">
                      <span style={{ color: C.sub }}>Entradas</span><span className="text-right font-semibold" style={{ color: C.blue }}>{moeda(m.entradas)}</span>
                      <span style={{ color: C.sub }}>Saídas</span><span className="text-right font-semibold" style={{ color: C.red }}>{moeda(m.saidas)}</span>
                      <span style={{ color: C.sub }}>Resultado</span><span className="text-right font-bold" style={{ color: m.resultado >= 0 ? C.green : C.red }}>{moeda(m.resultado)}</span>
                    </div>}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px]" style={{ color: C.sub }}><span>Identificado</span><span>{pctId}%</span></div>
                      <div className="h-1.5 rounded-full mt-0.5" style={{ background: C.panel2 }}><div className="h-1.5 rounded-full" style={{ width: `${pctId}%`, background: pctId === 100 ? C.green : C.accent }} /></div>
                    </div>
                    {m.hist > 0 ? (
                    <div className="text-[10px] mt-2" style={{ color: C.blue }}>Histórico do sistema anterior · {m.hist} lanç.{m.pend ? ` · ${m.pend} a identificar` : ""}</div>
                    ) : (
                    <div className="text-[10px] mt-2" style={{ color: doc.pend || doc.erro ? C.red : C.sub }}>
                      Documentos: {doc.ok}/{doc.total}{doc.just ? ` · ${doc.just} justif.` : ""}{doc.pend ? ` · ${doc.pend} pend.` : ""}{doc.erro ? ` · ${doc.erro} c/ erro` : ""}
                    </div>
                    )}
                  </>
                ) : !futuro && <div className="text-xs mt-3" style={{ color: C.sub }}>Nenhum documento enviado.</div>}
                {!futuro && alavMes[k] && (
                  <div className="mt-3 pt-2" style={{ borderTop: `1px dashed ${C.line}` }}>
                    <div className="flex items-baseline justify-between text-[10px]" style={{ color: C.sub }}>
                      <span>Alavancagem no fim do mês</span>
                      {(() => {
                        const ant = alavMes[somaMes(k, -1)];
                        if (!ant || !ant.total) return null;
                        const dif = alavMes[k].total - ant.total;
                        return (
                          <span className="font-semibold" style={{ color: dif > 0 ? C.red : dif < 0 ? C.green : C.sub }}>
                            {dif > 0 ? "▲" : dif < 0 ? "▼" : "="} {compactoBR(Math.abs(dif))}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="font-bold text-sm" style={{ color: C.text }}>{compactoBR(alavMes[k].total)}</div>
                    <div className="text-[10px]" style={{ color: C.sub }}>
                      dívida {compactoBR(alavMes[k].divida)} · tributos {compactoBR(alavMes[k].tributos)} · mensal {compactoBR(alavMes[k].mensal)}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- IMPORTAR HISTÓRICO (sistema anterior) ---------------- */
export function ImportarHistorico({ user, fechar, iniciais }) {
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("");
  const [prev, setPrev] = useState(null);
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState(null);
  const enviar = async (simular, t = texto) => {
    setErro(""); setSt(simular ? "Lendo arquivo…" : "Gravando lançamentos…");
    try {
      const r = await fetch("/api/fin/historico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, texto: t, simular }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro");
      simular ? setPrev(j) : setFim(j);
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const escolher = async (f) => {
    if (!f) return;
    const u8 = await readU8(f);
    let t = new TextDecoder("utf-8").decode(u8);
    if (t.includes("\uFFFD")) t = new TextDecoder("windows-1252").decode(u8);
    setNome(f.name); setTexto(t); setPrev(null); setFim(null);
    enviar(true, t);
  };
  useEffect(() => { if (iniciais?.length) escolher(iniciais[0]); }, []);   // v171 — vindo da Transmissão de arquivos
  const SIT = { NOVO: ["Novo", C.green, C.greenSoft], SUBSTITUI: ["Substitui histórico", C.accent, C.accentSoft], BLOQUEADO: ["Fica de fora", C.red, C.redSoft] };
  const validos = prev ? prev.meses.filter((m) => m.situacao !== "BLOQUEADO") : [];
  const bloqueados = prev ? prev.meses.filter((m) => m.situacao === "BLOQUEADO") : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(3,10,22,0.55)" }}>
      <div className="rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ background: C.panel }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ background: C.panel2, borderBottom: `1px solid ${C.line}`, borderRadius: "12px 12px 0 0" }}>
          <div className="font-bold" style={{ color: C.navy }}>Importar histórico de identificações</div>
          <button onClick={() => fechar(!!fim)}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-auto">
          {!fim && (
            <label className="flex items-center gap-3 p-4 rounded-lg cursor-pointer" style={{ border: `2px dashed ${C.line}` }}>
              <Upload size={20} style={{ color: C.accent }} />
              <div className="text-sm">
                <div className="font-semibold">{nome || "Escolher o .txt do Extrato do sistema anterior"}</div>
                <div className="text-xs" style={{ color: C.sub }}>Cada mês do arquivo entra já identificado pela conta-caixa. Reimportar substitui o histórico do mês.</div>
              </div>
              <input type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => escolher(e.target.files[0])} />
            </label>
          )}
          {st && <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> {st}</div>}
          {erro && <div className="p-3 rounded mt-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
          {(fim || prev) && (() => {
            const p = fim || prev;
            return (
              <>
                {fim && <div className="p-3 rounded mb-4 text-sm font-semibold" style={{ background: C.greenSoft, color: C.green }}>{fim.gravados.toLocaleString("pt-BR")} lançamentos gravados.</div>}
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs">
                    <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
                      {["Mês", "Lanç.", "Sem conta", "Entradas", "Saídas", "Resultado", "Conciliação", "Situação"].map((h) => <th key={h} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}
                    </tr></thead>
                    <tbody>{p.meses.map((m) => {
                      const [t, c, bg] = SIT[m.situacao];
                      return (
                        <tr key={m.competencia} style={{ borderBottom: `1px solid ${C.line}` }}>
                          <td className="px-2 py-1.5 font-semibold">{nomeComp(m.competencia)}</td>
                          <td className="px-2 py-1.5">{m.n}</td>
                          <td className="px-2 py-1.5" style={{ color: m.semConta ? C.red : C.sub }}>{m.semConta}</td>
                          <td className="px-2 py-1.5" style={{ color: C.blue }}>{moeda(m.entradas)}</td>
                          <td className="px-2 py-1.5" style={{ color: C.red }}>{moeda(m.saidas)}</td>
                          <td className="px-2 py-1.5 font-semibold" style={{ color: m.resultado >= 0 ? C.green : C.red }}>{moeda(m.resultado)}</td>
                          <td className="px-2 py-1.5" style={{ color: Math.abs(m.conciliacao) > 0.009 ? C.yellow : C.sub }}>{moeda(m.conciliacao)}</td>
                          <td className="px-2 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: c, background: bg }}>{t}</span></td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                {bloqueados.length > 0 && !fim && (
                  <div className="text-xs mt-3" style={{ color: C.red }}>
                    {bloqueados.map((m) => nomeComp(m.competencia)).join(", ")}: já têm lançamentos de documentos deste sistema e não serão importados.
                  </div>
                )}
                {Object.keys(p.naoAchadas || {}).length > 0 && (
                  <div className="text-xs mt-2" style={{ color: C.yellow }}>Contas não encontradas no plano (ficam sem conta): {Object.entries(p.naoAchadas).map(([k, v]) => `${k} (${v})`).join(", ")}</div>
                )}
                <div className="text-xs mt-2" style={{ color: C.sub }}>Lançamentos "INDEFINIDO" do sistema anterior entram como <b>a identificar</b>.</div>
              </>
            );
          })()}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ background: C.panel2, borderTop: `1px solid ${C.line}`, borderRadius: "0 0 12px 12px" }}>
          {fim ? (
            <button onClick={() => fechar(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Concluir</button>
          ) : (
            <>
              <button onClick={() => fechar(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
              <button disabled={!validos.length || !!st} onClick={() => enviar(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: C.accent, opacity: !validos.length || st ? 0.5 : 1 }}>
                Importar {validos.reduce((s, m) => s + m.n, 0).toLocaleString("pt-BR")} lançamentos ({validos.length} {validos.length === 1 ? "mês" : "meses"})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- MÊS: DRE · IMPORTAÇÃO · IDENTIFICAÇÃO · CONTABILIDADE · RECEBIMENTOS ---------------- */
function MesFinanceiro({ user, tela, setTela }) {
  const comp = tela.comp;
  const setComp = (c) => setTela((t) => ({ ...t, comp: c }));
  const setAba = (aba, extra = {}) => setTela((t) => ({ ...t, aba, ...extra }));
  const abas = [["dre", "DRE do mês", PieIco], ["painel", "Painel de previsão", Gauge], ["importacao", "Importação", FileStack],
    ["identificacao", "Identificação", Tag], ["contabilidade", "Contabilidade", Building2], ["recebimentos", "Recebimentos", Table2]]
    .filter(([k]) => gerencial(user) || !["dre", "painel"].includes(k));   // v170 — DRE e painel são gerenciais
  return (
    <div>
      <div className="flex gap-1 mb-5" style={{ borderBottom: `1px solid ${C.line}` }}>
        {abas.map(([k, t, Ico]) => (
          <button key={k} onClick={() => setAba(k, { contaFiltro: null })} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            style={{ color: tela.aba === k ? C.accent : C.sub, borderBottom: tela.aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            <Ico size={15} /> {t}
          </button>
        ))}
      </div>
      {tela.aba === "dre" && gerencial(user) && <DreGerencial user={user} comp={comp} setComp={setComp} abrirConta={(contaId) => setAba("identificacao", { contaFiltro: contaId })} />}
      {tela.aba === "painel" && gerencial(user) && <PainelPrevisao user={user} comp={comp} setComp={setComp} />}
      {tela.aba === "importacao" && <Importacao user={user} comp={comp} setComp={setComp} />}
      {tela.aba === "identificacao" && <Identificacao key={`${comp}-${tela.contaFiltro || ""}`} user={user} comp={comp} setComp={setComp} contaInicial={tela.contaFiltro} />}
      {tela.aba === "contabilidade" && <Contabilidade user={user} comp={comp} setComp={setComp} irRecebimentos={() => setAba("recebimentos")} />}
      {tela.aba === "recebimentos" && <Recebimentos user={user} comp={comp} setComp={setComp} />}
    </div>
  );
}

const CORES_PIZZA = ["#001E41", "#FF6B1A", "#2E7CD6", "#12A150", "#C08401", "#7A5AF8", "#D92D20", "#0E9384", "#DD2590", "#4E5BA6", "#B54708", "#667085"];

function Pizza({ fatias, sel, onSel, tamanho = 260 }) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  const R = tamanho / 2, r0 = R * 0.55;
  let ang = -Math.PI / 2;
  const pt = (a, r) => [R + r * Math.cos(a), R + r * Math.sin(a)];
  const [hover, setHover] = useState(null);
  if (!total) return <div className="flex items-center justify-center text-sm" style={{ width: tamanho, height: tamanho, color: C.sub }}>Sem valores</div>;
  const f0 = fatias.find((f) => f.key === (hover ?? sel));
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} style={{ overflow: "visible" }}>
      {fatias.map((f) => {
        const frac = f.valor / total;
        const a0 = ang, a1 = ang + frac * Math.PI * 2; ang = a1;
        const meio = (a0 + a1) / 2, ativo = f.key === sel || f.key === hover;
        const dx = ativo ? Math.cos(meio) * 8 : 0, dy = ativo ? Math.sin(meio) * 8 : 0;
        const grande = a1 - a0 > Math.PI ? 1 : 0;
        const [x0, y0] = pt(a0, R - 2), [x1, y1] = pt(a1, R - 2), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0);
        const d = frac >= 0.9999
          ? `M ${R} 2 A ${R - 2} ${R - 2} 0 1 1 ${R - 0.01} 2 Z M ${R} ${R - r0} A ${r0} ${r0} 0 1 0 ${R + 0.01} ${R - r0} Z`
          : `M ${x0} ${y0} A ${R - 2} ${R - 2} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${grande} 0 ${x3} ${y3} Z`;
        return (
          <path key={f.key} d={d} fill={f.cor} transform={`translate(${dx} ${dy})`} stroke="#fff" strokeWidth={1.5} fillRule="evenodd"
            style={{ cursor: "pointer", opacity: sel && !ativo ? 0.45 : 1, transition: "transform .15s, opacity .15s" }}
            onMouseEnter={() => setHover(f.key)} onMouseLeave={() => setHover(null)} onClick={() => onSel(f.key === sel ? null : f.key)} />
        );
      })}
      <text x={R} y={R - 8} textAnchor="middle" style={{ fontSize: 11, fill: C.sub, fontWeight: 600 }}>{f0 ? f0.rotulo.slice(0, 26) : "Total"}</text>
      <text x={R} y={R + 12} textAnchor="middle" style={{ fontSize: 15, fill: C.text, fontWeight: 700 }}>{moeda(f0 ? f0.valor : total)}</text>
      <text x={R} y={R + 28} textAnchor="middle" style={{ fontSize: 11, fill: C.sub }}>{f0 ? `${((f0.valor / total) * 100).toFixed(1)}%` : `${fatias.length} contas`}</text>
    </svg>
  );
}

function DreMes({ user, comp, setComp, abrirConta, semSeletor }) {
  const [dados, setDados] = useState(null);
  const [lado, setLado] = useState("D"); // D despesas · C receitas
  const [sel, setSel] = useState(null);
  useEffect(() => {
    setDados(null); setSel(null);
    fetch(`/api/fin/lancamentos?u=${user.id}&competencia=${comp}`).then((r) => r.json()).then(setDados);
  }, [comp]);
  const contas = useMemo(() => Object.fromEntries((dados?.contas || []).map((c) => [c.id, c])), [dados]);
  const ls = useMemo(() => (dados?.lancamentos || []).filter((l) => !l.desmembrado && !l.substituido), [dados]);
  const conc = (dados?.contas || []).find((c) => c.codigo === "3000000");
  const semConc = ls.filter((l) => !(conc && l.contaId === conc.id));
  const ent = semConc.filter((l) => l.valor > 0).reduce((a, l) => a + l.valor, 0);
  const sai = semConc.filter((l) => l.valor < 0).reduce((a, l) => a + l.valor, 0);
  const pend = ls.filter((l) => !l.contaId);
  const concSaldo = conc ? ls.filter((l) => l.contaId === conc.id).reduce((a, l) => a + l.valor, 0) : 0;

  const fatias = useMemo(() => {
    const m = {};
    for (const l of semConc) {
      if (lado === "D" ? l.valor >= 0 : l.valor <= 0) continue;
      const k = l.contaId || "sem";
      m[k] = (m[k] || 0) + Math.abs(l.valor);
    }
    const arr = Object.entries(m).map(([k, v]) => ({ key: k, valor: v, rotulo: k === "sem" ? "A IDENTIFICAR" : contas[k]?.nome || "?", codigo: k === "sem" ? "" : contas[k]?.codigo }))
      .sort((a, b) => b.valor - a.valor);
    return arr.map((f, i) => ({ ...f, cor: f.key === "sem" ? "#F79009" : CORES_PIZZA[i % CORES_PIZZA.length] }));
  }, [semConc, lado, contas]);
  const totalLado = fatias.reduce((a, f) => a + f.valor, 0);
  const itensSel = sel ? semConc.filter((l) => String(l.contaId || "sem") === String(sel) && (lado === "D" ? l.valor < 0 : l.valor > 0)).sort((a, b) => a.valor - b.valor) : [];
  const fSel = fatias.find((f) => f.key === sel);

  return (
    <div>
      {!semSeletor && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SeletorMes comp={comp} setComp={setComp} />
        </div>
      )}
      {!dados && <div style={{ color: C.sub }}>Carregando…</div>}
      {dados && (
        <>
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Kpi rotulo="Entradas" valor={moeda(ent)} cor={C.blue} Ico={TrendingUp} />
            <Kpi rotulo="Saídas" valor={moeda(sai)} cor={C.red} Ico={TrendingDown} />
            <Kpi rotulo="Resultado" valor={moeda(ent + sai)} cor={ent + sai >= 0 ? C.green : C.red} sub={ent ? `margem ${(((ent + sai) / ent) * 100).toFixed(1)}%` : ""} />
            <Kpi rotulo="A identificar" valor={`${pend.length}`} cor={pend.length ? C.accent : C.green} sub={pend.length ? moeda(pend.reduce((a, l) => a + l.valor, 0)) : "tudo identificado"} />
            <Kpi rotulo="Conciliação" valor={moeda(concSaldo)} cor={Math.abs(concSaldo) < 0.005 ? C.green : C.red} sub={Math.abs(concSaldo) < 0.005 ? "fecha em zero ✓" : "deveria fechar em zero"} />
          </div>

          <div className="rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="text-sm font-bold" style={{ color: C.navy }}>Concentração por conta-caixa</div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                {[["D", "Despesas"], ["C", "Receitas"]].map(([k, t]) => (
                  <button key={k} onClick={() => { setLado(k); setSel(null); }} className="px-3 py-1.5 text-sm" style={{ background: lado === k ? C.navy : C.panel, color: lado === k ? "#fff" : C.sub }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-8 items-start">
              <Pizza fatias={fatias} sel={sel} onSel={setSel} />
              <div className="flex-1" style={{ minWidth: 280 }}>
                {fatias.map((f) => (
                  <button key={f.key} onClick={() => setSel(f.key === sel ? null : f.key)} className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left"
                    style={{ background: f.key === sel ? C.accentSoft : "transparent" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: f.cor }} className="shrink-0" />
                    <span className="font-mono" style={{ color: C.sub, width: 56 }}>{f.codigo}</span>
                    <span className="flex-1 font-semibold truncate">{f.rotulo}</span>
                    <span style={{ color: C.sub, width: 48, textAlign: "right" }}>{((f.valor / totalLado) * 100).toFixed(1)}%</span>
                    <span className="font-semibold" style={{ width: 110, textAlign: "right" }}>{moeda(f.valor)}</span>
                  </button>
                ))}
                {!fatias.length && <div className="text-sm" style={{ color: C.sub }}>Sem lançamentos.</div>}
              </div>
            </div>
          </div>

          {fSel && (
            <div className="rounded-xl mt-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: fSel.cor }} />
                <div className="flex-1 font-bold text-sm">{fSel.codigo} {fSel.rotulo} · {itensSel.length} lançamento(s) · {moeda(fSel.valor)}</div>
                <button onClick={() => abrirConta(sel === "sem" ? "_sem" : sel)} className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}>
                  <Tag size={12} /> Abrir na identificação
                </button>
                <button onClick={() => setSel(null)} style={{ color: C.sub }}><X size={16} /></button>
              </div>
              <div className="overflow-auto" style={{ maxHeight: 420 }}>
                <table className="w-full text-xs">
                  <tbody>
                    {itensSel.map((l) => (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${C.panel2}` }}>
                        <td className="px-4 py-1.5" style={{ color: C.sub, width: 130 }}>{l.banco}</td>
                        <td className="px-2 py-1.5" style={{ color: C.sub, width: 80 }}>{dBR(l.data)}</td>
                        <td className="px-2 py-1.5">{l.historico}{l.identificacao && <div className="text-[10px]" style={{ color: C.sub }}>{l.identificacao}</div>}</td>
                        <td className="px-4 py-1.5 text-right font-semibold" style={{ color: corValor(l.valor), width: 110 }}>{brl(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- IMPORTAÇÃO MENSAL ---------------- */
function SeletorMes({ comp, setComp }) {
  return (
    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
      <button onClick={() => setComp(somaMes(comp, -1))} className="px-3 py-2 font-bold" style={{ color: C.sub }}>‹</button>
      <div className="px-3 py-2 font-semibold" style={{ minWidth: 150, textAlign: "center" }}>{nomeComp(comp)}</div>
      <button onClick={() => setComp(somaMes(comp, 1))} className="px-3 py-2 font-bold" style={{ color: C.sub }}>›</button>
    </div>
  );
}

/* ---------------- DRE GERENCIAL ---------------- */
const lerNumBR = (t) => {
  const s = String(t || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
function ValorIn({ value, onChange, width = 132, placeholder = "—", negativo = false }) {
  const [foco, setFoco] = useState(false);
  const [txt, setTxt] = useState("");
  const vazio = value === null || value === undefined || value === "";
  return (
    <div className="relative inline-flex items-center" style={{ width }}>
      <span className="absolute left-2 text-[10px]" style={{ color: C.sub }}>R$</span>
      <input value={foco ? txt : (vazio ? "" : brl(value))} placeholder={placeholder}
        onFocus={(e) => { setFoco(true); setTxt(vazio ? "" : brl(value)); setTimeout(() => e.target.select(), 0); }}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { setFoco(false); onChange(txt.trim() === "" ? null : lerNumBR(txt)); }}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        className="w-full text-right rounded px-2 py-1.5 text-sm outline-none"
        style={{ border: `1px solid ${C.line}`, paddingLeft: 24, color: negativo && Number(value) < 0 ? C.red : C.text, background: "#fff" }} />
    </div>
  );
}

function LinhaDre({ rotulo, valor, pct, grupo, detalhe, aberto, onToggle, abrirConta, forte, tom }) {
  const cor = forte ? (valor >= 0 ? C.green : C.red) : (grupo === "RECEITA" ? C.blue : C.text);
  const clicavel = !!detalhe?.length;
  return (
    <>
      <div onClick={clicavel ? onToggle : undefined}
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          borderTop: `1px solid ${C.line}`, cursor: clicavel ? "pointer" : "default",
          background: tom === "resultado" ? C.panel2 : tom === "final" ? C.navy : C.panel,
          color: tom === "final" ? "#fff" : C.text,
        }}>
        <span style={{ width: 16, color: tom === "final" ? "rgba(255,255,255,.6)" : C.sub }}>
          {clicavel ? (aberto ? <ChevronDown size={14} /> : <ChevR size={14} />) : null}
        </span>
        <span className={forte ? "font-bold text-sm flex-1" : "text-sm flex-1"}>{rotulo}</span>
        {detalhe && <span className="text-[11px]" style={{ color: tom === "final" ? "rgba(255,255,255,.6)" : C.sub }}>{detalhe.length} conta(s)</span>}
        <span style={{ width: 64, textAlign: "right", fontSize: 11, color: tom === "final" ? "rgba(255,255,255,.7)" : C.sub }}>
          {pct == null ? "" : `${(pct * 100).toFixed(1)}%`}
        </span>
        <span className="font-bold" style={{ width: 140, textAlign: "right", color: tom === "final" ? "#fff" : cor, fontSize: forte ? 15 : 14 }}>
          {brl(valor)}
        </span>
      </div>
      {aberto && clicavel && (
        <div style={{ background: "#FAFBFC", borderTop: `1px solid ${C.line}` }}>
          {detalhe.map((d) => (
            <button key={d.contaId} onClick={() => abrirConta(d.contaId)}
              className="w-full flex items-center gap-3 px-4 py-1.5 text-xs text-left hover:underline">
              <span style={{ width: 16 }} />
              <span className="flex-1 truncate" style={{ color: C.text }}>{d.nome}</span>
              <span style={{ width: 64, textAlign: "right", color: C.sub }}>
                {valor ? `${((d.valor / valor) * 100).toFixed(1)}%` : ""}
              </span>
              <span className="font-semibold" style={{ width: 140, textAlign: "right", color: corValor(d.valor) }}>{brl(d.valor)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function DreGerencial({ user, comp, setComp, abrirConta }) {
  const [vista, setVista] = useState("dre"); // dre | concentracao | depara
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = () => {
    setD(null); setErro("");
    fetch(`/api/fin/dre?u=${user.id}&competencia=${comp}&mapa=1`)
      .then((r) => r.json().then((j) => (r.ok ? setD(j) : setErro(j.error || "Erro"))))
      .catch(() => setErro("Falha de conexão."));
  };
  useEffect(() => { carregar(); setAberto(null); }, [comp]);

  const salvarSaldo = async (v) => {
    setSalvando(true);
    try {
      const r = await fetch("/api/fin/dre", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, competencia: comp, saldoInicial: v }),
      });
      const j = await r.json();
      if (r.ok) setD(j); else setErro(j.error || "Erro ao salvar.");
    } catch { setErro("Falha de conexão."); }
    setSalvando(false);
  };

  const mudarGrupo = async (contaId, grupo) => {
    setSalvando(true);
    try {
      const r = await fetch("/api/fin/dre", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, competencia: comp, mapa: [{ contaId, grupo }] }),
      });
      const j = await r.json();
      if (r.ok) setD(j); else setErro(j.error || "Erro ao salvar.");
    } catch { setErro("Falha de conexão."); }
    setSalvando(false);
  };

  const o = d?.operacao;
  const tg = (k) => (aberto === k ? null : k);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SeletorMes comp={comp} setComp={setComp} />
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["dre", "DRE gerencial"], ["concentracao", "Concentração"], ["depara", "De–para das contas"]].map(([k, t]) => (
            <button key={k} onClick={() => setVista(k)} className="px-3 py-1.5 text-sm"
              style={{ background: vista === k ? C.navy : C.panel, color: vista === k ? "#fff" : C.sub }}>{t}</button>
          ))}
        </div>
        {salvando && <Loader2 size={15} className="animate-spin" style={{ color: C.accent }} />}
      </div>

      {erro && <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {d && vista === "concentracao" && <DreMes user={user} comp={comp} setComp={setComp} abrirConta={abrirConta} semSeletor />}

      {d && vista === "depara" && (
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="text-sm flex-1" style={{ color: C.sub, minWidth: 280 }}>
              O de–para já vem igual ao do sistema antigo, conta por conta. Mude aqui o que quiser — vale para todos os meses.
            </div>
            {(() => {
              const conf = (d.contas || []).filter((c) => c.conferir);
              return conf.length ? (
                <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: C.yellowSoft, color: C.yellow }}>
                  <AlertTriangle size={13} /> {conf.length} conta(s) fora do de–para oficial — confira o grupo
                </span>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: C.greenSoft, color: C.green }}>
                  <CheckCircle2 size={13} /> Todas as contas estão no de–para oficial
                </span>
              );
            })()}
          </div>
          <div className="overflow-auto" style={{ maxHeight: 620 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: C.panel2 }}>
                <tr style={{ color: C.sub }}>
                  <th className="text-left px-4 py-2 font-semibold" style={{ width: 110 }}>Código</th>
                  <th className="text-left px-2 py-2 font-semibold">Conta-caixa</th>
                  <th className="text-left px-2 py-2 font-semibold" style={{ width: 280 }}>Grupo da DRE</th>
                </tr>
              </thead>
              <tbody>
                {(d.contas || []).map((c) => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${C.line}`, opacity: c.ativo ? 1 : 0.55, background: c.conferir ? C.yellowSoft : "transparent" }}>
                    <td className="px-4 py-1.5 font-mono text-xs" style={{ color: C.sub }}>{c.codigo}</td>
                    <td className="px-2 py-1.5">
                      {c.nome}
                      {!c.ativo && <span className="text-[10px] ml-2" style={{ color: C.sub }}>inativa</span>}
                      {c.conferir && <span className="text-[10px] ml-2 font-semibold" style={{ color: C.yellow }}>conta nova · confira o grupo</span>}
                      {c.manual && <span className="text-[10px] ml-2" style={{ color: C.accent }}>ajustada à mão</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={c.grupo} onChange={(e) => mudarGrupo(c.id, e.target.value)}
                        className="w-full rounded px-2 py-1 text-sm outline-none"
                        style={{ border: `1px solid ${c.manual ? C.accent : C.line}`, background: "#fff", color: C.text }}>
                        {(d.grupos?.todos || []).map((g) => <option key={g.k} value={g.k}>{g.n}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d && vista === "dre" && o && (
        <>
          {!!d.semConta && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}>
              <AlertTriangle size={15} />
              Ainda há {brl(d.semConta)} em lançamentos sem conta-caixa — eles ficam fora da DRE até serem identificados.
            </div>
          )}
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <Kpi rotulo="Receita" valor={moeda(o.receita)} cor={C.blue} Ico={TrendingUp} sub={`${d.lancamentos} lançamentos no mês`} />
            <Kpi rotulo="Margem de contribuição" valor={moeda(o.margem)} cor={o.margem >= 0 ? C.green : C.red}
              sub={o.margemPct == null ? "" : `${(o.margemPct * 100).toFixed(1)}% da receita`} />
            <Kpi rotulo="EBITDA" valor={moeda(o.ebitda)} cor={o.ebitda >= 0 ? C.green : C.red}
              sub={o.ebitdaPct == null ? "" : `${(o.ebitdaPct * 100).toFixed(1)}% da receita`} />
            <Kpi rotulo="Lucro líquido" valor={moeda(o.lucro)} cor={o.lucro >= 0 ? C.green : C.red}
              sub={o.lucroPct == null ? "" : `${(o.lucroPct * 100).toFixed(1)}% da receita`} />
            <Kpi rotulo="Saldo final do mês" valor={moeda(d.saldoFinal)} cor={d.saldoFinal >= 0 ? C.green : C.red}
              sub="depois dos recursos externos" />
          </div>

          <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
              <div className="text-sm font-bold" style={{ color: C.navy }}>Resultado da operação · {nomeComp(comp)}</div>
              <div className="flex items-center gap-2 text-xs" style={{ color: C.sub }}>
                Saldo inicial do mês
                <ValorIn value={d.saldoInicial} onChange={salvarSaldo} negativo />
              </div>
            </div>
            {(d.grupos?.operacao || []).map((g, i) => {
              const vals = { RECEITA: o.receita, CMV: o.cmv, DESPESA_ADM: o.adm, IMPOSTOS_JUROS: o.impostos, INVESTIMENTO: o.investimento, NORT: o.nort || 0 };
              const linhas = [
                <LinhaDre key={g.k} rotulo={g.n} valor={vals[g.k]} pct={o.receita ? vals[g.k] / o.receita : null} grupo={g.k}
                  detalhe={d.detalhes?.[g.k]} aberto={aberto === g.k} onToggle={() => setAberto(tg(g.k))} abrirConta={abrirConta} />,
              ];
              if (g.k === "CMV") linhas.push(
                <LinhaDre key="m" rotulo="03. Margem de contribuição" valor={o.margem} pct={o.receita ? o.margem / o.receita : null} forte tom="resultado" />);
              if (g.k === "DESPESA_ADM") linhas.push(
                <LinhaDre key="e" rotulo="05. EBITDA" valor={o.ebitda} pct={o.receita ? o.ebitda / o.receita : null} forte tom="resultado" />);
              if (g.k === "IMPOSTOS_JUROS") linhas.push(
                <LinhaDre key="l" rotulo="07. Lucro líquido" valor={o.lucro} pct={o.receita ? o.lucro / o.receita : null} forte tom="resultado" />);
              if (g.k === "NORT") linhas.push(
                <LinhaDre key="r" rotulo="09. Resultado da operação" valor={o.resultado} pct={o.receita ? o.resultado / o.receita : null} forte tom="resultado" />,
                <LinhaDre key="si" rotulo="10. Saldo inicial do mês" valor={d.saldoInicial} pct={null} />,
                <LinhaDre key="so" rotulo="11. Saldo da operação" valor={o.saldoOperacao} pct={null} forte tom="resultado" />);
              return linhas;
            })}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="px-4 py-3">
              <div className="text-sm font-bold" style={{ color: C.navy }}>Recursos externos</div>
              <div className="text-xs mt-0.5" style={{ color: C.sub }}>
                Empréstimo, factoring, capital social e mútuo não são resultado: entram no caixa e saem depois. Ficam fora da DRE e só afetam o saldo final.
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-semibold uppercase" style={{ background: C.panel2, color: C.sub }}>
              <span className="flex-1">Fonte</span>
              <span style={{ width: 140, textAlign: "right" }}>Entrada</span>
              <span style={{ width: 140, textAlign: "right" }}>Pagamento</span>
              <span style={{ width: 140, textAlign: "right" }}>Líquido</span>
            </div>
            {(d.externos || []).map((e) => (
              <div key={e.k} className="flex items-center gap-3 px-4 py-2 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                <span className="flex-1">{e.n}</span>
                <span style={{ width: 140, textAlign: "right", color: e.entrada ? C.blue : C.sub }}>{brl(e.entrada)}</span>
                <span style={{ width: 140, textAlign: "right", color: e.pagamento ? C.red : C.sub }}>{brl(e.pagamento)}</span>
                <span className="font-semibold" style={{ width: 140, textAlign: "right", color: corValor(e.entrada - e.pagamento) }}>{brl(e.entrada - e.pagamento)}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
              <span className="flex-1">Resultado dos recursos externos</span>
              <span style={{ width: 140, textAlign: "right" }}>{brl(d.entradaExterna)}</span>
              <span style={{ width: 140, textAlign: "right" }}>{brl(d.pagamentoExterno)}</span>
              <span style={{ width: 140, textAlign: "right", color: corValor(d.resultadoExterno) }}>{brl(d.resultadoExterno)}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: C.navy, color: "#fff" }}>
              <span className="flex-1 font-bold text-sm">Saldo final do mês</span>
              <span className="font-bold" style={{ fontSize: 16 }}>{moeda(d.saldoFinal)}</span>
            </div>
          </div>

          {!!d.fora && (
            <div className="text-xs mt-3" style={{ color: C.sub }}>
              Fora da DRE (transferências e conciliação): {brl(d.fora)} — por definição fecha em zero quando tudo está conciliado.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- PAINEL DE PREVISÃO ---------------- */
const CAMPOS_PAINEL_UI = [
  { bloco: "Contas atrasadas", ajuda: "O total vem do contas a pagar; aqui você abre por natureza.", campos: [
    ["atrasadoImpostos", "Impostos"], ["atrasadoMateriaPrima", "Matéria-prima"],
    ["atrasadoPrestadores", "Prestadores"], ["atrasadoOutros", "Outros"], ["prioridadeMes", "Prioridade do mês"]] },
  { bloco: "Contas a receber", ajuda: "Posição geral, mês vigente e atrasadas vêm do contas a receber.", campos: [
    ["receberPrevisao", "Previsão (ainda sem título)"], ["receberLitigio", "Em litígio"],
    ["receberQuitacaoProvavel", "Quitação provável"], ["receberForaMes", "Fora do mês"], ["atrasoProvavel", "Atraso provável"]] },
  { bloco: "Carteira e caixa", campos: [
    ["pedidosEntregar", "Pedidos a entregar"], ["pedidosAndamento", "Pedidos em andamento"],
    ["recebimentoMes", "Recebimento no mês"], ["antecipacaoDisp", "Antecipação disponível"]] },
  { bloco: "Cenários", ajuda: "O sistema sugere; o valor que você digitar manda.", campos: [
    ["cenarioGeral", "Cenário geral"], ["cenarioMes", "Cenário do mês"],
    ["cobrindoCheque", "Cobrindo o cheque"], ["semCobrir", "Sem cobrir"],
    ["antecipandoCobrindo", "Antecipando e cobrindo"], ["antecipandoSemCobrir", "Antecipando sem cobrir"]] },
];

function Auto({ rotulo, valor, cor, sub }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.sub }}>
        <Link2 size={11} /> {rotulo}
      </div>
      <div className="font-bold text-base mt-0.5" style={{ color: cor || C.text }}>{moeda(valor)}</div>
      {sub && <div className="text-[10px]" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}

function PainelPrevisao({ user, comp, setComp }) {
  const [p, setP] = useState(null);
  const [erro, setErro] = useState("");
  const [rasc, setRasc] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState("");

  useEffect(() => {
    setP(null); setErro(""); setRasc({}); setOk("");
    fetch(`/api/fin/painel?u=${user.id}&competencia=${comp}`)
      .then((r) => r.json().then((j) => (r.ok ? setP(j) : setErro(j.error || "Erro"))))
      .catch(() => setErro("Falha de conexão."));
  }, [comp]);

  const val = (k) => (k in rasc ? rasc[k] : p?.manual?.[k] ?? null);
  const set = (k) => (v) => { setRasc((r) => ({ ...r, [k]: v })); setOk(""); };
  const sujo = Object.keys(rasc).length > 0;

  const bancos = useMemo(() => (rasc.bancos !== undefined ? rasc.bancos : p?.bancos || []), [rasc.bancos, p]);
  const setBanco = (i, k, v) => setRasc((r) => {
    const l = (r.bancos !== undefined ? r.bancos : p?.bancos || []).map((b, j) => (j === i ? { ...b, [k]: v } : b));
    return { ...r, bancos: l };
  });
  const addBanco = () => setRasc((r) => ({ ...r, bancos: [...(r.bancos !== undefined ? r.bancos : p?.bancos || []), { nome: "", saldo: 0, limite: 0, tomado: 0 }] }));
  const delBanco = (i) => setRasc((r) => ({ ...r, bancos: (r.bancos !== undefined ? r.bancos : p?.bancos || []).filter((_, j) => j !== i) }));

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const r = await fetch("/api/fin/painel", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, competencia: comp, dados: rasc }),
      });
      const j = await r.json();
      if (r.ok) { setP(j); setRasc({}); setOk("Painel salvo."); }
      else setErro(j.error || "Erro ao salvar.");
    } catch { setErro("Falha de conexão."); }
    setSalvando(false);
  };

  // os bancos digitados recalculam o caixa na tela antes de salvar
  const caixa = useMemo(() => {
    const l = bancos.map((b) => {
      const saldo = Number(b.saldo) || 0, limite = Number(b.limite) || 0;
      const tomado = b.tomado == null || b.tomado === "" ? Math.max(0, -saldo) : Number(b.tomado) || 0;
      return { saldo, limite, tomado, disponivel: Math.max(0, saldo) + Math.max(0, limite - tomado) };
    });
    const s = (f) => l.reduce((a, b) => a + b[f], 0);
    return { saldoGeral: s("saldo"), limiteTotal: s("limite"), limiteTomado: s("tomado"), disponivelTotal: s("disponivel") };
  }, [bancos]);

  const a = p?.auto;
  const somaAtraso = ["atrasadoImpostos", "atrasadoMateriaPrima", "atrasadoPrestadores", "atrasadoOutros"]
    .reduce((s, k) => s + (Number(val(k)) || 0), 0);
  const sugestao = p ? {
    cenarioGeral: a.receberPosicaoGeral - a.contasPagarTotal + caixa.saldoGeral,
    cenarioMes: a.receberMesVigente + caixa.disponivelTotal - a.contasPagarMes,
    ...(a.receberEmExecucao ? { receberLitigio: a.receberEmExecucao } : {}),   // em litígio = contas em execução judicial
  } : {};

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SeletorMes comp={comp} setComp={setComp} />
        <div className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: C.blueSoft, color: C.blue }}>
          <Link2 size={13} /> Os campos com corrente vêm das guias de contas. Os demais você preenche e o sistema guarda.
        </div>
        <div className="flex-1" />
        {ok && <span className="text-xs font-semibold" style={{ color: C.green }}>{ok}</span>}
        <button disabled={!sujo || salvando} onClick={salvar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: C.accent, opacity: !sujo || salvando ? 0.45 : 1 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar painel
        </button>
      </div>

      {erro && <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!p && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {p && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
          {/* --- o que vem das contas --- */}
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-sm font-bold mb-3" style={{ color: C.navy }}>Posição automática</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <Auto rotulo="Contas atrasadas" valor={a.contasAtrasadas} cor={a.contasAtrasadas ? C.red : C.green} />
              <Auto rotulo="A pagar no mês" valor={a.contasPagarMes} cor={C.text} />
              <Auto rotulo="A pagar (total aberto)" valor={a.contasPagarTotal} cor={C.sub} />
              <Auto rotulo="A receber · posição geral" valor={a.receberPosicaoGeral} cor={C.blue} />
              <Auto rotulo="A receber no mês" valor={a.receberMesVigente} cor={C.blue} />
              <Auto rotulo="A receber atrasado · em cobrança" valor={a.receberAtrasadas} cor={a.receberAtrasadas ? C.yellow : C.green} />
              <Auto rotulo={`Em execução judicial${a.receberEmExecucaoQtd ? ` (${a.receberEmExecucaoQtd})` : ""}`} valor={a.receberEmExecucao || 0} cor={a.receberEmExecucao ? C.red : C.sub} />
              <Auto rotulo="Perdas reconhecidas no mês" valor={a.perdasMes || 0} cor={a.perdasMes ? C.red : C.sub} />
            </div>
            {somaAtraso > 0 && Math.abs(somaAtraso - a.contasAtrasadas) > 1 && (
              <div className="mt-3 text-xs rounded-lg px-3 py-2 flex items-start gap-1.5" style={{ background: C.yellowSoft, color: C.yellow }}>
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                A abertura dos atrasados soma {brl(somaAtraso)}, mas o contas a pagar aponta {brl(a.contasAtrasadas)} —
                diferença de {brl(somaAtraso - a.contasAtrasadas)}.
              </div>
            )}
            <div className="mt-4 rounded-lg p-3" style={{ background: C.navy, color: "#fff" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>Projeção do mês</div>
              <div className="font-bold text-xl mt-0.5">
                {moeda(caixa.disponivelTotal + (Number(val("recebimentoMes")) || a.receberMesVigente) - a.contasPagarMes)}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,.7)" }}>
                disponível {brl(caixa.disponivelTotal)} + entra {brl(Number(val("recebimentoMes")) || a.receberMesVigente)} − sai {brl(a.contasPagarMes)}
              </div>
            </div>
          </div>

          {/* --- bancos --- */}
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold" style={{ color: C.navy }}>Bancos</div>
              <button onClick={addBanco} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
                <Plus size={13} /> Banco
              </button>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase mb-1" style={{ color: C.sub }}>
              <span className="flex-1">Banco</span>
              <span style={{ width: 110, textAlign: "right" }}>Saldo</span>
              <span style={{ width: 110, textAlign: "right" }}>Limite</span>
              <span style={{ width: 110, textAlign: "right" }}>Tomado</span>
              <span style={{ width: 100, textAlign: "right" }}>Disponível</span>
              <span style={{ width: 20 }} />
            </div>
            {bancos.map((b, i) => {
              const saldo = Number(b.saldo) || 0, limite = Number(b.limite) || 0;
              const tomado = b.tomado == null || b.tomado === "" ? Math.max(0, -saldo) : Number(b.tomado) || 0;
              const disp = Math.max(0, saldo) + Math.max(0, limite - tomado);
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <input value={b.nome || ""} onChange={(e) => setBanco(i, "nome", e.target.value.toUpperCase())} placeholder="BANCO"
                    className="flex-1 rounded px-2 py-1.5 text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: "#fff" }} />
                  <ValorIn value={b.saldo} onChange={(v) => setBanco(i, "saldo", v ?? 0)} width={110} negativo />
                  <ValorIn value={b.limite} onChange={(v) => setBanco(i, "limite", v ?? 0)} width={110} />
                  <ValorIn value={tomado} onChange={(v) => setBanco(i, "tomado", v ?? 0)} width={110} />
                  <span className="text-sm font-semibold" style={{ width: 100, textAlign: "right", color: disp > 0 ? C.green : C.sub }}>{brl(disp)}</span>
                  <button onClick={() => delBanco(i)} style={{ color: C.sub, width: 20 }}><Trash2 size={13} /></button>
                </div>
              );
            })}
            {!bancos.length && <div className="text-sm py-3" style={{ color: C.sub }}>Nenhum banco lançado.</div>}
            <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <Kpi rotulo="Saldo geral" valor={moeda(caixa.saldoGeral)} cor={caixa.saldoGeral >= 0 ? C.green : C.red} />
              <Kpi rotulo="Limite total" valor={moeda(caixa.limiteTotal)} cor={C.sub} />
              <Kpi rotulo="Limite tomado" valor={moeda(caixa.limiteTomado)} cor={caixa.limiteTomado ? C.yellow : C.sub} />
              <Kpi rotulo="Valor disponível" valor={moeda(caixa.disponivelTotal)} cor={C.blue} />
            </div>
          </div>

          {/* --- blocos manuais --- */}
          {CAMPOS_PAINEL_UI.map((b) => (
            <div key={b.bloco} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-sm font-bold" style={{ color: C.navy }}>{b.bloco}</div>
              {b.ajuda && <div className="text-xs mb-3 mt-0.5" style={{ color: C.sub }}>{b.ajuda}</div>}
              <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
                {b.campos.map(([k, t]) => (
                  <label key={k} className="flex items-center gap-2 justify-between">
                    <span className="text-xs" style={{ color: C.sub }}>{t}</span>
                    <div className="text-right">
                      <ValorIn value={val(k)} onChange={set(k)} width={132} negativo />
                      {sugestao[k] != null && val(k) == null && (
                        <button onClick={() => set(k)(Math.round(sugestao[k] * 100) / 100)}
                          className="block text-[10px] mt-0.5 w-full text-right" style={{ color: C.accent }}>
                          usar {brl(sugestao[k])}
                        </button>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* --- info relevante --- */}
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>Informações relevantes</div>
            <textarea value={val("infoRelevante") || ""} onChange={(e) => set("infoRelevante")(e.target.value)} rows={7}
              placeholder="Anotações do mês: negociações em andamento, acordos, o que explica os números…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: "#fff", resize: "vertical" }} />
            {p.atualizadoPorNome && (
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>
                Última atualização: {p.atualizadoPorNome}{p.atualizadoEm ? ` · ${dataHora(p.atualizadoEm)}` : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Importacao({ user, comp, setComp }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [baixas, setBaixas] = useState(null);     // nº de baixas sugeridas pelo extrato do mês
  const [verBaixas, setVerBaixas] = useState(false);
  const [pedirSenha, setPedirSenha] = useState(null); // { tipo, file, b64, errada }
  const [aviso, setAviso] = useState("");
  const descartarSobras = async (tipo) => {
    if (!confirm(`Descartar os lançamentos dos parciais de ${tipo.banco} · ${tipo.documento} que não apareceram no mensal?`)) return;
    await fetch("/api/fin/arquivos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "descartarSobras", competencia: comp, tipoId: tipo.id }) });
    carregar();
  };

  const carregar = async () => {
    setErro("");
    try {
      const r = await fetch(`/api/fin/importacao?u=${user.id}&competencia=${comp}`);
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Erro ao carregar."); setDados(null); return; }
      setDados(d);
    } catch { setErro("Falha de conexão."); }
  };
  const procurarBaixas = async () => {
    try {
      const r = await fetch(`/api/fin/baixas?u=${user.id}&competencia=${comp}`);
      const j = await r.json();
      setBaixas(r.ok ? (j.sugestoes || []).filter((x) => !x.lancamento.vista).length : null);   // v177 — só as ainda não vistas
    } catch { setBaixas(null); }
  };
  useEffect(() => { setDados(null); setBaixas(null); setVerBaixas(false); carregar(); }, [comp]);
  useEffect(() => { if (dados) procurarBaixas(); }, [dados]);

  const cards = useMemo(() => {
    if (!dados) return [];
    return dados.tipos.map((t) => {
      const arqs = dados.arquivos.filter((a) => a.tipoId === t.id);
      const just = dados.justificativas.find((j) => j.tipoId === t.id) || null;
      const ofx = (dados.ofx || []).find((o) => o.tipoId === t.id) || null;
      const parciais = (dados.parciais || []).filter((p) => p.tipoId === t.id);
      return { tipo: t, arqs, just, ofx, parciais, ehExtrato: /_EXTRATO$/.test(t.codigo || ""), st: statusCard(arqs.length, t.qtdEsperada, just, arqs) };
    });
  }, [dados]);

  const bancos = useMemo(() => {
    const m = [];
    cards.forEach((c) => { let g = m.find((x) => x.banco === c.tipo.banco); if (!g) m.push(g = { banco: c.tipo.banco, cards: [] }); g.cards.push(c); });
    return m;
  }, [cards]);

  // clicar numa pílula rola até o(s) documento(s) daquele status (cliques seguidos passam para o próximo)
  const cursor = useRef({});
  const irPara = (ks) => {
    const alvo = cards.filter((c) => ks.includes(c.st.k));
    if (!alvo.length) return;
    const i = (cursor.current[ks.join()] || 0) % alvo.length;
    cursor.current[ks.join()] = i + 1;
    const el = document.getElementById(`doc-${alvo[i].tipo.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate([{ boxShadow: `0 0 0 0 ${C.accent}` }, { boxShadow: `0 0 0 4px ${C.accent}` }, { boxShadow: `0 0 0 0 ${C.accent}` }], { duration: 1400 });
  };

  const tot = useMemo(() => ({
    total: cards.length,
    ok: cards.filter((c) => c.st.k === "ok").length,
    just: cards.filter((c) => c.st.k === "just").length,
    pend: cards.filter((c) => c.st.k === "pend" || c.st.k === "parc").length,
    erro: cards.filter((c) => c.st.k === "erro").length,
  }), [cards]);

  // envia 1 arquivo; se pedir senha, abre o modal
  const enviar = async (tipo, file, b64, senha, salvarSenha, rotuloSenha) => {
    const r = await fetch("/api/fin/arquivos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, competencia: comp, tipoId: tipo ? tipo.id : "auto", nome: file.name, conteudo: b64, senha, salvarSenha, rotuloSenha }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 423 && d.precisaSenha) { setPedirSenha({ tipo, file, b64, errada: !!d.senhaErrada }); return "senha"; }
    if (!r.ok) { alert(`${file.name}: ${d.error || "erro ao enviar"}`); return "erro"; }
    const cs = d.consolidacao;
    setAviso([`${file.name}: ${d.leitura?.n ?? 0} lançamento(s) lido(s)`,
      cs && !cs.erro ? `${cs.aproveitados} já estavam nos parciais (mantida a identificação) · ${cs.novos} novo(s)${cs.descartadas ? ` · ${cs.descartadas} do parcial fora do mensal descartado(s)` : ""}${cs.sobras ? ` · ${cs.sobras} do parcial ainda sem par` : ""}` : "",
      d.baixas ? `${d.baixas} baixa(s) para validar` : ""].filter(Boolean).join(" · "));
    return "ok";
  };

  const onArquivos = async (tipo, files) => {
    for (const f of Array.from(files || [])) {
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { alert(`${f.name}: envie um PDF.`); continue; }
      const b64 = await readB64(f);
      const res = await enviar(tipo, f, b64);
      if (res === "senha") break; // um PDF com senha por vez
    }
    carregar();
  };

  // ---- importação em lote (ZIP e/ou vários PDFs): classifica cada arquivo sozinho ----
  const loteInp = useRef(null);
  const [lote, setLote] = useState(null); // [{ nome, b64, st, msg, tipo }]

  const abrirLote = async (files) => {
    const itens = [];
    for (const f of Array.from(files || [])) {
      if (/\.zip$/i.test(f.name)) {
        try {
          const ent = unzipSync(await readU8(f));
          Object.entries(ent).forEach(([caminho, u8]) => {
            const nome = caminho.split("/").pop();
            if (!nome || caminho.includes("__MACOSX") || nome.startsWith(".")) return;
            if (!/\.pdf$/i.test(nome)) { itens.push({ nome, st: "ignorado", msg: "Não é PDF" }); return; }
            itens.push({ nome, b64: u8ToB64(u8), st: "fila" });
          });
        } catch { itens.push({ nome: f.name, st: "erro", msg: "ZIP inválido" }); }
      } else if (/\.pdf$/i.test(f.name)) {
        itens.push({ nome: f.name, b64: await readB64(f), st: "fila" });
      } else itens.push({ nome: f.name, st: "ignorado", msg: "Não é PDF nem ZIP" });
    }
    setLote(itens);
    for (let i = 0; i < itens.length; i++) if (itens[i].st === "fila") await processarLote(i, itens[i]);
    carregar();
  };

  const processarLote = async (i, it, extra = {}) => {
    const upd = (patch) => setLote((l) => l && l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    upd({ st: "enviando", msg: "" });
    const r = await fetch("/api/fin/arquivos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, competencia: comp, tipoId: extra.tipoId || "auto", nome: it.nome, conteudo: it.b64, senha: extra.senha, salvarSenha: extra.salvarSenha, rotuloSenha: extra.rotuloSenha }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const lidos = d.leitura?.detalhe
        ? `${d.leitura.n} itens · ${d.leitura.conciliado === true ? "conferido com o extrato ✓" : d.leitura.conciliado === false ? "ainda não bate com o extrato (ver Identificação)" : "aguardando extrato"}`
        : d.leitura?.n ? `${d.leitura.n} lançamentos lidos` : "";
      const pv = d.leitura?.prova;
      if (pv && pv.ok === false) return upd({ st: "erro", tipo: d.tipo, msg: `Enviado, mas a leitura não confere: ${pv.msg}` });
      return upd({ st: "ok", tipo: d.tipo, msg: [d.protegido ? "PDF com senha aberto" : "", lidos, pv?.ok ? "prova real ✓" : ""].filter(Boolean).join(" · ") });
    }
    if (r.status === 423) return upd({ st: "senha", msg: d.senhaErrada ? "Senha incorreta" : "PDF com senha" });
    if (r.status === 409) return upd({ st: "duplicado", msg: d.error });
    if (d.naoReconhecido) return upd({ st: "manual", msg: d.error });
    return upd({ st: "erro", msg: d.error || "Erro ao enviar" });
  };

  const excluir = async (a) => {
    if (!confirm(`Excluir o arquivo ${a.nome}?\nOs lançamentos lidos dele (inclusive os já identificados) também serão excluídos.`)) return;
    await fetch(`/api/fin/arquivos/${a.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  // OFX do extrato: não gera lançamento, vai direto para o pacote da contabilidade
  const enviarOfx = async (tipo, files) => {
    for (const f of Array.from(files || [])) {
      if (!/\.ofx$/i.test(f.name)) { alert(`${f.name}: envie um arquivo .OFX.`); continue; }
      const b64 = await readB64(f);
      const r = await fetch("/api/fin/contab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, competencia: comp, categoria: "EXTRATO", tipoId: tipo.id, nome: f.name, conteudo: b64 }),
      });
      const d = await r.json().catch(() => ({}));
      const e = d.resultados?.find((x) => !x.ok);
      if (!r.ok || e) alert(`${f.name}: ${e?.erro || d.error || "erro ao enviar"}`);
    }
    carregar();
  };
  const excluirOfx = async (o) => {
    if (!confirm(`Excluir ${o.nome} do pacote da contabilidade?`)) return;
    await fetch(`/api/fin/contab/${o.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  return (
    <div>
      {/* topo: competência + resumo */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <SeletorMes comp={comp} setComp={setComp} />
        {dados && (
          <div className="flex flex-wrap gap-2">
            <Pilula cor={C.green} bg={C.greenSoft} txt={`${tot.ok} de ${tot.total} enviados`} />
            {tot.just > 0 && <Pilula cor={C.blue} bg={C.blueSoft} txt={`${tot.just} justificado${tot.just > 1 ? "s" : ""}`} onClick={() => irPara(["just"])} />}
            {tot.erro > 0 && <Pilula cor={C.red} bg={C.redSoft} txt={`${tot.erro} com erro de leitura`} onClick={() => irPara(["erro"])} />}
            {tot.pend > 0
              ? <Pilula cor={C.red} bg={C.redSoft} txt={`${tot.pend} pendente${tot.pend > 1 ? "s" : ""}`} onClick={() => irPara(["pend", "parc"])} />
              : <Pilula cor={tot.erro ? C.red : C.green} bg={tot.erro ? C.redSoft : C.greenSoft} txt={tot.erro ? "Corrigir leituras" : "Mês completo"} />}
          </div>
        )}
      </div>
      {dados && (
        <div className="h-2 rounded-full mb-6 overflow-hidden flex" style={{ background: C.panel2 }}>
          <div style={{ width: `${(tot.ok / tot.total) * 100}%`, background: C.green }} />
          <div style={{ width: `${(tot.just / tot.total) * 100}%`, background: C.blue }} />
        </div>
      )}

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && <div className="p-3 rounded-lg mb-4 text-xs flex items-start gap-2" style={{ background: C.greenSoft, color: C.green }}><CheckCircle2 size={15} className="shrink-0" /><span className="flex-1">{aviso}</span><button onClick={() => setAviso("")}><X size={14} /></button></div>}
      {!dados && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {!!baixas && (
        <button onClick={() => setVerBaixas(true)} className="w-full flex items-center gap-2 px-4 py-3 mb-5 rounded-xl text-sm text-left"
          style={{ background: C.greenSoft, border: `1px solid ${C.green}55`, color: C.text }}>
          <Link2 size={18} style={{ color: C.green }} />
          <span className="flex-1">
            <b>{baixas} pagamento(s) do extrato</b> batem com contas previstas deste mês. Confira um a um e autorize a baixa.
          </span>
          <span className="font-semibold" style={{ color: C.green }}>Validar →</span>
        </button>
      )}
      {verBaixas && <BaixasModal user={user} competencia={comp} onClose={() => { setVerBaixas(false); procurarBaixas(); }} />}

      {bancos.map((g) => (
        <div key={g.banco} className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>{g.banco}</div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {g.cards.map((c) => (
              <CardDoc key={c.tipo.id} c={c} user={user} comp={comp}
                onArquivos={(fs) => onArquivos(c.tipo, fs)} onExcluir={excluir} onMudou={carregar}
                onOfx={(fs) => enviarOfx(c.tipo, fs)} onExcluirOfx={excluirOfx} onDescartar={() => descartarSobras(c.tipo)} />
            ))}
          </div>
        </div>
      ))}

      {lote && (
        <LoteModal itens={lote} tipos={dados?.tipos || []} comp={comp}
          onReenviar={(i, extra) => processarLote(i, lote[i], extra).then(carregar)}
          onClose={() => { setLote(null); carregar(); }} />
      )}

      {pedirSenha && (
        <SenhaModal info={pedirSenha} onClose={() => { setPedirSenha(null); carregar(); }}
          onEnviar={async (senha, salvar, rotulo) => {
            const p = pedirSenha; setPedirSenha(null);
            await enviar(p.tipo, p.file, p.b64, senha, salvar, rotulo);
            carregar();
          }} />
      )}
    </div>
  );
}

// prova real da leitura de cada arquivo
function ProvaChip({ a }) {
  const p = a.prova;
  if (!p) return <span className="text-[10px] px-1.5 rounded shrink-0" style={{ background: C.panel2, color: C.sub }} title="Ainda não lido">não lido</span>;
  const [txt, cor, bg] = p.ok === true ? ["✓ conferido", C.green, C.greenSoft] : p.ok === false ? ["✗ não confere", C.red, C.redSoft] : ["sem total", C.yellow, C.yellowSoft];
  return <span className="text-[10px] px-1.5 rounded font-semibold shrink-0 cursor-help" style={{ background: bg, color: cor }} title={p.msg}>{txt}</span>;
}

function Pilula({ cor, bg, txt, onClick }) {
  if (onClick) return <button onClick={onClick} title="Clique para ir até o documento" className="px-3 py-1 rounded-full text-xs font-semibold hover:underline" style={{ color: cor, background: bg }}>{txt} ↓</button>;
  return <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ color: cor, background: bg }}>{txt}</span>;
}

function CardDoc({ c, user, comp, onArquivos, onExcluir, onMudou, onOfx, onExcluirOfx, onDescartar }) {
  const { tipo, arqs, just, st, ofx, ehExtrato, parciais } = c;
  const inp = useRef(null);
  const inpOfx = useRef(null);
  const [drag, setDrag] = useState(false);
  const [texto, setTexto] = useState(just?.texto || "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setTexto(just?.texto || ""); }, [just?.texto, comp]);

  const falta = arqs.length < tipo.qtdEsperada;
  const imp = podeImportar(user, "docsFinanceiros");   // v167 — importar/excluir: só o master
  const podeMais = imp && (tipo.multiplo || arqs.length === 0);   // v172 — o card é a entrada do documento MENSAL
  const mensalLanc = /_(EXTRATO|FATURA)$/.test(tipo.codigo || "");
  const alterado = (texto || "").trim().toUpperCase() !== (just?.texto || "");

  const salvarJust = async () => {
    setSalvando(true);
    await fetch("/api/fin/justificativas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, competencia: comp, tipoId: tipo.id, texto }),
    });
    setSalvando(false);
    onMudou();
  };

  return (
    <div id={`doc-${tipo.id}`} className="rounded-xl flex flex-col"
      style={{ scrollMarginTop: 80, background: C.panel, border: `1px solid ${drag ? C.accent : st.k === "pend" ? "#F5C2BD" : C.line}`, borderTop: `3px solid ${st.cor}` }}
      onDragOver={(e) => { if (!podeMais) return; e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (podeMais) onArquivos(e.dataTransfer.files); }}>
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold" style={{ color: C.text }}>{tipo.documento}</div>
            {tipo.descricao && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{tipo.descricao}</div>}
          </div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0" style={{ color: st.cor, background: st.bg }}>
            <st.Ico size={12} /> {st.label}
          </span>
        </div>
        {tipo.qtdEsperada > 1 && (
          <div className="text-xs mt-2" style={{ color: C.sub }}>{arqs.length} de {tipo.qtdEsperada} arquivos esperados</div>
        )}
      </div>

      {arqs.filter((a) => a.prova && a.prova.ok === false).map((a) => (
        <div key={"e" + a.id} className="mx-4 mb-2 rounded-lg p-2 text-[11px]" style={{ background: C.redSoft, color: C.red }}>
          <b>{a.nome}:</b> {a.prova.msg} <span style={{ color: C.text }}>— exclua e envie de novo; se continuar, o formato mudou e o leitor precisa de ajuste.</span>
        </div>
      ))}
      {arqs.length > 0 && (
        <div className="px-4 pb-2 flex flex-col gap-1">
          {arqs.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: C.panel2 }}>
              <FileText size={15} style={{ color: C.accent }} className="shrink-0" />
              <a href={`/api/fin/arquivos/${a.id}?u=${user.id}`} target="_blank" rel="noopener" className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: C.text }} title={a.nome}>{a.nome}</div>
                <div className="text-[11px]" style={{ color: C.sub }}>{kb(a.tamanho)} · {dataHora(a.createdAt)}{a.enviadoPorNome ? ` · ${a.enviadoPorNome}` : ""}</div>
              </a>
              <ProvaChip a={a} />
              {a.protegido && <Lock size={13} style={{ color: C.sub }} title="PDF com senha" />}
              {imp && <button onClick={() => onExcluir(a)} title="Excluir" style={{ color: C.sub }}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pb-4 mt-auto">
        {/* v172 — parciais (Transmissão): lançamentos já no mês, aguardando o mensal */}
        {parciais?.length > 0 && (
          <div className="mb-2 rounded-lg px-2 py-1.5 text-[11px]" style={{ background: arqs.length ? C.yellowSoft : C.blueSoft, color: C.text }}>
            <div className="font-semibold" style={{ color: arqs.length ? C.yellow : C.blue }}>
              {arqs.length ? `${parciais.reduce((a, p) => a + p.n, 0)} lançamento(s) de parciais não apareceram no mensal` : `${parciais.length} parcial(is) · aguardando o ${tipo.documento.toLowerCase()} mensal`}
            </div>
            {parciais.map((p) => <div key={p.id} style={{ color: C.sub }}>{p.de.split("-").reverse().slice(0, 2).join("/")} a {p.ate.split("-").reverse().slice(0, 2).join("/")} · {p.n} lanç. · {p.identificados} identificado(s)</div>)}
            {arqs.length > 0 && imp && <button onClick={onDescartar} className="mt-1 font-semibold underline" style={{ color: C.red }}>Descartar (o mensal manda)</button>}
          </div>
        )}
        {podeMais && (
          <>
            <input ref={inp} type="file" accept="application/pdf,.pdf" multiple={tipo.multiplo} className="hidden"
              onChange={(e) => { onArquivos(e.target.files); e.target.value = ""; }} />
            <button onClick={() => inp.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
              style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: drag ? C.accentSoft : "transparent" }}>
              <Upload size={15} /> {arqs.length ? "Enviar mais" : mensalLanc ? `Enviar ${/FATURA/.test(tipo.codigo) ? "fatura" : "extrato"} mensal` : "Enviar PDF"}
            </button>
          </>
        )}

        {/* extrato: slot do OFX (vai direto para o pacote da contabilidade) */}
        {ehExtrato && (
          <div className="mt-2 rounded-lg px-2 py-1.5 flex items-center gap-2" style={{ background: ofx ? C.panel2 : "transparent", border: ofx ? "none" : `1px dashed ${C.line}` }}>
            <FileCode2 size={15} className="shrink-0" style={{ color: ofx ? C.blue : C.sub }} />
            {ofx ? (
              <>
                <a href={`/api/fin/contab/${ofx.id}?u=${user.id}`} className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: C.text }} title={ofx.nome}>{ofx.nome}</div>
                  <div className="text-[11px]" style={{ color: C.sub }}>OFX · {kb(ofx.tamanho)} · na contabilidade</div>
                </a>
                {imp && <button onClick={() => onExcluirOfx(ofx)} title="Excluir OFX" style={{ color: C.sub }}><Trash2 size={14} /></button>}
              </>
            ) : <span className="flex-1 text-xs" style={{ color: C.sub }}>OFX não enviado</span>}
          </div>
        )}

        {falta && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-1" style={{ color: just ? C.blue : C.red }}>
              Justificativa {arqs.length ? "do envio parcial" : "da falta de envio"} *
            </div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
              placeholder="EX.: CONTA SEM MOVIMENTO NO MÊS"
              className="w-full rounded-lg px-2 py-1.5 text-xs uppercase"
              style={{ border: `1px solid ${just ? C.line : "#F5C2BD"}`, background: C.panel, color: C.text, resize: "vertical" }} />
            <div className="flex items-center justify-between mt-1">
              <div className="text-[11px]" style={{ color: C.sub }}>
                {just && !alterado ? `${just.usuarioNome || ""} · ${dataHora(just.updatedAt)}` : ""}
              </div>
              {alterado && (
                <button onClick={salvarJust} disabled={salvando}
                  className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold"
                  style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
                  <Save size={12} /> {texto.trim() ? "Salvar" : "Remover"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SenhaModal({ info, onClose, onEnviar }) {
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [salvar, setSalvar] = useState(true);
  const [rotulo, setRotulo] = useState(info.tipo ? `${info.tipo.banco} · ${info.tipo.documento}` : "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="rounded-xl w-full max-w-md p-5" style={{ background: C.panel }}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold flex items-center gap-2"><KeyRound size={18} style={{ color: C.accent }} /> PDF protegido por senha</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>{info.file.name}</div>
        {info.errada && <div className="text-xs mb-2 p-2 rounded" style={{ background: C.redSoft, color: C.red }}>Senha incorreta. Tente de novo.</div>}
        <div className="flex items-center rounded-lg mb-3" style={{ border: `1px solid ${C.line}` }}>
          <input autoFocus type={ver ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && senha) onEnviar(senha, salvar, rotulo); }}
            placeholder="Senha do PDF" className="flex-1 px-3 py-2 text-sm rounded-lg" style={{ outline: "none" }} />
          <button onClick={() => setVer((v) => !v)} className="px-3" style={{ color: C.sub }}>{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
          <input type="checkbox" checked={salvar} onChange={(e) => setSalvar(e.target.checked)} /> Salvar senha para os próximos envios
        </label>
        {salvar && (
          <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg mb-3 uppercase"
            style={{ border: `1px solid ${C.line}` }} placeholder="Descrição (ex.: C6 · FATURA)" />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2, color: C.text }}>Cancelar</button>
          <button disabled={!senha} onClick={() => onEnviar(senha, salvar, rotulo)} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.accent, color: "#fff", opacity: senha ? 1 : 0.5 }}>Abrir e enviar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- RESULTADO DA IMPORTAÇÃO EM LOTE ---------------- */
const ST_LOTE = {
  fila:      { txt: "Na fila",      cor: C.sub,    bg: C.panel2 },
  enviando:  { txt: "Lendo…",       cor: C.blue,   bg: C.blueSoft },
  ok:        { txt: "Classificado", cor: C.green,  bg: C.greenSoft },
  duplicado: { txt: "Já enviado",   cor: C.sub,    bg: C.panel2 },
  senha:     { txt: "Senha",        cor: C.yellow, bg: C.yellowSoft },
  manual:    { txt: "Escolher",     cor: C.yellow, bg: C.yellowSoft },
  ignorado:  { txt: "Ignorado",     cor: C.sub,    bg: C.panel2 },
  erro:      { txt: "Erro",         cor: C.red,    bg: C.redSoft },
};

function LoteModal({ itens, tipos, comp, onReenviar, onClose }) {
  const [senhas, setSenhas] = useState({});
  const [escolha, setEscolha] = useState({});
  const ok = itens.filter((x) => x.st === "ok").length;
  const processando = itens.some((x) => x.st === "fila" || x.st === "enviando");
  const pendentes = itens.filter((x) => x.st === "senha" || x.st === "manual").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="rounded-xl w-full max-w-3xl flex flex-col" style={{ background: C.panel, maxHeight: "88vh" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div className="font-semibold flex items-center gap-2"><FolderArchive size={18} style={{ color: C.accent }} /> Importação em lote · {nomeComp(comp)}</div>
            <div className="text-xs mt-0.5" style={{ color: C.sub }}>
              {processando ? "Lendo e classificando os arquivos…" : `${ok} de ${itens.length} classificados${pendentes ? ` · ${pendentes} precisam de você` : ""}`}
            </div>
          </div>
          <button onClick={onClose} disabled={processando} style={{ color: C.sub, opacity: processando ? 0.4 : 1 }}><X size={18} /></button>
        </div>
        <div className="overflow-auto px-5 py-3 flex flex-col gap-2">
          {itens.map((it, i) => {
            const st = ST_LOTE[it.st] || ST_LOTE.erro;
            return (
              <div key={i} className="rounded-lg px-3 py-2" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0" style={{ color: st.cor, background: st.bg, minWidth: 92, justifyContent: "center" }}>
                    {it.st === "enviando" && <Loader2 size={11} className="animate-spin" />}
                    {it.st === "duplicado" && <Copy size={11} />}
                    {it.st === "manual" && <HelpCircle size={11} />}
                    {it.st === "senha" && <KeyRound size={11} />}
                    {st.txt}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" title={it.nome}>{it.nome}</div>
                    <div className="text-[11px]" style={{ color: it.st === "ok" ? C.green : it.st === "erro" ? C.red : C.sub }}>
                      {(it.st === "ok" || it.st === "erro") && it.tipo ? `→ ${it.tipo.banco} · ${it.tipo.documento} · ` : ""}{it.msg || ""}
                    </div>
                  </div>
                </div>
                {it.st === "senha" && (
                  <div className="flex gap-2 mt-2 pl-[104px]">
                    <input type="password" placeholder="Senha do PDF" value={senhas[i] || ""} onChange={(e) => setSenhas((s) => ({ ...s, [i]: e.target.value }))}
                      className="flex-1 px-2 py-1 text-xs rounded" style={{ border: `1px solid ${C.line}` }} />
                    <button disabled={!senhas[i]} onClick={() => onReenviar(i, { senha: senhas[i], salvarSenha: true, rotuloSenha: "" })}
                      className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff", opacity: senhas[i] ? 1 : 0.5 }}>
                      Abrir e salvar senha
                    </button>
                  </div>
                )}
                {it.st === "manual" && (
                  <div className="flex gap-2 mt-2 pl-[104px]">
                    <select value={escolha[i] || ""} onChange={(e) => setEscolha((s) => ({ ...s, [i]: e.target.value }))}
                      className="flex-1 px-2 py-1 text-xs rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
                      <option value="">Escolha o documento…</option>
                      {tipos.map((t) => <option key={t.id} value={t.id}>{t.banco} · {t.documento}</option>)}
                    </select>
                    <button disabled={!escolha[i]} onClick={() => onReenviar(i, { tipoId: Number(escolha[i]) })}
                      className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff", opacity: escolha[i] ? 1 : 0.5 }}>
                      Enviar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 flex justify-end" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} disabled={processando} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.accent, color: "#fff", opacity: processando ? 0.5 : 1 }}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SENHAS DE PDF ---------------- */
function Senhas({ user }) {
  const [lista, setLista] = useState([]);
  const [ver, setVer] = useState({});
  const [rotulo, setRotulo] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const carregar = async () => {
    const r = await fetch(`/api/fin/senhas?u=${user.id}`);
    const d = await r.json().catch(() => []);
    setLista(Array.isArray(d) ? d : []);
  };
  useEffect(() => { carregar(); }, []);

  const add = async () => {
    setErro("");
    const r = await fetch("/api/fin/senhas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, rotulo, senha }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErro(d.error || "Erro ao salvar.");
    setRotulo(""); setSenha(""); carregar();
  };
  const del = async (s) => {
    if (!confirm(`Excluir a senha "${s.rotulo}"?`)) return;
    await fetch(`/api/fin/senhas/${s.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  return (
    <div className="max-w-2xl">
      <div className="text-sm mb-4" style={{ color: C.sub }}>
        Ao enviar um PDF protegido, o sistema testa estas senhas automaticamente. Se nenhuma servir, ele pede a senha na hora.
      </div>
      <div className="rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex-1" style={{ minWidth: 200 }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Descrição</div>
          <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="EX.: C6 · FATURA" className="w-full px-3 py-2 rounded-lg text-sm uppercase" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <div style={{ width: 200 }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Senha</div>
          <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <button onClick={add} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={15} /> Adicionar
        </button>
        {erro && <div className="w-full text-xs" style={{ color: C.red }}>{erro}</div>}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {lista.length === 0 && <div className="p-4 text-sm" style={{ color: C.sub }}>Nenhuma senha cadastrada.</div>}
        {lista.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <KeyRound size={16} style={{ color: C.accent }} />
            <div className="flex-1 font-medium text-sm">{s.rotulo}</div>
            <div className="text-sm font-mono" style={{ color: C.sub }}>{ver[s.id] ? s.senha : "••••••"}</div>
            <button onClick={() => setVer((v) => ({ ...v, [s.id]: !v[s.id] }))} style={{ color: C.sub }}>{ver[s.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            <button onClick={() => del(s)} style={{ color: C.sub }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================================================================
   IDENTIFICAÇÃO DE LANÇAMENTOS (conta-caixa)
   ====================================================================== */
const ROXO = "#7A5AF8";
const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const normC = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const sugerirTermoC = (h) => normC(h).replace(/\b\d{2} \d{2}( \d{2,4})?\b/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();
const corConta = (conta) => !conta ? C.text : conta.codigo[0] === "1" ? C.green : conta.codigo[0] === "2" ? C.red : ROXO;
const corValor = (v) => (v < 0 ? C.red : C.blue);
const api = async (url, method, body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};

function Identificacao({ user, comp, setComp, contaInicial, ano, grupoDre, nomeGrupoDre }) {
  const anual = !!ano;
  const gruposDre = useMemo(() => new Set(String(grupoDre || "").split(",").filter(Boolean)), [grupoDre]);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [agrupar, setAgrupar] = useState(anual || grupoDre ? "conta" : "banco");
  const [fBanco, setFBanco] = useState("");
  const [fConta, setFConta] = useState(contaInicial ? String(contaInicial) : "");
  const [periodo, setPeriodo] = useState(() => periodoPadrao(comp, ano));
  const [soGrupo, setSoGrupo] = useState(false);
  const [fStatus, setFStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(new Set());
  const [modal, setModal] = useState(null); // {tipo:'identificar'|'editar'|'novo'|'desmembrar', itens|lanc}
  const [aviso, setAviso] = useState("");
  const [lendo, setLendo] = useState(false);
  const [ord, setOrd] = useState({ k: "data", dir: 1 });
  const ordenarPor = (k) => setOrd((o) => (o.k === k ? { k, dir: -o.dir } : { k, dir: 1 }));

  const carregar = async () => {
    setErro("");
    try {
      const q = anual ? `ano=${ano}` : `competencia=${comp}`;
      const r = await fetch(`/api/fin/lancamentos?u=${user.id}&${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao carregar.");
      setDados(d);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { setDados(null); setSel(new Set()); setPeriodo(periodoPadrao(comp, ano)); carregar(); }, [comp, ano]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 5000); return () => clearTimeout(t); }, [aviso]);

  const contasById = useMemo(() => Object.fromEntries((dados?.contas || []).map((c) => [c.id, c])), [dados]);
  const bancos = useMemo(() => [...new Set((dados?.lancamentos || []).map((l) => l.banco))].sort(), [dados]);

  const visiveis = useMemo(() => {
    if (!dados) return [];
    const b = normC(busca);
    return dados.lancamentos.filter((l) => {
      if (l.desmembrado || l.substituido) return false;
      if (fBanco && l.banco !== fBanco) return false;
      if (fConta === "_sem" ? l.contaId : fConta && String(l.contaId) !== fConta) return false;
      if (fStatus === "pend" && l.contaId) return false;
      if (fStatus === "ok" && !l.contaId) return false;
      if (periodo.de && l.data < periodo.de) return false;
      if (periodo.ate && l.data > periodo.ate) return false;
      if (soGrupo && gruposDre.size && !gruposDre.has(contasById[l.contaId]?.grupoDre)) return false;
      if (b && !normC(`${l.historico} ${l.identificacao || ""} ${l.documento || ""} ${brl(l.valor)} ${contasById[l.contaId]?.nome || ""}`).includes(b)) return false;
      return true;
    });
  }, [dados, fBanco, fConta, fStatus, busca, contasById, periodo, soGrupo, gruposDre]);

  const grupos = useMemo(() => {
    const m = new Map();
    const chave = (l) => agrupar === "banco" ? l.banco : (l.contaId ? contasById[l.contaId]?.codigo : "~");
    for (const l of visiveis) { const k = chave(l); if (!m.has(k)) m.set(k, []); m.get(k).push(l); }
    const doGrupo = (k) => {
      if (!gruposDre.size || agrupar !== "conta" || k === "~") return false;
      const c = (dados.contas || []).find((x) => x.codigo === k);
      return !!c && gruposDre.has(c.grupoDre);
    };
    const ks = [...m.keys()].sort((a, b) => {
      const ga = doGrupo(a), gb = doGrupo(b);
      if (ga !== gb) return ga ? -1 : 1;                  // o que compõe o card clicado sobe
      return a === "~" ? -1 : b === "~" ? 1 : a.localeCompare(b);
    });
    return ks.map((k) => {
      const chaveOrd = (l) => ord.k === "banco" ? l.banco : ord.k === "historico" ? l.historico : ord.k === "descricao" ? (contasById[l.contaId]?.nome || "") : ord.k === "valor" ? l.valor : l.data;
      const base = (a, b) => a.data.localeCompare(b.data) || (a.arquivoId || 0) - (b.arquivoId || 0) || a.ordem - b.ordem || a.id - b.id;
      const itens = m.get(k).slice().sort((a, b) => {
        const va = chaveOrd(a), vb = chaveOrd(b);
        const c = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
        return c * ord.dir || base(a, b);
      });
      const conta = agrupar === "conta" && k !== "~" ? (dados.contas.find((c) => c.codigo === k)) : null;
      const titulo = agrupar === "banco" ? k : k === "~" ? "A IDENTIFICAR" : `${conta.codigo} · ${conta.nome}`;
      const inicial = agrupar === "banco" && !fConta && fStatus === "todos" && !busca ? (dados.saldos[k] || 0) : 0;
      return { k, titulo, conta, itens, inicial, doGrupo: doGrupo(k) };
    });
  }, [visiveis, agrupar, contasById, dados, fConta, fStatus, busca, ord, gruposDre]);

  const tot = useMemo(() => {
    const ls = (dados?.lancamentos || []).filter((l) => !l.desmembrado && !l.substituido);
    const conc = (dados?.contas || []).find((c) => c.codigo === "3000000");
    return {
      n: ls.length,
      pend: ls.filter((l) => !l.contaId).length,
      ent: ls.filter((l) => l.valor > 0 && !(conc && l.contaId === conc.id)).reduce((a, l) => a + l.valor, 0),
      sai: ls.filter((l) => l.valor < 0 && !(conc && l.contaId === conc.id)).reduce((a, l) => a + l.valor, 0),
      conc: conc ? ls.filter((l) => l.contaId === conc.id).reduce((a, l) => a + l.valor, 0) : 0,
      temConc: conc ? ls.some((l) => l.contaId === conc.id) : false,
    };
  }, [dados]);

  const somaSel = useMemo(() => visiveis.filter((l) => sel.has(l.id)).reduce((a, l) => a + l.valor, 0), [sel, visiveis]);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGrupo = (g) => setSel((s) => { const n = new Set(s); const todos = g.itens.every((l) => n.has(l.id)); g.itens.forEach((l) => (todos ? n.delete(l.id) : n.add(l.id))); return n; });

  const lerPendentes = async () => {
    setLendo(true);
    try {
      const d = await api("/api/fin/processar", "POST", { usuarioId: user.id, competencia: comp });
      const n = d.arquivos.reduce((a, x) => a + (x.n || 0), 0);
      const falhas = d.arquivos.filter((x) => x.ok === false);
      const conf = d.conferencia || [];
      setAviso(`${d.arquivos.length} arquivo(s) lido(s) · ${n} itens${conf.length ? ` · conferência: ${conf.filter((c) => c.ok).length} ok, ${conf.filter((c) => !c.ok).length} com crítica` : ""}${falhas.length ? ` · ${falhas.length} com erro` : ""}`);
    } catch (e) { alert(e.message); }
    setLendo(false);
    carregar();
  };

  const aplicarPalavras = async () => {
    setLendo(true);
    try { const d = await api("/api/fin/regras/aplicar", "POST", { usuarioId: user.id, competencia: comp }); setAviso(d.identificados ? `${d.identificados} lançamento(s) identificados por palavra-chave` : "Nenhuma palavra-chave casou com os lançamentos pendentes."); }
    catch (e) { alert(e.message); }
    setLendo(false); carregar();
  };

  const excluir = async (l) => {
    const msg = l.paiId ? "Excluir uma parte desfaz o desmembramento inteiro. Continuar?" : `Excluir o lançamento "${l.historico}"?`;
    if (!confirm(msg)) return;
    await fetch(`/api/fin/lancamentos/${l.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };
  const excluirSel = async () => {
    if (!confirm(`Excluir ${sel.size} lançamento(s)?`)) return;
    for (const id of sel) await fetch(`/api/fin/lancamentos/${id}?u=${user.id}`, { method: "DELETE" });
    setSel(new Set()); carregar();
  };

  const Th = ({ children, right, w, k }) => (
    <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide" onClick={k ? () => ordenarPor(k) : undefined}
      style={{ color: ord.k === k ? C.accent : C.navy, textAlign: right ? "right" : "left", width: w, whiteSpace: "nowrap", cursor: k ? "pointer" : "default", userSelect: "none" }}>
      <span className="inline-flex items-center gap-1" style={{ flexDirection: right ? "row-reverse" : "row" }}>
        {children}
        {k && (ord.k === k ? (ord.dir > 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />)}
      </span>
    </th>
  );
  const sel2 = { border: `1px solid ${C.line}`, background: C.panel, color: C.text };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {anual
          ? <div className="px-3 py-2 rounded-lg font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel }}>Ano {ano}</div>
          : <SeletorMes comp={comp} setComp={setComp} />}
        {dados?.arquivosPendentes > 0 && (
          <button onClick={lerPendentes} disabled={lendo} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: "#fff" }}>
            {lendo ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Ler {dados.arquivosPendentes} arquivo(s) pendente(s)
          </button>
        )}
        <button onClick={() => setModal({ tipo: "novo" })} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent, background: C.panel }}>
          <Plus size={15} /> Lançamento
        </button>
        {tot.pend > 0 && (
          <button onClick={aplicarPalavras} disabled={lendo} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.panel }}>
            <Wand2 size={15} style={{ color: C.accent }} /> Aplicar palavras-chave
          </button>
        )}
        {dados && (
          <button onClick={() => setModal({ tipo: "ia" })} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: "#fff" }}>
            <Sparkles size={15} style={{ color: C.accent }} /> Analisar com IA
          </button>
        )}
        {dados && (
          <div className="flex flex-wrap gap-2 ml-auto">
            <Pilula cor={C.text} bg={C.panel2} txt={`${tot.n} lançamentos`} />
            {(() => {
              const pf = dados.lancamentos.filter((l) => l.substituido && String(l.substGrupo || "").startsWith("PAGFAT|"));
              return pf.length > 0 && (
                <span title={pf.map((l) => `${l.data.split("-").reverse().join("/")} · ${l.banco} · ${l.historico} · R$ ${brl(l.valor)} = fatura ${l.substGrupo.slice(7)}`).join("\n")}>
                  <Pilula cor={C.blue} bg={C.blueSoft} txt={`${pf.length} pagamento(s) de fatura desconsiderado(s)`} />
                </span>
              );
            })()}
            <Pilula cor={tot.pend ? C.accent : C.green} bg={tot.pend ? C.accentSoft : C.greenSoft} txt={tot.pend ? `${tot.pend} a identificar` : "Tudo identificado"} />
            <Pilula cor={C.blue} bg={C.blueSoft} txt={`Entradas R$ ${brl(tot.ent)}`} />
            <Pilula cor={C.red} bg={C.redSoft} txt={`Saídas R$ ${brl(tot.sai)}`} />
            {tot.temConc && <Pilula cor={Math.abs(tot.conc) < 0.005 ? C.green : C.red} bg={Math.abs(tot.conc) < 0.005 ? C.greenSoft : C.redSoft} txt={`Conciliação R$ ${brl(tot.conc)}`} />}
          </div>
        )}
      </div>

      {!anual && dados && <Conferencia user={user} comp={comp} dados={dados} onMudou={carregar} setAviso={setAviso} />}

      {dados?.ajusteCartaoBB && (
        <div className="rounded-lg px-4 py-3 mb-3 text-sm" style={{ background: C.blueSoft, color: C.blue }}>
          <div className="flex items-start gap-2">
            <CreditCard size={15} className="shrink-0 mt-0.5" />
            <div>
              <b>Cartão de crédito BB saiu de "pgto dívidas bancárias".</b>{" "}
              {dados.ajusteCartaoBB.descartados} lançamento(s) desconsiderado(s)
              {dados.ajusteCartaoBB.valorDescartado ? ` · R$ ${brl(dados.ajusteCartaoBB.valorDescartado)}` : ""}.
              {dados.ajusteCartaoBB.estornosAbertos > 0 && (
                <> {dados.ajusteCartaoBB.estornosAbertos} estorno(s) voltaram para "a identificar".</>
              )}
              {dados.ajusteCartaoBB.regrasDesligadas?.length > 0 && (
                <> Palavra(s)-chave desligada(s): {dados.ajusteCartaoBB.regrasDesligadas.join(" · ")}.</>
              )}
              {dados.ajusteCartaoBB.outrosLancamentos > 0 && (
                <div className="mt-1" style={{ color: C.yellow }}>
                  Há {dados.ajusteCartaoBB.outrosLancamentos} lançamento(s) de cartão em dívidas bancárias de
                  outro(s) banco(s) ({dados.ajusteCartaoBB.outrosBancos.join(", ")}), somando
                  R$ {brl(dados.ajusteCartaoBB.valorOutros)}. Não mexi neles — me avise se quiser o mesmo tratamento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {gruposDre.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 mb-3 text-sm" style={{ background: C.accentSoft, color: C.text }}>
          <PieIco size={15} style={{ color: C.accent }} />
          <span>
            Veio de <b>{nomeGrupoDre || grupoDre}</b> da DRE — as contas-caixa desse grupo estão no topo da lista.
          </span>
          <button onClick={() => setSoGrupo((v) => !v)} className="ml-auto px-3 py-1 rounded text-xs font-semibold"
            style={{ background: soGrupo ? C.accent : C.panel, color: soGrupo ? "#fff" : C.accent, border: `1px solid ${C.accent}` }}>
            {soGrupo ? "Mostrando só este grupo" : "Mostrar só este grupo"}
          </button>
        </div>
      )}

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center rounded-lg px-2" style={sel2}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar histórico, valor…" className="px-2 py-1.5 text-sm" style={{ outline: "none", width: 220 }} />
        </div>
        <div className="flex items-center gap-1 rounded-lg px-2 py-1" style={sel2}>
          <CalendarRange size={14} style={{ color: C.sub }} />
          <input type="date" value={periodo.de} onChange={(e) => setPeriodo((x) => ({ ...x, de: e.target.value }))}
            className="text-sm" style={{ outline: "none", border: "none", background: "transparent" }} />
          <span style={{ color: C.sub }}>a</span>
          <input type="date" value={periodo.ate} onChange={(e) => setPeriodo((x) => ({ ...x, ate: e.target.value }))}
            className="text-sm" style={{ outline: "none", border: "none", background: "transparent" }} />
          {(() => { const pd = periodoPadrao(comp, ano); return (periodo.de !== pd.de || periodo.ate !== pd.ate) ? (
            <button onClick={() => setPeriodo(pd)} title="Voltar ao período inteiro" style={{ color: C.accent }}><Undo2 size={13} /></button>
          ) : null; })()}
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm" style={sel2}>
          <option value="todos">Todos</option><option value="pend">A identificar</option><option value="ok">Identificados</option>
        </select>
        <select value={fBanco} onChange={(e) => setFBanco(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm" style={sel2}>
          <option value="">Todos os bancos</option>{bancos.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select value={fConta} onChange={(e) => setFConta(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm" style={{ ...sel2, maxWidth: 260 }}>
          <option value="">Todas as contas</option><option value="_sem">— sem conta —</option>
          {(dados?.contas || []).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden ml-auto" style={{ border: `1px solid ${C.line}` }}>
          {[["banco", "Por banco"], ["conta", "Por conta-caixa"]].map(([k, t]) => (
            <button key={k} onClick={() => setAgrupar(k)} className="px-3 py-1.5 text-sm" style={{ background: agrupar === k ? C.navy : C.panel, color: agrupar === k ? "#fff" : C.sub }}>{t}</button>
          ))}
        </div>
      </div>

      {sel.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 mb-3 rounded-lg sticky top-0 z-10" style={{ background: C.navy, color: "#fff" }}>
          <div className="text-sm font-semibold">{sel.size} selecionado(s) · R$ {brl(somaSel)}</div>
          <button onClick={() => setModal({ tipo: "identificar", itens: visiveis.filter((l) => sel.has(l.id)) })} className="flex items-center gap-1 px-3 py-1 rounded text-sm font-semibold" style={{ background: C.green }}>
            <Tag size={14} /> Identificar
          </button>
          <button onClick={excluirSel} className="flex items-center gap-1 px-3 py-1 rounded text-sm" style={{ background: "rgba(255,255,255,.12)" }}><Trash2 size={14} /> Excluir</button>
          <button onClick={() => setSel(new Set())} className="ml-auto text-sm opacity-80">Limpar seleção</button>
        </div>
      )}

      {aviso && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!dados && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {dados && dados.lancamentos.length === 0 && (
        <div className="p-6 rounded-xl text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>
          Nenhum lançamento em {nomeComp(comp)}. Envie os extratos na aba <b>Importação mensal</b>{dados.arquivosPendentes ? " ou clique em “Ler extratos pendentes”." : "."}
        </div>
      )}

      {dados && grupos.length > 0 && (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 960 }}>
            <thead style={{ borderBottom: `2px solid ${C.line}` }}>
              <tr>
                <th style={{ width: 28 }} />
                <Th w={130} k="banco">Banco</Th><Th w={86} k="data">Data</Th><Th k="historico">Histórico</Th>
                <Th w={200} k="descricao">Descrição</Th><Th right w={100} k="valor">Valor</Th><Th right w={105}>Saldo</Th><th style={{ width: 128 }} />
              </tr>
            </thead>
            {grupos.map((g) => {
              let saldo = g.inicial;
              const soma = g.itens.reduce((a, l) => a + l.valor, 0);
              return (
                <tbody key={g.k}>
                  <tr style={{ background: C.panel2, borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2 py-2"><input type="checkbox" checked={g.itens.every((l) => sel.has(l.id))} onChange={() => toggleGrupo(g)} /></td>
                    <td colSpan={4} className="px-2 py-2 font-bold" style={{ color: g.k === "~" ? C.accent : C.navy }}>
                      {g.titulo} <span className="font-normal" style={{ color: C.sub }}>· {g.itens.length} lanç. · soma R$ {brl(soma)}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold" style={{ color: C.sub }}>SALDO ANTERIOR</td>
                    <td className="px-2 py-2 text-right font-bold">{brl(g.inicial)}</td>
                    <td />
                  </tr>
                  {g.itens.map((l) => {
                    saldo += l.valor;
                    const conta = l.contaId ? contasById[l.contaId] : null;
                    const cor = corConta(conta);
                    return (
                      <tr key={l.id} style={{ borderTop: `1px solid ${C.line}`, background: sel.has(l.id) ? C.accentSoft : undefined, boxShadow: conta ? undefined : `inset 3px 0 0 ${C.accent}` }}>
                        <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                        <td className="px-2 py-1.5 font-semibold" style={{ color: cor }}>{l.banco}</td>
                        <td className="px-2 py-1.5" style={{ color: cor }}>{dBR(l.data)}</td>
                        <td className="px-2 py-1.5" style={{ color: cor }} title={l.documento ? `Documento ${l.documento}` : undefined}>
                          <span style={{ fontSize: 11 }}>{l.historico}</span>
                          {l.origem === "PARTE" && <span className="ml-1 px-1 rounded text-[10px]" style={{ background: C.panel2, color: C.sub }}>parte</span>}
                          {l.origem === "DETALHE" && <span className="ml-1 px-1 rounded text-[10px]" style={{ background: C.blueSoft, color: C.blue }}>detalhe</span>}
                          {l.origem === "HISTORICO" && <span className="ml-1 px-1 rounded text-[10px]" style={{ background: C.blueSoft, color: C.blue }}>histórico</span>}
                          {l.origem === "MANUAL" && <span className="ml-1 px-1 rounded text-[10px]" style={{ background: C.panel2, color: C.sub }}>manual</span>}
                          {l.identificadoPor === "REGRA" && <Wand2 size={11} className="inline ml-1" style={{ color: C.sub }} title="Identificado por palavra-chave" />}
                          {l.identificacao && <div className="text-[10px]" style={{ color: C.sub }}>{l.identificacao}</div>}
                        </td>
                        <td className="px-2 py-1.5 font-semibold" style={{ color: cor }} title={conta ? conta.codigo : undefined}>{conta?.nome || <span style={{ color: C.accent }}>A IDENTIFICAR</span>}</td>
                        <td className="px-2 py-1.5 text-right font-semibold" style={{ color: corValor(l.valor) }}>{brl(l.valor)}</td>
                        <td className="px-2 py-1.5 text-right" style={{ color: corValor(saldo) }}>{brl(saldo)}</td>
                        <td className="px-2 py-1">
                          <div className="flex justify-end gap-1">
                            <IconBtn t="Desmembrar" onClick={() => setModal({ tipo: "desmembrar", lanc: l })} disabled={!!l.paiId}><Scissors size={13} /></IconBtn>
                            <IconBtn t="Editar" onClick={() => setModal({ tipo: "editar", lanc: l })}><Pencil size={13} /></IconBtn>
                            <IconBtn t="Excluir" onClick={() => excluir(l)}><Trash2 size={13} /></IconBtn>
                            <button title="Identificar" onClick={() => setModal({ tipo: "identificar", itens: [l] })}
                              className="flex items-center justify-center rounded" style={{ width: 26, height: 26, background: conta ? C.panel2 : C.green, color: conta ? C.green : "#fff" }}>
                              <Tag size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {modal?.tipo === "ia" && (
        <AnaliseIAModal user={user} comp={comp} contas={dados.contas.filter((c) => c.ativo)} todas={dados.contas}
          onClose={(mudou) => { setModal(null); if (mudou) carregar(); }} />
      )}
      {modal?.tipo === "identificar" && (
        <IdentificarModal user={user} itens={modal.itens} contas={dados.contas.filter((c) => c.ativo)}
          onClose={() => setModal(null)}
          onSalvo={(d) => { setModal(null); setSel(new Set()); setAviso(`${d.atualizados} identificado(s)${d.regras ? ` · ${d.regras} palavra(s)-chave salva(s)` : ""}${d.porRegra ? ` · +${d.porRegra} identificado(s) por elas` : ""}`); carregar(); }} />
      )}
      {(modal?.tipo === "editar" || modal?.tipo === "novo") && (
        <EditarLancModal user={user} comp={comp} lanc={modal.lanc} bancos={bancos} contas={dados?.contas || []}
          onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
      {modal?.tipo === "desmembrar" && (
        <DesmembrarModal user={user} lanc={modal.lanc} contas={dados.contas.filter((c) => c.ativo)}
          onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
    </div>
  );
}

/* ---------- Conferência: detalhamentos x consolidados do extrato ---------- */
function Conferencia({ user, comp, dados, onMudou, setAviso }) {
  const [aberto, setAberto] = useState(false);
  const [vinc, setVinc] = useState(null); // grupo para vínculo manual
  const porId = useMemo(() => Object.fromEntries(dados.lancamentos.map((l) => [l.id, l])), [dados]);
  const conf = dados.conferencia || [];
  const ok = conf.filter((c) => c.ok);
  const erros = conf.filter((c) => !c.ok && !c.aviso);
  const avisos = conf.filter((c) => !c.ok && c.aviso);
  const consol = (dados.consolidados || []).map((c) => ({ ...c, l: porId[c.id] })).filter((c) => c.l);
  const leitura = dados.leitura || [];
  if (!conf.length && !consol.length && !leitura.length) return null;
  const problemas = erros.length + consol.length + leitura.length;

  const acao = async (body, msg) => {
    try { await api("/api/fin/conciliar", "POST", { usuarioId: user.id, competencia: comp, ...body }); if (msg) setAviso(msg); onMudou(); }
    catch (e) { alert(e.message); }
  };
  const conferido = async (l) => { await api(`/api/fin/lancamentos/${l.id}`, "PATCH", { usuarioId: user.id, revisado: true }); onMudou(); };

  return (
    <div className="rounded-xl mb-4" style={{ background: C.panel, border: `1px solid ${problemas ? "#F5C2BD" : C.line}` }}>
      <button onClick={() => setAberto((a) => !a)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <ShieldCheck size={18} style={{ color: problemas ? C.red : C.green }} />
        <div className="flex-1">
          <div className="text-sm font-semibold">Conferência com o extrato</div>
          <div className="text-xs" style={{ color: C.sub }}>
            {leitura.length > 0 && <><b style={{ color: C.red }}>{leitura.length} arquivo(s) com leitura que não confere</b> · </>}
            {ok.length} detalhamento(s) conferido(s)
            {erros.length > 0 && <> · <b style={{ color: C.red }}>{erros.length} não bate(m)</b></>}
            {consol.length > 0 && <> · <b style={{ color: C.red }}>{consol.length} consolidado(s) sem detalhamento</b></>}
            {avisos.length > 0 && <> · {avisos.length} para o mês seguinte</>}
          </div>
        </div>
        <ChevR size={16} style={{ color: C.sub, transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      {aberto && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {leitura.map((a) => (
            <div key={"l" + a.id} className="rounded-lg p-3 text-xs" style={{ background: C.redSoft }}>
              <div className="font-semibold" style={{ color: C.red }}>Leitura não confere · {a.banco} · {a.documento}</div>
              <div className="mt-0.5">{a.nome}: {a.msg}</div>
              <div className="mt-0.5" style={{ color: C.sub }}>Os lançamentos deste arquivo podem estar incompletos. Exclua e envie de novo na aba Importação; se persistir, o layout do banco mudou.</div>
            </div>
          ))}
          {erros.map((c) => (
            <div key={c.chave} className="rounded-lg p-3 text-xs" style={{ background: C.redSoft }}>
              <div className="font-semibold" style={{ color: C.red }}>{c.rotulo}</div>
              <div className="mt-0.5" style={{ color: C.text }}>{c.msg}</div>
              <button onClick={() => setVinc(c)} className="mt-2 flex items-center gap-1 px-2 py-1 rounded font-semibold" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}>
                <Link2 size={12} /> Vincular manualmente
              </button>
            </div>
          ))}
          {consol.map((c) => (
            <div key={c.id} className="rounded-lg p-3 text-xs flex items-start gap-3" style={{ background: C.yellowSoft }}>
              <div className="flex-1">
                <div className="font-semibold" style={{ color: C.yellow }}>Consolidado sem detalhamento · falta: {c.doc}</div>
                <div className="mt-0.5">{c.l.banco} · {dBR(c.l.data)} · {c.l.historico} · <b style={{ color: corValor(c.l.valor) }}>R$ {brl(c.l.valor)}</b></div>
              </div>
              <button onClick={() => conferido(c.l)} className="px-2 py-1 rounded font-semibold shrink-0" style={{ background: C.panel, border: `1px solid ${C.line}` }}>Marcar como conferido</button>
            </div>
          ))}
          {avisos.map((c) => (
            <div key={c.chave} className="rounded-lg p-3 text-xs" style={{ background: C.panel2 }}>
              <b>{c.rotulo}</b> · {c.msg}
            </div>
          ))}
          {ok.length > 0 && (
            <details className="text-xs mt-1">
              <summary className="cursor-pointer" style={{ color: C.sub }}>Ver {ok.length} conferido(s)</summary>
              <div className="mt-2 flex flex-col gap-1">
                {ok.map((c) => (
                  <div key={c.chave} className="flex items-center gap-2 rounded px-2 py-1" style={{ background: C.greenSoft }}>
                    <CheckCircle2 size={12} style={{ color: C.green }} className="shrink-0" />
                    <div className="flex-1"><b>{c.rotulo}</b> · {c.msg}</div>
                    {!/já detalhados|Sem valores/.test(c.msg) && (
                      <button onClick={() => { if (confirm("Desfazer esta troca? O lançamento consolidado volta para o extrato.")) acao({ acao: "desfazer", chave: c.chave }, "Troca desfeita."); }}
                        title="Desfazer" style={{ color: C.sub }}><Undo2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {vinc && <VinculoModal grupo={vinc} porId={porId} lancamentos={dados.lancamentos} onClose={() => setVinc(null)}
        onConfirmar={async (ids) => { setVinc(null); await acao({ acao: "forcar", chave: vinc.chave, ids }, "Vínculo manual feito."); }} />}
    </div>
  );
}

function VinculoModal({ grupo, porId, lancamentos, onClose, onConfirmar }) {
  const sinal = grupo.total >= 0 ? 1 : -1;
  const sugeridos = (grupo.candidatos || []).map((id) => porId[id]).filter((l) => l && !l.substituido);
  const [todos, setTodos] = useState(!sugeridos.length);
  const [sel, setSel] = useState(new Set());
  const lista = todos
    ? lancamentos.filter((l) => l.origem === "EXTRATO" && !l.substituido && !l.desmembrado && Math.sign(l.valor) === sinal)
    : sugeridos;
  const somaSel = lista.filter((l) => sel.has(l.id)).reduce((a, l) => a + l.valor, 0);
  const dif = Math.round((somaSel - grupo.total) * 100) / 100;
  const tg = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Modal titulo="Vincular manualmente" icone={Link2} onClose={onClose} largura={760}>
      <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: C.panel2 }}>
        <div className="font-semibold">{grupo.rotulo}</div>
        <div style={{ color: C.sub }}>Detalhamento soma <b style={{ color: corValor(grupo.total) }}>R$ {brl(grupo.total)}</b>. Escolha o(s) lançamento(s) do extrato que ele substitui.</div>
      </div>
      <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer" style={{ color: C.sub }}>
        <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Mostrar todos os lançamentos do mês ({sinal < 0 ? "saídas" : "entradas"})
      </label>
      <div className="overflow-auto rounded-lg" style={{ maxHeight: 320, border: `1px solid ${C.line}` }}>
        {lista.length === 0 && <div className="p-3 text-xs" style={{ color: C.sub }}>Nenhum lançamento disponível.</div>}
        {lista.map((l) => (
          <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer" style={{ borderBottom: `1px solid ${C.panel2}`, background: sel.has(l.id) ? C.accentSoft : undefined }}>
            <input type="checkbox" checked={sel.has(l.id)} onChange={() => tg(l.id)} />
            <span style={{ width: 110, color: C.sub }}>{l.banco}</span><span style={{ width: 72, color: C.sub }}>{dBR(l.data)}</span>
            <span className="flex-1 truncate">{l.historico}</span>
            <span style={{ width: 90, textAlign: "right", color: corValor(l.valor), fontWeight: 600 }}>{brl(l.valor)}</span>
          </label>
        ))}
      </div>
      {sel.size > 0 && (
        <div className="text-xs mt-3" style={{ color: Math.abs(dif) < 0.005 ? C.green : C.yellow }}>
          Selecionado R$ {brl(somaSel)} · {Math.abs(dif) < 0.005 ? "bate exatamente ✓" : `diferença de R$ ${brl(dif)} será lançada à parte (sem conta) para você identificar`}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2 }}>Cancelar</button>
        <button disabled={!sel.size} onClick={() => onConfirmar([...sel])} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: sel.size ? 1 : 0.5 }}>Vincular</button>
      </div>
    </Modal>
  );
}

function IconBtn({ t, onClick, disabled, children }) {
  return (
    <button title={t} onClick={onClick} disabled={disabled} className="flex items-center justify-center rounded"
      style={{ width: 26, height: 26, border: `1px solid ${C.line}`, color: C.sub, background: C.panel, opacity: disabled ? 0.35 : 1 }}>{children}</button>
  );
}

function Modal({ titulo, icone: Ico, onClose, children, largura = 560 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="rounded-xl w-full flex flex-col" style={{ background: C.panel, maxWidth: largura, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold flex items-center gap-2">{Ico && <Ico size={18} style={{ color: C.accent }} />} {titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// escolha de conta-caixa por código ou nome
function ContaPicker({ contas, value, onChange, autoFocus }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const atual = contas.find((c) => c.id === value);
  const lista = useMemo(() => {
    const n = normC(q);
    return contas.filter((c) => !n || c.codigo.startsWith(n.replace(/\s/g, "")) || normC(c.nome).includes(n)).slice(0, 60);
  }, [q, contas]);
  return (
    <div className="relative">
      <input autoFocus={autoFocus} value={aberto ? q : atual ? `${atual.codigo} · ${atual.nome}` : q}
        onFocus={() => { setAberto(true); setQ(""); }} onBlur={() => setTimeout(() => setAberto(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && lista[0]) { onChange(lista[0].id); setAberto(false); e.target.blur(); } }}
        placeholder="Digite código ou nome da conta-caixa…" className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ border: `1px solid ${C.line}`, color: atual && !aberto ? corConta(atual) : C.text, fontWeight: atual && !aberto ? 600 : 400 }} />
      {aberto && (
        <div className="absolute z-20 w-full mt-1 rounded-lg overflow-auto shadow-lg" style={{ background: C.panel, border: `1px solid ${C.line}`, maxHeight: 260 }}>
          {lista.length === 0 && <div className="px-3 py-2 text-xs" style={{ color: C.sub }}>Nenhuma conta encontrada.</div>}
          {lista.map((c) => (
            <button key={c.id} onMouseDown={() => { onChange(c.id); setAberto(false); }} className="w-full text-left px-3 py-1.5 text-xs flex gap-2 hover:bg-gray-50">
              <span className="font-semibold" style={{ color: corConta(c), width: 60 }}>{c.codigo}</span><span>{c.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- ANÁLISE COM IA ---------------- */
const CONF = { ALTA: [C.green, C.greenSoft], MEDIA: [C.yellow, C.yellowSoft], BAIXA: [C.red, C.redSoft] };
function AnaliseIAModal({ user, comp, contas, todas, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("sug");
  const [sug, setSug] = useState([]);
  const [inc, setInc] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [mudou, setMudou] = useState(false);
  const [msg, setMsg] = useState("");
  const porId = useMemo(() => Object.fromEntries(todas.map((c) => [c.id, c])), [todas]);
  const [lista, setLista] = useState(null); // análises salvas do mês
  const [modo, setModo] = useState("inicio"); // inicio | lista | rodando | abrindo | res
  const mostrar = (j) => {
    setD(j);
    setSug(j.sugestoes.map((s) => ({ ...s, marcado: !!s.contaId && s.confianca === "ALTA", salvarTermo: false })));
    setInc(j.incongruencias);
    setAba(!j.sugestoes.length && j.incongruencias.length ? "inc" : "sug");
    setModo("res");
  };
  const rodar = (refazerPesquisa = false) => {
    setD(null); setErro(""); setMsg(""); setModo("rodando");
    api("/api/fin/ia", "POST", { usuarioId: user.id, competencia: comp, refazerPesquisa })
      .then(mostrar).catch((e) => { setErro(e.message); setModo("lista"); });
  };
  const abrir = (id) => {
    setD(null); setErro(""); setMsg(""); setModo("abrindo");
    fetch(`/api/fin/ia/${id}?u=${user.id}`).then((r) => r.json().then((j) => (r.ok ? mostrar(j) : Promise.reject(new Error(j.error || "Erro")))))
      .catch((e) => { setErro(e.message); setModo("lista"); });
  };
  const listar = () => {
    setModo("lista"); setErro("");
    return fetch(`/api/fin/ia?u=${user.id}&competencia=${comp}`).then((r) => r.json()).then((l) => { setLista(Array.isArray(l) ? l : []); return l; });
  };
  const excluir = async (id) => {
    if (!confirm("Apagar esta análise salva?")) return;
    await api(`/api/fin/ia/${id}`, "DELETE", { usuarioId: user.id }).catch(() => {});
    listar();
  };
  useEffect(() => { listar().then((l) => { if (!Array.isArray(l) || !l.length) rodar(); }).catch(() => rodar()); }, []);
  const muda = (g, k, v) => setSug((l) => l.map((s) => (s.g === g ? { ...s, [k]: v } : s)));
  const marcados = sug.filter((s) => s.marcado && s.contaId);
  const [ordS, setOrdS] = useState({ k: null, dir: 1 });
  const PESO = { ALTA: 3, MEDIA: 2, BAIXA: 1 };
  const valS = (s, k) => k === "conf" ? (PESO[s.confianca] || 0) : k === "qtd" ? s.qtd : k === "valor" ? Math.abs(s.total) : k === "hist" ? s.historico : k === "conta" ? (porId[s.contaId]?.codigo || "") : 0;
  const sugOrd = useMemo(() => {
    if (!ordS.k) return sug;
    return [...sug].sort((a, b) => {
      const va = valS(a, ordS.k), vb = valS(b, ordS.k);
      const c = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return c * ordS.dir || Math.abs(b.total) - Math.abs(a.total);
    });
  }, [sug, ordS]);
  // 1º clique: confiança/qtd/valor do maior para o menor; texto de A a Z. 2º clique inverte.
  const ordenarS = (k) => setOrdS((o) => (o.k === k ? { k, dir: -o.dir } : { k, dir: k === "hist" || k === "conta" ? 1 : -1 }));
  const aplicar = async () => {
    setSalvando(true); setMsg("");
    let n = 0, r = 0;
    try {
      for (const s of marcados) {
        const regras = s.salvarTermo && s.termo ? [{ termo: s.termo, dc: s.sinal }] : [];
        const j = await api("/api/fin/lancamentos/identificar", "POST", { usuarioId: user.id, ids: s.ids, contaId: s.contaId, regras });
        n += s.ids.length; r += j.regras || 0;
      }
      const feitos = new Set(marcados.map((s) => s.g));
      setSug((l) => l.filter((s) => !feitos.has(s.g)));
      setMudou(true);
      setMsg(`${n} lançamento(s) identificados${r ? ` · ${r} palavra(s)-chave salvas` : ""}.`);
    } catch (e) { setMsg(e.message); }
    setSalvando(false);
  };
  const trocar = async (it) => {
    try {
      await api("/api/fin/lancamentos/identificar", "POST", { usuarioId: user.id, ids: [it.id], contaId: it.contaSugeridaId });
      setInc((l) => l.filter((x) => x.i !== it.i)); setMudou(true);
    } catch (e) { setMsg(e.message); }
  };
  const ignorar = (it) => {
    setInc((l) => l.filter((x) => x.i !== it.i));
    if (d?.analiseId) api(`/api/fin/ia/${d.analiseId}`, "PATCH", { usuarioId: user.id, ignorar: it.i }).catch(() => {});
  };
  const nomeConta = (id) => (porId[id] ? `${porId[id].codigo} · ${porId[id].nome}` : "—");
  const tab = (k, t, n) => (
    <button onClick={() => setAba(k)} className="px-4 py-2 text-sm font-medium" style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
      {t} <span className="ml-1 px-1.5 rounded-full text-[10px]" style={{ background: C.panel2 }}>{n}</span>
    </button>
  );
  return (
    <Modal titulo={`Análise com IA · ${nomeComp(comp)}`} icone={Sparkles} onClose={() => onClose(mudou)} largura={1100}>
      {(modo === "rodando" || modo === "abrindo" || modo === "inicio") && (
        <div className="flex flex-col items-center gap-2 py-12 text-sm" style={{ color: C.sub }}>
          <Loader2 size={24} className="animate-spin" style={{ color: C.accent }} />
          {modo === "rodando" ? "Comparando com o histórico, consultando a IA e pesquisando na internet o que não tem histórico… (pode levar alguns minutos)" : "Carregando…"}
        </div>
      )}
      {erro && <div className="p-3 rounded text-sm mb-3" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {modo === "lista" && lista && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm" style={{ color: C.sub }}>{lista.length ? "Análises salvas deste mês. Abra uma anterior (sem custo) ou faça uma nova." : "Nenhuma análise salva neste mês."}</div>
            <button onClick={() => rodar()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>
              <Sparkles size={15} /> Nova análise
            </button>
          </div>
          {lista.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2" style={{ border: `1px solid ${C.line}`, background: i === 0 ? C.panel2 : C.panel }}>
              <Sparkles size={16} style={{ color: a.ia ? C.accent : C.sub }} />
              <div className="flex-1 text-sm">
                <div className="font-semibold">{dataHora(a.createdAt)}{i === 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>mais recente</span>}</div>
                <div className="text-xs" style={{ color: C.sub }}>{a.usuarioNome || "—"} · {a.nSugestoes} sugestão(ões) · {a.nIncong} incongruência(s) · {a.ia ? "com IA" : "só histórico"}</div>
              </div>
              <button onClick={() => abrir(a.id)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Abrir</button>
              <button onClick={() => excluir(a.id)} title="Apagar" style={{ color: C.sub }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {modo === "res" && d && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="text-sm flex-1">
              <b>Análise de {dataHora(d.criadaEm || Date.now())}</b>{d.usuarioNome && <span style={{ color: C.sub }}> · {d.usuarioNome}</span>}
              {d.salva && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.blueSoft, color: C.blue }}>salva{d.resolvidas ? ` · ${d.resolvidas} já resolvida(s)` : ""}</span>}
            </div>
            <button onClick={listar} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text }}>Análises anteriores</button>
            <button onClick={() => rodar()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}><Sparkles size={13} /> Nova análise</button>
          </div>
          <div className="text-xs mb-3 flex flex-wrap gap-3" style={{ color: C.sub }}>
            <span>Base: <b>{d.historico.toLocaleString("pt-BR")}</b> identificações de outros meses</span>
            <span style={{ color: d.ia ? C.green : C.yellow }}>{d.ia ? "IA ativa" : "Só histórico (sem IA)"}</span>
            {d.descartadas > 0 && <span>{d.descartadas} alerta(s) descartado(s) pela IA como corretos</span>}
            {d.pagFatura > 0 && <span style={{ color: C.blue }}>{d.pagFatura} pagamento(s) de fatura desconsiderado(s) — batem com a fatura</span>}
            {d.pesquisados > 0 && <span>🔎 {d.pesquisados} sem histórico, pesquisados na internet</span>}
            {d.pesquisados > 0 && d.ia && <button onClick={() => rodar(true)} className="underline" style={{ color: C.blue }}>Refazer pesquisas</button>}
          </div>
          {d.aviso && <div className="p-2 rounded mb-3 text-xs" style={{ background: C.yellowSoft, color: C.yellow }}>{d.aviso}</div>}
          {msg && <div className="p-2 rounded mb-3 text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{msg}</div>}
          <div className="flex gap-1 mb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            {tab("sug", "Sugestões para identificar", sug.length)}
            {tab("inc", "Incongruências", inc.length)}
          </div>

          {aba === "sug" && (sug.length === 0 ? <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nada a identificar neste mês.</div> : (
            <>
              <div className="flex items-center gap-3 mb-2 text-xs">
                <button onClick={() => setSug((l) => l.map((s) => ({ ...s, marcado: !!s.contaId })))} style={{ color: C.blue }}>Marcar todas com conta</button>
                <button onClick={() => setSug((l) => l.map((s) => ({ ...s, marcado: false })))} style={{ color: C.sub }}>Desmarcar</button>
                <span style={{ color: C.sub }}>Já vêm marcadas as de confiança ALTA. Ajuste a conta onde precisar.</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
                    {[["", null], ["Histórico", "hist"], ["Qtd", "qtd"], ["Valor", "valor"], ["Conta sugerida", "conta"], ["Confiança", "conf"], ["Motivo", null], ["Palavra-chave", null]].map(([h, k], i) => (
                      <th key={i} onClick={() => k && ordenarS(k)} className="text-left px-2 py-1.5 font-semibold select-none" style={{ cursor: k ? "pointer" : "default", color: ordS.k === k && k ? C.accent : undefined }}>
                        {h}{k && <span className="ml-1">{ordS.k === k ? (ordS.dir === 1 ? "▲" : "▼") : <span style={{ opacity: 0.3 }}>↕</span>}</span>}
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>{sugOrd.map((s) => {
                    const [cc, cb] = CONF[s.confianca] || [C.sub, C.panel2];
                    return (
                      <tr key={s.g} style={{ borderBottom: `1px solid ${C.line}`, background: s.marcado ? C.accentSoft : undefined }}>
                        <td className="px-2 py-1.5"><input type="checkbox" checked={!!s.marcado} disabled={!s.contaId} onChange={(e) => muda(s.g, "marcado", e.target.checked)} /></td>
                        <td className="px-2 py-1.5" style={{ maxWidth: 260 }}>
                          <div className="font-semibold">{s.historico}</div>
                          <div style={{ color: C.sub }}>{s.banco} · {s.sinal === "C" ? "entrada" : "saída"}</div>
                        </td>
                        <td className="px-2 py-1.5">{s.qtd}</td>
                        <td className="px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color: s.total >= 0 ? C.blue : C.red }}>{brl(s.total)}</td>
                        <td className="px-2 py-1.5" style={{ minWidth: 230 }}><ContaPicker contas={contas} value={s.contaId} onChange={(id) => setSug((l) => l.map((x) => (x.g === s.g ? { ...x, contaId: id, marcado: true } : x)))} /></td>
                        <td className="px-2 py-1.5">{s.confianca && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: cc, background: cb }}>{s.confianca}</span>}
                          {s.fonte && <div className="text-[9px] mt-0.5" style={{ color: C.sub }}>{s.fonte}</div>}</td>
                        <td className="px-2 py-1.5" style={{ color: C.sub, maxWidth: 260 }}>
                          {s.achado && <div className="font-semibold mb-0.5" style={{ color: C.navy }}>🔎 {s.achado}</div>}
                          {s.motivo}
                        </td>
                        <td className="px-2 py-1.5" style={{ minWidth: 160 }}>
                          <label className="flex items-center gap-1">
                            <input type="checkbox" checked={!!s.salvarTermo} onChange={(e) => muda(s.g, "salvarTermo", e.target.checked)} />
                            <input value={s.termo || ""} onChange={(e) => muda(s.g, "termo", e.target.value.toUpperCase())} placeholder="—"
                              className="w-full px-2 py-1 rounded" style={{ border: `1px solid ${C.line}` }} />
                          </label>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={aplicar} disabled={!marcados.length || salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: C.accent, opacity: !marcados.length || salvando ? 0.5 : 1 }}>
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Identificar {marcados.reduce((n, s) => n + s.qtd, 0)} lançamento(s)
                </button>
              </div>
            </>
          ))}

          {aba === "inc" && (inc.length === 0 ? <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma incongruência encontrada.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
                  {["Data", "Histórico", "Valor", "Conta atual", "Trocar para", "Motivo", ""].map((h, i) => <th key={i} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>{inc.map((it) => (
                  <tr key={it.i} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td className="px-2 py-1.5 whitespace-nowrap">{it.data.split("-").reverse().join("/")}</td>
                    <td className="px-2 py-1.5" style={{ maxWidth: 260 }}><div className="font-semibold">{it.historico}</div><div style={{ color: C.sub }}>{it.banco}</div></td>
                    <td className="px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color: it.valor >= 0 ? C.blue : C.red }}>{brl(it.valor)}</td>
                    <td className="px-2 py-1.5" style={{ color: C.red }}>{nomeConta(it.contaAtualId)}</td>
                    <td className="px-2 py-1.5" style={{ minWidth: 220 }}><ContaPicker contas={contas} value={it.contaSugeridaId} onChange={(id) => setInc((l) => l.map((x) => (x.i === it.i ? { ...x, contaSugeridaId: id } : x)))} /></td>
                    <td className="px-2 py-1.5" style={{ color: C.sub, maxWidth: 260 }}>{it.motivo}<div className="text-[9px] mt-0.5">{it.fonte}</div></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <button onClick={() => trocar(it)} disabled={!it.contaSugeridaId} className="px-2 py-1 rounded font-semibold text-white mr-1" style={{ background: C.accent, opacity: it.contaSugeridaId ? 1 : 0.4 }}>Trocar</button>
                      <button onClick={() => ignorar(it)} className="px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Ignorar</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

function IdentificarModal({ user, itens, contas, onClose, onSalvo }) {
  const um = itens.length === 1 ? itens[0] : null;
  const [contaId, setContaId] = useState(um?.contaId || null);
  const [ident, setIdent] = useState(um?.identificacao || "");
  const [criarRegra, setCriarRegra] = useState(true);
  const [soBanco, setSoBanco] = useState(false);
  const [soSinal, setSoSinal] = useState(true);
  // uma linha de palavra-chave por histórico diferente (lançamentos iguais viram uma linha só)
  const [linhas, setLinhas] = useState(() => {
    const m = new Map();
    for (const l of itens) {
      const t = sugerirTermoC(l.historico) || normC(l.historico);
      if (!m.has(t)) m.set(t, { termo: t, on: true, itens: [] });
      m.get(t).itens.push(l);
    }
    return [...m.values()].map((g) => {
      const bancos = [...new Set(g.itens.map((l) => l.banco))];
      const sinal = g.itens.every((l) => l.valor < 0) ? "D" : g.itens.every((l) => l.valor > 0) ? "C" : null;
      return { ...g, banco: bancos.length === 1 ? bancos[0] : null, sinal, soma: g.itens.reduce((a, l) => a + l.valor, 0) };
    }).sort((a, b) => b.itens.length - a.itens.length || a.termo.localeCompare(b.termo));
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const soma = itens.reduce((a, l) => a + l.valor, 0);
  const setLinha = (i, patch) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const marcadas = linhas.filter((x) => x.on && x.termo.trim());
  const todasOn = linhas.every((x) => x.on);

  const salvar = async () => {
    if (!contaId) return setErro("Escolha a conta-caixa.");
    setSalvando(true); setErro("");
    try {
      const d = await api("/api/fin/lancamentos/identificar", "POST", {
        usuarioId: user.id, ids: itens.map((l) => l.id), contaId, identificacao: um ? ident : undefined,
        regras: criarRegra ? marcadas.map((x) => ({ termo: x.termo, banco: soBanco ? x.banco : null, dc: soSinal ? x.sinal : null, usos: x.itens.length })) : [],
      });
      onSalvo(d);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <Modal titulo={um ? "Identificar lançamento" : `Identificar ${itens.length} lançamentos`} icone={Tag} onClose={onClose} largura={um ? 560 : 720}>
      <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: C.panel2 }}>
        {um ? (
          <>
            <div className="font-semibold mb-1">{um.historico}</div>
            <div style={{ color: C.sub }}>{um.banco} · {dBR(um.data)}{um.documento ? ` · doc ${um.documento}` : ""} · <b style={{ color: corValor(um.valor) }}>R$ {brl(um.valor)}</b></div>
          </>
        ) : (
          <div>{itens.length} lançamentos · {linhas.length} histórico(s) diferente(s) · soma <b style={{ color: corValor(soma) }}>R$ {brl(soma)}</b></div>
        )}
      </div>
      <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Conta-caixa *</div>
      <ContaPicker contas={contas} value={contaId} onChange={setContaId} autoFocus />
      {um && (
        <>
          <div className="text-xs font-semibold mb-1 mt-3" style={{ color: C.sub }}>Identificação (opcional)</div>
          <input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="EX.: NF 1234 / PEDIDO 26070040"
            className="w-full px-3 py-2 rounded-lg text-sm uppercase" style={{ border: `1px solid ${C.line}` }} />
        </>
      )}
      <div className="rounded-lg p-3 mt-4" style={{ border: `1px dashed ${C.line}` }}>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={criarRegra} onChange={(e) => setCriarRegra(e.target.checked)} />
          <Wand2 size={14} style={{ color: C.accent }} /> Salvar como palavra-chave {linhas.length > 1 ? `(${marcadas.length} de ${linhas.length})` : ""} — entra no topo da prioridade
        </label>
        {criarRegra && (
          <>
            <div className="text-[11px] mt-2 mb-2" style={{ color: C.sub }}>
              Sempre que o histórico contiver o texto, usar esta conta. Deixe só a parte que identifica (ex.: o nome do cliente ou fornecedor). Várias palavras na mesma linha: separe com ponto e vírgula.
            </div>
            {linhas.length > 1 && (
              <label className="flex items-center gap-2 text-[11px] mb-1 cursor-pointer" style={{ color: C.sub }}>
                <input type="checkbox" checked={todasOn} onChange={(e) => setLinhas((ls) => ls.map((x) => ({ ...x, on: e.target.checked })))} /> Marcar / desmarcar todas
              </label>
            )}
            <div className="flex flex-col gap-1.5 overflow-auto" style={{ maxHeight: 300 }}>
              {linhas.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  {linhas.length > 1 && <input type="checkbox" checked={x.on} onChange={(e) => setLinha(i, { on: e.target.checked })} />}
                  <input value={x.termo} onChange={(e) => setLinha(i, { termo: e.target.value.toUpperCase() })} disabled={!x.on}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs uppercase font-mono" style={{ border: `1px solid ${C.line}`, opacity: x.on ? 1 : 0.45 }} />
                  {linhas.length > 1 && (
                    <span className="text-[10px] text-right shrink-0" style={{ color: C.sub, width: 120 }} title={x.itens.map((l) => `${dBR(l.data)} ${l.historico} ${brl(l.valor)}`).join("\n")}>
                      {x.itens.length} lanç. · <b style={{ color: corValor(x.soma) }}>{brl(x.soma)}</b>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs mt-3 cursor-pointer" style={{ color: C.sub }}>
              <input type="checkbox" checked={soBanco} onChange={(e) => setSoBanco(e.target.checked)} /> Valer só para o banco de cada lançamento{um ? ` (${um.banco})` : ""}
            </label>
            <label className="flex items-center gap-2 text-xs mt-1 cursor-pointer" style={{ color: C.sub }}>
              <input type="checkbox" checked={soSinal} onChange={(e) => setSoSinal(e.target.checked)} /> Valer só para o mesmo sentido (entrada ou saída) de cada lançamento
            </label>
          </>
        )}
      </div>
      {erro && <div className="text-xs mt-3" style={{ color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.green, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Salvando…" : criarRegra && marcadas.length ? `Identificar e salvar ${marcadas.length} palavra(s)-chave` : "Identificar"}
        </button>
      </div>
    </Modal>
  );
}

function EditarLancModal({ user, comp, lanc, bancos, contas, onClose, onSalvo }) {
  const novo = !lanc;
  const [f, setF] = useState(() => lanc ? { ...lanc, valor: String(lanc.valor).replace(".", ",") } : {
    banco: bancos[0] || "", data: `${comp}-01`, historico: "", documento: "", identificacao: "", valor: "", contaId: null,
  });
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    const valor = Number(String(f.valor).replace(/\./g, "").replace(",", "."));
    if (!f.banco || !f.data || !f.historico || !valor) return setErro("Preencha banco, data, histórico e valor (use - para saída).");
    try {
      const body = { usuarioId: user.id, banco: f.banco, data: f.data, historico: f.historico, documento: f.documento, identificacao: f.identificacao, valor };
      if (novo) await api("/api/fin/lancamentos", "POST", { ...body, competencia: comp, contaId: f.contaId });
      else await api(`/api/fin/lancamentos/${lanc.id}`, "PATCH", { ...body, ...(f.contaId !== lanc.contaId ? { contaId: f.contaId } : {}) });
      onSalvo();
    } catch (e) { setErro(e.message); }
  };
  const inp = "w-full px-3 py-2 rounded-lg text-sm";
  const st = { border: `1px solid ${C.line}` };
  return (
    <Modal titulo={novo ? "Novo lançamento" : "Editar lançamento"} icone={Pencil} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Banco</div>
          <input list="fin-bancos" value={f.banco} onChange={(e) => set("banco", e.target.value.toUpperCase())} className={inp} style={st} />
          <datalist id="fin-bancos">{bancos.map((b) => <option key={b} value={b} />)}<option value="CAIXA FÍSICO" /></datalist>
        </div>
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Data</div>
          <input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} style={st} />
        </div>
        <div className="col-span-2">
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Histórico</div>
          <input value={f.historico} onChange={(e) => set("historico", e.target.value)} className={inp + " uppercase"} style={st} />
        </div>
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Documento</div>
          <input value={f.documento || ""} onChange={(e) => set("documento", e.target.value)} className={inp} style={st} />
        </div>
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Valor (− para saída)</div>
          <input value={f.valor} onChange={(e) => set("valor", e.target.value)} placeholder="-1.234,56" className={inp + " text-right"} style={st} />
        </div>
        <div className="col-span-2">
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Identificação</div>
          <input value={f.identificacao || ""} onChange={(e) => set("identificacao", e.target.value)} className={inp + " uppercase"} style={st} />
        </div>
        <div className="col-span-2">
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Conta-caixa</div>
          <ContaPicker contas={contas.filter((c) => c.ativo)} value={f.contaId} onChange={(v) => set("contaId", v)} />
        </div>
      </div>
      {erro && <div className="text-xs mt-3" style={{ color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2 }}>Cancelar</button>
        <button onClick={salvar} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
      </div>
    </Modal>
  );
}

function DesmembrarModal({ user, lanc, contas, onClose, onSalvo }) {
  const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
  const [partes, setPartes] = useState([{ valor: fmt(lanc.valor), contaId: lanc.contaId, historico: "" }, { valor: "", contaId: null, historico: "" }]);
  const [erro, setErro] = useState("");
  const n = (v) => Number(String(v || "").replace(/\./g, "").replace(",", ".")) || 0;
  const soma = partes.reduce((a, p) => a + n(p.valor), 0);
  const resto = Math.round((lanc.valor - soma) * 100) / 100;
  const set = (i, k, v) => setPartes((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const salvar = async () => {
    try {
      await api(`/api/fin/lancamentos/${lanc.id}/desmembrar`, "POST", { usuarioId: user.id, partes: partes.map((p) => ({ ...p, valor: n(p.valor) })) });
      onSalvo();
    } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo="Desmembrar lançamento" icone={Scissors} onClose={onClose} largura={720}>
      <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: C.panel2 }}>
        <div className="font-semibold mb-1">{lanc.historico}</div>
        <div style={{ color: C.sub }}>{lanc.banco} · {dBR(lanc.data)} · total <b style={{ color: corValor(lanc.valor) }}>R$ {brl(lanc.valor)}</b></div>
      </div>
      {partes.map((p, i) => (
        <div key={i} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: "110px 1fr 1fr 28px" }}>
          <input value={p.valor} onChange={(e) => set(i, "valor", e.target.value)} placeholder="Valor" className="px-2 py-2 rounded-lg text-sm text-right" style={{ border: `1px solid ${C.line}` }} />
          <ContaPicker contas={contas} value={p.contaId} onChange={(v) => set(i, "contaId", v)} />
          <input value={p.historico} onChange={(e) => set(i, "historico", e.target.value)} placeholder="Histórico (opcional)" className="px-2 py-2 rounded-lg text-sm uppercase" style={{ border: `1px solid ${C.line}` }} />
          <button onClick={() => setPartes((ps) => ps.filter((_, j) => j !== i))} disabled={partes.length <= 2} style={{ color: C.sub, opacity: partes.length <= 2 ? 0.3 : 1 }}><X size={16} /></button>
        </div>
      ))}
      <div className="flex items-center justify-between mt-2">
        <button onClick={() => setPartes((ps) => [...ps, { valor: resto ? fmt(resto) : "", contaId: null, historico: "" }])} className="flex items-center gap-1 text-sm font-medium" style={{ color: C.accent }}>
          <Plus size={14} /> Adicionar parte
        </button>
        <div className="text-sm" style={{ color: Math.abs(resto) < 0.005 ? C.green : C.red }}>
          {Math.abs(resto) < 0.005 ? "Soma confere ✓" : `Falta distribuir R$ ${brl(resto)}`}
        </div>
      </div>
      {erro && <div className="text-xs mt-3" style={{ color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2 }}>Cancelar</button>
        <button onClick={salvar} disabled={Math.abs(resto) >= 0.005} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: Math.abs(resto) >= 0.005 ? 0.5 : 1 }}>Desmembrar</button>
      </div>
    </Modal>
  );
}

/* ---------------- PLANO DE CONTAS ---------------- */
function PlanoContas({ user }) {
  const [lista, setLista] = useState([]);
  const [novo, setNovo] = useState({ codigo: "", nome: "" });
  const [edit, setEdit] = useState({});
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const carregar = async () => { const r = await fetch(`/api/fin/contas?u=${user.id}`); setLista(await r.json().catch(() => [])); };
  useEffect(() => { carregar(); }, []);
  const add = async () => {
    setErro("");
    try { await api("/api/fin/contas", "POST", { usuarioId: user.id, ...novo }); setNovo({ codigo: "", nome: "" }); carregar(); } catch (e) { setErro(e.message); }
  };
  const salvar = async (c, patch) => {
    try { await api(`/api/fin/contas/${c.id}`, "PATCH", { usuarioId: user.id, ...patch }); setEdit((e) => { const n = { ...e }; delete n[c.id]; return n; }); carregar(); } catch (e) { alert(e.message); }
  };
  const nat = (cod) => cod[0] === "1" ? ["RECEITA", C.green] : cod[0] === "2" ? ["DESPESA", C.red] : ["CONCILIAÇÃO", ROXO];
  const vis = lista.filter((c) => !busca || c.codigo.includes(busca) || normC(c.nome).includes(normC(busca)));
  return (
    <div className="max-w-3xl">
      <div className="text-sm mb-4" style={{ color: C.sub }}>
        Contas-caixa usadas na identificação. Código começando com <b style={{ color: C.green }}>1</b> = receita, <b style={{ color: C.red }}>2</b> = despesa, <b style={{ color: ROXO }}>3</b> = conciliação. Contas inativas não aparecem na hora de identificar. Os grupos do DRE virão em uma próxima etapa.
      </div>
      <div className="rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div style={{ width: 130 }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Código</div>
          <input value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} placeholder="2112400" className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <div className="flex-1" style={{ minWidth: 200 }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Nome</div>
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm uppercase" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <button onClick={add} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Adicionar</button>
        {erro && <div className="w-full text-xs" style={{ color: C.red }}>{erro}</div>}
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conta…" className="px-3 py-2 rounded-lg text-sm mb-3" style={{ border: `1px solid ${C.line}`, width: 260 }} />
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {vis.map((c) => {
          const [nt, cor] = nat(c.codigo);
          const e = edit[c.id];
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid ${C.line}`, opacity: c.ativo ? 1 : 0.5 }}>
              {e ? (
                <>
                  <input value={e.codigo} onChange={(ev) => setEdit({ ...edit, [c.id]: { ...e, codigo: ev.target.value } })} className="px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, width: 100 }} />
                  <input value={e.nome} onChange={(ev) => setEdit({ ...edit, [c.id]: { ...e, nome: ev.target.value } })} className="flex-1 px-2 py-1 rounded text-sm uppercase" style={{ border: `1px solid ${C.line}` }} />
                  <button onClick={() => salvar(c, e)} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
                  <button onClick={() => setEdit((x) => { const n = { ...x }; delete n[c.id]; return n; })} style={{ color: C.sub }}><X size={15} /></button>
                </>
              ) : (
                <>
                  <div className="font-mono font-semibold text-sm" style={{ color: cor, width: 80 }}>{c.codigo}</div>
                  <div className="flex-1 text-sm">{c.nome}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: cor, background: C.panel2 }}>{nt}</span>
                  <button onClick={() => setEdit({ ...edit, [c.id]: { codigo: c.codigo, nome: c.nome } })} style={{ color: C.sub }} title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => salvar(c, { ativo: !c.ativo })} className="text-xs" style={{ color: C.sub }}>{c.ativo ? "Inativar" : "Ativar"}</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- PALAVRAS-CHAVE (REGRAS) ---------------- */
const CMP_TXT = { CONTEM: "Contém", INICIA: "Começa com", TERMINA: "Termina com", IGUAL: "Igual a" };
const CAMPO_TXT = { TODOS: "Todos", HISTORICO: "Histórico", IDENTIFICACAO: "Identificação" };
const BANCOS_FIN = ["BRADESCO PJ", "ITAU PJ", "INTER PJ", "C6BANK EXTRATO", "BB PJ", "CAIXA PJ"];

function Regras({ user, comp }) {
  const [lista, setLista] = useState(null);
  const [contas, setContas] = useState([]);
  const [busca, setBusca] = useState("");
  const [fConta, setFConta] = useState("");
  const [fAtivo, setFAtivo] = useState("todas");
  const [modal, setModal] = useState(null); // null | {} (nova) | regra
  const carregar = async () => {
    const [r, c] = await Promise.all([fetch(`/api/fin/regras?u=${user.id}`), fetch(`/api/fin/contas?u=${user.id}`)]);
    const d = await r.json().catch(() => []); setLista(Array.isArray(d) ? d : []);
    const dc = await c.json().catch(() => []); setContas(Array.isArray(dc) ? dc : []);
  };
  useEffect(() => { carregar(); }, []);

  const patch = async (r, body) => { await api(`/api/fin/regras/${r.id}`, "PATCH", { usuarioId: user.id, ...body }); carregar(); };
  const del = async (r) => { if (!confirm(`Excluir a palavra-chave "${r.termo}"?`)) return; await fetch(`/api/fin/regras/${r.id}?u=${user.id}`, { method: "DELETE" }); carregar(); };

  const filtradas = !lista ? [] : lista.map((r, i) => ({ ...r, pos: i + 1 })).filter((r) => {
    if (fAtivo === "ativas" && !r.ativo) return false;
    if (fAtivo === "inativas" && r.ativo) return false;
    if (fConta && String(r.contaId) !== fConta) return false;
    const b = normC(busca);
    if (b && !normC(`${r.termo} ${r.descricao || ""} ${r.conta?.codigo} ${r.conta?.nome}`).includes(b)) return false;
    return true;
  });
  const sel2 = { border: `1px solid ${C.line}`, background: C.panel, color: C.text };
  const inativas = lista ? lista.filter((r) => !r.ativo).length : 0;

  return (
    <div>
      <div className="text-sm mb-4" style={{ color: C.sub, maxWidth: 900 }}>
        Ao ler um extrato, cada lançamento sem conta é comparado com as palavras-chave <b>na ordem abaixo</b>: a primeira que casar define a conta-caixa.
        Por isso as mais específicas (nome de fornecedor) devem ficar acima das genéricas (TARIFA, JUROS…). Identificações feitas à mão nunca são alteradas.
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setModal({})} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={15} /> Nova palavra-chave
        </button>
        <div className="flex items-center rounded-lg px-2" style={sel2}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar palavra, descrição, conta…" className="px-2 py-1.5 text-sm" style={{ outline: "none", width: 240 }} />
        </div>
        <select value={fConta} onChange={(e) => setFConta(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm" style={{ ...sel2, maxWidth: 260 }}>
          <option value="">Todas as contas</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
        </select>
        <select value={fAtivo} onChange={(e) => setFAtivo(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm" style={sel2}>
          <option value="todas">Ativas e inativas</option><option value="ativas">Só ativas</option><option value="inativas">Só inativas{inativas ? ` (${inativas})` : ""}</option>
        </select>
        {lista && <div className="ml-auto text-xs" style={{ color: C.sub }}>{filtradas.length} de {lista.length} palavras-chave</div>}
      </div>

      {!lista && <div style={{ color: C.sub }}>Carregando…</div>}
      {lista && (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 1050 }}>
            <thead style={{ borderBottom: `2px solid ${C.line}` }}>
              <tr className="text-[11px] uppercase" style={{ color: C.navy }}>
                <th className="px-2 py-2 text-left" style={{ width: 78 }}>Prioridade</th>
                <th className="px-2 py-2 text-left">Descrição</th>
                <th className="px-2 py-2 text-left">Comparar</th>
                <th className="px-2 py-2 text-left">Palavras-chave</th>
                <th className="px-2 py-2 text-left">Campo</th>
                <th className="px-2 py-2 text-left">Banco</th>
                <th className="px-2 py-2 text-center">D/C</th>
                <th className="px-2 py-2 text-left">Conta-caixa</th>
                <th className="px-2 py-2 text-right">Usos</th>
                <th className="px-2 py-2 text-center">Ativa</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.line}`, opacity: r.ativo ? 1 : 0.5 }}>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <span className="font-mono" style={{ color: C.sub, width: 28 }}>{r.pos}</span>
                      <button title="Subir" onClick={() => patch(r, { mover: "cima" })} style={{ color: C.sub }}><ChevronUp size={14} /></button>
                      <button title="Descer" onClick={() => patch(r, { mover: "baixo" })} style={{ color: C.sub }}><ChevronDown size={14} /></button>
                      <button title="Mandar para o topo" onClick={() => patch(r, { mover: "topo" })} style={{ color: C.sub }}><ChevronsUp size={14} /></button>
                    </div>
                  </td>
                  <td className="px-2 py-1">{r.descricao}{r.origem === "BASE" && <span className="ml-1 text-[9px] px-1 rounded" style={{ background: C.panel2, color: C.sub }}>base</span>}</td>
                  <td className="px-2 py-1" style={{ color: C.sub }}>{CMP_TXT[r.comparar]}</td>
                  <td className="px-2 py-1 font-mono font-semibold">{r.termo.split(";").map((t, i) => <span key={i} className="inline-block mr-1 mb-0.5 px-1.5 rounded" style={{ background: C.accentSoft }}>{t}</span>)}</td>
                  <td className="px-2 py-1" style={{ color: C.sub }}>{CAMPO_TXT[r.campo]}</td>
                  <td className="px-2 py-1" style={{ color: C.sub }}>{r.banco || "Todos"}</td>
                  <td className="px-2 py-1 text-center font-bold" style={{ color: r.dc === "D" ? C.red : r.dc === "C" ? C.blue : C.sub }}>{r.dc || "—"}</td>
                  <td className="px-2 py-1 font-semibold" style={{ color: corConta(r.conta) }}>
                    {r.conta?.codigo} · {r.conta?.nome}{r.conta && !r.conta.ativo && <span className="ml-1 text-[9px] px-1 rounded" style={{ background: C.redSoft, color: C.red }}>conta inativa</span>}
                  </td>
                  <td className="px-2 py-1 text-right" style={{ color: C.sub }}>{r.usos}</td>
                  <td className="px-2 py-1 text-center"><input type="checkbox" checked={r.ativo} onChange={(e) => patch(r, { ativo: e.target.checked })} /></td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end gap-1">
                      <IconBtn t="Editar" onClick={() => setModal(r)}><Pencil size={13} /></IconBtn>
                      <IconBtn t="Excluir" onClick={() => del(r)}><Trash2 size={13} /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <RegraModal user={user} comp={comp} regra={modal.id ? modal : null} contas={contas}
        onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />}
    </div>
  );
}

function RegraModal({ user, comp, regra, contas, onClose, onSalvo }) {
  const [f, setF] = useState(() => regra ? { ...regra } : { descricao: "", comparar: "CONTEM", termo: "", campo: "TODOS", banco: "", dc: "", contaId: null, ativo: true });
  const [erro, setErro] = useState("");
  const [teste, setTeste] = useState(null);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setTeste(null); };
  const corpo = () => ({ descricao: f.descricao, comparar: f.comparar, termo: f.termo, campo: f.campo, banco: f.banco || null, dc: f.dc || null, contaId: f.contaId, ativo: f.ativo });
  const salvar = async () => {
    if (!f.termo.trim() || !f.contaId) return setErro("Informe a palavra-chave e a conta-caixa.");
    try {
      if (regra) await api(`/api/fin/regras/${regra.id}`, "PATCH", { usuarioId: user.id, ...corpo() });
      else await api("/api/fin/regras", "POST", { usuarioId: user.id, ...corpo() });
      onSalvo();
    } catch (e) { setErro(e.message); }
  };
  const testar = async () => {
    if (!f.termo.trim()) return;
    try { setTeste(await api("/api/fin/regras/testar", "POST", { usuarioId: user.id, competencia: comp, regra: corpo() })); } catch (e) { setErro(e.message); }
  };
  const inp = "w-full px-3 py-2 rounded-lg text-sm";
  const st = { border: `1px solid ${C.line}`, background: C.panel };
  const Rot = ({ children }) => <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>{children}</div>;
  return (
    <Modal titulo={regra ? "Editar palavra-chave" : "Nova palavra-chave"} icone={Wand2} onClose={onClose} largura={680}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Rot>Palavras-chave * <span className="font-normal">(várias: separe com ;)</span></Rot>
          <input autoFocus value={f.termo} onChange={(e) => set("termo", e.target.value.toUpperCase())} placeholder="EX.: DOPTEX;TECELAGEM SAO JOAO" className={inp + " font-mono"} style={st} />
        </div>
        <div className="col-span-2">
          <Rot>Conta-caixa *</Rot>
          <ContaPicker contas={contas.filter((c) => c.ativo || c.id === f.contaId)} value={f.contaId} onChange={(v) => set("contaId", v)} />
        </div>
        <div>
          <Rot>Comparar</Rot>
          <select value={f.comparar} onChange={(e) => set("comparar", e.target.value)} className={inp} style={st}>
            {Object.entries(CMP_TXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <div>
          <Rot>Procurar em</Rot>
          <select value={f.campo} onChange={(e) => set("campo", e.target.value)} className={inp} style={st}>
            {Object.entries(CAMPO_TXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <div>
          <Rot>Banco</Rot>
          <select value={f.banco || ""} onChange={(e) => set("banco", e.target.value)} className={inp} style={st}>
            <option value="">Todos</option>{BANCOS_FIN.map((b) => <option key={b}>{b}</option>)}
            {f.banco && !BANCOS_FIN.includes(f.banco) && <option>{f.banco}</option>}
          </select>
        </div>
        <div>
          <Rot>Débito / Crédito</Rot>
          <select value={f.dc || ""} onChange={(e) => set("dc", e.target.value)} className={inp} style={st}>
            <option value="">Ambos</option><option value="D">Só saídas (D)</option><option value="C">Só entradas (C)</option>
          </select>
        </div>
        <div className="col-span-2">
          <Rot>Descrição (opcional)</Rot>
          <input value={f.descricao || ""} onChange={(e) => set("descricao", e.target.value)} className={inp + " uppercase"} style={st} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativa</label>
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ border: `1px dashed ${C.line}` }}>
        <div className="flex items-center justify-between">
          <div className="text-xs" style={{ color: C.sub }}>Veja quais lançamentos de {nomeComp(comp)} esta palavra-chave pegaria.</div>
          <button onClick={testar} className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold" style={{ background: C.navy, color: "#fff" }}><FlaskConical size={13} /> Testar</button>
        </div>
        {teste && (
          <div className="mt-2">
            <div className="text-xs font-semibold mb-1">{teste.total} lançamento(s) · {teste.semConta} ainda sem conta</div>
            <div className="overflow-auto" style={{ maxHeight: 180 }}>
              {teste.itens.map((l) => (
                <div key={l.id} className="flex gap-2 text-[11px] py-0.5" style={{ borderBottom: `1px solid ${C.panel2}` }}>
                  <span style={{ width: 90, color: C.sub }}>{l.banco}</span><span style={{ width: 70, color: C.sub }}>{dBR(l.data)}</span>
                  <span className="flex-1 truncate">{l.historico}</span>
                  <span style={{ color: corValor(l.valor), width: 80, textAlign: "right" }}>{brl(l.valor)}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] mt-1" style={{ color: C.sub }}>Obs.: na leitura vale a prioridade — se uma palavra-chave acima casar antes, ela vence.</div>
          </div>
        )}
      </div>

      {erro && <div className="text-xs mt-3" style={{ color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2 }}>Cancelar</button>
        <button onClick={salvar} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
      </div>
    </Modal>
  );
}

/* ============================================================
   CONTABILIDADE — pacote mensal de documentos
   ============================================================ */
const MESES_AB = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const mesAnoCurto = (c) => { const [a, m] = String(c || "").split("-"); return `${MESES_AB[Number(m) - 1] || "?"} ${String(a).slice(2)}`; };

function Contabilidade({ user, comp, setComp, irRecebimentos }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const carregar = async () => {
    setErro("");
    try {
      const r = await fetch(`/api/fin/contab?u=${user.id}&competencia=${comp}`);
      const j = await r.json();
      if (!r.ok) { setErro(j.error || "Erro ao carregar."); setD(null); return; }
      setD(j); setEmail(j.email || "");
    } catch { setErro("Falha de conexão."); }
  };
  useEffect(() => { setD(null); setAviso(null); carregar(); }, [comp]);

  const subir = async (categoria, tipoId, files) => {
    const itens = Array.from(files || []);
    if (!itens.length) return;
    let ok = 0; const problemas = [];
    for (const f of itens) {
      const b64 = await readB64(f);
      const r = await fetch("/api/fin/contab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, competencia: comp, categoria, tipoId, nome: f.name, conteudo: b64 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok && j.error) { problemas.push(`${f.name}: ${j.error}`); continue; }
      (j.resultados || []).forEach((x) => { if (x.ok) ok++; else problemas.push(`${x.nome}: ${x.erro}`); });
    }
    setAviso({ tipo: problemas.length ? "erro" : "ok", texto: `${ok} arquivo(s) guardado(s).${problemas.length ? " Problemas: " + problemas.join(" · ") : ""}` });
    carregar();
  };

  const excluir = async (doc) => {
    if (!confirm(`Excluir ${doc.nome} do pacote da contabilidade?`)) return;
    await fetch(`/api/fin/contab/${doc.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  const gerarRecebimentos = async () => {
    const r = await fetch(`/api/fin/recebimentos/xlsx?u=${user.id}&competencia=${comp}&salvar=1`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setAviso({ tipo: "erro", texto: j.error || "Gere a planilha na guia Recebimentos primeiro." }); return; }
    setAviso({ tipo: "ok", texto: `Planilha de recebimentos guardada (${j.linhas} linha(s)).` });
    carregar();
  };

  const salvarEmail = async () => {
    await fetch("/api/fin/contab", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, email }) });
    carregar();
  };

  const enviar = async () => {
    if (!email) { setAviso({ tipo: "erro", texto: "Preencha o e-mail da contabilidade." }); return; }
    if (!confirm(`Enviar ${docs.length} arquivo(s) de ${nomeComp(comp)} para ${email}?`)) return;
    setEnviando(true);
    const r = await fetch("/api/fin/contab/enviar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, competencia: comp, email, mensagem: msg }),
    });
    const j = await r.json().catch(() => ({}));
    setEnviando(false);
    setAviso(r.ok ? { tipo: "ok", texto: `Enviado para ${email}: ${j.arquivos} arquivo(s), ${kb(j.tamanho)}.` } : { tipo: "erro", texto: j.error || "Erro no envio." });
    carregar();
  };

  const docs = d?.docs || [];
  const doExtrato = (tipoId, formato) => docs.find((x) => x.categoria === "EXTRATO" && x.tipoId === tipoId && x.formato === formato) || null;
  const daCategoria = (k) => docs.filter((x) => x.categoria === k);

  const faltaExtrato = (d?.bancos || []).filter((b) => !doExtrato(b.id, "PDF") || !doExtrato(b.id, "OFX")).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <SeletorMes comp={comp} setComp={setComp} />
        {d && (
          <div className="flex flex-wrap gap-2">
            <Pilula cor={C.green} bg={C.greenSoft} txt={`${docs.length} arquivo(s) no pacote`} />
            {faltaExtrato > 0 && <Pilula cor={C.red} bg={C.redSoft} txt={`${faltaExtrato} banco(s) sem PDF ou OFX`} />}
            {d.notasSaida > 0 && <Pilula cor={C.blue} bg={C.blueSoft} txt={`${d.notasSaida} nota(s) de saída lida(s)`} />}
          </div>
        )}
      </div>

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && (
        <div className="p-3 rounded mb-4 flex items-start gap-2 text-sm"
          style={{ background: aviso.tipo === "ok" ? C.greenSoft : C.redSoft, color: aviso.tipo === "ok" ? C.green : C.red }}>
          <div className="flex-1">{aviso.texto}</div>
          <button onClick={() => setAviso(null)}><X size={14} /></button>
        </div>
      )}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {d && (
        <>
          <div className="rounded-xl p-3 mb-6 text-xs flex items-start gap-2" style={{ background: C.blueSoft, color: C.text }}>
            <HelpCircle size={15} className="shrink-0 mt-0.5" style={{ color: C.blue }} />
            <div>
              O <b>PDF do extrato</b> chega sozinho quando você envia na guia <b>Importação</b> — aqui ele aparece já renomeado no padrão
              (<b>EXTRATO BRADESCO {mesAnoCurto(comp)} PDF</b>). O <b>OFX</b> pode ser enviado aqui ou lá no mesmo card.
              Os <b>XMLs das notas de saída</b> alimentam o cruzamento da guia Recebimentos.
            </div>
          </div>

          {/* ---- extratos ---- */}
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>EXTRATOS · PDF + OFX POR BANCO</div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {d.bancos.map((b) => (
              <CardContabExtrato key={b.id} banco={b} user={user} comp={comp}
                pdf={doExtrato(b.id, "PDF")} ofx={doExtrato(b.id, "OFX")}
                onSubir={(fs) => subir("EXTRATO", b.id, fs)} onExcluir={excluir} />
            ))}
          </div>

          {/* ---- outros documentos ---- */}
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>DEMAIS DOCUMENTOS DO MÊS</div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {d.categorias.map((cat) => (
              <CardContabCategoria key={cat.k} cat={cat} user={user} docs={daCategoria(cat.k)}
                onSubir={(fs) => subir(cat.k, null, fs)} onExcluir={excluir}
                acao={cat.k === "RECEBIMENTOS" ? { txt: "Gerar da guia Recebimentos", fn: gerarRecebimentos, ver: irRecebimentos } : null} />
            ))}
          </div>

          {/* ---- envio ---- */}
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${C.accent}` }}>
            <div className="font-semibold flex items-center gap-2 mb-1" style={{ color: C.text }}>
              <Send size={16} style={{ color: C.accent }} /> Enviar o pacote para a contabilidade
            </div>
            <div className="text-xs mb-3" style={{ color: C.sub }}>
              Um ZIP com tudo deste mês, organizado em pastas: <b>CONTABILIDADE MERIDIAN {mesAnoCurto(comp)}.zip</b>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div style={{ minWidth: 280 }}>
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>E-mail da contabilidade</div>
                <div className="flex gap-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={salvarEmail}
                    placeholder="contabilidade@escritorio.com.br" type="email"
                    className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
                </div>
              </div>
              <div className="flex-1" style={{ minWidth: 260 }}>
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Recado no e-mail (opcional)</div>
                <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="EX.: FALTOU O EXTRATO DO INTER, CONTA SEM MOVIMENTO"
                  className="w-full rounded-lg px-3 py-2 text-sm uppercase" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
              </div>
              <a href={`/api/fin/contab/zip?u=${user.id}&competencia=${comp}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ border: `1px solid ${C.accent}`, color: C.accent, opacity: docs.length ? 1 : 0.4, pointerEvents: docs.length ? "auto" : "none" }}>
                <Download size={15} /> Baixar ZIP
              </a>
              <button onClick={enviar} disabled={enviando || !docs.length || !d.emailPronto}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: C.accent, color: "#fff", opacity: enviando || !docs.length || !d.emailPronto ? 0.5 : 1 }}>
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} {enviando ? "Enviando…" : "Enviar por e-mail"}
              </button>
            </div>

            {!d.emailPronto && (
              <div className="mt-3 p-2 rounded text-xs" style={{ background: C.yellowSoft, color: C.yellow }}>
                O envio por e-mail ainda não está ligado na VPS. Acrescente no <b>/opt/compras-e-estoque/.env</b>:
                <span className="font-mono"> RESEND_API_KEY=re_… </span> e
                <span className="font-mono"> RESEND_FROM=Meridian &lt;financeiro@seu-dominio.com.br&gt; </span>
                e suba os containers de novo. Enquanto isso, use <b>Baixar ZIP</b>.
              </div>
            )}

            {d.envios.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Envios deste mês</div>
                <div className="flex flex-col gap-1">
                  {d.envios.map((e) => (
                    <div key={e.id} className="text-[11px] flex flex-wrap items-center gap-2 rounded px-2 py-1" style={{ background: C.panel2 }}>
                      <span className="px-1.5 rounded font-semibold" style={{ background: e.status === "ENVIADO" ? C.greenSoft : C.redSoft, color: e.status === "ENVIADO" ? C.green : C.red }}>{e.status}</span>
                      <span style={{ color: C.text }}>{e.email}</span>
                      <span style={{ color: C.sub }}>{e.arquivos} arq · {kb(e.tamanho)} · {dataHora(e.createdAt)}{e.enviadoPorNome ? ` · ${e.enviadoPorNome}` : ""}</span>
                      {e.erro && <span style={{ color: C.red }}>{e.erro}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SlotArquivo({ doc, formato, user, onExcluir, onPedir, dica }) {
  const inp = useRef(null);
  return (
    <div className="rounded-lg px-2 py-1.5 flex items-center gap-2"
      style={{ background: doc ? C.panel2 : "transparent", border: doc ? "none" : `1px dashed ${C.line}` }}>
      {formato === "PDF" ? <FileText size={15} className="shrink-0" style={{ color: doc ? C.accent : C.sub }} />
        : <FileCode2 size={15} className="shrink-0" style={{ color: doc ? C.blue : C.sub }} />}
      {doc ? (
        <>
          <a href={`/api/fin/contab/${doc.id}?u=${user.id}`} target="_blank" rel="noopener" className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: C.text }} title={doc.nome}>{doc.nome}</div>
            <div className="text-[11px]" style={{ color: C.sub }}>
              {kb(doc.tamanho)} · {doc.arquivoId ? "cópia da Importação" : dataHora(doc.createdAt)}
            </div>
          </a>
          {podeImportar(user, "docsFinanceiros") && <button onClick={() => onExcluir(doc)} style={{ color: C.sub }}
            title={doc.arquivoId ? "Este PDF vem da guia Importação — se excluir aqui, ele volta quando a guia recarregar. Para tirar de vez, exclua na Importação." : "Excluir"}>
            <Trash2 size={14} />
          </button>}
        </>
      ) : !podeImportar(user, "docsFinanceiros") ? <span className="flex-1 text-xs" style={{ color: C.sub }}>{formato} não enviado</span> : (
        <>
          <input ref={inp} type="file" accept={formato === "PDF" ? ".pdf" : ".ofx"} className="hidden"
            onChange={(e) => { onPedir(e.target.files); e.target.value = ""; }} />
          <button onClick={() => inp.current?.click()} className="flex-1 text-left text-xs" style={{ color: C.sub }}>
            Enviar <b>{formato}</b>{dica ? ` · ${dica}` : ""}
          </button>
        </>
      )}
    </div>
  );
}

function CardContabExtrato({ banco, user, comp, pdf, ofx, onSubir, onExcluir }) {
  const n = (pdf ? 1 : 0) + (ofx ? 1 : 0);
  const st = n === 2 ? ["Completo", C.green, C.greenSoft, CheckCircle2] : n === 1 ? ["Falta 1", C.yellow, C.yellowSoft, AlertTriangle] : ["Pendente", C.red, C.redSoft, Clock];
  const Ico = st[3];
  return (
    <div className="rounded-xl flex flex-col" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${st[1]}` }}>
      <div className="p-4 pb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold" style={{ color: C.text }}>{banco.banco}</div>
          <div className="text-xs mt-0.5" style={{ color: C.sub }}>Extrato de conta corrente</div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0" style={{ color: st[1], background: st[2] }}>
          <Ico size={12} /> {st[0]}
        </span>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-1.5">
        <SlotArquivo doc={pdf} formato="PDF" user={user} onExcluir={onExcluir} onPedir={onSubir} dica="ou envie na Importação" />
        <SlotArquivo doc={ofx} formato="OFX" user={user} onExcluir={onExcluir} onPedir={onSubir} />
      </div>
    </div>
  );
}

function CardContabCategoria({ cat, user, docs, onSubir, onExcluir, acao }) {
  const inp = useRef(null);
  const [drag, setDrag] = useState(false);
  const ok = docs.length > 0;
  const aceita = cat.formatos.map((f) => "." + f.toLowerCase()).join(",");
  return (
    <div className="rounded-xl flex flex-col"
      style={{ background: C.panel, border: `1px solid ${drag ? C.accent : C.line}`, borderTop: `3px solid ${ok ? C.green : C.red}` }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (podeImportar(user, "docsFinanceiros")) onSubir(e.dataTransfer.files); }}>
      <div className="p-4 pb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold" style={{ color: C.text }}>{cat.label}</div>
          <div className="text-xs mt-0.5" style={{ color: C.sub }}>{cat.descricao}</div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
          style={{ color: ok ? C.green : C.red, background: ok ? C.greenSoft : C.redSoft }}>
          {ok ? <><CheckCircle2 size={12} /> {docs.length}</> : <><Clock size={12} /> Pendente</>}
        </span>
      </div>

      {docs.length > 0 && (
        <div className="px-4 pb-2 flex flex-col gap-1" style={{ maxHeight: 220, overflowY: "auto" }}>
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: C.panel2 }}>
              <Paperclip size={14} className="shrink-0" style={{ color: C.accent }} />
              <a href={`/api/fin/contab/${doc.id}?u=${user.id}`} target="_blank" rel="noopener" className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: C.text }} title={doc.nomeOriginal || doc.nome}>{doc.nome}</div>
                <div className="text-[11px]" style={{ color: C.sub }}>{kb(doc.tamanho)} · {dataHora(doc.createdAt)}</div>
              </a>
              {podeImportar(user, "docsFinanceiros") && <button onClick={() => onExcluir(doc)} title="Excluir" style={{ color: C.sub }}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pb-4 mt-auto flex flex-col gap-2">
        {podeImportar(user, "docsFinanceiros") && <>
        <input ref={inp} type="file" accept={aceita} multiple={cat.multiplo} className="hidden"
          onChange={(e) => { onSubir(e.target.files); e.target.value = ""; }} />
        <button onClick={() => inp.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
          style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: drag ? C.accentSoft : "transparent" }}>
          <Upload size={15} /> {docs.length ? "Enviar mais" : `Enviar ${cat.formatos.join(" / ")}`}
        </button>
        {cat.multiplo && <div className="text-[11px] text-center" style={{ color: C.sub }}>aceita vários arquivos ou um ZIP</div>}
        </>}
        {acao && (
          <div className="flex gap-2">
            <button onClick={acao.fn} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold"
              style={{ background: C.panel2, color: C.navy }}>
              <FileSpreadsheet size={13} /> {acao.txt}
            </button>
            <button onClick={acao.ver} className="px-3 rounded-lg text-xs font-semibold" style={{ background: C.panel2, color: C.sub }} title="Abrir a guia Recebimentos">
              <ChevR size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   RECEBIMENTOS — planilha editável (base dos impostos)
   ============================================================ */
const BLOCO_COR = { CREDITO: [C.blue, C.blueSoft], BOLETO: [C.green, C.greenSoft], CONFIRMAR: [C.yellow, C.yellowSoft] };

function Cel({ valor, tipo = "texto", largura, onSalvar, placeholder }) {
  const [v, setV] = useState(valor ?? "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setV(valor ?? ""); }, [valor]);
  const mudou = String(v ?? "") !== String(valor ?? "");
  const gravar = async () => {
    if (!mudou) return;
    setSalvando(true);
    await onSalvar(v);
    setSalvando(false);
  };
  return (
    <input
      value={v} onChange={(e) => setV(e.target.value)} onBlur={gravar}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setV(valor ?? ""); }}
      type={tipo === "data" ? "date" : "text"} placeholder={placeholder}
      className={`rounded px-1.5 py-1 text-xs w-full ${tipo === "valor" ? "text-right" : ""} ${tipo === "texto" ? "uppercase" : ""}`}
      style={{ width: largura, border: `1px solid ${mudou ? C.accent : "transparent"}`, background: salvando ? C.accentSoft : "transparent", color: C.text }} />
  );
}

function Recebimentos({ user, comp, setComp }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [ia, setIa] = useState(null);

  const carregar = async () => {
    setErro("");
    try {
      const r = await fetch(`/api/fin/recebimentos?u=${user.id}&competencia=${comp}`);
      const j = await r.json();
      if (!r.ok) { setErro(j.error || "Erro ao carregar."); setD(null); return; }
      setD(j);
    } catch { setErro("Falha de conexão."); }
  };
  useEffect(() => { setD(null); setAviso(null); carregar(); }, [comp]);

  const gerar = async () => {
    setOcupado("gerar");
    const r = await fetch("/api/fin/recebimentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, competencia: comp }) });
    const j = await r.json().catch(() => ({}));
    setOcupado("");
    if (!r.ok) { setAviso({ tipo: "erro", texto: j.error || "Erro ao gerar." }); return; }
    setD(j);
    setAviso({ tipo: "ok", texto: `${j.criadas} linha(s) geradas do extrato e das cobranças`
      + (j.preservadas ? ` · ${j.preservadas} linha(s) suas preservadas` : "")
      + (j.ignoradas ? ` · ${j.ignoradas} crédito(s) da própria Meridian (R$ ${brl(j.ignoradasValor)}) ficaram de fora: é conciliação entre contas, não recebimento` : "")
      + "." });
  };

  const novaLinha = async (bloco) => {
    const r = await fetch("/api/fin/recebimentos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, competencia: comp, bloco }) });
    if (r.ok) carregar();
  };

  const editar = async (id, campo, valor) => {
    const r = await fetch(`/api/fin/recebimentos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, campo, valor }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setAviso({ tipo: "erro", texto: j.error || "Erro ao salvar." }); return; }
    setD((x) => x && { ...x, linhas: x.linhas.map((l) => (l.id === id ? { ...l, ...j.linha } : l)) });
  };

  const excluir = async (l) => {
    if (!confirm(`Excluir a linha de ${brl(l.valor)}?`)) return;
    await fetch(`/api/fin/recebimentos/${l.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  const cruzar = async () => {
    setOcupado("ia");
    const r = await fetch("/api/fin/recebimentos/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, competencia: comp }) });
    const j = await r.json().catch(() => ({}));
    setOcupado("");
    if (!r.ok) { setAviso({ tipo: "erro", texto: j.error || "Erro na análise." }); return; }
    if (!j.sugestoes?.length) { setAviso({ tipo: "ok", texto: j.msg || "A IA não encontrou nada novo para cruzar." }); return; }
    setIa(j);
  };

  const guardar = async () => {
    setOcupado("guardar");
    const r = await fetch(`/api/fin/recebimentos/xlsx?u=${user.id}&competencia=${comp}&salvar=1`);
    const j = await r.json().catch(() => ({}));
    setOcupado("");
    setAviso(r.ok ? { tipo: "ok", texto: `Planilha guardada no pacote da contabilidade: ${j.doc?.nome || ""}` } : { tipo: "erro", texto: j.error || "Erro ao guardar." });
  };

  const porBloco = useMemo(() => {
    const m = {};
    (d?.linhas || []).forEach((l) => { (m[l.bloco] = m[l.bloco] || []).push(l); });
    return m;
  }, [d]);

  const semNf = (d?.linhas || []).filter((l) => l.bloco !== "CONFIRMAR" && !l.nf).length;
  const semCnpj = (d?.linhas || []).filter((l) => l.bloco !== "CONFIRMAR" && !l.cnpj).length;
  const totalConc = (d?.linhas || []).filter((l) => l.bloco !== "CONFIRMAR").reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SeletorMes comp={comp} setComp={setComp} />
        <button onClick={gerar} disabled={!d || !!ocupado}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: !d || ocupado ? 0.5 : 1 }}>
          {ocupado === "gerar" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Gerar do extrato e cobranças
        </button>
        <button onClick={cruzar} disabled={!d || !!ocupado || !d?.iaPronta || !d?.notasSaida}
          title={!d?.notasSaida ? "Envie os XMLs das notas de saída na guia Contabilidade" : !d?.iaPronta ? "Sem ANTHROPIC_API_KEY na VPS" : "Cruza valor recebido x NF x nome x CNPJ"}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ border: `1px solid ${C.accent}`, color: C.accent, opacity: !d || ocupado || !d?.iaPronta || !d?.notasSaida ? 0.4 : 1 }}>
          {ocupado === "ia" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Cruzar com a IA
        </button>
        <a href={`/api/fin/recebimentos/xlsx?u=${user.id}&competencia=${comp}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.panel2, color: C.navy, opacity: d?.linhas?.length ? 1 : 0.4, pointerEvents: d?.linhas?.length ? "auto" : "none" }}>
          <Download size={15} /> Baixar XLSX
        </a>
        <button onClick={guardar} disabled={!d?.linhas?.length || !!ocupado}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.panel2, color: C.navy, opacity: !d?.linhas?.length || ocupado ? 0.4 : 1 }}>
          {ocupado === "guardar" ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />} Guardar na contabilidade
        </button>
      </div>

      {d && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Pilula cor={C.navy} bg={C.panel2} txt={`${(d.linhas || []).length} linha(s) · R$ ${brl(totalConc)}`} />
          {d.notasSaida > 0
            ? <Pilula cor={C.blue} bg={C.blueSoft} txt={`${d.notasSaida} nota(s) de saída lida(s)`} />
            : <Pilula cor={C.yellow} bg={C.yellowSoft} txt="Nenhum XML de saída enviado" />}
          {semNf > 0 && <Pilula cor={C.red} bg={C.redSoft} txt={`${semNf} sem NF`} />}
          {semCnpj > 0 && <Pilula cor={C.yellow} bg={C.yellowSoft} txt={`${semCnpj} sem CNPJ`} />}
        </div>
      )}

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && (
        <div className="p-3 rounded mb-4 flex items-start gap-2 text-sm"
          style={{ background: aviso.tipo === "ok" ? C.greenSoft : C.redSoft, color: aviso.tipo === "ok" ? C.green : C.red }}>
          <div className="flex-1">{aviso.texto}</div>
          <button onClick={() => setAviso(null)}><X size={14} /></button>
        </div>
      )}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {d && !d.linhas.length && (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>
          Nenhuma linha em {nomeComp(comp)}. Clique em <b>Gerar do extrato e cobranças</b> — o sistema monta a planilha com os créditos de
          terceiros e os boletos recebidos. Depois envie os XMLs das saídas na guia <b>Contabilidade</b> e use <b>Cruzar com a IA</b>.
        </div>
      )}

      {d && (d.blocos || []).map((b) => {
        const ls = porBloco[b.k] || [];
        if (!ls.length && b.k === "CONFIRMAR") return null;
        const [cor, bg] = BLOCO_COR[b.k] || [C.sub, C.panel2];
        const soma = ls.reduce((s, l) => s + Number(l.valor), 0);
        return (
          <div key={b.k} className="mb-7">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: cor, background: bg }}>{b.label}</span>
              <span className="text-xs" style={{ color: C.sub }}>{ls.length} linha(s) · R$ {brl(soma)}</span>
              <div className="flex-1 h-px" style={{ background: C.line }} />
              <button onClick={() => novaLinha(b.k)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
                <Plus size={13} /> Nova linha
              </button>
            </div>
            <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 1020 }}>
                <thead>
                  <tr style={{ background: C.panel2, color: C.sub }}>
                    {["DATA", "TÍTULO", "VALOR (R$)", "NF", "NOME PAGADOR", "CNPJ", "OBS", ""].map((h, i) => (
                      <th key={i} className={`px-2 py-2 text-left font-semibold ${h === "VALOR (R$)" ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ls.map((l) => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="px-1 py-0.5" style={{ width: 120 }}>
                        <Cel valor={l.data ? String(l.data).slice(0, 10) : ""} tipo="data" onSalvar={(v) => editar(l.id, "data", v)} />
                      </td>
                      <td className="px-1 py-0.5" style={{ width: 190 }}>
                        <Cel valor={l.titulo} onSalvar={(v) => editar(l.id, "titulo", v)} placeholder="PIX" />
                      </td>
                      <td className="px-1 py-0.5" style={{ width: 110 }}>
                        <Cel valor={brl(l.valor)} tipo="valor" onSalvar={(v) => editar(l.id, "valor", v)} />
                      </td>
                      <td className="px-1 py-0.5" style={{ width: 110 }}>
                        <Cel valor={l.nf} onSalvar={(v) => editar(l.id, "nf", v)} placeholder="—" />
                      </td>
                      <td className="px-1 py-0.5">
                        <Cel valor={l.nomePagador} onSalvar={(v) => editar(l.id, "nomePagador", v)} placeholder="—" />
                      </td>
                      <td className="px-1 py-0.5" style={{ width: 150 }}>
                        <Cel valor={l.cnpj} onSalvar={(v) => editar(l.id, "cnpj", v)} placeholder="—" />
                      </td>
                      <td className="px-1 py-0.5" style={{ width: 200 }}>
                        <Cel valor={l.obs} onSalvar={(v) => editar(l.id, "obs", v)} placeholder="—" />
                      </td>
                      <td className="px-2 py-0.5 whitespace-nowrap" style={{ width: 70 }}>
                        {l.origem === "IA" && <Sparkles size={11} className="inline mr-1" style={{ color: ROXO }} title="Preenchido pela IA" />}
                        {l.origem === "MANUAL" && <Pencil size={11} className="inline mr-1" style={{ color: C.sub }} title="Linha manual" />}
                        {l.editado && l.origem === "AUTO" && <Pencil size={11} className="inline mr-1" style={{ color: C.accent }} title="Editado à mão — o gerar não sobrescreve" />}
                        <button onClick={() => excluir(l)} title="Excluir linha" style={{ color: C.sub }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.line}`, background: C.panel2 }}>
                    <td className="px-2 py-2 font-bold" style={{ color: C.navy }} colSpan={2}>TOTAL</td>
                    <td className="px-2 py-2 text-right font-bold" style={{ color: C.navy }}>R$ {brl(soma)}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {ia && <CruzarIAModal user={user} dados={ia} onClose={() => setIa(null)} onAplicado={(n) => { setIa(null); setAviso({ tipo: "ok", texto: `${n} linha(s) preenchida(s) pela IA.` }); carregar(); }} />}
    </div>
  );
}

function CruzarIAModal({ user, dados, onClose, onAplicado }) {
  const [marcados, setMarcados] = useState(() => new Set(dados.sugestoes.filter((s) => s.confianca === "ALTA").map((s) => s.id)));
  const [salvando, setSalvando] = useState(false);
  const alternar = (id) => setMarcados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const aplicar = async () => {
    const lista = dados.sugestoes.filter((s) => marcados.has(s.id));
    if (!lista.length) return;
    setSalvando(true);
    const r = await fetch("/api/fin/recebimentos/ia", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, aplicar: lista.map((s) => ({ id: s.id, nf: s.nf, nome: s.nome, cnpj: s.cnpj, obs: s.obs })) }),
    });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (r.ok) onAplicado(j.aplicadas || lista.length);
  };

  return (
    <Modal titulo="Cruzamento com a IA · valor recebido x nota fiscal" icone={Sparkles} onClose={onClose} largura={1000}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>
        {dados.analisadas} linha(s) analisada(s) · {dados.sugestoes.length} sugestão(ões). As de confiança <b>ALTA</b> já vêm marcadas. Confira antes de aplicar.
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.panel2, color: C.sub }}>
              <th className="px-2 py-2 w-8"></th>
              <th className="px-2 py-2 text-left font-semibold">Recebimento</th>
              <th className="px-2 py-2 text-left font-semibold">NF</th>
              <th className="px-2 py-2 text-left font-semibold">Pagador · CNPJ</th>
              <th className="px-2 py-2 text-left font-semibold">Por quê</th>
            </tr>
          </thead>
          <tbody>
            {dados.sugestoes.map((s) => {
              const [cor, bg] = CONF[s.confianca] || [C.sub, C.panel2];
              return (
                <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-2 py-2 align-top">
                    <input type="checkbox" checked={marcados.has(s.id)} onChange={() => alternar(s.id)} />
                  </td>
                  <td className="px-2 py-2 align-top" style={{ color: C.text }}>
                    <div className="font-semibold">R$ {brl(s.atual.valor)}</div>
                    <div style={{ color: C.sub }}>{dBR(String(s.atual.data || "").slice(0, 10))} · {s.atual.titulo || "—"}</div>
                    <div style={{ color: C.sub }}>{s.atual.nome || "—"}</div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="font-semibold" style={{ color: C.navy }}>{s.nf || "—"}</div>
                    <span className="px-1.5 rounded text-[10px] font-bold" style={{ color: cor, background: bg }}>{s.confianca}</span>
                  </td>
                  <td className="px-2 py-2 align-top" style={{ color: C.text }}>
                    <div>{s.nome || "—"}</div>
                    <div style={{ color: C.sub }}>{s.cnpj || "—"}</div>
                    {s.obs && <div style={{ color: C.yellow }}>{s.obs}</div>}
                  </td>
                  <td className="px-2 py-2 align-top" style={{ color: C.sub, maxWidth: 260 }}>{s.motivo || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={aplicar} disabled={salvando || !marcados.size}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: salvando || !marcados.size ? 0.5 : 1 }}>
          {salvando ? "Aplicando…" : `Aplicar ${marcados.size} linha(s)`}
        </button>
      </div>
    </Modal>
  );
}
