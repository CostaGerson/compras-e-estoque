// v557 — Fretes (CT-e) na Análise da logística: Frete compra, Frete entrega e Fretes baixados.
// O CT-e é subido no movimento fiscal (conta a pagar em FiscalNota) e os dados logísticos ficam em FreteCte.
// As ligações são resolvidas na leitura, pela chave das NFs atendidas: NF no movimento fiscal (ou no Compras),
// OC da NF de compra (baixa da OC = frete entregue) e pedido da NF de saída (ou dos itens da OC).
import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/finTitulos";

const DIA = 86400000;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const semZ = (x) => String(x ?? "").trim().replace(/^0+(?=\d)/, "");
const up = (s) => String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // America/Sao_Paulo
const dias = (a, b) => (a && b ? Math.round((dataUTC(b) - dataUTC(a)) / DIA) : null);
const numOuNull = (v) => (v == null || v === "" ? null : Number(v));

/* ---------------- NFs atendidas ---------------- */
// chaves → NFs que já estão no sistema (movimento fiscal; senão, NF de entrada lançada pelo Compras)
export async function nfsDasChaves(chaves = []) {
  const cs = [...new Set((chaves || []).filter((c) => /^\d{44}$/.test(String(c))))];
  if (!cs.length) return [];
  const fs = await prisma.fiscalNota.findMany({ where: { chave: { in: cs }, NOT: { modelo: "CT-e" } },
    select: { id: true, chave: true, numero: true, emissao: true, valor: true, parceiro: true, tipo: true, ocId: true, temXml: true, temPdf: true, pedidoNumero: true, parcelas: true } });
  const ja = new Set(fs.map((f) => f.chave));
  const resto = cs.filter((c) => !ja.has(c));
  const cp = resto.length ? await prisma.notaFiscal.findMany({ where: { chave: { in: resto } },
    select: { id: true, chave: true, numero: true, dataEmissao: true, valorTotal: true, temXml: true, temPdf: true, fornecedor: { select: { nome: true, nomeFantasia: true, razaoSocial: true } } } }).catch(() => []) : [];
  const out = [
    ...fs.map((f) => ({ fonte: "FISCAL", id: f.id, chave: f.chave, numero: semZ(f.numero), emissao: iso(f.emissao), valor: r2(f.valor), parceiro: f.parceiro, tipo: f.tipo, ocId: f.ocId, temXml: f.temXml, temPdf: f.temPdf, pedidoNumero: f.pedidoNumero || null })),
    ...cp.map((n) => ({ fonte: "COMPRAS", id: n.id, chave: n.chave, numero: semZ(n.numero), emissao: iso(n.dataEmissao), valor: r2(n.valorTotal), parceiro: n.fornecedor?.nomeFantasia || n.fornecedor?.nome || n.fornecedor?.razaoSocial || null, tipo: "ENTRADA", ocId: null, temXml: n.temXml, temPdf: n.temPdf, pedidoNumero: null })),
  ];
  // NF ainda não subida: aparece só pela chave
  for (const c of cs) if (!out.some((x) => x.chave === c)) out.push({ fonte: null, id: null, chave: c, numero: String(Number(c.slice(25, 34))), emissao: null, valor: null, parceiro: null, tipo: null, ocId: null, temXml: false, temPdf: false, pedidoNumero: null });
  return out;
}

/* ---------------- gravação (chamada pelo movimento fiscal) ---------------- */
export async function gravarFrete(fiscalNotaId, n, { completar = false } = {}) {
  const c = n.cte || {};
  const pdfSo = n.fonte === "PDF";
  const data = {
    chave: c.chave || n.chave, numero: semZ(n.numero || c.numero), serie: c.serie || n.serie || null, tipo: c.tipo === "ENTREGA" ? "ENTREGA" : "COMPRA",
    emissao: dataUTC(n.emissao || c.emissao), transportadora: String(n.parceiro || c.transportadora || "SEM NOME").toUpperCase(), transpCnpj: c.transpCnpj || n.documento || null,
    origemCidade: c.origemCidade || null, origemUf: c.origemUf || null, destinoCidade: c.destinoCidade || null, destinoUf: c.destinoUf || null,
    remetente: c.remetente || null, remetenteCnpj: c.remetenteCnpj || null, destinatario: c.destinatario || null, destinatarioCnpj: c.destinatarioCnpj || null, tomador: c.tomador || null,
    valorFrete: r2(pdfSo ? n.valor : c.valorFrete || n.valor), valorCarga: c.valorCarga != null ? r2(c.valorCarga) : null,
    volumes: numOuNull(c.volumes), pesoKg: numOuNull(c.pesoKg), previsaoEntrega: c.previsaoEntrega ? dataUTC(c.previsaoEntrega) : null,
    chavesNf: Array.isArray(c.chavesNf) ? c.chavesNf : [],
  };
  if (!/^\d{44}$/.test(String(data.chave || ""))) throw new Error("CT-e sem chave de acesso.");
  const ex = await prisma.freteCte.findFirst({ where: { OR: [{ fiscalNotaId: Number(fiscalNotaId) }, { chave: data.chave }] } });
  if (ex) {
    // completar (XML depois do PDF): os dados do XML valem; a baixa manual é mantida
    const upd = completar ? data : Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    return prisma.freteCte.update({ where: { id: ex.id }, data: { ...upd, fiscalNotaId: Number(fiscalNotaId) } });
  }
  return prisma.freteCte.create({ data: { ...data, fiscalNotaId: Number(fiscalNotaId) } });
}

