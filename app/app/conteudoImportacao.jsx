"use client";
// v1034 — Card "Conteúdo de importação" na guia Financeiro do pedido.
// RET 45.000047072-14 (TTS/Confecções): até 40% de material importado → recolhimento efetivo de 2%; acima → 5% interna / 2,5% interestadual.
import React, { useEffect, useState } from "react";
import { Loader2, Globe, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", navy: "#001E41",
  green: "#12A150", greenSoft: "#E7F6EE", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA" };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctTxt = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const qtd = (v) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default function ConteudoImportacao({ numero, veVal }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    fetch(`/api/compras/conteudo-importacao?pedido=${encodeURIComponent(numero)}`, { cache: "no-store" })
      .then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); })
      .catch((e) => setErro(e.message));
  }, [numero]);

  const sit = d?.situacao;
  const cor = sit === "ACIMA" ? C.red : sit === "INCERTO" ? C.yellow : sit === "OK" ? C.green : C.sub;
  const fundo = sit === "ACIMA" ? C.redSoft : sit === "INCERTO" ? C.yellowSoft : sit === "OK" ? C.greenSoft : C.panel2;
  const barra = d?.pct != null ? Math.min(100, (d.pct / 60) * 100) : 0;   // escala até 60% (limite em 40%)
  const semOrigem = (d?.linhas || []).filter((l) => !l.identificado);

  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${sit === "ACIMA" ? C.red : C.line}` }}>
      <div className="flex items-center gap-2 mb-2">
        <Globe size={15} style={{ color: C.accent }} />
        <div className="text-sm font-bold flex-1" style={{ color: C.navy }}>Conteúdo de importação</div>
        <span className="text-xs" style={{ color: C.sub }}>RET: até {d?.limite ?? 40}% → ICMS efetivo de 2%</span>
      </div>
      {erro ? <div className="text-xs" style={{ color: C.red }}>{erro}</div>
        : !d ? <div className="flex items-center gap-2 text-xs" style={{ color: C.sub }}><Loader2 size={13} className="animate-spin" /> Calculando…</div>
        : sit === "SEM_DADOS" ? <div className="text-xs" style={{ color: C.sub }}>Sem materiais do pedido em Compras (FPP base) para calcular.</div>
        : (
          <>
            {sit !== "OK" && (
              <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-lg text-xs font-semibold" style={{ background: fundo, color: cor }}>
                <AlertTriangle size={14} className="shrink-0 mt-px" />
                <span>{sit === "ACIMA"
                  ? `Material importado = ${pctTxt(d.pct)} do valor do pedido — acima de ${d.limite}%. Pelo RET, a venda deixa de ter o recolhimento efetivo de 2% (passa a 5% na venda interna e 2,5% na interestadual). Avise o fiscal antes de faturar.`
                  : `Material importado = ${pctTxt(d.pct)}, mas há material sem origem identificada; se ele for importado, o pedido chega a ${pctTxt(d.pctMax)} (acima de ${d.limite}%). Ligue a NF de compra na OC para confirmar.`}</span>
              </div>
            )}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1 h-2.5 rounded-full relative" style={{ background: C.panel2 }}>
                <div className="h-2.5 rounded-full" style={{ width: `${barra}%`, background: cor }} />
                <div className="absolute top-[-3px] h-4 w-0.5" style={{ left: `${(d.limite / 60) * 100}%`, background: C.navy }} title={`limite ${d.limite}%`} />
              </div>
              <span className="text-sm font-bold w-16 text-right" style={{ color: cor }}>{pctTxt(d.pct)}</span>
              {sit === "OK" && <CheckCircle2 size={15} style={{ color: C.green }} />}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-2" style={{ color: C.sub }}>
              {veVal && <span>Venda <b style={{ color: C.text }}>{brl(d.venda)}</b></span>}
              {veVal && <span>Material <b style={{ color: C.text }}>{brl(d.material)}</b></span>}
              {veVal && <span>Importado <b style={{ color: C.text }}>{brl(d.importado)}</b></span>}
              {semOrigem.length > 0 && <span style={{ color: C.yellow }}>{semOrigem.length} material(is) sem origem identificada{veVal ? ` (${brl(d.semOrigem)})` : ""}</span>}
              <button onClick={() => setAberto((x) => !x)} className="ml-auto flex items-center gap-0.5 font-semibold" style={{ color: C.accent }}>
                {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {aberto ? "ocultar materiais" : "ver materiais"}</button>
            </div>
            {aberto && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                {d.linhas.map((l, k) => (
                  <div key={k} className="px-3 py-1.5 text-[11px]" style={{ borderTop: k ? `1px solid ${C.line}` : "none", background: l.importado > 0 ? C.redSoft : !l.identificado ? C.yellowSoft : C.panel }}>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold flex-1 min-w-0 truncate" style={{ color: C.text }}>{l.material}{l.papel ? <span style={{ color: C.sub }}> · {String(l.papel).toLowerCase()}</span> : null}</span>
                      <span style={{ color: C.sub }}>item {l.item}</span>
                      <span>{qtd(l.quantidade)} {String(l.unidade || "").toLowerCase()}</span>
                      {veVal && <span className="w-24 text-right font-semibold">{brl(l.valor)}</span>}
                    </div>
                    <div className="flex items-center gap-3" style={{ color: C.sub }}>
                      <span style={{ color: l.importado > 0 ? C.red : !l.identificado ? C.yellow : C.green }}>
                        {l.identificado ? `origem ${l.origem} · ${l.origemTxt}` : "origem não identificada (sem NF de compra com XML ligada)"}</span>
                      {l.nf && <span className="truncate">NF {l.nf.numero} {dBR(l.nf.emissao)} · {l.nf.fornecedor}</span>}
                      {l.via && <span className="ml-auto shrink-0">{l.via}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}
