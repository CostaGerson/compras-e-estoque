"use client";
// v135 — Contas a receber atrasadas: em cobrança → execução judicial ou perda reconhecida
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, Search, Gavel, Ban, Undo2, CheckCircle2, X, Paperclip, Upload, Trash2, Download, Plus, ChevronRight, AlertTriangle, ArrowLeft, Pencil } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD",
  red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const nomeMes = (c) => { const [a, m] = String(c).split("-"); return `${MESES[Number(m) - 1]}/${a}`; };
const lerNum = (s) => { const t = String(s ?? "").trim().replace(/\s|R\$/g, ""); if (!t) return 0; const x = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t; const v = Number(x); return Number.isFinite(v) ? v : 0; };
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(file); });
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};
const inpS = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
const corAtraso = (d) => (d > 90 ? C.red : d > 30 ? C.yellow : C.sub);

// ordenar clicando no título da coluna: A→Z, Z→A, volta (igual ao resto do sistema)
function useOrdem(itens) {
  const [ordem, setOrdem] = useState(null);   // { col, dir: 1 | -1 }
  const lista = useMemo(() => {
    if (!ordem) return itens;
    return [...itens].sort((a, b) => {
      const x = a[ordem.col] ?? "", y = b[ordem.col] ?? "";
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      return r * ordem.dir || String(a.vencimento || "").localeCompare(String(b.vencimento || ""));
    });
  }, [itens, ordem]);
  const clicar = (col) => setOrdem((o) => (!o || o.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null));
  const Th = ({ col, children, direita }) => (
    <th className={`px-3 py-2 ${direita ? "text-right" : ""}`}>
      <button onClick={() => clicar(col)} title="Ordenar" className={`inline-flex items-center gap-0.5 uppercase tracking-wide ${direita ? "flex-row-reverse" : ""}`}
        style={{ color: ordem?.col === col ? C.accent : C.sub }}>
        {children}<span className="text-[10px]">{ordem?.col === col ? (ordem.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
  return { lista, Th };
}

const MarcaR = ({ t }) => (t?.vencimentoOriginal ? (
  <span title={`Reprogramado — vencimento original ${dBR(t.vencimentoOriginal)}`} className="inline-flex items-center justify-center ml-1 rounded-full text-[9px] font-bold align-middle"
    style={{ width: 15, height: 15, background: "#F1EDFF", color: "#7A5AF8", border: "1px solid #7A5AF866" }}>R</span>) : null);

// busca pelo valor: "1230,83", "1.230,83", "1230.83", "R$ 1.230" ou só o começo ("1.230") acham a conta;
// procura no valor da conta e no valor pago
function valorBate(t, q) {
  const s = String(q || "").replace(/R\$|\s/gi, "");
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return false;
  const digitos = s.replace(/[.,]/g, "");
  // texto digitado como número (vírgula ou ponto como decimal)
  const t2 = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : (s.split(".").length > 2 ? s.replace(/\./g, "") : s);
  const alvo = Number(t2);
  return [t.valor, t.valorPago].filter((v) => v != null).some((v) => {
    const n = Number(v);
    if (Number.isFinite(alvo) && Math.abs(n - alvo) < 0.005) return true;   // valor exato
    const br = n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return br.includes(s) || br.replace(/\./g, "").includes(s) || n.toFixed(2).includes(s) || n.toFixed(2).replace(".", "").startsWith(digitos);
  });
}
function Kpi({ rotulo, valor, sub, cor }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>{rotulo}</div>
      <div className="text-xl font-bold mt-1" style={{ color: cor || C.navy }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}
function Janela({ titulo, onClose, children, rodape, largura = 560 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-h-[92vh] flex flex-col" style={{ background: C.panel, maxWidth: largura }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b style={{ color: C.navy }}>{titulo}</b>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-5 overflow-auto">{children}</div>
        {rodape && <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>{rodape}</div>}
      </div>
    </div>
  );
}
const Campo = ({ l, children }) => <label className="block text-xs" style={{ color: C.sub }}>{l}<div className="mt-1">{children}</div></label>;
const BtnP = ({ children, cor = C.accent, ...p }) => <button {...p} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: cor, opacity: p.disabled ? 0.5 : 1 }}>{children}</button>;

/* ============================================================ */
export default function AtrasoReceber({ user, aba, setAba, onEditar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [aberta, setAberta] = useState(null);       // id da execução aberta
  const carregar = () => api(`/api/fin/atraso?u=${user.id}`).then((x) => { setD(x); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  useEffect(() => { setAberta(null); }, [aba]);
  const ok = (t) => { setAviso(t); setTimeout(() => setAviso(""), 4000); carregar(); };

  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}>{erro || <><Loader2 size={16} className="animate-spin" /> Carregando…</>}</div>;
  const soma = (l) => l.reduce((s, t) => s + t.valor, 0);
  const execAtivas = d.execucoes.filter((e) => e.status === "ATIVA");
  const perdasMes = d.perdas.filter((p) => String(p.perdaData || "").slice(0, 7) === d.mesAtual);
  return (
    <div>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Kpi rotulo="Em cobrança (atrasado)" valor={moeda(soma(d.atrasadas))} sub={`${d.atrasadas.length} conta(s)`} cor={d.atrasadas.length ? C.yellow : C.green} />
        <Kpi rotulo="Em execução judicial" valor={moeda(execAtivas.reduce((s, e) => s + e.valorEmExecucao, 0))} sub={`${execAtivas.length} execução(ões) ativa(s)`} cor={C.red} />
        <Kpi rotulo="Recuperado em execuções" valor={moeda(d.execucoes.reduce((s, e) => s + e.valorRecuperado, 0))} cor={C.green} />
        <Kpi rotulo="Perdas reconhecidas" valor={moeda(soma(d.perdas))} sub={`no mês: ${moeda(soma(perdasMes))}`} cor={C.red} />
      </div>
      {aviso && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {aba === "ATRASADAS" && <Atrasadas user={user} d={d} ok={ok} setErro={setErro} onEditar={onEditar} irExecucao={(id) => { setAba("EXECUCOES"); setTimeout(() => setAberta(id), 0); }} />}
      {aba === "EXECUCOES" && (aberta
        ? <Execucao user={user} id={aberta} atrasadas={d.atrasadas} voltar={() => { setAberta(null); carregar(); }} ok={ok} />
        : <Execucoes d={d} abrir={setAberta} />)}
      {aba === "PERDAS" && <Perdas user={user} d={d} ok={ok} setErro={setErro} />}
    </div>
  );
}

/* ---------------- atrasadas (em cobrança) ---------------- */
function Atrasadas({ user, d, ok, setErro, irExecucao, onEditar }) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [modal, setModal] = useState(null);   // "execucao" | "perda"
  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return d.atrasadas.filter((t) => !q || valorBate(t, q) || [t.parceiro, t.titulo, t.numeroDoc].some((x) => String(x || "").toUpperCase().includes(q)));
  }, [d, busca]);
  const { lista, Th } = useOrdem(filtradas);
  const escolhidas = d.atrasadas.filter((t) => sel.has(t.id));
  const marcar = (id, on) => setSel((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const todas = lista.length > 0 && lista.every((t) => sel.has(t.id));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, título, NF ou valor…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 260 }} />
        </div>
        <div className="flex-1" />
        {escolhidas.length > 0 && <span className="text-xs" style={{ color: C.sub }}>{escolhidas.length} marcada(s) · {moeda(escolhidas.reduce((s, t) => s + t.valor, 0))}</span>}
        <BtnP cor={C.navy} disabled={!escolhidas.length} onClick={() => setModal("execucao")}><Gavel size={15} /> Mover para execução</BtnP>
        <BtnP cor={C.red} disabled={!escolhidas.length} onClick={() => setModal("perda")}><Ban size={15} /> Reconhecer perda</BtnP>
      </div>
      <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-left" style={{ background: C.panel2, color: C.sub }}>
            <th className="px-3 py-2 w-8"><input type="checkbox" checked={todas} onChange={(e) => lista.forEach((t) => marcar(t.id, e.target.checked))} /></th>
            <Th col="parceiro">Cliente</Th><Th col="titulo">Conta</Th><Th col="vencimento">Vencimento</Th>
            <Th col="diasAtraso" direita>Atraso</Th><Th col="valor" direita>Valor</Th><th className="px-3 py-2">Situação</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} style={{ borderTop: `1px solid ${C.line}`, background: sel.has(t.id) ? C.accentSoft : undefined }}>
                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(t.id)} onChange={(e) => marcar(t.id, e.target.checked)} /></td>
                <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{t.parceiro}</td>
                <td className="px-3 py-2">{t.titulo}{t.cobranca === "DESCONTADO" && <span title="Antecipado" className="inline-flex items-center justify-center ml-1 rounded-full text-[9px] font-bold" style={{ width: 15, height: 15, background: C.blueSoft, color: C.blue }}>A</span>}{t.numeroDoc ? <span style={{ color: C.sub }}> · {t.numeroDoc}</span> : null}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dBR(t.vencimento)}<MarcaR t={t} /></td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold" style={{ color: corAtraso(t.diasAtraso) }}>{t.diasAtraso} dia(s)</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{moeda(t.valor)}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: C.yellowSoft, color: C.yellow }}>EM COBRANÇA</span></td>
                <td className="px-3 py-2 text-right">{onEditar && <button onClick={() => onEditar(t)} title="Editar conta" className="p-1 rounded" style={{ color: C.blue }}><Pencil size={15} /></button>}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: C.sub }}>Nenhuma conta a receber atrasada.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal === "execucao" && <MoverExecucao user={user} contas={escolhidas} execucoes={d.execucoes.filter((e) => e.status === "ATIVA")}
        onClose={() => setModal(null)} onFeito={(r) => { setModal(null); setSel(new Set()); ok(`${r.movidas} conta(s) movida(s) para a execução.`); irExecucao(r.execucaoId); }} />}
      {modal === "perda" && <ReconhecerPerda user={user} contas={escolhidas}
        onClose={() => setModal(null)} onFeito={(r) => { setModal(null); setSel(new Set()); ok(`${r.perdas} perda(s) reconhecida(s) · ${moeda(r.valor)} lançado(s) na DRE de ${nomeMes(r.competencia)}.`); }} />}
    </div>
  );
}

