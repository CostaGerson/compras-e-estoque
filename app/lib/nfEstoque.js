// v619 — entrada no estoque das NFs de compra subidas pelo Movimento fiscal ou pela OC, com parametrização:
// cada item da NF ganha o "artigo interno" (nome que usamos) e os dados do cadastro; a equivalência
// (fornecedor + nome na NF → artigo interno) fica salva e é sugerida nas próximas importações.
// Dispensar a parametrização: o item entra com o nome da NF como artigo interno.
// Artigo idêntico já no estoque (mesma categoria, fornecedor, artigo interno, cor, código, unidade e largura) → soma a quantidade.
import { prisma } from "@/lib/prisma";
import { parseXmlNfe, camposDoTexto, unidadeDoUCom } from "@/lib/nf";
import { fornecedorDoEmitente } from "@/lib/nfEntrada";
import { nomePadrao } from "@/lib/artigoPadrao";   // v1157

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const up = (s) => (s == null || String(s).trim() === "" ? null : String(s).trim().toUpperCase());
const so = (s) => String(s || "").replace(/\D/g, "");
const num = (v) => { if (v === "" || v == null) return null; if (typeof v === "number") return Number.isFinite(v) ? v : null; const s = String(v).trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const CATS = ["MALHA", "TECIDO", "AVIAMENTO", "OUTROS"];
const UNS = ["M", "KG", "UN", "PC", "CM", "L", "CONE", "PCT"];   // v1152
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

// v1157 — sugestões do catálogo (cartelas) do fornecedor da NF e dos fornecedores do mesmo grupo, por semelhança de nome
const toksDe = (t) => norm(t).split(/[^A-Z0-9%]+/).filter((w) => w.length >= 3 && !/^(COM|SEM|PARA|COR|DE|DA|DO|UN|KG|MT|MTS|METRO|METROS)$/.test(w));
export async function fornecedoresDoGrupo(fornecedorId) {
  if (!fornecedorId) return [];
  const f = await prisma.fornecedor.findUnique({ where: { id: Number(fornecedorId) }, select: { id: true, grupoId: true } });
  if (!f) return [];
  if (!f.grupoId) return [f.id];
  return (await prisma.fornecedor.findMany({ where: { grupoId: f.grupoId }, select: { id: true } })).map((x) => x.id);
}
export async function sugestoesCatalogo({ fornecedorId, texto, cProd, cor, limite = 6, todosFornecedores = false }) {
  const ids = todosFornecedores ? null : await fornecedoresDoGrupo(fornecedorId);
  if (ids && !ids.length) return [];
  const arts = await prisma.artigo.findMany({ where: { ativo: true, origem: "CARTELA", ...(ids ? { fornecedorId: { in: ids } } : {}) },
    select: { id: true, nome: true, artigoInterno: true, cor: true, codigo: true, categoria: true, composicao: true, largura: true, gramatura: true, tipoMalha: true, unidade: true, fornecedorId: true,
      fornecedor: { select: { nome: true, nomeFantasia: true } } }, take: 5000 });
  const tq = new Set(toksDe(texto)), tx = norm(`${texto} ${cProd || ""}`), corN = norm(cor);
  const pont = arts.map((a) => {
    const ta = toksDe(`${a.nome} ${a.artigoInterno || ""}`);
    let p = ta.filter((w) => tq.has(w)).length * 2;
    if (a.codigo && norm(a.codigo).length >= 3 && tx.includes(norm(a.codigo))) p += 4;
    if (!p) return { a, p: 0 };   // só a cor não basta
    if (corN && a.cor && norm(a.cor) === corN) p += 2;
    else if (a.cor && norm(a.cor).length >= 3 && tx.includes(norm(a.cor))) p += 1.5;
    return { a, p };
  }).filter((x) => x.p > 0).sort((x, y) => y.p - x.p).slice(0, limite);
  return pont.map(({ a, p }) => ({ id: a.id, nome: a.artigoInterno || a.nome, cor: a.cor, codigo: a.codigo, categoria: a.categoria, composicao: a.composicao,
    largura: a.largura != null ? Number(a.largura) : null, gramatura: a.gramatura != null ? Number(a.gramatura) : null, tipoMalha: a.tipoMalha, unidade: a.unidade,
    fornecedorId: a.fornecedorId, fornecedor: a.fornecedor?.nomeFantasia || a.fornecedor?.nome || null, pontos: p }));
}
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
      tipoEstoque: art.tipoEstoque, tipoTecido: art.tipoTecido, tipoMalha: art.tipoMalha,
      largura: art.largura != null ? Number(art.largura) : null, gramatura: art.gramatura != null ? Number(art.gramatura) : null, unidade: art.unidade } : null);
    itens.push({
      idx, xProd: it.xProd || "", cProd: it.cProd || null, quantidade: it.qCom ?? 0, uCom: it.uCom || null, valorUnitario: it.vUn ?? null,
      origem: eq ? "EQUIVALENCIA" : art ? "ARTIGO" : "NF",
      catalogo: await sugestoesCatalogo({ fornecedorId: eq?.fornecedorId || fornecedorId, texto: `${it.xProd} ${it.infAdProd || ""}`, cProd: it.cProd, cor: base?.cor }).catch(() => []),   // v1157
      dados: {
        tipoEstoque: base?.tipoEstoque || null, tipoTecido: base?.tipoTecido || null, tipoMalha: base?.tipoMalha || null,   // v1157
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
export async function darEntrada(id, { itens: editados = [], dispensar: _d = false, quem, quemId } = {}) {
  const dispensar = false;   // v1157 — todo item da NF precisa do artigo interno (não há mais "dispensar parametrização")
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
  // v1157 — todo item da NF precisa do artigo interno (nome padrão), tipo, cor e fornecedor antes de qualquer entrada
  const faltam = [];
  for (const s of sug) {
    const e = porIdx[s.idx] || {};
    const l = [];
    if (!(e.tipoEstoque || s.dados.tipoEstoque)) l.push("tipo");
    if (!up(e.artigoInterno)) l.push("artigo interno");
    if (!up(e.cor !== undefined ? e.cor : s.dados.cor)) l.push("cor");
    if (l.length) faltam.push(`${s.xProd}: ${l.join(", ")}`);
  }
  if (faltam.length) return { error: `Falta vincular ao artigo interno:\n${faltam.join("\n")}` };
  for (const s of sug) {
    const e = dispensar ? {} : porIdx[s.idx] || {};
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
      tipoEstoque: e.tipoEstoque || s.dados.tipoEstoque || null, tipoTecido: e.tipoTecido || null,   // v1157
      tipoMalha: ["TUBULAR", "RAMADA"].includes(e.tipoMalha) ? e.tipoMalha : s.dados.tipoMalha || null,
      artigoId: Number(e.artigoId) || null,   // v1157 — item do catálogo escolhido (mesma cor): a entrada soma nele
    };
    if (d.tipoEstoque) d.categoria = d.tipoEstoque === "MALHA" ? "MALHA" : d.tipoEstoque === "TECIDO" ? "TECIDO" : d.tipoEstoque === "AVIAMENTO" ? "AVIAMENTO" : "OUTROS";   // v1157
    if (!d.artigoId) {   // v1157 — mesmo padrão de nomenclatura do catálogo / entrada manual
      const fo = await prisma.fornecedor.findUnique({ where: { id: d.fornecedorId }, select: { nome: true, nomeFantasia: true } }).catch(() => null);
      d.artigoInterno = nomePadrao(d.artigoInterno, { fornecedor: fo?.nomeFantasia || fo?.nome, cor: d.cor }) || d.artigoInterno;
    }
    if (!(d.quantidade > 0)) { r.detalhe.push({ xProd: s.xProd, situacao: "SEM QUANTIDADE" }); continue; }
    let art = d.artigoId ? await prisma.artigo.findFirst({ where: { id: d.artigoId, ativo: true, unidade: d.unidade } }) : null;   // v1157
    if (!art) art = await artigoIdentico(d);
    const extras = { ...(d.tipoEstoque ? { tipoEstoque: d.tipoEstoque } : {}), ...(d.tipoTecido ? { tipoTecido: d.tipoTecido } : {}), ...(d.tipoMalha ? { tipoMalha: d.tipoMalha } : {}) };
    if (art) {
      art = await prisma.artigo.update({ where: { id: art.id }, data: { quantidade: r3(Number(art.quantidade || 0) + d.quantidade), ...(d.valorUnitario != null ? { valorUnitario: d.valorUnitario } : {}),
        ...(dataCompra ? { dataCompra } : {}), nfId: nota.id, ...(!art.codigoFornecedor && s.cProd ? { codigoFornecedor: String(s.cProd) } : {}),
        ...(!art.artigoInterno && d.artigoInterno ? { artigoInterno: d.artigoInterno } : {}), ...(!art.tipoEstoque ? extras : {}) } });
      r.somados++;
    } else {
      art = await prisma.artigo.create({ data: {
        categoria: d.categoria, fornecedorId: d.fornecedorId, nfId: nota.id, codigoFornecedor: s.cProd ? String(s.cProd) : null, nome: up(s.xProd) || "ARTIGO SEM NOME",
        artigoInterno: d.artigoInterno, cor: d.cor, codigo: d.codigo, composicao: d.composicao, largura: d.largura, gramatura: d.gramatura, unidade: d.unidade,
        quantidade: d.quantidade, valorUnitario: d.valorUnitario, dataCompra, criadoPorId: quemId || null, ...extras } });
      r.criados++;
    }
    await prisma.estoqueMovimentacao.create({ data: { artigoId: art.id, tipo: "ENTRADA", quantidade: d.quantidade, nfId: nota.id, usuarioId: quemId || null,
      observacao: `NF ${nota.numero} · ${s.xProd}${dispensar ? " · sem parametrização" : ""}`.slice(0, 300) } });
    await prisma.nfItem.create({ data: { nfId: nota.id, artigoId: art.id, descricaoNf: s.xProd, quantidade: d.quantidade, valorUnitario: d.valorUnitario } });
    // equivalência para as próximas NFs deste fornecedor
    if (!dispensar && doc) {
      const dados = { categoria: d.categoria, artigoInterno: d.artigoInterno, cor: d.cor, codigo: d.codigo, composicao: d.composicao, largura: d.largura, gramatura: d.gramatura, unidade: d.unidade,
        tipoEstoque: d.tipoEstoque, tipoTecido: d.tipoTecido, tipoMalha: d.tipoMalha };   // v1157
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
    include: { artigo: { select: { id: true, nome: true, artigoInterno: true, cor: true, codigo: true, unidade: true, categoria: true, largura: true, composicao: true, tipoMalha: true, tipoEstoque: true, tipoTecido: true, fornecedor: { select: { nome: true, nomeFantasia: true, razaoSocial: true } } } } } }) : [];
  const vols = await prisma.estoqueVolume.findMany({ where: { fiscalNotaId: n.id }, orderBy: { id: "asc" } });
  return {
    id: n.id, numero: n.numero, parceiro: n.parceiro, emissao: n.emissao, entrada: n.estoqueEm || null, estoqueStatus: n.estoqueStatus, qVol, especie, notaFiscalId: nota?.id || null,
    itens: its.map((i) => ({ nfItemId: i.id, artigoId: i.artigoId, quantidade: Number(i.quantidade), descricaoNf: i.descricaoNf,
      artigoInterno: i.artigo.artigoInterno || i.artigo.nome, cor: i.artigo.cor, codigo: i.artigo.codigo, unidade: i.artigo.unidade, categoria: i.artigo.categoria,
      largura: i.artigo.largura != null ? Number(i.artigo.largura) : null, composicao: i.artigo.composicao,
      tipoEtiqueta: i.artigo.tipoEstoque ? (i.artigo.tipoEstoque === "TECIDO" && i.artigo.tipoTecido ? `TECIDO · ${i.artigo.tipoTecido}` : i.artigo.tipoEstoque) : i.artigo.categoria === "OUTROS" ? "INSUMOS" : i.artigo.categoria,   // v1152
      construcao: i.artigo.categoria === "MALHA" ? i.artigo.tipoMalha || null : null,
      fornecedor: i.artigo.fornecedor ? i.artigo.fornecedor.nomeFantasia || i.artigo.fornecedor.nome || i.artigo.fornecedor.razaoSocial : n.parceiro })),
    volumes: vols.map((v) => ({ id: v.id, codigo: codigoVolume(v.id), artigoId: v.artigoId, quantidade: Number(v.quantidade), unidade: v.unidade, pedido: v.pedido, entradaEm: v.entradaEm, justificativa: v.justificativa })),
  };
}
// grava as etiquetas novas (as existentes ficam; as tiradas da lista saem) e devolve todas com o código de barras
export async function salvarVolumes(id, etiquetas, quem) {
  const v = await volumesDaNf(id);
  // v623 — mais etiquetas que os volumes da NF: cada etiqueta a mais precisa de justificativa escrita
  if (v.qVol && etiquetas.length > v.qVol) {
    const extras = etiquetas.slice(v.qVol).filter((e) => !e.id && !(String(e.justificativa || "").trim().length >= 5));
    if (extras.length) return { ...v, error: `A NF tem ${v.qVol} volume(s): justifique as etiquetas a mais.` };
  }
  const manter = etiquetas.filter((e) => e.id).map((e) => Number(e.id));
  await prisma.estoqueVolume.deleteMany({ where: { fiscalNotaId: v.id, id: { notIn: manter.length ? manter : [0] } } });
  for (const e of etiquetas.filter((x) => x.id)) await prisma.estoqueVolume.updateMany({ where: { id: Number(e.id), fiscalNotaId: v.id }, data: { quantidade: r3(num(e.quantidade) || 0), unidade: UNS.includes(e.unidade) ? e.unidade : "M" } });
  for (const e of etiquetas.filter((x) => !x.id)) {
    if (!(num(e.quantidade) > 0) || !e.artigoId) continue;
    await prisma.estoqueVolume.create({ data: { fiscalNotaId: v.id, notaFiscalId: v.notaFiscalId, artigoId: Number(e.artigoId), quantidade: r3(num(e.quantidade)),
      unidade: UNS.includes(e.unidade) ? e.unidade : "M", nfNumero: v.numero, entradaEm: v.entrada || new Date(), criadoPorNome: quem || null,
      justificativa: e.justificativa ? String(e.justificativa).trim().slice(0, 500) : null } });
  }
  return volumesDaNf(id);
}
