// v494 — NF do fornecedor na OC: ligação com o movimento fiscal, conferência (itens, quantidades, valores, prazos, CNPJ),
// correção da OC pela NF, aceite de CNPJ e exclusão da nota da OC.
import { prisma } from "@/lib/prisma";
import { parseXmlNfe } from "@/lib/nf";
import { lerXmlTitulo } from "@/lib/finTitulos";
import { salvarOc, statusNfItens } from "@/lib/pic";

const so = (v) => String(v || "").replace(/\D/g, "");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const dia = 86400e3;

// estado da OC a partir das NFs ligadas
async function refazNfOc(ocId) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: ocId } });
  const nfs = await prisma.fiscalNota.findMany({ where: { ocId }, orderBy: { emissao: "asc" }, select: { numero: true, emissao: true } });
  const data = nfs.length
    ? { nfNumero: nfs.map((n) => n.numero).join(", ").slice(0, 120), nfEmissao: nfs[0].emissao, nfEm: oc.nfEm || new Date(), ...(["ABERTA", "ENVIADA"].includes(oc.status) ? { status: "NF_EMITIDA" } : {}) }
    : { nfNumero: null, nfEmissao: null, nfEm: null, ...(oc.status === "NF_EMITIDA" ? { status: "ENVIADA" } : {}) };
  await prisma.ordemCompra.update({ where: { id: ocId }, data });
  await statusNfItens(ocId);   // refaz o status "NF emitida" dos itens de compra
}
export async function ligarNfOc(ocId, fiscalNotaId) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(ocId) } });
  if (!oc) return { error: "OC não encontrada." };
  await prisma.fiscalNota.update({ where: { id: Number(fiscalNotaId) }, data: { ocId: oc.id } });
  await refazNfOc(oc.id);
  return { ok: true };
}
export async function desligarNfOc(ocId, fiscalNotaId, excluir, quem) {
  const n = await prisma.fiscalNota.findFirst({ where: { id: Number(fiscalNotaId), ocId: Number(ocId) } });
  if (!n) return { error: "Nota não está nesta OC." };
  await prisma.fiscalNota.update({ where: { id: n.id }, data: { ocId: null } });
  let contas = 0;
  if (excluir) { const { excluirRegistro } = await import("@/lib/fiscal"); const r = await excluirRegistro(n.id, quem); if (r?.error) return r; contas = r?.contas || 0; }
  await refazNfOc(Number(ocId));
  return { ok: true, contas };
}

// condição de pagamento → dias (ex.: "30/60/90", "28 DDL", "à vista")
export function diasDaCondicao(t) {
  const s = norm(t);
  if (!s) return null;
  if (/VISTA|ANTECIPAD/.test(s)) return [0];
  const ns = (s.match(/\d+/g) || []).map(Number).filter((n) => n >= 0 && n <= 365);
  return ns.length ? ns : null;
}
const parecido = (a, b) => {
  const A = new Set(norm(a).split(" ").filter((x) => x.length > 1)), B = new Set(norm(b).split(" ").filter((x) => x.length > 1));
  if (!A.size || !B.size) return 0;
  let c = 0; for (const x of A) if (B.has(x)) c++;
  return c / Math.max(A.size, B.size);
};

