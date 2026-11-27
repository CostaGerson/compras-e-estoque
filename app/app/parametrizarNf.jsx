"use client";
// v619 — parametrização da NF de compra: cada item da NF → artigo interno (dados do cadastro) e entrada no estoque.
// A equivalência (fornecedor + nome na NF → artigo interno) fica salva para as próximas NFs.
import React, { useEffect, useState } from "react";
import { Loader2, X, PackageCheck, Link2, ExternalLink } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";
import { Campo as MCampo, Inp, Opcoes, InpSugest, FornecedorBusca } from "./estoqueManual";   // v1157 — mesmos campos da entrada manual

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", navy: "#001E41", red: "#D92D20" };
const CATS = [["MALHA", "Malha"], ["TECIDO", "Tecido"], ["AVIAMENTO", "Aviamento"], ["OUTROS", "Outros"]];
const UNS = ["M", "KG", "UN", "PC", "CM"];
const ORIGEM = { EQUIVALENCIA: ["equivalência salva", C.green, C.greenSoft], ARTIGO: ["artigo já cadastrado", C.blue, C.blueSoft], NF: ["novo · dados da NF", C.sub, C.panel2] };
const nomeF = (f) => f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}`;
const fmt = (v) => (v == null ? "" : String(v).replace(".", ","));

const Campo = ({ rot, children, cls = "" }) => <label className={`block text-xs ${cls}`} style={{ color: C.sub }}><span className="block mb-1">{rot}</span>{children}</label>;

// v1157 — cada item da NF é vinculado ao artigo interno no MESMO card da entrada manual de estoque, já preenchido
// com os dados da NF; o catálogo (cartelas do fornecedor e do grupo dele) sugere o artigo e completa largura, gramatura e composição.
const TIPOS = ["MALHA", "TECIDO", "AVIAMENTO", "INSUMOS SILK", "INSUMOS SUBLIMAÇÃO", "INSUMOS DTF", "INSUMOS BORDADO", "PEÇAS PRONTAS", "OUTROS"];
const UNS_NF = ["M", "KG", "UN", "PC", "CM", "L", "CONE", "PCT"];
const catDoTipo = (t) => (t === "MALHA" ? "MALHA" : t === "TECIDO" ? "TECIDO" : t === "AVIAMENTO" ? "AVIAMENTO" : "OUTROS");
const TECIDOS_STD = ["BRIM LEVE", "BRIM PESADO", "BRIM MISTO LEVE", "BRIM MISTO PESADO", "BRIM NÃO IDENTIFICADO", "RIPSTOP", "OXFORD", "GABARDINE", "TACTEL", "CAMISARIA", "NYLON PARAQUEDAS",
  "NYLON IMPERMEÁVEL", "TACTEL REPELENTE À ÁGUA", "TWO WAY", "MATELASSÊ", "BEMBER", "AMERICANO CRU", "ECOBAG", "JEANS"];
// v1159 — vínculo antigo de tecido sem o tipo: o nome salvo vira o tipo (ou OUTROS, mantendo o nome)
const tecidoDe = (dd, tipo) => (tipo !== "TECIDO" || dd.tipoTecido ? dd.tipoTecido || "" : dd.artigoInterno ? (TECIDOS_STD.includes(String(dd.artigoInterno).toUpperCase()) ? String(dd.artigoInterno).toUpperCase() : "OUTROS") : "");
const tipoDaCat = (c) => (c === "MALHA" || c === "TECIDO" || c === "AVIAMENTO" ? c : "");
const faltasItem = (v) => [!v.tipoEstoque && "tipo", v.tipoEstoque === "TECIDO" && !v.tipoTecido && "nome do tecido", !String(v.artigoInterno || "").trim() && "nome do artigo",
  !String(v.cor || "").trim() && "cor", !v.fornecedorId && "fornecedor", !(Number(String(v.quantidade || "").replace(",", ".")) > 0) && "quantidade"].filter(Boolean);
const linhaCat = (c) => [c.cor, c.codigo && `cód. ${c.codigo}`, c.largura && `${fmt(c.largura)} m`, c.gramatura && `${fmt(c.gramatura)} g/m²`, c.composicao].filter(Boolean).join(" · ");

function CatalogoItem({ user, it, v, onUsar }) {
  const [q, setQ] = useState(""), [todos, setTodos] = useState(false), [res, setRes] = useState(null), [st, setSt] = useState(false);
  const buscar = async () => {
    setSt(true);
    const x = await fetch(`/api/fiscal/estoque?u=${user.id}&catalogo=1&fornecedorId=${v.fornecedorId || ""}&q=${encodeURIComponent(q || it.xProd)}&cor=${encodeURIComponent(v.cor || "")}${todos ? "&todos=1" : ""}`).then((r) => r.json()).catch(() => ({}));
    setSt(false); setRes(x.itens || []);
  };
  const lista = res || it.catalogo || [];
  return (
    <div className="rounded-lg p-3 mb-3" style={{ background: C.blueSoft, border: `1px solid ${C.blue}33` }}>
      <div className="text-[11px] font-semibold mb-1.5" style={{ color: C.blue }}>Do catálogo {res ? "· resultado da busca" : "· sugestões pelo nome da NF (fornecedor e grupo)"}</div>
      {lista.length === 0 ? <div className="text-xs" style={{ color: C.sub }}>Nenhum item parecido nas cartelas{todos ? "" : " deste fornecedor/grupo"}.</div>
        : <div className="space-y-1 overflow-auto" style={{ maxHeight: 170 }}>{lista.map((c) => {
          const sel = v.artigoId === c.id;
          return <button key={c.id} type="button" onClick={() => onUsar(c)} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2"
            style={{ background: sel ? C.green : "#fff", color: sel ? "#fff" : C.text, border: `1px solid ${sel ? C.green : C.line}` }}>
            <b className="truncate">{c.nome}</b><span className="truncate flex-1" style={{ opacity: 0.8 }}>{linhaCat(c)}</span>
            {c.fornecedor && <span className="shrink-0" style={{ opacity: 0.7 }}>{c.fornecedor}</span>}{sel && <span className="shrink-0 font-bold">✓ vinculado</span>}</button>;
        })}</div>}
      <div className="flex gap-1.5 mt-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="buscar outro item do catálogo" className="flex-1 px-2 py-1 rounded-lg text-xs outline-none" style={{ background: "#fff", border: `1px solid ${C.line}` }} />
        <label className="text-[11px] flex items-center gap-1" style={{ color: C.sub }}><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> todos os fornecedores</label>
        <button type="button" onClick={buscar} disabled={st} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: C.blue, color: "#fff" }}>{st ? "…" : "Buscar"}</button>
      </div>
    </div>
  );
}

export default function ParametrizarNf({ user, id, onFim }) {
  const [d, setD] = useState(null), [erro, setErro] = useState(""), [forns, setForns] = useState([]), [st, setSt] = useState(false), [fim, setFim] = useState(null), [vols, setVols] = useState(false);
  const [pos, setPos] = useState(0), [cfg, setCfg] = useState(null), [nomes, setNomes] = useState([]);
  useEffect(() => {
    fetch(`/api/fiscal/estoque?u=${user.id}&id=${id}`).then((r) => r.json()).then((x) => { if (x.error) throw new Error(x.error);
      setD({ ...x, itens: x.itens.map((it) => ({ ...it, dados: { ...it.dados, tipoEstoque: it.dados.tipoEstoque || tipoDaCat(it.dados.categoria), tipoTecido: tecidoDe(it.dados, it.dados.tipoEstoque || tipoDaCat(it.dados.categoria)), tipoMalha: it.dados.tipoMalha || "",
        artigoInterno: it.origem === "NF" ? "" : it.dados.artigoInterno || "", quantidade: fmt(it.dados.quantidade), largura: fmt(it.dados.largura), gramatura: fmt(it.dados.gramatura), valorUnitario: fmt(it.dados.valorUnitario) } })) }); })
      .catch((e) => setErro(e.message));
    fetch("/api/fornecedores").then((r) => r.json()).then((x) => setForns(Array.isArray(x) ? x : [])).catch(() => {});
    fetch(`/api/estoque/manual?u=${user.id}`).then((r) => r.json()).then(setCfg).catch(() => {});
    fetch("/api/artigos?estoque=1").then((r) => r.json()).then((l) => setNomes(Array.isArray(l) ? l.map((a) => ({ nome: a.artigoInterno || a.nome, cat: a.categoria })) : [])).catch(() => null);
  }, [id]);
  useEffect(() => {   // voltou da guia do cadastro: recarrega os fornecedores
    const h = () => fetch("/api/fornecedores").then((r) => r.json()).then((l) => Array.isArray(l) && setForns(l)).catch(() => null);
    window.addEventListener("focus", h); return () => window.removeEventListener("focus", h);
  }, []);
  // editar nome, cor ou unidade desfaz o vínculo direto com o item do catálogo
  const set = (i, k, val) => setD((s) => ({ ...s, itens: s.itens.map((it, j) => (j === i ? { ...it, dados: { ...it.dados, [k]: val, ...(["artigoInterno", "cor", "unidade"].includes(k) ? { artigoId: null } : {}) } } : it)) }));
  const usarCatalogo = (i, c) => setD((s) => ({ ...s, itens: s.itens.map((it, j) => {
    if (j !== i) return it;
    const v = it.dados, mesmaCor = !v.cor || !c.cor || String(v.cor).trim().toUpperCase() === String(c.cor).trim().toUpperCase();
    const tipoC = tipoDaCat(c.categoria) || v.tipoEstoque;   // v1163 — o catálogo define o tipo
    const tt = tipoC === "TECIDO" ? (v.tipoTecido && v.tipoTecido !== "OUTROS" ? v.tipoTecido : "OUTROS") : v.tipoTecido;   // v1158 — tecido: nome = tipo
    return { ...it, dados: { ...v, tipoTecido: tt, artigoInterno: tt && tt !== "OUTROS" ? tt : c.nome, cor: v.cor || c.cor || "", codigo: c.codigo || v.codigo || "", composicao: c.composicao || v.composicao || "",
      largura: c.largura != null ? fmt(c.largura) : v.largura, gramatura: c.gramatura != null ? fmt(c.gramatura) : v.gramatura, tipoMalha: c.tipoMalha || v.tipoMalha,
      tipoEstoque: tipoC, fornecedorId: v.fornecedorId || c.fornecedorId,
      artigoId: mesmaCor && (!c.unidade || c.unidade === v.unidade) ? c.id : null } };
  }) }));
  const enviar = async () => {
    const pend = d.itens.map((it, i) => [i, faltasItem(it.dados)]).filter(([, l]) => l.length);
    if (pend.length) { setPos(pend[0][0]); return alerta(`Todo item da NF precisa do artigo interno.\n\n${pend.map(([i, l]) => `Item ${i + 1}: falta ${l.join(", ")}`).join("\n")}`); }
    if (!(await confirmar(`Dar entrada no estoque dos ${d.itens.length} item(ns) da NF ${d.numero}?`, { titulo: "Entrada no estoque" }))) return;
    setSt(true);
    const r = await fetch("/api/fiscal/estoque", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, id, itens: d.itens.map((it) => ({ idx: it.idx, dados: { ...it.dados, categoria: catDoTipo(it.dados.tipoEstoque) } })) }) });
    const x = await r.json().catch(() => ({})); setSt(false);
    if (!r.ok || x.error) return alerta(x.error || "Não foi possível dar entrada no estoque.");
    setFim(x);
  };
  if (vols) return <VolumesNf user={user} id={id} onFim={() => onFim(fim)} />;   // v620
  const it = d?.itens?.[pos], v = it?.dados;
  const tecido = v?.tipoEstoque === "TECIDO", malha = v?.tipoEstoque === "MALHA";
  const sugNomes = v ? [...new Set(nomes.filter((n) => n.cat === catDoTipo(v.tipoEstoque)).map((n) => n.nome).filter(Boolean))].slice(0, 300) : [];
  const editando = d && !fim && d.estoqueStatus !== "LANCADO";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="w-full rounded-xl overflow-hidden flex flex-col anim-modal" style={{ maxWidth: 820, maxHeight: "94vh", background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <PackageCheck size={18} style={{ color: C.accent }} />
          <div className="flex-1 min-w-0"><div className="font-semibold" style={{ color: C.navy }}>Entrada no estoque · NF{d ? ` ${d.numero}` : ""}</div>
            {d && <div className="text-xs truncate" style={{ color: C.sub }}>{d.parceiro}{d.emissao ? ` · emissão ${String(d.emissao).slice(0, 10).split("-").reverse().join("/")}` : ""} · {d.itens.length} item(ns)</div>}</div>
          <button onClick={() => onFim(fim)} style={{ color: C.sub }} title="Fechar (a NF fica pendente)"><X size={18} /></button>
        </div>
        {editando && d.itens.length > 1 && <div className="flex gap-1 px-5 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${C.line}`, background: "#F7F8FA" }}>
          {d.itens.map((x, i) => { const ok = !faltasItem(x.dados).length;
            return <button key={x.idx} onClick={() => setPos(i)} title={x.xProd} className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={i === pos ? { background: C.navy, color: "#fff" } : { background: ok ? C.greenSoft : "#fff", color: ok ? C.green : C.sub, border: `1px solid ${ok ? C.green + "55" : C.line}` }}>{ok ? "✓ " : ""}{i + 1}</button>; })}
        </div>}
        <div className="flex-1 overflow-y-auto p-5">
          {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
          {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Lendo os itens da NF…</div>}
          {fim && <div className="rounded-lg p-4 text-sm" style={{ background: C.greenSoft, color: C.text }}>
            {fim.jaNoEstoque ? <b>Esta NF já tinha dado entrada no estoque (importada pela tela de Estoque).</b> : <>
              <b style={{ color: C.green }}>✓ Entrada no estoque feita.</b> {fim.criados} artigo(s) novo(s) · {fim.somados} somado(s) a artigos já existentes{fim.equivalencias ? ` · ${fim.equivalencias} vínculo(s) salvo(s) para as próximas NFs` : ""}.
              <div className="mt-2 text-xs space-y-0.5">{(fim.detalhe || []).map((x, k) => <div key={k}>{x.situacao === "SOMADO" ? "＋" : "•"} {x.xProd}{x.artigoInterno ? <> → <b>{x.artigoInterno}</b> · {fmt(x.quantidade)} {String(x.unidade || "").toLowerCase()}</> : ` (${String(x.situacao || "").toLowerCase()})`}{x.situacao === "SOMADO" ? " (somado)" : ""}</div>)}</div></>}
          </div>}
          {d && !fim && d.estoqueStatus === "LANCADO" && <div className="text-sm" style={{ color: C.sub }}>Esta NF já deu entrada no estoque.</div>}
          {editando && it && (() => { const [ot, oc, of] = ORIGEM[it.origem] || ORIGEM.NF; return <>
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel2 }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold rounded-full flex items-center justify-center shrink-0" style={{ width: 22, height: 22, background: C.navy, color: "#fff" }}>{pos + 1}</span>
                <span className="text-[11px] font-semibold" style={{ color: C.sub }}>Item na NF</span>
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: of, color: oc }}>{it.origem === "EQUIVALENCIA" && <Link2 size={11} />}{it.origem === "EQUIVALENCIA" ? `vínculo salvo${it.equivalencia?.outroCnpj ? " (outro CNPJ do grupo)" : ""}` : ot}</span>
              </div>
              <div className="text-sm font-semibold mt-1" style={{ color: C.text }}>{it.xProd}</div>
              <div className="text-xs" style={{ color: C.sub }}>{[it.cProd && `cód. ${it.cProd}`, `${fmt(it.quantidade)} ${String(it.uCom || "").toLowerCase()}`, it.valorUnitario != null && `R$ ${fmt(it.valorUnitario)}`].filter(Boolean).join(" · ")}</div>
            </div>
            {it.origem === "EQUIVALENCIA" && <div className="rounded-lg px-3 py-2 mb-3 text-xs" style={{ background: C.greenSoft, color: C.green }}>
              Este nome de item já foi indexado{it.equivalencia?.por ? ` por ${it.equivalencia.por}` : ""}{it.equivalencia?.em ? ` em ${String(it.equivalencia.em).slice(0, 10).split("-").reverse().join("/")}` : ""}: os campos vieram do vínculo salvo. Confira e conclua — se mudar, o vínculo é atualizado.</div>}
            <CatalogoItem key={it.idx} user={user} it={it} v={v} onUsar={(c) => usarCatalogo(pos, c)} />
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              <MCampo t="Tipo" obrig larg><Opcoes ops={TIPOS.map((t) => [t, t])} valor={v.tipoEstoque} onChange={(x) => { set(pos, "tipoEstoque", x); if (x !== "TECIDO" && v.tipoTecido) { set(pos, "tipoTecido", ""); set(pos, "artigoInterno", ""); } }} /></MCampo>
              {/* v1158 — tecido: o NOME é um dos tipos cadastrados (substitui o campo nome) */}
              {tecido && <MCampo t="Nome" obrig larg>
                <select value={v.tipoTecido} onChange={(e) => { const t = e.target.value; set(pos, "tipoTecido", t); set(pos, "artigoInterno", t && t !== "OUTROS" ? t : ""); if (!v.gramatura && cfg?.gramaturas?.[t]) set(pos, "gramatura", fmt(cfg.gramaturas[t])); }}
                  className="px-2 rounded-lg text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, height: 36, minWidth: 260 }}>
                  <option value="">Escolha…</option>{(cfg?.tecidos || []).map((t) => <option key={t} value={t}>{t}{cfg?.gramaturas?.[t] ? ` · ${cfg.gramaturas[t]} g/m²` : ""}</option>)}
                </select></MCampo>}
              {(!tecido || v.tipoTecido === "OUTROS") && <MCampo t={tecido ? "Nome (outro tecido)" : "Nome"} obrig larg>
                <InpSugest value={v.artigoInterno || ""} onChange={(x) => set(pos, "artigoInterno", x)} opcoes={sugNomes} placeholder="só o artigo: fornecedor e cor vão nos campos próprios" />
              </MCampo>}
              <MCampo t="Cor" obrig><Inp value={v.cor || ""} onChange={(e) => set(pos, "cor", e.target.value.toUpperCase())} /></MCampo>
              <MCampo t="Código"><Inp value={v.codigo || ""} onChange={(e) => set(pos, "codigo", e.target.value.toUpperCase())} /></MCampo>
              <MCampo t="Fornecedor" obrig larg>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0"><FornecedorBusca forns={forns} valor={v.fornecedorId} onEscolher={(x) => set(pos, "fornecedorId", x)} onCriado={(x) => setForns((l) => [...l, x])} /></div>
                  <button type="button" onClick={() => window.open("/?v=fornecedores", "_blank")} title="Abrir o cadastro de fornecedores em outra guia" className="flex items-center gap-1 px-3 rounded-lg text-xs font-semibold shrink-0" style={{ height: 36, border: `1px solid ${C.accent}`, color: C.accent, background: "#fff" }}><ExternalLink size={13} /> Cadastro</button>
                </div>
              </MCampo>
              {(malha || tecido) && <MCampo t="Largura (m)"><Inp value={v.largura || ""} onChange={(e) => set(pos, "largura", e.target.value)} inputMode="decimal" placeholder="ex.: 1,60" /></MCampo>}
              {malha && <MCampo t="Construção"><Opcoes ops={[["TUBULAR", "Tubular"], ["RAMADA", "Ramada"]]} valor={v.tipoMalha} onChange={(x) => set(pos, "tipoMalha", x)} /></MCampo>}
              {(malha || tecido) && <MCampo t="Gramatura (g/m²)"><Inp value={v.gramatura || ""} onChange={(e) => set(pos, "gramatura", e.target.value)} inputMode="decimal" /></MCampo>}
              {(malha || tecido) && <MCampo t="Composição"><Inp value={v.composicao || ""} onChange={(e) => set(pos, "composicao", e.target.value.toUpperCase())} /></MCampo>}
              <MCampo t="Quantidade (da NF)" obrig><Inp value={v.quantidade} onChange={(e) => set(pos, "quantidade", e.target.value)} inputMode="decimal" /></MCampo>
              <MCampo t="Unidade de medida" obrig><Opcoes ops={UNS_NF.map((u) => [u, u])} valor={v.unidade} onChange={(x) => set(pos, "unidade", x)} /></MCampo>
              <MCampo t="Preço unitário (R$)"><Inp value={v.valorUnitario || ""} onChange={(e) => set(pos, "valorUnitario", e.target.value)} inputMode="decimal" /></MCampo>
              <MCampo t="Origem"><Inp value={`NF ${d.numero}`} readOnly style={{ color: C.sub, background: C.panel2 }} /></MCampo>
            </div>
            <div className="text-[11px] mt-3" style={{ color: C.sub }}>{v.artigoId ? "Vinculado ao item do catálogo: a entrada soma nele." : "Artigo igual já no estoque (tipo, fornecedor, nome, cor, código, unidade e largura) soma a quantidade."} O vínculo fica salvo para as próximas NFs deste fornecedor.</div>
          </>; })()}
        </div>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {fim ? <><span className="flex-1" /><button onClick={() => onFim(fim)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Fechar</button>
            {!fim.jaNoEstoque && <button onClick={() => setVols(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Identificar volumes e imprimir etiquetas</button>}</> : <>
            <button onClick={() => onFim(null)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Depois</button>
            <span className="flex-1" />
            {editando && d.itens.length > 1 && <>
              <button disabled={pos === 0} onClick={() => setPos((p) => p - 1)} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub, border: `1px solid ${C.line}`, opacity: pos === 0 ? 0.4 : 1 }}>‹ Anterior</button>
              {pos < d.itens.length - 1 && <button onClick={() => setPos((p) => p + 1)} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ color: C.navy, border: `1px solid ${C.navy}` }}>Próximo ›</button>}
            </>}
            <button disabled={!editando || st} onClick={enviar} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.accent, opacity: st || !editando ? 0.6 : 1 }}>
              {st && <Loader2 size={14} className="animate-spin" />} Concluir e dar entrada</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// v620 — identificação de volumes da NF: cada item com "+" para adicionar etiqueta (quantidade do volume) e impressão na Zebra
