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

// v432 — número digitado pelo usuário (ex.: "rua mato grosso, 676" → "676")
function numeroDigitado(t, rua) {
  const daRua = new Set(String(rua || "").match(/\d+/g) || []);   // "Rua 2" → o 2 é nome da rua, não o número
  for (const m of String(t || "").matchAll(/(?:,|\bn[º°o.]?\s*|\s)(\d{1,6})(?=\s*(?:[,\-–]|$|\s+[a-zA-Z]))/gi)) if (!daRua.has(m[1])) return m[1];
  return null;
}

// lugar escolhido: endereço completo + coordenadas
// v432 — quando o Google sugere só a rua (sem número), junta o número digitado e localiza o endereço exato
export async function lugar(placeId, sessao, digitado) {
  const g = await lugarBase(placeId, sessao);
  if (!g || g.numero) return g;
  const num = numeroDigitado(digitado, g.rua);
  if (!num || !g.rua) return g;
  const completo = [`${g.rua}, ${num}`, g.bairro, g.municipio && g.uf ? `${g.municipio} - ${g.uf}` : g.municipio].filter(Boolean).join(", ");
  const x = await geocodificar(completo).catch(() => null);
  if (x?.endereco && x.numero) return { ...g, endereco: x.endereco, lat: x.lat, lng: x.lng, numero: x.numero, cep: x.cep || g.cep };
  return { ...g, numero: num, endereco: `${g.rua}, ${num}${g.endereco.startsWith(g.rua) ? g.endereco.slice(g.rua.length) : ` - ${g.endereco}`}` };
}
async function lugarBase(placeId, sessao) {
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
    numero: compDe(j.addressComponents, "street_number"), rua: compDe(j.addressComponents, "route"),
    bairro: compDe(j.addressComponents, "sublocality_level_1") || compDe(j.addressComponents, "sublocality"),
    cep: compDe(j.addressComponents, "postal_code"),   // v433
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
  return { lat: x.geometry.location.lat, lng: x.geometry.location.lng, endereco: x.formatted_address, numero: compDe(x.address_components, "street_number"), cep: compDe(x.address_components, "postal_code"),
    municipio: compDe(x.address_components, "administrative_area_level_2") || compDe(x.address_components, "locality"), uf: compDe(x.address_components, "administrative_area_level_1", true) };
}

// distância e tempo por ruas entre todos os pontos (com cache de cada trecho)
// v441 — com "quando" (data/hora de saída no futuro) usa o trânsito previsto pelo Google (TRAFFIC_AWARE);
// o cache passa a ser por dia da semana + hora (ex.: |1-08 = segunda às 8h)
const k5 = (p) => `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`;
function faixa(quando) {
  if (!quando) return null;
  const d = new Date(quando);
  if (isNaN(d)) return null;
  const br = new Date(d.getTime() - 3 * 3600e3);   // horário de Brasília
  return `${br.getUTCDay()}-${String(br.getUTCHours()).padStart(2, "0")}`;
}
export async function matrizRuas(pontos, quando) {
  const out = {};
  const ok = pontos.filter((p) => p && p.lat != null && p.lng != null);
  if (!temGoogle() || ok.length < 2) return out;
  let saida = quando ? new Date(quando) : null;
  if (saida && !isNaN(saida) && saida.getTime() < Date.now() + 60e3) saida = new Date(Date.now() + 2 * 60e3);   // passado: usa agora
  const transito = !!saida && !isNaN(saida);
  const fx = transito ? faixa(saida) : null;
  const ch = (a, b) => `${k5(a)}|${k5(b)}${fx ? `|${fx}` : ""}`;
  const uniq = [...new Map(ok.map((p) => [k5(p), p])).values()];
  const chaves = []; for (const a of uniq) for (const b of uniq) if (a !== b) chaves.push(ch(a, b));
  const cache = await prisma.rotaTrecho.findMany({ where: { chave: { in: chaves } } }).catch(() => []);
  const porCh = Object.fromEntries(cache.map((c) => [c.chave, c]));
  for (const a of uniq) for (const b of uniq) if (a !== b) { const c = porCh[ch(a, b)]; if (c) out[`${k5(a)}|${k5(b)}`] = { km: c.metros / 1000, min: c.segundos / 60 }; }
  const faltaOrig = uniq.filter((a) => uniq.some((b) => a !== b && !out[`${k5(a)}|${k5(b)}`]));
  if (!faltaOrig.length) return out;
  const wp = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
  // limite por chamada: 625 elementos sem trânsito, 100 com trânsito
  const passo = transito ? 10 : 25;
  for (let i = 0; i < faltaOrig.length; i += passo) for (let j = 0; j < uniq.length; j += passo) {
    const origs = faltaOrig.slice(i, i + passo), dests = uniq.slice(j, j + passo);
    const r = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition" },
      body: JSON.stringify({ origins: origs.map(wp), destinations: dests.map(wp), travelMode: "DRIVE",
        ...(transito ? { routingPreference: "TRAFFIC_AWARE", departureTime: saida.toISOString() } : { routingPreference: "TRAFFIC_UNAWARE" }) }),
    });
    const jj = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(jj)) throw new Error(jj?.error?.message || jj?.[0]?.error?.message || `Google rotas: HTTP ${r.status}`);
    const novos = [];
    for (const e of jj) {
      if (e.condition && e.condition !== "ROUTE_EXISTS") continue;
      const a = origs[e.originIndex], b = dests[e.destinationIndex];
      if (!a || !b || a === b) continue;
      const seg = parseInt(String(e.duration || "0").replace("s", ""), 10) || 0;
      out[`${k5(a)}|${k5(b)}`] = { km: (e.distanceMeters || 0) / 1000, min: seg / 60 };
      novos.push({ chave: ch(a, b), metros: e.distanceMeters || 0, segundos: seg });
    }
    if (novos.length) await prisma.rotaTrecho.createMany({ data: novos, skipDuplicates: true }).catch(() => null);
  }
  return out;
}
export const chaveTrecho = (a, b) => `${k5(a)}|${k5(b)}`;
