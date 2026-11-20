// v1035 — EFD ICMS/IPI (SPED Fiscal) gerada pelo ERP · etapa 1: blocos 0, C, D, (E provisório), H/K vazios, 1 e 9.
// Fonte: XMLs do Movimento fiscal (FiscalNota) da MERIDIAN no mês — NF-e de entrada e de saída e CT-e de frete tomado.
// Leiaute: 020 para 2026, 021 para 2027 (Guia Prático 3.2.x). Arquivo em ISO-8859-1, campos separados por "|".
// Correções em relação ao arquivo do KM (ver claude/sped-efd-analise-set26.md):
//  · código do item = artigo do ERP (não reaproveita código de outro produto); sem artigo, código do fornecedor (Fnnnnnnnn-cProd)
//  · NCM vem do XML do item · CFOP do frete de indústria 1352/2352 (2352 quando a prestação começa fora de MG)
//  · CST de entrada com a origem do XML (importado a 4% sai 1xx/2xx) · uso e consumo em 1556/2556 sem crédito
//  · compra de produto acabado de terceiro (NCM 61/62/63/65) = revenda (tipo 00, CFOP x102) · C190 sempre fecha com o C100
// O Bloco E sai PROVISÓRIO (débitos − créditos, sem o RET): crédito presumido, estorno MG50000100 e sub-apuração entram na etapa 2.
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { normRegra } from "@/lib/fin";

// ---------- empresa e contador (padrão = o que o KM informa; FinConfig "SPED|EMPRESA" / "SPED|CONTADOR" sobrepõe) ----------
const EMPRESA = { nome: "MERIDIAN LTDA", fantasia: "MERIDIAN LTDA", cnpj: "48011287000181", uf: "MG", ie: "0044450590058", codMun: "3106200", im: "",
  cep: "31255160", end: "RUA VIANA DO CASTELO", num: "916", compl: "", bairro: "SAO FRANCISCO", fone: "3136564398", email: "contato@meridianpro.com.br",
  perfil: "A", ativ: "0", clasInd: "00" };
const CONTADOR = { nome: "CLERIA MENDES COELHO", cpf: "87196719620", crc: "89441603", cnpj: "10429133000131", cep: "30410480", end: "RUA JOAO LUCIO BRANDAO", num: "183",
  compl: "SEM COMPLEMENTO", bairro: "BAIRRO PRADO", fone: "3132927400", fax: "3132927400", email: "cleria.mendes@dectaweb.com.br", codMun: "3106200" };
export const RET_NUM = "45.000047072-14";

async function config(chave, padrao) {
  const c = await prisma.finConfig.findUnique({ where: { chave } }).catch(() => null);
  try { return { ...padrao, ...(c?.valor ? JSON.parse(c.valor) : {}) }; } catch { return padrao; }
}

// ---------- formatação ----------
const so = (s) => String(s ?? "").replace(/\D/g, "");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const v2 = (n) => r2(n).toFixed(2).replace(".", ",");
const v5 = (n) => (Math.round((Number(n) || 0) * 1e5) / 1e5).toFixed(5).replace(".", ",");
const dt = (d) => { if (!d) return ""; const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10); const [a, m, x] = s.split("-"); return `${x}${m}${a}`; };
const isoD = (d) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : null);
// texto: sem "|", sem quebras, sem controle; o arquivo é gravado em Latin-1 (caracteres fora dele viram "?")
const tx = (s, max = 255) => String(s ?? "").replace(/[|\r\n\t]+/g, " ").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
export const versaoLeiaute = (ano) => (Number(ano) >= 2027 ? "021" : Number(ano) === 2026 ? "020" : Number(ano) === 2025 ? "019" : "018");

// unidade: o que o XML traz × o que o artigo usa
export function unid(u) {
  const t = normRegra(u).replace(/\s+/g, "");
  if (/^(M|MT|MTS|METRO|METROS|MTR)$/.test(t)) return "MT";
  if (/^(KG|KGS|KILO|KILOS|QUILO|QUILOS)$/.test(t)) return "KG";
  if (/^(UN|UND|UNID|UNIDADE|UNIDADES|UNI|U)$/.test(t)) return "UN";
  if (/^(PC|PCS|PECA|PECAS|PÇ)$/.test(t)) return "PC";
  if (/^(CN|CONE|CONES)$/.test(t)) return "CN";
  if (/^(CM)$/.test(t)) return "CM";
  return (t || "UN").slice(0, 6);
}
const UNID_DESCR = { MT: "METRO", KG: "QUILOGRAMA", UN: "UNIDADE", PC: "PECA", CN: "CONE", CM: "CENTIMETRO", LT: "LITRO", CX: "CAIXA", RL: "ROLO", PCT: "PACOTE" };

