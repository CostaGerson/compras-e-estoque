"use client";
// v1086 — Compras › Devoluções: créditos por fornecedor (usar em boletos ou em novas compras), itens em devolução → OD, ordens de devolução
import React, { useEffect, useState } from "react";
import { Loader2, Undo2, Wallet, FileText, X, CheckCircle2, RefreshCw, Printer } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", yellow: "#C08401", yellowSoft: "#FFF6DD", blue: "#2E7CD6" };
const brl = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: String(s).length === 10 ? "UTC" : undefined }) : "");
const qtd = (v, u) => `${(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${String(u || "").toLowerCase()}`;
const lerNum = (v) => { const s = String(v ?? "").trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const nomeUser = (u) => `${u?.nome || ""} ${u?.sobrenome || ""}`.trim();
const post = async (body) => { const r = await fetch("/api/compras/devolucoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error || "Erro."); return x; };

function imprimirOd(o) {
  const linhas = o.itens.map((i) => `<tr><td>${i.ocNumero}</td><td>${i.nome}</td><td class="n">${qtd(i.quantidade, i.unidade)}</td><td class="n">${brl(i.valorUnitario)}</td><td class="n">${brl(i.total)}</td><td>${i.nfNumero || "—"}</td><td>${i.nfDevolucao || "—"}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${o.numero} · ${o.fornecedor}</title><style>body{font-family:Arial,sans-serif;color:#0c2342;margin:32px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border-bottom:1px solid #dde3ea;padding:6px;text-align:left}th{background:#f1f6fe}.n{text-align:right}</style></head><body>
    <img src="/meridian-wordmark.svg" style="height:26px"><div style="color:#667085;font-size:12px;margin-top:6px">Ordem de devolução</div><h1 style="margin:0;font-size:20px">${o.numero}</h1>
    <p style="font-size:13px"><b>${o.fornecedor}</b> · emitida em ${dBR(o.createdAt)}${o.criadoPorNome ? ` por ${o.criadoPorNome}` : ""}</p>
    <table><tr><th>OC</th><th>Item</th><th class="n">Qtd.</th><th class="n">Valor unit.</th><th class="n">Total</th><th>NF de origem</th><th>NF de devolução</th></tr>${linhas}
    <tr><td colspan="4" class="n"><b>Crédito com o fornecedor</b></td><td class="n"><b>${brl(o.total)}</b></td><td colspan="2"></td></tr></table>
    ${o.obs ? `<p style="font-size:12px">Obs.: ${o.obs}</p>` : ""}<p style="font-size:12px;margin-top:16px">Motivos: ${[...new Set(o.itens.map((i) => i.motivo))].join(" · ")}</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
  const w = window.open("", "_blank"); if (!w) return alerta("Permita pop-ups para imprimir a OD."); w.document.write(html); w.document.close();
}

export default function Devolucoes({ user }) {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [cred, setCred] = useState(null);   // fornecedor com crédito aberto
  const [oc, setOc] = useState(false);
  const carregar = () => fetch("/api/compras/devolucoes", { cache: "no-store" }).then((r) => r.json()).then((x) => { setD(x); setSel(new Set()); }).catch(() => setD({ pendentes: [], emOd: [], ods: [], creditos: [] }));
  useEffect(() => { carregar(); }, []);
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  const marcados = d.pendentes.filter((x) => sel.has(x.id));
  const fSel = marcados[0]?.fornecedorId || null;
  const totSel = marcados.reduce((s, x) => s + x.total, 0);
  const gerarOd = async () => {
    if (!(await confirmar(`Gerar a OD de ${marcados.length} item(ns) de ${marcados[0].fornecedor}?\nO crédito de ${brl(totSel)} fica disponível com o fornecedor.`))) return;
    setOc(true);
    try { const r = await post({ acao: "od", ids: [...sel], quem: nomeUser(user) }); await alerta(`${r.numero} gerada. Crédito com o fornecedor: ${brl(r.saldo)}.`); carregar(); } catch (e) { alerta(e.message); }
    setOc(false);
  };
  const cancelar = async (x) => {
    if (!(await confirmar(`Cancelar a devolução de ${x.nome} (${x.ocNumero})? O item que voltou ao PIC sai de lá, se ainda não virou OC.${x.admDemandaId ? "\nA demanda da NF de devolução no ADM continua: avise a equipe." : ""}`))) return;
    try { await post({ acao: "cancelar", id: x.id, quem: nomeUser(user) }); carregar(); } catch (e) { alerta(e.message); }
  };
  const situNf = (x) => (!x.fiscalNotaId ? <span style={{ color: C.sub }}>sem NF (não emite)</span> : x.nfDevolucao ? <span style={{ color: C.green }}>emitida: {x.nfDevolucao}</span>
    : <span style={{ color: x.demandaStatus === "CONCLUIDA" ? C.green : C.yellow }}>{x.demandaStatus === "FAZENDO" ? "ADM emitindo" : x.demandaStatus === "CONCLUIDA" ? "emitida" : "ADM a emitir"}</span>);
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3"><div className="text-lg font-bold flex-1" style={{ color: C.navy }}>Devoluções</div>
        <button onClick={carregar} title="Atualizar" className="p-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button></div>

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.sub }}>Crédito com fornecedores</div>
      {!d.creditos.length ? <div className="text-sm mb-5 px-4 py-3 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>Nenhum fornecedor com crédito. O crédito nasce ao gerar uma OD.</div> : (
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {d.creditos.map((c) => (
            <button key={c.fornecedorId} onClick={() => setCred(c)} className="text-left rounded-xl p-4 hover:shadow-md" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.green}` }}>
              <div className="flex items-center gap-2"><Wallet size={16} style={{ color: C.green }} /><span className="font-bold truncate" style={{ color: C.navy }}>{c.fornecedor}</span></div>
              <div className="text-xl font-bold mt-1" style={{ color: C.green }}>{brl(c.saldo)}</div>
              <div className="text-xs" style={{ color: C.sub }}>clique para usar em boletos ou guardar para novas compras</div>
            </button>
          ))}
        </div>
      )}

      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.sub }}>Itens em devolução (sem OD) · {d.pendentes.length}</div>
      {!d.pendentes.length ? <div className="text-sm mb-5 px-4 py-3 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>Nenhum item em devolução. Devolva pela OC (botão Devolver itens).</div> : (
        <div className="rounded-xl overflow-auto mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead><tr className="text-xs text-left" style={{ background: C.panel2, color: C.sub }}><th className="px-3 py-2" /><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">OC</th><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qtd.</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">NF de devolução</th><th className="px-3 py-2" /></tr></thead>
            <tbody>{d.pendentes.map((x) => { const bloq = fSel && x.fornecedorId !== fSel; return (
              <tr key={x.id} style={{ borderTop: `1px solid ${C.line}`, opacity: bloq ? 0.45 : 1 }}>
                <td className="px-3 py-2"><input type="checkbox" disabled={bloq} checked={sel.has(x.id)} title={bloq ? "A OD é de um fornecedor só" : ""} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(x.id) : n.delete(x.id); return n; })} /></td>
                <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{x.fornecedor}</td><td className="px-3 py-2">{x.ocNumero}{x.nfNumero ? <div className="text-xs" style={{ color: C.sub }}>NF {x.nfNumero}</div> : null}</td>
                <td className="px-3 py-2">{x.nome}<div className="text-xs" style={{ color: C.sub }}>{dBR(x.createdAt)}{x.picItemId ? " · voltou ao PIC" : ""}</div></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{qtd(x.quantidade, x.unidade)}</td><td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{brl(x.total)}</td>
                <td className="px-3 py-2 text-xs" style={{ color: C.text }}>{x.motivo}</td><td className="px-3 py-2 text-xs">{situNf(x)}</td>
                <td className="px-3 py-2"><button onClick={() => cancelar(x)} title="Cancelar a devolução"><X size={14} style={{ color: C.red }} /></button></td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
      {marcados.length > 0 && <div className="flex items-center gap-3 sticky bottom-0 py-3 px-3 rounded-lg mb-5" style={{ background: "#F7F8FA", border: `1px solid ${C.line}` }}>
        <span className="text-sm flex-1" style={{ color: C.text }}><b>{marcados.length}</b> item(ns) de <b>{marcados[0].fornecedor}</b> · crédito <b style={{ color: C.green }}>{brl(totSel)}</b></span>
        <button onClick={() => setSel(new Set())} className="text-xs" style={{ color: C.sub }}>limpar</button>
        <button disabled={oc} onClick={gerarOd} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Gerar OD</button>
      </div>}

      <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-3" style={{ color: C.sub }}>Ordens de devolução · {d.ods.length}</div>
      {!d.ods.length ? <div className="text-sm px-4 py-3 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>Nenhuma OD ainda.</div> : (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          {d.ods.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="font-bold" style={{ color: C.navy }}>{o.numero}</span><span className="flex-1">{o.fornecedor} · {o.itens.length} item(ns) · {dBR(o.createdAt)}</span>
              <span className="font-semibold" style={{ color: C.green }}>{brl(o.total)}</span>
              <button onClick={() => imprimirOd(o)} className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1" style={{ border: `1px solid ${C.line}` }}><Printer size={12} /> Imprimir</button>
            </div>
          ))}
        </div>
      )}
      {cred && <UsarCredito c={cred} user={user} onClose={() => setCred(null)} onOk={() => { setCred(null); carregar(); }} />}
    </div>
  );
}

