"use client";
// v1196 — Boletos Bradesco pelo ERP: emitir boleto, alterar vencimento/valor, abatimento, baixa, protesto e sustação
//   das contas marcadas; instruções esperando remessa; gerar o arquivo .REM (padrão do KM) e imprimir boletos.
import React, { useEffect, useState } from "react";
import { Loader2, X, Download, Printer, Trash2, FileCode2 } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", navy: "#001E41", green: "#12A150", red: "#D92D20", amber: "#B54708" };
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const ST = { PENDENTE: ["esperando remessa", C.amber], ENVIADA: ["enviada ao banco", C.navy], CONFIRMADA: ["confirmada", C.green], REJEITADA: ["REJEITADA", C.red] };
const ACOES = [["REGISTRO", "Emitir boleto"], ["VENCIMENTO", "Alterar vencimento"], ["VALOR", "Alterar valor"], ["ABATIMENTO", "Conceder abatimento"], ["CANC_ABATIMENTO", "Cancelar abatimento"],
  ["BAIXA", "Baixar / cancelar boleto"], ["PROTESTO", "Protestar"], ["SUSTAR", "Sustar protesto e baixar"]];

export default function BoletosModal({ user, marcados = [], onClose }) {
  const [d, setD] = useState(null), [st, setSt] = useState(""), [acao, setAcao] = useState(marcados.some((t) => !t.nossoNumero) ? "REGISTRO" : "VENCIMENTO");
  const [venc, setVenc] = useState(""), [valor, setValor] = useState(""), [cfg, setCfg] = useState(null);
  const carregar = () => fetch(`/api/fin/boletos?u=${user.id}`).then((r) => r.json()).then((x) => { setD(x); setCfg(x.config); }).catch(() => setD({ instrucoes: [], remessas: [] }));
  useEffect(() => { carregar(); }, []);
  const post = (corpo) => fetch("/api/fin/boletos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ...corpo }) }).then((r) => r.json()).catch((e) => ({ error: e.message }));

  const aplicar = async () => {
    if (!marcados.length) return alerta("Marque as contas a receber na lista antes de abrir a cobrança.");
    const dados = acao === "VENCIMENTO" ? { vencimento: venc } : acao === "VALOR" ? { valor: Number(String(valor).replace(/\./g, "").replace(",", ".")) } : acao === "ABATIMENTO" ? { abatimento: Number(String(valor).replace(/\./g, "").replace(",", ".")) } : {};
    if (acao === "VENCIMENTO" && !venc) return alerta("Informe o novo vencimento.");
    if (["VALOR", "ABATIMENTO"].includes(acao) && !(dados.valor || dados.abatimento)) return alerta("Informe o valor.");
    const nome = ACOES.find((a) => a[0] === acao)[1];
    if (!(await confirmar(`${nome} em ${marcados.length} conta(s)? A instrução vai na próxima remessa ao Bradesco.`))) return;
    setSt("Registrando…");
    const r = await post({ acao: "instrucao", tipo: acao, ids: marcados.map((t) => t.id), dados });
    setSt("");
    if (r.erros?.length) await alerta(`${r.feitas || 0} feita(s).\n${r.erros.join("\n")}`);
    carregar();
  };
  const gerar = async () => {
    const n = (d?.instrucoes || []).filter((i) => i.status === "PENDENTE").length;
    if (!n) return alerta("Nenhuma instrução esperando remessa.");
    if (!(await confirmar(`Gerar a remessa nº ${cfg?.proxRemessa} com ${n} instrução(ões)? Depois suba o arquivo no Bradesco (Net Empresa › Cobrança › Transmissão de arquivos).`))) return;
    setSt("Gerando remessa…");
    const r = await post({ acao: "remessa" });
    setSt("");
    if (r.error) return alerta(r.error);
    window.location.href = `/api/fin/boletos?u=${user.id}&remessa=${r.remessa.id}`;
    if (r.erros?.length) alerta(`Ficaram de fora:\n${r.erros.join("\n")}`);
    carregar();
  };
  const salvarCfg = async () => { const r = await post({ acao: "config", dados: cfg }); if (r.error) return alerta(r.error); setCfg(r.config); alerta("Numeração salva."); };
  const comBoleto = marcados.filter((t) => t.nossoNumero);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4" style={{ background: "rgba(0,0,0,.45)" }}>
      <div className="w-full max-w-5xl rounded-xl my-6 text-xs" style={{ background: C.panel, color: C.text }}>
        <div className="flex items-center px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <FileCode2 size={16} style={{ color: C.accent }} /><b className="text-sm ml-2" style={{ color: C.navy }}>Cobrança Bradesco · boletos e remessa</b>
          <button onClick={onClose} className="ml-auto"><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4 space-y-3">
          <Sec t={`Contas marcadas (${marcados.length})`}>
            {!marcados.length ? <div style={{ color: C.sub }}>Marque as contas a receber na lista (caixa à esquerda) e abra de novo.</div> : (
              <>
                <div className="max-h-40 overflow-y-auto mb-2">{marcados.map((t) => (
                  <div key={t.id} className="flex gap-3 py-0.5"><span className="flex-1 truncate">{t.titulo} · {t.parceiro}</span><span>{dBR(t.vencimento)}</span><b>{brl(t.valor)}</b>
                    <span style={{ color: t.nossoNumero ? C.green : C.sub, width: 130 }}>{t.nossoNumero ? `boleto ${t.nossoNumero}` : "sem boleto"}</span></div>))}</div>
                <div className="flex flex-wrap items-end gap-2">
                  <label>Instrução<select value={acao} onChange={(e) => setAcao(e.target.value)} className="block mt-0.5 px-2 py-1.5 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>{ACOES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
                  {acao === "VENCIMENTO" && <label>Novo vencimento<input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className="block mt-0.5 px-2 py-1 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }} /></label>}
                  {["VALOR", "ABATIMENTO"].includes(acao) && <label>{acao === "VALOR" ? "Novo valor" : "Abatimento"} (R$)<input value={valor} onChange={(e) => setValor(e.target.value)} className="block mt-0.5 px-2 py-1 rounded-md" style={{ width: 120, background: C.panel2, border: `1px solid ${C.line}` }} /></label>}
                  <button onClick={aplicar} disabled={!!st} className="px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: C.accent }}>Aplicar às marcadas</button>
                  {comBoleto.length > 0 && <a href={`/api/fin/boletos?u=${user.id}&boletos=${comBoleto.map((t) => t.id).join(",")}`} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold" style={{ border: `1px solid ${C.navy}`, color: C.navy }}><Printer size={14} /> Imprimir boletos ({comBoleto.length})</a>}
                </div>
                <div className="mt-2" style={{ color: C.sub }}>A conta já muda no sistema (vencimento, valor). O banco recebe a instrução pela remessa, e o retorno confirma ou rejeita.</div>
              </>)}
          </Sec>

          <Sec t="Instruções">
            {!d ? <div style={{ color: C.sub }}><Loader2 size={13} className="inline animate-spin" /> carregando…</div> : !d.instrucoes.length ? <div style={{ color: C.sub }}>Nenhuma instrução em andamento.</div> : (
              <table className="w-full"><tbody>{d.instrucoes.map((i) => (
                <tr key={i.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="py-1">{d.tipos?.[i.tipo] || i.tipo}{i.dados?.vencimento ? ` → ${dBR(i.dados.vencimento)}` : ""}{i.dados?.valor ? ` → ${brl(i.dados.valor)}` : ""}{i.dados?.abatimento ? ` (${brl(i.dados.abatimento)})` : ""}</td>
                  <td>{i.titulo ? `${i.titulo.titulo} · ${i.titulo.parceiro}` : `conta ${i.tituloId}`}</td>
                  <td><b style={{ color: ST[i.status]?.[1] }}>{ST[i.status]?.[0] || i.status}</b>{i.retornoTxt ? <div style={{ color: C.sub }}>{i.retornoTxt}</div> : null}</td>
                  <td className="text-right">{i.status === "PENDENTE" && <button onClick={async () => { const r = await post({ acao: "cancelar", id: i.id }); if (r.error) alerta(r.error); else { if (r.aviso) alerta(r.aviso); carregar(); } }} title="desfazer"><Trash2 size={13} style={{ color: C.sub }} /></button>}</td>
                </tr>))}</tbody></table>)}
            <div className="flex items-center gap-2 mt-2">
              <button onClick={gerar} disabled={!!st} className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: C.navy }}><Download size={14} /> Gerar remessa</button>
              {st && <span style={{ color: C.sub }}><Loader2 size={13} className="inline animate-spin" /> {st}</span>}
              <span className="ml-auto" style={{ color: C.sub }}>O retorno do banco entra pela Transmissão de arquivos (como hoje) e confirma cada instrução.</span>
            </div>
          </Sec>

          <div className="grid grid-cols-2 gap-3">
            <Sec t="Remessas geradas">
              {!d?.remessas?.length ? <div style={{ color: C.sub }}>Nenhuma ainda.</div> : d.remessas.map((r) => (
                <div key={r.id} className="flex gap-3 py-0.5"><span>nº {r.sequencial}</span><span>{r.arquivo}</span><span>{r.qtd} registro(s)</span><span style={{ color: C.sub }}>{new Date(r.createdAt).toLocaleString("pt-BR").slice(0, 17)}</span>
                  <a className="ml-auto underline" style={{ color: C.navy }} href={`/api/fin/boletos?u=${user.id}&remessa=${r.id}`}>baixar</a></div>))}
            </Sec>
            <Sec t="Numeração">
              {cfg && <div className="flex flex-wrap items-end gap-2">
                <label>Próximo nosso número<input value={cfg.proxNossoNumero} onChange={(e) => setCfg({ ...cfg, proxNossoNumero: e.target.value })} className="block mt-0.5 px-2 py-1 rounded-md" style={{ width: 130, background: C.panel2, border: `1px solid ${C.line}` }} /></label>
                <label>Próxima remessa<input value={cfg.proxRemessa} onChange={(e) => setCfg({ ...cfg, proxRemessa: e.target.value })} className="block mt-0.5 px-2 py-1 rounded-md" style={{ width: 90, background: C.panel2, border: `1px solid ${C.line}` }} /></label>
                <button onClick={salvarCfg} className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.panel2 }}>Salvar</button>
              </div>}
              <div className="mt-2" style={{ color: C.amber }}>O KM usa a mesma sequência de remessa: se ele mandar outra remessa, ajuste aqui o próximo número (o do KM + 1). O nosso número do ERP fica numa faixa própria (a partir de 100.000).</div>
            </Sec>
          </div>
        </div>
      </div>
    </div>
  );
}
function Sec({ t, children }) {
  return <div className="rounded-lg p-3" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.navy }}>{t}</div>{children}</div>;
}