export async function conferirOc(ocId) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(ocId) }, include: { itens: { include: { artigo: { select: { nome: true, cor: true, codigo: true, unidade: true } } } }, fornecedor: { include: { cnpjs: true } } } });
  if (!oc) return { error: "OC não encontrada." };
  const regs = await prisma.fiscalNota.findMany({ where: { ocId: oc.id }, orderBy: { emissao: "asc" } });
  const aceitos = new Set([...(oc.fornecedor.cnpjs || []).map((c) => so(c.cnpj)), ...(Array.isArray(oc.cnpjsAceitos) ? oc.cnpjsAceitos.map(so) : [])]);
  const nfs = [], criticas = [];
  const nfItens = [];
  for (const r of regs) {
    let x = null, parc = [];
    if (r.xml) { try { x = parseXmlNfe(r.xml); } catch {} try { parc = lerXmlTitulo(r.xml)?.parcelas || []; } catch {} }
    const cnpj = so(x?.emit?.cnpj || r.documento);
    nfs.push({ id: r.id, numero: r.numero, emissao: r.emissao?.toISOString().slice(0, 10) || null, valor: Number(r.valor), cnpj, emitente: x?.emit?.razaoSocial || r.parceiro, temXml: r.temXml, temPdf: r.temPdf, acao: r.acao,
      parcelas: parc.map((p) => ({ parcela: p.parcela, vencimento: p.vencimento, valor: p.valor, dias: r.emissao && p.vencimento && !p.semVencimento ? Math.round((new Date(`${p.vencimento}T12:00:00Z`) - new Date(r.emissao.toISOString().slice(0, 10) + "T12:00:00Z")) / dia) : null })) });
    if (cnpj && !aceitos.has(cnpj)) criticas.push({ tipo: "CNPJ", nf: r.numero, cnpj, emitente: x?.emit?.razaoSocial || r.parceiro, texto: `CNPJ do emitente da NF ${r.numero} (${cnpj}) não é do fornecedor da OC.` });
    if (!x) { criticas.push({ tipo: "SEM_XML", nf: r.numero, texto: `NF ${r.numero} sem XML: suba o XML para conferir itens e prazos.` }); continue; }
    x.itens.forEach((it, k) => nfItens.push({ nf: r.numero, nfId: r.id, idx: k, nome: it.xProd, codigo: it.cProd, unidade: it.uCom, quantidade: it.qCom, valorUnitario: it.vUn, total: it.vProd }));
  }
  // casa os itens da NF com os da OC (nome parecido + mesma quantidade)
  const ocIts = oc.itens.map((i) => ({ id: i.id, nfItem: i.nfItem || null, nome: i.artigo.nome, det: [i.artigo.cor, i.artigo.codigo].filter(Boolean).join(" · "), unidade: i.artigo.unidade, quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario) }));
  const pares = [], usados = new Set();
  const cand = [];
  for (const o of ocIts) for (const n of nfItens) cand.push({ o, n, s: parecido(`${o.nome} ${o.det}`, `${n.nome} ${n.codigo || ""}`) + (Math.abs(o.quantidade - n.quantidade) < 1e-6 ? 0.3 : 0) + (Math.abs(o.valorUnitario - n.valorUnitario) < 0.005 ? 0.2 : 0) });
  cand.sort((a, b) => b.s - a.s);
  const ocUsado = new Set();
  // v535 — item ligado na correção pela NF: fica casado mesmo com nome diferente
  for (const o of ocIts) { const n = o.nfItem && nfItens.find((x) => `${x.nfId}|${x.idx}` === o.nfItem); if (n) { ocUsado.add(o.id); usados.add(o.nfItem); pares.push({ ocItemId: o.id, nf: n }); } }
  for (const c of cand) {
    const kn = `${c.n.nfId}|${c.n.idx}`;
    if (c.s < 0.25 || ocUsado.has(c.o.id) || usados.has(kn)) continue;
    ocUsado.add(c.o.id); usados.add(kn); pares.push({ ocItemId: c.o.id, nf: c.n });
  }
  if (nfItens.length) {
    for (const o of ocIts) {
      const p = pares.find((x) => x.ocItemId === o.id);
      if (!p) { criticas.push({ tipo: "ITEM_FALTA", ocItemId: o.id, texto: `${o.nome}: item da OC não encontrado na NF.` }); continue; }
      if (Math.abs(o.quantidade - p.nf.quantidade) > 1e-6) criticas.push({ tipo: "QTD", ocItemId: o.id, texto: `${o.nome}: OC ${o.quantidade} ${String(o.unidade || "").toLowerCase()} · NF ${p.nf.quantidade} ${String(p.nf.unidade || "").toLowerCase()}.` });
      if (Math.abs(o.valorUnitario - p.nf.valorUnitario) > 0.005) criticas.push({ tipo: "VALOR", ocItemId: o.id, texto: `${o.nome}: valor unitário OC R$ ${o.valorUnitario.toFixed(2).replace(".", ",")} · NF R$ ${Number(p.nf.valorUnitario).toFixed(2).replace(".", ",")}.` });
    }
    for (const n of nfItens) if (!usados.has(`${n.nfId}|${n.idx}`)) criticas.push({ tipo: "ITEM_SOBRA", texto: `NF ${n.nf}: "${n.nome}" (${n.quantidade} ${String(n.unidade || "").toLowerCase()}) não está na OC.` });
    const totOc = r2(ocIts.reduce((s, o) => s + o.quantidade * o.valorUnitario, 0)), totNf = r2(nfItens.reduce((s, n) => s + Number(n.total || 0), 0));
    if (Math.abs(totOc - totNf) > 0.01) criticas.push({ tipo: "TOTAL", texto: `Total dos produtos: OC R$ ${totOc.toFixed(2).replace(".", ",")} · NF R$ ${totNf.toFixed(2).replace(".", ",")}.` });
  }
  // prazos: dias das duplicatas × condição da OC
  const diasNf = nfs.flatMap((n) => n.parcelas.map((p) => p.dias)).filter((d) => d != null);
  const condNf = diasNf.length ? (diasNf.every((d) => d <= 1) ? "À VISTA" : diasNf.join("/")) : null;
  const diasOc = diasDaCondicao(oc.condicaoFaturamento);
  if (condNf && (!diasOc || diasOc.join("/") !== (diasNf.every((d) => d <= 1) ? "0" : diasNf.join("/"))))
    criticas.push({ tipo: "PRAZO", condNf, texto: `Prazo de pagamento: OC "${oc.condicaoFaturamento || "—"}" · NF ${condNf}${condNf === "À VISTA" ? "" : " dias"}.` });
  return { ok: true, oc: { id: oc.id, numero: oc.numero, condicao: oc.condicaoFaturamento, fornecedor: oc.fornecedor.nomeFantasia || oc.fornecedor.nome || oc.fornecedor.razaoSocial },
    nfs, itensOc: ocIts, itensNf: nfItens, pares: pares.map((p) => ({ ocItemId: p.ocItemId, nfId: p.nf.nfId, idx: p.nf.idx })), criticas };
}

