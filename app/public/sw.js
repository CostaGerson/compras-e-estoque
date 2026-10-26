// v454 — service worker: torna o sistema instalável como app (não guarda nada em cache)
// v466 — recebe as notificações (Web Push) e abre o sistema ao tocar
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { texto: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "ERP Meridian", {
    body: d.texto || "", icon: "/icon-192.png", badge: "/favicon.png", tag: d.tag || undefined, renotify: !!d.tag,
    vibrate: [200, 100, 200], requireInteraction: true, data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) { if ("focus" in c) { await c.focus(); if ("navigate" in c) c.navigate(url).catch(() => {}); return; } }
    return self.clients.openWindow(url);
  })());
});
