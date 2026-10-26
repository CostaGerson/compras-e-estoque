// v454 — service worker mínimo: só torna o sistema instalável como app (não guarda nada em cache)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
