"use client";
// v382 — Análise financeira › Previsto × realizado: todos os painéis de previsão salvos e a conferência com o realizado
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X, Scale, Lock, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
};
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => (v == null ? "—" : `R$ ${brl(v)}`);
const dBR = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : "—");
const dataHora = (v) => { const d = new Date(v); return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeMes = (c) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;

export default function PrevistoRealizado({ user }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);
  const carregar = async () => {
    setErro("");
    try { const r = await fetch(`/api/fin/prevreal?u=${user.id}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) { setErro(j.error || "Erro"); return; } setD(j); }
    catch { setErro("Falha de conexão."); }
  };
  useEffect(() => { carregar(); }, []);
  const porMes = useMemo(() => { const m = {}; for (const p of d?.paineis || []) (m[p.mesPrevisto] = m[p.mesPrevisto] || []).push(p); return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])); }, [d]);

  return (
    <div>
      <div className="text-xs mb-4" style={{ color: C.sub }}>
        Todo painel de previsão salvo aparece aqui. A partir do 1º dia do mês seguinte ao previsto, <b>Analisar realizado</b> confere item a item com as baixas do contas a pagar e receber, os títulos previstos, as NFs emitidas e a DRE do mês. Onde houver divergência, registre a justificativa — fica guardada e forma o histórico.
      </div>
      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div style={{ color: C.sub }}><Loader2 size={16} className="animate-spin inline" /> Carregando…</div>}
      {d && !porMes.length && <div className="rounded-xl p-6 text-center text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>Nenhum painel salvo ainda. Use <b>Salvar painel</b> no Painel de previsão do mês.</div>}
      {porMes.map(([M, l]) => (
        <div key={M} className="mb-5">
          <div className="text-xs font-bold uppercase mb-2" style={{ color: C.navy }}>Previsão de {nomeMes(M)}</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {l.map((p) => {
              const a = p.analise;
              const [cor, bg, txt, Ico] = a ? (a.divergentes ? (a.justificadas >= a.divergentes ? [C.green, C.greenSoft, `${a.divergentes} divergência(s) justificada(s)`, CheckCircle2] : [C.yellow, C.yellowSoft, `${a.divergentes - a.justificadas} de ${a.divergentes} divergência(s) sem justificativa`, AlertTriangle]) : [C.green, C.greenSoft, "bateu com o previsto", CheckCircle2])
                : p.liberado ? [C.accent, C.accentSoft, "pronto para analisar", Scale] : [C.sub, C.panel2, `analisar a partir de ${dBR(p.liberadoEm)}`, Lock];
              return (
                <button key={p.salvoEm} onClick={() => setAberto(p)} className="text-left rounded-xl p-4 transition-shadow hover:shadow-lg" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `3px solid ${cor}` }}>
                  <div className="text-sm font-bold" style={{ color: C.navy }}>Salvo em {dataHora(p.salvoEm)}</div>
                  <div className="text-[11px]" style={{ color: C.sub }}>{p.por ? `por ${p.por} · ` : ""}painel de {nomeMes(p.competencia)}</div>
                  <div className="text-xs mt-2" style={{ color: C.sub }}>Cenário do mês previsto <b style={{ color: (p.cenarioMes || 0) >= 0 ? C.green : C.red }}>{moeda(p.cenarioMes)}</b></div>
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: cor, background: bg }}><Ico size={11} /> {txt}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {aberto && <PainelPrevReal user={user} p={aberto} onClose={() => { setAberto(null); carregar(); }} />}
    </div>
  );
}

function PainelPrevReal({ user, p, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const url = `/api/fin/prevreal?u=${user.id}&competencia=${p.competencia}&salvoEm=${encodeURIComponent(p.salvoEm)}`;
  useEffect(() => { fetch(url, { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (r.ok) setD(j); else setErro(j.error || "Erro"); }).catch(() => setErro("Falha de conexão.")); }, []);
  const post = async (corpo) => {
    const r = await fetch("/api/fin/prevreal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, competencia: p.competencia, salvoEm: p.salvoEm, ...corpo }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Erro");
    return j;
  };
  const analisar = async () => { setGerando(true); setErro(""); try { setD(await post({ acao: "analisar" })); } catch (e) { setErro(e.message); } setGerando(false); };
  const justificar = async (k, texto) => {
    try { await post({ acao: "justificar", k, texto }); setD((x) => ({ ...x, analise: { ...x.analise, linhas: x.analise.linhas.map((l) => (l.k === k ? { ...l, justificativa: texto } : l)) } })); }
    catch (e) { setErro(e.message); }
  };
  // antes de analisar: o previsto do painel (mesmas linhas, sem o realizado)
  const s = d?.snapshot;
  const previstoSo = s ? [
    ["CAIXA DO MÊS", "Entradas do mês", s.cenarios?.memoria?.entradasMes], ["CAIXA DO MÊS", "Saídas do mês", s.cenarios?.memoria?.saidasMes], ["CAIXA DO MÊS", "Cenário do mês", s.cenarios?.mes],
    ["POSIÇÃO NO DIA DO PAINEL", "Contas atrasadas", s.pos?.pagar?.atrasadas], ["POSIÇÃO NO DIA DO PAINEL", "A pagar no mês", s.pos?.pagar?.mes], ["POSIÇÃO NO DIA DO PAINEL", "A receber no mês (real)", s.pos?.receber?.mes?.real],
    ["POSIÇÃO NO DIA DO PAINEL", "A receber atrasado", s.pos?.receber?.atrasado?.total], ["POSIÇÃO NO DIA DO PAINEL", "Prioridade do mês", s.selecionados?.totPrioridade], ["POSIÇÃO NO DIA DO PAINEL", "Quitação provável", s.selecionados?.totQuitacao],
    ["CENÁRIOS", "Geral", s.cenarios?.geral], ["CENÁRIOS", "Cobrindo os limites", s.cenarios?.cobrindo], ["CENÁRIOS", "Sem cobrir", s.cenarios?.semCobrir], ["CENÁRIOS", "LB", s.cenarios?.lb],
  ].filter(([, , v]) => v != null) : [];
  const linhas = d?.analise?.linhas || [];
  const grupos = [...new Set(linhas.map((l) => l.grupo))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full flex flex-col" style={{ background: C.panel, maxWidth: 1080, maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Scale size={18} style={{ color: C.accent }} />
          <b style={{ color: C.navy }}>Previsto × realizado · {nomeMes(p.mesPrevisto)}</b>
          <span className="text-xs" style={{ color: C.sub }}>painel salvo em {dataHora(p.salvoEm)}{p.por ? ` por ${p.por}` : ""}</span>
          <div className="flex-1" />
          {d && (d.liberado
            ? <button onClick={analisar} disabled={gerando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.accent, color: "#fff", opacity: gerando ? 0.6 : 1 }}>
                {gerando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {d.analise ? "Analisar de novo" : "Analisar realizado"}</button>
            : <span className="flex items-center gap-1 text-xs" style={{ color: C.sub }}><Lock size={13} /> realizado a partir de {dBR(d.liberadoEm)}</span>)}
          <button onClick={onClose} className="ml-2" style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-auto">
          {erro && <div className="p-2 rounded mb-3 text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
          {!d && !erro && <div style={{ color: C.sub }}><Loader2 size={16} className="animate-spin inline" /> Carregando…</div>}
          {d && !d.analise && (
            <table className="w-full text-sm">
              <tbody>{previstoSo.map(([g, t, v], i) => (
                <React.Fragment key={i}>
                  {(i === 0 || previstoSo[i - 1][0] !== g) && <tr><td colSpan={3} className="pt-3 pb-1 text-[11px] font-bold uppercase" style={{ color: C.navy }}>{g}</td></tr>}
                  <tr style={{ borderTop: `1px solid ${C.line}` }}><td className="py-1.5" style={{ color: C.sub }}>{t}</td><td className="py-1.5 text-right font-semibold tabular-nums">{moeda(v)}</td>
                    <td className="py-1.5 text-right text-xs" style={{ color: C.sub, width: 200 }}>realizado: {d.liberado ? "clique em Analisar realizado" : `a partir de ${dBR(d.liberadoEm)}`}</td></tr>
                </React.Fragment>))}</tbody>
            </table>
          )}
          {d?.analise && (
            <>
              <div className="text-[11px] mb-2" style={{ color: C.sub }}>Gerado em {dataHora(d.analise.geradoEm)}{d.analise.por ? ` por ${d.analise.por}` : ""}. Divergência = diferença acima de 2% (mín. R$ 100). Justificativa não é obrigatória.</div>
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead><tr style={{ color: C.sub }}>
                  <th className="py-1 text-left font-semibold">Item</th><th className="py-1 text-right font-semibold" style={{ width: 130 }}>Previsto</th>
                  <th className="py-1 text-right font-semibold" style={{ width: 130 }}>Realizado</th><th className="py-1 text-right font-semibold" style={{ width: 120 }}>Diferença</th>
                  <th className="py-1 pl-3 text-left font-semibold" style={{ width: 300 }}>Justificativa</th>
                </tr></thead>
                <tbody>
                  {grupos.map((g) => (
                    <React.Fragment key={g}>
                      <tr><td colSpan={5} className="pt-3 pb-1 text-[11px] font-bold uppercase" style={{ color: C.navy }}>{g}</td></tr>
                      {linhas.filter((l) => l.grupo === g).map((l) => (
                        <tr key={l.k} style={{ borderTop: `1px solid ${C.line}`, background: l.divergente ? C.yellowSoft : undefined }}>
                          <td className="py-1.5 pr-2 align-top"><div style={{ color: C.text }}>{l.rotulo}</div>{l.detalhe && <div className="text-[11px]" style={{ color: C.sub }}>{l.detalhe}</div>}</td>
                          <td className="py-1.5 text-right tabular-nums align-top">{moeda(l.previsto)}</td>
                          <td className="py-1.5 text-right tabular-nums font-semibold align-top">{moeda(l.realizado)}</td>
                          <td className="py-1.5 text-right tabular-nums align-top font-semibold" style={{ color: l.dif == null ? C.sub : l.divergente ? (l.dif >= 0 ? C.green : C.red) : C.sub }}>
                            {l.dif == null ? "—" : `${l.dif > 0 ? "+" : ""}${brl(l.dif)}`}</td>
                          <td className="py-1 pl-3 align-top">
                            {l.divergente ? <Justificativa valor={l.justificativa} onSalvar={(t) => justificar(l.k, t)} />
                              : l.dif != null ? <span className="text-[11px]" style={{ color: C.green }}>✓ bateu</span> : null}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Justificativa({ valor, onSalvar }) {
  const [v, setV] = useState(valor || "");
  const [salvo, setSalvo] = useState(false);
  useEffect(() => { setV(valor || ""); }, [valor]);
  return (
    <div className="relative">
      <textarea value={v} onChange={(e) => { setV(e.target.value); setSalvo(false); }} rows={2} placeholder="O que explica a diferença? (opcional)"
        onBlur={async () => { if (v !== (valor || "")) { await onSalvar(v); setSalvo(true); } }}
        className="w-full rounded px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${C.line}`, background: "#fff", resize: "vertical" }} />
      {salvo && <span className="absolute right-2 bottom-1.5 text-[10px]" style={{ color: C.green }}>salvo</span>}
    </div>
  );
}
