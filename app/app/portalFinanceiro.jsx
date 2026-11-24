"use client";
// v1081 — Financeiro do portal do cliente (Loja Way): contas a pagar, contas a receber, análise mensal e plano de contas.
// Cópia simplificada do financeiro da Meridian. As contas a pagar à Meridian chegam sozinhas (espelho dos pedidos).
import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, CheckCircle2, Undo2, Search, Loader2, Lock, ArrowDownCircle, ArrowUpCircle, BarChart3, ListTree, Users, Save } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", steelSoft: "#EEF3FB" };
const inpS = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const money = (n) => (n == null ? "—" : (Number(n) < 0 ? "−R$ " : "R$ ") + Math.abs(Number(n)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const curto = (n) => { const v = Math.abs(Number(n) || 0); const s = v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1e4 ? `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }); return (Number(n) < 0 ? "−" : "") + s; };
const dBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_L = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const fimMes = (ym) => { const [a, m] = ym.split("-").map(Number); return `${ym}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`; };
const somaMes = (ym, k) => { const [a, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(a, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };
const FORMAS = [["", "—"], ["PIX", "PIX"], ["BOLETO", "Boleto"], ["CARTAO", "Cartão"], ["DINHEIRO", "Dinheiro"], ["TED", "TED/transferência"], ["DEBITO_AUTOMATICO", "Débito automático"]];
const GRUPOS_TIPO = { RECEBER: ["RECEITA"], PAGAR: ["DEDUCAO", "CMV", "DESPESA", "IMPOSTO", "FINANCEIRO", "INVESTIMENTO"] };
const NOME_GRUPO = { RECEITA: "Receita", DEDUCAO: "Deduções", CMV: "CMV", DESPESA: "Despesas", IMPOSTO: "Impostos", FINANCEIRO: "Financeiro", INVESTIMENTO: "Investimentos" };

function Janela({ titulo, onClose, children, rodape, largura = 560 }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(16,24,40,.45)" }} onClick={onClose}>
      <div className="w-full flex flex-col rounded-t-2xl sm:rounded-xl" style={{ maxWidth: largura, maxHeight: "92vh", background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-5 py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold flex-1" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} className="p-1" aria-label="Fechar"><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="px-5 py-4 overflow-auto">{children}</div>
        {rodape && <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>{rodape}</div>}
      </div>
    </div>
  );
}
const Campo = ({ t, children, span }) => <label className={`block min-w-0 ${span ? "sm:col-span-2" : ""}`}><div className="text-xs mb-1" style={{ color: C.sub }}>{t}</div>{children}</label>;
const Btn = ({ children, onClick, cor = C.accent, contorno, disabled, title }) => (
  <button type="button" onClick={onClick} disabled={disabled} title={title} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
    style={contorno ? { border: `1px solid ${C.line}`, color: C.text, background: C.panel, opacity: disabled ? 0.5 : 1 } : { background: cor, color: "#fff", opacity: disabled ? 0.5 : 1 }}>{children}</button>
);

export default function PortalFinanceiro({ api, mobile, interno }) {
  const [sub, setSub] = useState("PAGAR");
  const [contas, setContas] = useState(null);
  const carregarContas = () => api("/api/portal/fin?contas=1").then((j) => setContas(j.contas)).catch((e) => alerta(e.message));
  useEffect(() => { carregarContas(); }, []);
  const SUBS = [["PAGAR", "Contas a pagar", ArrowUpCircle], ["RECEBER", "Contas a receber", ArrowDownCircle], ["ANALISE", "Análise mensal", BarChart3], ["MATRIZ", "Matriz de custos", Users], ["PLANO", "Plano de contas", ListTree]];   // v1091 — matriz
  return (
    <div>
      <div className={`flex gap-1 mb-4 ${mobile ? "overflow-x-auto -mx-3 px-3" : ""}`} style={{ borderBottom: `1px solid ${C.line}` }}>
        {SUBS.map(([k, t, I]) => (
          <button key={k} onClick={() => setSub(k)} className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap"
            style={{ color: sub === k ? C.accent : C.sub, borderBottom: sub === k ? `3px solid ${C.accent}` : "3px solid transparent", marginBottom: -1 }}><I size={15} /> {t}</button>
        ))}
      </div>
      {(sub === "PAGAR" || sub === "RECEBER") && <Titulos key={sub} tipo={sub} api={api} mobile={mobile} contas={contas || []} />}
      {sub === "ANALISE" && <Analise api={api} mobile={mobile} />}
      {sub === "MATRIZ" && <MatrizCustos api={api} mobile={mobile} />}
      {sub === "PLANO" && <Plano api={api} contas={contas} onMudou={carregarContas} />}
    </div>
  );
}

// ---------- contas a pagar / a receber ----------
function Titulos({ tipo, api, mobile, contas }) {
  const pagar = tipo === "PAGAR";
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [d, setD] = useState(null);
  const [filtro, setFiltro] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  const [baixa, setBaixa] = useState(null);
  const carregar = () => api(`/api/portal/fin?tipo=${tipo}&de=${mes}-01&ate=${fimMes(mes)}`).then(setD).catch((e) => { setD({ titulos: [], resumo: {} }); alerta(e.message); });
  useEffect(() => { setD(null); carregar(); }, [mes]);
  const h = d?.hoje || hojeISO();
  const contaDe = useMemo(() => Object.fromEntries((contas || []).map((c) => [c.codigo, c])), [contas]);
  const q = busca.trim().toUpperCase();
  const lista = (d?.titulos || []).filter((t) => (filtro === "TODAS" || (filtro === "ABERTAS" ? t.status === "ABERTO" : filtro === "VENCIDAS" ? t.status === "ABERTO" && t.vencimento < h : t.status === "PAGO"))
    && (!q || `${t.descricao} ${t.parceiro || ""} ${t.numeroDoc || ""}`.toUpperCase().includes(q)));
  const totalLista = lista.reduce((s, t) => s + t.valor, 0);
  const acao = async (t, acao, pergunta) => {
    if (pergunta && !(await confirmar(pergunta))) return;
    try { await api("/api/portal/fin", { method: "POST", body: JSON.stringify({ acao, id: t.id }) }); carregar(); } catch (e) { alerta(e.message); }
  };
  const r = d?.resumo || {};
  const [a, m] = mes.split("-");
  const situ = (t) => (t.status === "PAGO" ? [`${pagar ? "Pago" : "Recebido"} ${dBR(t.dataPagamento).slice(0, 5)}`, C.green, C.greenSoft]
    : t.vencimento < h ? ["Vencida", C.red, C.redSoft] : t.vencimento === h ? ["Vence hoje", C.yellow, C.yellowSoft] : ["Em aberto", C.blue, C.blueSoft]);
  const Acoes = ({ t }) => (t.id && String(t.id).startsWith("M")) ? (
    <span className="text-[11px] flex items-center gap-1" style={{ color: C.sub }} title="Conta da Meridian: valor, vencimento e baixa vêm da Meridian."><Lock size={12} /> automática</span>
  ) : (
    <div className="flex items-center gap-1 justify-end">
      {t.status === "ABERTO"
        ? <button onClick={() => setBaixa(t)} className="text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1" style={{ background: C.green, color: "#fff" }} title={pagar ? "Registrar pagamento" : "Registrar recebimento"}><CheckCircle2 size={13} /> Baixar</button>
        : <button onClick={() => acao(t, "estornar", `Estornar a baixa de "${t.descricao}"? Ela volta a ficar em aberto.`)} className="p-1.5 rounded" title="Estornar a baixa"><Undo2 size={14} style={{ color: C.sub }} /></button>}
      <button onClick={() => setForm(t)} className="p-1.5 rounded" title="Editar"><Pencil size={14} style={{ color: C.sub }} /></button>
      <button onClick={() => acao(t, "excluir", `Excluir "${t.descricao}" (${money(t.valor)})? Não dá para desfazer.`)} className="p-1.5 rounded" title="Excluir"><Trash2 size={14} style={{ color: C.red }} /></button>
    </div>
  );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setMes(somaMes(mes, -1))} className="p-2" aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <div className="px-2 text-sm font-semibold capitalize" style={{ color: C.navy, minWidth: 130, textAlign: "center" }}>{MESES_L[Number(m) - 1]} {a}</div>
          <button onClick={() => setMes(somaMes(mes, 1))} className="p-2" aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
        <div className="flex-1" />
        <Btn onClick={() => setForm({ tipo })}><Plus size={15} /> {pagar ? "Nova conta a pagar" : "Nova conta a receber"}</Btn>
      </div>
      <div className={`grid gap-2 mb-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
        {[["Em aberto", r.aberto, C.blue], ["Vencido", r.vencido, C.red, r.qtdVencido ? `${r.qtdVencido} conta(s)` : null], ["Vence hoje", r.venceHoje, C.yellow], [pagar ? "Pago" : "Recebido", r.pago, C.green]].map(([t, v, cor, extra]) => (
          <div key={t} className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${cor}` }}>
            <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: C.sub }}>{t}</div>
            <div className="text-lg font-bold" style={{ color: d ? cor : C.sub }}>{d ? money(v || 0) : "…"}</div>
            {extra && <div className="text-[11px]" style={{ color: C.sub }}>{extra}</div>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {[["TODAS", "Todas"], ["ABERTAS", "Em aberto"], ["VENCIDAS", "Vencidas"], ["PAGAS", pagar ? "Pagas" : "Recebidas"]].map(([k, t]) => (
          <button key={k} onClick={() => setFiltro(k)} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={filtro === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
        ))}
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ml-auto" style={{ ...inpS, minWidth: mobile ? "100%" : 220 }}>
          <Search size={14} style={{ color: C.sub }} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, fornecedor, nº…" className="bg-transparent outline-none text-sm flex-1" />
        </div>
      </div>
      {!d ? <div className="flex items-center gap-2 py-6" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>
        : !lista.length ? <div className="py-10 text-center rounded-xl" style={{ color: C.sub, background: C.panel, border: `1px solid ${C.line}` }}>Nenhuma conta {filtro !== "TODAS" ? "neste filtro" : "neste mês"}.{pagar ? " As contas dos pedidos à Meridian aparecem sozinhas." : ""}</div>
        : mobile ? (
          <div className="space-y-2">
            {lista.map((t) => { const [st, cor, fundo] = situ(t); return (
              <div key={t.id} className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${cor}` }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: C.text }}>{t.descricao}</div>
                    <div className="text-xs" style={{ color: C.sub }}>{[t.parceiro, t.conta && contaDe[t.conta]?.nome, t.numeroDoc && `nº ${t.numeroDoc}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="text-right"><div className="font-bold" style={{ color: C.navy }}>{money(t.valor)}</div><div className="text-xs" style={{ color: C.sub }}>vence {dBR(t.vencimento)}</div></div>
                </div>
                <div className="flex items-center gap-2 mt-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: fundo, color: cor }}>{st}</span>{t.meridian && <span className="text-[11px] font-bold" style={{ color: C.navy }}>MERIDIAN</span>}<div className="flex-1" /><Acoes t={t} /></div>
              </div>); })}
            <div className="text-right text-sm font-semibold py-2" style={{ color: C.navy }}>{lista.length} conta(s) · {money(totalLista)}</div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: C.panel2, color: C.sub }} className="text-xs text-left">
                <th className="px-3 py-2 font-semibold">Vencimento</th><th className="px-3 py-2 font-semibold">Descrição</th><th className="px-3 py-2 font-semibold">{pagar ? "Fornecedor" : "Cliente"}</th>
                <th className="px-3 py-2 font-semibold">Conta</th><th className="px-3 py-2 font-semibold text-right">Valor</th><th className="px-3 py-2 font-semibold">Situação</th><th className="px-3 py-2" /></tr></thead>
              <tbody>
                {lista.map((t) => { const [st, cor, fundo] = situ(t); return (
                  <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: t.status === "ABERTO" && t.vencimento < h ? C.red : C.text }}>{dBR(t.vencimento)}</td>
                    <td className="px-3 py-2"><div className="font-semibold" style={{ color: C.text }}>{t.descricao}</div>{(t.numeroDoc || t.observacao) && <div className="text-xs" style={{ color: C.sub }}>{[t.numeroDoc && `nº ${t.numeroDoc}`, t.observacao].filter(Boolean).join(" · ")}</div>}</td>
                    <td className="px-3 py-2" style={{ color: t.meridian ? C.navy : C.text, fontWeight: t.meridian ? 700 : 400 }}>{t.parceiro || "—"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.sub }}>{t.conta ? `${t.conta} ${contaDe[t.conta]?.nome || ""}` : <span style={{ color: C.yellow }}>sem conta</span>}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: C.navy }}>{money(t.valor)}{t.status === "PAGO" && t.valorPago != null && Math.abs(t.valorPago - t.valor) >= 0.01 && <div className="text-[11px] font-normal" style={{ color: C.sub }}>{pagar ? "pago" : "recebido"} {money(t.valorPago)}</div>}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: fundo, color: cor }}>{st}</span></td>
                    <td className="px-3 py-2"><Acoes t={t} /></td>
                  </tr>); })}
              </tbody>
              <tfoot><tr style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}><td colSpan={4} className="px-3 py-2 text-xs" style={{ color: C.sub }}>{lista.length} conta(s){d.titulos.some((t) => t.vencimento < `${mes}-01`) ? " · inclui as em aberto de meses anteriores" : ""}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: C.navy }}>{money(totalLista)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
        )}
      {form && <TituloForm api={api} tipo={tipo} inicial={form} contas={contas} onClose={() => setForm(null)} onOk={() => { setForm(null); carregar(); }} />}
      {baixa && <BaixaForm api={api} t={baixa} pagar={pagar} onClose={() => setBaixa(null)} onOk={() => { setBaixa(null); carregar(); }} />}
    </div>
  );
}

function TituloForm({ api, tipo, inicial, contas, onClose, onOk }) {
  const novo = !inicial.id;
  const pagar = tipo === "PAGAR";
  const nb = (v) => (v == null || v === "" ? "" : String(Number(v).toFixed(2)).replace(".", ","));
  const [f, setF] = useState({ descricao: inicial.descricao || "", parceiro: inicial.parceiro || "", numeroDoc: inicial.numeroDoc || "", valor: nb(inicial.valor), vencimento: inicial.vencimento || hojeISO(),
    contaId: inicial.contaId || "", formaPagamento: inicial.formaPagamento || "", observacao: inicial.observacao || "", parcelas: "1", ppId: inicial.ppId || "",
    pago: false, dataPagamento: inicial.dataPagamento || hojeISO(), valorPago: nb(inicial.valorPago) });
  const [peds, setPeds] = useState(null);
  const [salv, setSalv] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (!pagar) api("/api/portal/fin?pedidos=1").then((j) => setPeds(j.pedidos)).catch(() => setPeds([])); }, []);
  const opcoes = (contas || []).filter((c) => GRUPOS_TIPO[tipo].includes(c.grupo) && c.codigo !== "3.01");
  const escolherPedido = (id) => {
    set("ppId", id);
    const p = (peds || []).find((x) => String(x.id) === String(id));
    if (!p || !novo) return;
    const falta = Math.max(0, Math.round((p.venda - p.lancado) * 100) / 100);
    setF((x) => ({ ...x, ppId: id, descricao: x.descricao || `VENDA PEDIDO ${p.numero}`, parceiro: x.parceiro || p.cliente, valor: x.valor || nb(falta || p.venda),
      contaId: x.contaId || (opcoes.find((c) => c.codigo === "1.01")?.id ?? "") }));
  };
  const salvar = async () => {
    setSalv(true);
    try {
      await api("/api/portal/fin", { method: "POST", body: JSON.stringify({ acao: "salvar", titulo: { ...f, tipo, id: inicial.id || undefined, ...(!novo && inicial.status !== "PAGO" ? { dataPagamento: undefined } : {}) } }) });
      onOk();
    } catch (e) { alerta(e.message); }
    setSalv(false);
  };
  const n = Number(f.parcelas) || 1;
  return (
    <Janela titulo={novo ? (pagar ? "Nova conta a pagar" : "Nova conta a receber") : `Editar conta a ${pagar ? "pagar" : "receber"}`} onClose={onClose}
      rodape={<><Btn contorno onClick={onClose}>Cancelar</Btn><Btn onClick={salvar} disabled={salv}>{salv ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Salvar</Btn></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!pagar && (
          <Campo t="Pedido do portal (opcional)" span>
            <select value={f.ppId} onChange={(e) => escolherPedido(e.target.value)} className={inp} style={inpS}>
              <option value="">— sem pedido —</option>
              {(peds || []).map((p) => <option key={p.id} value={p.id}>{p.numero} · {p.cliente || "sem cliente"} · venda {money(p.venda)}{p.lancado ? ` · já lançado ${money(p.lancado)}` : ""}</option>)}
            </select>
          </Campo>
        )}
        <Campo t="Descrição" span><input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} className={inp} style={inpS} placeholder={pagar ? "Ex.: aluguel da loja" : "Ex.: venda pedido 0012"} autoFocus={pagar} /></Campo>
        <Campo t={pagar ? "Fornecedor" : "Cliente"}><input value={f.parceiro} onChange={(e) => set("parceiro", e.target.value)} className={inp} style={inpS} /></Campo>
        <Campo t="Conta do plano">
          <select value={f.contaId} onChange={(e) => set("contaId", e.target.value)} className={inp} style={inpS}>
            <option value="">— escolha —</option>
            {GRUPOS_TIPO[tipo].map((g) => { const cs = opcoes.filter((c) => c.grupo === g); return cs.length ? <optgroup key={g} label={NOME_GRUPO[g]}>{cs.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nome}</option>)}</optgroup> : null; })}
          </select>
        </Campo>
        <Campo t={novo && n > 1 ? "Valor total (dividido nas parcelas)" : "Valor (R$)"}><input value={f.valor} onChange={(e) => set("valor", e.target.value)} inputMode="decimal" className={inp} style={inpS} placeholder="0,00" /></Campo>
        <Campo t={novo && n > 1 ? "Vencimento da 1ª parcela" : "Vencimento"}><input type="date" value={f.vencimento} onChange={(e) => set("vencimento", e.target.value)} className={inp} style={inpS} /></Campo>
        {novo && <Campo t="Parcelas (mensais)"><input value={f.parcelas} onChange={(e) => set("parcelas", e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={inp} style={inpS} /></Campo>}
        <Campo t="Forma de pagamento"><select value={f.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)} className={inp} style={inpS}>{FORMAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
        <Campo t="Nº do documento (NF, boleto…)"><input value={f.numeroDoc} onChange={(e) => set("numeroDoc", e.target.value)} className={inp} style={inpS} /></Campo>
        <Campo t="Observação" span><input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} className={inp} style={inpS} /></Campo>
        {novo && n <= 1 && (
          <label className="sm:col-span-2 flex items-center gap-2 text-sm" style={{ color: C.text }}><input type="checkbox" checked={f.pago} onChange={(e) => set("pago", e.target.checked)} /> Já foi {pagar ? "paga" : "recebida"}</label>
        )}
        {((novo && f.pago && n <= 1) || (!novo && inicial.status === "PAGO")) && <>
          <Campo t={`Data do ${pagar ? "pagamento" : "recebimento"}`}><input type="date" value={f.dataPagamento} onChange={(e) => set("dataPagamento", e.target.value)} className={inp} style={inpS} /></Campo>
          <Campo t={`Valor ${pagar ? "pago" : "recebido"} (vazio = o valor da conta)`}><input value={f.valorPago} onChange={(e) => set("valorPago", e.target.value)} inputMode="decimal" className={inp} style={inpS} /></Campo>
        </>}
      </div>
    </Janela>
  );
}

function BaixaForm({ api, t, pagar, onClose, onOk }) {
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState(String(t.valor.toFixed(2)).replace(".", ","));
  const [salv, setSalv] = useState(false);
  const ir = async () => {
    setSalv(true);
    try { await api("/api/portal/fin", { method: "POST", body: JSON.stringify({ acao: "baixar", id: t.id, data, valor }) }); onOk(); } catch (e) { alerta(e.message); }
    setSalv(false);
  };
  return (
    <Janela titulo={pagar ? "Registrar pagamento" : "Registrar recebimento"} onClose={onClose} largura={420}
      rodape={<><Btn contorno onClick={onClose}>Cancelar</Btn><Btn cor={C.green} onClick={ir} disabled={salv}>{salv ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmar</Btn></>}>
      <div className="text-sm mb-3"><b style={{ color: C.navy }}>{t.descricao}</b><div style={{ color: C.sub }}>{t.parceiro ? `${t.parceiro} · ` : ""}vence {dBR(t.vencimento)} · {money(t.valor)}</div></div>
      <div className="grid grid-cols-2 gap-3">
        <Campo t="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} style={inpS} /></Campo>
        <Campo t={pagar ? "Valor pago" : "Valor recebido"}><input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inp} style={inpS} /></Campo>
      </div>
    </Janela>
  );
}

// ---------- análise mensal (DRE simplificada) ----------
function Analise({ api, mobile }) {
  const [ano, setAno] = useState(Number(hojeISO().slice(0, 4)));
  const [regime, setRegime] = useState("REALIZADO");
  const [d, setD] = useState(null);
  const [ab, setAb] = useState({});
  useEffect(() => { setD(null); api(`/api/portal/fin?analise=1&ano=${ano}&regime=${regime}`).then(setD).catch((e) => alerta(e.message)); }, [ano, regime]);
  const mesAtual = d && Number(d.hoje.slice(0, 4)) === ano ? Number(d.hoje.slice(5, 7)) - 1 : -1;
  const cel = (v, forte) => <td className="px-2 py-1.5 text-right whitespace-nowrap" style={{ color: v < 0 ? C.red : v > 0 ? C.text : "#B0B7C3", fontWeight: forte ? 700 : 400 }}>{v ? curto(v) : "–"}</td>;
  const Linha = ({ nome, m, total, forte, fundo, onClick, aberto, nivel = 0, pct, pctTotal }) => (
    <>
      <tr style={{ background: fundo || "transparent", borderTop: `1px solid ${C.line}`, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
        <td className="px-3 py-1.5 sticky left-0" style={{ background: fundo || C.panel, color: forte ? C.navy : C.text, fontWeight: forte ? 700 : 400, paddingLeft: 12 + nivel * 16, minWidth: mobile ? 170 : 260 }}>
          <span className="flex items-center gap-1">{onClick && (aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}{nome}</span>
        </td>
        {m.map((v, i) => <React.Fragment key={i}>{cel(v, forte)}</React.Fragment>)}
        {cel(total, true)}
      </tr>
      {pct && <tr style={{ background: fundo || "transparent" }}><td className="px-3 pb-1.5 text-[11px] sticky left-0" style={{ background: fundo || C.panel, color: C.sub, paddingLeft: 12 + nivel * 16 }}>% da receita</td>
        {pct.map((p, i) => <td key={i} className="px-2 pb-1.5 text-right text-[11px]" style={{ color: p == null ? "#B0B7C3" : p < 0 ? C.red : C.green }}>{p == null ? "–" : `${String(p).replace(".", ",")}%`}</td>)}
        <td className="px-2 pb-1.5 text-right text-[11px] font-semibold" style={{ color: pctTotal == null ? "#B0B7C3" : pctTotal < 0 ? C.red : C.green }}>{pctTotal == null ? "–" : `${String(pctTotal).replace(".", ",")}%`}</td></tr>}
    </>
  );
  const G = d ? Object.fromEntries(d.grupos.map((g) => [g.k, g])) : {};
  const R = d?.resultados || {};
  const grupo = (k) => { const g = G[k]; if (!g) return null; return (
    <React.Fragment key={k}>
      <Linha nome={g.nome} m={g.m} total={g.total} onClick={g.contas.length ? () => setAb((x) => ({ ...x, [k]: !x[k] })) : null} aberto={ab[k]} />
      {ab[k] && g.contas.map((c) => <Linha key={c.codigo} nome={`${c.codigo} ${c.nome}`} m={c.m} total={c.total} nivel={1} />)}
    </React.Fragment>); };
  const res = (x, fundo) => x && <Linha nome={x.nome} m={x.m} total={x.total} forte fundo={fundo} pct={x.pct} pctTotal={x.pctTotal} />;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setAno(ano - 1)} className="p-2" aria-label="Ano anterior"><ChevronLeft size={16} /></button>
          <div className="px-3 text-sm font-semibold" style={{ color: C.navy }}>{ano}</div>
          <button onClick={() => setAno(ano + 1)} className="p-2" aria-label="Próximo ano"><ChevronRight size={16} /></button>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["REALIZADO", "Realizado"], ["PREVISTO", "Previsto"]].map(([k, t]) => (
            <button key={k} onClick={() => setRegime(k)} className="px-3 py-2 text-sm font-semibold" style={regime === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub }}>{t}</button>
          ))}
        </div>
        <div className="text-xs" style={{ color: C.sub }}>{regime === "REALIZADO" ? "O que foi pago e recebido, pela data do pagamento." : "O realizado mais o que está em aberto, pelo vencimento."}</div>
      </div>
      {!d ? <div className="flex items-center gap-2 py-6" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div> : <>
        <div className={`grid gap-2 mb-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
          {[["Receita bruta", G.RECEITA?.total, null], ["Margem bruta", R.margem?.total, R.margem?.pctTotal], ["EBITDA", R.ebitda?.total, R.ebitda?.pctTotal], ["Resultado de caixa", R.resultado?.total, R.resultado?.pctTotal]].map(([t, v, p]) => (
            <div key={t} className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: C.sub }}>{t} · {ano}</div>
              <div className="text-lg font-bold" style={{ color: (v || 0) < 0 ? C.red : C.navy }}>{money(v || 0)}</div>
              {p != null && <div className="text-[11px]" style={{ color: p < 0 ? C.red : C.green }}>{String(p).replace(".", ",")}% da receita</div>}
            </div>
          ))}
        </div>
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="text-xs w-full" style={{ minWidth: 980 }}>
            <thead><tr style={{ background: C.navy, color: "#fff" }}>
              <th className="px-3 py-2 text-left sticky left-0" style={{ background: C.navy }}>DRE {regime === "REALIZADO" ? "realizada" : "prevista"} · {ano}</th>
              {MESES.map((m, i) => <th key={m} className="px-2 py-2 text-right" style={{ color: i === mesAtual ? C.accent : "#fff" }}>{m}</th>)}
              <th className="px-2 py-2 text-right">Total</th></tr></thead>
            <tbody>
              {grupo("RECEITA")}{grupo("DEDUCAO")}
              {res(R.receitaLiquida, C.steelSoft)}
              {grupo("CMV")}
              {res(R.margem, C.steelSoft)}
              {grupo("DESPESA")}
              {res(R.ebitda, C.steelSoft)}
              {grupo("IMPOSTO")}{grupo("FINANCEIRO")}
              {res(R.lucro, C.steelSoft)}
              {grupo("INVESTIMENTO")}
              {res(R.resultado, C.accentSoft)}
              <tr><td colSpan={14} className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide font-bold" style={{ color: C.sub }}>Caixa</td></tr>
              <Linha nome="Entradas" m={d.caixa.entradas} total={d.caixa.entradas.reduce((s, x) => s + x, 0)} />
              <Linha nome="Saídas" m={d.caixa.saidas.map((x) => -x)} total={-d.caixa.saidas.reduce((s, x) => s + x, 0)} />
              <Linha nome="Saldo do mês" m={d.caixa.saldo} total={d.caixa.saldo.reduce((s, x) => s + x, 0)} forte />
              <Linha nome="Saldo acumulado no ano" m={d.caixa.acumulado} total={d.caixa.acumulado[11]} />
              {regime === "PREVISTO" && <>
                <tr><td colSpan={14} className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide font-bold" style={{ color: C.sub }}>Ainda em aberto (incluído acima)</td></tr>
                <Linha nome="A receber" m={d.aberto.receber} total={d.aberto.receber.reduce((s, x) => s + x, 0)} />
                <Linha nome="A pagar" m={d.aberto.pagar.map((x) => -x)} total={-d.aberto.pagar.reduce((s, x) => s + x, 0)} />
              </>}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] mt-2" style={{ color: C.sub }}>Clique num grupo para ver as contas. As compras dos pedidos à Meridian entram no CMV sozinhas. Contas sem classificação aparecem em "sem conta".</div>
      </>}
    </div>
  );
}

