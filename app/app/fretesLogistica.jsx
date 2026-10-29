"use client";
// v557 — Análise da logística › Frete compra / Frete entrega / Fretes baixados (CT-es subidos no movimento fiscal).
import React, { useEffect, useState } from "react";
import { Loader2, Search, FileCode2, FileText, ChevronDown, ChevronRight, CheckCircle2, Undo2, Truck } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", red: "#D92D20", blue: "#1570EF", soft: "#FFF1E8", greenSoft: "#E7F6EC", redSoft: "#FDECEA", yellow: "#B54708", yellowSoft: "#FEF0C7" };
const brl = (v) => (v == null ? "—" : (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDoc = (d) => { const s = String(d || "").replace(/\D/g, ""); return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : s; };
const nDias = (n) => (n == null ? "—" : `${n} dia${n === 1 ? "" : "s"}`);
const TXT = {
  COMPRA: "CT-es de frete de NFs de compra (fornecedor → Meridian). Baixam sozinhos quando a OC da NF é baixada (material recebido).",
  ENTREGA: "CT-es de frete de NFs de saída da Meridian (venda, remessa ou qualquer natureza). Registre a entrega para baixar.",
  BAIXADOS: "Fretes entregues: baixa da OC (compra) ou entrega registrada. O tempo de transporte conta da emissão do CT-e até a entrega.",
};

export default function FretesLogistica({ user, guia }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const carregar = () => {
    setErro("");
    fetch(`/api/logistica/fretes?u=${user.id}&guia=${guia}&busca=${encodeURIComponent(busca)}`).then((r) => r.json())
      .then((j) => { if (j.error) { setErro(j.error); setD({ fretes: [], total: {} }); } else setD(j); })
      .catch((e) => setErro(e.message));
  };
  useEffect(() => { setD(null); setAberto(null); }, [guia]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [guia, busca]);

  const l = d?.fretes || [];
  const tot = d?.total || {};
  const arq = (f, a, nf) => `/api/logistica/fretes?u=${user.id}&id=${f.id}&arq=${a}${nf ? `&nf=${nf}` : ""}${a.endsWith("xml") ? "&baixar=1" : ""}`;
  const cols = ["Emissão CT-e", "Transportadora", "Origem", "Destino", "Remetente", "Valor da NF", "Valor do frete", "% frete / NF", "Arquivos"];
  if (guia === "BAIXADOS") cols.splice(1, 0, "Tipo");

  return (
    <div>
      <div className="text-xs mb-3" style={{ color: C.sub }}>{TXT[guia]} O CT-e (XML e PDF) é subido no <b>Movimento fiscal</b>, que lança a conta a pagar do frete.</div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {[["Fretes", d ? String(tot.fretes || 0) : "…", C.navy], ["Valor dos fretes", `R$ ${brl(tot.frete)}`, C.accent], ["Valor das NFs", `R$ ${brl(tot.nf)}`, C.navy],
          ["Frete / NF", tot.nf ? `${brl((tot.frete / tot.nf) * 100)}%` : "—", C.accent]].map(([t, v, c]) => (
          <div key={t} className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{t}</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="relative" style={{ width: 300 }}>
            <Search size={14} className="absolute left-2 top-2.5" style={{ color: C.sub }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="CT-e, transportadora, NF, OC, pedido, cidade" className="w-full rounded px-2 py-1.5 text-sm outline-none" style={{ border: `1px solid ${C.line}`, paddingLeft: 26 }} />
          </div>
          {!d && <Loader2 size={15} className="animate-spin" style={{ color: C.sub }} />}
        </div>
        {erro && <div className="mx-4 mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.sub }}><th className="w-6" />{cols.map((h) => <th key={h} className={`px-2 py-2 font-semibold whitespace-nowrap ${/Valor|%/.test(h) ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>
              {d && !l.length && <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center" style={{ color: C.sub }}>Nenhum frete {guia === "BAIXADOS" ? "baixado" : "pendente"}{busca ? " com essa busca" : ""}.</td></tr>}
              {l.map((f) => {
                const on = aberto === f.id;
                return (
                  <React.Fragment key={f.id}>
                    <tr onClick={() => setAberto(on ? null : f.id)} className="cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, background: on ? C.panel2 : undefined }}>
                      <td className="pl-2" style={{ color: C.sub }}>{on ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="px-2 py-2 whitespace-nowrap"><div className="font-semibold">{dBR(f.emissao)}</div><div style={{ color: C.sub }}>CT-e {f.numero}</div></td>
                      {guia === "BAIXADOS" && <td className="px-2 py-2"><span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: f.tipo === "COMPRA" ? C.soft : "#E8F1FD", color: f.tipo === "COMPRA" ? C.accent : C.blue }}>{f.tipo === "COMPRA" ? "Compra" : "Entrega"}</span></td>}
                      <td className="px-2 py-2 font-semibold">{f.transportadora}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{f.origem || "—"}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{f.destino || "—"}</td>
                      <td className="px-2 py-2" style={{ maxWidth: 220 }}><div className="truncate" title={f.remetente || ""}>{f.remetente || "—"}</div>
                        <div style={{ color: C.sub }}>NF {f.nfs.map((x) => x.numero).join(", ") || "—"}</div></td>
                      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap" title={f.valorNfEstimado ? "NF ainda não subida — valor da carga declarado no CT-e" : ""}>{brl(f.valorNf)}{f.valorNfEstimado && <span style={{ color: C.yellow }}> *</span>}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{brl(f.valorFrete)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-bold whitespace-nowrap" style={{ color: C.accent }}>{f.pct == null ? "—" : `${brl(f.pct)}%`}</td>
                      <td className="px-2 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Arq on={f.nfs.some((x) => x.temPdf)} href={arq(f, "nf-pdf")} t="NF" pdf />
                        <Arq on={f.nfs.some((x) => x.temXml)} href={arq(f, "nf-xml")} t="NF" />
                        <Arq on={f.ctePdf} href={arq(f, "cte-pdf")} t="CT-e" pdf />
                        <Arq on={f.cteXml} href={arq(f, "cte-xml")} t="CT-e" />
                      </td>
                    </tr>
                    {on && <tr><td colSpan={cols.length + 1} className="px-4 pb-4 pt-1" style={{ background: C.panel2 }}><Detalhe f={f} user={user} onFeito={carregar} arq={arq} /></td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {l.some((f) => f.valorNfEstimado) && <div className="px-4 py-2 text-[11px]" style={{ color: C.sub }}><span style={{ color: C.yellow }}>*</span> NF ainda não subida no sistema: vale o valor da carga declarado no CT-e.</div>}
      </div>
    </div>
  );
}

function Arq({ on, href, t, pdf }) {
  const I = pdf ? FileText : FileCode2;
  if (!on) return <span className="inline-flex items-center gap-0.5 mr-2 opacity-30" title={`sem ${t} ${pdf ? "PDF" : "XML"}`}><I size={12} /> {t}</span>;
  return <a href={href} target={pdf ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-0.5 mr-2 font-semibold" style={{ color: pdf ? C.red : C.blue }} title={`${t} ${pdf ? "PDF" : "XML"}`}><I size={12} /> {t}</a>;
}

function Detalhe({ f, user, onFeito, arq }) {
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [st, setSt] = useState(false);
  const post = async (body) => {
    setSt(true);
    try { const r = await fetch("/api/logistica/fretes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, id: f.id, ...body }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Erro"); onFeito(); }
    catch (e) { alerta(e.message); }
    setSt(false);
  };
  const ocAberta = f.ocs.some((o) => !o.baixaEm);
  const campos = [
    ["Volumes", f.volumes == null ? "—" : f.volumes.toLocaleString("pt-BR")], ["Peso", f.pesoKg == null ? "—" : `${f.pesoKg.toLocaleString("pt-BR")} kg`],
    ["Emissão da NF", dBR(f.emissaoNf)], ["Emissão do CT-e", dBR(f.emissao)], ["Previsão de entrega", dBR(f.previsaoEntrega)],
    ["Entregue em", f.entregue ? dBR(f.entregue) : "em trânsito"],
    [f.entregue ? "Tempo de transporte" : "Em trânsito há", nDias(f.diasTransporte)], ["NF → entrega", f.entregue ? nDias(f.diasNfEntrega) : "—"],
  ];
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {campos.map(([t, v]) => <div key={t}><div className="text-[11px]" style={{ color: C.sub }}>{t}</div><div className="font-semibold tabular-nums">{v}</div></div>)}
        {f.atraso > 0 && <div><div className="text-[11px]" style={{ color: C.sub }}>Atraso</div><div className="font-bold" style={{ color: C.red }}>{nDias(f.atraso)}</div></div>}
      </div>
      <div className="grid gap-3 text-xs mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div>
          <div className="font-bold mb-1" style={{ color: C.navy }}>Transporte</div>
          <div>{f.transportadora} <span style={{ color: C.sub }}>{fmtDoc(f.transpCnpj)}</span></div>
          <div style={{ color: C.sub }}>{f.origem || "?"} → {f.destino || "?"}</div>
          <div style={{ color: C.sub }}>Remetente: {f.remetente || "—"}{f.destinatario ? ` · Destinatário: ${f.destinatario}` : ""}{f.tomador ? ` · Tomador: ${f.tomador}` : ""}</div>
        </div>
        <div>
          <div className="font-bold mb-1" style={{ color: C.navy }}>NF(s) atendida(s)</div>
          {f.nfs.map((x) => (
            <div key={x.chave} className="flex items-center gap-2">
              <span className="font-semibold">NF {x.numero}</span>
              {x.fonte ? <span style={{ color: C.sub }}>{dBR(x.emissao)} · R$ {brl(x.valor)}{x.parceiro ? ` · ${x.parceiro}` : ""}</span> : <span style={{ color: C.yellow }}>ainda não subida no sistema</span>}
              {x.temPdf && <a href={arq(f, "nf-pdf", x.chave)} target="_blank" rel="noreferrer" style={{ color: C.red }}><FileText size={12} /></a>}
              {x.temXml && <a href={arq(f, "nf-xml", x.chave)} style={{ color: C.blue }}><FileCode2 size={12} /></a>}
            </div>
          ))}
          {!f.nfs.length && <div style={{ color: C.sub }}>O CT-e não traz a chave da NF.</div>}
          {f.ocs.length > 0 && <div className="mt-1">OC {f.ocs.map((o) => `${o.numero}${o.baixaEm ? ` (baixada ${dBR(o.baixaEm)})` : " (aguardando recebimento)"}`).join(", ")}</div>}
          {f.pedidos.length > 0 && <div className="mt-1">Pedido(s): <b>{f.pedidos.join(", ")}</b></div>}
        </div>
        <div>
          <div className="font-bold mb-1" style={{ color: C.navy }}>Conta a pagar do frete</div>
          {f.contas.map((c) => <div key={c.id}>{dBR(c.vencimento)} · R$ {brl(c.valor)} · <span style={{ color: c.status === "PAGO" ? C.green : C.text }}>{c.status === "PAGO" ? `paga ${dBR(c.dataPagamento)}` : c.status === "ABERTO" ? "em aberto" : c.status.toLowerCase()}</span></div>)}
          {!f.contas.length && <div style={{ color: C.sub }}>{f.semConta ? `sem conta — ${f.semConta}` : "sem conta lançada"}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
        {f.entregue ? (
          <>
            <span className="flex items-center gap-1 font-semibold text-xs" style={{ color: C.green }}><CheckCircle2 size={14} /> Entregue em {dBR(f.entregue)}{f.entregaPor ? ` · ${f.entregaManual ? "registrado" : "OC baixada"} por ${f.entregaPor}` : f.entregaManual ? "" : " · baixa da OC"}{f.entregaObs ? ` · ${f.entregaObs}` : ""}</span>
            {f.entregaManual && <button disabled={st} onClick={async () => { if (await confirmar(`Desfazer a entrega do CT-e ${f.numero}?`)) post({ acao: "desfazer" }); }} className="ml-auto flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: C.sub }}><Undo2 size={12} /> Desfazer entrega</button>}
            {!f.entregaManual && <span className="ml-auto text-[11px]" style={{ color: C.sub }}>Para desfazer, reabra a OC no Compras.</span>}
          </>
        ) : (
          <>
            <Truck size={14} style={{ color: C.accent }} />
            <span className="text-xs font-semibold">Registrar entrega</span>
            <input type="date" value={data} max={hojeISO()} min={f.emissao || undefined} onChange={(e) => setData(e.target.value)} className="rounded px-2 py-1 text-xs" style={{ border: `1px solid ${C.line}` }} />
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="rounded px-2 py-1 text-xs flex-1 min-w-[160px]" style={{ border: `1px solid ${C.line}` }} />
            <button disabled={st} onClick={() => post({ acao: "entrega", data, obs })} className="px-3 py-1 rounded text-xs font-semibold text-white" style={{ background: C.green, opacity: st ? 0.6 : 1 }}>{st ? "Salvando…" : "Baixar frete"}</button>
            {f.tipo === "COMPRA" && ocAberta && <span className="w-full text-[11px]" style={{ color: C.sub }}>Este frete também baixa sozinho quando a OC for baixada no Compras.</span>}
          </>
        )}
      </div>
    </div>
  );
}
