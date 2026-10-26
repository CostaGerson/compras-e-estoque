"use client";
// v501 — ADM › Facções a pagar (PCP): OS FECHADAS do Cronograma → conferência → lançamento nos terceirizados da semana
import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", yellow: "#C08401", yellowSoft: "#FFF6DD", blue: "#2E7CD6", blueSoft: "#EAF2FC" };
const brl = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const TIPOS = [["CAMISETA", "Camiseta"], ["POLO", "Polo"], ["MOLETOM", "Moletom"], ["JAQUETA", "Jaqueta"], ["CAMISA_SOCIAL", "Camisa social"], ["JALECO_OPERACIONAL", "Jaleco operacional"], ["CALCA_OPERACIONAL", "Calça operacional"], ["CALCA_JEANS", "Calça jeans"], ["CALCA_SOCIAL", "Calça social"]];

export default function FaccoesPcp({ user }) {
  const [d, setD] = useState(null);
  const [marc, setMarc] = useState(new Set());
  const [ajuste, setAjuste] = useState({});   // { os: { prestadorId, setor } }
  const [prest, setPrest] = useState([]);
  const [ver, setVer] = useState("abertas");
  const [oc, setOc] = useState(false);
  const carregar = () => { setD(null); fetch(`/api/fin/faccoes?u=${user.id}`).then((r) => r.json()).then((x) => { setD(x); setMarc(new Set((x.contas || []).filter((c) => !c.lancada && c.prestador).map((c) => c.os))); }).catch((e) => setD({ erro: e.message, contas: [] })); };
  useEffect(() => { carregar(); fetch(`/api/fin/faccoes?u=${user.id}&lista=1`).then((r) => r.json()).then((x) => setPrest(Array.isArray(x) ? x : [])).catch(() => {}); }, []);
  const contas = (d?.contas || []).filter((c) => (ver === "abertas" ? !c.lancada : ver === "lancadas" ? c.lancada : true));
  const pend = (d?.contas || []).filter((c) => !c.lancada);
  const tog = (os) => setMarc((s) => { const n = new Set(s); n.has(os) ? n.delete(os) : n.add(os); return n; });
  const tot = pend.filter((c) => marc.has(c.os)).reduce((s, c) => s + c.valorLiquido, 0);
  async function lancar() {
    const esc = pend.filter((c) => marc.has(c.os)).map((c) => ({ os: c.os, ...(ajuste[c.os] || {}) }));
    if (!esc.length) return;
    if (esc.some((e) => !e.prestadorId && !pend.find((c) => c.os === e.os).prestador)) return alerta("Escolha a facção do cadastro nas OS marcadas sem facção encontrada.");
    if (!(await confirmar(`Lançar ${esc.length} OS no contas a pagar (terceirizados da semana) · total ${brl(tot)}?`))) return;
    setOc(true);
    const r = await fetch("/api/fin/faccoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, escolhas: esc }) });
    const x = await r.json().catch(() => ({}));
    setOc(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    const ok = (x.resultados || []).filter((y) => y.ok), err = (x.resultados || []).filter((y) => !y.ok);
    await alerta(`${ok.length} OS lançada(s).${err.length ? `\n\nNão lançadas:\n${err.map((y) => `OS ${y.os}: ${y.erro}`).join("\n")}` : ""}`);
    carregar();
  }
  const baixarLista = () => {
    const linhas = [["id", "nome", "documento", "nome_no_km", "ativo", "servicos"], ...prest.map((p) => [p.id, p.nome, p.documento, p.nomeKm || "", p.ativo ? "SIM" : "NAO", p.servicos.join(" ")])];
    const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); a.download = "faccoes-meridian.csv"; a.click();
  };
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Facções a pagar · Cronograma PCP</div>
          <div className="text-xs" style={{ color: C.sub }}>OS <b>fechadas</b> no PCP (valor travado). Confira e lance: cada OS vira um item dos <b>terceirizados da semana</b> (sexta do vencimento), na conta de facção do tipo de peça. Valor = líquido. Uma OS nunca é lançada duas vezes.</div>
        </div>
        <button onClick={baixarLista} className="text-xs px-3 py-1.5 rounded-md flex items-center gap-1" style={{ border: `1px solid ${C.line}`, background: C.panel }} title="Exportação única para o Cronograma: nome, documento e id interno"><Download size={13} /> Lista de facções para o PCP</button>
        <button onClick={carregar} className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>
      <div className="flex gap-2 mb-3">
        {[["abertas", `A lançar (${pend.length})`], ["lancadas", "Lançadas"], ["todas", "Todas"]].map(([k, t]) => <button key={k} onClick={() => setVer(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: ver === k ? C.accent : C.panel, color: ver === k ? "#fff" : C.sub, border: `1px solid ${ver === k ? C.accent : C.line}` }}>{t}</button>)}
      </div>
      {!d && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Lendo o Cronograma…</div>}
      {d?.erro && <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}><AlertTriangle size={15} /> {d.erro}</div>}
      {d && !d.erro && !contas.length && <div className="text-sm py-8 text-center rounded-lg" style={{ color: C.sub, background: C.panel, border: `1px solid ${C.line}` }}>Nenhuma OS {ver === "abertas" ? "fechada a lançar" : "aqui"}.</div>}
      {contas.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" data-sem-ordenar>
            <thead><tr style={{ color: C.sub, background: C.panel2 }}>
              {["", "OS", "Facção (PCP → cadastro)", "Pedido / item", "Serviço · tipo de peça", "Qtd env./aprov.", "Bruto", "Descontos", "Líquido", "Vencimento", ""].map((h, k) => <th key={k} className="px-2 py-2 text-left font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {contas.map((c) => {
                const aj = ajuste[c.os] || {};
                const setA = (k, v) => setAjuste((m) => ({ ...m, [c.os]: { ...m[c.os], [k]: v } }));
                const semF = !c.prestador && !aj.prestadorId;
                return (
                  <tr key={c.os} style={{ borderTop: `1px solid ${C.line}`, background: c.lancada ? C.greenSoft : semF ? C.redSoft : undefined }}>
                    <td className="px-2 py-2">{!c.lancada && <input type="checkbox" checked={marc.has(c.os)} onChange={() => tog(c.os)} />}</td>
                    <td className="px-2 py-2 font-bold" style={{ color: C.navy }}>{c.os}{c.romaneio ? <div className="font-normal" style={{ color: C.sub }}>rom. {c.romaneio}</div> : null}</td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{c.faccao}</div>
                      {c.lancada ? <div style={{ color: C.green }}>{c.prestador?.nome}</div>
                        : <select value={aj.prestadorId || c.prestador?.id || ""} onChange={(e) => setA("prestadorId", e.target.value ? Number(e.target.value) : null)} className="mt-0.5 px-1 py-0.5 rounded text-xs max-w-[200px]" style={{ border: `1px solid ${semF ? C.red : C.line}` }}>
                            <option value="">— escolher no cadastro —</option>{prest.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
                      {c.prestador && !c.prestador.pix && <div style={{ color: C.yellow }}>sem PIX no cadastro</div>}
                    </td>
                    <td className="px-2 py-2"><div className="font-semibold">{c.pedido || "—"}{c.itemCode ? ` · ${c.itemCode}` : ""}</div><div className="truncate max-w-[220px]" style={{ color: C.sub }} title={c.produto}>{c.produto}{c.refProduto ? ` · ${c.refProduto}` : ""}</div></td>
                    <td className="px-2 py-2">{c.servico || "—"}<div>{c.grupo === "FACCAO" && !c.lancada
                      ? <select value={aj.setor || c.setor} onChange={(e) => setA("setor", e.target.value)} className="mt-0.5 px-1 py-0.5 rounded text-xs" style={{ border: `1px solid ${C.line}` }}>{TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                      : <span style={{ color: C.sub }}>{c.setor}</span>}</div></td>
                    <td className="px-2 py-2">{c.quantidadeEnviada ?? "—"} / {c.quantidadeAprovada ?? "—"}{c.quantidadePerdida ? <div style={{ color: C.red }}>perda {c.quantidadePerdida}</div> : null}{c.quantidadeSegunda ? <div style={{ color: C.yellow }}>2ª {c.quantidadeSegunda}</div> : null}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{brl(c.valorBruto)}<div style={{ color: C.sub }}>{brl(c.valorUnitario)}/pç</div></td>
                    <td className="px-2 py-2" style={{ color: C.red }}>{(c.descontos || []).map((x, k) => <div key={k} className="whitespace-nowrap">{x.motivo} {brl(x.valor)}</div>)}</td>
                    <td className="px-2 py-2 font-bold whitespace-nowrap" style={{ color: C.navy }}>{brl(c.valorLiquido)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{dBR(c.vencimento)}{c.sexta ? <div style={{ color: C.sub }}>sexta {dBR(c.sexta).slice(0, 5)}</div> : null}</td>
                    <td className="px-2 py-2">{c.lancada ? <span className="flex items-center gap-1 font-semibold" style={{ color: C.green }}><CheckCircle2 size={13} /> lançada{c.lancadaPor ? <span className="font-normal" style={{ color: C.sub }}> · {c.lancadaPor}</span> : ""}</span> : semF ? <span style={{ color: C.red }}>facção fora do cadastro</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pend.length > 0 && ver !== "lancadas" && (
        <div className="flex items-center gap-3 sticky bottom-0 py-3" style={{ background: "#F7F8FA" }}>
          <span className="text-sm" style={{ color: C.sub }}>{marc.size} OS marcada(s) · <b style={{ color: C.navy }}>{brl(tot)}</b></span>
          <button disabled={oc || !marc.size} onClick={lancar} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.accent, color: "#fff", opacity: marc.size ? 1 : 0.5 }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Lançar no contas a pagar</button>
        </div>
      )}
    </div>
  );
}
