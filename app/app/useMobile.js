"use client";
// v550 — tela de celular (largura < 768px): o sistema troca layouts de desktop por versões de toque
import { useEffect, useState } from "react";
export const LARG_MOBILE = 768;
export function useMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < LARG_MOBILE);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}
