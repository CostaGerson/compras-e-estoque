"use client";
// v555 — casamento NF de venda ↔ pedido em andamento: pela NF (movimento fiscal) ou pelo pedido (lista da Produção)
import React, { useEffect, useState } from "react";
import { X, Loader2, Link2 } from "lucide-react";
import { alerta } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", yellow: "#C08401" };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ");

function Janela({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-3xl flex flex-col overflow-hidden shadow-2xl" style={{ background: C.panel, maxHeight: "88vh" }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Link2 size={18} style={{ color: C.accent }} /><div className="font-bold flex-1" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} className="p-1"><X size={20} style={{ color: C.sub }} /></button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
async function casar(user, pedido, fiscalNotaId) {
  const r = await fetch("/api/producao/faturamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "casar", pedido, fiscalNotaId, quem: nomeU(user) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { await alerta(j.error || "Erro ao casar."); return null; }
  await alerta(`NF ${j.nf} casada com o pedido ${j.pedido}${j.completo ? " — pedido faturado" : " — faturamento parcial"}.${j.aviso ? ` ${j.aviso}` : ""}`);
  return j;
}
const Pecas = ({ x }) => <span>{x.pecas != null ? `${x.pecas} pç na NF` : "NF sem XML (peças não conferidas)"}</span>;

// pela NF (movimento fiscal): escolhe o pedido
export function CasarNotaModal({ user, fiscalNotaId, onClose, onFeito }) {
  const [d, setD] = useState(null);
  const [oc, setOc] = useState(false);
  useEffect(() => { fetch(`/api/producao/faturamento?nota=${fiscalNotaId}`).then((r) => r.json()).then(setD).catch(() => setD({ error: "Erro ao carregar." })); }, [fiscalNotaId]);
  const ir = async (p) => { setOc(true); const j = await casar(user, p.numero, fiscalNotaId); setOc(false); if (j) { onFeito?.(); onClose(); } };
  return (
    <Janela titulo={d?.nf ? `NF ${d.nf.numero} · ${d.nf.parceiro} · ${brl(d.nf.valor)}` : "Casar NF com pedido"} onClose={onClose}>
      {!d ? <Loader2 size={18} className="animate-spin" style={{ color: C.sub }} /> : d.error ? <div style={{ color: C.red }}>{d.error}</div> : d.casadaCom ? <div className="text-sm">Esta NF já está casada com o pedido <b>{d.casadaCom}</b>.</div> : (
        <>
          <div className="text-xs mb-3" style={{ color: C.sub }}>Emissão {dBR(d.nf.emissao)} · <Pecas x={d.nf} />. Escolha o pedido em andamento que esta NF atende. As peças precisam estar concluídas na expedição.</div>
          {!d.candidatos.length && <div className="text-sm" style={{ color: C.sub }}>Nenhum pedido em andamento do mesmo cliente (ou com a O.C. da NF).</div>}
          <div className="space-y-2">
            {d.candidatos.map((p) => (
              <div key={p.numero} className="rounded-lg p-3 flex items-center gap-3" style={{ border: `1px solid ${p.cabe ? C.line : C.red + "55"}`, background: p.cabe ? C.panel : C.redSoft }}>
                <div className="flex-1 min-w-0 text-sm">
                  <div><b style={{ color: C.navy }}>Pedido {p.numero}</b> · {p.cliente}{p.oc ? ` · OC ${p.oc}` : ""}</div>
                  <div className="text-xs" style={{ color: C.sub }}>saldo {brl(p.saldo)} de {brl(p.total)}{p.valorExato ? " · valor confere" : ""}{p.ocOk ? " · O.C. confere" : ""} · {p.emPcp ? `${p.concluidas} concluída(s) · ${p.faturadas} faturada(s) · ${p.livres} livre(s) para faturar` : "fora do PCP"}</div>
                  {!p.cabe && <div className="text-xs font-semibold" style={{ color: C.red }}>{p.motivo}</div>}
                </div>
                <button disabled={!p.cabe || oc} onClick={() => ir(p)} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: p.cabe ? C.accent : C.panel2, color: p.cabe ? "#fff" : C.sub }}>Casar</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Janela>
  );
}

// pelo pedido (Produção): escolhe a NF de venda do movimento fiscal
export function CasarPedidoModal({ user, pedido, onClose, onFeito }) {
  const [d, setD] = useState(null);
  const [oc, setOc] = useState(false);
  const carregar = () => fetch(`/api/producao/faturamento?pedido=${encodeURIComponent(pedido)}`).then((r) => r.json()).then(setD).catch(() => setD({ error: "Erro ao carregar." }));
  useEffect(() => { carregar(); }, [pedido]);
  const ir = async (n) => { setOc(true); const j = await casar(user, pedido, n.id); setOc(false); if (j) { onFeito?.(); onClose(); } };
  const P = d?.pedido;
  return (
    <Janela titulo={`Casar NF com o pedido ${pedido}${P ? ` · ${P.cliente}` : ""}`} onClose={onClose}>
      {!d ? <Loader2 size={18} className="animate-spin" style={{ color: C.sub }} /> : d.error ? <div style={{ color: C.red }}>{d.error}</div> : (
        <>
          <div className="grid gap-2 mb-3 text-xs" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            {[["Saldo a faturar", brl(P.saldo)], ["Peças do pedido", P.pecas || "?"], ["Concluídas na expedição", P.emPcp ? P.concluidas : "fora do PCP"], ["Já faturadas", P.faturadas], ["Livres para faturar", P.emPcp ? P.livres : "—"]].map(([l, v]) => (
              <div key={l} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}><div style={{ color: C.sub }}>{l}</div><div className="font-bold text-sm" style={{ color: C.navy }}>{v}</div></div>
            ))}
          </div>
          {!d.nfs.length && <div className="text-sm" style={{ color: C.sub }}>Nenhuma NF de venda do mesmo cliente no movimento fiscal sem pedido. Suba a NF em ADM › Movimento fiscal (ou "Incluir faturamento" no pedido).</div>}
          <div className="space-y-2">
            {d.nfs.map((n) => (
              <div key={n.id} className="rounded-lg p-3 flex items-center gap-3" style={{ border: `1px solid ${n.cabe || n.jaNestePedido ? C.line : C.red + "55"}`, background: n.jaNestePedido ? C.greenSoft : n.cabe ? C.panel : C.redSoft }}>
                <div className="flex-1 min-w-0 text-sm">
                  <div><b style={{ color: C.navy }}>NF {n.numero}</b> · {dBR(n.emissao)} · {n.parceiro} · <b>{brl(n.valor)}</b></div>
                  <div className="text-xs" style={{ color: C.sub }}><Pecas x={n} />{n.valorExato ? " · valor confere com o saldo" : ""}{n.ocOk ? " · O.C. confere" : ""} · {n.contas ? `${n.contas} conta(s) lançada(s)` : "sem contas lançadas"}</div>
                  {!n.cabe && !n.jaNestePedido && <div className="text-xs font-semibold" style={{ color: C.red }}>{n.motivo}</div>}
                </div>
                {n.jaNestePedido ? <span className="text-xs font-semibold" style={{ color: C.green }}>casada</span>
                  : <button disabled={!n.cabe || oc} onClick={() => ir(n)} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: n.cabe ? C.accent : C.panel2, color: n.cabe ? "#fff" : C.sub }}>Casar</button>}
              </div>
            ))}
          </div>
        </>
      )}
    </Janela>
  );
}

export async function descasar(user, pedido, numero) {
  const r = await fetch("/api/producao/faturamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "descasar", pedido, numero, quem: nomeU(user) }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { await alerta(j.error || "Erro."); return false; } return true;
}
