"use client";
// v994 — padrão das listas (guia Dados e demais): título da coluna alinhado ao conteúdo e ordenando ao clicar;
// busca em campo branco com lupa; selects brancos
import React from "react";
import { Search, X } from "lucide-react";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085" };
export const SEL_BRANCO = { background: C.panel, color: C.text, border: `1px solid ${C.line}` };
export const THEAD = { background: C.panel2, color: C.sub };

// sort = { key, dir: "asc" | "desc" }
export function ThO({ label, k, sort, onSort, dir: alin = "left", className = "", style, children }) {
  const on = k && sort?.key === k;
  return <th onClick={k ? () => onSort(k) : undefined} className={`px-3 py-2 font-semibold whitespace-nowrap ${alin === "right" ? "text-right" : alin === "center" ? "text-center" : "text-left"} ${k ? "cursor-pointer select-none" : ""} ${className}`} style={style}>
    {label}{on ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}{children}</th>;
}

export function BuscaLista({ value, onChange, placeholder, rotulo = "Buscar", className = "flex-1 min-w-64" }) {
  return <div className={className}>
    {rotulo && <div className="text-xs mb-1" style={{ color: C.sub }}>{rotulo}</div>}
    <div className="flex items-center gap-2 px-2 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
      <Search size={14} style={{ color: C.sub }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="py-1.5 text-sm outline-none flex-1 bg-transparent" style={{ color: C.text }} />
      {value && <button onClick={() => onChange("")} style={{ color: C.sub }}><X size={13} /></button>}
    </div>
  </div>;
}

// ordenação genérica: getv(item) → valor; números e datas comparados como tal, texto em pt-BR
export function ordenarPor(lista, getv, dir) {
  const v = (x) => { const y = getv(x); if (y == null || y === "") return null; if (typeof y === "number") return y; if (y instanceof Date) return +y; return String(y); };
  const arr = [...lista].sort((a, b) => {
    const x = v(a), y = v(b);
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x).localeCompare(String(y), "pt-BR", { sensitivity: "base", numeric: true });
  });
  return dir === "desc" ? arr.reverse() : arr;
}
export const alternar = (setSort) => (k) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
