"use client";
// v393 — ordenar QUALQUER lista do sistema pelo título da coluna: 1º clique crescente / A→Z, 2º decrescente / Z→A, 3º volta à ordem original.
// Funciona em todas as <table> com <thead> (sem mexer tela por tela). Regras:
// · tabela com data-sem-ordenar, ou que já tem ordenação própria (botão "Ordenar" no título), fica de fora
// · linha de detalhe (uma célula ocupando várias colunas) acompanha a linha de cima; linhas "Total…" ficam no fim
// · números BR (1.234,56 · R$ · %), datas dd/mm/aaaa e texto (pt-BR, números dentro do texto em ordem natural)
// · a ordem escolhida se mantém quando a tela atualiza os dados
import { useEffect } from "react";

const NUM = /^\(?-?\s*(R\$)?\s*-?\s*\d{1,3}(\.\d{3})*(,\d+)?\s*%?\)?$|^\(?-?\s*(R\$)?\s*-?\s*\d+(,\d+)?\s*%?\)?$/;
function valor(txt) {
  const t = String(txt || "").replace(/\s+/g, " ").trim();
  if (!t || t === "—" || t === "-") return null;
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { n: Number(`${m[3]}${m[2]}${m[1]}`) };
  m = t.match(/^(\d{2})\/(\d{4})$/);
  if (m) return { n: Number(`${m[2]}${m[1]}00`) };
  const limpo = t.replace(/\b(pç|pçs|peças|un|dias?)\b/gi, "").trim();
  if (NUM.test(limpo)) {
    const neg = /^\(|-/.test(limpo);
    const n = Number(limpo.replace(/[^\d,]/g, "").replace(",", "."));
    if (Number.isFinite(n)) return { n: neg ? -n : n };
  }
  return { s: t };
}

function celula(tr, idx) {
  let c = 0;
  for (const td of tr.cells) { const span = td.colSpan || 1; if (idx >= c && idx < c + span) return td; c += span; }
  return null;
}
const colunas = (table) => { const r = table.tHead?.rows[table.tHead.rows.length - 1]; let n = 0; if (r) for (const th of r.cells) n += th.colSpan || 1; return n; };

// grupos: linha principal + linhas de detalhe abaixo; "Total" fixo no fim
function grupos(tbody, ncol) {
  const g = [], fim = [], porChave = {};
  // linha de detalhe marcada (data-anexo="chave") vai com a linha principal de mesma data-chave, onde quer que o React a tenha inserido
  const marcadas = [];
  for (const tr of [...tbody.rows]) {
    if (tr.dataset.anexo && tr.dataset.anexo !== "") { marcadas.push(tr); continue; }
    const unica = tr.cells.length === 1 && (tr.cells[0].colSpan || 1) > 1 && (tr.cells[0].colSpan >= ncol / 2);
    if (/^\s*total/i.test(tr.cells[0]?.innerText || "") || tr.dataset.fixo !== undefined) { fim.push(tr); continue; }
    if ((unica || tr.dataset.anexo !== undefined) && g.length) { g[g.length - 1].push(tr); continue; }
    if (!tr.dataset.ordOrig) tr.dataset.ordOrig = String(g.length);
    g.push([tr]);
    if (tr.dataset.chave) porChave[tr.dataset.chave] = g[g.length - 1];
  }
  for (const tr of marcadas) { const grp = porChave[tr.dataset.anexo]; if (grp) grp.push(tr); else if (g.length) g[g.length - 1].push(tr); }
  return { g, fim };
}

function aplicar(table) {
  const th = table.tHead && table.tHead.querySelector("th[data-ord]");
  const ncol = colunas(table);
  for (const tbody of table.tBodies) {
    if ([...tbody.rows].some((tr) => [...tr.cells].some((td) => (td.rowSpan || 1) > 1))) continue;   // rowspan: não mexe
    const { g, fim } = grupos(tbody, ncol);
    if (g.length < 2) continue;
    let ord;
    if (!th) ord = [...g].sort((a, b) => Number(a[0].dataset.ordOrig || 0) - Number(b[0].dataset.ordOrig || 0));
    else {
      const idx = Number(th.dataset.ordCol), dir = th.dataset.ord === "desc" ? -1 : 1;
      const vs = g.map((grp, i) => ({ grp, i, v: valor(celula(grp[0], idx)?.innerText) }));
      const numerica = vs.filter((x) => x.v).every((x) => x.v.n !== undefined);
      vs.sort((a, b) => {
        if (!a.v && !b.v) return a.i - b.i;
        if (!a.v) return 1;
        if (!b.v) return -1;   // vazios sempre no fim
        const c = numerica ? a.v.n - b.v.n : String(a.v.s ?? a.v.n).localeCompare(String(b.v.s ?? b.v.n), "pt-BR", { numeric: true, sensitivity: "base" });
        return c * dir || a.i - b.i;
      });
      ord = vs.map((x) => x.grp);
    }
    const desejado = [...ord.flat(), ...fim];
    if (desejado.every((tr, i) => tbody.rows[i] === tr)) continue;   // já está na ordem: não toca no DOM (evita laço com o observador)
    for (const tr of desejado) tbody.appendChild(tr);
  }
}

export default function OrdenarTabelas() {
  useEffect(() => {
    // tabela que já ordena sozinha (algum título/botão do cabeçalho tem onClick do React) fica de fora
    const temClique = (el) => { const k = Object.keys(el).find((x) => x.startsWith("__reactProps")); return !!(k && el[k] && el[k].onClick); };
    const propria = (table) => {
      if (table.dataset.ordPropria !== undefined) return table.dataset.ordPropria === "1";
      const r = [...table.tHead.querySelectorAll("th, th *")].some(temClique);
      table.dataset.ordPropria = r ? "1" : "0";
      return r;
    };
    const ativa = (table) => table && table.tHead && !table.closest("[data-sem-ordenar]") && !table.tHead.querySelector('button[title="Ordenar"]') && !propria(table);
    const onClick = (e) => {
      const th = e.target.closest && e.target.closest("thead th");
      if (!th || e.target.closest("button, input, select, a, label, textarea")) return;
      const table = th.closest("table");
      if (!ativa(table) || (th.colSpan || 1) > 1 || !th.innerText.trim()) return;
      // índice da coluna (considerando colspan)
      let idx = 0; for (const c of th.parentElement.cells) { if (c === th) break; idx += c.colSpan || 1; }
      const atual = th.dataset.ord;
      table.tHead.querySelectorAll("th[data-ord]").forEach((x) => { delete x.dataset.ord; delete x.dataset.ordCol; });
      const prox = !atual ? "asc" : atual === "asc" ? "desc" : null;
      if (prox) { th.dataset.ord = prox; th.dataset.ordCol = String(idx); }
      aplicar(table);
    };
    document.addEventListener("click", onClick);
    // a tela atualizou a lista: reaplica a ordem escolhida
    let fila = new Set(), agendado = false;
    const obs = new MutationObserver((ms) => {
      for (const m of ms) { const t = m.target.closest && m.target.closest("table"); if (t && t.tHead && t.tHead.querySelector("th[data-ord]")) fila.add(t); }
      if (fila.size && !agendado) { agendado = true; requestAnimationFrame(() => { agendado = false; const l = [...fila]; fila = new Set(); l.forEach((t) => { try { aplicar(t); } catch {} }); }); }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { document.removeEventListener("click", onClick); obs.disconnect(); };
  }, []);
  return (
    <style>{`
      table:not([data-sem-ordenar]) thead th { cursor: pointer; user-select: none; }
      table thead th[data-ord="asc"]::after { content: " ▲"; font-size: 9px; color: #FF6B1A; }
      table thead th[data-ord="desc"]::after { content: " ▼"; font-size: 9px; color: #FF6B1A; }
    `}</style>
  );
}
