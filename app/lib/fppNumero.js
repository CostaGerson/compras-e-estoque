// Nº único das FPPs: 00001, 00002… pela data de criação. As antigas são numeradas uma vez, na ordem em que foram criadas.
import { prisma } from "@/lib/prisma";

export const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "");

let numerando = null;
export async function garantirNumeros() {
  if (numerando) return numerando;
  numerando = (async () => {
    const faltam = await prisma.fpp.findMany({ where: { numero: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
    if (!faltam.length) return 0;
    const max = (await prisma.fpp.aggregate({ _max: { numero: true } }))._max.numero || 0;
    let n = max;
    for (const f of faltam) await prisma.fpp.update({ where: { id: f.id }, data: { numero: ++n } });
    return faltam.length;
  })();
  try { return await numerando; } finally { numerando = null; }
}

// cria a FPP já com o próximo número (tenta de novo se duas forem salvas ao mesmo tempo)
// campo Json com null não pode ir direto ao Prisma: some do create (o banco grava nulo)
const semJsonNulo = (d) => { const o = { ...d }; for (const k of ["entradas", "overrides", "resultados"]) if (o[k] === null || o[k] === undefined) delete o[k]; if (!o.entradas) o.entradas = {}; if (!o.resultados) o.resultados = {}; return o; };
export async function criarComNumero(data0) {
  const data = semJsonNulo(data0);
  await garantirNumeros();
  for (let i = 0; i < 6; i++) {
    const max = (await prisma.fpp.aggregate({ _max: { numero: true } }))._max.numero || 0;
    try { return await prisma.fpp.create({ data: { ...data, numero: max + 1 } }); }
    catch (e) { if (e?.code !== "P2002") throw e; }
  }
  throw new Error("Não foi possível numerar a FPP. Tente de novo.");
}

// ---- negociações: todo nome usado numa FPP fica salvo para aparecer na lista ----
const normNeg = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();
export async function registrarNegociacao(nome) {
  const n = normNeg(nome);
  if (!n) return;
  await prisma.fppNegociacao.upsert({ where: { nome: n }, create: { nome: n }, update: {} }).catch(() => null);
}
export async function listarNegociacoes() {
  const usadas = await prisma.fpp.findMany({ where: { negociacao: { not: null } }, select: { negociacao: true }, distinct: ["negociacao"] });
  const salvas = await prisma.fppNegociacao.findMany({ select: { nome: true } });
  const ja = new Set(salvas.map((x) => x.nome));
  for (const u of usadas) { const n = normNeg(u.negociacao); if (n && !ja.has(n)) { await registrarNegociacao(n); ja.add(n); } }
  return [...ja].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
