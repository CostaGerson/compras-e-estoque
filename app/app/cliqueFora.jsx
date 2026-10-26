"use client";
// v508 — janelas sobrepostas (fundo escuro "fixed inset-0" que fecha ao clicar fora) fechavam quando a pessoa
// selecionava um texto dentro da janela e soltava o mouse fora dela: o navegador dispara o clique no fundo.
// Aqui, para todo o sistema: um clique no fundo só vale se o botão do mouse também desceu no fundo.
import { useEffect } from "react";

const ehFundo = (el) => {
  if (!el || el.nodeType !== 1) return false;
  const st = getComputedStyle(el);
  if (st.position !== "fixed") return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2;
};

export default function CliqueFora() {
  useEffect(() => {
    let desceu = null;
    const down = (e) => { desceu = e.target; };
    const click = (e) => {
      const alvo = e.target;
      if (desceu && desceu !== alvo && alvo instanceof Element && alvo.contains(desceu) && ehFundo(alvo)) { e.stopPropagation(); e.preventDefault(); }
      desceu = null;
    };
    window.addEventListener("mousedown", down, true);
    window.addEventListener("click", click, true);
    return () => { window.removeEventListener("mousedown", down, true); window.removeEventListener("click", click, true); };
  }, []);
  return null;
}
