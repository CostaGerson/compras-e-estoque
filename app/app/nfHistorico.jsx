"use client";
// v138 — Importação em lote do histórico de XMLs de compra: registra a NF e as contas a pagar, SEM estoque.
import React, { useState, useRef } from "react";
import { unzipSync, strFromU8 } from "fflate";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", blue: "#2E7CD6",
};
const LOTE = 25;
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SIT = { IMPORTADA: ["Importada", C.green, C.greenSoft], JA_EXISTIA: ["NF já existia", C.blue, "#EAF2FC"], RECUSADA: ["Recusada", C.yellow, C.yellowSoft], ERRO: ["Erro", C.red, C.redSoft] };

// arquivos soltos (.xml) ou compactados (.zip) → [{ nome, xml }]
async function lerArquivos(files) {
  const out = [];
  for (const f of [...files]) {
    if (/\.zip$/i.test(f.name)) {
      const ent = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [nome, u8] of Object.entries(ent)) if (/\.xml$/i.test(nome)) out.push({ nome: nome.split("/").pop(), xml: strFromU8(u8) });
    } else if (/\.xml$/i.test(f.name)) out.push({ nome: f.name, xml: await f.text() });
  }
  return out;
}

export default function NfHistorico({ usuarioId, onFim }) {
  const [aberto, setAberto] = useState(false);
  const [prog, setProg] = useState(null);      // { feito, total }
  const [res, setRes] = useState(null);
  const [filtro, setFiltro] = useState("PROBLEMAS");
  const [erro, setErro] = useState("");
  const [arrasto, setArrasto] = useState(false);
  const ref = useRef(null);

  const importar = async (files) => {
    setErro(""); setRes(null);
    let arqs;
    try { arqs = await lerArquivos(files); } catch (e) { setErro("Não consegui abrir os arquivos: " + e.message); return; }
    if (!arqs.length) { setErro("Nenhum XML encontrado (aceita .xml e .zip com XMLs dentro)."); return; }
    const todos = [];
    setProg({ feito: 0, total: arqs.length });
    for (let i = 0; i < arqs.length; i += LOTE) {
      const lote = arqs.slice(i, i + LOTE);
      try {
        const r = await fetch("/api/nf/historico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId, arquivos: lote }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `erro ${r.status}`);
        todos.push(...d.resultados);
      } catch (e) { lote.forEach((a) => todos.push({ nome: a.nome, situacao: "ERRO", motivo: e.message })); }
      setProg({ feito: Math.min(arqs.length, i + LOTE), total: arqs.length });
    }
    setProg(null); setRes(todos); onFim && onFim();
  };

  const soma = (k) => (res || []).reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const conta = (s) => (res || []).filter((x) => x.situacao === s).length;
  const lista = (res || []).filter((x) => filtro === "TODOS" || (filtro === "PROBLEMAS" ? ["RECUSADA", "ERRO"].includes(x.situacao) : x.situacao === filtro));

  return (
    <div className="rounded-xl mb-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-2 px-5 py-3 text-left">
        <span className="font-semibold flex-1" style={{ color: C.navy }}>Importar histórico de XMLs (sem estoque)</span>
        <span className="text-xs" style={{ color: C.sub }}>{aberto ? "fechar" : "abrir"}</span>
      </button>
      {aberto && (
        <div className="px-5 pb-5">
          <div className="text-xs mb-3 p-3 rounded-lg" style={{ background: C.panel2, color: C.text }}>
            Para a base antiga de compras. Cada XML vira <b>NF registrada + contas a pagar</b>, mas <b>não entra no estoque</b> (o material já foi consumido).
            Duplicatas com vencimento <b>antes de 01/10/2026</b> entram como <b>pagas</b>; a partir de 01/10/2026 entram <b>em aberto</b> no contas a pagar
            (baixa manual ou por comprovante). Notas repetidas e contas já lançadas (mesmo CNPJ, valor e vencimento) não duplicam.
            Aceita vários <b>.xml</b> de uma vez ou <b>.zip</b> com os XMLs dentro.
          </div>
          <div onDragOver={(e) => { e.preventDefault(); setArrasto(true); }} onDragLeave={() => setArrasto(false)}
            onDrop={(e) => { e.preventDefault(); setArrasto(false); if (!prog) importar(e.dataTransfer.files); }}
            className="rounded-lg p-5 text-center" style={{ border: `2px dashed ${arrasto ? C.accent : C.line}`, background: arrasto ? C.accentSoft : "#fff" }}>
            {prog ? (
              <div>
                <div className="text-sm font-semibold mb-2" style={{ color: C.navy }}>Importando {prog.feito} de {prog.total} XML(s)…</div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.panel2 }}>
                  <div className="h-2" style={{ width: `${(prog.feito / prog.total) * 100}%`, background: C.accent }} />
                </div>
                <div className="text-[11px] mt-2" style={{ color: C.sub }}>Não feche esta tela até terminar.</div>
              </div>
            ) : (
              <>
                <div className="text-sm mb-3" style={{ color: C.sub }}>Arraste os XMLs (ou o .zip) para cá</div>
                <button onClick={() => ref.current?.click()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.navy }}>Selecionar arquivos do histórico</button>
                <input ref={ref} type="file" multiple accept=".xml,.zip" className="hidden" onChange={(e) => { importar(e.target.files); e.target.value = ""; }} />
              </>
            )}
          </div>
          {erro && <div className="mt-3 text-xs p-2 rounded" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
          {res && (
            <div className="mt-4">
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {[
                  ["XMLs lidos", res.length, `${conta("IMPORTADA")} novas · ${conta("JA_EXISTIA")} já existiam`],
                  ["Recusadas / erro", conta("RECUSADA") + conta("ERRO"), "natureza não é venda ou arquivo inválido"],
                  ["Contas pagas", soma("pagas"), moeda(soma("valorPago"))],
                  ["Contas em aberto", soma("abertas"), moeda(soma("valorAberto"))],
                  ["Ligadas a contas existentes", soma("vinculadas"), `${soma("jaExistiam")} parcela(s) já lançada(s)`],
                ].map(([t, v, s]) => (
                  <div key={t} className="rounded-lg p-3" style={{ border: `1px solid ${C.line}` }}>
                    <div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{t}</div>
                    <div className="text-lg font-bold" style={{ color: C.navy }}>{v}</div>
                    <div className="text-[11px]" style={{ color: C.sub }}>{s}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mb-2">
                {[["PROBLEMAS", "Recusadas e erros"], ["IMPORTADA", "Importadas"], ["JA_EXISTIA", "Já existiam"], ["TODOS", "Todas"]].map(([k, t]) => (
                  <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: filtro === k ? C.navy : C.panel2, color: filtro === k ? "#fff" : C.sub }}>{t}</button>
                ))}
              </div>
              <div className="max-h-80 overflow-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
                <table className="w-full text-xs">
                  <tbody>
                    {lista.map((x, i) => {
                      const [t, c, bg] = SIT[x.situacao] || [x.situacao, C.sub, C.panel2];
                      return (
                        <tr key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                          <td className="px-3 py-1.5"><span className="px-2 py-0.5 rounded-full font-semibold" style={{ color: c, background: bg }}>{t}</span></td>
                          <td className="px-3 py-1.5 font-mono">{x.numero || "—"}</td>
                          <td className="px-3 py-1.5">{x.fornecedor || x.nome}</td>
                          <td className="px-3 py-1.5" style={{ color: C.sub }}>
                            {x.motivo || [x.pagas ? `${x.pagas} paga(s)` : "", x.abertas ? `${x.abertas} em aberto` : "", x.vinculadas ? `${x.vinculadas} ligada(s)` : "", x.jaExistiam ? `${x.jaExistiam} já lançada(s)` : ""].filter(Boolean).join(" · ") || "sem duplicatas novas"}
                          </td>
                        </tr>
                      );
                    })}
                    {!lista.length && <tr><td className="px-3 py-4 text-center" style={{ color: C.sub }}>Nada aqui.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