/* ---------------- montagem (ligações resolvidas na leitura) ---------------- */
async function montar(fs) {
  if (!fs.length) return [];
  const chaves = [...new Set(fs.flatMap((f) => (Array.isArray(f.chavesNf) ? f.chavesNf : [])))];
  const nfs = await nfsDasChaves(chaves);
  const nfDe = new Map(nfs.map((x) => [x.chave, x]));
  const ocIds = [...new Set(nfs.map((x) => x.ocId).filter(Boolean))];
  const ocs = ocIds.length ? await prisma.ordemCompra.findMany({ where: { id: { in: ocIds } },
    select: { id: true, numero: true, status: true, baixaEm: true, baixaPorNome: true, previsaoEntrega: true,
      itens: { select: { picItem: { select: { info: true } } } }, fornecedor: { select: { nome: true, nomeFantasia: true } } } }) : [];
  const ocDe = new Map(ocs.map((o) => [o.id, o]));
  // pedido das NFs de saída: casamento (FiscalNota.pedidoNumero ou nfsFaturadas do pedido)
  const saidas = nfs.filter((x) => x.tipo === "SAIDA" && x.fonte === "FISCAL");
  const pedDaNf = new Map();
  if (saidas.length) {
    for (const x of saidas) if (x.pedidoNumero) pedDaNf.set(x.chave, x.pedidoNumero);
    const peds = await prisma.pedidoVenda.findMany({ where: { NOT: { nfsFaturadas: { equals: null } } }, select: { numero: true, nfsFaturadas: true } }).catch(() => []);
    for (const p of peds) for (const n of Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []) {
      const alvo = saidas.find((x) => (n.fiscalNotaId && n.fiscalNotaId === x.id) || (n.chave && n.chave === x.chave) || (!n.chave && !n.fiscalNotaId && semZ(n.numero) === x.numero));
      if (alvo && !pedDaNf.has(alvo.chave)) pedDaNf.set(alvo.chave, p.numero);
    }
  }
  const fiscais = await prisma.fiscalNota.findMany({ where: { id: { in: fs.map((f) => f.fiscalNotaId) } }, select: { id: true, temXml: true, temPdf: true, parcelas: true, acao: true, motivo: true } });
  const fnDe = new Map(fiscais.map((x) => [x.id, x]));
  const tIds = fiscais.flatMap((x) => (Array.isArray(x.parcelas) ? x.parcelas : []).map((p) => Number(p.tituloId))).filter(Boolean);
  const ts = tIds.length ? await prisma.finTitulo.findMany({ where: { id: { in: tIds } }, select: { id: true, titulo: true, valor: true, vencimento: true, status: true, dataPagamento: true } }) : [];
  const tDe = new Map(ts.map((t) => [t.id, t]));
  const hoje = hojeISO();

  return fs.map((f) => {
    const ns = (Array.isArray(f.chavesNf) ? f.chavesNf : []).map((c) => nfDe.get(c)).filter(Boolean);
    const valorNfReal = ns.every((x) => x.valor != null) && ns.length ? r2(ns.reduce((s, x) => s + x.valor, 0)) : null;
    const valorNf = valorNfReal ?? (f.valorCarga != null ? r2(f.valorCarga) : null);
    const ocsF = [...new Set(ns.map((x) => x.ocId).filter(Boolean))].map((id) => ocDe.get(id)).filter(Boolean);
    const ocBaixa = ocsF.length && ocsF.every((o) => o.baixaEm) ? ocsF.map((o) => o.baixaEm).sort((a, b) => b - a)[0] : null;
    const entregue = f.entregueEm ? iso(f.entregueEm) : ocBaixa ? iso(ocBaixa) : null;
    const pedidos = [...new Set([
      ...ns.map((x) => pedDaNf.get(x.chave)).filter(Boolean),
      ...ocsF.flatMap((o) => o.itens.flatMap((i) => (i.picItem?.info?.pedidos || []).filter((p) => !p.avulsa && p.pedido).map((p) => String(p.pedido)))),
    ])];
    const fn = fnDe.get(f.fiscalNotaId);
    const contas = (Array.isArray(fn?.parcelas) ? fn.parcelas : []).map((p) => tDe.get(Number(p.tituloId))).filter(Boolean)
      .map((t) => ({ id: t.id, titulo: t.titulo, valor: r2(t.valor), vencimento: iso(t.vencimento), status: t.status, dataPagamento: iso(t.dataPagamento) }));
    const emissaoNf = ns.map((x) => x.emissao).filter(Boolean).sort()[0] || null;
    const prev = iso(f.previsaoEntrega);
    const ref = entregue || hoje;
    return {
      id: f.id, fiscalNotaId: f.fiscalNotaId, tipo: f.tipo, chave: f.chave, numero: f.numero, serie: f.serie,
      emissao: iso(f.emissao), transportadora: f.transportadora, transpCnpj: f.transpCnpj,
      origem: [f.origemCidade, f.origemUf].filter(Boolean).join(" - ") || null, destino: [f.destinoCidade, f.destinoUf].filter(Boolean).join(" - ") || null,
      remetente: f.remetente || (f.tipo === "COMPRA" ? ns.find((x) => x.parceiro)?.parceiro : ns.length ? "MERIDIAN" : null) || null, remetenteCnpj: f.remetenteCnpj, destinatario: f.destinatario, tomador: f.tomador,
      valorFrete: r2(f.valorFrete), valorNf, valorNfEstimado: valorNfReal == null && valorNf != null, valorCarga: f.valorCarga != null ? r2(f.valorCarga) : null,
      pct: valorNf ? r2((Number(f.valorFrete) / valorNf) * 100) : null,
      volumes: f.volumes != null ? Number(f.volumes) : null, pesoKg: f.pesoKg != null ? Number(f.pesoKg) : null,
      emissaoNf, previsaoEntrega: prev, entregue, entregaManual: !!f.entregueEm, entregaPor: f.entregueEm ? f.entregaPorNome : ocsF[0]?.baixaPorNome || null, entregaObs: f.entregaObs || null,
      baixado: !!entregue,
      diasTransporte: dias(iso(f.emissao), ref),          // CT-e → entrega (ou até hoje, em trânsito)
      diasNfEntrega: emissaoNf ? dias(emissaoNf, ref) : null,
      atraso: prev ? Math.max(0, dias(prev, ref)) : null,
      nfs: ns, ocs: ocsF.map((o) => ({ id: o.id, numero: o.numero, status: o.status, baixaEm: iso(o.baixaEm), fornecedor: o.fornecedor?.nomeFantasia || o.fornecedor?.nome || null })),
      pedidos, contas, cteXml: !!fn?.temXml, ctePdf: !!fn?.temPdf, semConta: fn?.acao === "REGISTRADA" ? fn.motivo || "só registro" : null,
    };
  });
}

