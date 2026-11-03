"use client";
// v628 — Dados › Tributário: emitente, naturezas de operação e classificação fiscal dos produtos (base para emitir NF-e pelo Bling)
import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Star } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", green: "#12A150", red: "#D92D20" };
const CRT = [["1", "1 · Simples Nacional"], ["2", "2 · Simples Nacional — excesso de sublimite"], ["3", "3 · Regime normal (Lucro Presumido/Real)"], ["4", "4 · MEI"]];
const FINALIDADE = [[1, "1 · Normal"], [2, "2 · Complementar"], [3, "3 · Ajuste"], [4, "4 · Devolução"]];
const PRESENCA = [[0, "0 · Não se aplica"], [1, "1 · Presencial"], [2, "2 · Internet"], [3, "3 · Teleatendimento"], [9, "9 · Outros"]];
const ORIGEM = [[0, "0 · Nacional"], [1, "1 · Estrangeira — importação direta"], [2, "2 · Estrangeira — mercado interno"], [3, "3 · Nacional, importação > 40%"], [4, "4 · Nacional, processos básicos"],
  [5, "5 · Nacional, importação ≤ 40%"], [6, "6 · Estrangeira direta, sem similar"], [7, "7 · Estrangeira interna, sem similar"], [8, "8 · Nacional, importação > 70%"]];
const inp = "w-full px-2 py-1.5 rounded-lg outline-none text-sm";
const iS = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text };
const fmt = (v) => (v == null ? "" : String(v).replace(".", ","));
const Campo = ({ rot, dica, children, cls = "" }) => <label className={`block text-xs ${cls}`} style={{ color: C.sub }}><span className="block mb-1">{rot}{dica && <span className="ml-1" style={{ color: "#98A2B3" }}>· {dica}</span>}</span>{children}</label>;
const Sec = ({ t, children }) => <div className="mb-4"><div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.navy }}>{t}</div><div className="grid grid-cols-4 gap-3">{children}</div></div>;

