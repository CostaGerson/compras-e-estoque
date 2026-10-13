"use client";
// v186 — Contas a receber › Antecipações: títulos antecipados (por título ou por contrato), % antecipado,
// liquidação (cliente pagou quem antecipou) e contrato de origem (o "A" amarelo).
import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2, Search, CheckCircle2, Undo2, AlertTriangle, FileText, Plus, ChevronDown, ChevronRight, Download, Percent, FileSpreadsheet, ArrowLeftCircle, Plus as Mais, Trash2 } from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", amarelo: "#F5B800", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41", roxo: "#7A5AF8", roxoSoft: "#F1EDFF",
};
export const FORMAS_ANT = { BRADESCO: "Bradesco", AZUL_CAPITAL: "Factoring Azul Capital", PORTAL_PROPRIO: "Portal próprio" };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => "R$ " + brl(v);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fimDoMes = (iso) => { const [a, m] = iso.split("-").map(Number); return `${iso.slice(0, 7)}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; };
const somaDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); const x = new Date(a, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const lerNum = (s) => { const t = String(s ?? "").trim().replace(/\s|R\$/g, ""); if (!t) return null; const x = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t; const v = Number(x); return Number.isFinite(v) ? v : null; };
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(file); });
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};
// v187 — exporta para Excel as contas que estão na tela (na ordem da tela)
export async function exportarExcel(user, ids, titulo, nome) {
  if (!ids.length) { alert("Nenhuma conta na tela para exportar."); return; }
  const r = await fetch("/api/fin/titulos/xlsx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ids, titulo, nome }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || "Erro ao gerar o Excel."); return; }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function BotaoExcel({ onClick }) {
  const [x, setX] = useState(false);
  return (
    <button onClick={async () => { setX(true); try { await onClick(); } finally { setX(false); } }} disabled={x} title="Exportar para Excel as contas que estão na tela, com todas as informações de cada lançamento"
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: "#E7F6EE", color: "#12A150", border: "1px solid #12A15055" }}>
      {x ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Exportar Excel
    </button>
  );
}
const inpS = { background: C.panel, border: `1px solid ${C.line}`, color: C.text };

// situação do antecipado (vinda do servidor em sitAnt, ou calculada pelos campos)
export function sitAntecipado(t) {
  const k = t.sitAnt || (t.liquidadoEm ? (t.liquidacao === "RECOMPRA" ? "RECOMPRADO" : "LIQUIDADO") : t.recompraId ? "COBRADO" : t.vencimento < hojeISO() ? "VENCIDO" : "A_VENCER");
  return {
    A_VENCER: { k, t: "Antecipado · a vencer", c: C.yellow, bg: C.yellowSoft },
    VENCIDO: { k, t: `Aguarda cliente${t.prazoCobranca ? ` (até ${dBR(t.prazoCobranca).slice(0, 5)})` : ""}`, c: C.yellow, bg: C.yellowSoft },
    COBRADO: { k, t: "Banco cobrou — conta a pagar", c: C.red, bg: C.redSoft },
    LIQUIDADO: { k, t: `Liquidado ${dBR(t.liquidadoEm).slice(0, 5)}`, c: C.green, bg: C.greenSoft },
    RECOMPRADO: { k, t: `Recomprado ${dBR(t.liquidadoEm).slice(0, 5)}`, c: C.roxo, bg: C.roxoSoft },
  }[k];
}
export const ehAntecipado = (t) => t && (t.antecipadoForma || t.cobranca === "DESCONTADO");
export const antPendente = (t) => ehAntecipado(t) && t.status === "PAGO" && !t.liquidadoEm;

/* v189 — seta vermelha: recomprar o título antecipado (conta a pagar 2 dias úteis antes do vencimento) */
export function BotaoRecompra({ t, user, onFeito }) {
  const [aberto, setAberto] = useState(false);
  if (!antPendente(t) || t.recompraId) return null;
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setAberto(true); }} title="Recomprar: criar conta a pagar 2 dias úteis antes do vencimento (título que não deveria ter sido antecipado)"
        className="mr-2" style={{ color: C.red }}><ArrowLeftCircle size={15} /></button>
      {aberto && <RecompraModal t={t} user={user} onClose={() => setAberto(false)} onOk={(m) => { setAberto(false); onFeito && onFeito(m); }} />}
    </>
  );
}
function RecompraModal({ t, user, onClose, onOk }) {
  const [motivo, setMotivo] = useState("TÍTULO CANCELADO ENVIADO AO BANCO POR ERRO");
  const [erro, setErro] = useState("");
  const [s, setS] = useState(false);
  const ir = async () => {
    setS(true); setErro("");
    try { const r = await api("/api/fin/antecipacao", "POST", { usuarioId: user.id, acao: "recomprar", id: t.id, motivo }); onOk(`Conta a pagar de recompra criada: ${moeda(r.valor)} vencendo ${dBR(r.vencimento)}.`); }
    catch (e) { setErro(e.message); setS(false); }
  };
  return (
    <Modal titulo="Recomprar título antecipado" onClose={onClose} largura={520}
      rodape={<><button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Cancelar</button>
        <button onClick={ir} disabled={s} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.red, color: "#fff" }}>{s && <Loader2 size={14} className="animate-spin" />} Criar conta a pagar</button></>}>
      <div className="text-sm font-semibold" style={{ color: C.navy }}>{t.titulo} · {t.parceiro}</div>
      <div className="text-xs mb-3" style={{ color: C.sub }}>{moeda(t.valor)} · vence {dBR(t.vencimento)} · {FORMAS_ANT[t.antecipadoForma] || "Bradesco"}</div>
      <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.redSoft, color: C.red }}>Cria uma conta a pagar com os dados deste título, vencendo 2 dias úteis antes do vencimento original. Ao pagá-la, este título fica baixado (recomprado).</div>
      <label className="text-xs" style={{ color: C.sub }}>Motivo
        <input value={motivo} onChange={(e) => setMotivo(e.target.value.toUpperCase())} className="block w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
      {erro && <div className="mt-2 text-xs" style={{ color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* v189 — OBS: observações do lançamento, visíveis na lista */
export function Notas({ t }) {
  const l = Array.isArray(t?.notas) ? t.notas : [];
  if (!l.length) return null;
  return <div className="mt-0.5">{l.map((x, i) => (
    <div key={i} className="flex items-start gap-1 px-1.5 py-0.5 mb-0.5 rounded" style={{ background: C.yellowSoft, color: C.text }}>
      <span className="font-bold text-[9px] mt-px" style={{ color: C.yellow }}>OBS</span>
      <span>{x.texto} <span style={{ color: C.sub }}>· {(x.por || "").split(" ")[0]} {x.em ? new Date(x.em).toLocaleDateString("pt-BR") : ""}</span></span>
    </div>
  ))}</div>;
}
export function BotaoObs({ t, user, onFeito }) {
  const [aberto, setAberto] = useState(false);
  const n = Array.isArray(t.notas) ? t.notas.length : 0;
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setAberto(true); }} title="OBS — observações deste lançamento" className="mr-2 inline-flex items-center" style={{ color: n ? C.yellow : C.sub }}>
        <Mais size={15} />{n > 0 && <span className="text-[9px] font-bold">{n}</span>}
      </button>
      {aberto && <ObsModal t={t} user={user} onClose={() => setAberto(false)} onFeito={() => { setAberto(false); onFeito && onFeito(); }} />}
    </>
  );
}
function ObsModal({ t, user, onClose, onFeito }) {
  const [texto, setTexto] = useState("");
  const [notas, setNotas] = useState(Array.isArray(t.notas) ? t.notas : []);
  const [erro, setErro] = useState("");
  const [s, setS] = useState(false);
  const enviar = async (acao, extra) => {
    setS(true); setErro("");
    try { const r = await api(`/api/fin/titulos/${t.id}`, "PATCH", { usuarioId: user.id, acao, ...extra }); setNotas(r.notas || []); setTexto(""); return true; }
    catch (e) { setErro(e.message); return false; } finally { setS(false); }
  };
  return (
    <Modal titulo={`OBS · ${t.titulo}`} onClose={onFeito} largura={520}
      rodape={<><button onClick={onFeito} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Fechar</button>
        <button disabled={s || !texto.trim()} onClick={async () => { if (await enviar("nota", { texto })) onFeito(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.accent, color: "#fff" }}>{s && <Loader2 size={14} className="animate-spin" />} Salvar OBS</button></>}>
      <div className="text-xs mb-2" style={{ color: C.sub }}>{t.parceiro} · {moeda(t.valor)} · vence {dBR(t.vencimento)}</div>
      {notas.map((x, i) => (
        <div key={i} className="flex items-start gap-2 px-2 py-1.5 mb-1 rounded-lg text-xs" style={{ background: C.yellowSoft }}>
          <div className="flex-1">{x.texto}<div style={{ color: C.sub }}>{x.por || "—"} · {x.em ? new Date(x.em).toLocaleString("pt-BR") : ""}</div></div>
          <button onClick={() => confirm("Apagar esta OBS?") && enviar("nota-excluir", { indice: i })} title="Apagar" style={{ color: C.sub }}><Trash2 size={13} /></button>
        </div>
      ))}
      <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Escreva a observação…" className="w-full mt-2 rounded-lg px-3 py-2 text-sm outline-none" style={inpS} />
      {erro && <div className="mt-2 text-xs" style={{ color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* "A" amarelo — título antecipado; clicar abre o contrato */
export function MarcaA({ t, user }) {
  const [aberto, setAberto] = useState(false);
  if (!ehAntecipado(t)) return null;
  return (
    <>
      <span role="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (user) setAberto(true); }}
        title={`Antecipado (${FORMAS_ANT[t.antecipadoForma] || "Bradesco"}) — clique para ver o contrato`}
        className="inline-flex items-center justify-center mr-1 rounded-full text-[10px] font-extrabold align-middle shrink-0 cursor-pointer"
        style={{ width: 17, height: 17, background: C.amarelo, color: C.navy, border: `1px solid ${C.yellow}` }}>A</span>
      {aberto && <ContratoAntModal user={user} tituloId={t.id} onClose={() => setAberto(false)} />}
    </>
  );
}

function Modal({ titulo, onClose, children, largura = 760, rodape }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-2xl w-full flex flex-col" style={{ background: C.panel, maxWidth: largura, maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {rodape && <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${C.line}` }}>{rodape}</div>}
      </div>
    </div>
  );
}
const Etq = ({ s }) => <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: s.c, background: s.bg }}>{s.t}</span>;

