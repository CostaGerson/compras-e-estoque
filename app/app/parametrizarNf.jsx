"use client";
// v619 — parametrização da NF de compra: cada item da NF → artigo interno (dados do cadastro) e entrada no estoque.
// A equivalência (fornecedor + nome na NF → artigo interno) fica salva para as próximas NFs.
import React, { useEffect, useState } from "react";
import { Loader2, X, PackageCheck, Link2 } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", navy: "#001E41", red: "#D92D20" };
const CATS = [["MALHA", "Malha"], ["TECIDO", "Tecido"], ["AVIAMENTO", "Aviamento"], ["OUTROS", "Outros"]];
const UNS = ["M", "KG", "UN", "PC", "CM"];
const ORIGEM = { EQUIVALENCIA: ["equivalência salva", C.green, C.greenSoft], ARTIGO: ["artigo já cadastrado", C.blue, C.blueSoft], NF: ["novo · dados da NF", C.sub, C.panel2] };
const nomeF = (f) => f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}`;
const fmt = (v) => (v == null ? "" : String(v).replace(".", ","));

const Campo = ({ rot, children, cls = "" }) => <label className={`block text-xs ${cls}`} style={{ color: C.sub }}><span className="block mb-1">{rot}</span>{children}</label>;

export default function ParametrizarNf({ user, id, onFim }) {
  const [d, setD] = useState(null), [erro, setErro] = useState(""), [forns, setForns] = useState([]), [st, setSt] = useState(false), [fim, setFim] = useState(null);
  useEffect(() => {
    fetch(`/api/fiscal/estoque?u=${user.id}&id=${id}`).then((r) => r.json()).then((x) => { if (x.error) throw new Error(x.error);
      setD({ ...x, itens: x.itens.map((it) => ({ ...it, dados: { ...it.dados, quantidade: fmt(it.dados.quantidade), largura: fmt(it.dados.largura), gramatura: fmt(it.dados.gramatura), valorUnitario: fmt(it.dados.valorUnitario) } })) }); })
      .catch((e) => setErro(e.message));
    fetch("/api/fornecedores").then((r) => r.json()).then((x) => setForns(Array.isArray(x) ? x : [])).catch(() => {});
  }, [id]);
  const set = (i, k, v) => setD((s) => ({ ...s, itens: s.itens.map((it, j) => (j === i ? { ...it, dados: { ...it.dados, [k]: v } } : it)) }));
  const enviar = async (dispensar) => {
    if (dispensar && !(await confirmar("Dispensar a parametrização? Os itens entram no estoque com o nome da NF como artigo interno (nada é salvo como equivalência).")))
      return;
    setSt(true);
    const r = await fetch("/api/fiscal/estoque", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, id, dispensar, itens: d.itens.map((it) => ({ idx: it.idx, dados: it.dados })) }) });
    const x = await r.json().catch(() => ({})); setSt(false);
    if (!r.ok || x.error) return alerta(x.error || "Não foi possível dar entrada no estoque.");
    setFim(x);
  };
  const inp = "w-full px-2 py-1.5 rounded-lg outline-none text-sm";
  const iS = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="w-full rounded-xl overflow-hidden flex flex-col anim-modal" style={{ maxWidth: 980, maxHeight: "92vh", background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <PackageCheck size={18} style={{ color: C.accent }} />
          <div className="flex-1 min-w-0"><div className="font-semibold" style={{ color: C.navy }}>Parametrização da NF{d ? ` ${d.numero}` : ""} · entrada no estoque</div>
            {d && <div className="text-xs truncate" style={{ color: C.sub }}>{d.parceiro}{d.emissao ? ` · emissão ${String(d.emissao).slice(0, 10).split("-").reverse().join("/")}` : ""} · {d.itens.length} item(ns)</div>}</div>
          <button onClick={() => onFim(fim)} style={{ color: C.sub }} title="Fechar (a NF fica pendente)"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F7F8FA" }}>
          {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
          {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Lendo os itens da NF…</div>}
          {fim && <div className="rounded-lg p-4 text-sm" style={{ background: C.greenSoft, color: C.text }}>
            {fim.jaNoEstoque ? <b>Esta NF já tinha dado entrada no estoque (importada pela tela de Estoque).</b> : <>
              <b style={{ color: C.green }}>✓ Entrada no estoque feita.</b> {fim.criados} artigo(s) novo(s) · {fim.somados} somado(s) a artigos iguais já existentes{fim.equivalencias ? ` · ${fim.equivalencias} equivalência(s) salva(s) para as próximas NFs` : ""}.
              <div className="mt-2 text-xs space-y-0.5">{(fim.detalhe || []).map((x, k) => <div key={k}>{x.situacao === "IGNORADO" ? "—" : x.situacao === "SOMADO" ? "＋" : "•"} {x.xProd}{x.artigoInterno ? <> → <b>{x.artigoInterno}</b> · {fmt(x.quantidade)} {String(x.unidade || "").toLowerCase()}</> : ` (${x.situacao.toLowerCase()})`}{x.situacao === "SOMADO" ? " (somado)" : ""}</div>)}</div></>}
          </div>}
          {d && !fim && d.estoqueStatus === "LANCADO" && <div className="text-sm" style={{ color: C.sub }}>Esta NF já deu entrada no estoque.</div>}
          {d && !fim && d.estoqueStatus !== "LANCADO" && d.itens.map((it, i) => {
            const v = it.dados, [ot, oc, of] = ORIGEM[it.origem] || ORIGEM.NF;
            return (
              <div key={it.idx} className="rounded-xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}`, opacity: v.ignorar ? 0.55 : 1 }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold rounded-full flex items-center justify-center" style={{ width: 20, height: 20, background: C.navy, color: "#fff" }}>{i + 1}</span>
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: C.text }} title={it.xProd}>{it.xProd}{it.cProd ? <span className="font-normal" style={{ color: C.sub }}> · cód. {it.cProd}</span> : null}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: of, color: oc }}>{it.origem === "EQUIVALENCIA" && <Link2 size={11} />}{ot}</span>
                  <label className="text-[11px] flex items-center gap-1 cursor-pointer" style={{ color: C.sub }}><input type="checkbox" checked={!!v.ignorar} onChange={(e) => set(i, "ignorar", e.target.checked)} /> não entra no estoque</label>
                </div>
                {!v.ignorar && <>
                  <div className="flex gap-1 mb-3">{CATS.map(([k, t]) => <button key={k} type="button" onClick={() => set(i, "categoria", k)} className="px-3 py-1.5 rounded-lg text-sm"
                    style={v.categoria === k ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}`, fontWeight: 600 } : { background: C.panel2, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>)}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <Campo rot="Fornecedor"><select value={v.fornecedorId || ""} onChange={(e) => set(i, "fornecedorId", Number(e.target.value) || null)} className={inp} style={iS}>
                      {!forns.some((f) => f.id === v.fornecedorId) && v.fornecedorId && <option value={v.fornecedorId}>{d.fornecedor ? nomeF(d.fornecedor) : `#${v.fornecedorId}`}</option>}
                      {forns.map((f) => <option key={f.id} value={f.id}>{nomeF(f)}</option>)}</select></Campo>
                    <Campo rot="Artigo NF (vem da nota)"><div className={inp} style={{ ...iS, color: C.sub }} title={it.xProd}><span className="block truncate">{it.xProd}</span></div></Campo>
                    <Campo rot="Artigo interno"><input value={v.artigoInterno || ""} onChange={(e) => set(i, "artigoInterno", e.target.value)} className={inp} style={{ ...iS, background: "#fff", borderColor: C.accent + "88" }} /></Campo>
                    <Campo rot="Cor"><input value={v.cor || ""} onChange={(e) => set(i, "cor", e.target.value)} className={inp} style={iS} /></Campo>
                    <Campo rot="Código"><input value={v.codigo || ""} onChange={(e) => set(i, "codigo", e.target.value)} className={inp} style={iS} /></Campo>
                    <Campo rot="Quantidade"><div className="flex gap-1"><input value={v.quantidade} onChange={(e) => set(i, "quantidade", e.target.value)} className={inp} style={iS} />
                      <select value={v.unidade} onChange={(e) => set(i, "unidade", e.target.value)} className="px-1 rounded-lg text-sm outline-none" style={iS}>{UNS.map((u) => <option key={u}>{u}</option>)}</select></div></Campo>
                    <Campo rot="Composição"><input value={v.composicao || ""} onChange={(e) => set(i, "composicao", e.target.value)} className={inp} style={iS} /></Campo>
                    <Campo rot="Largura (m)"><input value={v.largura} onChange={(e) => set(i, "largura", e.target.value)} className={inp} style={iS} /></Campo>
                    <Campo rot="Gramatura (g/m²)"><input value={v.gramatura} onChange={(e) => set(i, "gramatura", e.target.value)} className={inp} style={iS} /></Campo>
                    <Campo rot="Preço (R$)"><input value={v.valorUnitario} onChange={(e) => set(i, "valorUnitario", e.target.value)} className={inp} style={iS} /></Campo>
                  </div>
                </>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {fim ? <><span className="flex-1" /><button onClick={() => onFim(fim)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Fechar</button></> : <>
            <button disabled={!d || st || d?.estoqueStatus === "LANCADO"} onClick={() => enviar(true)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub, border: `1px solid ${C.line}`, background: C.panel }}
              title="Entra no estoque com o nome da NF como artigo interno">Dispensar parametrização</button>
            <span className="flex-1 text-[11px]" style={{ color: C.sub }}>Artigo igual já no estoque (categoria, fornecedor, artigo interno, cor, código, unidade e largura) soma a quantidade.</span>
            <button onClick={() => onFim(null)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Depois</button>
            <button disabled={!d || st || d?.estoqueStatus === "LANCADO"} onClick={() => enviar(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.accent, opacity: st ? 0.6 : 1 }}>
              {st && <Loader2 size={14} className="animate-spin" />} Salvar e dar entrada no estoque</button>
          </>}
        </div>
      </div>
    </div>
  );
}
