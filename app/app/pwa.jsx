"use client";
import { useEffect } from "react";
// v454 — registra o service worker para o sistema poder ser instalado na tela inicial do celular
export default function Pwa() {
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  return null;
}
