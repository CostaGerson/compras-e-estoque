"use client";
// v1172 — nomes pré-cadastrados de malha/aviamento, tamanho e zíper (aviamento), OBS
// v1152 — entrada manual de estoque (inventário): card central com os dados da etiqueta padrão,
// confirmação, entrada no estoque e impressão da etiqueta Zebra (10 × 8,5 cm pré-selecionada ou 5 × 5 cm).
// Tecido plano é pesado: a metragem sai do peso, da largura e da gramatura padrão do tipo de tecido.
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X, PackagePlus, Printer, Settings2, ExternalLink, RefreshCw } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { fornecedoresParecidos } from "@/lib/artigoPadrao";
import { htmlEtiquetas, imprimirEtiquetas, TAMANHOS, TAMANHO_PADRAO, nomeTamanho } from "./etiquetaZebra";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", navy: "#001E41", red: "#D92D20" };
const num = (v) => { if (v == null || v === "") return null; const t = String(v).trim(); const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : null; };
const nBR = (n, d = 2) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
const nomeF = (f) => f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}`;
const iS = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };

export function Campo({ t, obrig, children, larg }) {
  return (
    <div style={larg ? { gridColumn: "1 / -1" } : undefined}>
      <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}{obrig && <span style={{ color: C.red }}> *</span>}</div>
      {children}
    </div>
  );
}
export const Inp = (p) => <input {...p} className="w-full px-2.5 rounded-lg text-sm outline-none" style={{ ...iS, height: 36, ...(p.style || {}) }} />;
export function Opcoes({ ops, valor, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ops.map(([k, t]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={valor === k ? { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` } : { background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>{t}</button>
      ))}
    </div>
  );
}

// v1154 — sugestões em lista própria (rolável, do tamanho do card) no lugar da lista do navegador
export function InpSugest({ value, onChange, opcoes, placeholder }) {
  const [ab, setAb] = useState(false);
  const q = String(value || "").trim().toUpperCase();
  const l = (q ? opcoes.filter((o) => o.toUpperCase().includes(q) && o.toUpperCase() !== q) : opcoes).slice(0, 80);
  return (
    <div className="relative">
      <Inp value={value} onChange={(e) => { onChange(e.target.value.toUpperCase()); setAb(true); }} onFocus={() => setAb(true)} onBlur={() => setTimeout(() => setAb(false), 180)} placeholder={placeholder} />
      {ab && l.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg shadow-lg overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}`, maxHeight: 200 }}>
          {l.map((o) => <button key={o} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o); setAb(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" style={{ color: C.text }}>{o}</button>)}
        </div>
      )}
    </div>
  );
}
// fornecedor: busca nos cadastrados; parecido com um existente não pode ser cadastrado de novo
export function FornecedorBusca({ forns, valor, onEscolher, onCriado }) {
  const [q, setQ] = useState(""), [ab, setAb] = useState(false), [criando, setCriando] = useState(false);
  const sel = forns.find((f) => f.id === valor);
  const lista = q.trim() ? forns.filter((f) => [f.nome, f.nomeFantasia, f.razaoSocial].filter(Boolean).join(" ").toUpperCase().includes(q.trim().toUpperCase())).slice(0, 12) : forns.slice(0, 12);
  const parecidos = q.trim() ? fornecedoresParecidos(q, forns, nomeF) : [];
  const exato = forns.some((f) => nomeF(f).toUpperCase().trim() === q.trim().toUpperCase());
  const criar = async () => {
    setCriando(true);
    const r = await fetch("/api/fornecedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: q.trim().toUpperCase() }) });
    const x = await r.json().catch(() => ({})); setCriando(false);
    if (!r.ok || x.error) return alerta(x.error || "Não deu para cadastrar o fornecedor.");
    onCriado(x); onEscolher(x.id); setQ(""); setAb(false);
  };
  return (
    <div className="relative">
      <Inp value={ab ? q : sel ? nomeF(sel) : q} placeholder="buscar fornecedor" onFocus={() => { setAb(true); setQ(""); }} onBlur={() => setTimeout(() => setAb(false), 200)}
        onChange={(e) => { setQ(e.target.value); onEscolher(null); setAb(true); }} style={{ borderColor: valor ? C.green : C.line }} />
      {ab && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg shadow-lg overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}`, maxHeight: 200 }}>
          {lista.map((f) => <button key={f.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(f.id); setQ(""); setAb(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">{nomeF(f)}</button>)}
          {q.trim() && !exato && parecidos.length > 0 && <div className="px-3 py-2 text-[11px] font-semibold" style={{ color: C.red, borderTop: `1px solid ${C.line}` }}>Já existe fornecedor parecido: escolha da lista.</div>}
          {q.trim() && !exato && !parecidos.length && <button type="button" disabled={criando} onMouseDown={(e) => e.preventDefault()} onClick={criar} className="w-full text-left px-3 py-2 text-sm font-semibold" style={{ color: C.accent, borderTop: `1px solid ${C.line}` }}>{criando ? "Cadastrando…" : `+ Cadastrar "${q.trim().toUpperCase()}"`}</button>}
        </div>
      )}
    </div>
  );
}

