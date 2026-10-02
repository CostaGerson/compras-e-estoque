"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, X, Loader2, Upload, Repeat, Pencil, Trash2, CheckCircle2, Undo2, Search, ChevronLeft, ChevronRight,
  AlertTriangle, FileCode2, Hand, FileSpreadsheet, TrendingDown, TrendingUp, Ban, CalendarClock, Inbox, EyeOff,
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
  return (
    <div className="relative inline-flex items-center" style={{ width }}>
      <span className="absolute left-2 text-[10px]" style={{ color: C.sub }}>R$</span>
      <input autoFocus={autoFocus} value={foco ? txt : brl(value)} onFocus={(e) => { setFoco(true); setTxt(brl(value)); setTimeout(() => e.target.select(), 0); }}
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
  const ativas = contas.filter((c) => c.ativo);
  const rot = (c) => `${c.codigo} · ${c.nome}`;
  const porRot = useMemo(() => Object.fromEntries(contas.map((c) => [rot(c), c.id])), [contas]);
  const porId = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas]);
  const alt = (i, k, v) => onChange(lista.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const tot = lista.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const idL = useMemo(() => "contas-" + Math.random().toString(36).slice(2), []);
  return (
    <div>
      <datalist id={idL}>{ativas.map((c) => <option key={c.id} value={rot(c)} />)}</datalist>
      {lista.map((r, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <ContaInput listId={idL} conta={porId[r.contaId]} porRot={porRot} contas={ativas} onPick={(id) => alt(i, "contaId", id)} />
          {lista.length > 1 && (
            <>
              <div className="relative" style={{ width: 80 }}>
                <input value={r.pct} onChange={(e) => alt(i, "pct", lerNum(e.target.value))} className="w-full text-right rounded px-2 py-1.5 text-sm outline-none" style={{ ...inpS, paddingRight: 18 }} />
                <span className="absolute right-2 top-2 text-[10px]" style={{ color: C.sub }}>%</span>
              </div>
              <span className="text-xs text-right" style={{ color: C.sub, width: 90 }}>{brl((valor * (Number(r.pct) || 0)) / 100)}</span>
              <button onClick={() => onChange(lista.filter((_, j) => j !== i))} style={{ color: C.sub }}><X size={14} /></button>
            </>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 text-xs">
        <button onClick={() => {
          const resto = Math.max(0, Math.round((100 - tot) * 100) / 100);
          onChange([...lista, { contaId: null, pct: resto || 0 }]);
        }} className="flex items-center gap-1 font-semibold" style={{ color: C.accent }}><Plus size={13} /> Ratear em mais contas</button>
        {lista.length > 1 && <span style={{ color: Math.abs(tot - 100) > 0.01 ? C.red : C.green }}>Total {brl(tot)}%</span>}
      </div>
    </div>
  );
}
function ContaInput({ listId, conta, porRot, contas, onPick }) {
  const [txt, setTxt] = useState(conta ? `${conta.codigo} · ${conta.nome}` : "");
  useEffect(() => { setTxt(conta ? `${conta.codigo} · ${conta.nome}` : ""); }, [conta?.id]);
  const escolher = (v) => {
    setTxt(v);
    if (porRot[v]) return onPick(porRot[v]);
    const cod = v.trim().split(/\s/)[0];
    const c = contas.find((x) => x.codigo === cod);
    if (c && v.trim() === cod) onPick(c.id);
  };
  return (
    <input list={listId} value={txt} onChange={(e) => escolher(e.target.value)} onBlur={() => { if (!porRot[txt] && conta) setTxt(`${conta.codigo} · ${conta.nome}`); }}
      placeholder="Conta-caixa (código ou nome)" className={inp} style={{ ...inpS, borderColor: conta ? C.line : C.yellow }} />
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

  const carregar = () => api(`/api/fin/titulos?u=${user.id}&tipo=${tipo}&de=${mes}&ate=${mes}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
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
        {[["PAGAR", "Contas a pagar", TrendingDown], ["RECEBER", "Contas a receber", TrendingUp]].map(([k, t, I]) => (
          <button key={k} onClick={() => setTipo(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            style={{ color: tipo === k ? C.accent : C.sub, borderBottom: tipo === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            <I size={15} /> {t}
          </button>
        ))}
      </div>

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

      {modal?.t === "titulo" && <TituloModal user={user} tipo={tipo} item={modal.item} d={d} onClose={() => setModal(null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "baixa" && <BaixaModal t={modal.item} P={P} onClose={() => setModal(null)} onOk={async (dt, v) => { await acao(modal.item, "baixar", { dataPagamento: dt, valorPago: v }); setModal(null); }} />}
      {modal?.t === "conferir" && <ConferirModal user={user} itens={d.criticas} contasPorId={contasPorId} onClose={() => { setModal(null); carregar(); }} />}
      {modal?.t === "xml" && <XmlModal user={user} tipo={tipo} contas={d?.contas || []} lidosIniciais={modal.lidos} onClose={() => setModal(modal.lidos ? { t: "nfs" } : null)} onSalvo={(m) => { setModal(null); ok(m); }} />}
      {modal?.t === "nfs" && <NfsComprasModal user={user} onClose={() => { setModal(null); carregar(); }} onLancar={(lidos) => setModal({ t: "xml", lidos })} />}
      {modal?.t === "recorrencias" && <RecorrenciasModal user={user} d={d} contasPorId={contasPorId} onClose={() => { setModal(null); carregar(); }} />}
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
  const [f, setF] = useState(() => item ? { ...item } : { titulo: "", parceiro: "", documento: "", numeroDoc: "", valor: 0, vencimento: hojeISO(), previsao: false, rateio: [{ contaId: null, pct: 100 }], observacao: "", recorrente: false, fim: "" });
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
        <div className="col-span-2"><Campo t="Observação"><input value={f.observacao || ""} onChange={(e) => s("observacao", e.target.value)} className={inp} style={inpS} /></Campo></div>
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
function ConferirModal({ user, itens, contasPorId, onClose }) {
  const [l, setL] = useState(itens.map((t) => ({ ...t, novo: t.valor, futuros: true, feito: false })));
  const [erro, setErro] = useState("");
  const confirmar = async (t) => {
    try {
      await api(`/api/fin/titulos/${t.id}`, "PATCH", { usuarioId: user.id, acao: "confirmar", valor: t.novo, aplicarFuturos: t.futuros && Math.abs(t.novo - t.valor) > 0.009 });
      setL((x) => x.map((y) => (y.id === t.id ? { ...y, feito: true } : y)));
    } catch (e) { setErro(e.message); }
  };
  const pend = l.filter((t) => !t.feito);
  return (
    <Modal titulo="Conferir valores do mês" icone={CalendarClock} onClose={onClose} largura={900}
      rodape={<>
        <span className="mr-auto text-xs" style={{ color: C.sub }}>{pend.length} para conferir</span>
        {pend.length > 0 && <BtnS onClick={async () => { for (const t of pend) await confirmar(t); }}>Confirmar todos ({pend.length})</BtnS>}
        <BtnP onClick={onClose}>Fechar</BtnP>
      </>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Contas recorrentes são previsões. Confirme o valor deste mês ou digite o novo. "Também nos próximos" atualiza os meses seguintes ainda não conferidos.</div>
      {erro && <div className="p-2 mb-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <table className="w-full text-xs">
        <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
          {["Vencimento", "Conta", "Valor previsto", "Valor do mês", "", ""].map((h, i) => <th key={i} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>{l.map((t) => (
          <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: t.feito ? 0.5 : 1 }}>
            <td className="px-2 py-2 whitespace-nowrap">{dBR(t.vencimento)}</td>
            <td className="px-2 py-2"><div className="font-semibold" style={{ color: C.navy }}>{t.titulo}</div><div style={{ color: C.sub }}>{t.parceiro} · {(t.rateio || []).map((r) => contasPorId[r.contaId]?.nome).join(", ")}</div></td>
            <td className="px-2 py-2 whitespace-nowrap">{moeda(t.valor)}</td>
            <td className="px-2 py-2">{t.feito ? <b>{moeda(t.novo)}</b> : <Valor value={t.novo} onChange={(v) => setL((x) => x.map((y) => (y.id === t.id ? { ...y, novo: v } : y)))} />}</td>
            <td className="px-2 py-2">{!t.feito && Math.abs(t.novo - t.valor) > 0.009 && (
              <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={t.futuros} onChange={(e) => setL((x) => x.map((y) => (y.id === t.id ? { ...y, futuros: e.target.checked } : y)))} /> também nos próximos</label>
            )}</td>
            <td className="px-2 py-2 text-right">{t.feito ? <span style={{ color: C.green }} className="font-semibold">✓ conferido</span>
              : <button onClick={() => confirmar(t)} className="px-3 py-1 rounded-lg font-semibold text-white" style={{ background: C.accent }}>{Math.abs(t.novo - t.valor) > 0.009 ? "Salvar valor" : "Confirmar"}</button>}</td>
          </tr>
        ))}</tbody>
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
  const [l, setL] = useState(d.recorrencias.map((r) => ({ ...r, fim: r.fim || "" })));
  const [edit, setEdit] = useState(null);
  const [erro, setErro] = useState("");
  const salvar = async (r) => {
    try {
      await api(`/api/fin/recorrencias/${r.id}`, "PATCH", { usuarioId: user.id, titulo: r.titulo, parceiro: r.parceiro, valor: r.valor, diaVencimento: r.diaVencimento, fim: r.fim || null, rateio: r.rateio, ativo: r.ativo });
      setEdit(null); setErro("");
    } catch (e) { setErro(e.message); }
  };
  const encerrar = async (r) => {
    if (!confirm(`Encerrar "${r.titulo}"? As previsões a partir deste mês que ainda não foram conferidas ou pagas serão removidas. As já pagas ficam.`)) return;
    try { await api(`/api/fin/recorrencias/${r.id}`, "DELETE", { usuarioId: user.id }); setL((x) => x.filter((y) => y.id !== r.id)); } catch (e) { setErro(e.message); }
  };
  const alt = (id, k, v) => setL((x) => x.map((y) => (y.id === id ? { ...y, [k]: v } : y)));
  return (
    <Modal titulo="Contas recorrentes" icone={Repeat} onClose={onClose} largura={1000} rodape={<BtnP onClick={onClose}>Fechar</BtnP>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Alterações aqui valem a partir deste mês, nos meses ainda não conferidos nem pagos. Para criar uma nova, use <b>Nova conta</b> com a chave "Conta recorrente".</div>
      {erro && <div className="p-2 mb-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!l.length ? <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma conta recorrente.</div> : (
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
            {["Título", "Fornecedor", "Conta-caixa", "Valor base", "Dia", "Início", "Até", ""].map((h, i) => <th key={i} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>{l.map((r) => {
            const e = edit === r.id;
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td className="px-2 py-1.5">{e ? <input value={r.titulo} onChange={(ev) => alt(r.id, "titulo", ev.target.value.toUpperCase())} className={inp} style={inpS} /> : <b style={{ color: C.navy }}>{r.titulo}</b>}</td>
                <td className="px-2 py-1.5">{e ? <input value={r.parceiro} onChange={(ev) => alt(r.id, "parceiro", ev.target.value.toUpperCase())} className={inp} style={inpS} /> : r.parceiro}</td>
                <td className="px-2 py-1.5" style={{ minWidth: 200 }}>{e ? <Rateio contas={d.contas} valor={r.valor} value={r.rateio} onChange={(v) => alt(r.id, "rateio", v)} /> : (r.rateio || []).map((x) => contasPorId[x.contaId]?.nome).join(", ")}</td>
                <td className="px-2 py-1.5">{e ? <Valor value={r.valor} onChange={(v) => alt(r.id, "valor", v)} width={110} /> : moeda(r.valor)}</td>
                <td className="px-2 py-1.5">{e ? <input type="number" min={1} max={31} value={r.diaVencimento} onChange={(ev) => alt(r.id, "diaVencimento", Number(ev.target.value))} className="rounded px-2 py-1 w-14" style={inpS} /> : r.diaVencimento}</td>
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