// guia: COMPRA | ENTREGA (pendentes) | BAIXADOS (todos os entregues)
export async function listarFretes({ guia = "COMPRA", de, ate, busca } = {}) {
  const where = {};
  if (guia === "COMPRA" || guia === "ENTREGA") where.tipo = guia;
  if (de || ate) where.emissao = { ...(de ? { gte: dataUTC(de) } : {}), ...(ate ? { lte: dataUTC(ate) } : {}) };
  const fs = await prisma.freteCte.findMany({ where, orderBy: [{ emissao: "desc" }, { id: "desc" }], take: 3000 });
  let l = await montar(fs);
  l = l.filter((f) => (guia === "BAIXADOS" ? f.baixado : !f.baixado));
  const b = up(busca);
  if (b) l = l.filter((f) => up(`${f.numero} ${f.transportadora} ${f.remetente || ""} ${f.destinatario || ""} ${f.origem || ""} ${f.destino || ""} ${f.nfs.map((x) => x.numero).join(" ")} ${f.pedidos.join(" ")} ${f.ocs.map((o) => o.numero).join(" ")}`).includes(b));
  const cont = await prisma.freteCte.groupBy({ by: ["tipo"], _count: true }).catch(() => []);
  return { fretes: l, total: { fretes: l.length, frete: r2(l.reduce((s, f) => s + f.valorFrete, 0)), nf: r2(l.reduce((s, f) => s + (f.valorNf || 0), 0)) }, porTipo: Object.fromEntries(cont.map((c) => [c.tipo, c._count])) };
}

