"use client";
// v806 — Personalização do item do pedido: cada estampa (silk, DTF, bordado) com largura × altura e os arquivos de detalhe dela.
//   Vem pronta da FPP indexada (medidas e arquivos); o que faltar se completa aqui. Os arquivos ficam nos anexos do item
//   (categoria PERSONALIZACAO, com { aplicacao: uid }) — são os "detalhes de personalização" que saem na OP e vão para o sistema do PCP.
import React, { useState } from "react";
import { Plus, Trash2, Paperclip, X, Brush } from "lucide-react";
import { LOCAIS_APL, nomeLocalApl, NOME_METODO, METODOS_ARTE } from "@/lib/pedidoLanc";
import { confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", navySoft: "#EEF3FB", accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#C33" };
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
export const novoUid = () => Math.random().toString(36).slice(2, 10);
export const prefixoArqApl = (a) => `${(NOME_METODO[a.metodo] || a.metodo || "").toUpperCase()} ${nomeLocalApl(a.local).toUpperCase()}`.trim();
const abrir = (a) => { const w = window.open(); if (w) w.document.write(/pdf/i.test(a.mime || a.nome) ? `<iframe src="${a.base64}" style="border:0;width:100%;height:100%"></iframe>` : /^image\//.test(a.mime || "") || /^data:image/.test(a.base64 || "") ? `<img src="${a.base64}" style="max-width:100%"/>` : `<a href="${a.base64}" download="${a.nome}">Baixar ${a.nome}</a>`); };

function Soltar({ onArquivos, children, className, style, travado }) {
  const [sobre, setSobre] = useState(false);
  if (travado) return <div className={className} style={style}>{children}</div>;
  return (
    <label className={`${className} cursor-pointer`} style={{ ...style, ...(sobre ? { borderColor: C.navy, background: C.navySoft } : {}) }}
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setSobre(true); } }} onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); const fs = Array.from(e.dataTransfer?.files || []); if (fs.length) onArquivos(fs); }}>
      {children}
      <input type="file" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) onArquivos(fs); }} />
    </label>
  );
}
function ListaArq({ itens, onTirar }) {
  if (!itens.length) return null;
  return <div className="flex flex-wrap gap-1.5 mt-1.5">{itens.map(({ a, k }) => (
    <span key={k} className="inline-flex items-center gap-1 max-w-[240px] pl-2 pr-1 py-0.5 rounded-full text-[11px]" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }}>
      <Paperclip size={10} className="shrink-0" style={{ color: C.sub }} />
      <button type="button" onClick={() => abrir(a)} className="truncate" title={a.nome}>{a.nome}</button>
      {onTirar && <button type="button" onClick={() => onTirar(k)} className="shrink-0" style={{ color: C.red }} title="Tirar"><X size={11} /></button>}
    </span>
  ))}</div>;
}

