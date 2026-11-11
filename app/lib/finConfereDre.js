// v784 — conferência do documento com a DRE do mês (pedido do Igor, 11/11/2026):
//   todo lançamento que aparece no documento (extrato, fatura, cobrança, folha…) tem de aparecer nos lançamentos do mês
//   que formam a DRE, com o mesmo valor e o sinal certo (crédito +, débito −).
//   Extrato: cada linha do PDF tem de estar entre os lançamentos do arquivo. Se foi trocada pelo detalhamento
//   (substituída) ou desmembrada, conta pelo que a substituiu (as partes têm de somar o valor).
//   Detalhamento: cada item tem de estar entre os lançamentos de detalhe do mês (só entra depois de conciliado com o extrato).
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function linhasDoDocumento(a) {
  const { lerArquivo, LEITORES, LEITORES_DETALHE } = await import("@/lib/finParse");
  if (LEITORES_DETALHE[a.tipo.codigo]) return { detalhe: true, linhas: (a.itens?.itens || []).map((i) => ({ data: i.data, historico: norm(i.historico), valor: r2(i.valor) })) };
  if (!LEITORES[a.tipo.codigo]) return null;
  if (Array.isArray(a.linhasDoc)) return { detalhe: false, linhas: a.linhasDoc };
  // arquivo lido antes da v784: lê o PDF uma vez e guarda
  const full = await prisma.finArquivo.findUnique({ where: { id: a.id }, select: { conteudo: true, senhaPdf: true } });
  const r = await lerArquivo(a.tipo.codigo, Buffer.from(full.conteudo, "base64"), full.senhaPdf);
  const linhas = r.lancamentos.map((l) => ({ data: l.data, historico: String(l.historico || "").toUpperCase(), valor: Number(l.valor) }));
  await prisma.finArquivo.update({ where: { id: a.id }, data: { linhasDoc: linhas } }).catch(() => null);
  return { detalhe: false, linhas };
}

export async function conferirComDre(arquivoId) {
  const a = await prisma.finArquivo.findUnique({ where: { id: Number(arquivoId) }, select: { id: true, competencia: true, processado: true, parcial: true, itens: true, linhasDoc: true, tipo: { select: { codigo: true } } } });
  if (!a || !a.processado) return null;
  let doc;
  try { doc = await linhasDoDocumento(a); } catch (e) { return { ok: false, msg: `Não consegui reler o documento: ${e.message}`, faltando: [], sinal: [] }; }
  if (!doc) return null;
  if (!doc.linhas.length) return { ok: null, msg: "Documento sem lançamentos.", total: 0, faltando: [], sinal: [] };

  let pool;
  if (!doc.detalhe) {
    const ls = await prisma.finLancamento.findMany({ where: { arquivoId: a.id, origem: "EXTRATO" }, select: { id: true, data: true, valor: true, substituido: true, desmembrado: true } });
    const desm = ls.filter((l) => l.desmembrado).map((l) => l.id);
    const partes = desm.length ? await prisma.finLancamento.findMany({ where: { paiId: { in: desm } }, select: { paiId: true, valor: true } }) : [];
    const somaPartes = {}; for (const p of partes) somaPartes[p.paiId] = r2((somaPartes[p.paiId] || 0) + Number(p.valor));
    pool = ls.map((l) => ({ data: iso(l.data), valor: r2(l.valor), ok: !l.desmembrado || Math.abs((somaPartes[l.id] ?? 0) - r2(l.valor)) < 0.01, usado: false }));
  } else {
    const ls = await prisma.finLancamento.findMany({ where: { competencia: a.competencia, origem: "DETALHE" }, select: { data: true, valor: true, historico: true, desmembrado: true } });
    pool = ls.map((l) => ({ data: iso(l.data), valor: r2(l.valor), historico: norm(l.historico), ok: true, usado: false }));
  }
  const faltando = [], sinal = [], partesErradas = [];
  for (const l of doc.linhas) {
    const v = r2(l.valor), d = iso(l.data);
    const achar = (f) => pool.find((p) => !p.usado && f(p));
    let p = doc.detalhe
      ? achar((p) => p.valor === v && p.historico === l.historico) || achar((p) => p.valor === v)
      : achar((p) => p.data === d && p.valor === v) || achar((p) => p.valor === v);
    if (p) { p.usado = true; if (!p.ok) partesErradas.push({ data: d, historico: l.historico, valor: v }); continue; }
    p = doc.detalhe ? achar((p) => p.valor === -v) : achar((p) => p.data === d && p.valor === -v) || achar((p) => p.valor === -v);
    if (p) { p.usado = true; sinal.push({ data: d, historico: l.historico, valor: v }); continue; }
    faltando.push({ data: d, historico: l.historico, valor: v });
  }
  const ok = !faltando.length && !sinal.length && !partesErradas.length;
  const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const ex = (l) => `${iso(l.data).split("-").reverse().join("/")} ${l.historico} ${brl(l.valor)}`;
  const msg = ok ? `Os ${doc.linhas.length} lançamentos do documento estão na DRE do mês com o sinal certo.`
    : [faltando.length && `${faltando.length} fora da DRE${doc.detalhe ? " (detalhamento ainda não conciliado com o extrato?)" : ""}: ${faltando.slice(0, 5).map(ex).join("; ")}${faltando.length > 5 ? "…" : ""}`,
      sinal.length && `${sinal.length} com o sinal trocado: ${sinal.slice(0, 5).map(ex).join("; ")}${sinal.length > 5 ? "…" : ""}`,
      partesErradas.length && `${partesErradas.length} desmembrado(s) cujas partes não somam o valor: ${partesErradas.slice(0, 3).map(ex).join("; ")}`].filter(Boolean).join(" · ");
  return { ok, total: doc.linhas.length, faltando, sinal, partesErradas, msg };
}
