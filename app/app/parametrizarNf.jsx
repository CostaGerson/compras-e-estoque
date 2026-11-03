"use client";
// v619 — parametrização da NF de compra: cada item da NF → artigo interno (dados do cadastro) e entrada no estoque.
// A equivalência (fornecedor + nome na NF → artigo interno) fica salva para as próximas NFs.
import React, { useEffect, useState } from "react";
import { Loader2, X, PackageCheck, Link2 } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";
import { SeletorTipo, ehCategoriaTipo, sugerirTipo, carregarTipos } from "./artigosInternos";   // v625

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", navy: "#001E41", red: "#D92D20" };
const CATS = [["MALHA", "Malha"], ["TECIDO", "Tecido"], ["AVIAMENTO", "Aviamento"], ["OUTROS", "Outros"]];
const UNS = ["M", "KG", "UN", "PC", "CM"];
const ORIGEM = { EQUIVALENCIA: ["equivalência salva", C.green, C.greenSoft], ARTIGO: ["artigo já cadastrado", C.blue, C.blueSoft], NF: ["novo · dados da NF", C.sub, C.panel2] };
const nomeF = (f) => f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}`;
const fmt = (v) => (v == null ? "" : String(v).replace(".", ","));

const Campo = ({ rot, children, cls = "" }) => <label className={`block text-xs ${cls}`} style={{ color: C.sub }}><span className="block mb-1">{rot}</span>{children}</label>;

export default function ParametrizarNf({ user, id, onFim }) {
  const [d, setD] = useState(null), [erro, setErro] = useState(""), [forns, setForns] = useState([]), [st, setSt] = useState(false), [fim, setFim] = useState(null), [vols, setVols] = useState(false);
  useEffect(() => {
    fetch(`/api/fiscal/estoque?u=${user.id}&id=${id}`).then((r) => r.json()).then((x) => { if (x.error) throw new Error(x.error);
      // v625 — malha/tecido: o artigo interno vira o TIPO (sugerido pelo nome da NF se ainda não for um tipo)
      carregarTipos().then((tipos) => setD((s) => s && ({ ...s, itens: s.itens.map((it) => ehCategoriaTipo(it.dados.categoria) && !tipos.some((t) => t.categoria === it.dados.categoria && t.nome === it.dados.artigoInterno)
        ? { ...it, dados: { ...it.dados, artigoInterno: sugerirTipo(it.dados.artigoInterno, it.dados.categoria, tipos) || sugerirTipo(it.xProd, it.dados.categoria, tipos) || it.dados.artigoInterno } } : it) })));
      setD({ ...x, itens: x.itens.map((it) => ({ ...it, dados: { ...it.dados, quantidade: fmt(it.dados.quantidade), largura: fmt(it.dados.largura), gramatura: fmt(it.dados.gramatura), valorUnitario: fmt(it.dados.valorUnitario) } })) }); })
      .catch((e) => setErro(e.message));
    fetch("/api/fornecedores").then((r) => r.json()).then((x) => setForns(Array.isArray(x) ? x : [])).catch(() => {});
  }, [id]);
  const set = (i, k, v) => setD((s) => ({ ...s, itens: s.itens.map((it, j) => (j === i ? { ...it, dados: { ...it.dados, [k]: v } } : it)) }));
  const enviar = async (dispensar) => {
    // v625 — malha/tecido: artigo interno precisa ser um dos tipos (Cadastros › Artigos › Artigos internos)
    if (!dispensar) {
      const tipos = await carregarTipos();
      const fora = d.itens.filter((it) => !it.dados.ignorar && ehCategoriaTipo(it.dados.categoria) && !tipos.some((t) => t.categoria === it.dados.categoria && t.nome === it.dados.artigoInterno));
      if (fora.length) return alerta(`Escolha o tipo (artigo interno) de: ${fora.map((it) => it.xProd).join("; ")}.`);
    }
    if (dispensar && !(await confirmar("Dispensar a parametrização? Os itens entram no estoque com o nome da NF como artigo interno (nada é salvo como equivalência).")))
      return;
    setSt(true);
    const r = await fetch("/api/fiscal/estoque", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, id, dispensar, itens: d.itens.map((it) => ({ idx: it.idx, dados: it.dados })) }) });
    const x = await r.json().catch(() => ({})); setSt(false);
    if (!r.ok || x.error) return alerta(x.error || "Não foi possível dar entrada no estoque.");
    setFim(x);
  };
  if (vols) return <VolumesNf user={user} id={id} onFim={() => onFim(fim)} />;   // v620
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
                  <div className="flex gap-1 mb-3">{CATS.map(([k, t]) => <button key={k} type="button" onClick={async () => { set(i, "categoria", k); if (ehCategoriaTipo(k)) { const tipos = await carregarTipos();
                      if (!tipos.some((t) => t.categoria === k && t.nome === v.artigoInterno)) set(i, "artigoInterno", sugerirTipo(it.xProd, k, tipos) || ""); } }} className="px-3 py-1.5 rounded-lg text-sm"
                    style={v.categoria === k ? { background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}`, fontWeight: 600 } : { background: C.panel2, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>)}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <Campo rot="Fornecedor"><select value={v.fornecedorId || ""} onChange={(e) => set(i, "fornecedorId", Number(e.target.value) || null)} className={inp} style={iS}>
                      {!forns.some((f) => f.id === v.fornecedorId) && v.fornecedorId && <option value={v.fornecedorId}>{d.fornecedor ? nomeF(d.fornecedor) : `#${v.fornecedorId}`}</option>}
                      {forns.map((f) => <option key={f.id} value={f.id}>{nomeF(f)}</option>)}</select></Campo>
                    <Campo rot="Artigo NF (vem da nota)"><div className={inp} style={{ ...iS, color: C.sub }} title={it.xProd}><span className="block truncate">{it.xProd}</span></div></Campo>
                    <Campo rot={ehCategoriaTipo(v.categoria) ? `Artigo interno (tipo de ${v.categoria === "MALHA" ? "malha" : "plano"})` : "Artigo interno"}>{ehCategoriaTipo(v.categoria)
                      ? <SeletorTipo categoria={v.categoria} valor={v.artigoInterno} onChange={(x) => set(i, "artigoInterno", x)} className={inp} style={{ ...iS, background: "#fff", borderColor: C.accent + "88" }} />
                      : <input value={v.artigoInterno || ""} onChange={(e) => set(i, "artigoInterno", e.target.value)} className={inp} style={{ ...iS, background: "#fff", borderColor: C.accent + "88" }} />}</Campo>
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
          {fim ? <><span className="flex-1" /><button onClick={() => onFim(fim)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Fechar</button>
            {!fim.jaNoEstoque && <button onClick={() => setVols(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Identificar volumes e imprimir etiquetas</button>}</> : <>
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

// v620 — identificação de volumes da NF: cada item com "+" para adicionar etiqueta (quantidade do volume) e impressão na Zebra
export function VolumesNf({ user, id, onFim }) {
  const [d, setD] = useState(null), [erro, setErro] = useState(""), [ets, setEts] = useState([]), [st, setSt] = useState(false);
  const [tam, setTam] = useState(() => { try { return localStorage.getItem("ce_etiqueta_tam") || "100x60"; } catch { return "100x60"; } });
  const carregar = () => fetch(`/api/fiscal/estoque?u=${user.id}&volumes=${id}`).then((r) => r.json()).then((x) => { if (x.error) throw new Error(x.error); setD(x);
    setEts(x.volumes.map((v) => ({ ...v, quantidade: fmt(v.quantidade) }))); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [id]);
  const n = (v) => { const t = String(v ?? "").trim(); return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0; };
  const somaDe = (aid) => ets.filter((e) => e.artigoId === aid).reduce((s, e) => s + n(e.quantidade), 0);
  const mais = async (it) => {
    // v623 — passou dos volumes da NF: aviso + justificativa escrita obrigatória
    let justificativa = null;
    if (d?.qVol && ets.length >= d.qVol) {
      let j = await perguntar(`A NF ${d.numero} tem ${d.qVol} volume(s) e já há ${ets.length} etiqueta(s).\nPara criar mais uma etiqueta, escreva a justificativa:`, "");
      while (j !== null && String(j).trim().length < 5) j = await perguntar("A justificativa precisa ter pelo menos 5 letras. Por que há mais volumes que os da NF?", j || "");
      if (j === null) return;
      justificativa = String(j).trim();
    }
    const resto = Math.max(0, it.quantidade - somaDe(it.artigoId));
    setEts((l) => [...l, { tmp: Math.random(), artigoId: it.artigoId, quantidade: fmt(Math.round(resto * 1000) / 1000), unidade: it.unidade, justificativa }]);
  };
  const imprimir = async () => {
    setSt(true);
    const r = await fetch("/api/fiscal/estoque", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "volumes", id, etiquetas: ets }) });
    const x = await r.json().catch(() => ({})); setSt(false);
    if (!r.ok || x.error) return alerta(x.error || "Não foi possível salvar as etiquetas.");
    setD(x); setEts(x.volumes.map((v) => ({ ...v, quantidade: fmt(v.quantidade) })));
    if (!x.volumes.length) return alerta("Adicione ao menos uma etiqueta (botão + do item).");
    try { localStorage.setItem("ce_etiqueta_tam", tam); } catch {}
    const porArt = Object.fromEntries(x.itens.map((i) => [i.artigoId, i]));
    const { imprimirEtiquetas } = await import("./etiquetaZebra");
    imprimirEtiquetas(x.volumes.map((v, k) => { const a = porArt[v.artigoId] || {}; return { codigo: v.codigo, artigoInterno: a.artigoInterno, cor: a.cor, codigoArtigo: a.codigo, largura: a.largura,
      composicao: a.composicao, quantidade: v.quantidade, unidade: v.unidade, nfNumero: x.numero, fornecedor: a.fornecedor, entrada: v.entradaEm || x.entrada, ordem: k + 1, total: x.volumes.length }; }), { tamanho: tam });
  };
  const inp = "px-2 py-1 rounded-lg outline-none text-sm text-right";
  const iS = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="w-full rounded-xl overflow-hidden flex flex-col anim-modal" style={{ maxWidth: 820, maxHeight: "92vh", background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <PackageCheck size={18} style={{ color: C.accent }} />
          <div className="flex-1 min-w-0"><div className="font-semibold" style={{ color: C.navy }}>Identificação de volumes{d ? ` · NF ${d.numero}` : ""}</div>
            {d && <div className="text-xs" style={{ color: C.sub }}>{d.parceiro} · {d.qVol ? <b style={{ color: ets.length === d.qVol ? C.green : C.accent }}>{d.qVol} volume(s) na NF{d.especie ? ` (${String(d.especie).toLowerCase()})` : ""}</b> : "a NF não informa os volumes"} · {ets.length} etiqueta(s)</div>}</div>
          <button onClick={() => onFim()} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F7F8FA" }}>
          {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
          {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
          {d && !d.itens.length && <div className="text-sm" style={{ color: C.sub }}>A NF ainda não deu entrada no estoque: faça a parametrização primeiro.</div>}
          {d && d.itens.map((it) => {
            const minhas = ets.map((e, k) => [e, k]).filter(([e]) => e.artigoId === it.artigoId), soma = somaDe(it.artigoId), dif = Math.round((it.quantidade - soma) * 1000) / 1000;
            return (
              <div key={it.nfItemId} className="rounded-xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: C.navy }}>{it.artigoInterno}</div>
                    <div className="text-xs" style={{ color: C.sub }}>{[it.cor, it.codigo && `cód. ${it.codigo}`, it.largura && `larg. ${fmt(it.largura)} m`].filter(Boolean).join(" · ") || "—"} · NF: {it.descricaoNf}</div>
                  </div>
                  <div className="text-right text-xs" style={{ color: C.sub }}>total <b style={{ color: C.text }}>{fmt(it.quantidade)} {String(it.unidade).toLowerCase()}</b>
                    <div style={{ color: Math.abs(dif) < 0.001 ? C.green : C.accent }}>{minhas.length ? (Math.abs(dif) < 0.001 ? "✓ etiquetado" : dif > 0 ? `faltam ${fmt(dif)}` : `sobra ${fmt(-dif)}`) : "sem etiqueta"}</div></div>
                  <button onClick={() => mais(it)} title="Adicionar etiqueta (um volume)" className="flex items-center justify-center rounded-lg text-white font-bold" style={{ width: 34, height: 34, background: C.accent, fontSize: 20 }}>+</button>
                </div>
                {minhas.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                  {minhas.map(([e, k], j) => <div key={e.id || e.tmp} className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ border: `1px dashed ${C.line}`, background: C.panel2 }}>
                    <span className="text-[11px] font-semibold" style={{ color: e.justificativa ? C.accent : C.sub }} title={e.justificativa ? `Além dos volumes da NF: ${e.justificativa}` : ""}>{e.codigo || `vol. ${j + 1}`}{e.justificativa ? " *" : ""}</span>
                    <input value={e.quantidade} onChange={(ev) => setEts((l) => l.map((x, m) => (m === k ? { ...x, quantidade: ev.target.value } : x)))} className={`${inp} w-20`} style={iS} />
                    <span className="text-xs" style={{ color: C.sub }}>{String(e.unidade).toLowerCase()}</span>
                    <button onClick={() => setEts((l) => l.filter((_, m) => m !== k))} style={{ color: C.sub }} title="Tirar"><X size={13} /></button>
                  </div>)}
                </div>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <label className="text-xs flex items-center gap-1" style={{ color: C.sub }}>Etiqueta
            <select value={tam} onChange={(e) => setTam(e.target.value)} className="px-2 py-1 rounded-lg text-sm outline-none" style={iS}>{["100x60", "100x50", "100x75", "100x150", "80x50"].map((t) => <option key={t} value={t}>{t.replace("x", " × ")} mm</option>)}</select></label>
          <span className="flex-1" />
          <button onClick={() => onFim()} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Fechar</button>
          <button disabled={!d || st} onClick={imprimir} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.accent, opacity: st ? 0.6 : 1 }}>
            {st && <Loader2 size={14} className="animate-spin" />} Salvar e imprimir {ets.length || ""} etiqueta(s)</button>
        </div>
      </div>
    </div>
  );
}
