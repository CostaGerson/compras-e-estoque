// v230.1 — número em formato BR ou JS, sem engolir a vírgula/ponto decimal.
//   50,10 → 50.1 · 1.234,56 → 1234.56 · 50.1 (número JS) → 50.1 · 1.234 → 1234 · 12.5 → 12.5
export function numBR(v) {
  if (v === "" || v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/R\$|%|\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, "");   // ponto de milhar
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}