function MoverExecucao({ user, contas, execucoes, execucaoFixa, onClose, onFeito }) {
  const [modo, setModo] = useState(execucaoFixa ? "EXISTENTE" : execucoes.length ? "EXISTENTE" : "NOVA");
  const cliente0 = contas[0]?.parceiro || "";
  const [exId, setExId] = useState(execucaoFixa || (execucoes.find((e) => e.cliente === cliente0) || execucoes[0])?.id || "");
  const [n, setN] = useState({ titulo: `EXECUÇÃO ${cliente0}`, processo: "", cliente: cliente0, vara: "", advogado: "", dataAbertura: hojeISO(), observacao: "" });
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (e) => setN((x) => ({ ...x, [k]: e.target.value }));
  const ir = async () => {
    setSt(true); setErro("");
    try { onFeito(await api("/api/fin/atraso", "POST", { usuarioId: user.id, acao: "execucao", ids: contas.map((t) => t.id), ...(modo === "NOVA" ? { nova: n } : { execucaoId: Number(exId) }) })); }
    catch (e) { setErro(e.message); setSt(false); }
  };
  return (
    <Janela titulo="Mover para execução judicial" onClose={onClose} largura={620}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP cor={C.navy} onClick={ir} disabled={st || (modo === "EXISTENTE" && !exId)}>{st && <Loader2 size={14} className="animate-spin" />} Mover {contas.length} conta(s)</BtnP></>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>{contas.length} conta(s) · {moeda(contas.reduce((s, t) => s + t.valor, 0))}. Elas saem do contas a receber e passam a ser acompanhadas na guia Execuções judiciais.</div>
      {!execucaoFixa && (
        <div className="flex gap-2 mb-3">
          {[["EXISTENTE", "Juntar a uma execução", !execucoes.length], ["NOVA", "Abrir nova execução", false]].map(([k, t, off]) => (
            <button key={k} disabled={off} onClick={() => setModo(k)} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: modo === k ? C.navy : C.panel, color: modo === k ? "#fff" : off ? C.line : C.sub, border: `1px solid ${modo === k ? C.navy : C.line}` }}>{t}</button>
          ))}
        </div>
      )}
      {modo === "EXISTENTE" ? (
        <Campo l="Execução">
          <select value={exId} onChange={(e) => setExId(e.target.value)} disabled={!!execucaoFixa} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS}>
            {execucoes.map((e) => <option key={e.id} value={e.id}>{e.titulo}{e.processo ? ` · ${e.processo}` : ""} · {moeda(e.valorEmExecucao)}</option>)}
          </select>
        </Campo>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Campo l="Nome do caso"><input value={n.titulo} onChange={set("titulo")} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo></div>
          <Campo l="Nº do processo"><input value={n.processo} onChange={set("processo")} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo>
          <Campo l="Cliente (réu)"><input value={n.cliente} onChange={set("cliente")} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo>
          <Campo l="Vara / comarca"><input value={n.vara} onChange={set("vara")} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo>
          <Campo l="Advogado"><input value={n.advogado} onChange={set("advogado")} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo>
          <Campo l="Abertura"><input type="date" value={n.dataAbertura} onChange={set("dataAbertura")} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo>
          <div className="col-span-2"><Campo l="Observação"><textarea value={n.observacao} onChange={set("observacao")} rows={2} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo></div>
        </div>
      )}
      {erro && <div className="mt-3 text-xs" style={{ color: C.red }}>{erro}</div>}
    </Janela>
  );
}

