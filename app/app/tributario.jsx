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
    <div className={aba === "produtos" || aba === "icms" ? "w-full" : "max-w-6xl"}>   {/* v679 — tabelas largas ocupam a página toda */}
      <p className="text-sm mb-4" style={{ color: C.sub }}>Dados fiscais que o sistema manda ao <b>Bling</b> para emitir a NF-e do pedido: o emitente, a <b>natureza de operação</b> (CFOP e tributação, escolhida pelo documento de entrega do pedido) e a <b>classificação fiscal</b> de cada tipo de peça (NCM, origem, unidade). Confira os impostos com a contabilidade.</p>
      <div className="flex gap-1 mb-4">
        {[["naturezas", "Naturezas de operação"], ["produtos", "Produtos (NCM)"], ["icms", "ICMS interestadual"], ["empresa", "Emitente"]].map(([k, t]) => <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm"
          style={{ background: aba === k ? C.accentSoft : C.panel, color: aba === k ? C.accent : C.sub, border: `1px solid ${aba === k ? C.accent : C.line}` }}>{t}</button>)}
      </div>
      {aba === "empresa" && <Empresa d={d} post={post} />}
      {aba === "produtos" && <Produtos d={d} post={post} tiposPeca={tiposPeca} />}
      {aba === "icms" && <IcmsInter d={d} />}
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

// v677 — classes de produto (NCM + tributação) da planilha NCM_Produtos; um NCM por classe (o tipo de peça do item)
function Produtos({ d, post, tiposPeca }) {
  const base = [...new Set([...d.produtos.map((p) => p.tipoPeca), ...tiposPeca, "SERVIÇO"])];
  const [extras, setExtras] = useState([]);
  const tipos = [...base, ...extras.filter((x) => !base.includes(x))];
  const vazio = (t) => ({ tipoPeca: t, origem: 0, unidade: t === "SERVIÇO" ? "UN" : "PC", gtin: "SEM GTIN" });
  const [rows, setRows] = useState(() => Object.fromEntries(base.map((t) => [t, { ...vazio(t), ...(d.produtos.find((p) => p.tipoPeca === t) || {}) }])));
  const set = (t, k, v) => setRows((r) => ({ ...r, [t]: { ...(r[t] || vazio(t)), [k]: v } }));
  const [nova, setNova] = useState("");
  const [st, setSt] = useState(false);
  const salvarTudo = async () => { setSt(true); for (const t of tipos) { const r = rows[t] || vazio(t); if (r.ncm || r.codigoServico || d.produtos.some((p) => p.tipoPeca === t)) { if (!(await post("produto", { ...r, tipoPeca: t }))) break; } } setSt(false); };
  const fNcm = (n) => { const x = String(n || "").replace(/\D/g, ""); return x.length === 8 ? `${x.slice(0, 4)}.${x.slice(4, 6)}.${x.slice(6)}` : n || ""; };
  const pequeno = { ...iS, padding: "4px 6px" };
  return (
    <div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>Um NCM por <b>classe</b> de produto (o tipo de peça escolhido no item do pedido), com a tributação de cada uma — base para as naturezas de operação. Referência: planilha <b>NCM Produtos</b> (ICMS: CST 00 = tributado integralmente, alíquota 18% em MG, interestadual pela tabela · PIS/COFINS lucro presumido: CST 01 = alíquota básica, 0,65% e 3% · IPI: CST 51 = saída tributada com alíquota zero, alíquota 0%). CST é o código da situação tributária, não percentual..</div>
      <div className="rounded-lg overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs">
          <thead><tr className="text-left align-bottom" style={{ background: C.panel2, color: C.sub }}>
            {["Classe", "O que entra", "NCM", "CEST", "Origem", "Unid.", "GTIN", "ICMS · CST (cód.)", "ICMS · alíq. MG %", "PIS/COFINS · CST (cód.)", "PIS · alíq. %", "COFINS · alíq. %", "IPI · CST (cód.)", "IPI · alíq. %", "Cód. serviço"].map((h) => <th key={h} className="px-2 py-2 leading-tight" style={{ maxWidth: 90 }}>{h}</th>)}
          </tr></thead>
          <tbody>{tipos.map((t) => { const r = rows[t] || vazio(t); const sv = t === "SERVIÇO"; const I = (k, w = 70, props = {}) => <input value={r[k] ?? ""} onChange={(e) => set(t, k, e.target.value)} className="rounded outline-none text-xs" style={{ ...pequeno, width: w }} {...props} />;
            return (
            <tr key={t} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-2 py-1 font-semibold whitespace-nowrap" style={{ color: C.navy }}>{t}{tiposPeca.includes(t) && <span className="ml-1 text-[9px] px-1 rounded" style={{ background: C.accentSoft, color: C.accent }} title="Tipo de peça usado no lançamento de pedido">peça</span>}</td>
              <td className="px-2 py-1" style={{ minWidth: 300 }}><input value={r.descricao ?? ""} onChange={(e) => set(t, "descricao", e.target.value)} title={r.descricao || ""} className="rounded outline-none text-xs w-full" style={pequeno} /></td>   {/* v680 — campo largo */}
              <td className="px-2 py-1"><input value={fNcm(r.ncm)} onChange={(e) => set(t, "ncm", e.target.value)} disabled={sv} placeholder={sv ? "—" : "0000.00.00"} className="rounded outline-none text-xs tabular-nums" style={{ ...pequeno, width: 108 }} /></td>
              <td className="px-2 py-1">{I("cest", 64, { disabled: sv })}</td>
              <td className="px-2 py-1"><select value={r.origem ?? 0} onChange={(e) => set(t, "origem", Number(e.target.value))} disabled={sv} className="rounded outline-none text-xs" style={{ ...pequeno, width: 96 }}>{ORIGEM.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select></td>
              <td className="px-2 py-1">{I("unidade", 44)}</td>
              <td className="px-2 py-1">{I("gtin", 72, { disabled: sv })}</td>
              <td className="px-2 py-1">{I("icmsCst", 40)}</td>
              <td className="px-2 py-1">{I("icmsAliquotaInterna", 44)}</td>
              <td className="px-2 py-1">{I("pisCofinsCst", 40)}</td>
              <td className="px-2 py-1">{I("pisAliquota", 48)}</td>
              <td className="px-2 py-1">{I("cofinsAliquota", 44)}</td>
              <td className="px-2 py-1">{I("ipiCst", 40)}</td>
              <td className="px-2 py-1">{I("ipiAliquota", 40)}</td>
              <td className="px-2 py-1">{I("codigoServico", 60, { disabled: !sv, placeholder: sv ? "ex.: 14.09" : "" })}</td>
            </tr>); })}</tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input value={nova} onChange={(e) => setNova(e.target.value.toUpperCase())} placeholder="nova classe (ex.: COLETE)" className="rounded-lg outline-none text-sm px-2 py-1.5" style={{ ...iS, width: 220 }} />
        <button onClick={() => { const n = nova.trim(); if (n && !tipos.includes(n)) { setExtras((x) => [...x, n]); setRows((r) => ({ ...r, [n]: { ...vazio(n), icmsCst: "00", icmsAliquotaInterna: 18, pisCofinsCst: "01", pisAliquota: 0.65, cofinsAliquota: 3, ipiCst: "51", ipiAliquota: 0 } })); } setNova(""); }} className="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Classe</button>
        <span className="flex-1" />
        <button disabled={st} onClick={salvarTudo} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.accent, opacity: st ? 0.6 : 1 }}>{st && <Loader2 size={14} className="animate-spin" />} Salvar classes</button>
      </div>
    </div>
  );
}