function Gramaturas({ user, tecidos, gram, onSalvo, onClose }) {
  const [g, setG] = useState(() => Object.fromEntries(tecidos.filter((t) => t !== "OUTROS").map((t) => [t, gram[t] != null ? String(gram[t]).replace(".", ",") : ""])));
  const [st, setSt] = useState(false);
  const salvar = async () => {
    setSt(true);
    const r = await fetch("/api/estoque/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "gramaturas", gramaturas: g }) });
    const x = await r.json().catch(() => ({})); setSt(false);
    if (!r.ok || x.error) return alerta(x.error || "Não salvou.");
    onSalvo(x.gramaturas); onClose();
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.35)" }}>
      <div className="w-full rounded-xl p-4" style={{ maxWidth: 420, background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div className="flex items-center mb-3"><b style={{ color: C.navy }}>Gramatura padrão dos tecidos (g/m²)</b><button className="ml-auto" onClick={onClose}><X size={16} /></button></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-[60vh] overflow-auto">
          {Object.keys(g).map((t) => (
            <label key={t} className="flex items-center gap-2 text-xs"><span className="flex-1" style={{ color: C.text }}>{t}</span>
              <input value={g[t]} onChange={(e) => setG((o) => ({ ...o, [t]: e.target.value }))} inputMode="decimal" placeholder="g/m²" className="w-20 px-2 py-1 rounded text-right text-sm" style={iS} /></label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-3 py-1.5 text-sm" style={{ color: C.sub }}>Cancelar</button>
          <button onClick={salvar} disabled={st} className="px-4 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>{st ? "Salvando…" : "Salvar"}</button></div>
      </div>
    </div>
  );
}

export default function EntradaManualEstoque({ user, onClose }) {
  const [cfg, setCfg] = useState(null);
  const [forns, setForns] = useState([]);
  const [nomes, setNomes] = useState([]);
  const [f, setF] = useState({ tipo: "", tipoTecido: "", nome: "", cor: "", codigo: "", fornecedorId: null, largura: "", construcao: "", pesoKg: "", gramatura: "", quantidade: "", unidade: "", unidadesPacote: "", origem: "",
    nomeLista: "", tamanho: "", tamanhoUnidade: "", tamanhoUnidadeOutro: "", tipoZiper: "", obs: "" });   // v1172
  const [salvando, setSalvando] = useState(false);
  const [etq, setEtq] = useState(null);   // etiqueta pronta → tela de impressão
  const [tam, setTam] = useState(TAMANHO_PADRAO);
  const [editGram, setEditGram] = useState(false);
  const s = (k, v) => setF((o) => ({ ...o, [k]: v }));
  useEffect(() => {
    fetch(`/api/estoque/manual?u=${user.id}`).then((r) => r.json()).then(setCfg).catch(() => setCfg({ error: true }));
    fetch("/api/fornecedores").then((r) => r.json()).then((l) => setForns(Array.isArray(l) ? l : [])).catch(() => null);
    fetch("/api/artigos?estoque=1").then((r) => r.json()).then((l) => setNomes(Array.isArray(l) ? l.map((a) => ({ nome: a.artigoInterno || a.nome, cat: a.categoria })) : [])).catch(() => null);
  }, []);
  useEffect(() => {   // v1154 — voltou da guia do cadastro: recarrega os fornecedores
    const h = () => fetch("/api/fornecedores").then((r) => r.json()).then((l) => Array.isArray(l) && setForns(l)).catch(() => null);
    window.addEventListener("focus", h); return () => window.removeEventListener("focus", h);
  }, []);
  const tecido = f.tipo === "TECIDO", malha = f.tipo === "MALHA";
  const gramPadrao = tecido && f.tipoTecido && f.tipoTecido !== "OUTROS" ? cfg?.gramaturas?.[f.tipoTecido] : null;
  const gramUsada = num(f.gramatura) || gramPadrao || null;
  const metros = tecido && num(f.pesoKg) > 0 && gramUsada > 0 && num(f.largura) > 0 ? (num(f.pesoKg) * 1000) / (gramUsada * num(f.largura)) : null;
  const aviam = f.tipo === "AVIAMENTO";
  const listaNomes = malha ? cfg?.nomesMalha : aviam ? cfg?.nomesAviamento : null;   // v1172 — nomes pré-cadastrados
  const ziper = aviam && /^Z[IÍ]PER\b/i.test(f.nome.trim());
  const catNome = malha ? "MALHA" : tecido ? "TECIDO" : f.tipo === "AVIAMENTO" ? "AVIAMENTO" : "OUTROS";
  const sugNomes = useMemo(() => [...new Set(nomes.filter((n) => n.cat === catNome).map((n) => n.nome).filter(Boolean))].slice(0, 300), [nomes, catNome]);

  const faltas = () => {
    const l = [];
    if (!f.tipo) l.push("tipo");
    if (tecido && !f.tipoTecido) l.push("nome do tecido");
    if (listaNomes && !f.nomeLista) l.push("nome");
    if (!f.nome.trim()) l.push("nome do artigo");
    if (ziper && !f.tipoZiper) l.push("zíper fixo ou destacável");
    if (aviam && f.tamanho.trim()) { if (!(num(f.tamanho) > 0)) l.push("tamanho válido"); if (!f.tamanhoUnidade || (f.tamanhoUnidade === "OUTRO" && !f.tamanhoUnidadeOutro.trim())) l.push("unidade do tamanho"); }
    if (!f.cor.trim()) l.push("cor");
    if (!f.fornecedorId) l.push("fornecedor (escolha na lista)");
    if ((malha || tecido) && !(num(f.largura) > 0)) l.push("largura");
    if (malha && !f.construcao) l.push("construção");
    if (tecido) { if (!(num(f.pesoKg) > 0)) l.push("peso"); if (!(gramUsada > 0)) l.push("gramatura"); }
    else { if (!f.unidade) l.push("unidade"); if (!(num(f.quantidade) > 0)) l.push("quantidade"); if (f.unidade === "PCT" && !(num(f.unidadesPacote) > 0)) l.push("unidades no pacote"); }
    if (!f.origem.trim()) l.push("origem");
    return l;
  };
  const concluir = async () => {
    const l = faltas();
    if (l.length) return alerta(`Falta preencher: ${l.join(", ")}.`);
    const qtdTxt = tecido ? `${nBR(metros, 2)} m (${nBR(num(f.pesoKg), 3)} kg × ${nBR(gramUsada, 0)} g/m² × ${nBR(num(f.largura), 2)} m)` : `${f.quantidade} ${f.unidade}${f.unidade === "PCT" ? ` de ${f.unidadesPacote} un` : ""}`;
    if (!(await confirmar(`Deseja de fato inserir no estoque?\n\n${f.nome.toUpperCase()}${ziper ? ` ${f.tipoZiper}` : ""}${aviam && f.tamanho.trim() ? ` · ${f.tamanho} ${f.tamanhoUnidade === "OUTRO" ? f.tamanhoUnidadeOutro.toUpperCase() : f.tamanhoUnidade}` : ""} · ${f.cor.toUpperCase()}\n${qtdTxt}${f.obs.trim() ? `\nOBS: ${f.obs.toUpperCase()}` : ""}\nOrigem: ${f.origem.toUpperCase()}`, { titulo: "Entrada no estoque" }))) return;
    setSalvando(true);
    const r = await fetch("/api/estoque/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "entrar", ...f, gramatura: tecido ? gramUsada : f.gramatura }) });
    const x = await r.json().catch(() => ({})); setSalvando(false);
    if (!r.ok || x.error) return alerta(x.error || "Não foi possível dar a entrada.");
    setEtq(x.etiqueta);
  };

  const preview = useMemo(() => (etq ? htmlEtiquetas([etq], { tamanho: tam, autoPrint: false }) : ""), [etq, tam]);
  const [W, H] = TAMANHOS[tam] || TAMANHOS[TAMANHO_PADRAO];
  const escala = 3.2;   // px por mm na prévia

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="w-full rounded-xl overflow-hidden flex flex-col anim-modal" style={{ maxWidth: 760, maxHeight: "94vh", background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          {etq ? <Printer size={18} style={{ color: C.accent }} /> : <PackagePlus size={18} style={{ color: C.accent }} />}
          <b style={{ color: C.navy }}>{etq ? "Etiqueta do volume" : "Entrada manual no estoque"}</b>
          <button className="ml-auto" onClick={onClose} title="Fechar"><X size={18} /></button>
        </div>
        {!cfg ? <div className="p-6 text-sm flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={14} className="animate-spin" /> Carregando…</div>
          : etq ? (
          <div className="p-5 overflow-auto">
            <div className="text-sm mb-3" style={{ color: C.green }}>✓ Entrada feita no estoque. Confira a etiqueta e imprima.</div>
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span style={{ color: C.sub }}>Tamanho</span>
              <Opcoes ops={Object.keys(TAMANHOS).map((k) => [k, nomeTamanho(k)])} valor={tam} onChange={setTam} />
            </div>
            <div className="flex justify-center p-4 rounded-lg" style={{ background: C.panel2 }}>
              <iframe title="Prévia da etiqueta" srcDoc={preview} style={{ width: W * escala, height: H * escala, border: "1px solid #bbb", background: "#fff", zoom: 1 }}
                onLoad={(e) => { try { const d = e.target.contentDocument; d.body.style.zoom = String(escala / (96 / 25.4)); } catch {} }} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-3 py-2 text-sm" style={{ color: C.sub }}>Fechar</button>
              <button onClick={() => imprimirEtiquetas([etq], { tamanho: tam })} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Printer size={15} /> Imprimir</button>
            </div>
          </div>
        ) : (
          <div className="p-5 overflow-auto">
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              <Campo t="Tipo" obrig larg><Opcoes ops={cfg.tipos.map((t) => [t, t])} valor={f.tipo} onChange={(v) => setF((o) => ({ ...o, tipo: v, tipoTecido: v === "TECIDO" ? o.tipoTecido : "", nome: v === "TECIDO" && o.tipoTecido && o.tipoTecido !== "OUTROS" ? o.tipoTecido : o.tipo === "TECIDO" ? "" : o.nome, construcao: v === "MALHA" ? o.construcao : "",
                ...(v !== o.tipo && (["MALHA", "AVIAMENTO"].includes(v) || ["MALHA", "AVIAMENTO"].includes(o.tipo)) ? { nome: "", nomeLista: "", tipoZiper: "" } : {}), ...(v !== "AVIAMENTO" ? { tamanho: "", tamanhoUnidade: "", tamanhoUnidadeOutro: "", tipoZiper: "" } : {}) }))} /></Campo>
              {/* v1158 — tecido: o NOME é um dos tipos cadastrados (substitui o campo nome) */}
              {tecido && <Campo t="Nome" obrig larg>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={f.tipoTecido} onChange={(e) => { const t = e.target.value; setF((o) => ({ ...o, tipoTecido: t, nome: t && t !== "OUTROS" ? t : "" })); }} className="px-2 rounded-lg text-sm" style={{ ...iS, height: 36, minWidth: 240 }}>
                    <option value="">Escolha…</option>{cfg.tecidos.map((t) => <option key={t} value={t}>{t}{cfg.gramaturas?.[t] ? ` · ${cfg.gramaturas[t]} g/m²` : ""}</option>)}
                  </select>
                  <button type="button" onClick={() => setEditGram(true)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}><Settings2 size={13} /> gramaturas padrão</button>
                </div>
              </Campo>}
              {/* v1172 — malha e aviamento: nomes pré-cadastrados (OUTROS = digitar) */}
              {listaNomes && <Campo t="Nome" obrig larg>
                <select value={f.nomeLista} onChange={(e) => { const t = e.target.value; setF((o) => ({ ...o, nomeLista: t, nome: t && t !== "OUTROS" ? t : "", tipoZiper: "" })); }} className="px-2 rounded-lg text-sm" style={{ ...iS, height: 36, minWidth: 260 }}>
                  <option value="">Escolha…</option>{listaNomes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>}
              {((!tecido && !listaNomes) || (tecido && f.tipoTecido === "OUTROS") || (listaNomes && f.nomeLista === "OUTROS")) && <Campo t={tecido ? "Nome (outro tecido)" : listaNomes ? "Nome (outro)" : "Nome"} obrig larg>
                <InpSugest value={f.nome} onChange={(v) => s("nome", v)} opcoes={sugNomes} placeholder="só o artigo: fornecedor e cor vão nos campos próprios" />
              </Campo>}
              {ziper && <Campo t="Zíper" obrig larg><Opcoes ops={(cfg.tiposZiper || ["FIXO", "DESTACÁVEL"]).map((t) => [t, t === "FIXO" ? "Fixo" : "Destacável"])} valor={f.tipoZiper} onChange={(v) => s("tipoZiper", v)} /></Campo>}
              {aviam && <Campo t="Tamanho" larg>
                <div className="flex items-center gap-2 flex-wrap">
                  <div style={{ width: 110 }}><Inp value={f.tamanho} onChange={(e) => s("tamanho", e.target.value)} inputMode="decimal" placeholder="ex.: 20" /></div>
                  <Opcoes ops={cfg.unidadesTamanho || [["M", "Metros"], ["CM", "Centímetros"], ["OUTRO", "Outro"]]} valor={f.tamanhoUnidade} onChange={(v) => s("tamanhoUnidade", v)} />
                  {f.tamanhoUnidade === "OUTRO" && <div style={{ width: 120 }}><Inp value={f.tamanhoUnidadeOutro} onChange={(e) => s("tamanhoUnidadeOutro", e.target.value.toUpperCase())} placeholder="unidade" /></div>}
                </div>
              </Campo>}
              <Campo t="Cor" obrig><Inp value={f.cor} onChange={(e) => s("cor", e.target.value.toUpperCase())} /></Campo>
              <Campo t="Código"><Inp value={f.codigo} onChange={(e) => s("codigo", e.target.value.toUpperCase())} /></Campo>
              <Campo t="Fornecedor" obrig larg>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0"><FornecedorBusca forns={forns} valor={f.fornecedorId} onEscolher={(id) => s("fornecedorId", id)} onCriado={(x) => setForns((l) => [...l, x])} /></div>
                  {/* v1154 — cadastro de fornecedores em outra guia; ao voltar, a lista recarrega */}
                  <button type="button" onClick={() => window.open("/?v=fornecedores", "_blank")} title="Abrir o cadastro de fornecedores em outra guia" className="flex items-center gap-1 px-3 rounded-lg text-xs font-semibold shrink-0" style={{ height: 36, border: `1px solid ${C.accent}`, color: C.accent, background: "#fff" }}><ExternalLink size={13} /> Cadastro</button>
                  <button type="button" onClick={() => fetch("/api/fornecedores").then((r) => r.json()).then((l) => setForns(Array.isArray(l) ? l : [])).catch(() => null)} title="Recarregar a lista de fornecedores" className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 36, height: 36, border: `1px solid ${C.line}`, color: C.sub }}><RefreshCw size={14} /></button>
                </div>
              </Campo>
              {(malha || tecido) && <Campo t="Largura (m)" obrig><Inp value={f.largura} onChange={(e) => s("largura", e.target.value)} inputMode="decimal" placeholder="ex.: 1,60" /></Campo>}
              {malha && <Campo t="Construção" obrig><Opcoes ops={[["TUBULAR", "Tubular"], ["RAMADA", "Ramada"]]} valor={f.construcao} onChange={(v) => s("construcao", v)} /></Campo>}
              {malha && <Campo t="Gramatura (g/m²)"><Inp value={f.gramatura} onChange={(e) => s("gramatura", e.target.value)} inputMode="decimal" placeholder="opcional" /></Campo>}
              {tecido ? <>
                <Campo t="Peso (kg)" obrig><Inp value={f.pesoKg} onChange={(e) => s("pesoKg", e.target.value)} inputMode="decimal" placeholder="peso na balança" /></Campo>
                <Campo t={`Gramatura (g/m²)${gramPadrao ? ` · padrão ${gramPadrao}` : ""}`} obrig={!gramPadrao}><Inp value={f.gramatura} onChange={(e) => s("gramatura", e.target.value)} inputMode="decimal" placeholder={gramPadrao ? String(gramPadrao) : "informe"} /></Campo>
                <div className="rounded-lg px-3 py-2 text-sm self-end" style={{ background: metros ? C.greenSoft : C.panel2, color: metros ? C.green : C.sub, gridColumn: "1 / -1" }}>
                  {metros ? <>Metragem calculada: <b>{nBR(metros, 2)} m</b> <span className="text-xs">= {nBR(num(f.pesoKg), 3)} kg × 1000 ÷ ({nBR(gramUsada, 0)} g/m² × {nBR(num(f.largura), 2)} m)</span></> : "A metragem é calculada pelo peso, largura e gramatura."}
                </div>
              </> : <>
                <Campo t="Quantidade" obrig><Inp value={f.quantidade} onChange={(e) => s("quantidade", e.target.value)} inputMode="decimal" /></Campo>
                <Campo t="Unidade de medida" obrig><Opcoes ops={cfg.unidades} valor={f.unidade} onChange={(v) => s("unidade", v)} /></Campo>
                {f.unidade === "PCT" && <Campo t="Unidades dentro do pacote" obrig><Inp value={f.unidadesPacote} onChange={(e) => s("unidadesPacote", e.target.value)} inputMode="numeric" /></Campo>}
              </>}
              <Campo t="OBS" larg><Inp value={f.obs} onChange={(e) => s("obs", e.target.value.toUpperCase())} maxLength={200} placeholder="opcional (sai na etiqueta)" /></Campo>
              <Campo t="Origem" obrig larg>
                <InpSugest value={f.origem} onChange={(v) => s("origem", v)} opcoes={cfg.origens} placeholder="escolha ou escreva" />
              </Campo>
            </div>
            <div className="text-[11px] mt-3" style={{ color: C.sub }}>Cada entrada manual é um volume e gera uma etiqueta.</div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-3 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
              <button onClick={concluir} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.7 : 1 }}>{salvando ? "Inserindo…" : "Concluir"}</button>
            </div>
          </div>
        )}
      </div>
      {editGram && cfg && <Gramaturas user={user} tecidos={cfg.tecidos} gram={cfg.gramaturas || {}} onSalvo={(g) => setCfg((c) => ({ ...c, gramaturas: g }))} onClose={() => setEditGram(false)} />}
    </div>
  );
}
