"use client";
// v636 — modo demonstração: uma chave no topo oculta os números (valores, percentuais e quantidades) sem mexer nos dados.
// · gestão, financeiro, comercial e RH: oculta todos os números (menos datas, horas e códigos/nºs de pedido com 6+ dígitos)
// · demais telas: oculta valores em R$ e percentuais
// Usa a CSS Custom Highlight API (não altera o DOM do React); no SVG dos gráficos e em campos de digitação, desfoca o elemento.
import React, { useEffect, useState } from "react";
import { EyeOff, Eye } from "lucide-react";

const K = "ce_demo";
const RX_DINHEIRO = /R\$\s?-?\s?[\d.,]+(?:\s?(?:mil|mi|bi|k)\b)?/gi;
const RX_PCT = /-?\d+(?:[.,]\d+)?\s?%/g;
const RX_NUM = /(?<![\d/:.,A-Za-z-])-?(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+|\d{1,5})(?![\d/:]|[.,]\d)/g;
const lerDemo = () => { try { return localStorage.getItem(K) === "1"; } catch { return false; } };

export function useChaveDemo() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(lerDemo()); const f = () => setOn(lerDemo()); window.addEventListener("ce-demo", f); return () => window.removeEventListener("ce-demo", f); }, []);
  const trocar = () => { try { localStorage.setItem(K, on ? "0" : "1"); } catch {} window.dispatchEvent(new Event("ce-demo")); };
  return [on, trocar];
}

export function ChaveDemo({ mobile }) {
  const [on, trocar] = useChaveDemo();
  return (
    <button onClick={trocar} title={on ? "Modo demonstração ligado — números ocultos (clique para mostrar)" : "Modo demonstração: ocultar os números de gestão e finanças"}
      className="flex items-center gap-1.5 select-none" style={{ color: on ? "#FF6B1A" : "#667085" }}>
      {/* v752 — só o olho (sem a palavra e sem a chave) */}
      {on ? <EyeOff size={mobile ? 18 : 16} /> : <Eye size={mobile ? 18 : 16} />}
    </button>
  );
}

// aplica a ocultação enquanto ligado; `tudo` = oculta qualquer número (telas de gestão/finanças)
export function useModoDemo(tudo) {
  const [on] = useChaveDemo();
  useEffect(() => {
    if (!on || typeof document === "undefined") return;
    const raiz = document.body;
    const hl = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
    let est = document.getElementById("ce-demo-css");
    if (!est) { est = document.createElement("style"); est.id = "ce-demo-css"; document.head.appendChild(est); }
    // v661 · v676 (mais forte) — números embaçados (como no gráfico), sem tarja: texto transparente + sombra desfocada no lugar
    est.textContent = `::highlight(ce-demo){color:transparent;background-color:transparent;text-shadow:0 0 14px rgba(31,39,51,.7),4px 0 14px rgba(31,39,51,.55),-4px 0 14px rgba(31,39,51,.55),0 0 22px rgba(31,39,51,.4);}
      [data-demo-oculto]{filter:blur(11px)!important;user-select:none;}`;
    const marcados = new Set();
    const regexes = tudo ? [RX_DINHEIRO, RX_PCT, RX_NUM] : [RX_DINHEIRO, RX_PCT];
    const trechos = (txt) => {
      const r = [];
      for (const rx of regexes) { rx.lastIndex = 0; let m; while ((m = rx.exec(txt))) { if (/\d/.test(m[0])) r.push([m.index, m.index + m[0].length]); } }
      return r;
    };
    const livre = (el) => !el || !!el.closest("[data-demo-livre],script,style,noscript");
    const marcar = (el) => { if (el && !el.hasAttribute("data-demo-oculto")) { el.setAttribute("data-demo-oculto", ""); } marcados.add(el); };
    let t = null;
    const varrer = () => {
      t = null;
      const vistos = new Set(), ranges = [];
      const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const v = n.nodeValue;
        if (!v || !/\d/.test(v)) continue;
        const pai = n.parentElement;
        if (livre(pai)) continue;
        const tr = trechos(v);
        if (!tr.length) continue;
        if (!hl || pai.closest("svg")) { const alvo = pai.closest("text") || pai; marcar(alvo); vistos.add(alvo); continue; }
        for (const [a, b] of tr) { const r = new Range(); r.setStart(n, a); r.setEnd(n, b); ranges.push(r); }
      }
      for (const el of raiz.querySelectorAll("input,textarea")) {
        if (livre(el) || ["checkbox", "radio", "date", "time", "file", "button", "submit"].includes(el.type)) continue;
        if (trechos(String(el.value || "")).length) { marcar(el); vistos.add(el); }
      }
      for (const el of [...marcados]) if (!vistos.has(el)) { el.removeAttribute("data-demo-oculto"); marcados.delete(el); }
      if (hl) CSS.highlights.set("ce-demo", new Highlight(...ranges));
    };
    const agendar = () => { if (!t) t = setTimeout(varrer, 120); };
    varrer();
    const ob = new MutationObserver(agendar);
    ob.observe(raiz, { subtree: true, childList: true, characterData: true });
    raiz.addEventListener("input", agendar, true);
    return () => {
      ob.disconnect(); raiz.removeEventListener("input", agendar, true); if (t) clearTimeout(t);
      if (hl) CSS.highlights.delete("ce-demo");
      for (const el of marcados) el.removeAttribute("data-demo-oculto");
      est.textContent = "";
    };
  }, [on, tudo]);
  return on;
}
