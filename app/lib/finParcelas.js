// v543 — parcelas da mesma NF: ao editar o valor de uma, as demais em aberto são refeitas para a soma continuar
// igual ao valor da nota (mesma regra da importação: o que falta é dividido igualmente entre as parcelas em aberto
// que não foram editadas à mão; o arredondamento vai para a última). Cada alteração fica registrada em `alteracoes`.
import { prisma } from "@/lib/prisma";
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (n) => `R$ ${r2(n).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const dBR = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10).split("-").reverse().join("/");
const agora = () => new Date().toISOString();

// rótulo "1/3" da parcela
export function rotuloParcela(t) {
  const m = `${t.titulo || ""} ${t.numeroDoc || ""}`.match(/\((\d+)\s*\/\s*(\d+)\)|(\d+)\s*\/\s*(\d+)|PARC\s*(\d+)/i);
  return m ? (m[1] ? `${m[1]}/${m[2]}` : m[3] ? `${m[3]}/${m[4]}` : m[5]) : `#${t.id}`;
}

// outras parcelas da mesma nota (mesmo tipo, não canceladas), incluindo a própria
export async function parcelasDaNota(t) {
  const ck = String(t.chaveImport || "");
  let l = [];
  if (/^(NFE|NFSE|ARQ|RETNF)\|/.test(ck) && ck.includes("|")) {
    const base = ck.startsWith("RETNF|") ? ck.split("|").slice(0, 2).join("|") : ck.slice(0, ck.lastIndexOf("|"));
    l = await prisma.finTitulo.findMany({ where: { tipo: t.tipo, status: { not: "CANCELADO" }, chaveImport: { startsWith: `${base}|` } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] });
  }
  if (l.length < 2) {   // pelo movimento fiscal (parcelas gravadas na nota)
    const regs = await prisma.fiscalNota.findMany({ where: { tipo: t.tipo === "RECEBER" ? "SAIDA" : "ENTRADA", ...(t.documento ? { documento: t.documento } : {}) }, select: { parcelas: true }, orderBy: { id: "desc" }, take: 300 }).catch(() => []);
    const reg = regs.find((r) => (Array.isArray(r.parcelas) ? r.parcelas : []).some((p) => Number(p.tituloId) === t.id));
    const ids = reg ? reg.parcelas.map((p) => Number(p.tituloId)).filter(Boolean) : [];
    if (ids.length > 1) l = await prisma.finTitulo.findMany({ where: { id: { in: ids }, status: { not: "CANCELADO" } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] });
  }
  if (l.length < 2) {   // "1973-1/3" + mesmo CNPJ
    const m = String(t.numeroDoc || "").match(/^0*(\d+)\s*-\s*\d+\s*\/\s*(\d+)/);
    if (m && Number(m[2]) > 1 && t.documento) {
      const cand = await prisma.finTitulo.findMany({ where: { tipo: t.tipo, documento: t.documento, status: { not: "CANCELADO" }, numeroDoc: { startsWith: m[1] } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] });
      l = cand.filter((x) => { const k = String(x.numeroDoc || "").match(/^0*(\d+)\s*-\s*\d+\s*\/\s*(\d+)/); return k && k[1] === m[1] && k[2] === m[2]; });
    }
  }
  return l.length > 1 && l.some((x) => x.id === t.id) ? l : [];
}

const manualValor = (x) => (Array.isArray(x.alteracoes) ? x.alteracoes : []).some((a) => a.campo === "valor" && a.manual);
export const registro = (x, campo, texto, por, manual = false) =>
  [...(Array.isArray(x.alteracoes) ? x.alteracoes : []), { campo, texto: String(texto).slice(0, 400), em: agora(), por: por || null, ...(manual ? { manual: true } : {}) }].slice(-20);

// t = título antes da edição; novo = valor novo. Devolve { ajustes: [{ id, de, para }], erro } e grava as irmãs.
export async function rebalancear(t, novo, por) {
  const l = await parcelasDaNota(t);
  if (!l.length) return { ajustes: [] };
  const total = r2(l.reduce((s, x) => s + Number(x.valor), 0));   // valor da nota (soma antes da edição)
  const outras = l.filter((x) => x.id !== t.id);
  const abertas = outras.filter((x) => x.status === "ABERTO");
  let livres = abertas.filter((x) => !manualValor(x));
  if (!livres.length && abertas.length) livres = [abertas[abertas.length - 1]];
  if (!livres.length) return { erro: `As outras parcelas desta nota já estão ${outras.length ? "baixadas" : "ausentes"}: não há como manter a soma em ${brl(total)}. Ajuste o valor pela nota.` };
  const fixo = r2(novo + outras.filter((x) => !livres.includes(x)).reduce((s, x) => s + Number(x.valor), 0));
  const resto = Math.round((total - fixo) * 100);
  if (resto < 0) return { erro: `Com ${brl(novo)} nesta parcela, a soma passa do valor da nota (${brl(total)}).` };
  const base = Math.floor(resto / livres.length);
  const ajustes = [];
  const rt = rotuloParcela(t);
  for (const [j, x] of livres.entries()) {
    const v = (base + (j === livres.length - 1 ? resto - base * livres.length : 0)) / 100;
    if (v <= 0) return { erro: `Com ${brl(novo)} nesta parcela, a parcela ${rotuloParcela(x)} ficaria zerada.` };
    if (Math.abs(v - Number(x.valor)) < 0.005) continue;
    ajustes.push({ x, de: Number(x.valor), para: v });
  }
  for (const a of ajustes) {
    await prisma.finTitulo.update({ where: { id: a.x.id }, data: { valor: a.para, atualizadoPorNome: por || null,
      alteracoes: registro(a.x, "valor", `Valor ajustado de ${brl(a.de)} para ${brl(a.para)} porque a parcela ${rt} mudou de ${brl(t.valor)} para ${brl(novo)} (soma da nota mantida em ${brl(total)}) — ${por || "—"}, ${dBR(new Date())}.`, por) } });
  }
  return { total, ajustes: ajustes.map((a) => ({ id: a.x.id, parcela: rotuloParcela(a.x), de: a.de, para: a.para })) };
}
