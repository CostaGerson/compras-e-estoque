"use client";
// v625 — artigos internos (tipos de malha e tecido plano): seletor com busca e cadastro (Cadastros › Artigos › Artigos internos)
import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";
import { tipoDoTexto } from "@/lib/artigosInternos";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", red: "#D92D20" };
let _cache = null, _esperando = null;
export async function carregarTipos(forcar = false) {
  if (_cache && !forcar) return _cache;
  if (!_esperando || forcar) _esperando = fetch("/api/artigos/internos").then((r) => r.json()).then((l) => (_cache = Array.isArray(l) ? l : [])).catch(() => []);
  return _esperando;
}
export function useTiposInternos() {
  const [l, setL] = useState(_cache || []);
  useEffect(() => { carregarTipos().then(setL); }, []);
  return l;
}
export const ehCategoriaTipo = (c) => c === "MALHA" || c === "TECIDO";
// sugere o tipo pelo texto (nome da NF / artigo interno antigo)
export const sugerirTipo = (txt, categoria, tipos) => tipoDoTexto(txt, tipos.filter((t) => t.categoria === categoria))?.nome || "";

// select do artigo interno (malha/tecido): os tipos cadastrados; valor fora da lista aparece marcado para trocar
export function SeletorTipo({ categoria, valor, onChange, className = "", style = {} }) {
  const tipos = useTiposInternos();
  const lista = tipos.filter((t) => t.categoria === categoria);
  const dentro = lista.some((t) => t.nome === valor);
  return (
    <select value={dentro ? valor : ""} onChange={(e) => onChange(e.target.value)} className={className} style={{ ...style, ...(dentro ? {} : { borderColor: C.accent }) }}>
      <option value="">{valor && !dentro ? `${valor} — escolha o tipo` : `— escolha o ${categoria === "MALHA" ? "tipo de malha" : "tipo de tecido plano"} —`}</option>
      {lista.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
    </select>
  );
}

// aba de cadastro
export function ArtigosInternosPane() {
  const [l, setL] = useState(null);
  const carregar = () => carregarTipos(true).then(setL);
  useEffect(() => { carregar(); }, []);
  const post = async (body) => { const r = await fetch("/api/artigos/internos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const x = await r.json().catch(() => ({})); if (!r.ok || x.error) alerta(x.error || "Erro."); carregar(); };
  const novo = async (categoria) => { const n = await perguntar(`Novo artigo interno de ${categoria === "MALHA" ? "MALHA" : "TECIDO PLANO"}:`, ""); if (n && n.trim()) post({ categoria, nome: n }); };
  const renomear = async (t) => { const n = await perguntar(`Renomear "${t.nome}" (os artigos já cadastrados com o nome antigo continuam casando pelo texto):`, t.nome); if (n && n.trim() && n.trim().toUpperCase() !== t.nome) post({ id: t.id, nome: n }); };
  const tirar = async (t) => { if (!(await confirmar(`Tirar "${t.nome}" da lista de artigos internos?`))) return; await fetch("/api/artigos/internos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id }) }); carregar(); };
  if (!l) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  return (
    <div>
      <p className="text-sm mb-4" style={{ color: C.sub }}>O <b>artigo interno</b> de malha e tecido plano é sempre um destes tipos. O levantamento casa a demanda dos pedidos com o estoque pelo <b>tipo + cor</b> (e o código, quando a demanda tem código) — não pelo nome que veio na NF.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {[["MALHA", "Malha"], ["TECIDO", "Plano (tecido)"]].map(([cat, rot]) => {
          const ls = l.filter((t) => t.categoria === cat);
          return (
            <div key={cat} className="rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-center px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                <span className="font-semibold flex-1" style={{ color: C.navy }}>{rot} <span className="text-xs font-normal" style={{ color: C.sub }}>· {ls.length}</span></span>
                <button onClick={() => novo(cat)} className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 text-white" style={{ background: C.accent }}><Plus size={13} /> Novo</button>
              </div>
              {ls.map((t) => (
                <div key={t.id} className="group flex items-center px-4 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.panel2}` }}>
                  <span className="flex-1" style={{ color: C.text }}>{t.nome}</span>
                  {t.id > 0 && <><button onClick={() => renomear(t)} className="opacity-0 group-hover:opacity-100 p-1" title="Renomear" style={{ color: C.sub }}><Pencil size={13} /></button>
                    <button onClick={() => tirar(t)} className="opacity-0 group-hover:opacity-100 p-1" title="Tirar" style={{ color: C.red }}><Trash2 size={13} /></button></>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