function UsarCredito({ c, user, onClose, onOk }) {
  const [b, setB] = useState(null);
  const [v, setV] = useState({});
  const [oc, setOc] = useState(false);
  useEffect(() => { fetch(`/api/compras/devolucoes?boletos=${c.fornecedorId}`, { cache: "no-store" }).then((r) => r.json()).then((x) => { setB(x); setV(Object.fromEntries((x.titulos || []).filter((t) => t.sugestao > 0).map((t) => [t.id, String(t.sugestao.toFixed(2)).replace(".", ",")]))); }).catch(() => setB({ titulos: [] })); }, []);
  const soma = Object.values(v).reduce((s, x) => s + lerNum(x), 0);
  const usar = async () => {
    setOc(true);
    try { const r = await post({ acao: "boletos", fornecedorId: c.fornecedorId, quem: nomeUser(user), itens: Object.entries(v).map(([id, x]) => ({ id: Number(id), valor: lerNum(x) })).filter((x) => x.valor > 0) });
      await alerta(`${r.usados.length} boleto(s) abatido(s). Crédito restante: ${brl(r.saldo)}.`); onOk(); } catch (e) { alerta(e.message); }
    setOc(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,24,40,.45)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl" style={{ background: C.panel, maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 font-bold flex items-center gap-2" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}><Wallet size={16} style={{ color: C.green }} /> Crédito com {c.fornecedor} · {brl(c.saldo)}</div>
        <div className="px-5 py-4">
          <div className="text-xs mb-3" style={{ color: C.sub }}>Sugestão: o crédito abate os boletos em aberto do fornecedor, do vencimento mais próximo. Boleto coberto inteiro fica pago (sem movimento no banco); parcial tem o valor reduzido.</div>
          {!b ? <Loader2 size={15} className="animate-spin" /> : !b.titulos.length ? <div className="text-sm" style={{ color: C.sub }}>Nenhum boleto em aberto deste fornecedor. Guarde o crédito para a próxima compra: ao gerar uma OC para ele, o sistema pergunta se quer usar.</div> : b.titulos.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1">{t.titulo}<div className="text-xs" style={{ color: C.sub }}>vence {dBR(t.vencimento)}{t.numeroDoc ? ` · ${t.numeroDoc}` : ""} · {brl(t.valor)}</div></div>
              <input value={v[t.id] || ""} onChange={(e) => setV((m) => ({ ...m, [t.id]: e.target.value }))} placeholder="0,00" className="w-28 px-2 py-1 rounded text-sm text-right" style={{ border: `1px solid ${C.line}` }} />
            </div>
          ))}
          {soma > c.saldo + 0.004 && <div className="text-xs mt-2" style={{ color: C.red }}>Passou do crédito disponível.</div>}
          {(c.movimentos || []).length > 0 && <div className="mt-4 text-xs" style={{ color: C.sub }}><div className="font-bold mb-1">Extrato do crédito</div>{c.movimentos.map((m) => <div key={m.id}>{dBR(m.createdAt)} · {m.tipo === "CREDITO" ? "+" : "−"}{brl(m.valor)} · {m.descricao}{m.reserva ? " (reservado)" : ""}</div>)}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="text-sm mr-auto">Usar <b>{brl(soma)}</b></span>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ border: `1px solid ${C.line}` }}>Guardar para novas compras</button>
          <button disabled={oc || !soma || soma > c.saldo + 0.004} onClick={usar} className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-1.5" style={{ background: C.green, color: "#fff", opacity: oc || !soma || soma > c.saldo + 0.004 ? 0.5 : 1 }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Usar nos boletos</button>
        </div>
      </div>
    </div>
  );
}
