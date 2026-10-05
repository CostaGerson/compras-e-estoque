// Toda conta da NORT tem o título no padrão "NORT - NOME DA CONTA" (inclusive INSS e FGTS).
// É NORT a conta que: vem de uma recorrência NORT|…, tem rateio em conta-caixa da NORT (grupo NORT da DRE)
// ou traz NORT no título, no fornecedor ou no número do documento.
import { prisma } from "@/lib/prisma";

const sem = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const temNort = (s) => /(^|[^A-Z])NORT([^A-Z]|$)/.test(sem(s));

export function tituloNort(titulo, extra = "") {
  const t = String(titulo || "").toUpperCase().trim();
  if (/^NORT - \S/.test(t)) return t;
  // tira o NORT de onde estiver e os separadores que sobram
  let base = t.replace(/(^|[^A-ZÀ-Ú])NORT(?=[^A-ZÀ-Ú]|$)/g, "$1").replace(/\s*[—–-]\s*$/, "").replace(/^\s*[—–:\-]\s*/, "").replace(/\s{2,}/g, " ").trim();
  if (!base) {   // título era só "NORT": usa o que o documento diz (INSS, FGTS…)
    const x = sem(extra);
    base = /\bINSS\b/.test(x) ? "INSS" : /\bFGTS\b/.test(x) ? "FGTS" : "CONTA";
  }
  return `NORT - ${base}`.slice(0, 120);
}

export async function contasNort() {
  const { mapaDeContas } = await import("@/lib/finDre");
  const m = await mapaDeContas();
  return new Set(m.filter((c) => c.grupo === "NORT").map((c) => c.id));
}

// Padroniza recorrências e contas em aberto da NORT (roda a cada abertura de contas a pagar/receber)
export async function padronizarNort() {
  const ids = await contasNort();
  const nortRateio = (r) => Array.isArray(r) && r.length && r.every((x) => ids.has(Number(x.contaId)));
  let n = 0;
  const recs = await prisma.finRecorrencia.findMany({ select: { id: true, titulo: true, parceiro: true, rateio: true, chaveOrigem: true } });
  const recNort = new Set();
  for (const r of recs) {
    if (!(String(r.chaveOrigem || "").startsWith("NORT|") || nortRateio(r.rateio) || temNort(r.titulo) || temNort(r.parceiro))) continue;
    recNort.add(r.id);
    const t = tituloNort(r.titulo, r.chaveOrigem);
    if (t !== r.titulo) { await prisma.finRecorrencia.update({ where: { id: r.id }, data: { titulo: t } }); n++; }
  }
  const tits = await prisma.finTitulo.findMany({ where: { status: { not: "CANCELADO" } }, select: { id: true, titulo: true, parceiro: true, numeroDoc: true, rateio: true, recorrenciaId: true } });
  for (const x of tits) {
    if (!(recNort.has(x.recorrenciaId) || nortRateio(x.rateio) || temNort(x.titulo) || temNort(x.parceiro) || temNort(x.numeroDoc))) continue;
    const t = tituloNort(x.titulo, `${x.numeroDoc || ""} ${x.parceiro || ""}`);
    if (t !== x.titulo) { await prisma.finTitulo.update({ where: { id: x.id }, data: { titulo: t } }); n++; }
  }
  return n;
}
