// v427 — Google Maps Platform (chave GOOGLE_MAPS_KEY no .env da VPS): autocomplete de endereço (Places API New),
// geolocalização (Geocoding API) e distância/tempo por ruas (Routes API · Compute Route Matrix), com cache dos trechos.
import { prisma } from "@/lib/prisma";

export const temGoogle = () => !!process.env.GOOGLE_MAPS_KEY;
const KEY = () => process.env.GOOGLE_MAPS_KEY;
const BH = { latitude: -19.92, longitude: -44.0 };

function compDe(comps, tipo, curto = false) {
  const c = (comps || []).find((x) => (x.types || []).includes(tipo));
  return c ? (curto ? c.shortText || c.short_name : c.longText || c.long_name) : null;
}

// sugestões enquanto digita
export async function autocompletar(texto, sessao) {
  if (String(texto || "").trim().length < 3) return [];
  if (!temGoogle()) throw new Error("Chave do Google não configurada na VPS (GOOGLE_MAPS_KEY no .env).");   // v431
  const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY() },
    body: JSON.stringify({ input: texto, sessionToken: sessao || undefined, languageCode: "pt-BR", includedRegionCodes: ["br"],
      locationBias: { circle: { center: BH, radius: 50000 } } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Google: HTTP ${r.status}`);
  return (j.suggestions || []).map((s) => s.placePrediction).filter(Boolean).map((p) => ({
    placeId: p.placeId, texto: p.text?.text || "", principal: p.structuredFormat?.mainText?.text || "", secundario: p.structuredFormat?.secondaryText?.text || "",
  }));
}

// lugar escolhido: endereço completo + coordenadas
export async function lugar(placeId, sessao) {
  if (!temGoogle() || !placeId) return null;
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR${sessao ? `&sessionToken=${encodeURIComponent(sessao)}` : ""}`, {
    cache: "no-store", headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "formattedAddress,location,addressComponents,displayName" },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Google: HTTP ${r.status}`);
  return {
    endereco: j.formattedAddress || "", lat: j.location?.latitude ?? null, lng: j.location?.longitude ?? null, nome: j.displayName?.text || null,
    municipio: compDe(j.addressComponents, "administrative_area_level_2") || compDe(j.addressComponents, "locality"),
    uf: compDe(j.addressComponents, "administrative_area_level_1", true),
  };
}

// endereço digitado → coordenadas
export async function geocodificar(endereco) {
  if (!temGoogle()) return null;
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?region=br&language=pt-BR&address=${encodeURIComponent(endereco)}&key=${KEY()}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (j.status === "ZERO_RESULTS") return null;
  if (j.status !== "OK") throw new Error(`Google: ${j.status}${j.error_message ? ` · ${j.error_message}` : ""}`);
  const x = j.results[0];
  return { lat: x.geometry.location.lat, lng: x.geometry.location.lng,
    municipio: compDe(x.address_components, "administrative_area_level_2") || compDe(x.address_components, "locality"), uf: compDe(x.address_components, "administrative_area_level_1", true) };
}

// distância e tempo por ruas entre todos os pontos (com cache de cada trecho)
const k5 = (p) => `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`;
export async function matrizRuas(pontos) {
  const out = {};
  const ok = pontos.filter((p) => p && p.lat != null && p.lng != null);
  if (!temGoogle() || ok.length < 2) return out;
  const uniq = [...new Map(ok.map((p) => [k5(p), p])).values()];
  const chaves = []; for (const a of uniq) for (const b of uniq) if (a !== b) chaves.push(`${k5(a)}|${k5(b)}`);
  const cache = await prisma.rotaTrecho.findMany({ where: { chave: { in: chaves } } }).catch(() => []);
  for (const c of cache) out[c.chave] = { km: c.metros / 1000, min: c.segundos / 60 };
  const faltaOrig = uniq.filter((a) => uniq.some((b) => a !== b && !out[`${k5(a)}|${k5(b)}`]));
  if (!faltaOrig.length) return out;
  const wp = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
  // até 25 origens × 25 destinos por chamada
  for (let i = 0; i < faltaOrig.length; i += 25) {
    const origs = faltaOrig.slice(i, i + 25);
    const r = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition" },
      body: JSON.stringify({ origins: origs.map(wp), destinations: uniq.slice(0, 25).map(wp), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(j)) throw new Error(j?.error?.message || j?.[0]?.error?.message || `Google rotas: HTTP ${r.status}`);
    const novos = [];
    for (const e of j) {
      if (e.condition && e.condition !== "ROUTE_EXISTS") continue;
      const a = origs[e.originIndex], b = uniq[e.destinationIndex];
      if (!a || !b || a === b) continue;
      const chave = `${k5(a)}|${k5(b)}`;
      const seg = parseInt(String(e.duration || "0").replace("s", ""), 10) || 0;
      out[chave] = { km: (e.distanceMeters || 0) / 1000, min: seg / 60 };
      novos.push({ chave, metros: e.distanceMeters || 0, segundos: seg });
    }
    if (novos.length) await prisma.rotaTrecho.createMany({ data: novos, skipDuplicates: true }).catch(() => null);
  }
  return out;
}
export const chaveTrecho = (a, b) => `${k5(a)}|${k5(b)}`;