// v677 — tabela de alíquotas de ICMS nas operações interestaduais (origem × destino); diagonal = alíquota interna
function IcmsInter({ d }) {
  const T = d.icmsInterestadual || {};
  const ufs = Object.keys(T);
  const [orig, setOrig] = useState("MG");
  return (
    <div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>ICMS nas operações interestaduais (%) · linha = estado de <b>origem</b>, coluna = <b>destino</b>; a diagonal é a alíquota interna. <b>Verifique em cada estado a incidência do FCP</b> (Fundo de Combate à Pobreza). Destaque: saídas de <b>{orig}</b>.</div>
      <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: C.sub }}>Origem em destaque <select value={orig} onChange={(e) => setOrig(e.target.value)} className="rounded outline-none text-xs px-1 py-0.5" style={iS}>{ufs.map((u) => <option key={u}>{u}</option>)}</select></div>
      <div className="rounded-lg overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="text-[11px] tabular-nums">
          <thead><tr style={{ background: C.panel2, color: C.sub }}><th className="px-1.5 py-1 sticky left-0" style={{ background: C.panel2 }}>orig.\dest.</th>{ufs.map((u) => <th key={u} className="px-1.5 py-1">{u}</th>)}</tr></thead>
          <tbody>{ufs.map((o) => <tr key={o} style={{ borderTop: `1px solid ${C.line}`, background: o === orig ? C.accentSoft : undefined }}>
            <td className="px-1.5 py-1 font-bold sticky left-0" style={{ color: C.navy, background: o === orig ? C.accentSoft : C.panel }}>{o}</td>
            {ufs.map((x) => <td key={x} className="px-1.5 py-1 text-center" style={{ fontWeight: o === x ? 700 : 400, color: o === x ? C.navy : C.text }}>{fmt(T[o][x])}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
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