export function VolumesNf({ user, id, onFim }) {
  const [d, setD] = useState(null), [erro, setErro] = useState(""), [ets, setEts] = useState([]), [st, setSt] = useState(false);
  const [tam, setTam] = useState(() => { try { const t = localStorage.getItem("ce_etiqueta_tam"); return t === "50x50" ? t : "100x85"; } catch { return "100x85"; } });   // v1152 — 10×8,5 (padrão) ou 5×5
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
    imprimirEtiquetas(x.volumes.map((v, k) => { const a = porArt[v.artigoId] || {}; return { codigo: v.codigo, tipo: a.tipoEtiqueta, artigo: a.artigoInterno, cor: a.cor, codigoArtigo: a.codigo, largura: a.largura,
      construcao: a.construcao, quantidade: v.quantidade, unidade: v.unidade, origem: `NF ${x.numero}`, fornecedor: a.fornecedor, entrada: v.entradaEm || x.entrada, ordem: k + 1, total: x.volumes.length }; }), { tamanho: tam });   // v1152 — etiqueta padrão
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
            <select value={tam} onChange={(e) => setTam(e.target.value)} className="px-2 py-1 rounded-lg text-sm outline-none" style={iS}>{["100x85", "50x50"].map((t) => <option key={t} value={t}>{t.replace("x", " × ")} mm</option>)}</select></label>
          <span className="flex-1" />
          <button onClick={() => onFim()} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Fechar</button>
          <button disabled={!d || st} onClick={imprimir} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.accent, opacity: st ? 0.6 : 1 }}>
            {st && <Loader2 size={14} className="animate-spin" />} Salvar e imprimir {ets.length || ""} etiqueta(s)</button>
        </div>
      </div>
    </div>
  );
}
