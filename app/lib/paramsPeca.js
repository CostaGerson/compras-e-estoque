// v917 — parâmetros de produção: nomes do KM/item padrão casados com os campos do tipo de peça (antes em pedidoEditor.jsx)
import { paramFora } from "./pedidoLanc";
// v801 — #71: campo de estampa (texto longo, uma linha por aplicação)
export const nkParam = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b(DA|DO|DE|DAS|DOS|E)\b/g, " ").replace(/\s+/g, " ").trim();
export const ehEstampa = (c) => /ESTAMP/.test(nkParam(c));
// v801 — #72: parâmetros do KM → campos do tipo de peça. Casa pelo nome normalizado (sem acento, sem "da/de/do", plural);
//   o que não casa entra em maiúsculas; nomes repetidos no KM juntam o texto em vez de virar dois campos
const singular = (w) => w.length > 3 ? w.replace(/S$/, "") : w;
const chaveParam = (t) => nkParam(t).split(" ").map(singular).join(" ");
// v917 — #88: parâmetros com nome do KM/item padrão ("GOLA DA JAQUETA") entram no campo do tipo de peça ("GOLA") — sem campo duplicado
export function fundirParams(params, comps = []) {
  if (!params || !comps.length) return params || {};
  const lista = Object.entries(params).filter(([k]) => k !== "TECIDO" && !comps.includes(k)).map(([t, v]) => ({ t, v: typeof v === "string" ? v : v == null ? "" : String(v) }));
  if (!lista.length) return params;
  const novo = paramsDoKm(lista, comps);
  const out = Object.fromEntries(Object.entries(params).filter(([k]) => k === "TECIDO" || comps.includes(k)));
  for (const [k, v] of Object.entries(novo)) {
    const atual = String(out[k] ?? "").trim();
    out[k] = !atual ? v : atual.toUpperCase().includes(String(v).toUpperCase()) ? out[k] : `${out[k]}\n${v}`;
  }
  return out;
}
export function paramsDoKm(lista, comps = []) {
  const porChave = new Map(comps.filter((c) => c !== "TECIDO").map((c) => [chaveParam(c), c]));
  const acha = (t) => {
    const k = chaveParam(t);
    if (porChave.has(k)) return porChave.get(k);
    const pk = k.split(" ");
    for (const [kc, c] of porChave) { const pc = kc.split(" "); if (pc[0] === pk[0] && (pc.every((w) => pk.includes(w)) || pk.every((w) => pc.includes(w)))) return c; }
    return String(t).trim().toUpperCase();
  };
  const out = {};
  for (const x of Array.isArray(lista) ? lista : []) {
    if (!x?.t || !String(x.v || "").trim() || paramFora(x.t)) continue;
    const nome = acha(x.t), v = String(x.v).trim();
    if (!out[nome]) out[nome] = v;
    else if (!out[nome].toUpperCase().includes(v.toUpperCase())) out[nome] = `${out[nome]}\n${v}`;
  }
  return out;
}