function ReconhecerPerda({ user, contas, onClose, onFeito }) {
  const [just, setJust] = useState("");
  const [data, setData] = useState(hojeISO());
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const ir = async () => {
    setSt(true); setErro("");
    try { onFeito(await api("/api/fin/atraso", "POST", { usuarioId: user.id, acao: "perda", ids: contas.map((t) => t.id), justificativa: just, data })); }
    catch (e) { setErro(e.message); setSt(false); }
  };
  return (
    <Janela titulo="Reconhecer perda" onClose={onClose}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP cor={C.red} onClick={ir} disabled={st || just.trim().length < 10}>{st && <Loader2 size={14} className="animate-spin" />} Reconhecer perda</BtnP></>}>
      <div className="text-xs mb-3 p-2.5 rounded-lg" style={{ background: C.redSoft, color: C.red }}>
        {contas.length} conta(s) · <b>{moeda(contas.reduce((s, t) => s + t.valor, 0))}</b>. Saem do contas a receber, vão para a guia Perdas e entram na DRE do mês
        escolhido na conta 2143000 PERDA RECONHECIDA DE CLIENTES (abate a receita).
      </div>
      <Campo l="Justificativa (obrigatória)"><textarea value={just} onChange={(e) => setJust(e.target.value)} rows={4} placeholder="Ex.: empresa encerrou as atividades; sem bens para penhora; acordo inviável…" className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo>
      <div className="mt-3 w-48"><Campo l="Data do reconhecimento"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm" style={inpS} /></Campo></div>
      {erro && <div className="mt-3 text-xs" style={{ color: C.red }}>{erro}</div>}
    </Janela>
  );
}