// ---------- XML ----------
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, trimValues: true });
function lerNfe(xml) {
  const doc = parser.parse(xml);
  const inf = (doc?.nfeProc?.NFe || doc?.NFe)?.infNFe;
  if (!inf) return null;
  const tot = inf.total?.ICMSTot || {};
  const itens = arr(inf.det).map((d) => {
    const p = d.prod || {}, im = d.imposto || {};
    const gI = im.ICMS && typeof im.ICMS === "object" ? Object.values(im.ICMS).find((x) => x && typeof x === "object") || {} : {};
    const ipiT = im.IPI?.IPITrib || {}, ipiN = im.IPI?.IPINT || {};
    return {
      n: Number(d["@_nItem"]) || 0, cProd: tx(p.cProd, 60), xProd: tx(p.xProd), ncm: so(p.NCM), cfop: so(p.CFOP), uCom: p.uCom, qCom: num(p.qCom), vUn: num(p.vUnCom),
      vProd: num(p.vProd), vDesc: num(p.vDesc), vFrete: num(p.vFrete), vSeg: num(p.vSeg), vOutro: num(p.vOutro),
      orig: gI.orig != null ? String(gI.orig) : "0", cst: gI.CST != null ? String(gI.CST).padStart(2, "0") : null, csosn: gI.CSOSN != null ? String(gI.CSOSN) : null,
      vBC: num(gI.vBC), pICMS: num(gI.pICMS), vICMS: num(gI.vICMS), pRedBC: num(gI.pRedBC),
      vBCST: num(gI.vBCST), pICMSST: num(gI.pICMSST), vICMSST: num(gI.vICMSST) + num(gI.vFCPST), vCredSN: num(gI.vCredICMSSN), pCredSN: num(gI.pCredSN),
      cstIpi: ipiT.CST || ipiN.CST || null, vBCIPI: num(ipiT.vBC), pIPI: num(ipiT.pIPI), vIPI: num(ipiT.vIPI),
      vPIS: num(Object.values(im.PIS || {})[0]?.vPIS), vCOFINS: num(Object.values(im.COFINS || {})[0]?.vCOFINS),
    };
  });
  const pessoa = (x) => {
    if (!x) return null;
    const e = x.enderEmit || x.enderDest || {};
    return { doc: so(x.CNPJ || x.CPF), cnpj: so(x.CNPJ), cpf: so(x.CPF), nome: tx(x.xNome, 100), ie: so(x.IE), codMun: so(e.cMun), end: tx(e.xLgr, 60), num: tx(e.nro, 10),
      compl: tx(e.xCpl, 60), bairro: tx(e.xBairro, 60), pais: so(e.cPais) || "1058" };
  };
  const pag = arr(inf.pag?.detPag);
  return {
    chave: String(inf["@_Id"] || "").replace(/^NFe/, ""), mod: so(inf.ide?.mod) || "55", serie: so(inf.ide?.serie) || "0", nNF: so(inf.ide?.nNF), tpNF: so(inf.ide?.tpNF),
    dhEmi: String(inf.ide?.dhEmi || inf.ide?.dEmi || "").slice(0, 10), modFrete: so(inf.transp?.modFrete) || "9",
    temDup: arr(inf.cobr?.dup).length > 0, semPag: pag.length > 0 && pag.every((x) => so(x.tPag) === "90"),
    emit: pessoa(inf.emit), dest: pessoa(inf.dest), infCpl: String(inf.infAdic?.infCpl || ""),
    tot: { vNF: num(tot.vNF), vProd: num(tot.vProd), vDesc: num(tot.vDesc), vFrete: num(tot.vFrete), vSeg: num(tot.vSeg), vOutro: num(tot.vOutro), vBC: num(tot.vBC), vICMS: num(tot.vICMS),
      vBCST: num(tot.vBCST), vST: num(tot.vST) + num(tot.vFCPST), vIPI: num(tot.vIPI) + num(tot.vIPIDevol), vPIS: num(tot.vPIS), vCOFINS: num(tot.vCOFINS) },
    itens,
  };
}
function lerCte(xml) {
  const doc = parser.parse(xml);
  const inf = (doc?.cteProc?.CTe || doc?.CTe)?.infCte;
  if (!inf) return null;
  const ide = inf.ide || {}, emit = inf.emit || {}, en = emit.enderEmit || {};
  const g = inf.imp?.ICMS && typeof inf.imp.ICMS === "object" ? Object.entries(inf.imp.ICMS)[0] || [] : [];
  const gi = g[1] || {};
  let cst = gi.CST != null ? String(gi.CST).padStart(2, "0") : g[0] === "ICMSSN" ? "90" : g[0] === "ICMSOutraUF" ? "90" : "90";
  return {
    chave: String(inf["@_Id"] || "").replace(/^CTe/, ""), serie: so(ide.serie) || "0", nCT: so(ide.nCT), dhEmi: String(ide.dhEmi || "").slice(0, 10), tpCTe: so(ide.tpCTe) || "0",
    ufIni: String(ide.UFIni || ""), cMunIni: so(ide.cMunIni), cMunFim: so(ide.cMunFim),
    emit: { doc: so(emit.CNPJ || emit.CPF), cnpj: so(emit.CNPJ), cpf: so(emit.CPF), nome: tx(emit.xNome, 100), ie: so(emit.IE), codMun: so(en.cMun), end: tx(en.xLgr, 60), num: tx(en.nro, 10),
      compl: tx(en.xCpl, 60), bairro: tx(en.xBairro, 60), pais: "1058" },
    vTPrest: num(inf.vPrest?.vTPrest), vRec: num(inf.vPrest?.vRec), cst, vBC: num(gi.vBC || gi.vBCOutraUF), pICMS: num(gi.pICMS || gi.pICMSOutraUF), vICMS: num(gi.vICMS || gi.vICMSOutraUF),
  };
}