export async function registrarEntrega(id, { data, obs }, quem) {
  const f = await prisma.freteCte.findUnique({ where: { id: Number(id) } });
  if (!f) return { error: "Frete não encontrado." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return { error: "Informe a data da entrega." };
  if (data < iso(f.emissao)) return { error: "A entrega não pode ser antes da emissão do CT-e." };
  if (data > hojeISO()) return { error: "A data da entrega não pode ser futura." };
  await prisma.freteCte.update({ where: { id: f.id }, data: { entregueEm: dataUTC(data), entregaPorNome: quem || null, entregaObs: String(obs || "").trim().slice(0, 300) || null } });
  return { ok: true };
}
export async function desfazerEntrega(id) {
  await prisma.freteCte.update({ where: { id: Number(id) }, data: { entregueEm: null, entregaPorNome: null, entregaObs: null } });
  return { ok: true };
}

// arquivos da linha: cte-xml | cte-pdf | nf-xml | nf-pdf (nf: chave da NF)
export async function arquivoFrete(id, arq, chaveNf) {
  const f = await prisma.freteCte.findUnique({ where: { id: Number(id) }, select: { fiscalNotaId: true, numero: true, chavesNf: true } });
  if (!f) return null;
  const pdf = arq.endsWith("pdf");
  if (arq.startsWith("cte")) {
    const n = await prisma.fiscalNota.findUnique({ where: { id: f.fiscalNotaId }, select: { xml: true, xmlNome: true, pdf: true, pdfNome: true } });
    if (!n || !(pdf ? n.pdf : n.xml)) return null;
    return { pdf, buf: pdf ? Buffer.from(n.pdf, "base64") : Buffer.from(n.xml, "utf8"), nome: (pdf ? n.pdfNome : n.xmlNome) || `CT-e ${f.numero}.${pdf ? "pdf" : "xml"}` };
  }
  const chaves = Array.isArray(f.chavesNf) ? f.chavesNf : [];
  const ch = chaves.includes(chaveNf) ? chaveNf : chaves[0];
  if (!ch) return null;
  const n = await prisma.fiscalNota.findFirst({ where: { chave: ch, NOT: { modelo: "CT-e" } }, select: { numero: true, xml: true, xmlNome: true, pdf: true, pdfNome: true } });
  if (n && (pdf ? n.pdf : n.xml)) return { pdf, buf: pdf ? Buffer.from(n.pdf, "base64") : Buffer.from(n.xml, "utf8"), nome: (pdf ? n.pdfNome : n.xmlNome) || `NF ${n.numero}.${pdf ? "pdf" : "xml"}` };
  const c = await prisma.notaFiscal.findFirst({ where: { chave: ch }, select: { numero: true, arquivoXml: true, arquivoPdf: true } }).catch(() => null);
  if (c && (pdf ? c.arquivoPdf : c.arquivoXml)) {
    const raw = pdf ? c.arquivoPdf : c.arquivoXml;
    const buf = pdf ? Buffer.from(raw, "base64") : (/^\s*</.test(raw) ? Buffer.from(raw, "utf8") : Buffer.from(raw, "base64"));
    return { pdf, buf, nome: `NF ${semZ(c.numero)}.${pdf ? "pdf" : "xml"}` };
  }
  return null;
}

// fretes do pedido (aba Financeiro): entrega pelas NFs casadas; compra pelas OCs cujos itens vieram do pedido
export async function fretesDoPedido(p, fiscalNotaIds = []) {
  const numero = String(p.numero);
  const chavesSaida = [];
  const ids = fiscalNotaIds.filter(Boolean);
  if (ids.length) for (const n of await prisma.fiscalNota.findMany({ where: { id: { in: ids } }, select: { chave: true } })) if (n.chave) chavesSaida.push(n.chave);
  for (const n of Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []) if (n.chave && !chavesSaida.includes(n.chave)) chavesSaida.push(n.chave);
  // OCs com item de compra do pedido → NFs de compra → CT-es
  const pis = await prisma.picItem.findMany({ where: { info: { path: ["pedidos"], array_contains: [{ pedido: numero }] } }, select: { id: true } }).catch(() => []);
  let chavesCompra = [];
  if (pis.length) {
    const ocIds = [...new Set((await prisma.ocItem.findMany({ where: { picItemId: { in: pis.map((x) => x.id) } }, select: { ocId: true } })).map((x) => x.ocId))];
    if (ocIds.length) chavesCompra = (await prisma.fiscalNota.findMany({ where: { ocId: { in: ocIds }, chave: { not: null } }, select: { chave: true } })).map((x) => x.chave);
  }
  const todas = [...new Set([...chavesSaida, ...chavesCompra])];
  if (!todas.length) return [];
  const fs = await prisma.freteCte.findMany({ where: { OR: todas.map((c) => ({ chavesNf: { array_contains: [c] } })) }, orderBy: { emissao: "asc" } });
  return montar(fs);
}
