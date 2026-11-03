// v619 — entrada no estoque das NFs de compra subidas pelo Movimento fiscal ou pela OC, com parametrização:
// cada item da NF ganha o "artigo interno" (nome que usamos) e os dados do cadastro; a equivalência
// (fornecedor + nome na NF → artigo interno) fica salva e é sugerida nas próximas importações.
// Dispensar a parametrização: o item entra com o nome da NF como artigo interno.
// Artigo idêntico já no estoque (mesma categoria, fornecedor, artigo interno, cor, código, unidade e largura) → soma a quantidade.
import { prisma } from "@/lib/prisma";
import { parseXmlNfe, camposDoTexto, unidadeDoUCom } from "@/lib/nf";
import { fornecedorDoEmitente } from "@/lib/nfEntrada";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const up = (s) => (s == null || String(s).trim() === "" ? null : String(s).trim().toUpperCase());
const so = (s) => String(s || "").replace(/\D/g, "");
const num = (v) => { if (v === "" || v == null) return null; if (typeof v === "number") return Number.isFinite(v) ? v : null; const s = String(v).trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const CATS = ["MALHA", "TECIDO", "AVIAMENTO", "OUTROS"];
const UNS = ["M", "KG", "UN", "PC", "CM"];
const CNPJ_EMPRESAS = ["48011287000181", "55116246000115"];   // Meridian e Nort (NF entre as empresas não entra pelo fornecedor)
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// a NF de entrada pede parametrização? (NF-e de compra com XML, emitente que não é a própria empresa)
export function precisaEstoque(n) {
  return n && n.tipo === "ENTRADA" && n.modelo === "NF-e" && !!n.xml && !CNPJ_EMPRESAS.includes(so(n.emitDoc || n.documento)) &&
    !/DEVOLU|RETORNO|SERVI[CÇ]O|ENERGIA|TELEFON|COMBUST/.test(norm(n.natureza));
}

async function notaComXml(id) {
  const n = await prisma.fiscalNota.findUnique({ where: { id: Number(id) || 0 } });
  if (!n) throw new Error("NF não encontrada.");
  if (!n.xml) throw new Error("A NF não tem XML: sem os itens não dá para dar entrada no estoque.");
  return n;
}
const equivDe = async (doc, xProd, cProd) => {
  const l = await prisma.artigoEquivalencia.findMany({ where: { documento: doc, OR: [{ nomeNf: norm(xProd) }, ...(cProd ? [{ cProd: String(cProd) }] : [])] }, orderBy: { updatedAt: "desc" } });
  return l.find((e) => e.nomeNf === norm(xProd)) || l[0] || null;
};

// itens da NF com a sugestão de parametrização (equivalência salva, artigo do fornecedor com o mesmo código, ou o texto da NF)
export async function itensParaParametrizar(id) {
  const n = await notaComXml(id);
  const nf = parseXmlNfe(n.xml);
  const doc = so(nf.emit?.cnpj);
  const fornecedorId = await fornecedorDoEmitente(nf).catch(() => null);
  const forn = fornecedorId ? await prisma.fornecedor.findUnique({ where: { id: fornecedorId }, select: { id: true, nome: true, nomeFantasia: true, razaoSocial: true } }) : null;
  const itens = [];
  for (const [idx, it] of nf.itens.entries()) {
    const eq = await equivDe(doc, it.xProd, it.cProd);
    const art = !eq && fornecedorId && it.cProd ? await prisma.artigo.findFirst({ where: { fornecedorId, codigoFornecedor: String(it.cProd) }, orderBy: { updatedAt: "desc" } }) : null;
    const campos = camposDoTexto(it.infAdProd || it.xProd);
    // v619 — categoria melhor que a do texto: malha vem em KG; tecido plano em metro (nome com largura ou tecidos conhecidos)
    const tx = norm(`${it.xProd} ${it.infAdProd || ""}`), un0 = unidadeDoUCom(it.uCom);
    if (/MALHA|PIQUET|DRY ?FIT|HELANCA|RIBANA|MOLETOM|SUEDINE|PV\b|PA\b|MEIA MALHA/.test(tx) || (campos.categoria === "AVIAMENTO" && un0 === "KG")) campos.categoria = "MALHA";
    else if (campos.categoria === "AVIAMENTO" && un0 === "M" && (/TECIDO|MATELAS|TRICOLINE|DENIM|BRIM|TACTEL|OXFORD|SARJA|GABARDINE|LINHO|CREPE|TNT|NYLON|POLIESTER|ALGODAO/.test(tx) || /\d[,.]\d{2}\s*M?\b/.test(tx) && /X\s*\d[,.]\d/.test(tx))) campos.categoria = "TECIDO";
    const base = eq?.dados || (art ? { categoria: art.categoria, artigoInterno: art.artigoInterno || art.nome, cor: art.cor, codigo: art.codigo, composicao: art.composicao,
      largura: art.largura != null ? Number(art.largura) : null, gramatura: art.gramatura != null ? Number(art.gramatura) : null, unidade: art.unidade } : null);
    itens.push({
      idx, xProd: it.xProd || "", cProd: it.cProd || null, quantidade: it.qCom ?? 0, uCom: it.uCom || null, valorUnitario: it.vUn ?? null,
      origem: eq ? "EQUIVALENCIA" : art ? "ARTIGO" : "NF",
      dados: {
        fornecedorId: eq?.fornecedorId || fornecedorId || null,
        categoria: base?.categoria || campos.categoria, artigoInterno: base?.artigoInterno || eq?.artigoInterno || up(it.xProd),
        cor: base?.cor || null, codigo: base?.codigo || null, composicao: base?.composicao || up(campos.composicao),
        largura: base?.largura ?? campos.largura ?? null, gramatura: base?.gramatura ?? campos.gramatura ?? null,
        unidade: base?.unidade || unidadeDoUCom(it.uCom), quantidade: it.qCom ?? 0, valorUnitario: it.vUn ?? null,
      },
    });
  }
  return { id: n.id, numero: n.numero, emissao: n.emissao, parceiro: n.parceiro, documento: doc, fornecedor: forn, estoqueStatus: n.estoqueStatus || null, itens };
}

// artigo idêntico já cadastrado (para consolidar a quantidade)
async function artigoIdentico(d) {
  const cands = await prisma.artigo.findMany({ where: { categoria: d.categoria, fornecedorId: d.fornecedorId || null, unidade: d.unidade, ativo: true } });
  const ig = (a, b) => norm(a) === norm(b);
  const lg = (a, b) => (a == null || a === "" ? null : Number(a)) === (b == null || b === "" ? null : Number(b));
  return cands.find((a) => ig(a.artigoInterno || a.nome, d.artigoInterno) && ig(a.cor, d.cor) && ig(a.codigo, d.codigo) && lg(a.largura, d.largura)) || null;
}

// dá entrada no estoque: itens = [{ idx, dados }] (parametrizados) · dispensar = entra tudo com o nome da NF
export async function darEntrada(id, { itens: editados = [], dispensar = false, quem, quemId } = {}) {
  const n = await notaComXml(id);
  if (n.estoqueStatus === "LANCADO") return { error: "Esta NF já deu entrada no estoque." };
  const nf = parseXmlNfe(n.xml);
  const doc = so(nf.emit?.cnpj);
  const fornAuto = await fornecedorDoEmitente(nf).catch(() => null);
  // a mesma NF importada pela tela de Estoque já movimentou: não soma de novo
  const jaEstoque = nf.chave ? await prisma.notaFiscal.findUnique({ where: { chave: nf.chave }, select: { id: true, _count: { select: { itens: true } } } }) : null;
  if (jaEstoque?._count?.itens > 0) {
    await prisma.fiscalNota.update({ where: { id: n.id }, data: { estoqueStatus: "LANCADO", estoqueEm: new Date() } });
    return { ok: true, jaNoEstoque: true, itens: 0 };
  }
  if (!fornAuto) return { error: "NF sem CNPJ do emitente: não dá para identificar o fornecedor." };
  const nota = jaEstoque || await prisma.notaFiscal.create({ data: {
    numero: nf.numero || n.numero, chave: nf.chave || null, fornecedorId: fornAuto, status: "LANCADA", arquivoXml: n.xml, temXml: true,
    dataEmissao: nf.dataEmissao ? new Date(nf.dataEmissao) : n.emissao, valorTotal: nf.valorTotal ?? n.valor } });
  const porIdx = Object.fromEntries((editados || []).map((x) => [Number(x.idx), x.dados || {}]));
  const sug = (await itensParaParametrizar(id)).itens;
  const dataCompra = nf.dataEmissao ? new Date(nf.dataEmissao) : n.emissao;
  const r = { ok: true, itens: 0, criados: 0, somados: 0, equivalencias: 0, detalhe: [] };
  for (const s of sug) {
    const e = dispensar ? {} : porIdx[s.idx] || {};
    if (e.ignorar) { r.detalhe.push({ xProd: s.xProd, situacao: "IGNORADO" }); continue; }   // item que não é material de estoque
    const d = {
      fornecedorId: Number(e.fornecedorId) || s.dados.fornecedorId || fornAuto,
      categoria: CATS.includes(e.categoria) ? e.categoria : s.dados.categoria,
      artigoInterno: dispensar ? up(s.xProd) : up(e.artigoInterno) || s.dados.artigoInterno,
      cor: dispensar ? s.dados.cor : e.cor !== undefined ? up(e.cor) : s.dados.cor,
      codigo: dispensar ? s.dados.codigo : e.codigo !== undefined ? up(e.codigo) : s.dados.codigo,
      composicao: dispensar ? s.dados.composicao : e.composicao !== undefined ? up(e.composicao) : s.dados.composicao,
      largura: dispensar ? s.dados.largura : e.largura !== undefined ? num(e.largura) : s.dados.largura,
      gramatura: dispensar ? s.dados.gramatura : e.gramatura !== undefined ? num(e.gramatura) : s.dados.gramatura,
      unidade: UNS.includes(e.unidade) ? e.unidade : s.dados.unidade,
      quantidade: r3(num(e.quantidade) ?? s.dados.quantidade),
      valorUnitario: num(e.valorUnitario) ?? s.dados.valorUnitario,
    };
    if (!(d.quantidade > 0)) { r.detalhe.push({ xProd: s.xProd, situacao: "SEM QUANTIDADE" }); continue; }
    let art = await artigoIdentico(d);
    if (art) {
      art = await prisma.artigo.update({ where: { id: art.id }, data: { quantidade: r3(Number(art.quantidade || 0) + d.quantidade), ...(d.valorUnitario != null ? { valorUnitario: d.valorUnitario } : {}),
        ...(dataCompra ? { dataCompra } : {}), nfId: nota.id, ...(!art.codigoFornecedor && s.cProd ? { codigoFornecedor: String(s.cProd) } : {}) } });
      r.somados++;
    } else {
      art = await prisma.artigo.create({ data: {
        categoria: d.categoria, fornecedorId: d.fornecedorId, nfId: nota.id, codigoFornecedor: s.cProd ? String(s.cProd) : null, nome: up(s.xProd) || "ARTIGO SEM NOME",
        artigoInterno: d.artigoInterno, cor: d.cor, codigo: d.codigo, composicao: d.composicao, largura: d.largura, gramatura: d.gramatura, unidade: d.unidade,
        quantidade: d.quantidade, valorUnitario: d.valorUnitario, dataCompra, criadoPorId: quemId || null } });
      r.criados++;
    }
    await prisma.estoqueMovimentacao.create({ data: { artigoId: art.id, tipo: "ENTRADA", quantidade: d.quantidade, nfId: nota.id, usuarioId: quemId || null,
      observacao: `NF ${nota.numero} · ${s.xProd}${dispensar ? " · sem parametrização" : ""}`.slice(0, 300) } });
    await prisma.nfItem.create({ data: { nfId: nota.id, artigoId: art.id, descricaoNf: s.xProd, quantidade: d.quantidade, valorUnitario: d.valorUnitario } });
    // equivalência para as próximas NFs deste fornecedor
    if (!dispensar && doc) {
      const dados = { categoria: d.categoria, artigoInterno: d.artigoInterno, cor: d.cor, codigo: d.codigo, composicao: d.composicao, largura: d.largura, gramatura: d.gramatura, unidade: d.unidade };
      await prisma.artigoEquivalencia.upsert({ where: { documento_nomeNf: { documento: doc, nomeNf: norm(s.xProd) } },
        create: { documento: doc, nomeNf: norm(s.xProd), cProd: s.cProd ? String(s.cProd) : null, fornecedorId: d.fornecedorId, artigoId: art.id, artigoInterno: d.artigoInterno, dados, criadoPorNome: quem || null },
        update: { cProd: s.cProd ? String(s.cProd) : null, fornecedorId: d.fornecedorId, artigoId: art.id, artigoInterno: d.artigoInterno, dados } });
      r.equivalencias++;
    }
    r.itens++;
    r.detalhe.push({ xProd: s.xProd, artigoInterno: d.artigoInterno, quantidade: d.quantidade, unidade: d.unidade, situacao: art.quantidade && Number(art.quantidade) > d.quantidade + 1e-9 ? "SOMADO" : "CRIADO", artigoId: art.id });
  }
  await prisma.fiscalNota.update({ where: { id: n.id }, data: { estoqueStatus: "LANCADO", estoqueEm: new Date(), estoquePorNome: quem || null } });
  try { const { checarEstoqueMinimo } = await import("@/lib/estoqueMinimo"); for (const x of r.detalhe.filter((y) => y.artigoId)) await checarEstoqueMinimo(prisma, x.artigoId, quemId || null).catch(() => null); } catch {}
  return r;
}

// NFs de compra aguardando a entrada no estoque
export async function pendentesEstoque() {
  return prisma.fiscalNota.findMany({ where: { estoqueStatus: "PENDENTE" }, orderBy: { emissao: "desc" }, take: 200,
    select: { id: true, numero: true, parceiro: true, emissao: true, valor: true } });
}

// ---------- v620 — volumes da NF (etiquetas Zebra) ----------
export const codigoVolume = (id) => `VOL${String(id).padStart(7, "0")}`;
export async function volumesDaNf(id) {
  const n = await prisma.fiscalNota.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, numero: true, parceiro: true, emissao: true, chave: true, xml: true, estoqueEm: true, estoqueStatus: true } });
  if (!n) throw new Error("NF não encontrada.");
  const qVol = [...String(n.xml || "").matchAll(/<qVol>\s*([\d.]+)\s*<\/qVol>/g)].reduce((s, m) => s + (Number(m[1]) || 0), 0) || null;
  const especie = (String(n.xml || "").match(/<esp>([^<]*)<\/esp>/) || [])[1] || null;
  const nota = n.chave ? await prisma.notaFiscal.findUnique({ where: { chave: n.chave }, select: { id: true } }) : null;
  const its = nota ? await prisma.nfItem.findMany({ where: { nfId: nota.id, artigoId: { not: null } }, orderBy: { id: "asc" },
    include: { artigo: { select: { id: true, nome: true, artigoInterno: true, cor: true, codigo: true, unidade: true, categoria: true, largura: true, composicao: true, fornecedor: { select: { nome: true, nomeFantasia: true, razaoSocial: true } } } } } }) : [];
  const vols = await prisma.estoqueVolume.findMany({ where: { fiscalNotaId: n.id }, orderBy: { id: "asc" } });
  return {
    id: n.id, numero: n.numero, parceiro: n.parceiro, emissao: n.emissao, entrada: n.estoqueEm || null, estoqueStatus: n.estoqueStatus, qVol, especie, notaFiscalId: nota?.id || null,
    itens: its.map((i) => ({ nfItemId: i.id, artigoId: i.artigoId, quantidade: Number(i.quantidade), descricaoNf: i.descricaoNf,
      artigoInterno: i.artigo.artigoInterno || i.artigo.nome, cor: i.artigo.cor, codigo: i.artigo.codigo, unidade: i.artigo.unidade, categoria: i.artigo.categoria,
      largura: i.artigo.largura != null ? Number(i.artigo.largura) : null, composicao: i.artigo.composicao,
      fornecedor: i.artigo.fornecedor ? i.artigo.fornecedor.nomeFantasia || i.artigo.fornecedor.nome || i.artigo.fornecedor.razaoSocial : n.parceiro })),
    volumes: vols.map((v) => ({ id: v.id, codigo: codigoVolume(v.id), artigoId: v.artigoId, quantidade: Number(v.quantidade), unidade: v.unidade, pedido: v.pedido, entradaEm: v.entradaEm })),
  };
}
// grava as etiquetas novas (as existentes ficam; as tiradas da lista saem) e devolve todas com o código de barras
export async function salvarVolumes(id, etiquetas, quem) {
  const v = await volumesDaNf(id);
  const manter = etiquetas.filter((e) => e.id).map((e) => Number(e.id));
  await prisma.estoqueVolume.deleteMany({ where: { fiscalNotaId: v.id, id: { notIn: manter.length ? manter : [0] } } });
  for (const e of etiquetas.filter((x) => x.id)) await prisma.estoqueVolume.updateMany({ where: { id: Number(e.id), fiscalNotaId: v.id }, data: { quantidade: r3(num(e.quantidade) || 0), unidade: UNS.includes(e.unidade) ? e.unidade : "M" } });
  for (const e of etiquetas.filter((x) => !x.id)) {
    if (!(num(e.quantidade) > 0) || !e.artigoId) continue;
    await prisma.estoqueVolume.create({ data: { fiscalNotaId: v.id, notaFiscalId: v.notaFiscalId, artigoId: Number(e.artigoId), quantidade: r3(num(e.quantidade)),
      unidade: UNS.includes(e.unidade) ? e.unidade : "M", nfNumero: v.numero, entradaEm: v.entrada || new Date(), criadoPorNome: quem || null } });
  }
  return volumesDaNf(id);
}