// ---------- classificação da entrada ----------
const TEXTIL = /^(50|51|52|53|54|55|56|58|59|60)/;
const AVIAM = /^(9606|9607|5806|5807|5808|5809|5810|4821|3926|8308|5604|4016)/;
const ACABADO = /^(61|62|6301|6302|6303|6304|6505)/;
// finalidade: MP (industrialização) · REVENDA · CONSUMO
export function finalidade({ artigo, ncm }) {
  if (ACABADO.test(ncm || "") && !artigo) return "REVENDA";
  if (artigo || TEXTIL.test(ncm || "") || AVIAM.test(ncm || "")) return "MP";
  return "CONSUMO";
}
const MESMO = new Set(["124", "125", "151", "152", "201", "202", "203", "204", "208", "209", "410", "411", "414", "415", "551", "552", "553", "554", "555", "556", "557", "651", "652", "653", "901", "902", "903", "904", "905", "906", "907", "908", "909", "910", "911", "912", "913", "914", "915", "916", "917", "918", "919", "920", "921", "922", "923", "924", "925", "926", "934", "949"]);
// CFOP do fornecedor (5/6/7xxx) → CFOP de entrada (1/2/3xxx) pela finalidade
export function cfopEntrada(cfopForn, fin) {
  const c = so(cfopForn);
  const pre = { 5: "1", 6: "2", 7: "3", 1: "1", 2: "2", 3: "3" }[c[0]] || "1";
  const fim = c.slice(1);
  if (MESMO.has(fim)) return pre + fim;
  if (/^40[0-9]$/.test(fim)) return pre + (fin === "MP" ? "401" : fin === "REVENDA" ? "403" : "407");
  return pre + (fin === "MP" ? "101" : fin === "REVENDA" ? "102" : "556");
}
const CREDITA = new Set(["101", "102", "401", "403", "910", "911", "124", "125", "201", "202", "410", "411", "352", "353"]);