export default function Tributario({ user, tiposPeca = [] }) {
  const [aba, setAba] = useState("naturezas"), [d, setD] = useState(null), [erro, setErro] = useState(""), [nat, setNat] = useState(null);
  const carregar = () => fetch(`/api/tributario?u=${user.id}`).then((r) => r.json()).then((x) => { if (x.error) throw new Error(x.error); setD(x); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const post = async (acao, dados, extra = {}) => {
    const r = await fetch("/api/tributario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao, dados, ...extra }) });
    const x = await r.json().catch(() => ({})); if (!r.ok || x.error) { alerta(x.error || "Erro ao salvar."); return false; } carregar(); return true;
  };
  if (erro) return <div className="text-sm" style={{ color: C.red }}>{erro}</div>;
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  return (
    <div className="max-w-6xl">
      <p className="text-sm mb-4" style={{ color: C.sub }}>Dados fiscais que o sistema manda ao <b>Bling</b> para emitir a NF-e do pedido: o emitente, a <b>natureza de operação</b> (CFOP e tributação, escolhida pelo documento de entrega do pedido) e a <b>classificação fiscal</b> de cada tipo de peça (NCM, origem, unidade). Confira os impostos com a contabilidade.</p>
      <div className="flex gap-1 mb-4">
        {[["naturezas", "Naturezas de operação"], ["produtos", "Produtos (NCM)"], ["empresa", "Emitente"]].map(([k, t]) => <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm"
          style={{ background: aba === k ? C.accentSoft : C.panel, color: aba === k ? C.accent : C.sub, border: `1px solid ${aba === k ? C.accent : C.line}` }}>{t}</button>)}
      </div>
      {aba === "empresa" && <Empresa d={d} post={post} />}
      {aba === "produtos" && <Produtos d={d} post={post} tiposPeca={tiposPeca} />}
      {aba === "naturezas" && <>
        <div className="flex justify-end mb-2"><button onClick={() => setNat({ tipo: "SAIDA", finalidade: 1, presenca: 9 })} className="px-3 py-1.5 rounded-md text-sm font-semibold text-white flex items-center gap-1" style={{ background: C.accent }}><Plus size={14} /> Nova natureza</button></div>
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-left" style={{ background: C.panel2, color: C.sub }}><th className="px-3 py-2">Natureza de operação</th><th className="px-3 py-2">Uso no pedido</th><th className="px-3 py-2">CFOP (UF / fora)</th>
              <th className="px-3 py-2">ICMS</th><th className="px-3 py-2">PIS / COFINS</th><th className="px-3 py-2">Bling</th><th /></tr></thead>
            <tbody>{d.naturezas.map((n) => <tr key={n.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{n.padrao && <Star size={12} className="inline mr-1" style={{ color: C.accent }} fill={C.accent} />}{n.nome}<div className="text-[11px] font-normal" style={{ color: C.sub }}>{n.tipo === "ENTRADA" ? "entrada" : "saída"} · finalidade {n.finalidade}</div></td>
              <td className="px-3 py-2 text-xs">{d.usos[n.uso] || "—"}</td>
              <td className="px-3 py-2 text-xs">{n.cfopEstado || "—"} / {n.cfopForaEstado || "—"}</td>
              <td className="px-3 py-2 text-xs">{n.icmsCst ? `${n.icmsCst}${n.icmsAliquota != null ? ` · ${fmt(n.icmsAliquota)}%` : ""}` : <span style={{ color: C.red }}>a preencher</span>}</td>
              <td className="px-3 py-2 text-xs">{n.pisCst || "—"} / {n.cofinsCst || "—"}</td>
              <td className="px-3 py-2 text-xs">{n.blingId ? <span style={{ color: C.green }}>id {n.blingId}</span> : <span style={{ color: C.sub }}>sem id</span>}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap"><button onClick={() => setNat(n)} className="p-1" style={{ color: C.sub }} title="Editar"><Pencil size={14} /></button>
                <button onClick={async () => { if (await confirmar(`Excluir a natureza "${n.nome}"?`)) post("excluirNatureza", null, { id: n.id }); }} className="p-1" style={{ color: C.red }} title="Excluir"><Trash2 size={14} /></button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      {nat && <NaturezaForm n={nat} usos={d.usos} crt={d.empresa.crt} onClose={() => setNat(null)} onSalvar={async (x) => { if (await post("natureza", x)) setNat(null); }} />}
    </div>
  );
}

function NaturezaForm({ n, usos, crt, onClose, onSalvar }) {
  const [f, setF] = useState({ ...n, ...Object.fromEntries(["icmsAliquota", "icmsReducao", "icmsStAliquota", "ipiAliquota", "pisAliquota", "cofinsAliquota", "issAliquota"].map((k) => [k, fmt(n[k])])) });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const I = (k, props = {}) => <input value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inp} style={iS} {...props} />;
  const simples = crt === "1" || crt === "2" || crt === "4";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="w-full rounded-xl overflow-hidden flex flex-col" style={{ maxWidth: 900, maxHeight: "92vh", background: C.panel }}>
        <div className="flex items-center px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}><b className="flex-1" style={{ color: C.navy }}>{n.id ? "Editar natureza de operação" : "Nova natureza de operação"}</b><button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button></div>
        <div className="flex-1 overflow-y-auto p-5">
          <Sec t="Identificação">
            <Campo rot="Natureza de operação" cls="col-span-2">{I("nome", { placeholder: "VENDA DE PRODUÇÃO DO ESTABELECIMENTO" })}</Campo>
            <Campo rot="Tipo"><select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={inp} style={iS}><option value="SAIDA">Saída</option><option value="ENTRADA">Entrada</option></select></Campo>
            <Campo rot="Finalidade"><select value={f.finalidade} onChange={(e) => set("finalidade", Number(e.target.value))} className={inp} style={iS}>{FINALIDADE.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
            <Campo rot="Uso no pedido" dica="escolhe a natureza no faturamento" cls="col-span-2"><select value={f.uso || ""} onChange={(e) => set("uso", e.target.value)} className={inp} style={iS}><option value="">—</option>{Object.entries(usos).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
            <Campo rot="Padrão do uso"><label className="flex items-center gap-2 py-1.5 text-sm" style={{ color: C.text }}><input type="checkbox" checked={!!f.padrao} onChange={(e) => set("padrao", e.target.checked)} /> usar esta como padrão</label></Campo>
            <Campo rot="ID no Bling" dica="natureza cadastrada no Bling">{I("blingId", { placeholder: "ex.: 15102345" })}</Campo>
            <Campo rot="CFOP dentro do estado">{I("cfopEstado", { placeholder: "5101", maxLength: 4 })}</Campo>
            <Campo rot="CFOP fora do estado">{I("cfopForaEstado", { placeholder: "6101", maxLength: 4 })}</Campo>
            <Campo rot="Consumidor final"><label className="flex items-center gap-2 py-1.5 text-sm" style={{ color: C.text }}><input type="checkbox" checked={!!f.consumidorFinal} onChange={(e) => set("consumidorFinal", e.target.checked)} /> operação com consumidor final</label></Campo>
            <Campo rot="Presença do comprador"><select value={f.presenca} onChange={(e) => set("presenca", Number(e.target.value))} className={inp} style={iS}>{PRESENCA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
          </Sec>
          <Sec t={`ICMS ${simples ? "(Simples Nacional: CSOSN)" : "(CST)"}`}>
            <Campo rot={simples ? "CSOSN" : "CST"} dica={simples ? "ex.: 101, 102, 400, 500, 900" : "ex.: 00, 20, 40, 41, 90"}>{I("icmsCst")}</Campo>
            <Campo rot={simples ? "Alíquota do crédito (%)" : "Alíquota (%)"}>{I("icmsAliquota", { placeholder: "0,00" })}</Campo>
            <Campo rot="Redução da base (%)">{I("icmsReducao", { placeholder: "0,00" })}</Campo>
            <Campo rot="Alíquota ICMS ST (%)">{I("icmsStAliquota", { placeholder: "0,00" })}</Campo>
          </Sec>
          <Sec t="IPI">
            <Campo rot="CST IPI" dica="ex.: 50, 51, 52, 53, 99">{I("ipiCst")}</Campo>
            <Campo rot="Enquadramento">{I("ipiEnquadramento", { placeholder: "999" })}</Campo>
            <Campo rot="Alíquota IPI (%)">{I("ipiAliquota", { placeholder: "0,00" })}</Campo>
            <div />
          </Sec>
          <Sec t="PIS / COFINS">
            <Campo rot="CST PIS" dica="ex.: 01, 07, 49, 99">{I("pisCst")}</Campo>
            <Campo rot="Alíquota PIS (%)">{I("pisAliquota", { placeholder: "0,65" })}</Campo>
            <Campo rot="CST COFINS">{I("cofinsCst")}</Campo>
            <Campo rot="Alíquota COFINS (%)">{I("cofinsAliquota", { placeholder: "3,00" })}</Campo>
          </Sec>
          {f.uso === "SERVICO" && <Sec t="Serviço (NFS-e)"><Campo rot="Alíquota ISS (%)">{I("issAliquota", { placeholder: "2,00" })}</Campo></Sec>}
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.navy }}>Informações complementares</div>
          <textarea value={f.infoComplementar || ""} onChange={(e) => set("infoComplementar", e.target.value)} rows={3} placeholder="Texto que sai na NF com esta natureza (ex.: DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL…)" className={inp} style={{ ...iS, resize: "vertical" }} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
          <button onClick={() => onSalvar(f)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function Produtos({ d, post, tiposPeca }) {
  const tipos = [...new Set([...tiposPeca, "SERVIÇO", ...d.produtos.map((p) => p.tipoPeca)])];
  const [rows, setRows] = useState(() => Object.fromEntries(tipos.map((t) => [t, { tipoPeca: t, origem: 0, unidade: t === "SERVIÇO" ? "UN" : "PC", gtin: "SEM GTIN", ...(d.produtos.find((p) => p.tipoPeca === t) || {}) }])));
  const set = (t, k, v) => setRows((r) => ({ ...r, [t]: { ...r[t], [k]: v } }));
  const [st, setSt] = useState(false);
  const salvarTudo = async () => { setSt(true); for (const t of tipos) if (rows[t].ncm || rows[t].codigoServico || d.produtos.some((p) => p.tipoPeca === t)) { if (!(await post("produto", rows[t]))) break; } setSt(false); };
  return (
    <div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>Classificação fiscal por <b>tipo de peça</b> (o tipo escolhido em cada item do pedido). Ex.: camiseta de malha de algodão 6109.10.00 · de outras fibras 6109.90.00 — confirme com a contabilidade.</div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-left" style={{ background: C.panel2, color: C.sub }}><th className="px-3 py-2">Tipo de peça</th><th className="px-3 py-2">NCM</th><th className="px-3 py-2">CEST</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">GTIN/EAN</th><th className="px-3 py-2">Cód. serviço (LC 116)</th></tr></thead>
          <tbody>{tipos.map((t) => { const r = rows[t]; return (
            <tr key={t} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-3 py-1.5 font-semibold" style={{ color: C.navy }}>{t}</td>
              <td className="px-3 py-1.5"><input value={r.ncm || ""} onChange={(e) => set(t, "ncm", e.target.value)} placeholder={t === "SERVIÇO" ? "—" : "0000.00.00"} disabled={t === "SERVIÇO"} className={inp} style={iS} /></td>
              <td className="px-3 py-1.5"><input value={r.cest || ""} onChange={(e) => set(t, "cest", e.target.value)} disabled={t === "SERVIÇO"} className={inp} style={iS} /></td>
              <td className="px-3 py-1.5"><select value={r.origem} onChange={(e) => set(t, "origem", Number(e.target.value))} disabled={t === "SERVIÇO"} className={inp} style={iS}>{ORIGEM.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.unidade || ""} onChange={(e) => set(t, "unidade", e.target.value)} className={inp} style={{ ...iS, width: 70 }} /></td>
              <td className="px-3 py-1.5"><input value={r.gtin || ""} onChange={(e) => set(t, "gtin", e.target.value)} disabled={t === "SERVIÇO"} className={inp} style={iS} /></td>
              <td className="px-3 py-1.5"><input value={r.codigoServico || ""} onChange={(e) => set(t, "codigoServico", e.target.value)} disabled={t !== "SERVIÇO"} placeholder={t === "SERVIÇO" ? "ex.: 14.09" : ""} className={inp} style={iS} /></td>
            </tr>); })}</tbody>
        </table>
      </div>
      <div className="flex justify-end mt-3"><button disabled={st} onClick={salvarTudo} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.accent, opacity: st ? 0.6 : 1 }}>{st && <Loader2 size={14} className="animate-spin" />} Salvar classificação</button></div>
    </div>
  );
}

function Empresa({ d, post }) {
  const [f, setF] = useState(d.empresa);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const I = (k, props = {}) => <input value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inp} style={iS} {...props} />;
  return (
    <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <Sec t="Emitente">
        <Campo rot="Razão social" cls="col-span-2">{I("razaoSocial")}</Campo><Campo rot="CNPJ">{I("cnpj")}</Campo><Campo rot="Inscrição estadual">{I("ie")}</Campo>
        <Campo rot="Inscrição municipal" dica="NFS-e">{I("im")}</Campo>
        <Campo rot="Regime tributário (CRT)" cls="col-span-2"><select value={f.crt} onChange={(e) => set("crt", e.target.value)} className={inp} style={iS}>{CRT.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Campo>
        <Campo rot="Série da NF-e">{I("serie")}</Campo>
      </Sec>
      <Sec t="Endereço">
        <Campo rot="Logradouro" cls="col-span-2">{I("logradouro")}</Campo><Campo rot="Número">{I("numero")}</Campo><Campo rot="Bairro">{I("bairro")}</Campo>
        <Campo rot="Município">{I("municipio")}</Campo><Campo rot="UF">{I("uf", { maxLength: 2 })}</Campo><Campo rot="CEP">{I("cep")}</Campo><Campo rot="Código IBGE do município">{I("codigoMunicipio")}</Campo>
        <Campo rot="Telefone">{I("telefone")}</Campo><Campo rot="E-mail" cls="col-span-2">{I("email")}</Campo>
      </Sec>
      <Sec t="Bling">
        <Campo rot="Ambiente" cls="col-span-2"><select value={f.ambiente} onChange={(e) => set("ambiente", e.target.value)} className={inp} style={iS}><option value="HOMOLOGACAO">Homologação (teste, sem valor fiscal)</option><option value="PRODUCAO">Produção</option></select></Campo>
      </Sec>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.navy }}>Informações complementares padrão (todas as NFs)</div>
      <textarea value={f.infoComplementar || ""} onChange={(e) => set("infoComplementar", e.target.value)} rows={3} className={inp} style={{ ...iS, resize: "vertical" }} />
      <div className="flex justify-end mt-3"><button onClick={() => post("empresa", f)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Salvar emitente</button></div>
    </div>
  );
}