// ---------- plano de contas ----------
function Plano({ api, contas, onMudou }) {
  const [nova, setNova] = useState({ grupo: "DESPESA", nome: "" });
  const salvar = async (conta) => { try { await api("/api/portal/fin", { method: "POST", body: JSON.stringify({ acao: "conta", conta }) }); onMudou(); return true; } catch (e) { alerta(e.message); return false; } };
  if (!contas) return <div className="flex items-center gap-2 py-6" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  return (
    <div className="max-w-3xl">
      <div className="rounded-xl p-3 mb-3 flex flex-wrap items-end gap-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <Campo t="Grupo"><select value={nova.grupo} onChange={(e) => setNova((x) => ({ ...x, grupo: e.target.value }))} className={inp} style={inpS}>{Object.entries(NOME_GRUPO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
        <div className="flex-1 min-w-[200px]"><Campo t="Nome da conta nova"><input value={nova.nome} onChange={(e) => setNova((x) => ({ ...x, nome: e.target.value }))} className={inp} style={inpS} placeholder="Ex.: embalagens" /></Campo></div>
        <Btn onClick={async () => { if (await salvar(nova)) setNova((x) => ({ ...x, nome: "" })); }} disabled={!nova.nome.trim()}><Plus size={14} /> Adicionar</Btn>
      </div>
      {Object.entries(NOME_GRUPO).map(([g, t]) => (
        <div key={g} className="rounded-xl mb-2 overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide" style={{ background: C.panel2, color: C.navy }}>{t}</div>
          {contas.filter((c) => c.grupo === g).map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm" style={{ borderTop: `1px solid ${C.line}`, opacity: c.ativo ? 1 : 0.5 }}>
              <span className="font-mono text-xs w-10" style={{ color: C.sub }}>{c.codigo}</span>
              <span className="flex-1" style={{ color: C.text }}>{c.nome}{c.codigo === "3.01" && <span className="ml-2 text-[11px]" style={{ color: C.sub }}>(automática: pedidos à Meridian)</span>}</span>
              {!c.sistema && <button onClick={async () => { const n = await perguntar("Novo nome da conta:", c.nome); if (n && n.trim()) salvar({ id: c.id, nome: n }); }} className="p-1" title="Renomear"><Pencil size={13} style={{ color: C.sub }} /></button>}
              {!c.sistema && <button onClick={() => salvar({ id: c.id, ativo: !c.ativo })} className="text-xs px-2 py-0.5 rounded" style={{ border: `1px solid ${C.line}`, color: C.sub }}>{c.ativo ? "Desativar" : "Ativar"}</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- v1091 — matriz de custos (modelo da Matriz da Meridian) ----------
const REGIMES_M = [["CLT", "CLT"], ["DIRETOR", "Pró-labore"], ["ESTAGIO", "Estágio"]];
const celM = "rounded px-2 py-1 text-xs outline-none w-full";
function MatrizCustos({ api, mobile }) {
  const [d, setD] = useState(null);
  const [m, setM] = useState(null);
  const [mudou, setMudou] = useState(false);
  const [salv, setSalv] = useState(false);
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const carregar = () => api("/api/portal/fin?matriz=1").then((x) => { setM(x); setD(x.dados); setMudou(false); }).catch((e) => alerta(e.message));
  useEffect(() => { carregar(); }, []);
  if (!d) return <div className="flex items-center gap-2 py-6" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  const up = (k, i, patch) => { setD((x) => ({ ...x, [k]: x[k].map((r, j) => (j === i ? { ...r, ...patch } : r)) })); setMudou(true); };
  const add = (k, r) => { setD((x) => ({ ...x, [k]: [...(x[k] || []), r] })); setMudou(true); };
  const tirar = (k, i) => { setD((x) => ({ ...x, [k]: x[k].filter((_, j) => j !== i) })); setMudou(true); };
  const salvar = async () => { setSalv(true); try { const x = await api("/api/portal/fin", { method: "POST", body: JSON.stringify({ acao: "matriz", dados: d }) }); setM(x); setD(x.dados); setMudou(false); } catch (e) { alerta(e.message); } setSalv(false); };
  const gerar = async () => {
    if (mudou) return alerta("Salve a matriz antes de gerar as contas.");
    if (!(await confirmar(`Gerar as contas a pagar de ${mes.slice(5)}/${mes.slice(0, 4)} pela matriz (salários dia 5, encargos e benefícios dia 20, custos fixos no dia de cada um)? O que já foi gerado não duplica.`))) return;
    try { const r = await api("/api/portal/fin", { method: "POST", body: JSON.stringify({ acao: "matrizContas", mes }) }); alerta(`${r.criadas} conta(s) criada(s), ${r.atualizadas} atualizada(s), ${r.mantidas} já existiam. Total do mês: ${money(r.total)}.`); } catch (e) { alerta(e.message); }
  };
  const calc = m?.calc || { pessoas: [], secoes: {}, pessoal: 0, total: 0 };
  const cp = (id) => calc.pessoas.find((x) => x.id === id);
  const inS = { ...inpS };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="rounded-xl px-4 py-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}><div className="text-[11px] uppercase font-semibold" style={{ color: C.sub }}>Custo mensal</div><div className="text-lg font-bold" style={{ color: C.navy }}>{money(calc.total)}</div></div>
        <div className="text-xs" style={{ color: C.sub }}>Pessoal {money(calc.pessoal)}{(m?.secoes || []).map((s) => calc.secoes[s.k] ? ` · ${s.nome} ${money(calc.secoes[s.k])}` : "").join("")}</div>
        <div className="flex-1" />
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={inpS} />
        <Btn contorno onClick={gerar}>Gerar contas do mês</Btn>
        <Btn onClick={salvar} disabled={!mudou || salv}>{salv ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</Btn>
      </div>
      <div className="rounded-xl mb-4 overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center" style={{ background: C.panel2, color: C.navy }}>Pessoal<button onClick={() => add("pessoal", { nome: "", cargo: "", regime: "CLT", salario: "", bonus: 0, vt: 0, vr: 0, ps: 0, descontaVt: true, ativo: true })} className="ml-auto text-xs normal-case flex items-center gap-1" style={{ color: C.accent }}><Plus size={12} /> pessoa</button></div>
        <table className="w-full text-xs" style={{ minWidth: 900 }}>
          <thead><tr style={{ color: C.sub }} className="text-left"><th className="px-2 py-1.5">Nome</th><th className="px-2">Cargo</th><th className="px-2">Regime</th><th className="px-2">Salário</th><th className="px-2">Bônus</th><th className="px-2">VT</th><th className="px-2">VR</th><th className="px-2">Plano</th><th className="px-2">Desc. VT</th><th className="px-2 text-right">Líquido</th><th className="px-2 text-right">Encargos + benef.</th><th className="px-2 text-right">Provisões</th><th className="px-2 text-right">Custo total</th><th /></tr></thead>
          <tbody>{(d.pessoal || []).map((p, i) => { const c = cp(p.id); return (
            <tr key={p.id || i} style={{ borderTop: `1px solid ${C.line}`, opacity: p.ativo === false ? 0.5 : 1 }}>
              <td className="px-2 py-1"><input value={p.nome} onChange={(e) => up("pessoal", i, { nome: e.target.value })} className={celM} style={inS} /></td>
              <td className="px-2"><input value={p.cargo || ""} onChange={(e) => up("pessoal", i, { cargo: e.target.value })} className={celM} style={inS} /></td>
              <td className="px-2"><select value={p.regime || "CLT"} onChange={(e) => up("pessoal", i, { regime: e.target.value })} className={celM} style={inS}>{REGIMES_M.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
              {["salario", "bonus", "vt", "vr", "ps"].map((k) => <td key={k} className="px-2"><input value={p[k] ?? ""} onChange={(e) => up("pessoal", i, { [k]: e.target.value })} inputMode="decimal" className={celM} style={{ ...inS, width: 72 }} /></td>)}
              <td className="px-2 text-center"><input type="checkbox" checked={!!p.descontaVt} onChange={(e) => up("pessoal", i, { descontaVt: e.target.checked })} /></td>
              <td className="px-2 text-right">{c ? money(c.liquido) : "—"}</td><td className="px-2 text-right">{c ? money(c.encargos + c.beneficios) : "—"}</td><td className="px-2 text-right">{c ? money(c.provisoes) : "—"}</td>
              <td className="px-2 text-right font-bold" style={{ color: C.navy }}>{c ? money(c.total) : "—"}</td>
              <td className="px-2 whitespace-nowrap"><button onClick={() => up("pessoal", i, { ativo: p.ativo === false })} className="text-[11px] mr-2" style={{ color: C.sub }}>{p.ativo === false ? "ativar" : "inativar"}</button><button onClick={() => tirar("pessoal", i)}><Trash2 size={13} style={{ color: C.red }} /></button></td>
            </tr>); })}</tbody>
        </table>
        {!(d.pessoal || []).length && <div className="px-4 py-3 text-xs" style={{ color: C.sub }}>Ninguém na folha ainda.</div>}
      </div>
      <div className={`grid gap-3 ${mobile ? "" : "grid-cols-2"}`}>
        {(m?.secoes || []).map((s) => (
          <div key={s.k} className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center" style={{ background: C.panel2, color: C.navy }}>{s.nome} <span className="ml-2 normal-case font-semibold" style={{ color: C.sub }}>{money(calc.secoes[s.k] || 0)}</span>
              <button onClick={() => add(s.k, { natureza: "", valor: "", dia: 10 })} className="ml-auto text-xs normal-case flex items-center gap-1" style={{ color: C.accent }}><Plus size={12} /> item</button></div>
            {(d[s.k] || []).map((x, i) => (
              <div key={x.id || i} className="flex items-center gap-2 px-3 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
                <input value={x.natureza} onChange={(e) => up(s.k, i, { natureza: e.target.value })} placeholder="Natureza (ex.: aluguel)" className={celM} style={inS} />
                <input value={x.valor ?? ""} onChange={(e) => up(s.k, i, { valor: e.target.value })} placeholder="R$" inputMode="decimal" className={celM} style={{ ...inS, width: 90 }} />
                <input value={x.dia ?? ""} onChange={(e) => up(s.k, i, { dia: e.target.value })} title="Dia do vencimento" placeholder="dia" inputMode="numeric" className={celM} style={{ ...inS, width: 48 }} />
                <button onClick={() => tirar(s.k, i)}><Trash2 size={13} style={{ color: C.red }} /></button>
              </div>
            ))}
            {!(d[s.k] || []).length && <div className="px-4 py-2 text-xs" style={{ color: C.sub }}>Nenhum item.</div>}
          </div>
        ))}
      </div>
      <div className="text-[11px] mt-2" style={{ color: C.sub }}>Encargos e provisões calculados como na Matriz da Meridian (INSS {String((d.parametros?.inssPatronal ?? 0.2) * 100).replace(".", ",")}% patronal, FGTS {String((d.parametros?.fgts ?? 0.08) * 100).replace(".", ",")}%, 13º, férias, aviso e multa do FGTS). Salve para recalcular. {m?.atualizadoPor ? `Última alteração: ${m.atualizadoPor}.` : ""}</div>
    </div>
  );
}