async function abrirPdf(user, id) {
  const r = await fetch(`/api/fin/antecipacao?u=${user.id}&acao=pdf&id=${id}`);
  if (!r.ok) { alert("Contrato sem arquivo."); return; }
  const url = URL.createObjectURL(await r.blob());
  window.open(url, "_blank");
}

/* contrato que originou a antecipação */
export function ContratoAntModal({ user, tituloId, contratoId, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api(`/api/fin/antecipacao?u=${user.id}&acao=contrato&${tituloId ? `titulo=${tituloId}` : `id=${contratoId}`}`).then(setD).catch((e) => setErro(e.message));
  }, [tituloId, contratoId]);
  const c = d?.contrato;
  return (
    <Modal titulo={c ? `Contrato ${c.contrato}` : "Contrato da antecipação"} onClose={onClose}
      rodape={<>{c?.temArquivo && <button onClick={() => abrirPdf(user, c.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: "#fff" }}><Download size={14} /> Abrir contrato (PDF)</button>}
        <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Fechar</button></>}>
      {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>}
      {d && (
        <>
          {!c && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.yellowSoft, color: C.yellow }}><b>{FORMAS_ANT[d.forma] || d.forma}</b> · {d.semContrato}</div>}
          {c && (
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              {[["Forma", FORMAS_ANT[c.forma] || c.forma], ["Data", dBR(c.data)], ["Títulos", c.qtd], ["Valor dos títulos", moeda(c.valorOperacao)],
                ["Encargos", moeda(c.juros + c.iof + c.tac + c.tarifa)], ["Líquido recebido", moeda(c.valorLiquido)], ["Taxa", c.taxa || "—"], ["Lançado por", c.criadoPorNome || "—"]].map(([k, v]) => (
                <div key={k} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
                  <div className="text-[10px]" style={{ color: C.sub }}>{k}</div><div className="text-sm font-bold" style={{ color: C.navy }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {c && (c.juros + c.iof + c.tac + c.tarifa) > 0 && (
            <div className="text-xs mb-3" style={{ color: C.sub }}>Juros {moeda(c.juros)} · IOF {moeda(c.iof)} · TAC {moeda(c.tac)} · Tarifa {moeda(c.tarifa)}{c.forma === "BRADESCO" ? (c.lancamentoId ? " · crédito do extrato aberto na DRE ✓" : " · crédito do extrato ainda não encontrado") : ""}</div>
          )}
          <TabelaTitulos itens={d.titulos} />
        </>
      )}
    </Modal>
  );
}

function TabelaTitulos({ itens, sel, marcar, acoes }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
          {sel && <th className="pl-3 py-2 w-6" />}
          {["Vencimento", "Título", "Cliente", "Valor", "Forma pgto", "Antecipação", "Situação", ""].map((h, i) => <th key={i} className={`px-3 py-2 font-semibold ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>)}
        </tr></thead>
        <tbody>{itens.map((t) => {
          const s = sitAntecipado(t);
          return (
            <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}`, background: sel?.has(t.id) ? C.accentSoft : t.critica || s.k === "COBRADO" ? C.redSoft : undefined, boxShadow: t.critica || s.k === "COBRADO" ? `inset 3px 0 0 ${C.red}` : undefined }}>
              {sel && <td className="pl-3 py-2">{antPendente(t) && <input type="checkbox" checked={sel.has(t.id)} onChange={(e) => marcar([t.id], e.target.checked)} />}</td>}
              <td className="px-3 py-2 whitespace-nowrap font-semibold">{dBR(t.vencimento)}</td>
              <td className="px-3 py-2" style={{ maxWidth: 280 }} title={[t.titulo, t.critica && `CRÍTICA: ${t.critica}`, ...(t.notas || []).map((x) => `OBS: ${x.texto}`), t.recompra && `Conta a pagar: ${moeda(t.recompra.valor)} venc. ${dBR(t.recompra.vencimento)} (${t.recompra.status})`, t.numeroDoc, t.observacao].filter(Boolean).join("\n")}>
                <div className="font-semibold truncate" style={{ color: C.navy, maxWidth: 270 }}>{t.titulo}</div>
                {t.critica ? <div className="font-semibold flex items-center gap-1 truncate" style={{ color: C.red, maxWidth: 270 }}><AlertTriangle size={11} className="shrink-0" /><span className="truncate">{t.critica}</span></div>
                  : (t.notas || []).length ? <div className="truncate" style={{ color: C.yellow, maxWidth: 270 }}><b className="text-[9px]">OBS</b> {t.notas[t.notas.length - 1].texto}{t.notas.length > 1 ? ` (+${t.notas.length - 1})` : ""}</div>
                  : t.recompra ? <div className="truncate" style={{ color: t.recompra.status === "PAGO" ? C.roxo : C.red, maxWidth: 270 }}>Conta a pagar: {moeda(t.recompra.valor)} · venc. {dBR(t.recompra.vencimento)}</div>
                  : (t.numeroDoc || t.observacao) ? <div className="truncate" style={{ color: C.sub, maxWidth: 270 }}>{[t.numeroDoc, t.observacao].filter(Boolean).join(" · ")}</div> : null}
              </td>
              <td className="px-3 py-2" style={{ maxWidth: 200 }} title={t.parceiro}><div className="truncate" style={{ maxWidth: 190 }}>{t.parceiro}</div></td>
              <td className="px-3 py-2 text-right font-bold whitespace-nowrap">{brl(t.valor)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{t.formaPagamento === "DESCONTO" ? "Boleto" : t.formaPagamento || "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="font-semibold" style={{ color: C.yellow }}>{FORMAS_ANT[t.antecipadoForma] || "Bradesco"}</div>
                <div style={{ color: C.sub }}>{dBR(t.antecipadoEm || t.dataPagamento)}</div>
              </td>
              <td className="px-3 py-2"><Etq s={s} /></td>
              <td className="px-3 py-2 whitespace-nowrap">{acoes && acoes(t)}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/* registrar antecipação (factoring Azul Capital, portal próprio, Bradesco sem PDF) */
function ManualModal({ user, onClose, onOk }) {
  const [forma, setForma] = useState("AZUL_CAPITAL");
  const [data, setData] = useState(hojeISO());
  const [contrato, setContrato] = useState("");
  const [liquido, setLiquido] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [abertos, setAbertos] = useState(null);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    // todos os títulos a receber em aberto (de 2 anos atrás a 2 anos à frente)
    api(`/api/fin/titulos?u=${user.id}&tipo=RECEBER&dIni=${somaDias(hojeISO(), -730)}&dFim=${somaDias(hojeISO(), 730)}`)
      .then((j) => setAbertos([...(j.periodo || []), ...(j.atrasados || [])].filter((t, i, a) => t.status === "ABERTO" && a.findIndex((x) => x.id === t.id) === i)))
      .catch((e) => setErro(e.message));
  }, []);
  const vis = useMemo(() => {
    const n = busca.trim().toUpperCase();
    return (abertos || []).filter((t) => !n || [t.titulo, t.parceiro, t.numeroDoc, brl(t.valor)].some((x) => String(x || "").toUpperCase().includes(n))).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [abertos, busca]);
  const escolhidos = (abertos || []).filter((t) => sel.has(t.id));
  const total = escolhidos.reduce((s, t) => s + t.valor, 0);
  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const arq = arquivo ? { nome: arquivo.name, mime: arquivo.type || "application/pdf", conteudo: await readB64(arquivo) } : null;
      const r = await api("/api/fin/antecipacao", "POST", { usuarioId: user.id, acao: "manual", forma, data, contrato, liquido: lerNum(liquido), ids: [...sel], arquivo: arq });
      onOk(`Antecipação ${r.contrato} registrada: ${r.titulos} título(s), ${moeda(r.valor)} (líquido ${moeda(r.liquido)}).`);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo="Registrar antecipação" onClose={onClose} largura={860}
      rodape={<><button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando || !sel.size} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.accent, color: "#fff" }}>
          {salvando && <Loader2 size={14} className="animate-spin" />} Antecipar {sel.size} título(s) · {moeda(total)}</button></>}>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Contratos do Bradesco em PDF entram pela Transmissão de arquivos. Aqui: factoring, portal próprio ou Bradesco sem o PDF. Os títulos ficam recebidos na data da antecipação e aguardam o pagamento do cliente.</div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <label className="text-xs" style={{ color: C.sub }}>Forma de antecipação
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="block w-full rounded-lg px-2 py-2 text-sm outline-none" style={inpS}>
            {Object.entries(FORMAS_ANT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="text-xs" style={{ color: C.sub }}>Data da antecipação
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="block w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Nº do contrato (opcional)
          <input value={contrato} onChange={(e) => setContrato(e.target.value.toUpperCase())} className="block w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Líquido recebido (opcional)
          <input value={liquido} onChange={(e) => setLiquido(e.target.value)} placeholder={brl(total)} className="block w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Contrato / borderô (PDF, opcional)
          <input type="file" accept=".pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="block w-full text-xs mt-1" /></label>
      </div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, cliente, NF ou valor…" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inpS} />
      </div>
      {erro && <div className="mb-2 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!abertos ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando títulos em aberto…</div> : (
        <div className="rounded-lg overflow-y-auto" style={{ border: `1px solid ${C.line}`, maxHeight: 340 }}>
          <table className="w-full text-xs"><tbody>{vis.map((t) => (
            <tr key={t.id} onClick={() => setSel((x) => { const n = new Set(x); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} className="cursor-pointer hover:bg-gray-50"
              style={{ borderBottom: `1px solid ${C.line}`, background: sel.has(t.id) ? C.accentSoft : undefined }}>
              <td className="pl-3 py-2 w-6"><input type="checkbox" readOnly checked={sel.has(t.id)} /></td>
              <td className="px-2 py-2 whitespace-nowrap">{dBR(t.vencimento)}</td>
              <td className="px-2 py-2 font-semibold" style={{ color: C.navy }}>{t.titulo}</td>
              <td className="px-2 py-2">{t.parceiro}</td>
              <td className="px-3 py-2 text-right font-bold">{brl(t.valor)}</td>
            </tr>
          ))}</tbody></table>
          {!vis.length && <div className="px-4 py-6 text-center text-sm" style={{ color: C.sub }}>Nenhum título em aberto.</div>}
        </div>
      )}
    </Modal>
  );
}

function LiquidarModal({ itens, onClose, onOk }) {
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  return (
    <Modal titulo="Confirmar pagamento do cliente" onClose={onClose} largura={460}
      rodape={<><button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Cancelar</button>
        <button disabled={salvando} onClick={async () => { setSalvando(true); await onOk(data); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>
          {salvando && <Loader2 size={14} className="animate-spin" />} Baixar</button></>}>
      <div className="text-sm mb-3"><b>{itens.length} título(s) antecipado(s)</b> · {moeda(itens.reduce((s, t) => s + t.valor, 0))}. O cliente pagou o banco/factoring — a antecipação fica liquidada e não vira conta a pagar.</div>
      <label className="text-xs" style={{ color: C.sub }}>Data do pagamento do cliente
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
    </Modal>
  );
}

/* ---------------- guia Antecipações ---------------- */
export default function Antecipacoes({ user }) {
  const h = hojeISO(), m1 = `${h.slice(0, 7)}-01`;
  const [dIni, setDIni] = useState(m1);
  const [dFim, setDFim] = useState(fimDoMes(h));
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [visao, setVisao] = useState("TITULO");
  const [busca, setBusca] = useState("");
  const [fForma, setFForma] = useState("");
  const [fSit, setFSit] = useState("");
  const [abertoC, setAbertoC] = useState(null);
  const [modal, setModal] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const carregar = () => api(`/api/fin/antecipacao?u=${user.id}&acao=titulos&dIni=${dIni}&dFim=${dFim < dIni ? dIni : dFim}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [dIni, dFim]);
  const ok = (t) => { setAviso(t); setTimeout(() => setAviso(""), 4000); setModal(null); setSel(new Set()); carregar(); };

  const lista = useMemo(() => {
    const n = busca.trim().toUpperCase();
    return (d?.titulos || []).filter((t) => (!fForma || t.antecipadoForma === fForma)
      && (!fSit || (fSit === "PEND" ? ["A_VENCER", "VENCIDO"].includes(t.sitAnt) : t.sitAnt === fSit))
      && (!n || [t.titulo, t.parceiro, t.numeroDoc, brl(t.valor), t.critica].some((x) => String(x || "").toUpperCase().includes(n))));
  }, [d, busca, fForma, fSit]);
  const tot = useMemo(() => {
    const s = (f) => (d?.titulos || []).filter(f).reduce((a, t) => a + t.valor, 0);
    return { pend: s((t) => ["A_VENCER", "VENCIDO"].includes(t.sitAnt)), liq: s((t) => ["LIQUIDADO", "RECOMPRADO"].includes(t.sitAnt)), cobr: s((t) => t.sitAnt === "COBRADO") };
  }, [d]);
  const contratos = useMemo(() => {
    const g = new Map();
    for (const t of lista) {
      const k = t.antecipacaoId || `SEM|${t.antecipadoForma}|${t.antecipadoEm || t.dataPagamento}`;
      if (!g.has(k)) g.set(k, { k, c: (d?.contratos || []).find((c) => c.id === t.antecipacaoId) || null, forma: t.antecipadoForma, data: t.antecipadoEm || t.dataPagamento, itens: [] });
      g.get(k).itens.push(t);
    }
    return [...g.values()].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [lista, d]);
  const marcados = lista.filter((t) => sel.has(t.id) && antPendente(t));
  const marcar = (ids, on) => setSel((x) => { const n = new Set(x); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const liquidar = async (ids, data) => {
    try { const r = await api("/api/fin/antecipacao", "POST", { usuarioId: user.id, acao: "liquidar", ids, data }); ok(`${r.liquidados} título(s) antecipado(s) baixado(s) — cliente pagou.`); }
    catch (e) { setErro(e.message); setModal(null); }
  };
  const desfazer = async (t) => {
    const liq = !!t.liquidadoEm;
    if (!confirm(liq ? `Desfazer a baixa (pagamento do cliente) de "${t.titulo}"?` : `Desfazer a ANTECIPAÇÃO de "${t.titulo}"? Ele volta a ser conta a receber em aberto.`)) return;
    try { await api("/api/fin/antecipacao", "POST", { usuarioId: user.id, acao: liq ? "desliquidar" : "desfazer", id: t.id }); ok(liq ? "Baixa desfeita." : "Antecipação desfeita."); }
    catch (e) { setErro(e.message); }
  };
  const acoes = (t) => (
    <>
      {antPendente(t) && !t.recompraId && <button onClick={() => setModal({ t: "liq", itens: [t] })} title="Cliente pagou — baixar" className="mr-2" style={{ color: C.green }}><CheckCircle2 size={15} /></button>}
      {antPendente(t) && t.recompraId && <button onClick={() => setModal({ t: "liq", itens: [t] })} title="Cliente pagou depois — baixar (cancela a conta a pagar em aberto)" className="mr-2" style={{ color: C.green }}><CheckCircle2 size={15} /></button>}
      <BotaoRecompra t={t} user={user} onFeito={ok} />
      <BotaoObs t={t} user={user} onFeito={carregar} />
      {t.liquidacao !== "RECOMPRA" && <button onClick={() => desfazer(t)} title={t.liquidadoEm ? "Desfazer a baixa" : "Desfazer a antecipação"} className="mr-2" style={{ color: C.sub }}><Undo2 size={15} /></button>}
      {t.antecipacaoId && <button onClick={() => setModal({ t: "contrato", id: t.antecipacaoId })} title="Ver contrato" style={{ color: C.yellow }}><FileText size={14} /></button>}
    </>
  );
  const atalhos = [["Mês até hoje", m1, h], ["Mês", m1, fimDoMes(h)], ["Próximos 30 dias", h, somaDias(h, 30)], ["12 meses", somaDias(h, -365), somaDias(h, 365)]];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="text-xs" style={{ color: C.sub }}>Vencimento de
          <input type="date" value={dIni} onChange={(e) => e.target.value && setDIni(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Até
          <input type="date" value={dFim} min={dIni} onChange={(e) => e.target.value && setDFim(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <div className="flex gap-1 pb-0.5">
          {atalhos.map(([t, a, b]) => (
            <button key={t} onClick={() => { setDIni(a); setDFim(b); }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={dIni === a && dFim === b ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}55` } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
          ))}
        </div>
        <div className="flex-1" />
        {d && <BotaoExcel onClick={() => exportarExcel(user, lista.map((t) => t.id), `CONTAS A RECEBER › ANTECIPAÇÕES · VENCIMENTO ${dBR(dIni)} A ${dBR(dFim)}${fForma ? ` · ${FORMAS_ANT[fForma]}` : ""}${fSit ? ` · ${fSit}` : ""}${busca ? ` · BUSCA "${busca}"` : ""}`, `antecipacoes_${dIni}_a_${dFim}.xlsx`)} />}
        <button onClick={() => setModal({ t: "manual" })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Registrar antecipação</button>
      </div>
      {aviso && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {!d ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <div className="rounded-xl px-4 py-3" style={{ background: C.yellowSoft, border: `1px solid ${C.amarelo}88` }}>
              <div className="text-xs flex items-center gap-1" style={{ color: C.yellow }}><Percent size={12} /> Do contas a receber antecipado</div>
              <div className="text-2xl font-extrabold" style={{ color: C.navy }}>{brl(d.pct)}%</div>
              <div className="text-[10px]" style={{ color: C.sub }}>{moeda(d.antecipado)} de {moeda(d.totalReceber)} (por valor, vencimento no período)</div>
            </div>
            {[["Antecipado no período", d.antecipado, C.navy, ""], ["Aguardando o cliente", tot.pend, C.yellow, "PEND"], ["Liquidado", tot.liq, C.green, "LIQUIDADO"], ["Cobrado pelo banco", tot.cobr, C.red, "COBRADO"]].map(([t, v, c, f]) => (
              <button key={t} onClick={() => setFSit(fSit === f ? "" : f)} className="rounded-xl px-4 py-3 text-left hover:shadow-sm"
                style={{ background: C.panel, border: `1px solid ${fSit === f && f ? c : t === "Cobrado pelo banco" && v > 0 ? C.red + "55" : C.line}` }}>
                <div className="text-xs flex items-center gap-1" style={{ color: C.sub }}>{t}<Search size={11} style={{ color: C.accent }} /></div>
                <div className="text-lg font-bold" style={{ color: c }}>{moeda(v)}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              {[["TITULO", "Por título"], ["CONTRATO", "Por contrato"]].map(([k, t]) => (
                <button key={k} onClick={() => setVisao(k)} className="px-3 py-1.5 text-xs font-semibold" style={visao === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub }}>{t}</button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, cliente, NF ou valor…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 230 }} />
            </div>
            <select value={fForma} onChange={(e) => setFForma(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={inpS}>
              <option value="">Todas as formas</option>{Object.entries(FORMAS_ANT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={fSit} onChange={(e) => setFSit(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={inpS}>
              <option value="">Todas as situações</option><option value="PEND">Aguardando o cliente</option><option value="VENCIDO">Venceu — dentro dos 3 dias úteis</option>
              <option value="COBRADO">Cobrado pelo banco</option><option value="LIQUIDADO">Liquidado pelo cliente</option><option value="RECOMPRADO">Recomprado (conta a pagar paga)</option>
            </select>
          </div>

          {marcados.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl text-sm" style={{ background: C.navy, color: "#fff" }}>
              <b>{marcados.length} selecionado(s)</b><span style={{ opacity: 0.8 }}>· {moeda(marcados.reduce((a, t) => a + t.valor, 0))}</span>
              <div className="flex-1" />
              <button onClick={() => setModal({ t: "liq", itens: marcados })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}><CheckCircle2 size={14} /> Cliente pagou — baixar</button>
              <button onClick={() => setSel(new Set())} className="px-2 py-1.5 text-xs underline" style={{ color: "#fff" }}>limpar</button>
            </div>
          )}

          <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: C.panel2 }}>
              <div className="font-bold text-sm" style={{ color: C.navy }}>{visao === "TITULO" ? `${lista.length} título(s) antecipado(s)` : `${contratos.length} contrato(s)`} · {dBR(dIni)} a {dBR(dFim)}</div>
              <div className="text-sm font-bold" style={{ color: C.navy }}>{moeda(lista.reduce((a, t) => a + t.valor, 0))}</div>
            </div>
            {!lista.length ? <div className="px-4 py-8 text-sm text-center" style={{ color: C.sub }}>Nenhum título antecipado com vencimento neste período.</div>
              : visao === "TITULO" ? <TabelaTitulos itens={lista} sel={sel} marcar={marcar} acoes={acoes} />
              : (
                <table className="w-full text-xs">
                  <thead><tr style={{ color: C.sub, borderBottom: `1px solid ${C.line}` }}>
                    {["", "Contrato", "Forma", "Data", "Títulos", "Valor dos títulos", "Encargos", "Líquido", "Situação", ""].map((x, i) => <th key={i} className={`px-3 py-2 font-semibold ${/Valor|Encargos|Líquido/.test(x) ? "text-right" : "text-left"}`}>{x}</th>)}
                  </tr></thead>
                  <tbody>{contratos.map((g) => {
                    const ab = abertoC === g.k, c = g.c;
                    const val = g.itens.reduce((a, t) => a + t.valor, 0);
                    const nPend = g.itens.filter((t) => ["A_VENCER", "VENCIDO"].includes(t.sitAnt)).length, nCob = g.itens.filter((t) => t.sitAnt === "COBRADO").length;
                    const nCrit = g.itens.filter((t) => t.critica).length;
                    return (
                      <React.Fragment key={g.k}>
                        <tr onClick={() => setAbertoC(ab ? null : g.k)} className="cursor-pointer hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}`, background: nCob ? C.redSoft : undefined }}>
                          <td className="pl-3 py-2 w-6" style={{ color: C.sub }}>{ab ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                          <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{c?.contrato || "Sem contrato vinculado"}{nCrit > 0 && <span className="ml-1 font-semibold" style={{ color: C.red }}>· {nCrit} crítica(s)</span>}</td>
                          <td className="px-3 py-2 font-semibold" style={{ color: C.yellow }}>{FORMAS_ANT[g.forma] || g.forma}</td>
                          <td className="px-3 py-2">{dBR(c?.data || g.data)}</td>
                          <td className="px-3 py-2">{g.itens.length}{c && c.qtd !== g.itens.length ? <span style={{ color: C.sub }}> de {c.qtd}</span> : ""}</td>
                          <td className="px-3 py-2 text-right font-bold">{brl(c ? c.valorOperacao : val)}</td>
                          <td className="px-3 py-2 text-right">{c ? brl(c.juros + c.iof + c.tac + c.tarifa) : "—"}</td>
                          <td className="px-3 py-2 text-right">{c ? brl(c.valorLiquido) : "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {nCob > 0 && <span className="mr-1"><Etq s={{ t: `${nCob} cobrado(s)`, c: C.red, bg: C.redSoft }} /></span>}
                            {nPend > 0 ? <Etq s={{ t: `${nPend} aguardando`, c: C.yellow, bg: C.yellowSoft }} /> : !nCob && <Etq s={{ t: "Todos liquidados", c: C.green, bg: C.greenSoft }} />}
                          </td>
                          <td className="px-3 py-2">{c && <button onClick={(e) => { e.stopPropagation(); setModal({ t: "contrato", id: c.id }); }} title="Ver contrato" style={{ color: C.yellow }}><FileText size={14} /></button>}</td>
                        </tr>
                        {ab && <tr><td colSpan={10} className="px-3 py-2" style={{ background: C.bg }}><TabelaTitulos itens={g.itens} sel={sel} marcar={marcar} acoes={acoes} /></td></tr>}
                      </React.Fragment>
                    );
                  })}</tbody>
                </table>
              )}
          </div>
          <div className="text-[11px]" style={{ color: C.sub }}>
            Título antecipado não baixado até 3 dias úteis depois do vencimento vira conta a pagar em vermelho (quem antecipou cobra da Meridian). Baixar essa conta a pagar baixa também o título original.
          </div>
        </>
      )}
      {modal?.t === "manual" && <ManualModal user={user} onClose={() => setModal(null)} onOk={ok} />}
      {modal?.t === "liq" && <LiquidarModal itens={modal.itens} onClose={() => setModal(null)} onOk={(dt) => liquidar(modal.itens.map((t) => t.id), dt)} />}
      {modal?.t === "contrato" && <ContratoAntModal user={user} contratoId={modal.id} onClose={() => setModal(null)} />}
    </div>
  );
}
