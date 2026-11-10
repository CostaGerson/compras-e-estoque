"use client";
// v508 — janelas sobrepostas (fundo escuro "fixed inset-0" que fecha ao clicar fora) fechavam quando a pessoa
// selecionava um texto dentro da janela e soltava o mouse fora dela: o navegador dispara o clique no fundo.
// Aqui, para todo o sistema: um clique no fundo só vale se o botão do mouse também desceu no fundo.
// v739 — mais robusto (sugestão #49): guarda o caminho do mousedown (vale mesmo se o campo for redesenhado entre o
//   mousedown e o clique) e não depende mais do tamanho do fundo (fundo dentro de área com transform/rolagem não ocupava
//   a janela inteira e escapava da regra). Bloqueia o clique em qualquer elemento "fixed" que não é controle (botão, link,
//   campo) quando o mouse desceu dentro dele, em outro elemento.
import { useEffect } from "react";

const CONTROLE = "button,a,input,select,textarea,label,summary,[role=button],[role=menuitem],[role=option]";
const ehFundo = (el) => {
  if (!el || el.nodeType !== 1 || el.closest(CONTROLE)) return false;
  const st = getComputedStyle(el);
  return st.position === "fixed" || (st.position === "absolute" && /\binset-0\b/.test(el.className || ""));
};

export default function CliqueFora() {
  useEffect(() => {
    let desceu = null, caminho = [];
    const down = (e) => { desceu = e.target; try { caminho = e.composedPath ? e.composedPath() : []; } catch { caminho = []; } };
    const click = (e) => {
      const alvo = e.target;
      if (desceu && desceu !== alvo && alvo instanceof Element && (caminho.includes(alvo) || alvo.contains(desceu) || !desceu.isConnected) && ehFundo(alvo)) {
        e.stopPropagation(); e.preventDefault();
      }
      desceu = null; caminho = [];
    };
    window.addEventListener("mousedown", down, true);
    window.addEventListener("click", click, true);
    return () => { window.removeEventListener("mousedown", down, true); window.removeEventListener("click", click, true); };
  }, []);
  return null;
}