export default function PersonalizacaoItem({ it, onChange, travado }) {
  const apl = Array.isArray(it.aplicacoes) ? it.aplicacoes : [];
  const anexos = Array.isArray(it.anexos) ? it.anexos : [];
  const comK = anexos.map((a, k) => ({ a, k })).filter(({ a }) => a.categoria !== "LAYOUT");
  const gerais = comK.filter(({ a }) => !a.aplicacao || !apl.some((x) => x.uid === a.aplicacao));
  const mudApl = (uid, patch) => onChange({ aplicacoes: apl.map((x) => (x.uid === uid ? { ...x, ...patch } : x)) });
  const anexar = async (fs, a) => {
    const add = await Promise.all(fs.map(async (x) => ({ nome: a ? `${prefixoArqApl(a)} · ${x.name}` : x.name, mime: x.type || null, base64: await readB64(x), categoria: "PERSONALIZACAO", ...(a ? { aplicacao: a.uid } : {}) })));
    onChange({ anexos: [...anexos, ...add] });
  };
  const tirarArq = (k) => onChange({ anexos: anexos.filter((_, j) => j !== k) });
  const tirarApl = async (a) => {
    const n = anexos.filter((x) => x.aplicacao === a.uid).length;
    if (n && !(await confirmar(`Tirar a personalização ${prefixoArqApl(a)} e os ${n} arquivo(s) dela?`))) return;
    onChange({ aplicacoes: apl.filter((x) => x.uid !== a.uid), anexos: anexos.filter((x) => x.aplicacao !== a.uid) });
  };
  const add = () => onChange({ aplicacoes: [...apl, { uid: novoUid(), metodo: "SILK", local: "PEITO_E", cores: 1, largura: "", altura: "" }] });
  const sel = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
  const medida = (a, k, ph) => <input value={a[k] ?? ""} disabled={travado} onChange={(e) => mudApl(a.uid, { [k]: e.target.value.replace(/[^\d.,]/g, "") })} inputMode="decimal" placeholder={ph}
    className="w-16 px-2 py-1 rounded text-sm text-center" style={{ ...sel, borderColor: String(a[k] ?? "").trim() ? C.line : C.accent }} />;

  return (
    <div className="rounded-xl mt-3 overflow-hidden" style={{ border: `1px solid ${C.navy}33` }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: C.navy, color: "#fff" }}>
        <Brush size={15} /><span className="text-sm font-bold">Detalhes de personalização</span>
        <span className="text-[11px] opacity-80">{apl.length ? `${apl.length} estampa(s)` : "nenhuma estampa"} · {comK.length} arquivo(s) · saem na OP e vão para o PCP</span>
        {!travado && <button type="button" onClick={add} className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: "#fff", color: C.navy }}><Plus size={13} /> Estampa</button>}
      </div>
      <div className="p-3 space-y-2" style={{ background: C.navySoft }}>
        {apl.map((a) => {
          const arqs = comK.filter(({ a: x }) => x.aplicacao === a.uid);
          return (
            <div key={a.uid} className="rounded-lg p-2.5" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div className="flex flex-wrap items-center gap-2">
                <select value={a.metodo} disabled={travado} onChange={(e) => mudApl(a.uid, { metodo: e.target.value, ...(e.target.value === "SILK" ? { cores: a.cores || 1 } : {}) })} className="px-2 py-1 rounded text-sm font-semibold" style={sel}>
                  {[...METODOS_ARTE, ...(METODOS_ARTE.includes(a.metodo) ? [] : [a.metodo])].map((m) => <option key={m} value={m}>{NOME_METODO[m] || m}</option>)}
                </select>
                <select value={a.local || ""} disabled={travado} onChange={(e) => mudApl(a.uid, { local: e.target.value })} className="px-2 py-1 rounded text-sm" style={sel}>
                  {(LOCAIS_APL.some((x) => x[0] === a.local) || !a.local ? LOCAIS_APL : [...LOCAIS_APL, [a.local, nomeLocalApl(a.local)]]).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                {a.metodo === "SILK" && <select value={a.cores || 1} disabled={travado} onChange={(e) => mudApl(a.uid, { cores: Number(e.target.value) })} className="px-2 py-1 rounded text-sm" style={sel}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} cor{n > 1 ? "es" : ""}</option>)}</select>}
                <span className="flex items-center gap-1 text-xs" style={{ color: C.sub }}>Largura {medida(a, "largura", "cm")} × Altura {medida(a, "altura", "cm")} cm</span>
                {a.fpp && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: C.greenSoft, color: C.green }} title="Medidas e arquivos vieram da FPP">da FPP</span>}
                {!travado && <button type="button" onClick={() => tirarApl(a)} className="ml-auto p-1" style={{ color: C.sub }} title="Tirar esta estampa"><Trash2 size={14} /></button>}
              </div>
              <input value={a.obs || ""} disabled={travado} onChange={(e) => mudApl(a.uid, { obs: e.target.value.toUpperCase() })} placeholder="detalhes da estampa (cores Pantone, posição, observações…)"
                className="w-full mt-2 px-2 py-1 rounded text-sm" style={sel} />
              <Soltar travado={travado} onArquivos={(fs) => anexar(fs, a)} className="flex items-center justify-center gap-1.5 mt-2 py-2 rounded-lg text-xs font-semibold"
                style={{ border: `1.5px dashed ${arqs.length ? C.line : C.accent}`, color: arqs.length ? C.sub : C.accent, background: arqs.length ? "#fff" : C.accentSoft }}>
                <Paperclip size={13} /> {arqs.length ? "Mais arquivos desta estampa" : "Arquivos de detalhe desta estampa"} <span className="font-normal">· arraste ou clique</span>
              </Soltar>
              <ListaArq itens={arqs} onTirar={travado ? null : tirarArq} />
            </div>
          );
        })}
        <div className="rounded-lg p-2.5" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <div className="text-xs font-semibold mb-1.5" style={{ color: C.text }}>{apl.length ? "Outros arquivos de personalização" : "Arquivos de personalização"}</div>
          <Soltar travado={travado} onArquivos={(fs) => anexar(fs, null)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
            style={{ border: `1.5px dashed ${C.navy}55`, color: C.navy, background: C.navySoft }}>
            <Paperclip size={13} /> Arraste ou clique para anexar <span className="font-normal">· qualquer formato</span>
          </Soltar>
          <ListaArq itens={gerais} onTirar={travado ? null : tirarArq} />
        </div>
      </div>
    </div>
  );
}

// estampas da FPP → aplicações + arquivos para o item (os que já estão no item não duplicam)
export async function juntarAplicacoesFpp(it, rf, baixar) {
  const doFpp = (Array.isArray(rf?.aplicacoes) ? rf.aplicacoes : []);
  if (!doFpp.length) return {};
  const apl = Array.isArray(it.aplicacoes) ? [...it.aplicacoes] : [];
  const anexos = Array.isArray(it.anexos) ? [...it.anexos] : [];
  for (const a0 of doFpp) {
    const { arquivos, ...a } = a0;
    const uid = `f${rf.numero}-${a.uid}`;
    const ja = apl.findIndex((x) => x.uid === uid);
    if (ja < 0) apl.push({ ...a, uid, fpp: rf.numero });
    else apl[ja] = { ...apl[ja], largura: apl[ja].largura || a.largura, altura: apl[ja].altura || a.altura };
    const ap = apl.find((x) => x.uid === uid);
    for (const x of arquivos || []) {
      const nome = `${prefixoArqApl(ap)} · ${x.nome}`;
      if (anexos.some((y) => y.aplicacao === uid && y.nome === nome)) continue;
      try { const b = await baixar(rf.id, x.id); anexos.push({ nome, mime: x.mime || b.type || null, base64: await readB64(b), categoria: "PERSONALIZACAO", aplicacao: uid }); } catch {}
    }
  }
  return { aplicacoes: apl, anexos };
}