// ---------- montagem ----------
export async function gerarEfd(competencia) {
  const [ano, mes] = String(competencia).split("-").map(Number);
  if (!ano || !mes) throw new Error("Competência AAAA-MM?");
  const ini = new Date(Date.UTC(ano, mes - 1, 1)), fim = new Date(Date.UTC(ano, mes, 0));
  const fimDia = new Date(Date.UTC(ano, mes, 1));
  const emp = await config("SPED|EMPRESA", EMPRESA), cont = await config("SPED|CONTADOR", CONTADOR);
  const criticas = [];
  const crit = (tipo, texto, ref = null) => criticas.push({ tipo, texto, ref });

  // --- documentos do mês ---
  const sel = { id: true, tipo: true, modelo: true, numero: true, serie: true, chave: true, emissao: true, parceiro: true, documento: true, valor: true, motivo: true, acao: true,
    xml: true, temXml: true, ocId: true, estoqueEm: true, createdAt: true };
  const saidasDb = await prisma.fiscalNota.findMany({ where: { empresa: "MERIDIAN", tipo: "SAIDA", modelo: { in: ["NF-e"] }, emissao: { gte: ini, lte: fim } }, select: sel, orderBy: [{ emissao: "asc" }, { numero: "asc" }] });
  // entrada: escriturada pela data de entrada (lançamento no estoque → baixa da OC → importação no sistema), nunca antes da emissão
  const entradasCand = await prisma.fiscalNota.findMany({ where: { empresa: "MERIDIAN", tipo: "ENTRADA", modelo: { in: ["NF-e", "CT-e"] }, emissao: { lte: fim },
    OR: [{ estoqueEm: { gte: ini, lt: fimDia } }, { createdAt: { gte: ini, lt: fimDia } }, { emissao: { gte: ini, lte: fim } }] }, select: sel, orderBy: [{ emissao: "asc" }] });
  const ocIds = [...new Set(entradasCand.map((n) => n.ocId).filter(Boolean))];
  const ocs = ocIds.length ? await prisma.ordemCompra.findMany({ where: { id: { in: ocIds } }, select: { id: true, baixaEm: true } }) : [];
  const baixaOc = Object.fromEntries(ocs.map((o) => [o.id, o.baixaEm]));
  const dataEntrada = (n) => {
    const cand = [n.estoqueEm, n.ocId && baixaOc[n.ocId], n.createdAt].find(Boolean);
    const d = cand ? new Date(cand.getTime() - 3 * 3600e3) : n.emissao;   // horário de Brasília
    const s = isoD(d), e = isoD(n.emissao);
    return e && s < e ? e : s;
  };
  const doMes = (s) => s && s >= isoD(ini) && s <= isoD(fim);
  const entradasDb = entradasCand.filter((n) => doMes(dataEntrada(n)));
  const ctes = entradasDb.filter((n) => n.modelo === "CT-e");
  const nfesEnt = entradasDb.filter((n) => n.modelo === "NF-e");

  // artigos ligados aos itens das NFs de entrada (OC corrigida pela NF, ou NF lançada no estoque)
  const idsEnt = nfesEnt.map((n) => n.id);
  const ocLig = idsEnt.length ? await prisma.ocItem.findMany({ where: { nfItem: { not: null } }, select: { nfItem: true, artigoId: true } }) : [];
  const artPorItem = {};
  for (const o of ocLig) { const [f, i] = String(o.nfItem).split("|").map(Number); if (idsEnt.includes(f)) artPorItem[`${f}|${i}`] = o.artigoId; }
  const chavesEnt = nfesEnt.map((n) => n.chave).filter(Boolean);
  const nfsEst = chavesEnt.length ? await prisma.notaFiscal.findMany({ where: { chave: { in: chavesEnt } }, select: { chave: true, itens: { select: { artigoId: true, descricaoNf: true } } } }) : [];
  const artPorDescr = {};
  for (const nf of nfsEst) for (const it of nf.itens) if (it.artigoId) artPorDescr[`${nf.chave}|${normRegra(it.descricaoNf)}`] = it.artigoId;
  const artigos = Object.fromEntries((await prisma.artigo.findMany({ where: { id: { in: [...new Set([...Object.values(artPorItem), ...Object.values(artPorDescr)])] } },
    select: { id: true, nome: true, cor: true, codigo: true, unidade: true, categoria: true } })).map((a) => [a.id, a]));

  // --- cadastros (0150, 0190, 0200) ---
  const part = new Map(), unids = new Set(), itensCad = new Map();
  const addPart = (p) => {
    if (!p?.doc) return "";
    if (p.doc === so(emp.cnpj)) return "";
    if (!part.has(p.doc)) part.set(p.doc, p);
    return p.doc;
  };
  const addItem = (cod, descr, u, tipo, ncm) => {
    unids.add(u);
    if (!itensCad.has(cod)) itensCad.set(cod, { cod, descr: tx(descr, 200), u, tipo, ncm: ncm && ncm.length === 8 ? ncm : "" });
    else { const x = itensCad.get(cod); if (!x.ncm && ncm?.length === 8) x.ncm = ncm; }
    if (!ncm || ncm.length !== 8) crit("NCM", `Item ${cod} (${tx(descr, 60)}): NCM inválido no XML ("${ncm || ""}").`);
    return cod;
  };

  const C = [], D = [];   // registros dos blocos
  let deb = 0, cred = 0, debIpi = 0, credIpi = 0;
  const e510 = new Map();
  const somaE510 = (cfop, cst, cont, bc, ipi) => { const k = `${cfop}|${cst || ""}`; const x = e510.get(k) || { cfop, cst: cst || "", cont: 0, bc: 0, ipi: 0 }; x.cont += cont; x.bc += bc; x.ipi += ipi; e510.set(k, x); };
  const infRet = (t) => /45\.?000047072/.test(String(t || ""));
  const usaRet = { n: 0 };

  // --- saídas (NF-e própria: C100 + C110 + C190, sem C170) ---
  for (const n of saidasDb) {
    if (String(n.motivo || "").includes("CANCELADA")) {
      C.push(["C100", "1", "0", "", "55", "02", n.serie || "1", n.numero, n.chave || "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
      continue;
    }
    if (!n.xml) { crit("SEM_XML", `NF de saída ${n.numero}: sem XML no sistema — fora do SPED.`, n.id); continue; }
    const x = lerNfe(n.xml);
    if (!x) { crit("XML", `NF de saída ${n.numero}: XML inválido.`, n.id); continue; }
    const entradaPropria = x.tpNF === "0";
    const cp = addPart(x.dest);
    const grupos = new Map();
    for (const it of x.itens) {
      const cst = it.orig + (it.cst || "90");
      const k = `${cst}|${it.cfop}|${it.pICMS}`;
      const g = grupos.get(k) || { cst, cfop: it.cfop, aliq: it.pICMS, opr: 0, bc: 0, icms: 0, bcst: 0, st: 0, red: 0, ipi: 0 };
      g.opr += it.vProd - it.vDesc + it.vFrete + it.vSeg + it.vOutro + it.vIPI + it.vICMSST;
      g.bc += it.vBC; g.icms += it.vICMS; g.bcst += it.vBCST; g.st += it.vICMSST; g.ipi += it.vIPI;
      if (it.pRedBC > 0) g.red += it.vProd - it.vDesc + it.vFrete + it.vSeg + it.vOutro - it.vBC;
      grupos.set(k, g);
      somaE510(it.cfop, it.cstIpi || (entradaPropria ? "49" : "99"), it.vProd - it.vDesc + it.vFrete + it.vSeg + it.vOutro + it.vIPI, it.vBCIPI, it.vIPI);
    }
    const gs = [...grupos.values()];
    const dif = r2(x.tot.vNF - gs.reduce((s, g) => s + r2(g.opr), 0));
    if (gs.length && Math.abs(dif) <= 0.05) gs.sort((a, b) => b.opr - a.opr)[0].opr += dif;   // centavos do arredondamento ficam no maior grupo
    else if (Math.abs(dif) > 0.05) crit("TOTAL", `NF de saída ${n.numero}: itens (${v2(x.tot.vNF - dif)}) ≠ total da nota (${v2(x.tot.vNF)}).`, n.id);
    C.push(["C100", entradaPropria ? "0" : "1", "0", cp, "55", "00", x.serie, x.nNF, x.chave, dt(x.dhEmi), dt(x.dhEmi), v2(x.tot.vNF), x.temDup ? "1" : x.semPag ? "2" : "0",
      v2(x.tot.vDesc), "0,00", v2(x.tot.vProd), x.modFrete, v2(x.tot.vFrete), v2(x.tot.vSeg), v2(x.tot.vOutro), v2(x.tot.vBC), v2(x.tot.vICMS), v2(x.tot.vBCST), v2(x.tot.vST), v2(x.tot.vIPI),
      v2(x.tot.vPIS), v2(x.tot.vCOFINS), "", ""]);
    if (infRet(x.infCpl)) { C.push(["C110", "RET", ""]); usaRet.n++; }
    for (const g of gs) {
      C.push(["C190", g.cst, g.cfop, v2(g.aliq), v2(g.opr), v2(g.bc), v2(g.icms), v2(g.bcst), v2(g.st), v2(g.red), v2(g.ipi), ""]);
      if (entradaPropria) cred += r2(g.icms); else deb += r2(g.icms);
    }
    if (entradaPropria) credIpi += x.tot.vIPI; else debIpi += x.tot.vIPI;
  }

  // --- entradas de terceiros (C100 + C170 + C190) ---
  for (const n of nfesEnt) {
    if (!n.xml) { crit("SEM_XML", `NF de entrada ${n.numero} (${n.parceiro}): sem XML no sistema — fora do SPED.`, n.id); continue; }
    const x = lerNfe(n.xml);
    if (!x) { crit("XML", `NF de entrada ${n.numero}: XML inválido.`, n.id); continue; }
    if (x.emit?.doc === so(emp.cnpj)) { crit("PROPRIA", `NF ${n.numero}: emitida pela própria Meridian registrada como entrada — confira no Movimento fiscal.`, n.id); continue; }
    const cp = addPart(x.emit);
    const dE = dataEntrada(n);
    const linhas = [], grupos = new Map();
    let totBc = 0, totIcms = 0, totBcSt = 0, totSt = 0, totIpi = 0;
    x.itens.forEach((it, idx) => {
      const artId = artPorItem[`${n.id}|${idx}`] || artPorDescr[`${n.chave}|${normRegra(it.xProd)}`] || null;
      const art = artId ? artigos[artId] : null;
      const uXml = unid(it.uCom);
      const usaArt = art && unid(art.unidade) === uXml;
      if (art && !usaArt) crit("UNIDADE", `NF ${n.numero} item ${idx + 1} (${tx(it.xProd, 50)}): unidade da NF ${uXml} ≠ do artigo ${unid(art.unidade)} — usado o código do fornecedor.`, n.id);
      const fin = finalidade({ artigo: art, ncm: it.ncm });
      const tipoItem = fin === "MP" ? "01" : fin === "REVENDA" ? "00" : "07";
      const cod = usaArt ? `A${art.id}` : `F${x.emit.doc.slice(0, 8)}-${it.cProd || idx + 1}`.slice(0, 60);
      addItem(cod, usaArt ? [art.nome, art.cor, art.codigo].filter(Boolean).join(" ") : it.xProd, uXml, tipoItem, it.ncm);
      const cfop = cfopEntrada(it.cfop, fin);
      const credita = CREDITA.has(cfop.slice(1));
      // ICMS: crédito do destacado (ou do Simples, vCredICMSSN); uso e consumo e demais sem crédito
      let bc = 0, aliq = 0, icms = 0;
      if (credita) {
        if (it.csosn) { if (it.vCredSN > 0) { bc = it.vProd - it.vDesc; aliq = it.pCredSN; icms = it.vCredSN; } }
        else { bc = it.vBC; aliq = it.pICMS; icms = it.vICMS; }
      }
      const cst = it.orig + (it.cst || "90");
      if (["1", "2", "3", "8"].includes(it.orig) === false && Math.abs(it.pICMS - 4) < 1e-6 && cfop[0] === "2") crit("CST_ORIGEM", `NF ${n.numero} item ${idx + 1}: alíquota interestadual de 4% com origem ${it.orig} (nacional) — confira com o fornecedor.`, n.id);
      // IPI: crédito na compra de matéria-prima com IPI destacado (CST 00); sem crédito, 49
      const credIpiIt = fin === "MP" && it.vIPI > 0;
      const cstIpi = credIpiIt ? "00" : "49";
      const vIpiCred = credIpiIt ? it.vIPI : 0;
      const vItem = it.vProd;
      linhas.push(["C170", String(idx + 1), cod, tx(it.xProd), v5(it.qCom), uXml, v2(vItem), v2(it.vDesc), "0", cst, cfop, "", v2(bc), v2(aliq), v2(icms),
        v2(it.vBCST), v2(it.pICMSST), v2(it.vICMSST), "0", cstIpi, "", v2(credIpiIt ? it.vBCIPI : 0), v2(credIpiIt ? it.pIPI : 0), v2(vIpiCred),
        "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
      const k = `${cst}|${cfop}|${aliq}`;
      const g = grupos.get(k) || { cst, cfop, aliq, opr: 0, bc: 0, icms: 0, bcst: 0, st: 0, red: 0, ipi: 0 };
      g.opr += it.vProd - it.vDesc + it.vFrete + it.vSeg + it.vOutro + it.vIPI + it.vICMSST;
      g.bc += bc; g.icms += icms; g.bcst += it.vBCST; g.st += it.vICMSST; g.ipi += vIpiCred;
      grupos.set(k, g);
      totBc += bc; totIcms += icms; totBcSt += it.vBCST; totSt += it.vICMSST; totIpi += vIpiCred;
      somaE510(cfop, cstIpi, it.vProd - it.vDesc + it.vFrete + it.vSeg + it.vOutro + it.vIPI, credIpiIt ? it.vBCIPI : 0, vIpiCred);
    });
    const gs = [...grupos.values()];
    const dif = r2(x.tot.vNF - gs.reduce((s, g) => s + r2(g.opr), 0));
    if (gs.length && Math.abs(dif) <= 0.05) gs.sort((a, b) => b.opr - a.opr)[0].opr += dif;
    else if (Math.abs(dif) > 0.05) crit("TOTAL", `NF de entrada ${n.numero}: itens (${v2(x.tot.vNF - dif)}) ≠ total da nota (${v2(x.tot.vNF)}).`, n.id);
    C.push(["C100", "0", "1", cp, x.mod || "55", "00", x.serie, x.nNF, x.chave, dt(x.dhEmi), dt(dE), v2(x.tot.vNF), x.temDup ? "1" : x.semPag ? "2" : "0",
      v2(x.tot.vDesc), "0,00", v2(x.tot.vProd), x.modFrete, v2(x.tot.vFrete), v2(x.tot.vSeg), v2(x.tot.vOutro), v2(totBc), v2(totIcms), v2(totBcSt), v2(totSt), v2(totIpi), "", "", "", ""]);
    C.push(...linhas);
    for (const g of gs) { C.push(["C190", g.cst, g.cfop, v2(g.aliq), v2(g.opr), v2(g.bc), v2(g.icms), v2(g.bcst), v2(g.st), v2(g.red), v2(g.ipi), ""]); cred += r2(g.icms); }
    credIpi += totIpi;
  }

  // --- CT-e de frete tomado (D100 + D190) ---
  for (const n of ctes) {
    if (String(n.motivo || "").includes("outro tomador")) continue;   // frete pago por outro tomador: não é nosso
    if (!n.xml) { crit("SEM_XML", `CT-e ${n.numero}: sem XML no sistema — fora do SPED.`, n.id); continue; }
    const x = lerCte(n.xml);
    if (!x) { crit("XML", `CT-e ${n.numero}: XML inválido.`, n.id); continue; }
    const fr = await prisma.freteCte.findUnique({ where: { fiscalNotaId: n.id }, select: { tipo: true } }).catch(() => null);
    const cp = addPart(x.emit);
    const cfop = (x.ufIni && x.ufIni !== emp.uf ? "2" : "1") + "352";   // indústria: aquisição de serviço de transporte
    const credita = ["00", "20", "90"].includes(x.cst) && x.vICMS > 0;
    const bc = credita ? x.vBC : 0, aliq = credita ? x.pICMS : 0, icms = credita ? x.vICMS : 0;
    D.push(["D100", "0", "1", cp, "57", "00", x.serie, "", x.nCT, x.chave, dt(x.dhEmi), dt(dataEntrada(n)), x.tpCTe, "", v2(x.vTPrest), v2(x.vTPrest - x.vRec > 0 ? x.vTPrest - x.vRec : 0),
      fr?.tipo === "ENTREGA" ? "0" : "1", v2(x.vTPrest), v2(bc), v2(icms), v2(credita ? 0 : x.vTPrest), "", "", x.cMunIni, x.cMunFim]);
    D.push(["D190", "0" + x.cst, cfop, v2(aliq), v2(x.vTPrest), v2(bc), v2(icms), "0,00", ""]);
    cred += r2(icms);
  }

  // --- Bloco 0 ---
  const R0 = [];
  const versao = versaoLeiaute(ano);
  R0.push(["0000", versao, "0", dt(ini), dt(fim), tx(emp.nome, 100), so(emp.cnpj), "", emp.uf, so(emp.ie), so(emp.codMun), tx(emp.im), "", emp.perfil, emp.ativ]);
  R0.push(["0001", "0"]);
  if (emp.ativ === "0") R0.push(["0002", emp.clasInd]);
  R0.push(["0005", tx(emp.fantasia, 60), so(emp.cep), tx(emp.end, 60), tx(emp.num, 10), tx(emp.compl, 60), tx(emp.bairro, 60), so(emp.fone), "", tx(emp.email)]);
  R0.push(["0100", tx(cont.nome, 100), so(cont.cpf), tx(cont.crc, 15), so(cont.cnpj), so(cont.cep), tx(cont.end, 60), tx(cont.num, 10), tx(cont.compl, 60), tx(cont.bairro, 60),
    so(cont.fone), so(cont.fax), tx(cont.email), so(cont.codMun)]);
  for (const p of [...part.values()].sort((a, b) => a.doc.localeCompare(b.doc))) {
    if (!p.codMun) crit("PARTICIPANTE", `${p.nome}: município sem código IBGE no XML.`);
    R0.push(["0150", p.doc, p.nome, p.pais || "1058", p.cnpj, p.cnpj ? "" : p.cpf, p.ie && p.ie !== "0" ? p.ie : "", p.codMun, "", p.end, p.num, p.compl, p.bairro]);
  }
  for (const u of [...unids].sort()) R0.push(["0190", u, UNID_DESCR[u] || u]);
  for (const it of [...itensCad.values()].sort((a, b) => a.cod.localeCompare(b.cod))) R0.push(["0200", it.cod, it.descr, "", "", it.u, it.tipo, it.ncm, "", "", "", "", ""]);
  if (usaRet.n) R0.push(["0450", "RET", `REGIME ESPECIAL E-PTA-RE ${RET_NUM} - TTS/CONFECCOES (SEF/MG)`]);

  // --- Bloco E (provisório: sem crédito presumido / estorno do RET) ---
  deb = r2(deb); cred = r2(cred);
  const saldo = r2(deb - cred);
  const E = [["E001", "0"], ["E100", dt(ini), dt(fim)],
    ["E110", v2(deb), "0,00", "0,00", "0,00", v2(cred), "0,00", "0,00", "0,00", "0,00", v2(Math.max(0, saldo)), "0,00", v2(Math.max(0, saldo)), v2(Math.max(0, -saldo)), "0,00"]];
  crit("BLOCO_E", `Bloco E provisório: débitos R$ ${v2(deb)} − créditos R$ ${v2(cred)}, sem o RET (crédito presumido de 2% efetivo, estorno MG50000100 e sub-apuração entram na etapa 2). Sem E116 (obrigação a recolher) até lá.`);
  E.push(["E500", "0", dt(ini), dt(fim)]);
  for (const x of [...e510.values()].sort((a, b) => a.cfop.localeCompare(b.cfop) || a.cst.localeCompare(b.cst))) E.push(["E510", x.cfop, x.cst, v2(x.cont), v2(x.bc), v2(x.ipi)]);
  debIpi = r2(debIpi); credIpi = r2(credIpi);
  const sdIpi = r2(debIpi - credIpi);
  E.push(["E520", "0,00", v2(debIpi), v2(credIpi), "0,00", "0,00", v2(Math.max(0, -sdIpi)), v2(Math.max(0, sdIpi))]);

  // --- montagem final com aberturas/encerramentos e Bloco 9 ---
  const blocos = [
    ["0", R0],
    ["B", []],
    ["C", C],
    ["D", D],
    ["E", E.slice(1)],
    ["G", []],
    ["H", []],
    ["K", []],
    ["1", [["1010", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N"]]],
  ];
  const regs = [];
  for (const [b, rs] of blocos) {
    if (b === "0") { regs.push(...rs.slice(0, 2)); regs.push(...rs.slice(2)); regs.push(["0990", String(rs.length + 1)]); continue; }
    const tem = rs.length > 0 && !(b === "1" && false);
    regs.push([`${b}001`, b === "B" ? "1" : tem ? "0" : "1"]);
    regs.push(...rs);
    regs.push([`${b}990`, String(rs.length + 2)]);
  }
  // 0001 vem logo depois do 0000 (já está); 9900 conta cada tipo de registro
  const cont9 = new Map();
  for (const r of regs) cont9.set(r[0], (cont9.get(r[0]) || 0) + 1);
  const r9 = [["9001", "0"]];
  const tipos = [...cont9.keys(), "9001", "9900", "9990", "9999"];
  for (const t of tipos) r9.push(["9900", t, t === "9900" ? String(tipos.length) : String(cont9.get(t) || 1)]);
  r9.push(["9990", String(r9.length + 2)]);
  regs.push(...r9);
  regs.push(["9999", String(regs.length + 1)]);
  const texto = regs.map((r) => `|${r.join("|")}|`).join("\r\n") + "\r\n";

  return {
    competencia, versao, texto, criticas,
    resumo: {
      saidas: saidasDb.length, entradas: nfesEnt.length, ctes: ctes.length, participantes: part.size, itens: itensCad.size, linhas: regs.length,
      icmsDebitos: deb, icmsCreditos: cred, ipiDebitos: debIpi, ipiCreditos: credIpi,
      contagem: Object.fromEntries([...cont9.entries()].filter(([k]) => /^(0150|0200|C100|C170|C190|D100)$/.test(k))),
    },
  };
}

// texto → bytes Latin-1 (o que não cabe vira "?")
export function latin1(texto) {
  const b = Buffer.alloc(texto.length);
  for (let i = 0; i < texto.length; i++) { const c = texto.charCodeAt(i); b[i] = c < 256 ? c : 63; }
  return b;
}

// ---------- comparação com outro SPED (ex.: o do KM) ----------
// lê C100/C190/D100 de um arquivo EFD e compara nota a nota pela chave
export function lerResumoEfd(texto) {
  const docs = new Map();
  let atual = null;
  const n = (s) => Number(String(s || "0").replace(",", ".")) || 0;
  for (const l of String(texto).split(/\r?\n/)) {
    const f = l.split("|");
    if (f[1] === "C100") { atual = { tipo: "NF-e", oper: f[2] === "0" ? "ENTRADA" : "SAIDA", numero: f[8], chave: f[9], sit: f[6], vlDoc: n(f[12]), icms: n(f[22]), ipi: n(f[25]), cfops: new Set() }; if (f[9]) docs.set(f[9], atual); }
    else if (f[1] === "C190" && atual) atual.cfops.add(f[3]);
    else if (f[1] === "D100") { atual = { tipo: "CT-e", oper: f[2] === "0" ? "ENTRADA" : "SAIDA", numero: f[9], chave: f[10], sit: f[6], vlDoc: n(f[15]), icms: n(f[20]), ipi: 0, cfops: new Set() }; if (f[10]) docs.set(f[10], atual); }
    else if (f[1] === "D190" && atual) atual.cfops.add(f[3]);
  }
  return docs;
}
export function compararEfd(nosso, outro) {
  const a = lerResumoEfd(nosso), b = lerResumoEfd(outro);
  const so = [], soOutro = [], dif = [];
  const fmt = (x) => ({ tipo: x.tipo, oper: x.oper, numero: x.numero, chave: x.chave, vlDoc: r2(x.vlDoc), icms: r2(x.icms), cfops: [...x.cfops].join(",") });
  for (const [k, x] of a) {
    const y = b.get(k);
    if (!y) { so.push(fmt(x)); continue; }
    const d = [];
    if (Math.abs(x.vlDoc - y.vlDoc) > 0.009) d.push(`valor ${v2(y.vlDoc)} → ${v2(x.vlDoc)}`);
    if (Math.abs(x.icms - y.icms) > 0.009) d.push(`ICMS ${v2(y.icms)} → ${v2(x.icms)}`);
    const ca = [...x.cfops].sort().join(","), cb = [...y.cfops].sort().join(",");
    if (ca !== cb) d.push(`CFOP ${cb} → ${ca}`);
    if (x.sit !== y.sit) d.push(`situação ${y.sit} → ${x.sit}`);
    if (d.length) dif.push({ ...fmt(x), diferencas: d });
  }
  for (const [k, y] of b) if (!a.has(k)) soOutro.push(fmt(y));
  const tot = (m, oper, campo) => r2([...m.values()].filter((x) => x.oper === oper && x.sit !== "02").reduce((s, x) => s + x[campo], 0));
  return {
    totais: {
      nosso: { docs: a.size, entradas: tot(a, "ENTRADA", "vlDoc"), saidas: tot(a, "SAIDA", "vlDoc"), icmsEntradas: tot(a, "ENTRADA", "icms"), icmsSaidas: tot(a, "SAIDA", "icms") },
      outro: { docs: b.size, entradas: tot(b, "ENTRADA", "vlDoc"), saidas: tot(b, "SAIDA", "vlDoc"), icmsEntradas: tot(b, "ENTRADA", "icms"), icmsSaidas: tot(b, "SAIDA", "icms") },
    },
    soNoErp: so, soNoOutro: soOutro, diferentes: dif,
  };
}
