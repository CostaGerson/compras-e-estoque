"use client";
// v466 — botão para ligar as notificações no celular (Web Push). No iPhone só funciona com o app instalado na tela inicial.
import React, { useEffect, useState } from "react";

const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
const ehIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

async function inscrever(usuarioId) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const { publicKey } = await fetch("/api/push").then((r) => r.json());
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
  await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId, acao: "inscrever", sub: sub.toJSON(), aparelho: navigator.userAgent }) });
}

export default function AvisosPush({ user, C, rotulo = "avisos de nova rota", compacto }) {   // v551 — rótulo e versão compacta (agenda)
  const [st, setSt] = useState("...");   // sem | ios | pedir | ok | negado | erro
  const suporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  useEffect(() => {
    if (ehIOS() && !instalado()) return setSt("ios");
    if (!suporte) return setSt("sem");
    if (Notification.permission === "denied") return setSt("negado");
    if (Notification.permission === "granted") { inscrever(user.id).then(() => setSt("ok")).catch(() => setSt("erro")); return; }
    setSt("pedir");
  }, []);
  const ligar = async () => {
    try {
      const p = await Notification.requestPermission();
      if (p !== "granted") return setSt(p === "denied" ? "negado" : "pedir");
      await inscrever(user.id); setSt("ok");
      fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "teste" }) }).catch(() => {});
    } catch { setSt("erro"); }
  };
  if (st === "ok" || st === "..." || st === "sem") return null;
  const caixa = { background: C.yellowSoft, color: C.yellow };
  if (st === "ios") return <div className="rounded-2xl px-4 py-3 text-sm font-semibold" style={caixa}>🔔 Para receber {rotulo} no iPhone: toque em Compartilhar › <b>Adicionar à Tela de Início</b> e abra o sistema pelo ícone.</div>;
  if (st === "negado") return <div className="rounded-2xl px-4 py-3 text-sm font-semibold" style={caixa}>🔕 As notificações estão bloqueadas. Libere em Configurações do celular › Notificações › ERP Meridian (ou do navegador).</div>;
  if (compacto) return <button type="button" onClick={ligar} className="rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5" style={{ background: C.navy, color: "#fff" }}>🔔 {st === "erro" ? "Tentar de novo" : `Ativar ${rotulo}`}</button>;
  return (
    <button type="button" onClick={ligar} className="w-full rounded-2xl font-extrabold flex items-center justify-center gap-2 shadow-md" style={{ background: C.navy, color: "#fff", minHeight: 56, fontSize: 17 }}>
      🔔 {st === "erro" ? `Tentar de novo: ativar ${rotulo}` : `Ativar ${rotulo}`}
    </button>
  );
}
