"use client";
// v1035 — Contabilidade › SPED Fiscal (EFD ICMS/IPI) gerado pelo ERP: prévia, críticas, comparação com o SPED do KM e download do TXT.
import React, { useEffect, useState } from "react";
import { Loader2, FileCode2, Download, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, GitCompare } from "lucide-react";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", navy: "#001E41",
  green: "#12A150", greenSoft: "#E7F6EE", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", blue: "#2E7CD6", blueSoft: "#EAF2FC" };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TIPO_TXT = { SEM_XML: "Sem XML", XML: "XML inválido", TOTAL: "Total", NCM: "NCM", UNIDADE: "Unidade", CST_ORIGEM: "Origem", PARTICIPANTE: "Participante", PROPRIA: "Nota própria", BLOCO_E: "Bloco E" };

export default function SpedErp({ user, comp }) {
  const [d, setD] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [ver, setVer] = useState("");
  useEffect(() => { setD(null); setErro(""); setVer(""); }, [comp]);
  const gerar = async () => {
    setCarregando(true); setErro("");
    try {
      const r = await fetch(`/api/fin/sped?u=${user.id}&competencia=${comp}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao gerar.");
      setD(j);
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  };
  const cmp = d?.comparacao;
  const nDif = cmp ? cmp.soNoErp.length + cmp.soNoOutro.length + cmp.diferentes.length : 0;
  const crits = (d?.criticas || []).filter((c) => c.tipo !== "BLOCO_E");
  const blocoE = (d?.criticas || []).find((c) => c.tipo === "BLOCO_E");
  const Lin = ({ x, extra }) => (
    <div className="flex items-center gap-3 px-3 py-1 text-[11px]" style={{ borderTop: `1px solid ${C.line}` }}>
      <span className="w-14 font-semibold">{x.oper === "ENTRADA" ? "Entrada" : "Saída"}</span><span className="w-12">{x.tipo}</span>
      <span className="w-20 font-semibold">{x.numero}</span><span className="w-20" style={{ color: C.sub }}>{x.cfops}</span>
      <span className="flex-1 min-w-0 truncate" style={{ color: extra ? C.red : C.sub }}>{extra || ""}</span>
      <span className="w-24 text-right">R$ {brl(x.vlDoc)}</span><span className="w-24 text-right" style={{ color: C.sub }}>ICMS {brl(x.icms)}</span>
    </div>
  );
  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <FileCode2 size={17} style={{ color: C.accent }} />
        <div className="font-bold text-sm flex-1" style={{ color: C.navy }}>SPED Fiscal (EFD ICMS/IPI) gerado pelo ERP</div>
        <button disabled={carregando} onClick={gerar} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>
          {carregando ? <Loader2 size={13} className="animate-spin" /> : <GitCompare size={13} />} {d ? "Gerar de novo" : "Gerar prévia"}</button>
        <a href={`/api/fin/sped?u=${user.id}&competencia=${comp}&baixar=1`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}><Download size={13} /> Baixar TXT</a>
      </div>
      <div className="text-[11px] mt-1" style={{ color: C.sub }}>
        Gerado dos XMLs do Movimento fiscal: notas de entrada e saída e CT-e do mês. Etapa 1: blocos 0, C, D e 9. A apuração com o RET (Bloco E) e o estoque escriturado (Bloco K) entram nas próximas etapas.
      </div>
      {erro && <div className="text-xs mt-2" style={{ color: C.red }}>{erro}</div>}
      {d && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {[["Saídas", d.resumo.saidas], ["Entradas", d.resumo.entradas], ["CT-e", d.resumo.ctes], ["Participantes", d.resumo.participantes], ["Itens (0200)", d.resumo.itens],
              ["ICMS débitos", `R$ ${brl(d.resumo.icmsDebitos)}`], ["ICMS créditos", `R$ ${brl(d.resumo.icmsCreditos)}`], ["Linhas", d.resumo.linhas]].map(([l, v]) => (
              <div key={l} className="rounded-lg px-2.5 py-1.5" style={{ background: C.panel2 }}><div style={{ color: C.sub }}>{l}</div><div className="font-semibold" style={{ color: C.text }}>{v}</div></div>
            ))}
          </div>
          {blocoE && <div className="px-3 py-2 rounded-lg text-[11px]" style={{ background: C.blueSoft, color: C.text }}>{blocoE.texto}</div>}
          {crits.length > 0 ? (
            <div>
              <button onClick={() => setVer(ver === "crit" ? "" : "crit")} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.yellow }}>
                <AlertTriangle size={13} /> {crits.length} crítica(s) para conferir {ver === "crit" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
              {ver === "crit" && <div className="mt-1 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                {crits.map((c, k) => <div key={k} className="px-3 py-1 text-[11px] flex gap-2" style={{ borderTop: k ? `1px solid ${C.line}` : "none", background: C.yellowSoft }}>
                  <b className="w-20 shrink-0">{TIPO_TXT[c.tipo] || c.tipo}</b><span>{c.texto}</span></div>)}
              </div>}
            </div>
          ) : <div className="flex items-center gap-1 text-xs" style={{ color: C.green }}><CheckCircle2 size={13} /> Sem críticas nos documentos.</div>}
          {cmp ? (
            <div className="rounded-lg p-3" style={{ background: C.panel2 }}>
              <div className="text-xs font-semibold mb-2" style={{ color: C.navy }}>Comparação com o SPED guardado na Contabilidade ({cmp.arquivo})</div>
              <div className="grid gap-1 text-[11px] mb-2" style={{ gridTemplateColumns: "140px repeat(5, minmax(0,1fr))" }}>
                <span /> {["Docs", "Entradas", "ICMS entradas", "Saídas", "ICMS saídas"].map((t) => <b key={t} className="text-right">{t}</b>)}
                {[["ERP", cmp.totais.nosso], ["Arquivo guardado", cmp.totais.outro]].map(([l, t]) => (
                  <React.Fragment key={l}><span style={{ color: C.sub }}>{l}</span><span className="text-right">{t.docs}</span><span className="text-right">{brl(t.entradas)}</span>
                    <span className="text-right">{brl(t.icmsEntradas)}</span><span className="text-right">{brl(t.saidas)}</span><span className="text-right">{brl(t.icmsSaidas)}</span></React.Fragment>
                ))}
              </div>
              {nDif === 0 ? <div className="flex items-center gap-1 text-xs" style={{ color: C.green }}><CheckCircle2 size={13} /> As mesmas notas, com os mesmos valores, ICMS e CFOP.</div> : (
                <div className="space-y-2">
                  {[["dif", `${cmp.diferentes.length} nota(s) com diferença`, cmp.diferentes, true], ["erp", `${cmp.soNoErp.length} só no ERP`, cmp.soNoErp], ["outro", `${cmp.soNoOutro.length} só no arquivo guardado (faltam no ERP)`, cmp.soNoOutro]]
                    .filter(([, , l]) => l.length).map(([k, t, l, comDif]) => (
                      <div key={k}>
                        <button onClick={() => setVer(ver === k ? "" : k)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: k === "outro" ? C.red : C.yellow }}>
                          {t} {ver === k ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
                        {ver === k && <div className="mt-1 rounded-lg overflow-hidden bg-white" style={{ border: `1px solid ${C.line}` }}>
                          {l.map((x) => <Lin key={x.chave} x={x} extra={comDif ? x.diferencas.join(" · ") : ""} />)}</div>}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : <div className="text-[11px]" style={{ color: C.sub }}>Para comparar nota a nota, suba o SPED do KM deste mês no card SPED da Contabilidade do mês seguinte (onde ele é entregue). O sistema acha o arquivo pelo período dentro dele.</div>}
        </div>
      )}
    </div>
  );
}
