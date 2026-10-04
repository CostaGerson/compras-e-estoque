"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, X, Loader2, Upload, Repeat, Pencil, Trash2, CheckCircle2, Undo2, Search, ChevronLeft, ChevronRight,
  AlertTriangle, FileCode2, Hand, FileSpreadsheet, TrendingDown, TrendingUp, Ban, CalendarClock, Inbox, EyeOff, Grid3x3,
  Link2, ChevronDown,
} from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41", roxo: "#7A5AF8", roxoSoft: "#F1EDFF",
};
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
const PERIODOS = { 1: "Mensal", 2: "Bimestral", 3: "Trimestral", 4: "Quadrimestral", 6: "Semestral", 12: "Anual" };
const rotPeriodo = (n) => PERIODOS[Number(n) || 1] || `a cada ${n} meses`;
const FORMA = { MANUAL: ["Manual", Hand], NF_XML: ["Importação NF (XML)", FileCode2], EXCEL: ["Importação Excel", FileSpreadsheet], RECORRENCIA: ["Recorrência", Repeat] };

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

  const carregar = () => api(`/api/fin/titulos?u=${user.id}&tipo=${tipo}&de=${mes}&ate=${mes}`).then((j) => {
    setD(j); setErro("");
    if (j.autoMatriz?.criadas) setAviso(`${j.autoMatriz.criadas} contas recorrentes da Matriz de custos foram lançadas (previsões até 12 meses à frente). Confira dia, fornecedor e conta-caixa em Recorrências.`);
  }).catch((e) => setErro(e.message));
  useEffect(() => { setD(null); carregar(); }, [tipo, mes]);
  const ok = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3000); carregar(); };

  const contasPorId = useMemo(() => Object.fromEntries((d?.contas || []).map((c) => [c.id, c])), [d]);
  const P = tipo === "PAGAR";
  const lista = useMemo(() => {
    if (!d) return [];
    const n = busca.trim().toUpperCase();
    return d.titulos.filter((t) => {
      const s = situacao(t).k;
      if (fSit !== "TODOS" && !(fSit === s || (fSit === "ABERTOS" && ["ABER", "VENC", "PREV"].includes(s)))) return false;
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
    };
  }, [d]);

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
          <button onClick={() => setMes(somaMes(mes, -1))} className="px-2 py-2" style={{ color: C.sub }}><ChevronLeft size={16} /></button>
          <div className="px-2 text-sm font-bold text-center" style={{ color: C.navy, minWidth: 130 }}>{nomeMes(mes)}</div>
          <button onClick={() => setMes(somaMes(mes, 1))} className="px-2 py-2" style={{ color: C.sub }}><ChevronRight size={16} /></button>
        </div>
        {mes !== mesAtual() && <button onClick={() => setMes(mesAtual())} className="text-xs underline" style={{ color: C.blue }}>mês atual</button>}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, fornecedor, conta…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 240 }} />
        </div>
        <select value={fSit} onChange={(e) => setFSit(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={inpS}>
          <option value="TODOS">Todas as situações</option><option value="ABERTOS">Em aberto (inclui previsões)</option><option value="VENC">Vencidos</option>
          <option value="PREV">Previsões</option><option value="PAGO">{P ? "Pagos" : "Recebidos"}</option><option value="CANC">Cancelados</option>
        </select>
        <div className="flex-1" />
        <BtnS onClick={() => setModal({ t: "recorrencias" })}><Repeat size={15} /> Recorrências{d ? ` (${d.recorrencias.filter((r) => r.ativo).length})` : ""}</BtnS>
        {P && <BtnS onClick={() => setModal({ t: "xml" })}><Upload size={15} /> Importar XML</BtnS>}
        <BtnP onClick={() => setModal({ t: "titulo", item: null })}><Plus size={15} /> Nova conta</BtnP>
      </div>
      {aviso && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {!d ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          {/* totais */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {[
              [`Total ${P ? "a pagar" : "a receber"} no mês`, tot.total, C.navy],
              [P ? "Pago" : "Recebido", tot.pago, C.green],
              ["Em aberto", tot.aberto, C.blue],
              ["Vencido (no mês)", tot.vencido, C.red],
              ["Previsões em aberto", tot.previsao, C.roxo],
            ].map(([t, v, c]) => (
              <div key={t} className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-xs" style={{ color: C.sub }}>{t}</div>
                <div className="text-lg font-bold" style={{ color: c }}>{moeda(v)}</div>
              </div>
            ))}
          </div>

          {d.atrasados.length > 0 && (
            <Tabela titulo={`Vencidos de meses anteriores · ${moeda(tot.atrasados)}`} cor={C.red} itens={d.atrasados} contasPorId={contasPorId} P={P}
              onEditar={(t) => setModal({ t: "titulo", item: t })} onBaixar={(t) => setModal({ t: "baixa", item: t })} onAcao={acao} onExcluir={excluir} />
          )}
          <Tabela titulo={`${nomeMes(mes)} · ${lista.length} conta(s)`} itens={lista} contasPorId={contasPorId} P={P}
            onEditar={(t) => setModal({ t: "titulo", item: t })} onBaixar={(t) => setModal({ t: "baixa", item: t })} onAcao={acao} onExcluir={excluir}
            vazio={busca || fSit !== "TODOS" ? "Nada encontrado com esses filtros." : `Nenhuma conta ${P ? "a pagar" : "a receber"} neste mês.`} />
        </>
      )}

      </>}

      {modal?.t === "titulo" && <TituloModal user={user} tipo={tipo} item={modal.item} d={d} onClose={() => setModal(null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "baixa" && <BaixaModal t={modal.item} P={P} onClose={() => setModal(null)} onOk={async (dt, v) => { await acao(modal.item, "baixar", { dataPagamento: dt, valorPago: v }); setModal(null); }} />}
      {modal?.t === "conferir" && <ConferirModal user={user} itens={d.criticas} recorrencias={d.recorrencias || []} contasPorId={contasPorId} onClose={() => { setModal(null); carregar(); }} />}
      {modal?.t === "xml" && <XmlModal user={user} tipo={tipo} contas={d?.contas || []} lidosIniciais={modal.lidos} onClose={() => setModal(modal.lidos ? { t: "nfs" } : null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "nfs" && <NfsComprasModal user={user} onClose={() => { setModal(null); carregar(); }} onLancar={(lidos) => setModal({ t: "xml", lidos })} />}
      {modal?.t === "recorrencias" && <RecorrenciasModal user={user} d={d} contasPorId={contasPorId} onClose={() => { setModal(null); carregar(); }} />}
      {modal?.t === "baixas" && <BaixasModal user={user} competencia={mes} onClose={() => { setModal(null); carregar(); }} />}
    </div>
  );
}

/* ---------------- tabela ---------------- */
function Tabela({ titulo, cor, itens, contasPorId, P, onEditar, onBaixar, onAcao, onExcluir, vazio }) {
  const total = itens.filter((t) => t.status !== "CANCELADO").reduce((s, t) => s + t.valor, 0);
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
              {["Vencimento", "Título", P ? "Fornecedor" : "Cliente", "Rateio (conta-caixa)", "Valor", "Situação", "Origem", ""].map((h, i) => (
                <th key={i} className={`px-3 py-2 font-semibold ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{itens.map((t) => {
              const s = situacao(t);
              const [fT, FI] = FORMA[t.forma] || [t.forma, Hand];
              const conferir = t.recorrenciaId && !t.valorConfirmado && t.status === "ABERTO" && t.competencia <= mesAtual();
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: t.status === "CANCELADO" ? 0.5 : 1 }} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: s.k === "VENC" ? C.red : C.text }}>{dBR(t.vencimento)}</td>
                  <td className="px-3 py-2" style={{ maxWidth: 260 }}>
                    <button onClick={() => onEditar(t)} className="text-left">
                      <div className="font-semibold flex items-center gap-1" style={{ color: C.navy }}>
                        {t.recorrenciaId && <Repeat size={12} style={{ color: C.roxo }} title="Recorrente" />}{t.titulo}
                      </div>
                      {(t.numeroDoc || t.observacao) && <div style={{ color: C.sub }}>{[t.numeroDoc, t.observacao].filter(Boolean).join(" · ")}</div>}
                    </button>
                  </td>
                  <td className="px-3 py-2" style={{ maxWidth: 200 }}>{t.parceiro}{t.documento && <div style={{ color: C.sub }}>{fmtDoc(t.documento)}</div>}</td>
                  <td className="px-3 py-2" style={{ maxWidth: 220 }}>
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
                    <div className="flex items-center gap-1" style={{ color: C.sub }}><FI size={13} /> <span className="truncate" style={{ maxWidth: 90 }}>{(t.criadoPorNome || "").split(" ")[0]}</span></div>
                    <div className="text-[10px]" style={{ color: C.sub }}>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</div>
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

/* ---------------- novo / editar ---------------- */
function TituloModal({ user, tipo, item, d, onClose, onSalvo }) {
  const P = tipo === "PAGAR";
  const novo = !item;
  const [f, setF] = useState(() => item ? { ...item } : { titulo: "", parceiro: "", documento: "", numeroDoc: "", valor: 0, vencimento: hojeISO(), previsao: false, rateio: [{ contaId: null, pct: 100 }], observacao: "", formaPagamento: "", recorrente: false, fim: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [fT] = FORMA[item?.forma] || ["Manual"];
  // fornecedor conhecido: preenche CNPJ e o último rateio
  const escolherParceiro = (v) => {
    s("parceiro", v.toUpperCase());
    const p = (d?.parceiros || []).find((x) => x.parceiro === v.toUpperCase());
    if (p?.documento && !f.documento) s("documento", p.documento);
  };
  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      if (novo) await api("/api/fin/titulos", "POST", { usuarioId: user.id, tipo, ...f });
      else await api(`/api/fin/titulos/${item.id}`, "PATCH", { usuarioId: user.id, acao: "editar", titulo: f.titulo, parceiro: f.parceiro, documento: f.documento, numeroDoc: f.numeroDoc, valor: f.valor, vencimento: f.vencimento, previsao: f.previsao, rateio: f.rateio, observacao: f.observacao });
      onSalvo(novo ? (f.recorrente ? "Conta recorrente criada — previsões lançadas nos próximos meses." : "Conta lançada.") : "Conta atualizada.");
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo={novo ? `Nova conta ${P ? "a pagar" : "a receber"}` : "Editar conta"} icone={P ? TrendingDown : TrendingUp} onClose={onClose} largura={680}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button><BtnP onClick={salvar} disabled={salvando}>{salvando && <Loader2 size={14} className="animate-spin" />} Salvar</BtnP></>}>
      <datalist id="parceiros-lst">{(d?.parceiros || []).map((p) => <option key={p.parceiro} value={p.parceiro} />)}</datalist>
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
          Origem: <b>{fT}</b> · lançado por {item.criadoPorNome || "—"} em {new Date(item.createdAt).toLocaleString("pt-BR")}
          {item.atualizadoPorNome && <> · última alteração: {item.atualizadoPorNome} em {new Date(item.updatedAt).toLocaleString("pt-BR")}</>}
          {item.recorrenciaId && <div className="mt-1">Conta recorrente: alterar aqui muda só {nomeMes(item.competencia)}. Para mudar os próximos meses, use <b>Recorrências</b>.</div>}
        </div>
      )}
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
                {t.rec && <div style={{ color: C.sub }}>{t.rec.diaUtil ? `${t.rec.diaVencimento}º dia útil` : `dia ${t.rec.diaVencimento}`}{(t.rec.periodicidade || 1) > 1 ? ` · ${rotPeriodo(t.rec.periodicidade)}` : ""}{t.rec.formaPagamento ? ` · ${FORMAS_PGTO[t.rec.formaPagamento] || t.rec.formaPagamento}` : ""}</div>}
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
                      <td className="px-2 py-1.5 whitespace-nowrap">{p.util ? `${p.dia}º dia útil` : `dia ${p.dia}`}</td>
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
                </> : r.diaUtil ? `${r.diaVencimento}º dia útil` : `dia ${r.diaVencimento}`}</td>
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
                  {r.diaUtil ? `${r.diaVencimento}º dia útil` : `dia ${r.diaVencimento}`}
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