// corrige a OC pela NF: { ocId, pares: [{ ocItemId, nfId, idx }], condicao }
export async function corrigirOcPelaNf(b) {
  const c = await conferirOc(b.ocId);
  if (c.error) return c;
  const pares = Array.isArray(b.pares) ? b.pares : c.pares;
  const itens = [];
  for (const p of pares) {
    const n = c.itensNf.find((x) => x.nfId === Number(p.nfId) && x.idx === Number(p.idx));
    const o = c.itensOc.find((x) => x.id === Number(p.ocItemId));
    if (n && o) itens.push({ id: o.id, quantidade: n.quantidade, valorUnitario: n.valorUnitario, nfItem: `${n.nfId}|${n.idx}`, nfNome: n.nome || null });
  }
  // v535 — o que sobrou dos dois lados (nomes diferentes, ex.: TACTEL na OC × MICROFIBRA na NF) é ligado na ordem
  const okOc = new Set(itens.map((x) => x.id)), okNf = new Set(itens.map((x) => x.nfItem));
  const sobraOc = c.itensOc.filter((x) => !okOc.has(x.id)), sobraNf = c.itensNf.filter((x) => !okNf.has(`${x.nfId}|${x.idx}`));
  // v536 — só com o aceite do usuário (casarSobras)
  if (b.casarSobras) sobraOc.forEach((o, k) => { const n = sobraNf[k]; if (n) itens.push({ id: o.id, quantidade: n.quantidade, valorUnitario: n.valorUnitario, nfItem: `${n.nfId}|${n.idx}`, nfNome: n.nome || null }); });
  const r = await salvarOc({ id: c.oc.id, ...(itens.length ? { itens } : {}), ...(b.condicao ? { condicaoFaturamento: b.condicao } : {}) });
  if (r?.error) return r;
  return { ok: true, itens: itens.length };
}

// aceita o CNPJ do emitente: entra no cadastro do fornecedor (se não for de outro) ou só nesta OC
export async function aceitarCnpj(ocId, cnpj, razao) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(ocId) } });
  const c = so(cnpj);
  if (!oc || !c) return { error: "OC ou CNPJ inválido." };
  const ex = await prisma.fornecedorCnpj.findUnique({ where: { cnpj: c } });
  if (!ex) { await prisma.fornecedorCnpj.create({ data: { fornecedorId: oc.fornecedorId, cnpj: c, razaoSocial: razao || null } }); return { ok: true, cadastro: true }; }
  const l = Array.isArray(oc.cnpjsAceitos) ? oc.cnpjsAceitos : [];
  await prisma.ordemCompra.update({ where: { id: oc.id }, data: { cnpjsAceitos: [...new Set([...l, c])] } });
  return { ok: true, cadastro: false };
}