/* ---------------- execuções ---------------- */
function Execucoes({ d, abrir }) {
  const [ver, setVer] = useState("ATIVA");
  const l = d.execucoes.filter((e) => ver === "TODAS" || e.status === ver);
  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {[["ATIVA", "Ativas"], ["ENCERRADA", "Encerradas"], ["TODAS", "Todas"]].map(([k, t]) => (
          <button key={k} onClick={() => setVer(k)} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: ver === k ? C.navy : C.panel2, color: ver === k ? "#fff" : C.sub }}>{t}</button>
        ))}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {l.map((e) => (
          <button key={e.id} onClick={() => abrir(e.id)} className="text-left rounded-xl p-4 hover:shadow-lg transition-shadow" style={{ background: C.panel, border: `1px solid ${e.evolucaoPendente ? C.yellow : C.line}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold" style={{ color: C.navy }}>{e.titulo}</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: e.status === "ATIVA" ? C.redSoft : C.panel2, color: e.status === "ATIVA" ? C.red : C.sub }}>{e.status}</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.sub }}>{e.processo ? `Processo ${e.processo}` : "Sem nº de processo"}{e.vara ? ` · ${e.vara}` : ""}</div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div><div style={{ color: C.sub }}>Em execução</div><div className="font-bold text-sm" style={{ color: C.red }}>{moeda(e.valorEmExecucao)}</div></div>
              <div><div style={{ color: C.sub }}>Recuperado</div><div className="font-bold text-sm" style={{ color: C.green }}>{moeda(e.valorRecuperado)}</div></div>
            </div>
            <div className="text-[11px] mt-2 pt-2 flex flex-wrap gap-x-3" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
              <span>{e.qtdTitulos} conta(s)</span><span>{e.qtdAnexos} arquivo(s)</span>
              <span>{e.ultimaEvolucao ? `última evolução: ${nomeMes(e.ultimaEvolucao.competencia)}` : "sem evolução"}</span>
            </div>
            {e.evolucaoPendente && <div className="text-[11px] mt-1.5 font-semibold flex items-center gap-1" style={{ color: C.yellow }}><AlertTriangle size={12} /> Falta a evolução de {nomeMes(d.mesAtual)}</div>}
          </button>
        ))}
        {!l.length && <div className="text-sm" style={{ color: C.sub }}>Nenhuma execução. Para abrir, marque contas na guia Atrasados a receber e clique em Mover para execução.</div>}
      </div>
    </div>
  );
}

function Execucao({ user, id, atrasadas, voltar, ok }) {
  const [e, setE] = useState(null);
  const [f, setF] = useState(null);
  const [erro, setErro] = useState("");
  const [st, setSt] = useState("");
  const [compEv, setCompEv] = useState(hojeISO().slice(0, 7));
  const [txtEv, setTxtEv] = useState("");
  const [addContas, setAddContas] = useState(false);
  const [receber, setReceber] = useState(null);
  const [arrasto, setArrasto] = useState(false);
  const ref = useRef(null);
  const aplicar = (x) => { setE(x); setF({ titulo: x.titulo, processo: x.processo || "", cliente: x.cliente || "", vara: x.vara || "", advogado: x.advogado || "", dataAbertura: x.dataAbertura || "", observacao: x.observacao || "", status: x.status }); };
  const carregar = () => api(`/api/fin/execucoes/${id}?u=${user.id}`).then(aplicar).catch((x) => setErro(x.message));
  useEffect(() => { carregar(); }, [id]);
  useEffect(() => { if (e) setTxtEv(e.evolucoes.find((v) => v.competencia === compEv)?.texto || ""); }, [e, compEv]);
  if (!e || !f) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}>{erro || <><Loader2 size={16} className="animate-spin" /> Carregando…</>}</div>;
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const run = async (rot, fn) => { setSt(rot); setErro(""); try { await fn(); } catch (x) { setErro(x.message); } setSt(""); };
  const salvarDados = () => run("dados", async () => { aplicar(await api(`/api/fin/execucoes/${id}`, "PATCH", { usuarioId: user.id, ...f })); ok("Execução atualizada."); });
  const salvarEv = () => run("ev", async () => { aplicar(await api(`/api/fin/execucoes/${id}`, "POST", { usuarioId: user.id, acao: "evolucao", competencia: compEv, texto: txtEv })); ok(`Evolução de ${nomeMes(compEv)} salva.`); });
  const enviar = (fs) => run("anexo", async () => {
    const arquivos = [];
    for (const x of [...(fs || [])]) arquivos.push({ nome: x.name, mime: x.type || null, conteudo: await readB64(x) });
    if (arquivos.length) aplicar(await api(`/api/fin/execucoes/${id}`, "POST", { usuarioId: user.id, acao: "anexos", arquivos }));
  });
  const apagarAnexo = (a) => confirm(`Excluir o arquivo ${a.nome}?`) && run("anexo", async () => aplicar(await api(`/api/fin/execucoes/${id}`, "DELETE", { usuarioId: user.id, anexoId: a.id })));
  const voltarCobranca = (t) => confirm(`Tirar ${t.titulo} da execução e voltar para cobrança?`) && run("t", async () => { await api("/api/fin/atraso", "POST", { usuarioId: user.id, acao: "voltar", id: t.id }); await carregar(); ok("Conta voltou para cobrança."); });
  const meses = [...new Set([hojeISO().slice(0, 7), ...e.evolucoes.map((v) => v.competencia)])].sort().reverse();
  const doCliente = atrasadas.filter((t) => !e.cliente || t.parceiro === e.cliente);
  return (
    <div>
      <button onClick={voltar} className="flex items-center gap-1 text-sm mb-3" style={{ color: C.accent }}><ArrowLeft size={15} /> Execuções judiciais</button>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Gavel size={22} style={{ color: C.accent }} />
        <div className="flex-1"><div className="text-lg font-bold" style={{ color: C.navy }}>{e.titulo}</div>
          <div className="text-xs" style={{ color: C.sub }}>{e.processo ? `Processo ${e.processo}` : "Sem nº de processo"} · em execução {moeda(e.valorEmExecucao)} · recuperado {moeda(e.valorRecuperado)}</div></div>
      </div>
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        {/* dados */}
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold mb-3" style={{ color: C.navy }}>Dados do processo</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Campo l="Nome do caso"><input value={f.titulo} onChange={set("titulo")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo></div>
            <Campo l="Nº do processo"><input value={f.processo} onChange={set("processo")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo>
            <Campo l="Cliente (réu)"><input value={f.cliente} onChange={set("cliente")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo>
            <Campo l="Vara / comarca"><input value={f.vara} onChange={set("vara")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo>
            <Campo l="Advogado"><input value={f.advogado} onChange={set("advogado")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo>
            <Campo l="Abertura"><input type="date" value={f.dataAbertura} onChange={set("dataAbertura")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo>
            <Campo l="Situação"><select value={f.status} onChange={set("status")} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS}><option value="ATIVA">ATIVA</option><option value="ENCERRADA">ENCERRADA</option></select></Campo>
            <div className="col-span-2"><Campo l="Observação"><textarea value={f.observacao} onChange={set("observacao")} rows={2} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo></div>
          </div>
          <div className="flex justify-end mt-3"><BtnP onClick={salvarDados} disabled={!!st}>{st === "dados" && <Loader2 size={14} className="animate-spin" />} Salvar dados</BtnP></div>
        </div>
        {/* evolução mensal */}
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-bold flex-1" style={{ color: C.navy }}>Evolução mensal</div>
            <select value={compEv} onChange={(x) => setCompEv(x.target.value)} className="rounded-lg px-2 py-1 text-xs" style={inpS}>
              {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
            </select>
          </div>
          <textarea value={txtEv} onChange={(x) => setTxtEv(x.target.value)} rows={4} placeholder="O que aconteceu no processo neste mês…" className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} />
          <div className="flex justify-end mt-2"><BtnP onClick={salvarEv} disabled={!!st || !txtEv.trim()}>{st === "ev" && <Loader2 size={14} className="animate-spin" />} Salvar evolução de {nomeMes(compEv)}</BtnP></div>
          <div className="mt-3 space-y-2 max-h-64 overflow-auto">
            {e.evolucoes.map((v) => (
              <div key={v.id} className="rounded-lg p-2.5 text-sm" style={{ background: C.panel2 }}>
                <div className="text-[11px] font-semibold mb-0.5" style={{ color: C.navy }}>{nomeMes(v.competencia)} <span style={{ color: C.sub, fontWeight: 400 }}>· {v.criadoPorNome || ""}</span></div>
                <div style={{ color: C.text, whiteSpace: "pre-wrap" }}>{v.texto}</div>
              </div>
            ))}
            {!e.evolucoes.length && <div className="text-xs" style={{ color: C.sub }}>Nenhuma evolução registrada ainda.</div>}
          </div>
        </div>
        {/* contas */}
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center mb-3">
            <div className="text-sm font-bold flex-1" style={{ color: C.navy }}>Contas nesta execução</div>
            <button onClick={() => setAddContas(true)} disabled={!atrasadas.length} className="flex items-center gap-1 text-xs font-semibold" style={{ color: atrasadas.length ? C.accent : C.line }}><Plus size={14} /> Incluir contas atrasadas</button>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {e.titulos.map((t) => (
                <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="py-2 pr-2"><div className="font-semibold" style={{ color: C.navy }}>{t.titulo}</div><div style={{ color: C.sub }}>{t.parceiro} · venc. {dBR(t.vencimento)}<MarcaR t={t} /></div></td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap font-semibold">{moeda(t.status === "PAGO" ? t.valorPago ?? t.valor : t.valor)}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {t.status === "PAGO" ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.greenSoft, color: C.green }}>RECEBIDO {dBR(t.dataPagamento).slice(0, 5)}</span> : <>
                      <button onClick={() => setReceber(t)} title="Recebido (acordo / bloqueio)" className="p-1" style={{ color: C.green }}><CheckCircle2 size={15} /></button>
                      <button onClick={() => voltarCobranca(t)} title="Voltar para cobrança" className="p-1" style={{ color: C.sub }}><Undo2 size={15} /></button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* arquivos */}
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${arrasto ? C.accent : C.line}` }}
          onDragOver={(x) => { x.preventDefault(); setArrasto(true); }} onDragLeave={() => setArrasto(false)}
          onDrop={(x) => { x.preventDefault(); setArrasto(false); enviar(x.dataTransfer.files); }}>
          <div className="flex items-center mb-3">
            <div className="text-sm font-bold flex-1" style={{ color: C.navy }}>Arquivos do processo</div>
            <button onClick={() => ref.current?.click()} disabled={!!st} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
              {st === "anexo" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Anexar
            </button>
            <input ref={ref} type="file" multiple className="hidden" onChange={(x) => { enviar(x.target.files); x.target.value = ""; }} />
          </div>
          {e.anexos.map((a) => (
            <div key={a.id} className="flex items-center gap-2 py-1.5 text-xs" style={{ borderTop: `1px solid ${C.line}` }}>
              <Paperclip size={13} style={{ color: C.sub }} />
              <span className="flex-1 truncate" title={a.nome}>{a.nome}</span>
              <span style={{ color: C.sub }}>{kb(a.tamanho)} · {dBR(String(a.createdAt).slice(0, 10))}</span>
              <a href={`/api/fin/execucoes/${id}?u=${user.id}&anexo=${a.id}`} target="_blank" rel="noreferrer" style={{ color: C.blue }}><Download size={14} /></a>
              <button onClick={() => apagarAnexo(a)} style={{ color: C.red }}><Trash2 size={14} /></button>
            </div>
          ))}
          {!e.anexos.length && <div className="text-xs py-4 text-center rounded-lg" style={{ color: C.sub, border: `2px dashed ${C.line}` }}>Arraste os arquivos do processo para cá</div>}
        </div>
      </div>
      {addContas && <IncluirContas user={user} execucao={e} atrasadas={atrasadas} sugeridas={doCliente} onClose={() => setAddContas(false)}
        onFeito={(r) => { setAddContas(false); carregar(); ok(`${r.movidas} conta(s) incluída(s) na execução.`); }} />}
      {receber && <ReceberExecucao user={user} t={receber} onClose={() => setReceber(null)} onFeito={() => { setReceber(null); carregar(); ok("Recebimento registrado (conta 1119000 RECEBIMENTO DE EXECUÇÃO JUDICIAL)."); }} />}
    </div>
  );
}

function IncluirContas({ user, execucao, atrasadas, sugeridas, onClose, onFeito }) {
  const [sel, setSel] = useState(() => new Set(sugeridas.map((t) => t.id)));
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const ir = async () => {
    setSt(true); setErro("");
    try { onFeito(await api("/api/fin/atraso", "POST", { usuarioId: user.id, acao: "execucao", ids: [...sel], execucaoId: execucao.id })); }
    catch (e) { setErro(e.message); setSt(false); }
  };
  return (
    <Janela titulo={`Incluir contas em ${execucao.titulo}`} onClose={onClose} largura={640}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP cor={C.navy} onClick={ir} disabled={st || !sel.size}>{st && <Loader2 size={14} className="animate-spin" />} Incluir {sel.size} conta(s)</BtnP></>}>
      <table className="w-full text-xs">
        <tbody>
          {atrasadas.map((t) => (
            <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="py-1.5 pr-2"><input type="checkbox" checked={sel.has(t.id)} onChange={(x) => setSel((s) => { const n = new Set(s); x.target.checked ? n.add(t.id) : n.delete(t.id); return n; })} /></td>
              <td className="py-1.5 pr-2"><b style={{ color: C.navy }}>{t.parceiro}</b> · {t.titulo}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap">{dBR(t.vencimento)}</td>
              <td className="py-1.5 text-right whitespace-nowrap font-semibold">{moeda(t.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {erro && <div className="mt-3 text-xs" style={{ color: C.red }}>{erro}</div>}
    </Janela>
  );
}

function ReceberExecucao({ user, t, onClose, onFeito }) {
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState(String(t.valor).replace(".", ","));
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const ir = async () => {
    setSt(true); setErro("");
    try { await api("/api/fin/atraso", "POST", { usuarioId: user.id, acao: "receber", id: t.id, data, valor: lerNum(valor) }); onFeito(); }
    catch (e) { setErro(e.message); setSt(false); }
  };
  return (
    <Janela titulo="Recebido na execução" onClose={onClose} largura={440}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP cor={C.green} onClick={ir} disabled={st}>{st && <Loader2 size={14} className="animate-spin" />} Registrar</BtnP></>}>
      <div className="text-sm mb-3"><b style={{ color: C.navy }}>{t.titulo}</b> · {t.parceiro} · {moeda(t.valor)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Campo l="Data do recebimento"><input type="date" value={data} onChange={(x) => setData(x.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm" style={inpS} /></Campo>
        <Campo l="Valor recebido"><input value={valor} onChange={(x) => setValor(x.target.value)} inputMode="decimal" className="w-full rounded-lg px-2 py-1.5 text-sm text-right" style={inpS} /></Campo>
      </div>
      <div className="text-[11px] mt-3" style={{ color: C.sub }}>A conta fica como recebida com a conta-caixa 1119000 RECEBIMENTO DE EXECUÇÃO JUDICIAL (receita). Ao identificar a entrada no extrato, use essa conta.</div>
      {erro && <div className="mt-3 text-xs" style={{ color: C.red }}>{erro}</div>}
    </Janela>
  );
}

/* ---------------- perdas ---------------- */
function Perdas({ user, d, ok, setErro }) {
  const { lista, Th } = useOrdem(d.perdas);
  const voltar = async (t) => {
    if (!confirm(`Desfazer a perda de ${t.titulo} (${moeda(t.valor)})? A conta volta para cobrança e o lançamento sai da DRE.`)) return;
    try { await api("/api/fin/atraso", "POST", { usuarioId: user.id, acao: "voltar", id: t.id }); ok("Perda desfeita — conta voltou para cobrança."); }
    catch (e) { setErro(e.message); }
  };
  return (
    <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <table className="w-full text-sm">
        <thead><tr className="text-xs uppercase tracking-wide text-left" style={{ background: C.panel2, color: C.sub }}>
          <Th col="perdaData">Reconhecida em</Th><Th col="parceiro">Cliente</Th><Th col="titulo">Conta</Th>
          <Th col="valor" direita>Valor</Th><Th col="perdaJustificativa">Justificativa</Th><th className="px-3 py-2"></th>
        </tr></thead>
        <tbody>
          {lista.map((t) => (
            <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-3 py-2 whitespace-nowrap">{dBR(t.perdaData)}<div className="text-[11px]" style={{ color: C.sub }}>{t.perdaPorNome || ""}</div></td>
              <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{t.parceiro}</td>
              <td className="px-3 py-2">{t.titulo}<div className="text-[11px]" style={{ color: C.sub }}>venc. {dBR(t.vencimento)}</div></td>
              <td className="px-3 py-2 text-right whitespace-nowrap font-semibold" style={{ color: C.red }}>{moeda(t.valor)}</td>
              <td className="px-3 py-2 text-xs" style={{ color: C.text, maxWidth: 380 }}>{t.perdaJustificativa}</td>
              <td className="px-3 py-2 text-right"><button onClick={() => voltar(t)} title="Desfazer (voltar para cobrança)" style={{ color: C.sub }}><Undo2 size={15} /></button></td>
            </tr>
          ))}
          {!d.perdas.length && <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: C.sub }}>Nenhuma perda reconhecida.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
