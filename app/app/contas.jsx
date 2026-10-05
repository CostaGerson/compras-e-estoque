"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { PrestadorModal } from "./prestadores";
import {
  Plus, X, Loader2, Upload, Repeat, Pencil, Trash2, CheckCircle2, Undo2, Search, ChevronLeft, ChevronRight,
  AlertTriangle, FileCode2, Hand, FileSpreadsheet, TrendingDown, TrendingUp, Ban, CalendarClock, Inbox, EyeOff, Grid3x3,
  Link2, ChevronDown, Wand2, Paperclip, FileText, Download, CheckSquare,
} from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41", roxo: "#7A5AF8", roxoSoft: "#F1EDFF",
};
// salário: o sábado conta como dia útil
const sabTxt = (r) => (r?.chaveOrigem === "MATRIZ|pessoal|SALARIO" || /^SAL[AÁ]RIO( |$)/.test(String(r?.titulo || "").toUpperCase()) ? " (com sábado)" : "");
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => "R$ " + brl(v);
const dBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const mesAtual = () => hojeISO().slice(0, 7);
const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nomeMes = (c) => { const [a, m] = c.split("-"); return `${MESES[Number(m) - 1]}/${a}`; };
const lerNum = (s) => { const t = String(s ?? "").trim().replace(/\s|R\$/g, ""); if (!t) return 0; const x = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t; const v = Number(x); return Number.isFinite(v) ? v : 0; };
const fmtDoc = (d) => { const s = String(d || "").replace(/\D/g, ""); if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); return s; };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(file); });
const fimDoMes = (c) => { const [a, m] = c.split("-").map(Number); return `${c}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; };
const somaDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); const x = new Date(a, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const PERIODOS = { 1: "Mensal", 2: "Bimestral", 3: "Trimestral", 4: "Quadrimestral", 6: "Semestral", 12: "Anual" };
const rotPeriodo = (n) => PERIODOS[Number(n) || 1] || `a cada ${n} meses`;
const ehSemana = (t) => t?.forma === "SEMANAL" || String(t?.chaveImport || "").startsWith("SEMANA|");
const FORMA = { MANUAL: ["Manual", Hand], NF_XML: ["Importação NF (XML)", FileCode2], EXCEL: ["Importação (planilha)", FileSpreadsheet], IMPORTACAO: ["Importação (posição de títulos)", FileSpreadsheet], RECORRENCIA: ["Recorrência", Repeat], SEMANAL: ["Conta da semana", CalendarClock] };
// toda conta que subiu por importação mostra "IMPORTAÇÃO" + a data em que subiu
const ehImportacao = (t) => ["NF_XML", "EXCEL", "IMPORTACAO"].includes(t.forma) || String(t.chaveImport || "").startsWith("POSICAO|");
const semRateio = (t) => !String(t.chaveImport || "").startsWith("SEMANA|") && !(t.rateio || []).some((r) => r.contaId && r.pct > 0);

function situacao(t) {
  if (t.status === "CANCELADO") return { k: "CANC", t: "Cancelado", c: C.sub, bg: C.panel2 };
  if (t.status === "PAGO") return { k: "PAGO", t: `Pago ${dBR(t.dataPagamento).slice(0, 5)}`, c: C.green, bg: C.greenSoft };
  if (t.vencimento < hojeISO()) return { k: "VENC", t: "Vencido", c: C.red, bg: C.redSoft };
  if (t.previsao) return { k: "PREV", t: "Previsão", c: C.roxo, bg: C.roxoSoft };
  return { k: "ABER", t: "Em aberto", c: C.blue, bg: C.blueSoft };
}

/* ---------- campos ---------- */
function Valor({ value, onChange, width = 130, autoFocus }) {
  const [foco, setFoco] = useState(false);
  const [txt, setTxt] = useState("");
  const num = lerNum(value);   // aceita número ou texto em pt-BR ("1.234,56")
  return (
    <div className="relative inline-flex items-center" style={{ width }}>
      <span className="absolute left-2 text-[10px]" style={{ color: C.sub }}>R$</span>
      <input autoFocus={autoFocus} value={foco ? txt : brl(num)} onFocus={(e) => { setFoco(true); setTxt(brl(num)); setTimeout(() => e.target.select(), 0); }}
        onChange={(e) => setTxt(e.target.value)} onBlur={() => { setFoco(false); onChange(lerNum(txt)); }} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        className="w-full text-right rounded px-2 py-1.5 text-sm outline-none" style={{ border: `1px solid ${C.line}`, paddingLeft: 24, color: C.text }} />
    </div>
  );
}
const inp = "w-full rounded px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
function Campo({ t, children, dica }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}{dica && <span className="font-normal"> · {dica}</span>}</div>
      {children}
    </label>
  );
}
function Chave({ on, set, t, cor = C.accent }) {
  return (
    <button type="button" onClick={() => set(!on)} className="flex items-center gap-2 text-sm">
      <span className="relative inline-block rounded-full transition-colors" style={{ width: 34, height: 19, background: on ? cor : "#C9CED6" }}>
        <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 15, height: 15, left: on ? 17 : 2 }} />
      </span>
      {t}
    </button>
  );
}
function Modal({ titulo, icone: Ico, onClose, children, largura = 620, rodape }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="rounded-xl w-full flex flex-col" style={{ background: C.panel, maxWidth: largura, maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold flex items-center gap-2">{Ico && <Ico size={18} style={{ color: C.accent }} />} {titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
        {rodape && <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2, borderRadius: "0 0 12px 12px" }}>{rodape}</div>}
      </div>
    </div>
  );
}
const BtnP = ({ onClick, children, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent, opacity: disabled ? 0.5 : 1 }}>{children}</button>
);
const BtnS = ({ onClick, children, cor }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, color: cor || C.text, background: C.panel }}>{children}</button>
);

/* ---------- rateio (contas-caixa) ---------- */
function Rateio({ contas, valor, value, onChange }) {
  const lista = value && value.length ? value : [{ contaId: null, pct: 100 }];
  const ativas = useMemo(() => contas.filter((c) => c.ativo), [contas]);
  const porId = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas]);
  const alt = (i, k, v) => onChange(lista.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const tot = lista.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  // divide o que falta igualmente entre as linhas sem percentual
  const dividirIgual = () => {
    const n = lista.length || 1;
    const base = Math.floor((100 / n) * 100) / 100;
    onChange(lista.map((r, i) => ({ ...r, pct: i === n - 1 ? r2pct(100 - base * (n - 1)) : base })));
  };
  return (
    <div>
      {lista.map((r, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <ContaSelect conta={porId[r.contaId]} contas={ativas} onPick={(id) => alt(i, "contaId", id)} />
          {lista.length > 1 && (
            <>
              <div className="relative" style={{ width: 80 }}>
                <input value={r.pct} onChange={(e) => alt(i, "pct", lerNum(e.target.value))} className="w-full text-right rounded px-2 py-1.5 text-sm outline-none" style={{ ...inpS, paddingRight: 18 }} />
                <span className="absolute right-2 top-2 text-[10px]" style={{ color: C.sub }}>%</span>
              </div>
              <span className="text-xs text-right" style={{ color: C.sub, width: 90 }}>{brl((valor * (Number(r.pct) || 0)) / 100)}</span>
              <button type="button" onClick={() => onChange(lista.filter((_, j) => j !== i))} style={{ color: C.sub }}><X size={14} /></button>
            </>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={() => {
          const resto = Math.max(0, Math.round((100 - tot) * 100) / 100);
          onChange([...lista, { contaId: null, pct: resto || 0 }]);
        }} className="flex items-center gap-1 font-semibold" style={{ color: C.accent }}><Plus size={13} /> Ratear em mais contas</button>
        {lista.length > 1 && (
          <>
            <button type="button" onClick={dividirIgual} className="font-semibold" style={{ color: C.accent }}>dividir igualmente</button>
            <span style={{ color: Math.abs(tot - 100) > 0.01 ? C.red : C.green }}>Total {brl(tot)}%</span>
          </>
        )}
      </div>
    </div>
  );
}
const r2pct = (n) => Math.round(Number(n || 0) * 100) / 100;
const semAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

// Campo de conta-caixa: abre a lista inteira ao clicar e vai filtrando conforme você digita.
function ContaSelect({ conta, contas, onPick }) {
  const rotulo = conta ? `${conta.codigo} · ${conta.nome}` : "";
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [i, setI] = useState(0);
  const caixa = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) { setAberto(false); setBusca(""); } };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const filtradas = useMemo(() => {
    const b = semAc(busca).trim();
    if (!b) return contas;
    const termos = b.split(/\s+/);
    return contas.filter((c) => { const alvo = semAc(`${c.codigo} ${c.nome}`); return termos.every((t) => alvo.includes(t)); });
  }, [contas, busca]);
  useEffect(() => { setI(0); }, [busca]);

  const escolher = (c) => { onPick(c.id); setAberto(false); setBusca(""); };
  const tecla = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(filtradas.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtradas[i]) escolher(filtradas[i]); }
    else if (e.key === "Escape") { setAberto(false); setBusca(""); }
  };

  return (
    <div ref={caixa} className="relative flex-1" style={{ minWidth: 220 }}>
      <input
        value={aberto ? busca : rotulo}
        onFocus={() => { setAberto(true); setBusca(""); }}
        onClick={() => setAberto(true)}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onKeyDown={tecla}
        placeholder={conta ? rotulo : "Clique e escolha a conta-caixa"}
        className={inp} style={{ ...inpS, borderColor: conta ? C.line : C.yellow }} />
      <ChevronDown size={14} className="absolute right-2 top-2.5 pointer-events-none" style={{ color: C.sub }} />
      {aberto && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg overflow-auto"
          style={{ background: C.panel, border: `1px solid ${C.line}`, maxHeight: 260, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
          {!filtradas.length && <div className="px-3 py-2 text-xs" style={{ color: C.sub }}>Nenhuma conta com "{busca}".</div>}
          {filtradas.map((c, k) => (
            <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(c)} onMouseEnter={() => setI(k)}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2"
              style={{ background: k === i ? C.accentSoft : "transparent", color: C.text }}>
              <span className="font-mono text-xs" style={{ color: C.sub, width: 62 }}>{c.codigo}</span>
              <span className="flex-1 truncate">{c.nome}</span>
              {conta && c.id === conta.id && <CheckCircle2 size={13} style={{ color: C.green }} />}
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px]" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
            {filtradas.length} de {contas.length} contas · digite para filtrar por código ou nome
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
export default function ContasPagarReceber({ user }) {
  const [tipo, setTipo] = useState("PAGAR");
  const [mes, setMes] = useState(mesAtual());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [fSit, setFSit] = useState("TODOS");
  const [modal, setModal] = useState(null);
  const [aviso, setAviso] = useState("");
  // lista por período (de / até, pelo vencimento) — abre no dia de hoje
  const [dIni, setDIni] = useState(hojeISO());
  const [dFim, setDFim] = useState(hojeISO());
  const [sel, setSel] = useState(() => new Set());   // contas marcadas para ação em lote
  const [lote, setLote] = useState(null);             // "baixar" | "excluir"

  const carregar = () => api(`/api/fin/titulos?u=${user.id}&tipo=${tipo}&de=${mes}&ate=${mes}&dIni=${dIni}&dFim=${dFim < dIni ? dIni : dFim}`).then((j) => {
    setD(j); setErro("");
    if (j.autoMatriz?.criadas) setAviso(`${j.autoMatriz.criadas} contas recorrentes da Matriz de custos foram lançadas (previsões até 12 meses à frente). Confira dia, fornecedor e conta-caixa em Recorrências.`);
  }).catch((e) => setErro(e.message));
  useEffect(() => { setD(null); carregar(); }, [tipo, mes]);
  useEffect(() => { if (d) carregar(); }, [dIni, dFim]);
  useEffect(() => { setSel(new Set()); }, [tipo]);
  // trocar o mês dos cards leva a lista para o mês inteiro; "hoje" volta para o dia
  const irMes = (m) => { setMes(m); setDIni(`${m}-01`); setDFim(fimDoMes(m)); };
  const irHoje = () => { setMes(mesAtual()); setDIni(hojeISO()); setDFim(hojeISO()); };
  const verVencidos = () => { setDIni("2020-01-01"); setDFim(somaDias(hojeISO(), -1)); setFSit("VENC"); };
  const ok = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3000); carregar(); };

  const contasPorId = useMemo(() => Object.fromEntries((d?.contas || []).map((c) => [c.id, c])), [d]);
  const P = tipo === "PAGAR";
  const lista = useMemo(() => {
    if (!d) return [];
    const n = busca.trim().toUpperCase();
    return (fSit === "SEMCONTA" ? d.semConta || [] : d.periodo || d.titulos).filter((t) => {
      const s = situacao(t).k;
      if (fSit !== "TODOS" && fSit !== "SEMCONTA" && !(fSit === s || (fSit === "ABERTOS" && ["ABER", "VENC", "PREV"].includes(s)))) return false;
      if (!n) return true;
      return [t.titulo, t.parceiro, t.numeroDoc, t.documento, ...(t.rateio || []).map((r) => contasPorId[r.contaId]?.nome)].some((x) => String(x || "").toUpperCase().includes(n));
    });
  }, [d, busca, fSit, contasPorId]);
  const tot = useMemo(() => {
    const ls = (d?.titulos || []).filter((t) => t.status !== "CANCELADO");
    const s = (f) => ls.filter(f).reduce((a, t) => a + t.valor, 0);
    return {
      total: s(() => true), pago: ls.filter((t) => t.status === "PAGO").reduce((a, t) => a + (t.valorPago ?? t.valor), 0),
      aberto: s((t) => t.status === "ABERTO"), vencido: s((t) => t.status === "ABERTO" && t.vencimento < hojeISO()), previsao: s((t) => t.status === "ABERTO" && t.previsao),
      atrasados: (d?.atrasados || []).reduce((a, t) => a + t.valor, 0),
      vencidoTotal: d?.vencidoTotal || 0, vencidoTotalQtd: d?.vencidoTotalQtd || 0,
    };
  }, [d]);
  // seleção: só contas em aberto; o resumo usa tudo que está na tela (período + vencidos anteriores)
  const porId = useMemo(() => Object.fromEntries([...(d?.periodo || []), ...(d?.titulos || []), ...(d?.atrasados || [])].map((t) => [t.id, t])), [d]);
  const marcados = [...sel].map((id) => porId[id]).filter((t) => t && t.status === "ABERTO");
  const marcar = (ids, on) => setSel((x) => { const n = new Set(x); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const fazerLote = async (acao, dataPagamento) => {
    try {
      const r = await api("/api/fin/titulos/lote", "POST", { usuarioId: user.id, acao, ids: marcados.map((t) => t.id), dataPagamento });
      setLote(null); setSel(new Set());
      const ex = acao === "baixar"
        ? `${r.feitos} conta(s) ${P ? "baixada(s)" : "recebida(s)"}.`
        : `${r.excluidos} excluída(s)${r.cancelados ? `, ${r.cancelados} cancelada(s) (recorrência / semana)` : ""}.`;
      ok(ex + (r.pulados ? ` ${r.pulados} pulada(s)${r.semValor ? " (sem valor)" : ""}.` : ""));
    } catch (e) { setErro(e.message); setLote(null); }
  };

  const acao = async (t, a, extra = {}) => {
    try { await api(`/api/fin/titulos/${t.id}`, "PATCH", { usuarioId: user.id, acao: a, ...extra }); carregar(); } catch (e) { setErro(e.message); }
  };
  const excluir = async (t) => {
    if (!confirm(t.recorrenciaId ? `Cancelar "${t.titulo}" de ${nomeMes(t.competencia)}? (os outros meses da recorrência continuam)` : `Excluir "${t.titulo}"?`)) return;
    try { await api(`/api/fin/titulos/${t.id}`, "DELETE", { usuarioId: user.id }); carregar(); } catch (e) { setErro(e.message); }
  };

  return (
    <div>
      {/* pagar / receber */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["PAGAR", "Contas a pagar", TrendingDown], ["RECEBER", "Contas a receber", TrendingUp], ["RECORRENTES", "Recorrentes", Repeat]].map(([k, t, I]) => (
          <button key={k} onClick={() => setTipo(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            style={{ color: tipo === k ? C.accent : C.sub, borderBottom: tipo === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            <I size={15} /> {t}
          </button>
        ))}
      </div>

      {tipo === "RECORRENTES" && <Recorrentes user={user} contasPorId={contasPorId} />}
      {tipo !== "RECORRENTES" && <>
      {/* NFs lançadas pelo Compras */}
      {P && d && d.nfsPendentes > 0 && (
        <button onClick={() => setModal({ t: "nfs" })} className="w-full flex items-center gap-2 px-4 py-3 mb-3 rounded-xl text-sm text-left" style={{ background: C.blueSoft, border: `1px solid ${C.blue}55`, color: C.text }}>
          <Inbox size={18} style={{ color: C.blue }} />
          <span className="flex-1"><b>{d.nfsPendentes} nota(s) fiscal(is)</b> lançada(s) pelo Compras aguardando virar conta a pagar.</span>
          <span className="font-semibold" style={{ color: C.blue }}>Ver notas →</span>
        </button>
      )}

      {/* crítica: contas sem conta-caixa */}
      {d && (d.semConta || []).length > 0 && (
        <button onClick={() => setFSit(fSit === "SEMCONTA" ? "TODOS" : "SEMCONTA")} className="w-full flex items-center gap-2 px-4 py-3 mb-4 rounded-xl text-sm text-left" style={{ background: C.redSoft, border: `1px solid ${C.red}55`, color: C.text }}>
          <AlertTriangle size={18} style={{ color: C.red }} />
          <span className="flex-1"><b>{d.semConta.length} conta(s) em aberto sem conta-caixa</b> ({moeda(d.semConta.reduce((a, t) => a + t.valor, 0))}). O rateio é obrigatório — edite cada uma e informe a conta.</span>
          <span className="font-semibold" style={{ color: C.red }}>{fSit === "SEMCONTA" ? "Voltar à lista" : "Ver contas →"}</span>
        </button>
      )}

      {/* crítica das recorrências */}
      {d && d.criticas.length > 0 && (
        <button onClick={() => setModal({ t: "conferir" })} className="w-full flex items-center gap-2 px-4 py-3 mb-4 rounded-xl text-sm text-left" style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}55`, color: C.text }}>
          <CalendarClock size={18} style={{ color: C.yellow }} />
          <span className="flex-1"><b>{d.criticas.length} conta(s) recorrente(s)</b> com o valor do mês para conferir. Altere se mudou ou confirme se continua igual.</span>
          <span className="font-semibold" style={{ color: C.yellow }}>Conferir →</span>
        </button>
      )}

      {/* baixas sugeridas pelo extrato */}
      {d && (
        <button onClick={() => setModal({ t: "baixas" })} className="w-full flex items-center gap-2 px-4 py-3 mb-3 rounded-xl text-sm text-left"
          style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text }}>
          <Link2 size={18} style={{ color: C.accent }} />
          <span className="flex-1">Conferir <b>baixas pelo extrato</b> — o sistema procura no extrato deste mês os pagamentos que batem com as contas previstas.</span>
          <span className="font-semibold" style={{ color: C.accent }}>Procurar →</span>
        </button>
      )}

      {/* período + ações */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <button onClick={() => irMes(somaMes(mes, -1))} className="px-2 py-2" style={{ color: C.sub }}><ChevronLeft size={16} /></button>
          <div className="px-2 text-sm font-bold text-center" style={{ color: C.navy, minWidth: 130 }}>{nomeMes(mes)}</div>
          <button onClick={() => irMes(somaMes(mes, 1))} className="px-2 py-2" style={{ color: C.sub }}><ChevronRight size={16} /></button>
        </div>
        {(mes !== mesAtual() || dIni !== hojeISO() || dFim !== hojeISO()) && <button onClick={irHoje} className="text-xs underline" style={{ color: C.blue }}>hoje</button>}
        <div className="flex-1" />
        <BtnS onClick={() => setModal({ t: "recorrencias" })}><Repeat size={15} /> Recorrências{d ? ` (${d.recorrencias.filter((r) => r.ativo).length})` : ""}</BtnS>
        <BtnS onClick={() => setModal({ t: "posicao" })}><FileSpreadsheet size={15} /> Importar posição</BtnS>
        {P && <BtnS onClick={() => setModal({ t: "documento" })}><FileText size={15} /> Importar documento</BtnS>}
        {P && <BtnS onClick={() => setModal({ t: "xml" })}><Upload size={15} /> Importar XML</BtnS>}
        <BtnP onClick={() => setModal({ t: "titulo", item: null })}><Plus size={15} /> Nova conta</BtnP>
      </div>
      {aviso && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {!d ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          {/* totais do mês */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {[
              [`Contas ${P ? "a pagar" : "a receber"} no mês`, tot.total, C.navy, null],
              ["Em aberto", tot.aberto, C.blue, null],
              ["Vencido no mês", tot.vencido, C.red, null],
              ["Vencido total", tot.vencidoTotal, C.red, verVencidos, `${tot.vencidoTotalQtd} conta(s) em aberto vencidas até ontem — clique para listar`],
            ].map(([t, v, c, click, dica]) => {
              const Tag = click ? "button" : "div";
              return (
                <Tag key={t} onClick={click || undefined} title={dica} className="rounded-xl px-4 py-3 text-left transition-shadow hover:shadow-sm"
                  style={{ background: C.panel, border: `1px solid ${t === "Vencido total" && v > 0 ? C.red + "55" : C.line}` }}>
                  <div className="text-xs flex items-center gap-1" style={{ color: C.sub }}>{t}{click && <Search size={11} style={{ color: C.accent }} />}</div>
                  <div className="text-lg font-bold" style={{ color: c }}>{moeda(v)}</div>
                </Tag>
              );
            })}
          </div>

          {/* filtro do período da lista */}
          {fSit === "SEMCONTA" ? (
            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
              <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.redSoft, color: C.red }}>Todas as contas em aberto sem conta-caixa · qualquer vencimento</span>
              <button onClick={() => setFSit("TODOS")} className="text-xs underline" style={{ color: C.blue }}>voltar à lista do período</button>
            </div>
          ) : (
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <label className="text-xs" style={{ color: C.sub }}>De
              <input type="date" value={dIni} onChange={(e) => e.target.value && setDIni(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} />
            </label>
            <label className="text-xs" style={{ color: C.sub }}>Até
              <input type="date" value={dFim} min={dIni} onChange={(e) => e.target.value && setDFim(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} />
            </label>
            <div className="flex gap-1 pb-0.5">
              {[["Hoje", hojeISO(), hojeISO()], ["7 dias", hojeISO(), somaDias(hojeISO(), 6)], ["Mês", `${mes}-01`, fimDoMes(mes)]].map(([t, a, b]) => (
                <button key={t} onClick={() => { setDIni(a); setDFim(b); }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                  style={dIni === a && dFim === b ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}55` } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, fornecedor, conta…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 230 }} />
            </div>
            <select value={fSit} onChange={(e) => setFSit(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={inpS}>
              <option value="TODOS">Todas as situações</option><option value="ABERTOS">Em aberto (inclui previsões)</option><option value="VENC">Vencidos</option>
              <option value="PREV">Previsões</option><option value="PAGO">{P ? "Pagos" : "Recebidos"}</option><option value="CANC">Cancelados</option>
              <option value="SEMCONTA">Sem conta-caixa (todas)</option>
            </select>
          </div>
          )}

          {/* ações em lote */}
          {marcados.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 px-4 py-2.5 rounded-xl text-sm sticky top-0 z-10" style={{ background: C.navy, color: "#fff" }}>
              <CheckSquare size={16} style={{ color: C.accent }} />
              <b>{marcados.length} selecionada(s)</b>
              <span style={{ opacity: 0.8 }}>· {moeda(marcados.reduce((a, t) => a + t.valor, 0))}</span>
              <div className="flex-1" />
              <button onClick={() => setLote("baixar")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}><CheckCircle2 size={14} /> {P ? "Baixar" : "Receber"}</button>
              <button onClick={() => setLote("excluir")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.red, color: "#fff" }}><Trash2 size={14} /> Excluir</button>
              <button onClick={() => setSel(new Set())} className="px-2 py-1.5 text-xs underline" style={{ color: "#fff" }}>limpar</button>
            </div>
          )}

          <Tabela titulo={fSit === "SEMCONTA" ? `Em aberto sem conta-caixa · ${lista.length} conta(s)` : `${dIni === dFim ? (dIni === hojeISO() ? `Hoje · ${dBR(dIni)}` : dBR(dIni)) : `${dBR(dIni)} a ${dBR(dFim)}`} · ${lista.length} conta(s)`} itens={lista} contasPorId={contasPorId} P={P}
            sel={sel} marcar={marcar}
            onEditar={(t) => setModal(ehSemana(t) ? { t: "semana", item: t } : { t: "titulo", item: t })} onBaixar={(t) => setModal({ t: "baixa", item: t })} onAcao={acao} onExcluir={excluir}
            vazio={busca || fSit !== "TODOS" ? "Nada encontrado com esses filtros." : `Nenhuma conta ${P ? "a pagar" : "a receber"} vencendo neste período.`} />

          {d.atrasados.length > 0 && fSit !== "SEMCONTA" && (
            <Tabela titulo={`Vencidos de meses anteriores · ${moeda(tot.atrasados)}`} cor={C.red} itens={d.atrasados} contasPorId={contasPorId} P={P}
              sel={sel} marcar={marcar}
              onEditar={(t) => setModal(ehSemana(t) ? { t: "semana", item: t } : { t: "titulo", item: t })} onBaixar={(t) => setModal({ t: "baixa", item: t })} onAcao={acao} onExcluir={excluir} />
          )}
        </>
      )}

      </>}

      {modal?.t === "titulo" && <TituloModal user={user} tipo={tipo} item={modal.item} d={d} onClose={() => setModal(null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "baixa" && <BaixaModal t={modal.item} P={P} onClose={() => setModal(null)} onOk={async (dt, v) => { await acao(modal.item, "baixar", { dataPagamento: dt, valorPago: v }); setModal(null); }} />}
      {modal?.t === "semana" && <SemanaModal user={user} tituloId={modal.item.id} onClose={() => { setModal(null); carregar(); }} onMudou={carregar} />}
      {modal?.t === "conferir" && <ConferirModal user={user} itens={d.criticas} recorrencias={d.recorrencias || []} contasPorId={contasPorId} onClose={() => { setModal(null); carregar(); }} />}
      {modal?.t === "xml" && <XmlModal user={user} tipo={tipo} contas={d?.contas || []} lidosIniciais={modal.lidos} onClose={() => setModal(modal.lidos ? { t: "nfs" } : null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "nfs" && <NfsComprasModal user={user} onClose={() => { setModal(null); carregar(); }} onLancar={(lidos) => setModal({ t: "xml", lidos })} />}
      {modal?.t === "recorrencias" && <RecorrenciasModal user={user} d={d} contasPorId={contasPorId} onClose={() => { setModal(null); carregar(); }} />}
      {modal?.t === "baixas" && <BaixasModal user={user} competencia={mes} onClose={() => { setModal(null); carregar(); }} />}
      {modal?.t === "documento" && <DocumentoModal user={user} contas={d?.contas || []} onClose={() => setModal(null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "posicao" && <PosicaoModal user={user} contas={d?.contas || []} onClose={() => setModal(null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {lote && <LoteModal acao={lote} P={P} itens={marcados} onClose={() => setLote(null)} onOk={fazerLote} />}
    </div>
  );
}

/* ---------------- tabela ---------------- */
// valor usado para ordenar cada coluna
const chaveOrdem = (t, col, contasPorId) => {
  switch (col) {
    case "venc": return t.vencimento || "";
    case "titulo": return String(t.titulo || "").toUpperCase();
    case "parceiro": return String(t.parceiro || "").toUpperCase();
    case "rateio": { const c = contasPorId[(t.rateio || [])[0]?.contaId]; return c ? `${c.codigo} ${c.nome}` : "￿"; }
    case "valor": return Number(t.valor || 0);
    case "situacao": return situacao(t).t;
    case "origem": return `${ehImportacao(t) ? "IMPORTAÇÃO" : (FORMA[t.forma] || [t.forma || ""])[0].toUpperCase()} ${t.createdAt || ""}`;
    default: return "";
  }
};
function Tabela({ titulo, cor, itens: itens0, contasPorId, P, onEditar, onBaixar, onAcao, onExcluir, vazio, sel, marcar }) {
  const [ordem, setOrdem] = useState(null);   // { col, dir: 1 | -1 } — clique no título da coluna: A→Z, Z→A, volta
  const itens = useMemo(() => {
    if (!ordem) return itens0;
    return [...itens0].sort((a, b) => {
      const x = chaveOrdem(a, ordem.col, contasPorId), y = chaveOrdem(b, ordem.col, contasPorId);
      const r = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      return r * ordem.dir || (a.vencimento || "").localeCompare(b.vencimento || "");
    });
  }, [itens0, ordem, contasPorId]);
  const clicarCol = (col) => setOrdem((o) => (!o || o.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null));
  const total = itens.filter((t) => t.status !== "CANCELADO").reduce((s, t) => s + t.valor, 0);
  const abertos = itens.filter((t) => t.status === "ABERTO").map((t) => t.id);
  const todos = !!sel && abertos.length > 0 && abertos.every((id) => sel.has(id));
  return (
    <div className="rounded-xl mb-4 overflow-hidden" style={{ background: C.panel, border: `1px solid ${cor ? cor + "55" : C.line}` }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: cor ? C.redSoft : C.panel2 }}>
        <div className="font-bold text-sm" style={{ color: cor || C.navy }}>{titulo}</div>
        <div className="text-sm font-bold" style={{ color: cor || C.navy }}>{moeda(total)}</div>
      </div>
      {!itens.length ? <div className="px-4 py-8 text-sm text-center" style={{ color: C.sub }}>{vazio}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
              {sel && <th className="pl-3 py-2 w-6"><input type="checkbox" checked={todos} disabled={!abertos.length} onChange={(e) => marcar(abertos, e.target.checked)} title="Selecionar todas em aberto" /></th>}
              {[["venc", "Vencimento"], ["titulo", "Título"], ["parceiro", P ? "Fornecedor" : "Cliente"], ["rateio", "Rateio (conta-caixa)"], ["valor", "Valor"], ["situacao", "Situação"], ["origem", "Origem"], [null, ""]].map(([col, h], i) => (
                <th key={i} className={`px-3 py-2 font-semibold ${col === "valor" ? "text-right" : "text-left"}`}>
                  {col ? (
                    <button onClick={() => clicarCol(col)} title="Ordenar" className={`inline-flex items-center gap-0.5 ${col === "valor" ? "flex-row-reverse" : ""}`} style={{ color: ordem?.col === col ? C.accent : C.sub }}>
                      {h}<span className="text-[10px]">{ordem?.col === col ? (ordem.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : h}
                </th>
              ))}
            </tr></thead>
            <tbody>{itens.map((t) => {
              const s = situacao(t);
              const [fT, FI] = FORMA[t.forma] || [t.forma, Hand];
              const conferir = t.recorrenciaId && !t.valorConfirmado && t.status === "ABERTO" && t.competencia <= mesAtual();
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: t.status === "CANCELADO" ? 0.5 : 1, background: sel?.has(t.id) ? C.accentSoft : undefined }} className="hover:bg-gray-50">
                  {sel && <td className="pl-3 py-2">{t.status === "ABERTO" && <input type="checkbox" checked={sel.has(t.id)} onChange={(e) => marcar([t.id], e.target.checked)} />}</td>}
                  <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: s.k === "VENC" ? C.red : C.text }}>{dBR(t.vencimento)}</td>
                  <td className="px-3 py-2" style={{ maxWidth: 260 }}>
                    <button onClick={() => onEditar(t)} className="text-left">
                      <div className="font-semibold flex items-center gap-1" style={{ color: C.navy }}>
                        {t.recorrenciaId && <Repeat size={12} style={{ color: C.roxo }} title="Recorrente" />}{t.titulo}
                        {t.nAnexos > 0 && <span className="flex items-center text-[10px] font-normal" style={{ color: C.sub }} title={`${t.nAnexos} anexo(s)`}><Paperclip size={11} />{t.nAnexos > 1 ? t.nAnexos : ""}</span>}
                      </div>
                      {(t.numeroDoc || t.observacao) && <div style={{ color: C.sub }}>{[t.numeroDoc, t.observacao].filter(Boolean).join(" · ")}</div>}
                    </button>
                  </td>
                  <td className="px-3 py-2" style={{ maxWidth: 200 }}>{t.parceiro}{t.documento && <div style={{ color: C.sub }}>{fmtDoc(t.documento)}</div>}</td>
                  <td className="px-3 py-2" style={{ maxWidth: 220 }}>
                    {t.status === "ABERTO" && semRateio(t) && <button onClick={() => onEditar(t)} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: C.redSoft, color: C.red }} title="Rateio obrigatório — clique para informar a conta-caixa">SEM CONTA-CAIXA</button>}
                    {(t.rateio || []).map((r, i) => {
                      const c = contasPorId[r.contaId];
                      return <div key={i} className="truncate">{c ? `${c.codigo} ${c.nome}` : "?"}{t.rateio.length > 1 && <span style={{ color: C.sub }}> · {brl(r.pct)}%</span>}</div>;
                    })}
                  </td>
                  <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                    {brl(t.valor)}
                    {t.status === "PAGO" && t.valorPago != null && Math.abs(t.valorPago - t.valor) > 0.009 && <div className="font-normal" style={{ color: C.sub }}>{P ? "pago" : "recebido"} {brl(t.valorPago)}</div>}
                    {conferir && <div className="font-semibold text-[10px]" style={{ color: C.yellow }}>conferir valor</div>}
                  </td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: s.c, background: s.bg }}>{s.t}</span></td>
                  <td className="px-3 py-2" title={`${fT} · ${t.criadoPorNome || "—"} · ${new Date(t.createdAt).toLocaleString("pt-BR")}${t.atualizadoPorNome ? ` · alterado por ${t.atualizadoPorNome}` : ""}`}>
                    {ehImportacao(t) ? (
                      <>
                        <div className="flex items-center gap-1 font-semibold" style={{ color: C.blue }}><FI size={13} /> IMPORTAÇÃO</div>
                        <div className="text-[10px]" style={{ color: C.sub }}>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1" style={{ color: C.sub }}><FI size={13} /> <span className="truncate" style={{ maxWidth: 90 }}>{(t.criadoPorNome || "").split(" ")[0]}</span></div>
                        <div className="text-[10px]" style={{ color: C.sub }}>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</div>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {t.status === "ABERTO" && <button onClick={() => onBaixar(t)} title={P ? "Registrar pagamento" : "Registrar recebimento"} className="mr-2" style={{ color: C.green }}><CheckCircle2 size={15} /></button>}
                    {t.status === "PAGO" && <button onClick={() => onAcao(t, "estornar")} title="Estornar baixa" className="mr-2" style={{ color: C.sub }}><Undo2 size={15} /></button>}
                    {t.status === "CANCELADO" ? <button onClick={() => onAcao(t, "reabrir")} title="Reabrir" className="mr-2" style={{ color: C.sub }}><Undo2 size={15} /></button>
                      : <button onClick={() => onEditar(t)} title="Editar" className="mr-2" style={{ color: C.sub }}><Pencil size={14} /></button>}
                    {t.status !== "PAGO" && t.status !== "CANCELADO" && <button onClick={() => onExcluir(t)} title={t.recorrenciaId ? "Cancelar este mês" : "Excluir"} style={{ color: C.sub }}>{t.recorrenciaId ? <Ban size={14} /> : <Trash2 size={14} />}</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- importar documento (folha de pagamento, resumo de líquidos, recibo…) ---------------- */
const TIPO_DOC = { FOLHA: ["Folha de pagamento", C.blue, C.blueSoft], RECIBO: ["Recibo", C.roxo, C.roxoSoft] };
function DocumentoModal({ user, contas, onClose, onSalvo }) {
  const [arqs, setArqs] = useState([]);       // [{ nome, conteudo }]
  const [r, setR] = useState(null);           // { itens, naoReconhecidos }
  const [esc, setEsc] = useState({});         // escolha por item: { destino: id | "CRIAR" | "IGNORAR", criar: {...} }
  const [abertos, setAbertos] = useState({});
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const ref = useRef(null);
  const contasPorId = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas]);
  const ler = async (files) => {
    const pdfs = [...files].filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) return setErro("Escolha arquivos PDF.");
    setErro(""); setSt("Lendo os documentos…");
    try {
      const lista = [];
      for (const f of pdfs) lista.push({ nome: f.name, conteudo: await readB64(f) });
      const j = await api("/api/fin/titulos/documento", "POST", { usuarioId: user.id, acao: "analisar", arquivos: lista });
      setArqs(lista); setR(j);
      setEsc(Object.fromEntries(j.itens.map((it) => [it.chave, { destino: it.alvo ? it.alvo.id : it.tipo === "RECIBO" ? "CRIAR" : "IGNORAR", criar: it.novo || { titulo: it.descricao, parceiro: "", vencimento: "", contaId: null } }])));
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const muda = (k, patch) => setEsc((x) => ({ ...x, [k]: { ...x[k], ...patch } }));
  // conferência com a Matriz de custos: corrigir na hora
  const [mtz, setMtz] = useState({});   // por item: { deptos: {codigo: depto}, st, msg }
  const DEPTOS_M = [["ADM", "Administrativo"], ["COR", "Corte"], ["SIL", "Silk"], ["BOR", "Bordado"], ["COS", "Costura"], ["EXP", "Expedição"], ["LOG", "Logística"], ["NORT", "NORT (loja)"], ["DIR", "Diretoria"]];
  const corrigirMatriz = async (it) => {
    const m = mtz[it.chave] || {};
    setMtz((x) => ({ ...x, [it.chave]: { ...m, st: "Corrigindo…", msg: "" } }));
    try {
      const pessoas = it.matriz.faltam.map((f) => ({ ...f, depto: m.deptos?.[f.codigo] || f.depto, salario: m.salarios?.[f.codigo] ?? f.salario }));
      const j = await api("/api/fin/titulos/documento", "POST", { usuarioId: user.id, acao: "corrigirMatriz", pessoas, ref: it.refTexto });
      setR((x) => ({ ...x, itens: x.itens.map((y) => (y.chave === it.chave ? { ...y, matriz: { ...y.matriz, ok: [...y.matriz.ok, ...y.matriz.faltam.map((f) => ({ folha: f.nome, matriz: f.nome.split(" ")[0] }))], faltam: [] } } : y)) }));
      setMtz((x) => ({ ...x, [it.chave]: { st: "", msg: `Matriz corrigida: ${j.incluidas} incluída(s), ${j.nomeadas} vaga(s) nomeada(s)${j.contas ? ` · contas de pessoal atualizadas (${j.contas.atualizadas} recorrência(s))` : ""}.` } }));
    } catch (e) { setMtz((x) => ({ ...x, [it.chave]: { ...m, st: "", msg: "", erro: e.message } })); }
  };
  const mudaCriar = (k, patch) => setEsc((x) => ({ ...x, [k]: { ...x[k], criar: { ...x[k].criar, ...patch } } }));
  const usados = r ? r.itens.filter((it) => esc[it.chave]?.destino !== "IGNORAR") : [];
  const faltaConta = usados.some((it) => esc[it.chave]?.destino === "CRIAR" && !esc[it.chave]?.criar?.contaId);
  const aplicar = async () => {
    setSt("Aplicando…"); setErro("");
    try {
      const itens = usados.map((it) => {
        const e = esc[it.chave];
        return { tipo: it.tipo, valor: it.valor, comp: it.comp, descricao: it.descricao, arquivos: it.arquivos, rateio: it.rateio || null,
          ...(e.destino === "CRIAR" ? { criar: e.criar } : { alvoId: Number(e.destino) }) };
      });
      const j = await api("/api/fin/titulos/documento", "POST", { usuarioId: user.id, acao: "aplicar", itens, arquivos: [] });
      // anexa cada PDF na conta que recebeu o lançamento (um envio por arquivo; o que já estiver anexado é pulado)
      let anexos = 0;
      for (let i = 0; i < itens.length; i++) {
        const id = j.ids?.[i];
        if (!id) continue;
        setSt(`Anexando documentos… (${i + 1}/${itens.length})`);
        const ja = await api(`/api/fin/titulos/${id}/anexos?u=${user.id}`).then((x) => new Set((x.anexos || []).map((a) => a.nome))).catch(() => new Set());
        for (const n of itens[i].arquivos) {
          const a = arqs.find((x) => x.nome === n);
          if (!a || ja.has(n)) continue;
          await api(`/api/fin/titulos/${id}/anexos`, "POST", { usuarioId: user.id, nome: a.nome, mime: "application/pdf", conteudo: a.conteudo });
          anexos++;
        }
      }
      onSalvo(`Documentos aplicados: ${j.atualizadas} conta(s) atualizada(s)${j.criadas ? `, ${j.criadas} criada(s)` : ""}, ${anexos} documento(s) anexado(s). ${j.linhas.join(" · ")}`);
    } catch (e) { setErro(e.message); setSt(""); }
  };
  return (
    <Modal titulo="Importar documento" icone={FileText} onClose={onClose} largura={900}
      rodape={r && r.itens.length ? <>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP onClick={aplicar} disabled={!!st || !usados.length || faltaConta}>{st && <Loader2 size={14} className="animate-spin" />} Aplicar</BtnP>
      </> : null}>
      {!r && (
        <div className="text-center py-10">
          <FileText size={36} className="mx-auto mb-3" style={{ color: C.accent }} />
          <div className="text-sm mb-1" style={{ color: C.text }}>Envie os PDFs: <b>folha de pagamento</b> e <b>resumo de líquidos</b> (Meridian ou NORT), <b>recibos</b>…</div>
          <div className="text-xs mb-4" style={{ color: C.sub }}>O sistema reconhece cada documento, acha a conta certa, atualiza o valor e anexa o arquivo. Nada é gravado antes de você confirmar.</div>
          <BtnP onClick={() => ref.current?.click()} disabled={!!st}>{st ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {st || "Escolher PDFs"}</BtnP>
          <input ref={ref} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { ler(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      {r && (
        <div className="flex flex-col gap-3">
          {r.naoReconhecidos?.length > 0 && (
            <div className="text-xs p-2.5 rounded-lg" style={{ background: C.yellowSoft, color: C.text }}>
              {r.naoReconhecidos.map((x) => <div key={x.nome}><b>{x.nome}</b>: {x.erro}</div>)}
            </div>
          )}
          {!r.itens.length && <div className="text-sm text-center py-6" style={{ color: C.sub }}>Nenhum documento reconhecido.</div>}
          {r.itens.map((it) => {
            const e = esc[it.chave] || {};
            const [tt, tc, tb] = TIPO_DOC[it.tipo] || [it.tipo, C.sub, C.panel2];
            const alvo = it.opcoes.find((o) => String(o.id) === String(e.destino));
            return (
              <div key={it.chave} className="rounded-xl p-3" style={{ border: `1px solid ${C.line}`, opacity: e.destino === "IGNORAR" ? 0.6 : 1 }}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: tc, background: tb }}>{tt}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold" style={{ color: C.navy }}>{it.descricao}</div>
                    <div className="text-[11px]" style={{ color: C.sub }}>{it.arquivos.join(" · ")}</div>
                  </div>
                  <div className="text-lg font-bold" style={{ color: C.navy }}>{moeda(it.valor)}</div>
                </div>
                {it.tipo === "FOLHA" && (
                  <div className="text-xs mb-2">
                    <button onClick={() => setAbertos((x) => ({ ...x, [it.chave]: !x[it.chave] }))} className="underline" style={{ color: C.blue }}>
                      {abertos[it.chave] ? "esconder" : "ver"} líquido por funcionário ({it.funcionarios.length})
                    </button>
                    {abertos[it.chave] && (
                      <div className="mt-1 rounded-lg overflow-auto" style={{ maxHeight: 200, border: `1px solid ${C.line}` }}>
                        {it.funcionarios.map((f) => (
                          <div key={f.codigo} className="flex justify-between px-3 py-1" style={{ borderBottom: `1px solid ${C.line}` }}><span>{f.nome}</span><b>{brl(f.liquido)}</b></div>
                        ))}
                      </div>
                    )}
                    <div className="mt-1" style={{ color: C.sub }}>{it.nota}</div>
                  </div>
                )}
                {it.tipo === "RECIBO" && it.itens?.length > 0 && (
                  <div className="text-xs mb-2" style={{ color: C.sub }}>{it.itens.map((x) => `${x.desc}: ${brl(x.valor)}`).join(" · ")}</div>
                )}
                {it.avisos.length > 0 && <div className="text-xs mb-2 p-2 rounded" style={{ background: C.yellowSoft, color: C.text }}>{it.avisos.map((a, i) => <div key={i}>⚠ {a}</div>)}</div>}
                {it.tipo === "FOLHA" && it.matriz && !it.matriz.semMatriz && (() => {
                  const m = mtz[it.chave] || {};
                  const apelidos = it.matriz.ok.filter((x) => x.apelido);
                  return it.matriz.faltam.length ? (
                    <div className="text-xs mb-2 p-2.5 rounded-lg" style={{ background: C.redSoft, border: `1px solid ${C.red}44` }}>
                      <div className="font-bold mb-1.5" style={{ color: C.red }}>⚠ {it.matriz.faltam.length} funcionário(s) da folha não estão na Matriz de custos</div>
                      {it.matriz.faltam.map((f) => (
                        <div key={f.codigo} className="flex flex-wrap items-center gap-2 py-1" style={{ borderTop: `1px solid ${C.red}22` }}>
                          <span className="font-semibold flex-1" style={{ color: C.text, minWidth: 200 }}>{f.nome}<span className="font-normal" style={{ color: C.sub }}> · {f.funcao || "—"}{f.salario > 0 ? ` · salário ${brl(f.salario)}` : ""}{f.adiantamento ? " · adiantamento" : ""}</span></span>
                          {f.acao === "INCLUIR" && !(f.salario > 0) && (
                            <span className="flex items-center gap-1" style={{ color: C.sub }}>salário
                              <Valor value={m.salarios?.[f.codigo] || 0} width={90} onChange={(v) => setMtz((x) => ({ ...x, [it.chave]: { ...m, salarios: { ...(m.salarios || {}), [f.codigo]: v } } }))} />
                            </span>
                          )}
                          <span style={{ color: C.sub }}>{f.acao === "NOMEAR" ? `dar nome à vaga "${f.cargoMatriz}"` : "incluir no setor"}</span>
                          {f.acao === "INCLUIR" && (
                            <select value={m.deptos?.[f.codigo] || f.depto} onChange={(e) => setMtz((x) => ({ ...x, [it.chave]: { ...m, deptos: { ...(m.deptos || {}), [f.codigo]: e.target.value } } }))}
                              className="rounded px-1.5 py-0.5 text-xs outline-none" style={inpS}>
                              {DEPTOS_M.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => corrigirMatriz(it)} disabled={!!m.st} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.red, color: "#fff" }}>
                          {m.st ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {m.st || "Corrigir a Matriz agora"}
                        </button>
                        <span className="text-[11px]" style={{ color: C.sub }}>Entra na Matriz oficial (com histórico de versão) com o salário e a função da folha; as contas de pessoal são recalculadas.</span>
                      </div>
                      {m.erro && <div className="mt-1" style={{ color: C.red }}>{m.erro}</div>}
                    </div>
                  ) : (
                    <div className="text-xs mb-2 p-2 rounded" style={{ background: C.greenSoft, color: C.text }}>
                      ✓ Todos os {it.matriz.ok.length} funcionários da folha estão na Matriz de custos.
                      {apelidos.length > 0 && <span style={{ color: C.sub }}> Casados pelo apelido: {apelidos.map((x) => `${x.folha.split(" ")[0]} = ${x.matriz}`).join(", ")}.</span>}
                      {m.msg && <div className="font-semibold mt-0.5" style={{ color: C.green }}>{m.msg}</div>}
                    </div>
                  );
                })()}
                {it.tipo === "FOLHA" && it.matriz?.foraDaFolha?.length > 0 && (
                  <div className="text-[11px] mb-2" style={{ color: C.sub }}>Na Matriz (CLT) e fora desta folha: {it.matriz.foraDaFolha.join(", ")} — confira se saiu da empresa.</div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span style={{ color: C.sub }}>Conta de {it.comp ? nomeMes(it.comp) : "?"}:</span>
                  <select value={e.destino ?? "IGNORAR"} onChange={(ev) => muda(it.chave, { destino: ev.target.value })} className="rounded px-2 py-1.5 text-xs outline-none flex-1" style={{ ...inpS, minWidth: 280 }}>
                    {it.opcoes.map((o) => <option key={o.id} value={o.id}>{o.titulo} · {o.parceiro} · vence {dBR(o.vencimento)} · R$ {brl(o.valor)}{o.status === "PAGO" ? " · baixada" : ""}</option>)}
                    <option value="CRIAR">— criar nova conta —</option>
                    <option value="IGNORAR">— não aplicar —</option>
                  </select>
                </div>
                {alvo && (
                  <div className="text-xs mt-1.5" style={{ color: C.sub }}>
                    {alvo.status === "PAGO" ? "Já baixada — só o documento será anexado." : <>Valor: <s>{moeda(alvo.valor)}</s> → <b style={{ color: C.green }}>{moeda(it.valor)}</b> · fica confirmado e o PDF vai anexado</>}
                  </div>
                )}
                {alvo && alvo.status !== "PAGO" && it.rateio?.length > 0 && (
                  <div className="text-[11px] mt-1" style={{ color: C.sub }}>
                    Novo rateio (pelo líquido de cada setor): {it.rateio.map((x) => `${contasPorId[x.contaId] ? `${contasPorId[x.contaId].codigo} ${contasPorId[x.contaId].nome}` : x.contaId} ${brl(x.pct)}%`).join(" · ")}
                  </div>
                )}
                {e.destino === "CRIAR" && (
                  <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: "2fr 1.5fr 1fr" }}>
                    <input value={e.criar?.titulo || ""} onChange={(ev) => mudaCriar(it.chave, { titulo: ev.target.value.toUpperCase() })} placeholder="Título" className={inp} style={inpS} />
                    <input value={e.criar?.parceiro || ""} onChange={(ev) => mudaCriar(it.chave, { parceiro: ev.target.value.toUpperCase() })} placeholder="Fornecedor / pessoa" className={inp} style={inpS} />
                    <input type="date" value={e.criar?.vencimento || ""} onChange={(ev) => mudaCriar(it.chave, { vencimento: ev.target.value })} className={inp} style={inpS} />
                    <div style={{ gridColumn: "1 / -1" }}>
                      <ContaSelect conta={contasPorId[e.criar?.contaId]} contas={contas} onPick={(id) => mudaCriar(it.chave, { contaId: id })} />
                      {!e.criar?.contaId && <div className="text-[11px] mt-0.5" style={{ color: C.red }}>Escolha a conta-caixa (obrigatória).</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {erro && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* ---------------- importação da posição de títulos (sistema antigo) ---------------- */
const SIT_POS = {
  NOVO: ["Novo", C.green, C.greenSoft],
  RECORRENCIA: ["Previsão de recorrência", C.roxo, C.roxoSoft],
  DUPLICADO: ["Já existe", C.red, C.redSoft],
  REPETIDO: ["Repetido na planilha", C.yellow, C.yellowSoft],
  JA_IMPORTADO: ["Já importado", C.sub, C.panel2],
};
const DEC_POS = { IMPORTAR: "Importar", SUBSTITUIR: "Substituir a previsão", IGNORAR: "Ignorar" };
function PosicaoModal({ user, contas, onClose, onSalvo }) {
  const [a, setA] = useState(null);          // resultado da análise
  const [l, setL] = useState([]);
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const ref = useRef(null);
  const contasPorId = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas]);
  const ler = async (f) => {
    if (!f) return;
    setErro(""); setSt("Lendo e conferindo duplicidades…");
    try {
      const r = await api("/api/fin/titulos/posicao", "POST", { usuarioId: user.id, acao: "analisar", conteudo: await readB64(f) });
      setA({ ...r, arquivo: f.name }); setL(r.linhas);
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const alt = (i, k, v) => setL((x) => x.map((y) => (y.linha === i ? { ...y, [k]: v } : y)));
  const vis = l.filter((x) => filtro === "TODOS" || x.situacao === filtro || (filtro === "SEM_CONTA" && !x.contaId && (x.decisao === "IMPORTAR" || x.decisao === "SUBSTITUIR")));
  const n = (dec) => l.filter((x) => x.decisao === dec);
  const soma = (arr) => arr.reduce((s, x) => s + x.valor, 0);
  // conta-caixa obrigatória: nova conta, ou previsão de recorrência que ainda não tem rateio
  const precisaConta = (x) => !x.contaId && (x.decisao === "IMPORTAR" || x.decisao === "SUBSTITUIR");
  const semConta = l.filter(precisaConta).length;
  const importar = async () => {
    setSt("Importando…"); setErro("");
    try {
      const r = await api("/api/fin/titulos/posicao", "POST", { usuarioId: user.id, acao: "importar", linhas: l });
      onSalvo(`Posição importada: ${r.criadas} conta(s) nova(s) (${moeda(r.valorCriado)})${r.substituidas ? `, ${r.substituidas} previsão(ões) de recorrência atualizada(s) (${moeda(r.valorSubstituido)})` : ""}${r.ignoradas ? `, ${r.ignoradas} ignorada(s)` : ""}${r.jaExistiam ? `, ${r.jaExistiam} já existiam` : ""}.`);
    } catch (e) { setErro(e.message); setSt(""); }
  };
  return (
    <Modal titulo="Importar posição de títulos (sistema antigo)" icone={FileSpreadsheet} onClose={onClose} largura={1180}
      rodape={a ? <>
        <span className="text-xs mr-auto" style={{ color: C.sub }}>{n("IMPORTAR").length} nova(s) · {moeda(soma(n("IMPORTAR")))} — {n("SUBSTITUIR").length} substituição(ões) · {moeda(soma(n("SUBSTITUIR")))} — {n("IGNORAR").length} ignorada(s)</span>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP onClick={importar} disabled={!!st || semConta > 0 || !(n("IMPORTAR").length + n("SUBSTITUIR").length)}>{st && <Loader2 size={14} className="animate-spin" />} Importar</BtnP>
      </> : null}>
      {!a && (
        <div className="text-center py-10">
          <FileSpreadsheet size={36} className="mx-auto mb-3" style={{ color: C.accent }} />
          <div className="text-sm mb-1" style={{ color: C.text }}>Envie a <b>Posição de Títulos (Analítico)</b> exportada do sistema antigo (.xls ou .xlsx).</div>
          <div className="text-xs mb-4" style={{ color: C.sub }}>Antes de gravar, o sistema confere cada linha contra as contas já lançadas, as NFs e as previsões das recorrências.</div>
          <BtnP onClick={() => ref.current?.click()} disabled={!!st}>{st ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {st || "Escolher planilha"}</BtnP>
          <input ref={ref} type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => { ler(e.target.files[0]); e.target.value = ""; }} />
        </div>
      )}
      {a && (
        <>
          <div className="text-xs mb-2" style={{ color: C.sub }}>
            <b style={{ color: C.navy }}>{a.arquivo}</b> · {l.length} título(s) em aberto · {moeda(a.total)} · contas a <b>{(a.tipos || []).join(" e ").toLowerCase()}</b>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[["TODOS", "Todos", l.length], ...Object.keys(SIT_POS).filter((k) => a.resumo[k]).map((k) => [k, SIT_POS[k][0], a.resumo[k].qtd]), ...(semConta ? [["SEM_CONTA", "Sem conta-caixa", semConta]] : [])].map(([k, t, q]) => (
              <button key={k} onClick={() => setFiltro(k)} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={filtro === k ? { background: C.navy, color: "#fff" } : { background: (SIT_POS[k] || [])[2] || C.panel2, color: (SIT_POS[k] || [])[1] || C.text }}>{t} · {q}</button>
            ))}
          </div>
          <div className="overflow-auto rounded-lg" style={{ maxHeight: "58vh", border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: C.panel2 }}><tr style={{ color: C.sub }}>
                {["Linha", "Vencimento", "Título / descrição", "Parceiro", "Valor", "Situação", "Decisão", "Conta-caixa"].map((h) => <th key={h} className={`px-2 py-2 font-semibold ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>{vis.map((x) => {
                const [st0, c0, bg0] = SIT_POS[x.situacao] || [x.situacao, C.sub, C.panel2];
                const opcoes = x.situacao === "JA_IMPORTADO" ? ["IGNORAR"] : x.situacao === "RECORRENCIA" && x.alvo?.status !== "PAGO" ? ["SUBSTITUIR", "IMPORTAR", "IGNORAR"] : ["IMPORTAR", "IGNORAR"];
                return (
                  <tr key={x.linha} style={{ borderBottom: `1px solid ${C.line}`, opacity: x.decisao === "IGNORAR" ? 0.55 : 1 }}>
                    <td className="px-2 py-1.5" style={{ color: C.sub }}>{x.linha}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-semibold" style={{ color: x.vencimento < hojeISO() ? C.red : C.text }}>{dBR(x.vencimento)}</td>
                    <td className="px-2 py-1.5" style={{ maxWidth: 280 }}>
                      <div className="font-semibold truncate" style={{ color: C.navy }} title={x.titulo}>{x.titulo}</div>
                      <div style={{ color: C.sub }}>{x.tituloOrig}</div>
                      {x.motivo && <div className="mt-0.5" style={{ color: c0 }}>{x.motivo}</div>}
                    </td>
                    <td className="px-2 py-1.5" style={{ maxWidth: 180 }}><div className="truncate" title={x.parceiro}>{x.parceiro}</div></td>
                    <td className="px-2 py-1.5 text-right font-bold whitespace-nowrap">{brl(x.valor)}</td>
                    <td className="px-2 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: c0, background: bg0 }}>{st0}</span></td>
                    <td className="px-2 py-1.5">
                      <select value={x.decisao} onChange={(e) => alt(x.linha, "decisao", e.target.value)} className="rounded px-1.5 py-1 text-xs outline-none" style={inpS} disabled={opcoes.length === 1}>
                        {opcoes.map((o) => <option key={o} value={o}>{DEC_POS[o]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5" style={{ minWidth: 220 }}>
                      {x.decisao === "IGNORAR" ? <span style={{ color: C.sub }}>—</span> : (
                        <>
                          <ContaSelect conta={contasPorId[x.contaId]} contas={contas} onPick={(id) => { alt(x.linha, "contaId", id); alt(x.linha, "origemConta", "ESCOLHIDA"); }} />
                          {x.origemConta && x.origemConta !== "ESCOLHIDA" && <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>sugestão: {x.origemConta.toLowerCase()}</div>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {semConta > 0 && <div className="mt-2 text-xs font-semibold" style={{ color: C.red }}>{semConta} linha(s) sem conta-caixa — o rateio é obrigatório. Escolha a conta (filtro "Sem conta-caixa") ou marque Ignorar para liberar a importação.</div>}
        </>
      )}
      {erro && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* ---------------- ações em lote ---------------- */
function LoteModal({ acao, P, itens, onClose, onOk }) {
  const [dt, setDt] = useState(hojeISO());
  const [s, setS] = useState(false);
  const baixar = acao === "baixar";
  const total = itens.reduce((a, t) => a + t.valor, 0);
  const zerados = itens.filter((t) => !(t.valor > 0)).length;
  const viramCancel = itens.filter((t) => t.recorrenciaId || (ehSemana(t) && t.vencimento >= "2026-10-09")).length;
  return (
    <Modal titulo={baixar ? `${P ? "Baixar" : "Receber"} ${itens.length} conta(s)` : `Excluir ${itens.length} conta(s)`} icone={baixar ? CheckCircle2 : Trash2} onClose={onClose} largura={520}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP disabled={s} onClick={async () => { setS(true); await onOk(acao, baixar ? dt : undefined); setS(false); }}>{s && <Loader2 size={14} className="animate-spin" />} Confirmar</BtnP></>}>
      <div className="text-sm mb-3" style={{ color: C.text }}>Total selecionado: <b>{moeda(total)}</b></div>
      <div className="rounded-lg mb-3 overflow-y-auto" style={{ maxHeight: 220, border: `1px solid ${C.line}` }}>
        {itens.map((t) => (
          <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ borderBottom: `1px solid ${C.line}` }}>
            <span className="tabular-nums" style={{ color: C.sub, width: 70 }}>{dBR(t.vencimento)}</span>
            <span className="flex-1 truncate">{t.titulo}</span>
            <span className="font-semibold tabular-nums">{brl(t.valor)}</span>
          </div>
        ))}
      </div>
      {baixar ? (
        <>
          <Campo t={P ? "Data do pagamento" : "Data do recebimento"} dica="cada conta é baixada pelo próprio valor">
            <input type="date" value={dt} onChange={(e) => setDt(e.target.value)} className={inp} style={{ ...inpS, maxWidth: 200 }} />
          </Campo>
          {zerados > 0 && <div className="mt-2 text-xs" style={{ color: C.yellow }}>{zerados} conta(s) sem valor serão puladas.</div>}
        </>
      ) : (
        <div className="text-xs p-2.5 rounded-lg" style={{ background: C.redSoft, color: C.red }}>
          As contas e seus anexos serão apagados.{viramCancel > 0 && ` ${viramCancel} de recorrência ou da semana viram CANCELADAS (para o sistema não recriar).`}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- anexos da conta ---------------- */
function Anexos({ user, tituloId, pendentes, setPendentes }) {
  const [l, setL] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (tituloId) api(`/api/fin/titulos/${tituloId}/anexos?u=${user.id}`).then((j) => setL(j.anexos)).catch((e) => setErro(e.message)); }, [tituloId]);
  const escolher = async (files) => {
    setErro("");
    const arr = [...files].filter((f) => f.size > 0);
    const grande = arr.find((f) => f.size > 15 * 1024 * 1024);
    if (grande) { setErro(`${grande.name}: maior que 15 MB.`); return; }
    if (!tituloId) { setPendentes((x) => [...x, ...arr]); return; }   // conta nova: sobe depois de salvar
    setEnviando(true);
    try {
      for (const f of arr) {
        const a = await api(`/api/fin/titulos/${tituloId}/anexos`, "POST", { usuarioId: user.id, nome: f.name, mime: f.type, conteudo: await readB64(f) });
        setL((x) => [...(x || []), a]);
      }
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };
  const apagar = async (a) => {
    if (!confirm(`Remover o anexo "${a.nome}"?`)) return;
    try { await api(`/api/fin/titulos/${tituloId}/anexos`, "DELETE", { usuarioId: user.id, anexoId: a.id }); setL((x) => x.filter((y) => y.id !== a.id)); } catch (e) { setErro(e.message); }
  };
  const url = (a, baixar) => `/api/fin/titulos/${tituloId}/anexos?u=${user.id}&anexo=${a.id}${baixar ? "&baixar=1" : ""}`;
  return (
    <div className="mt-4 p-3 rounded-lg" style={{ background: C.panel2 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold flex items-center gap-1" style={{ color: C.navy }}><Paperclip size={13} /> Anexos</div>
        <button onClick={() => ref.current?.click()} disabled={enviando} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.accent }}>
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Anexar arquivo
        </button>
        <input ref={ref} type="file" multiple className="hidden" onChange={(e) => { escolher(e.target.files); e.target.value = ""; }} />
      </div>
      {(l || []).map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-xs py-1">
          <FileText size={13} style={{ color: C.sub }} />
          <a href={url(a)} target="_blank" rel="noreferrer" className="flex-1 truncate underline" style={{ color: C.blue }}>{a.nome}</a>
          <span style={{ color: C.sub }}>{kb(a.tamanho)}</span>
          <a href={url(a, true)} title="Baixar" style={{ color: C.sub }}><Download size={13} /></a>
          <button onClick={() => apagar(a)} title="Remover" style={{ color: C.sub }}><Trash2 size={13} /></button>
        </div>
      ))}
      {pendentes.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-1">
          <FileText size={13} style={{ color: C.sub }} />
          <span className="flex-1 truncate">{f.name}</span>
          <span style={{ color: C.sub }}>{kb(f.size)} · sobe ao salvar</span>
          <button onClick={() => setPendentes((x) => x.filter((_, j) => j !== i))} title="Tirar" style={{ color: C.sub }}><X size={13} /></button>
        </div>
      ))}
      {tituloId && l && !l.length && !pendentes.length && <div className="text-xs" style={{ color: C.sub }}>Nenhum arquivo anexado.</div>}
      {!tituloId && !pendentes.length && <div className="text-xs" style={{ color: C.sub }}>Boleto, NF, comprovante… (até 15 MB cada)</div>}
      {erro && <div className="mt-1 text-xs" style={{ color: C.red }}>{erro}</div>}
    </div>
  );
}

/* ---------------- novo / editar ---------------- */
function TituloModal({ user, tipo, item, d, onClose, onSalvo }) {
  const P = tipo === "PAGAR";
  const novo = !item;
  const [f, setF] = useState(() => item ? { ...item } : { titulo: "", parceiro: "", documento: "", numeroDoc: "", valor: 0, vencimento: hojeISO(), previsao: false, rateio: [{ contaId: null, pct: 100 }], observacao: "", formaPagamento: "", recorrente: false, fim: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [pendentes, setPendentes] = useState([]);   // anexos escolhidos antes de a conta existir
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // "usar como regra": quando a conta-caixa muda, oferece levar a mesma conta para as demais contas do fornecedor
  const contaNova = (() => { const r = (f.rateio || []).filter((x) => x.contaId && Number(x.pct) > 0); return r.length === 1 ? r[0].contaId : null; })();
  const contaAntes = (item?.rateio || []).length === 1 ? item.rateio[0].contaId : null;
  const ofereceRegra = !!contaNova && contaNova !== contaAntes && !ehSemana(item || {}) && !!String(f.parceiro || f.titulo || "").trim();
  const [regra, setRegra] = useState({ usar: true, salvar: true, termo: "" });
  const termoRegra = regra.termo || String(f.parceiro || "").toUpperCase();
  const [previa, setPrevia] = useState(null);
  useEffect(() => {
    if (!ofereceRegra || !termoRegra.trim()) { setPrevia(null); return; }
    const h = setTimeout(() => {
      api("/api/fin/titulos/regra", "POST", { usuarioId: user.id, tipo, termo: termoRegra, contaId: contaNova, exceto: item?.id, dryRun: true })
        .then(setPrevia).catch(() => setPrevia(null));
    }, 400);
    return () => clearTimeout(h);
  }, [ofereceRegra, termoRegra, contaNova]);
  const [fT] = FORMA[item?.forma] || ["Manual"];
  // natureza do lançamento: conta comum ou prestador (vai para a conta da próxima sexta)
  const [nat, setNat] = useState("");
  const [avulso, setAvulso] = useState(null);   // { tituloId, sexta }
  const [abrindo, setAbrindo] = useState(false);
  const mudou = useRef(false);
  const escolherNat = async (v) => {
    setNat(v); setErro("");
    if (!v) { setAvulso(null); return; }
    setAbrindo(true);
    try {
      const g = v === "FREELANCER" ? "FREELANCER" : "FACCAO";
      const j = await api(`/api/fin/semana?u=${user.id}&proximaSexta=1&grupo=${g}`);
      setAvulso({ tituloId: j.tituloId, sexta: j.sexta });
    } catch (e) { setErro(e.message); setNat(""); }
    setAbrindo(false);
  };
  // fornecedor conhecido: preenche CNPJ e o último rateio
  const escolherParceiro = (v) => {
    s("parceiro", v.toUpperCase());
    const p = (d?.parceiros || []).find((x) => x.parceiro === v.toUpperCase());
    if (p?.documento && !f.documento) s("documento", p.documento);
  };
  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      if (novo) {
        const r = await api("/api/fin/titulos", "POST", { usuarioId: user.id, tipo, ...f });
        if (r.id && pendentes.length) {
          for (const arq of pendentes) await api(`/api/fin/titulos/${r.id}/anexos`, "POST", { usuarioId: user.id, nome: arq.name, mime: arq.type, conteudo: await readB64(arq) });
        }
      }
      else await api(`/api/fin/titulos/${item.id}`, "PATCH", { usuarioId: user.id, acao: "editar", titulo: f.titulo, parceiro: f.parceiro, documento: f.documento, numeroDoc: f.numeroDoc, valor: f.valor, vencimento: f.vencimento, previsao: f.previsao, rateio: f.rateio, observacao: f.observacao });
      let extra = "";
      if (ofereceRegra && (regra.usar || regra.salvar) && termoRegra.trim()) {
        const r = await api("/api/fin/titulos/regra", "POST", { usuarioId: user.id, tipo, termo: termoRegra, contaId: contaNova, exceto: item?.id, salvarRegra: regra.salvar, dryRun: !regra.usar });
        extra = `${regra.usar && r.qtd ? ` ${r.qtd} outra(s) conta(s) passaram para a mesma conta-caixa.` : ""}${regra.salvar ? " Palavra-chave salva." : ""}`;
      }
      onSalvo((novo ? (f.recorrente ? "Conta recorrente criada — previsões lançadas nos próximos meses." : "Conta lançada.") : "Conta atualizada.") + extra);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  // freelancer/terceirizado: as mesmas regras do lançamento semanal, na conta da próxima sexta
  if (avulso) return (
    <SemanaModal user={user} tituloId={avulso.tituloId}
      onClose={() => (mudou.current ? onSalvo("Lançamento registrado na conta da semana.") : onClose())}
      onMudou={() => { mudou.current = true; }} />
  );

  return (
    <Modal titulo={novo ? `Nova conta ${P ? "a pagar" : "a receber"}` : "Editar conta"} icone={P ? TrendingDown : TrendingUp} onClose={onClose} largura={680}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button><BtnP onClick={salvar} disabled={salvando}>{salvando && <Loader2 size={14} className="animate-spin" />} Salvar</BtnP></>}>
      <datalist id="parceiros-lst">{(d?.parceiros || []).map((p) => <option key={p.parceiro} value={p.parceiro} />)}</datalist>
      {novo && P && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: C.panel2 }}>
          <Campo t="Natureza do lançamento" dica="freelancer e terceirizado vão para a conta da próxima sexta">
            <div className="flex flex-wrap gap-2">
              {[["", "Conta comum"], ["FREELANCER", "Freelancer"], ["TERCEIRIZADO", "Terceirizado"]].map(([k, n]) => (
                <button key={k || "COMUM"} onClick={() => escolherNat(k)} disabled={abrindo}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={nat === k ? { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` } : { border: `1px solid ${C.line}`, color: C.text, background: C.panel }}>
                  {n}
                </button>
              ))}
              {abrindo && <span className="self-center text-xs flex items-center gap-1" style={{ color: C.sub }}><Loader2 size={13} className="animate-spin" /> abrindo a semana…</span>}
            </div>
          </Campo>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Campo t="Título"><input value={f.titulo} onChange={(e) => s("titulo", e.target.value.toUpperCase())} className={inp} style={inpS} placeholder="EX.: ALUGUEL GALPÃO" autoFocus /></Campo></div>
        <Campo t={P ? "Fornecedor" : "Cliente"}><input list="parceiros-lst" value={f.parceiro} onChange={(e) => escolherParceiro(e.target.value)} className={inp} style={inpS} /></Campo>
        <Campo t="CNPJ / CPF"><input value={fmtDoc(f.documento)} onChange={(e) => s("documento", e.target.value.replace(/\D/g, ""))} className={inp} style={inpS} /></Campo>
        <Campo t="Valor"><Valor value={f.valor} onChange={(v) => s("valor", v)} width="100%" /></Campo>
        <Campo t="Vencimento"><input type="date" value={f.vencimento} onChange={(e) => s("vencimento", e.target.value)} className={inp} style={inpS} /></Campo>
        <Campo t="Nº do documento" dica="NF, boleto, parcela"><input value={f.numeroDoc || ""} onChange={(e) => s("numeroDoc", e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo>
        <div className="flex items-end pb-1.5"><Chave on={!!f.previsao} set={(v) => s("previsao", v)} t="Previsão (valor estimado)" cor={C.roxo} /></div>
        <div className="col-span-2"><Campo t="Rateio" dica="conta-caixa onde a conta entra na DRE"><Rateio contas={d?.contas || []} valor={f.valor} value={f.rateio} onChange={(v) => s("rateio", v)} /></Campo></div>
        <div className="col-span-2"><Campo t="Forma de pagamento" dica="ajuda a casar com o extrato">
          <select value={f.formaPagamento || ""} onChange={(e) => s("formaPagamento", e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }}>
            <option value="">—</option>
            {Object.entries(FORMAS_PGTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo t="Observação"><input value={f.observacao || ""} onChange={(e) => s("observacao", e.target.value)} className={inp} style={inpS} /></Campo></div>
      </div>
      {novo ? (
        <div className="mt-4 p-3 rounded-lg" style={{ background: f.recorrente ? C.roxoSoft : C.panel2 }}>
          <Chave on={!!f.recorrente} set={(v) => setF((x) => ({ ...x, recorrente: v, previsao: v ? true : x.previsao }))} t="Conta recorrente (todo mês)" cor={C.roxo} />
          {f.recorrente && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <Campo t="Até (opcional)" dica="vazio = sem fim"><input type="month" value={f.fim} onChange={(e) => s("fim", e.target.value)} className={inp} style={inpS} /></Campo>
              <div style={{ color: C.sub }} className="self-end pb-1">Vence todo dia <b>{Number(f.vencimento.slice(8, 10))}</b>. Lança previsões nos próximos 12 meses; no início de cada mês o sistema pede para conferir o valor.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-[11px] p-2.5 rounded-lg" style={{ background: C.panel2, color: C.sub }}>
          Origem: <b>{ehImportacao(item) ? `IMPORTAÇÃO ${new Date(item.createdAt).toLocaleDateString("pt-BR")} · ${fT}` : fT}</b> · lançado por {item.criadoPorNome || "—"} em {new Date(item.createdAt).toLocaleString("pt-BR")}
          {item.atualizadoPorNome && <> · última alteração: {item.atualizadoPorNome} em {new Date(item.updatedAt).toLocaleString("pt-BR")}</>}
          {item.recorrenciaId && <div className="mt-1">Conta recorrente: alterar aqui muda só {nomeMes(item.competencia)}. Para mudar os próximos meses, use <b>Recorrências</b>.</div>}
        </div>
      )}
      {ofereceRegra && (
        <div className="mt-4 p-3 rounded-lg" style={{ border: `1px dashed ${C.accent}88`, background: C.accentSoft }}>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={regra.usar} onChange={(e) => setRegra((x) => ({ ...x, usar: e.target.checked }))} />
            <Wand2 size={14} style={{ color: C.accent }} /> Usar como regra para as demais contas em aberto
          </label>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs shrink-0" style={{ color: C.sub }}>Contas que contêm</span>
            <input value={termoRegra} onChange={(e) => setRegra((x) => ({ ...x, termo: e.target.value.toUpperCase() }))}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs uppercase font-mono" style={inpS} placeholder="NOME DO FORNECEDOR" />
          </div>
          <div className="text-[11px] mt-1" style={{ color: C.sub }}>
            Procura no fornecedor e no título; várias palavras: separe com ponto e vírgula. Recorrências e contas da semana ficam fora.
            {previa && <> {" "}<b style={{ color: C.navy }}>{previa.qtd} conta(s)</b> mudariam ({moeda(previa.valor)}){previa.semConta ? `, ${previa.semConta} delas sem conta-caixa` : ""}.</>}
          </div>
          <label className="flex items-center gap-2 text-xs mt-2 cursor-pointer" style={{ color: C.text }}>
            <input type="checkbox" checked={regra.salvar} onChange={(e) => setRegra((x) => ({ ...x, salvar: e.target.checked }))} />
            Salvar também como palavra-chave (identificação do extrato e próximas importações)
          </label>
        </div>
      )}
      <Anexos user={user} tituloId={novo ? null : item.id} pendentes={pendentes} setPendentes={setPendentes} />
      {erro && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

function BaixaModal({ t, P, onClose, onOk }) {
  const [dt, setDt] = useState(hojeISO());
  const [v, setV] = useState(t.valor);
  const [s, setS] = useState(false);
  return (
    <Modal titulo={P ? "Registrar pagamento" : "Registrar recebimento"} icone={CheckCircle2} onClose={onClose} largura={420}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button><BtnP disabled={s} onClick={async () => { setS(true); await onOk(dt, v); }}>Confirmar</BtnP></>}>
      <div className="text-sm font-semibold mb-1" style={{ color: C.navy }}>{t.titulo}</div>
      <div className="text-xs mb-4" style={{ color: C.sub }}>{t.parceiro} · vence {dBR(t.vencimento)} · {moeda(t.valor)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Campo t={P ? "Data do pagamento" : "Data do recebimento"}><input type="date" value={dt} onChange={(e) => setDt(e.target.value)} className={inp} style={inpS} /></Campo>
        <Campo t="Valor" dica="com juros/desconto"><Valor value={v} onChange={setV} width="100%" /></Campo>
      </div>
    </Modal>
  );
}


/* ---------------- conta da semana: freelancers e terceirizados ---------------- */
const GRUPO_ROT_FIXO = { FREELANCER: "Freelancer", FACCAO: "Facção", CORTE: "Corte", BORDADO: "Bordado", SILK: "Silk", SUBLIMACAO: "Sublimação", DTF: "DTF", OUTRO: "Outro serviço" };
const rotGrupo = (d, g) => (d?.nomesGrupo || {})[g] || GRUPO_ROT_FIXO[g] || g;
// o cadastro do prestador usa a lista completa: setores (freelancer) ou facção + serviços (terceirizado)
const catCadastro = (d) => d.tipo === "FREELANCER"
  ? (d.catalogos.FREELANCER || [])
  : (d.grupos || []).flatMap((g) => (d.catalogos[g] || []).map((c) => ({
      ...c, grupo: g, n: g === "FACCAO" ? `Facção · ${c.n}` : `Serviço · ${c.n}`,
    })));

function SemanaModal({ user, tituloId, onClose, onMudou }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [edit, setEdit] = useState(null);   // { item? , grupo }
  const carregar = () => api(`/api/fin/semana?u=${user.id}&titulo=${tituloId}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [tituloId]);

  const apagar = async (it) => {
    if (!confirm(`Apagar o lançamento de ${it.nome}?`)) return;
    try { setD(await api("/api/fin/semana", "DELETE", { usuarioId: user.id, id: it.id, tituloId })); onMudou && onMudou(); }
    catch (e) { setErro(e.message); }
  };

  if (!d && !erro) return <Modal titulo="Conta da semana" icone={CalendarClock} onClose={onClose} largura={980}><div style={{ color: C.sub }}>Carregando…</div></Modal>;
  if (erro && !d) return <Modal titulo="Conta da semana" icone={CalendarClock} onClose={onClose} largura={980}><div className="p-3 rounded" style={{ background: C.redSoft, color: C.red }}>{erro}</div></Modal>;

  const sexta = dBR(String(d.titulo.vencimento).slice(0, 10));
  return (
    <Modal titulo={`${d.titulo.nome} · sexta ${sexta}`} icone={CalendarClock} onClose={onClose} largura={1040}
      rodape={<>
        <span className="mr-auto font-bold" style={{ color: C.navy }}>Total da semana {moeda(d.total)}</span>
        <BtnP onClick={onClose}>Fechar</BtnP>
      </>}>
      {erro && <div className="p-2 mb-3 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {d.grupos.map((g) => (
          <button key={g} onClick={() => setEdit({ grupo: g })} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ border: `1px solid ${C.accent}`, color: C.accent, background: C.panel }}>
            <Plus size={14} /> {rotGrupo(d, g)}
          </button>
        ))}
        <div className="flex-1" />
        {d.grupos.map((g) => d.porGrupo[g] ? (
          <span key={g} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: C.panel2, color: C.sub }}>
            {rotGrupo(d, g)} {moeda(d.porGrupo[g])}
          </span>
        ) : null)}
      </div>

      {!d.itens.length && <div className="text-sm text-center py-8" style={{ color: C.sub }}>
        Nada lançado nesta semana ainda. Use os botões acima.
      </div>}

      {!!d.itens.length && (
        <div className="rounded-xl overflow-auto" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr style={{ background: C.panel2, color: C.sub }}>
              <th className="px-2 py-2 text-left font-semibold">Prestador</th>
              <th className="px-2 py-2 text-left font-semibold">Setor / peça</th>
              <th className="px-2 py-2 text-left font-semibold">Detalhe</th>
              <th className="px-2 py-2 text-right font-semibold">Valor</th>
              <th className="px-2 py-2"></th>
            </tr></thead>
            <tbody>
              {d.itens.map((it) => (
                <tr key={it.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-2 py-1.5">
                    <div className="font-semibold">{it.nome}</div>
                    <div style={{ color: C.sub }}>{it.grupoNome || rotGrupo(d, it.grupo)} · PIX {it.chavePix}</div>
                  </td>
                  <td className="px-2 py-1.5">{it.setorNome}</td>
                  <td className="px-2 py-1.5" style={{ color: C.sub }}>
                    {it.grupo === "FREELANCER"
                      ? <>
                          <div>{it.dias} dia(s) × {moeda((it.diaria || 0) + (it.transporte || 0))}{it.transporte ? ` (diária ${moeda(it.diaria)} + transporte ${moeda(it.transporte)})` : ""}</div>
                          {!!it.custoExtra && <div style={{ color: C.yellow }}>custo extra {moeda(it.custoExtra)} · {it.justificativa || "sem justificativa"}</div>}
                        </>
                      : (it.linhas || []).map((l, i) => (
                          <div key={i}>{l.qtd} {l.item || "pç"} × {moeda(l.unitario)} · pedido {l.pedido} = <b style={{ color: C.text }}>{moeda(l.total)}</b></div>
                        ))}
                    {it.descricao && <div>{it.descricao}</div>}
                    {it.vencimentoNegociado && (
                      <div>recebido {dBR(String(it.dataRecebimento).slice(0, 10))} · {it.prazoDias} dia(s) · vence {dBR(String(it.vencimentoNegociado).slice(0, 10))}</div>
                    )}
                    {it.excepcional && <div style={{ color: C.red }}>pagamento excepcional · {it.justificativa || "sem justificativa"}</div>}
                    {it.observacao && <div>{it.observacao}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{moeda(it.valor)}</td>
                  <td className="px-2 whitespace-nowrap">
                    <button onClick={() => setEdit({ item: it, grupo: it.grupo })} title="Editar" className="mr-2" style={{ color: C.sub }}><Pencil size={13} /></button>
                    <button onClick={() => apagar(it)} title="Apagar" style={{ color: C.sub }}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <ItemSemanaModal user={user} tituloId={tituloId} grupo={edit.grupo} item={edit.item}
          tipoPrestador={d.tipo === "FREELANCER" ? "FREELANCER" : "TERCEIRIZADO"}
          rotulo={rotGrupo(d, edit.grupo)} descreve={edit.grupo === d.grupoDescreve}
          catalogo={d.catalogos[edit.grupo] || []} catalogoCadastro={catCadastro(d)} prestadores={d.prestadores}
          onClose={() => setEdit(null)}
          onSalvo={(j) => { setEdit(null); setD(j); onMudou && onMudou(); }} />
      )}
    </Modal>
  );
}

// as colunas da tabela de pedidos: o cabeçalho e a linha usam exatamente as mesmas larguras
const COL = {
  pedido: { width: 150, flex: "0 0 150px" },
  item: { flex: "1 1 0", width: "auto", minWidth: 0 },
  qtd: { width: 80, flex: "0 0 80px" },
  unit: { width: 120, flex: "0 0 120px" },
  total: { width: 110, flex: "0 0 110px" },
  x: { width: 20, flex: "0 0 20px" },
};

/* uma linha da semana: freelancer (diária × dias) ou facção/serviço (pedidos) */
function ItemSemanaModal({ user, tituloId, grupo, rotulo, descreve, item, tipoPrestador, catalogo, catalogoCadastro, prestadores, onClose, onSalvo }) {
  const free = grupo === "FREELANCER";
  const [f, setF] = useState(() => ({
    prestadorId: item?.prestadorId || null,
    nome: item?.nome || "",
    chavePix: item?.chavePix || "",
    setor: item?.setor || "",
    diaria: item?.diaria ?? 0,
    dias: item?.dias ?? 1,
    transporte: item?.transporte ?? 0,
    custoExtra: item?.custoExtra ?? 0,
    justificativa: item?.justificativa || "",
    descricao: item?.descricao || "",
    dataRecebimento: item?.dataRecebimento ? String(item.dataRecebimento).slice(0, 10) : "",
    prazoDias: item?.prazoDias ?? "",
    excepcional: !!item?.excepcional,
    dataPagamento: "",
    linhas: item?.linhas?.length ? item.linhas : [{ pedido: "", item: "", qtd: 0, unitario: 0 }],
    observacao: item?.observacao || "",
  }));
  const [prog, setProg] = useState(null);     // { sexta, vencimento, aviso }
  const [ciente, setCiente] = useState(!!item);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [novoPrestador, setNovoPrestador] = useState(null);   // nome digitado que não existe
  const [lista, setLista] = useState(prestadores);
  const s = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const escolher = (p) => setF((x) => ({
    ...x, prestadorId: p.id, nome: p.nome, chavePix: p.chavePix || x.chavePix,
    setor: x.setor || primeiroSetor(p, grupo, catalogo),
  }));

  const altL = (i, k, v) => setF((x) => ({ ...x, linhas: x.linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const total = free
    ? ((Number(f.diaria) || 0) + (Number(f.transporte) || 0)) * (Number(f.dias) || 0) + (Number(f.custoExtra) || 0)
    : f.linhas.reduce((s2, l) => s2 + (Number(l.qtd) || 0) * (Number(l.unitario) || 0), 0);

  // serviço: recebimento + prazo → a sexta em que o sistema programa o pagamento
  useEffect(() => {
    if (free || !f.dataRecebimento || f.prazoDias === "") { setProg(null); return; }
    let vivo = true;
    fetch(`/api/fin/semana?u=${user.id}&recebimento=${f.dataRecebimento}&prazo=${Number(f.prazoDias) || 0}`)
      .then((r) => r.json()).then((j) => { if (vivo && j.sexta) { setProg(j); setCiente(false); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, [f.dataRecebimento, f.prazoDias, free]);

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const j = await api("/api/fin/semana", "POST", { usuarioId: user.id, tituloId, id: item?.id, item: { ...f, grupo } });
      onSalvo(j);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <Modal titulo={`${item ? "Editar" : "Lançar"} ${String(rotulo || grupo).toLowerCase()}`} icone={Plus} onClose={onClose} largura={820}
      rodape={<>
        <span className="mr-auto font-bold" style={{ color: C.navy }}>
          Total {moeda(total)}
          {prog && !ciente && <span className="ml-2 font-normal text-xs" style={{ color: C.yellow }}>confirme a data do pagamento acima</span>}
        </span>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP onClick={salvar} disabled={salvando || (!!prog && !ciente)}>{salvando && <Loader2 size={14} className="animate-spin" />} Salvar</BtnP>
      </>}>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <Campo t="Prestador" dica="escolha ou cadastre">
          <PrestadorPicker lista={lista} valor={f.nome} onEscolher={escolher}
            onNovo={(nome) => setNovoPrestador(nome)} />
        </Campo>
        <Campo t="Chave PIX"><input value={f.chavePix} onChange={(e) => s("chavePix")(e.target.value)} className={inp} style={{ ...inpS, borderColor: f.chavePix ? C.line : C.yellow }} /></Campo>
        <Campo t={free ? "Setor" : "Tipo de peça / serviço"}>
          <select value={f.setor} onChange={(e) => s("setor")(e.target.value)} className={inp} style={{ ...inpS, borderColor: f.setor ? C.line : C.yellow }}>
            <option value="">—</option>
            {catalogo.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
          </select>
        </Campo>
        {free && <Campo t="Valor da diária"><Valor value={f.diaria} onChange={s("diaria")} width="100%" /></Campo>}
        {free && <Campo t="Transporte por dia" dica="entra no valor do dia"><Valor value={f.transporte} onChange={s("transporte")} width="100%" /></Campo>}
        {free && <Campo t="Dias trabalhados"><input value={f.dias} onChange={(e) => s("dias")(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inp} text-right`} style={inpS} /></Campo>}
        {free && <Campo t="Custo extra" dica="exige justificativa"><Valor value={f.custoExtra} onChange={s("custoExtra")} width="100%" /></Campo>}
      </div>
      {free && (
        <div className="mt-2 text-xs" style={{ color: C.sub }}>
          {f.dias || 0} dia(s) × {moeda((Number(f.diaria) || 0) + (Number(f.transporte) || 0))}
          {Number(f.transporte) > 0 ? ` (diária ${moeda(f.diaria)} + transporte ${moeda(f.transporte)})` : ""}
          {Number(f.custoExtra) > 0 ? ` + extra ${moeda(f.custoExtra)}` : ""}
        </div>
      )}
      {free && Number(f.custoExtra) > 0 && (
        <div className="mt-3"><Campo t="Justificativa do custo extra" dica="obrigatória">
          <input value={f.justificativa} onChange={(e) => s("justificativa")(e.target.value.toUpperCase())} className={inp}
            style={{ ...inpS, borderColor: f.justificativa ? C.line : C.yellow }} placeholder="POR QUE HOUVE ESSE EXTRA?" />
        </Campo></div>
      )}
      {descreve && (
        <div className="mt-3"><Campo t="Descreva o serviço" dica="obrigatório">
          <input value={f.descricao} onChange={(e) => s("descricao")(e.target.value.toUpperCase())} className={inp}
            style={{ ...inpS, borderColor: f.descricao ? C.line : C.yellow }} placeholder="O QUE FOI FEITO" />
        </Campo></div>
      )}

      {!free && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>Pedidos · dá para lançar vários</div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase mb-1" style={{ color: C.sub }}>
            <span style={COL.pedido}>Nº do pedido</span>
            <span style={COL.item}>Item</span>
            <span style={{ ...COL.qtd, textAlign: "right", paddingRight: 8 }}>Qtd</span>
            <span style={{ ...COL.unit, textAlign: "right", paddingRight: 8 }}>Unitário</span>
            <span style={{ ...COL.total, textAlign: "right" }}>Total</span>
            <span style={COL.x} />
          </div>
          {f.linhas.map((l, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input value={l.pedido} onChange={(e) => altL(i, "pedido", e.target.value.toUpperCase())} placeholder="PEDIDO" className={inp} style={{ ...inpS, ...COL.pedido }} />
              <input value={l.item || ""} onChange={(e) => altL(i, "item", e.target.value.toUpperCase())} placeholder="camiseta, polo…" className={inp} style={{ ...inpS, ...COL.item }} />
              <input value={l.qtd} onChange={(e) => altL(i, "qtd", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inp} text-right`} style={{ ...inpS, ...COL.qtd }} />
              <div style={COL.unit}><Valor value={l.unitario} onChange={(v) => altL(i, "unitario", v)} width="100%" /></div>
              <span className="text-xs font-semibold tabular-nums" style={{ ...COL.total, textAlign: "right" }}>
                {moeda((Number(l.qtd) || 0) * (Number(l.unitario) || 0))}
              </span>
              <button type="button" onClick={() => setF((x) => ({ ...x, linhas: x.linhas.filter((_, j) => j !== i) }))}
                style={{ color: C.sub, ...COL.x }}><X size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setF((x) => ({ ...x, linhas: [...x.linhas, { pedido: "", item: "", qtd: 0, unitario: 0 }] }))}
            className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}><Plus size={13} /> Outro pedido</button>
        </div>
      )}

      {!free && (
        <div className="mt-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            <Campo t="Serviço recebido em"><input type="date" value={f.dataRecebimento} onChange={(e) => s("dataRecebimento")(e.target.value)} className={inp} style={{ ...inpS, borderColor: f.dataRecebimento ? C.line : C.yellow }} /></Campo>
            <Campo t="Prazo negociado" dica="dias corridos"><input value={f.prazoDias} onChange={(e) => s("prazoDias")(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${inp} text-right`} style={{ ...inpS, borderColor: f.prazoDias !== "" ? C.line : C.yellow }} /></Campo>
          </div>

          {prog && (
            <div className="mt-3 rounded-lg p-3" style={{ background: f.excepcional ? C.redSoft : C.yellowSoft, border: `1px solid ${(f.excepcional ? C.red : C.yellow)}55` }}>
              <div className="text-sm" style={{ color: C.text }}>{prog.aviso}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={() => { setCiente(true); setF((x) => ({ ...x, excepcional: false, dataPagamento: "" })); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{ background: ciente && !f.excepcional ? C.green : C.panel, color: ciente && !f.excepcional ? "#fff" : C.green, border: `1px solid ${C.green}` }}>
                  Sim, pagar em {dBR(prog.sexta)}
                </button>
                <button type="button" onClick={() => { setCiente(true); setF((x) => ({ ...x, excepcional: true, dataPagamento: x.dataPagamento || prog.vencimento })); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{ background: f.excepcional ? C.red : C.panel, color: f.excepcional ? "#fff" : C.red, border: `1px solid ${C.red}` }}>
                  Pagamento excepcional
                </button>
              </div>
              {f.excepcional && (
                <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
                  <Campo t="Data do pagamento" dica="livre"><input type="date" value={f.dataPagamento} onChange={(e) => s("dataPagamento")(e.target.value)} className={inp} style={{ ...inpS, borderColor: f.dataPagamento ? C.line : C.yellow }} /></Campo>
                  <Campo t="Justificativa" dica="obrigatória"><input value={f.justificativa} onChange={(e) => s("justificativa")(e.target.value.toUpperCase())} className={inp} style={{ ...inpS, borderColor: f.justificativa ? C.line : C.yellow }} /></Campo>
                  <div className="text-[11px] self-end pb-2" style={{ color: C.red }}>O financeiro é avisado na caixa de entrada.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3"><Campo t="Observação"><input value={f.observacao} onChange={(e) => s("observacao")(e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo></div>
      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {novoPrestador !== null && (
        <PrestadorModal user={user} tipo={tipoPrestador} nomeSugerido={novoPrestador}
          catalogo={catalogoCadastro}
          onClose={() => setNovoPrestador(null)}
          onSalvo={(j) => {
            setLista(j.prestadores);
            const p = j.prestador;
            setF((x) => ({ ...x, prestadorId: p.id, nome: p.nome, chavePix: p.chavePix || x.chavePix, setor: x.setor || primeiroSetor(p, grupo, catalogo) }));
            setNovoPrestador(null);
          }} />
      )}
    </Modal>
  );
}

// o setor do prestador que serve para este grupo (freelancer: "COSTURA" · terceirizado: "FACCAO:POLO")
function primeiroSetor(p, grupo, catalogo) {
  for (const s of p.servicos || []) {
    const k = grupo === "FREELANCER" ? s : (String(s).startsWith(`${grupo}:`) ? String(s).slice(grupo.length + 1) : null);
    if (k && catalogo.some((c) => c.k === k)) return k;
  }
  return "";
}

// campo de prestador: lista os cadastrados e abre o cadastro quando o nome é novo
function PrestadorPicker({ lista, valor, onEscolher, onNovo }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) { setAberto(false); setBusca(""); } };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const filtradas = useMemo(() => {
    const b = semAcC(busca).trim();
    return (lista || []).filter((p) => !b || semAcC(p.nome).includes(b));
  }, [lista, busca]);
  return (
    <div ref={caixa} className="relative">
      <input value={aberto ? busca : valor} onFocus={() => { setAberto(true); setBusca(""); }} onClick={() => setAberto(true)}
        onChange={(e) => { setBusca(e.target.value.toUpperCase()); setAberto(true); }}
        placeholder="Clique e escolha, ou digite um nome novo" className={inp} style={{ ...inpS, borderColor: valor ? C.line : C.yellow }} />
      {aberto && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg overflow-auto"
          style={{ background: C.panel, border: `1px solid ${C.line}`, maxHeight: 240, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
          {filtradas.map((p) => (
            <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onEscolher(p); setAberto(false); setBusca(""); }}
              className="w-full text-left px-3 py-1.5 text-sm">
              <div className="font-semibold">{p.nome}</div>
              <div className="text-[11px]" style={{ color: C.sub }}>{p.chavePix}{p.capacidade ? ` · ${p.capacidade} pç/semana` : ""}</div>
            </button>
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onNovo(busca.trim()); setAberto(false); setBusca(""); }}
            className="w-full text-left px-3 py-2 text-sm font-semibold flex items-center gap-1.5"
            style={{ color: C.accent, borderTop: `1px solid ${C.line}` }}>
            <Plus size={13} /> Cadastrar {busca.trim() ? `"${busca.trim()}"` : "um novo"}
          </button>
        </div>
      )}
    </div>
  );
}
const semAcC = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/* ---------------- conferir valores das recorrências ---------------- */
// A conferência do mês é a guia Recorrentes vista mês a mês: o valor que ela mostra é o
// da recorrência, e o que você confirmar aqui volta para lá e desce para o contas a pagar.
function ConferirModal({ user, itens, recorrencias = [], contasPorId, onClose }) {
  const recPorId = useMemo(() => Object.fromEntries(recorrencias.map((r) => [r.id, r])), [recorrencias]);
  const [l, setL] = useState(itens.map((t) => {
    const rec = recPorId[t.recorrenciaId] || null;
    const base = rec ? lerNum(rec.valor) : lerNum(t.valor);   // a recorrência manda
    return { ...t, rec, base, novo: base, soEsteMes: false, feito: false };
  }));
  const [erro, setErro] = useState("");

  const confirmar = async (t) => {
    try {
      const mudou = Math.abs(t.novo - t.base) > 0.009;
      await api(`/api/fin/titulos/${t.id}`, "PATCH", {
        usuarioId: user.id, acao: "confirmar", valor: t.novo,
        // mudou o valor? a recorrência é a base de dados: ela e os meses seguintes acompanham,
        // a não ser que você diga que é exceção só deste mês
        aplicarFuturos: mudou && !t.soEsteMes,
      });
      setL((x) => x.map((y) => (y.id === t.id ? { ...y, feito: true } : y)));
    } catch (e) { setErro(e.message); }
  };

  const pend = l.filter((t) => !t.feito);
  const desatualizados = l.filter((t) => !t.feito && t.rec && Math.abs(lerNum(t.valor) - t.base) > 0.009).length;

  return (
    <Modal titulo="Conferir valores do mês" icone={CalendarClock} onClose={onClose} largura={960}
      rodape={<>
        <span className="mr-auto text-xs" style={{ color: C.sub }}>{pend.length} para conferir</span>
        {pend.length > 0 && <BtnS onClick={async () => { for (const t of pend) await confirmar(t); }}>Confirmar todos ({pend.length})</BtnS>}
        <BtnP onClick={onClose}>Fechar</BtnP>
      </>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>
        O valor que aparece aqui é o da guia <b>Recorrentes</b> — é ela que manda. Confirme se continua igual
        ou digite o novo: a recorrência e os meses seguintes ainda não conferidos acompanham, e o contas a pagar
        deste mês é atualizado. Marque <b>só este mês</b> quando for exceção.
      </div>
      {desatualizados > 0 && (
        <div className="p-2 mb-3 rounded text-xs flex items-start gap-1.5" style={{ background: C.yellowSoft, color: C.yellow }}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          {desatualizados} conta(s) estavam lançadas no contas a pagar com valor diferente do que está em Recorrentes.
          Confirmando, o contas a pagar passa a valer o da recorrência.
        </div>
      )}
      {erro && <div className="p-2 mb-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <table className="w-full text-xs">
        <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
          {["Vencimento", "Conta", "Em Recorrentes", "Valor do mês", "", ""].map((h, i) => <th key={i} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>{l.map((t) => {
          const lancado = lerNum(t.valor);
          const difLancado = t.rec && Math.abs(lancado - t.base) > 0.009;
          const mudou = Math.abs(t.novo - t.base) > 0.009;
          return (
            <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: t.feito ? 0.5 : 1 }}>
              <td className="px-2 py-2 whitespace-nowrap">{dBR(t.vencimento)}</td>
              <td className="px-2 py-2">
                <div className="font-semibold" style={{ color: C.navy }}>{t.titulo}</div>
                <div style={{ color: C.sub }}>{t.parceiro} · {(t.rateio || []).map((r) => contasPorId[r.contaId]?.nome).join(", ")}</div>
                {t.rec && <div style={{ color: C.sub }}>{t.rec.diaUtil ? `${t.rec.diaVencimento}º dia útil${sabTxt({ ...t.rec, titulo: t.rec.titulo || t.titulo })}` : `dia ${t.rec.diaVencimento}`}{(t.rec.periodicidade || 1) > 1 ? ` · ${rotPeriodo(t.rec.periodicidade)}` : ""}{t.rec.formaPagamento ? ` · ${FORMAS_PGTO[t.rec.formaPagamento] || t.rec.formaPagamento}` : ""}</div>}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                {!t.rec ? <span style={{ color: C.sub }}>conta avulsa</span> : <b>{moeda(t.base)}</b>}
                {difLancado && <div style={{ color: C.yellow }}>lançado: {moeda(lancado)}</div>}
              </td>
              <td className="px-2 py-2">{t.feito ? <b>{moeda(t.novo)}</b> : <Valor value={t.novo} onChange={(v) => setL((x) => x.map((y) => (y.id === t.id ? { ...y, novo: v } : y)))} />}</td>
              <td className="px-2 py-2">{!t.feito && mudou && t.rec && (
                <label className="flex items-center gap-1 whitespace-nowrap" title="Não muda a recorrência nem os meses seguintes">
                  <input type="checkbox" checked={t.soEsteMes} onChange={(e) => setL((x) => x.map((y) => (y.id === t.id ? { ...y, soEsteMes: e.target.checked } : y)))} /> só este mês
                </label>
              )}</td>
              <td className="px-2 py-2 text-right">{t.feito ? <span style={{ color: C.green }} className="font-semibold">✓ conferido</span>
                : <button onClick={() => confirmar(t)} className="px-3 py-1 rounded-lg font-semibold text-white whitespace-nowrap" style={{ background: C.accent }}>
                    {mudou ? (t.soEsteMes ? "Só este mês" : "Salvar na recorrência") : "Confirmar"}
                  </button>}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </Modal>
  );
}

/* ---------------- importar XML ---------------- */
const prepararNotas = (lidos) => lidos.map((n) => ({
  ...n,
  titulo: n.modelo === "NF-e" ? `COMPRA NF ${n.numero}` : `SERVIÇO NFS-e ${n.numero}`,
  rateio: n.rateioSugerido || [{ contaId: null, pct: 100 }],
  parcelas: n.parcelas.map((p) => ({ ...p, marcado: !p.jaImportada })),
}));
function XmlModal({ user, tipo, contas, onClose, onSalvo, lidosIniciais }) {
  const [notas, setNotas] = useState(lidosIniciais ? prepararNotas(lidosIniciais) : null);
  const [erros, setErros] = useState([]);
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const ler = async (files) => {
    setSt("Lendo XML…"); setErro("");
    try {
      const arquivos = await Promise.all([...files].map(async (f) => ({ nome: f.name, xml: await f.text() })));
      const j = await api("/api/fin/titulos/xml", "POST", { usuarioId: user.id, tipo, arquivos });
      setErros(j.erros);
      setNotas(prepararNotas(j.lidos));
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const altN = (i, k, v) => setNotas((l) => l.map((n, j) => (j === i ? { ...n, [k]: v } : n)));
  const altP = (i, pi, k, v) => setNotas((l) => l.map((n, j) => (j === i ? { ...n, parcelas: n.parcelas.map((p, q) => (q === pi ? { ...p, [k]: v } : p)) } : n)));
  const itens = (notas || []).flatMap((n) => n.parcelas.filter((p) => p.marcado).map((p) => ({
    titulo: n.parcelas.length > 1 ? `${n.titulo} (${p.parcela}/${n.parcelas.length})` : n.titulo, parceiro: n.parceiro, documento: n.documento,
    numeroDoc: `${n.modelo} ${n.numero}${n.parcelas.length > 1 ? ` · PARC ${p.parcela}` : ""}`, valor: p.valor, vencimento: p.vencimento, rateio: n.rateio,
    chaveImport: p.chaveImport, xml: n.xml, nfId: n.nfId || null, previsao: false,
  })));
  const gravar = async () => {
    setSt("Gravando…"); setErro("");
    try { const j = await api("/api/fin/titulos/xml", "POST", { usuarioId: user.id, tipo, gravar: true, itens }); onSalvo(`${j.criados} conta(s) importada(s)${j.pulados ? ` · ${j.pulados} já existiam` : ""}.`); }
    catch (e) { setErro(e.message); setSt(""); }
  };
  return (
    <Modal titulo={lidosIniciais ? "Lançar notas do Compras" : "Importar XML de compra ou serviço"} icone={FileCode2} onClose={onClose} largura={980}
      rodape={notas && <><span className="mr-auto text-xs" style={{ color: C.sub }}>{itens.length} conta(s) · {moeda(itens.reduce((s, i) => s + i.valor, 0))}</span>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP onClick={gravar} disabled={!itens.length || !!st}>{st && <Loader2 size={14} className="animate-spin" />} Lançar {itens.length} conta(s)</BtnP></>}>
      {!notas && (
        <label className="flex items-center gap-3 p-6 rounded-xl cursor-pointer" style={{ border: `2px dashed ${C.line}` }}>
          <Upload size={22} style={{ color: C.accent }} />
          <div className="text-sm"><div className="font-semibold">Escolher XML (pode selecionar vários)</div><div className="text-xs" style={{ color: C.sub }}>NF-e de compra (com as duplicatas/parcelas) ou NFS-e de serviço.</div></div>
          <input type="file" accept=".xml" multiple className="hidden" onChange={(e) => ler(e.target.files)} />
        </label>
      )}
      {st && !notas && <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> {st}</div>}
      {erro && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {erros.length > 0 && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.yellowSoft, color: C.yellow }}>{erros.join(" · ")}</div>}
      {notas && notas.map((n, i) => (
        <div key={i} className="rounded-xl p-4 mb-3" style={{ border: `1px solid ${C.line}` }}>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs" style={{ color: C.sub }}>
            <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: C.blueSoft, color: C.blue }}>{n.modelo} {n.numero}</span>
            <span>{n.razao} · {fmtDoc(n.documento)} · emissão {dBR(n.emissao)} · total {moeda(n.total)}</span>
            {n.rateioSugerido && <span style={{ color: C.green }}>rateio sugerido pela última conta deste fornecedor</span>}
            {n.nfId && <span style={{ color: C.blue }}>lançada pelo Compras</span>}
            {n.semXml && <span style={{ color: C.yellow }}>nota sem XML — confira parcelas e vencimento</span>}
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Campo t="Título"><input value={n.titulo} onChange={(e) => altN(i, "titulo", e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo>
            <Campo t="Fornecedor"><input value={n.parceiro} onChange={(e) => altN(i, "parceiro", e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo>
            <div className="col-span-2"><Campo t="Rateio"><Rateio contas={contas} valor={n.total} value={n.rateio} onChange={(v) => altN(i, "rateio", v)} /></Campo></div>
          </div>
          <table className="w-full text-xs mt-3">
            <thead><tr style={{ color: C.sub }}><th /><th className="text-left px-2 py-1">Parcela</th><th className="text-left px-2 py-1">Vencimento</th><th className="text-right px-2 py-1">Valor</th><th /></tr></thead>
            <tbody>{n.parcelas.map((p, pi) => (
              <tr key={pi} style={{ borderTop: `1px solid ${C.line}`, opacity: p.marcado ? 1 : 0.5 }}>
                <td className="px-2 py-1"><input type="checkbox" checked={p.marcado} onChange={(e) => altP(i, pi, "marcado", e.target.checked)} /></td>
                <td className="px-2 py-1">{p.parcela}</td>
                <td className="px-2 py-1"><input type="date" value={p.vencimento} onChange={(e) => altP(i, pi, "vencimento", e.target.value)} className="rounded px-2 py-1 text-xs" style={{ ...inpS, borderColor: p.semVencimento ? C.yellow : C.line }} /></td>
                <td className="px-2 py-1 text-right"><Valor value={p.valor} onChange={(v) => altP(i, pi, "valor", v)} /></td>
                <td className="px-2 py-1 text-[10px]">
                  {p.jaImportada && <span style={{ color: C.red }}>já importada</span>}
                  {p.semVencimento && !p.jaImportada && <span style={{ color: C.yellow }}>XML sem vencimento — confira a data</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </Modal>
  );
}

/* ---------------- recorrências a partir da matriz de custos ---------------- */
function MatrizRecModal({ user, contasPorId, onClose, onVoltar }) {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [atu, setAtu] = useState(new Set());
  const [enc, setEnc] = useState(new Set());
  const [inicio, setInicio] = useState(mesAtual());
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState(null);
  useEffect(() => {
    api(`/api/fin/recorrencias/matriz?u=${user.id}`).then((j) => {
      setD(j);
      setSel(new Set(j.propostas.filter((p) => !p.jaExiste).map((p) => p.chave)));
      setAtu(new Set(j.propostas.filter((p) => p.jaExiste && p.mudou).map((p) => p.chave)));
      setEnc(new Set(j.obsoletas.map((o) => o.id)));
    }).catch((e) => setErro(e.message));
  }, []);
  const grupos = useMemo(() => {
    const g = {};
    (d?.propostas || []).forEach((p) => (g[p.grupo] ||= []).push(p));
    return Object.entries(g);
  }, [d]);
  const tog = (k) => setSel((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });
  const escolhidas = (d?.propostas || []).filter((p) => sel.has(p.chave) && !p.jaExiste);
  const nAcoes = escolhidas.length + atu.size + enc.size;
  const togS = (set, k) => set((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });
  const criar = async () => {
    setSt("Gravando…"); setErro("");
    try { const j = await api("/api/fin/recorrencias/matriz", "POST", { usuarioId: user.id, chaves: [...sel], atualizar: [...atu], encerrar: [...enc], inicio }); setFim(j); } catch (e) { setErro(e.message); }
    setSt("");
  };
  return (
    <Modal titulo="Contas recorrentes da Matriz de custos" icone={Grid3x3} onClose={onClose} largura={1000}
      rodape={fim ? <BtnP onClick={onClose}>Concluir</BtnP> : <>
        <button onClick={onVoltar} className="mr-auto px-3 py-2 text-sm" style={{ color: C.sub }}>← Voltar</button>
        <span className="text-xs" style={{ color: C.sub }}>A partir de</span>
        <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded px-2 py-1.5 text-sm" style={inpS} />
        <BtnP onClick={criar} disabled={!nAcoes || !!st}>{st && <Loader2 size={14} className="animate-spin" />}
          {[escolhidas.length && `Criar ${escolhidas.length}`, atu.size && `atualizar ${atu.size}`, enc.size && `encerrar ${enc.size}`].filter(Boolean).join(" · ") || "Nada a fazer"}</BtnP>
      </>}>
      {fim ? (
        <div className="p-4 rounded-lg text-sm" style={{ background: C.greenSoft, color: C.green }}>
          <b>{fim.criadas} criada(s) · {fim.atualizadas} atualizada(s) · {fim.encerradas} encerrada(s)</b> — {fim.geradas} previsões lançadas até 12 meses à frente.
          <div className="mt-1" style={{ color: C.text }}>Elas aparecem na lista como <b>Previsão</b> e com "conferir valor" no mês atual: ajuste dia de vencimento, fornecedor e conta-caixa em <b>Recorrências</b>, e o valor do mês na conferência.</div>
        </div>
      ) : !d ? (erro ? null : <Loader2 size={18} className="animate-spin" />) : (
        <>
          <div className="text-xs mb-3" style={{ color: C.sub }}>
            Montado a partir da matriz <b>oficial</b> (custo do negócio {moeda(d.totalMatriz)}/mês). Os itens marcados como CDB e as provisões do pessoal viram uma única conta, <b>PROVISÃO GERAL (CDB)</b>, no dia 30.
            Os demais têm uma conta cada. Dia de vencimento, fornecedor e conta-caixa vêm sugeridos — ajuste depois em Recorrências.
          </div>
          {d.obsoletas.length > 0 && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: C.yellowSoft }}>
              <div className="text-xs font-semibold mb-1" style={{ color: C.yellow }}>Recorrências geradas antes que não existem mais na matriz (ex.: salário por pessoa) — encerrar:</div>
              {d.obsoletas.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-xs py-0.5">
                  <input type="checkbox" checked={enc.has(o.id)} onChange={() => togS(setEnc, o.id)} /> {o.titulo} <span style={{ color: C.sub }}>· {moeda(o.valor)}</span>
                </label>
              ))}
            </div>
          )}
          {grupos.map(([g, ps]) => {
            const todas = ps.filter((p) => !p.jaExiste).every((p) => sel.has(p.chave));
            return (
              <div key={g} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: C.panel2 }}>
                  <input type="checkbox" checked={todas} onChange={() => setSel((s) => { const x = new Set(s); ps.filter((p) => !p.jaExiste).forEach((p) => (todas ? x.delete(p.chave) : x.add(p.chave))); return x; })} />
                  <b style={{ color: C.navy }}>{g}</b>
                  <span className="text-xs" style={{ color: C.sub }}>· {moeda(ps.reduce((s, p) => s + p.valor, 0))}</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>{ps.map((p) => (
                    <tr key={p.chave} style={{ borderBottom: `1px solid ${C.line}`, opacity: p.jaExiste && !p.mudou ? 0.45 : 1 }}>
                      <td className="px-2 py-1.5 w-6"><input type="checkbox" disabled={p.jaExiste} checked={p.jaExiste || sel.has(p.chave)} onChange={() => tog(p.chave)} /></td>
                      <td className="px-2 py-1.5"><b>{p.titulo}</b>{p.obs && <div style={{ color: C.sub }}>{p.obs}</div>}</td>
                      <td className="px-2 py-1.5" style={{ color: C.sub }}>{p.parceiro}</td>
                      <td className="px-2 py-1.5" style={{ maxWidth: 260 }}>{p.rateio.map((r, i) => <div key={i} className="truncate">{contasPorId[r.contaId] ? `${contasPorId[r.contaId].codigo} ${contasPorId[r.contaId].nome}` : "?"}{p.rateio.length > 1 && ` · ${brl(r.pct)}%`}</div>)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{p.util ? `${p.dia}º dia útil${sabTxt({ chaveOrigem: p.chave, titulo: p.titulo })}` : `dia ${p.dia}`}</td>
                      <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">{brl(p.valor)}{p.jaExiste && p.mudou && <div className="font-normal" style={{ color: C.sub }}>hoje {brl(p.valorAtual)}</div>}</td>
                      <td className="px-2 py-1.5 text-[10px] whitespace-nowrap">
                        {p.jaExiste && p.mudou ? <label className="flex items-center gap-1" style={{ color: C.yellow }}><input type="checkbox" checked={atu.has(p.chave)} onChange={() => togS(setAtu, p.chave)} /> atualizar pela matriz</label>
                          : p.jaExiste ? <span style={{ color: C.green }}>já criada</span> : ""}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            );
          })}
        </>
      )}
      {erro && <div className="p-2 mt-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* ---------------- notas lançadas pelo Compras ---------------- */
function NfsComprasModal({ user, onClose, onLancar }) {
  const [ver, setVer] = useState("pendentes");
  const [l, setL] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [busca, setBusca] = useState("");
  const [antes, setAntes] = useState("");
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const carregar = () => { setL(null); setSel(new Set()); api(`/api/fin/titulos/nfs?u=${user.id}&ver=${ver}`).then(setL).catch((e) => setErro(e.message)); };
  useEffect(carregar, [ver]);
  const vis = (l || []).filter((n) => !busca || `${n.fornecedor} ${n.numero} ${n.cnpj}`.toUpperCase().includes(busca.toUpperCase()));
  const tog = (id) => setSel((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
  const todos = vis.length > 0 && vis.every((n) => sel.has(n.id));
  const acao = async (acao, extra = {}) => {
    setSt("…"); setErro("");
    try {
      const j = await api("/api/fin/titulos/nfs", "POST", { usuarioId: user.id, acao, ids: [...sel], ...extra });
      if (acao === "ler") return onLancar(j.lidos);
      carregar();
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  return (
    <Modal titulo="Notas fiscais lançadas pelo Compras" icone={Inbox} onClose={onClose} largura={980}
      rodape={ver === "pendentes" ? <>
        <span className="mr-auto text-xs" style={{ color: C.sub }}>{sel.size} selecionada(s)</span>
        <BtnS onClick={() => acao("ignorar")} cor={C.sub}><EyeOff size={14} /> Não lançar</BtnS>
        <BtnP onClick={() => acao("ler")} disabled={!sel.size || !!st}>{st && <Loader2 size={14} className="animate-spin" />} Lançar {sel.size || ""} como conta a pagar</BtnP>
      </> : <><span className="mr-auto text-xs" style={{ color: C.sub }}>{sel.size} selecionada(s)</span><BtnP onClick={() => acao("reativar")} disabled={!sel.size}>Voltar para pendentes</BtnP></>}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[["pendentes", "Pendentes"], ["ignoradas", "Marcadas para não lançar"]].map(([k, t]) => (
          <button key={k} onClick={() => setVer(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={ver === k ? { background: C.navy, color: "#fff" } : { border: `1px solid ${C.line}`, color: C.sub }}>{t}</button>
        ))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor, nº, CNPJ…" className="rounded-lg px-3 py-1.5 text-xs outline-none" style={{ ...inpS, width: 220 }} />
        <div className="flex-1" />
        {ver === "pendentes" && (
          <div className="flex items-center gap-1 text-xs" style={{ color: C.sub }}>
            Não lançar as emitidas antes de
            <input type="date" value={antes} onChange={(e) => setAntes(e.target.value)} className="rounded px-2 py-1" style={inpS} />
            <button disabled={!antes} onClick={() => { if (confirm("Marcar todas as notas pendentes emitidas antes dessa data para não lançar?")) acao("ignorarAntes", { data: antes }); }}
              className="px-2 py-1 rounded font-semibold" style={{ border: `1px solid ${C.line}`, opacity: antes ? 1 : 0.5 }}>Aplicar</button>
          </div>
        )}
      </div>
      {erro && <div className="p-2 mb-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!l ? <Loader2 size={18} className="animate-spin" /> : !vis.length ? <div className="text-sm py-8 text-center" style={{ color: C.sub }}>{ver === "pendentes" ? "Nenhuma nota aguardando o financeiro." : "Nenhuma nota marcada."}</div> : (
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
            <th className="px-2 py-1.5"><input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(vis.map((n) => n.id)))} /></th>
            {["Emissão", "Fornecedor", "Nota", "Valor", "Arquivos", "Lançada pelo Compras em"].map((h) => <th key={h} className={`px-2 py-1.5 font-semibold ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>{vis.map((n) => (
            <tr key={n.id} onClick={() => tog(n.id)} className="cursor-pointer hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}`, background: sel.has(n.id) ? C.accentSoft : undefined }}>
              <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={sel.has(n.id)} onChange={() => tog(n.id)} onClick={(e) => e.stopPropagation()} /></td>
              <td className="px-2 py-1.5 whitespace-nowrap">{n.dataEmissao ? dBR(n.dataEmissao) : "—"}</td>
              <td className="px-2 py-1.5"><div className="font-semibold" style={{ color: C.navy }}>{n.fornecedor || "(sem nome)"}</div><div style={{ color: C.sub }}>{fmtDoc(n.cnpj)}</div></td>
              <td className="px-2 py-1.5 whitespace-nowrap"><span className="px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1" style={{ background: n.modelo === "NFSE" ? C.roxoSoft : C.blueSoft, color: n.modelo === "NFSE" ? C.roxo : C.blue }}>{n.modelo === "NFSE" ? "NFS-e" : "NF-e"}</span>{n.numero}</td>
              <td className="px-2 py-1.5 text-right font-semibold">{n.valorTotal != null ? brl(n.valorTotal) : "—"}</td>
              <td className="px-2 py-1.5">{[n.temXml && "XML", n.temPdf && "PDF"].filter(Boolean).join(" + ") || "—"}</td>
              <td className="px-2 py-1.5" style={{ color: C.sub }}>{new Date(n.createdAt).toLocaleDateString("pt-BR")}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Modal>
  );
}

/* ---------------- recorrências ---------------- */
function RecorrenciasModal({ user, d, contasPorId, onClose }) {
  const [daMatriz, setDaMatriz] = useState(false);
  const [l, setL] = useState(d.recorrencias.map((r) => ({ ...r, fim: r.fim || "" })));
  const [edit, setEdit] = useState(null);
  const [erro, setErro] = useState("");
  const salvar = async (r) => {
    try {
      await api(`/api/fin/recorrencias/${r.id}`, "PATCH", { usuarioId: user.id, titulo: r.titulo, parceiro: r.parceiro, valor: r.valor, diaVencimento: r.diaVencimento, diaUtil: !!r.diaUtil, fim: r.fim || null, rateio: r.rateio, ativo: r.ativo });
      setEdit(null); setErro("");
    } catch (e) { setErro(e.message); }
  };
  const encerrar = async (r) => {
    if (!confirm(`Encerrar "${r.titulo}"? As previsões a partir deste mês que ainda não foram conferidas ou pagas serão removidas. As já pagas ficam.`)) return;
    try { await api(`/api/fin/recorrencias/${r.id}`, "DELETE", { usuarioId: user.id }); setL((x) => x.filter((y) => y.id !== r.id)); } catch (e) { setErro(e.message); }
  };
  const alt = (id, k, v) => setL((x) => x.map((y) => (y.id === id ? { ...y, [k]: v } : y)));
  return (
    daMatriz ? <MatrizRecModal user={user} contasPorId={contasPorId} onClose={onClose} onVoltar={() => setDaMatriz(false)} /> :
    <Modal titulo="Contas recorrentes" icone={Repeat} onClose={onClose} largura={1000}
      rodape={<>{d.tipo === "PAGAR" && <span className="mr-auto"><BtnS onClick={() => setDaMatriz(true)}><Grid3x3 size={15} /> Gerar a partir da Matriz de custos</BtnS></span>}<BtnP onClick={onClose}>Fechar</BtnP></>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Alterações aqui valem a partir deste mês, nos meses ainda não conferidos nem pagos. Para criar uma nova, use <b>Nova conta</b> com a chave "Conta recorrente".</div>
      {erro && <div className="p-2 mb-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!l.length ? <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma conta recorrente.</div> : (
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
            {["Título", "Fornecedor", "Conta-caixa", "Valor base", "Vencimento", "Início", "Até", ""].map((h, i) => <th key={i} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>{l.map((r) => {
            const e = edit === r.id;
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td className="px-2 py-1.5">{e ? <input value={r.titulo} onChange={(ev) => alt(r.id, "titulo", ev.target.value.toUpperCase())} className={inp} style={inpS} /> : <b style={{ color: C.navy }}>{r.titulo}</b>}</td>
                <td className="px-2 py-1.5">{e ? <input value={r.parceiro} onChange={(ev) => alt(r.id, "parceiro", ev.target.value.toUpperCase())} className={inp} style={inpS} /> : r.parceiro}</td>
                <td className="px-2 py-1.5" style={{ minWidth: 200 }}>{e ? <Rateio contas={d.contas} valor={r.valor} value={r.rateio} onChange={(v) => alt(r.id, "rateio", v)} /> : (r.rateio || []).map((x) => contasPorId[x.contaId]?.nome).join(", ")}</td>
                <td className="px-2 py-1.5">{e ? <Valor value={r.valor} onChange={(v) => alt(r.id, "valor", v)} width={110} /> : moeda(r.valor)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{e ? <>
                  <input type="number" min={1} max={31} value={r.diaVencimento} onChange={(ev) => alt(r.id, "diaVencimento", Number(ev.target.value))} className="rounded px-2 py-1 w-14" style={inpS} />
                  <label className="flex items-center gap-1 mt-1"><input type="checkbox" checked={!!r.diaUtil} onChange={(ev) => alt(r.id, "diaUtil", ev.target.checked)} /> dia útil</label>
                </> : r.diaUtil ? `${r.diaVencimento}º dia útil${sabTxt(r)}` : `dia ${r.diaVencimento}`}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{nomeMes(r.inicio)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{e ? <input type="month" value={r.fim} onChange={(ev) => alt(r.id, "fim", ev.target.value)} className="rounded px-2 py-1" style={inpS} /> : r.fim ? nomeMes(r.fim) : "sem fim"}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                  {e ? <><button onClick={() => salvar(r)} className="px-2 py-1 rounded font-semibold text-white mr-1" style={{ background: C.accent }}>Salvar</button>
                    <button onClick={() => { setEdit(null); setL(d.recorrencias.map((x) => ({ ...x, fim: x.fim || "" }))); }} className="px-2 py-1" style={{ color: C.sub }}>Cancelar</button></>
                    : <><button onClick={() => setEdit(r.id)} className="mr-2" style={{ color: C.sub }} title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => encerrar(r)} style={{ color: C.red }} title="Encerrar"><Ban size={14} /></button></>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </Modal>
  );
}

/* ============================================================
   ABA RECORRENTES — edição e crítica contra a Matriz de custos
   ============================================================ */
const FORMAS_PGTO = { PIX: "PIX", BOLETO: "Boleto", DEBITO_AUTOMATICO: "Débito automático", TED: "TED/DOC", CARTAO: "Cartão", DINHEIRO: "Dinheiro", CHEQUE: "Cheque" };

function Recorrentes({ user, contasPorId }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [editar, setEditar] = useState(null);
  const [soDivergentes, setSoDivergentes] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = () => api(`/api/fin/recorrentes?u=${user.id}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const resolver = async (r, acao) => {
    const txt = acao === "usarMatriz"
      ? `Trazer o valor da Matriz (${moeda(r.valorMatriz)}) para a conta "${r.titulo}"?`
      : `Levar ${moeda(r.valor)} da conta "${r.titulo}" para a Matriz de custos?`;
    if (!confirm(txt)) return;
    try {
      const j = await api("/api/fin/recorrentes", "POST", { usuarioId: user.id, id: r.id, acao });
      setD(j);
      setAviso({ tipo: "ok", texto: acao === "usarMatriz"
        ? `"${r.titulo}" passou a valer ${moeda(r.valorMatriz)}${j.titulos ? ` · ${j.titulos} previsão(ões) deste mês em diante atualizadas` : ""}.`
        : `Matriz atualizada: ${j.matriz?.item} de ${moeda(j.matriz?.antes)} para ${moeda(j.matriz?.depois)}.` });
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  };

  const excluir = async (r) => {
    const aviso = [
      `Excluir a conta recorrente "${r.titulo}"?`,
      "",
      "As previsões em aberto deste mês em diante também são apagadas.",
      "Contas já pagas ou com valor conferido à mão ficam no histórico.",
      r.daMatriz ? "\nEsta conta vem da Matriz de custos — ela volta a aparecer quando você usar \"Gerar a partir da Matriz\"." : "",
    ].join("\n");
    if (!confirm(aviso)) return;
    try {
      const j = await api("/api/fin/recorrentes", "DELETE", { usuarioId: user.id, id: r.id });
      setD(j);
      setAviso({ tipo: "ok", texto: `"${j.titulo}" excluída`
        + (j.previsoesApagadas ? ` · ${j.previsoesApagadas} previsão(ões) apagada(s) (${moeda(j.valorApagado)})` : " · não havia previsão em aberto")
        + (j.titulosMantidos ? ` · ${j.titulosMantidos} conta(s) já lançada(s) ficaram no histórico` : "")
        + (j.daMatriz ? " · volta se você gerar de novo a partir da Matriz" : "") });
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  };

  if (erro) return <div className="p-3 rounded" style={{ background: C.redSoft, color: C.red }}>{erro}</div>;
  if (!d) return <div style={{ color: C.sub }}>Carregando…</div>;

  const divergentes = d.recorrencias.filter((r) => r.divergente);
  const n = busca.trim().toUpperCase();
  const lista = d.recorrencias.filter((r) => (!soDivergentes || r.divergente) &&
    (!n || [r.titulo, r.parceiro, r.observacao].some((x) => String(x || "").toUpperCase().includes(n))));
  const totalMes = d.recorrencias.filter((r) => r.ativo && r.tipo === "PAGAR").reduce((s, r) => s + r.valor, 0);

  return (
    <div>
      {aviso && (
        <div className="p-3 rounded mb-3 flex items-start gap-2 text-sm"
          style={{ background: aviso.tipo === "ok" ? C.greenSoft : C.redSoft, color: aviso.tipo === "ok" ? C.green : C.red }}>
          <div className="flex-1">{aviso.texto}</div>
          <button onClick={() => setAviso(null)}><X size={14} /></button>
        </div>
      )}

      {divergentes.length > 0 && (
        <div className="px-4 py-3 mb-4 rounded-xl text-sm" style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}55`, color: C.text }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: C.yellow }} />
            <span className="flex-1"><b>{divergentes.length} conta(s) recorrente(s) em desacordo com a Matriz de custos.</b> Em cada uma você escolhe qual valor vale.</span>
            <button onClick={() => setSoDivergentes((x) => !x)} className="font-semibold" style={{ color: C.yellow }}>
              {soDivergentes ? "ver todas" : "ver só essas →"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 rounded-lg px-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conta ou fornecedor"
            className="px-1 py-1.5 text-sm" style={{ background: "transparent", color: C.text, width: 230, outline: "none" }} />
        </div>
        <div className="text-xs" style={{ color: C.sub }}>
          {lista.length} de {d.recorrencias.length} · <b style={{ color: C.text }}>{moeda(totalMes)}</b>/mês em contas a pagar ativas
        </div>
      </div>

      <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 980 }}>
          <thead><tr style={{ background: C.panel2, color: C.sub }}>
            <th className="px-2 py-2 text-left font-semibold">Conta</th>
            <th className="px-2 py-2 text-left font-semibold">Fornecedor</th>
            <th className="px-2 py-2 text-right font-semibold">Valor</th>
            <th className="px-2 py-2 text-left font-semibold">Vence</th>
            <th className="px-2 py-2 text-left font-semibold">Pagamento</th>
            <th className="px-2 py-2 text-left font-semibold">Origem</th>
            <th className="px-2 py-2 text-left font-semibold">Matriz</th>
            <th className="px-2 py-2"></th>
          </tr></thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.line}`, opacity: r.ativo ? 1 : 0.5 }}>
                <td className="px-2 py-1.5">
                  <button onClick={() => setEditar(r)} className="text-left hover:underline font-semibold" style={{ color: C.text }}>{r.titulo}</button>
                  {!r.ativo && <span className="ml-1 px-1.5 rounded text-[10px] font-semibold" style={{ background: C.panel2, color: C.sub }}>INATIVA</span>}
                  {r.observacao && <div className="text-[11px]" style={{ color: C.sub }}>{r.observacao}</div>}
                </td>
                <td className="px-2 py-1.5" style={{ color: C.sub }}>{r.parceiro}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: r.divergente ? C.yellow : C.text }}>{moeda(r.valor)}</td>
                <td className="px-2 py-1.5" style={{ color: C.sub }}>
                  {r.diaUtil ? `${r.diaVencimento}º dia útil${sabTxt(r)}` : `dia ${r.diaVencimento}`}
                  {(r.periodicidade || 1) > 1 && <div style={{ color: C.accent }}>{rotPeriodo(r.periodicidade)}</div>}
                </td>
                <td className="px-2 py-1.5" style={{ color: r.formaPagamento ? C.text : C.sub }}>{FORMAS_PGTO[r.formaPagamento] || "—"}</td>
                <td className="px-2 py-1.5" style={{ color: C.sub }}>{r.daMatriz ? "Matriz de custos" : "Manual"}</td>
                <td className="px-2 py-1.5">
                  {!r.daMatriz ? <span style={{ color: C.sub }}>—</span>
                    : r.divergente ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <span style={{ color: C.yellow }}>{moeda(r.valorMatriz)}</span>
                        <button onClick={() => resolver(r, "usarMatriz")} className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: C.yellowSoft, color: C.yellow }}>
                          usar a Matriz
                        </button>
                        {r.podeAtualizarMatriz && (
                          <button onClick={() => resolver(r, "levarParaMatriz")} className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: C.accentSoft, color: C.accent }}>
                            atualizar a Matriz
                          </button>
                        )}
                      </div>
                    ) : <span className="flex items-center gap-1" style={{ color: C.green }}><CheckCircle2 size={12} /> de acordo</span>}
                </td>
                <td className="px-2 whitespace-nowrap">
                  <button onClick={() => setEditar(r)} title="Editar" className="mr-2" style={{ color: C.sub }}><Pencil size={13} /></button>
                  <button onClick={() => excluir(r)} title="Excluir a recorrência e as previsões futuras" style={{ color: C.sub }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!lista.length && <div className="text-sm text-center py-8" style={{ color: C.sub }}>Nenhuma conta recorrente com esse filtro.</div>}

      {editar && <RecorrenteModal user={user} r={editar} onClose={() => setEditar(null)} onExcluir={excluir}
        onSalvo={(j, txt) => { setEditar(null); setD(j); setAviso({ tipo: "ok", texto: txt }); }} />}
    </div>
  );
}

function RecorrenteModal({ user, r, onClose, onSalvo, onExcluir }) {
  const [f, setF] = useState({
    titulo: r.titulo, parceiro: r.parceiro, valor: lerNum(r.valor),
    diaVencimento: r.diaVencimento, diaUtil: r.diaUtil, formaPagamento: r.formaPagamento || "",
    observacao: r.observacao || "", ativo: r.ativo, fim: r.fim || "",
    periodicidade: Number(r.periodicidade) || 1,
  });
  const [atualizarMatriz, setAtualizarMatriz] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const novoValor = lerNum(f.valor);
  const vaiDivergir = r.valorMatriz != null && Math.abs(novoValor - r.valorMatriz) > 0.009;

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const j = await api("/api/fin/recorrentes", "PUT", { usuarioId: user.id, id: r.id, campos: f, atualizarMatriz });
      const extras = [];
      if (j.titulos) extras.push(`${j.titulos} previsão(ões) atualizadas`);
      if (j.matriz?.ok) extras.push(`Matriz: ${j.matriz.item} para ${moeda(j.matriz.depois)}`);
      if (j.matriz && !j.matriz.ok) extras.push(`a Matriz não foi alterada — ${j.matriz.erro}`);
      onSalvo(j, `"${f.titulo}" salva${extras.length ? ` · ${extras.join(" · ")}` : ""}.`);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <Modal titulo={`Conta recorrente · ${r.titulo}`} icone={Repeat} onClose={onClose} largura={640}>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <Campo t="Conta"><input value={f.titulo} onChange={(e) => set("titulo")(e.target.value.toUpperCase())} className="w-full rounded-lg px-2 py-1.5 text-sm uppercase" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} /></Campo>
        <Campo t="Fornecedor"><input value={f.parceiro} onChange={(e) => set("parceiro")(e.target.value.toUpperCase())} className="w-full rounded-lg px-2 py-1.5 text-sm uppercase" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} /></Campo>
        <Campo t="Valor"><Valor value={f.valor} onChange={set("valor")} width="100%" /></Campo>
        <Campo t="Dia do vencimento"><input value={f.diaVencimento} onChange={(e) => set("diaVencimento")(e.target.value)} inputMode="numeric" className="w-full rounded-lg px-2 py-1.5 text-sm text-right" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} /></Campo>
        <Campo t="Forma de pagamento" dica="ajuda a casar com o extrato">
          <select value={f.formaPagamento} onChange={(e) => set("formaPagamento")(e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }}>
            <option value="">—</option>
            {Object.entries(FORMAS_PGTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo t="Repete a cada" dica="mensal, trimestral…">
          <select value={f.periodicidade} onChange={(e) => set("periodicidade")(Number(e.target.value))} className="w-full rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }}>
            {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo t="Encerrar em (AAAA-MM)"><input value={f.fim} onChange={(e) => set("fim")(e.target.value)} placeholder="sem fim" className="w-full rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} /></Campo>
      </div>
      <div className="flex flex-wrap gap-4 mt-3">
        <Chave on={f.diaUtil} set={set("diaUtil")} t={`vence no ${f.diaVencimento}º dia útil`} />
        <Chave on={f.ativo} set={set("ativo")} t="conta ativa" cor={C.green} />
      </div>
      <Campo t="Observação"><input value={f.observacao} onChange={(e) => set("observacao")(e.target.value.toUpperCase())} className="w-full rounded-lg px-2 py-1.5 text-sm uppercase" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} /></Campo>

      {r.daMatriz && (
        <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: vaiDivergir ? C.yellowSoft : C.panel2, color: C.text }}>
          <div className="font-semibold mb-1" style={{ color: vaiDivergir ? C.yellow : C.sub }}>
            Esta conta vem da Matriz de custos {r.valorMatriz != null ? `(hoje a Matriz diz ${moeda(r.valorMatriz)})` : ""}
          </div>
          {vaiDivergir ? (
            r.podeAtualizarMatriz || origemSimples(r.chaveOrigem) ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={atualizarMatriz} onChange={(e) => setAtualizarMatriz(e.target.checked)} />
                Atualizar também a Matriz de custos com {moeda(novoValor)}
              </label>
            ) : (
              <div style={{ color: C.sub }}>
                Este valor é calculado pela Matriz (folha, provisão ou cartão), então não dá para escrever de volta —
                ajuste na própria Matriz de custos para os dois ficarem iguais.
              </div>
            )
          ) : <div style={{ color: C.sub }}>Valor de acordo com a Matriz.</div>}
        </div>
      )}

      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="flex items-center gap-2 mt-5">
        {onExcluir && (
          <button onClick={() => { onClose(); onExcluir(r); }} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ color: C.red, border: `1px solid ${C.red}44` }}>
            <Trash2 size={14} /> Excluir
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
const origemSimples = (chave) => {
  const p = String(chave || "").split("|");
  return p[0] === "MATRIZ" && ["vidaVegetativa", "logistica", "administracao", "sistemas", "dividas"].includes(p[1]) && !!p[2];
};

/* ============================================================
   BAIXAS PELO EXTRATO — uma sugestão por vez, você autoriza
   ============================================================ */
function BaixasModal({ user, competencia, arquivoId, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [i, setI] = useState(0);
  const [feitos, setFeitos] = useState([]);
  const [pulados, setPulados] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  const url = arquivoId ? `/api/fin/baixas?u=${user.id}&arquivoId=${arquivoId}` : `/api/fin/baixas?u=${user.id}&competencia=${competencia}`;
  useEffect(() => { api(url).then(setD).catch((e) => setErro(e.message)); }, []);

  const atual = d?.sugestoes?.[i];
  const autorizar = async () => {
    setOcupado(true);
    try {
      await api("/api/fin/baixas", "POST", { usuarioId: user.id, tituloId: atual.titulo.id, lancamentoId: atual.lancamento.id });
      setFeitos((f) => [...f, atual]);
      setI((x) => x + 1);
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  };
  const pular = () => { setPulados((p) => [...p, atual]); setI((x) => x + 1); };

  const CONF = { ALTA: [C.green, C.greenSoft], MEDIA: [C.yellow, C.yellowSoft], BAIXA: [C.red, C.redSoft] };

  return (
    <Modal titulo="Baixas pelo extrato" icone={Link2} onClose={onClose} largura={720}>
      {erro && <div className="mb-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Procurando no extrato…</div>}

      {d && !d.sugestoes.length && (
        <div className="text-sm text-center py-8" style={{ color: C.sub }}>
          Nenhum lançamento do extrato bateu com as contas previstas.<br />
          <span className="text-xs">Foram comparados {d.lancamentos} lançamento(s) com {d.titulos} conta(s) em aberto, aceitando até 12 dias de diferença na data.</span>
        </div>
      )}

      {d && d.sugestoes.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: C.sub }}>
            <span>{Math.min(i + 1, d.sugestoes.length)} de {d.sugestoes.length} sugestões</span>
            <span>{feitos.length} baixada(s) · {pulados.length} pulada(s)</span>
          </div>
          <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: C.panel2 }}>
            <div style={{ width: `${(i / d.sugestoes.length) * 100}%`, height: "100%", background: C.accent }} />
          </div>

          {atual ? (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="rounded-xl p-3" style={{ background: C.panel2 }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>NO EXTRATO · {atual.lancamento.banco}</div>
                  <div className="font-semibold" style={{ color: C.text }}>{moeda(Math.abs(atual.lancamento.valor))}</div>
                  <div className="text-xs mt-1" style={{ color: C.text }}>{atual.lancamento.historico}</div>
                  {atual.lancamento.identificacao && <div className="text-[11px]" style={{ color: C.sub }}>{atual.lancamento.identificacao}</div>}
                  <div className="text-[11px] mt-1" style={{ color: C.sub }}>{dBR(String(atual.lancamento.data).slice(0, 10))}</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: C.accentSoft }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: C.accent }}>CONTA PREVISTA</div>
                  <div className="font-semibold" style={{ color: C.text }}>{moeda(atual.titulo.valor)}</div>
                  <div className="text-xs mt-1" style={{ color: C.text }}>{atual.titulo.titulo}</div>
                  <div className="text-[11px]" style={{ color: C.sub }}>{atual.titulo.parceiro}</div>
                  <div className="text-[11px] mt-1" style={{ color: C.sub }}>
                    vence {dBR(String(atual.titulo.vencimento).slice(0, 10))}
                    {atual.titulo.formaPagamento ? ` · ${FORMAS_PGTO[atual.titulo.formaPagamento]}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                <span className="px-2 py-0.5 rounded font-bold" style={{ background: CONF[atual.confianca][1], color: CONF[atual.confianca][0] }}>{atual.confianca}</span>
                <span style={{ color: C.sub }}>
                  {atual.diferenca === 0 ? "valor idêntico" : `${atual.diferenca > 0 ? "pagou" : "pagou"} ${moeda(Math.abs(atual.diferenca))} ${atual.diferenca > 0 ? "a mais" : "a menos"}`}
                  {" · "}
                  {atual.dias === 0 ? "no dia do vencimento" : `${Math.abs(atual.dias)} dia(s) ${atual.dias > 0 ? "depois" : "antes"} do vencimento`}
                  {atual.alternativas > 0 ? ` · ${atual.alternativas} outra(s) conta(s) também batem` : ""}
                </span>
              </div>

              <div className="flex justify-between gap-2 mt-5">
                <button onClick={pular} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Pular</button>
                <button onClick={autorizar} disabled={ocupado} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: C.green, color: "#fff", opacity: ocupado ? 0.6 : 1 }}>
                  <CheckCircle2 size={15} /> Autorizar a baixa
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <CheckCircle2 size={36} style={{ color: C.green }} className="mx-auto" />
              <div className="font-semibold mt-2" style={{ color: C.text }}>Fim das sugestões</div>
              <div className="text-sm mt-1" style={{ color: C.sub }}>
                {feitos.length} conta(s) baixada(s){pulados.length ? ` · ${pulados.length} pulada(s), continuam em aberto` : ""}.
              </div>
              <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Fechar</button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
export { BaixasModal };
