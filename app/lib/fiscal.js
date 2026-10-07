// v158 — ADM › Movimento fiscal: importação de NFs (XML e PDF) de ENTRADA e de SAÍDA emitidas pelo sistema antigo.
// Entrada (a Meridian/NORT é destinatária) → contas a PAGAR. Saída (a Meridian/NORT é emitente) → contas a RECEBER.
// Cada nota fica registrada em FiscalNota (com XML/PDF); as contas criadas usam a mesma chave de importação do
// resto do sistema (NFE|chave|parcela e NFSE|cnpj|numero|parcela), então a mesma parcela nunca entra duas vezes.
import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { r2, so, mesDe, dataUTC, validarRateio, nomeU } from "@/lib/finTitulos";

export const PROPRIAS = { "48011287": "MERIDIAN", "55116246": "NORT" };
export const empresaDoDoc = (d) => { const s = so(d); return s.length === 14 ? PROPRIAS[s.slice(0, 8)] || null : null; };
const DIA = 86400000;
const up = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
const sem = (s) => up(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const brNum = (s) => { const n = Number(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const isoBR = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
export const hashTexto = (t) => createHash("sha256").update(Buffer.from(String(t || ""), "utf8")).digest("hex");
export const hashB64 = (b) => createHash("sha256").update(Buffer.from(String(b || ""), "base64")).digest("hex");

/* ---------------- natureza: a nota gera conta? ---------------- */
const NAO_FIN = ["REMESSA", "RETORNO", "DEVOLU", "INDUSTRIALIZ", "COMODATO", "CONSERTO", "CONSIGNA", "DEMONSTRA", "AMOSTRA", "BRINDE", "BONIFICA", "TRANSFER", "ANULA", "ESTORNO"];
// devolve null se é operação financeira (venda/compra/serviço) ou o motivo para só registrar
export function motivoSemConta(natureza, cfops = []) {
  const n = sem(natureza);
  const k = NAO_FIN.find((w) => n.includes(w));
  if (k && !(n.includes("VENDA") && !/DEVOLU|RETORNO|REMESSA/.test(n))) return `natureza "${up(natureza)}" não gera conta`;
  if (n && (n.includes("VENDA") || n.includes("COMPRA") || n.includes("SERVI") || n.includes("PRESTA"))) return null;
  const c = cfops.map(String).filter((x) => /^\d{4}$/.test(x));
  if (c.length) {
    const resto = (x) => Number(x.slice(1));
    const naoFin = (x) => (resto(x) >= 900 && resto(x) !== 933) || (resto(x) >= 200 && resto(x) < 300) || [410, 411, 553, 556, 660, 661, 662].includes(resto(x));
    if (c.every(naoFin)) return `CFOP ${c.join(", ")} não gera conta (remessa, retorno ou devolução)`;
  }
  return null;
}

/* ---------------- XML ---------------- */
const P = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, parseTagValue: false });
// procura a 1ª chave (sem diferenciar maiúsculas) em qualquer nível; "dentro" restringe a um ramo (prestador, tomador)
function achar(obj, nomes, dentro) {
  const alvo = nomes.map((n) => n.toLowerCase());
  let achado;
  const vis = (o, ok) => {
    if (achado !== undefined || o == null || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      const kl = k.toLowerCase();
      const ok2 = ok || (dentro ? dentro.some((d) => kl.includes(d)) : true);
      if (ok2 && alvo.includes(kl) && (typeof v !== "object" || v?.["#text"] != null)) { achado = typeof v === "object" ? v["#text"] : v; return; }
      vis(v, ok2);
      if (achado !== undefined) return;
    }
  };
  vis(obj, !dentro);
  return achado;
}

function lado(emitDoc, destDoc, tpNF) {
  const eE = empresaDoDoc(emitDoc), eD = empresaDoDoc(destDoc);
  if (eE && String(tpNF) !== "0") return { tipo: "SAIDA", empresa: eE, parte: "dest" };
  if (eE) return { tipo: "ENTRADA", empresa: eE, parte: "dest", aviso: "nota de entrada emitida pela própria empresa" };
  if (eD) return { tipo: "ENTRADA", empresa: eD, parte: "emit" };
  return { tipo: "ENTRADA", empresa: null, parte: "emit", aviso: "a nota não traz o CNPJ da Meridian nem da NORT — confira" };
}

export function lerXmlFiscal(xml, nome = "") {
  let d;
  try { d = P.parse(String(xml)); } catch { throw new Error("XML inválido."); }
  const inf = d?.nfeProc?.NFe?.infNFe || d?.NFe?.infNFe;
  if (inf) {
    const ide = inf.ide || {}, emit = inf.emit || {}, dest = inf.dest || {};
    const chave = so(inf["@_Id"]);
    const emitDoc = so(emit.CNPJ || emit.CPF), destDoc = so(dest.CNPJ || dest.CPF);
    const l = lado(emitDoc, destDoc, ide.tpNF);
    const parte = l.parte === "emit" ? emit : dest;
    const emissao = String(ide.dhEmi || ide.dEmi || "").slice(0, 10);
    const valor = num(inf.total?.ICMSTot?.vNF);
    const cfops = [...new Set(arr(inf.det).map((x) => String(x?.prod?.CFOP || "")).filter(Boolean))];
    const dups = arr(inf.cobr?.dup);
    const parcelas = dups.length
      ? dups.map((p, i) => ({ parcela: String(p.nDup || i + 1).replace(/^0+(?=\d)/, ""), vencimento: String(p.dVenc || emissao).slice(0, 10), valor: r2(num(p.vDup)) }))
      : [{ parcela: "1", vencimento: emissao, valor: r2(valor), semVencimento: true }];
    return {
      modelo: "NF-e", tipo: l.tipo, empresa: l.empresa, aviso: l.aviso || null,
      chave, chaveRegistro: `NFE|${chave}`, numero: String(ide.nNF || chave.slice(25, 34)).replace(/^0+(?=\d)/, ""), serie: ide.serie != null ? String(ide.serie) : null,
      emissao, parceiro: up(l.parte === "emit" ? emit.xFant || emit.xNome : dest.xNome), razao: up(parte.xNome),
      documento: so(parte.CNPJ || parte.CPF) || null, emitDoc, natureza: up(ide.natOp) || null, cfops, valor: r2(valor), parcelas,
    };
  }
  // NFS-e: ABRASF, padrão nacional e variações municipais
  const valor = num(achar(d, ["vLiq", "ValorLiquidoNfse", "ValorLiquido", "vServ", "ValorServicos", "ValorTotal", "ValorNota"]));
  if (!valor) throw new Error(`${nome || "arquivo"}: não reconheci como NF-e nem NFS-e.`);
  const prestDoc = so(achar(d, ["CNPJ", "Cnpj", "CPF", "Cpf"], ["prestador", "emit"]));
  const tomaDoc = so(achar(d, ["CNPJ", "Cnpj", "CPF", "Cpf"], ["tomador", "toma"]));
  const prestNome = up(achar(d, ["xFant", "NomeFantasia", "xNome", "RazaoSocial", "Nome"], ["prestador", "emit"]));
  const tomaNome = up(achar(d, ["xNome", "RazaoSocial", "Nome"], ["tomador", "toma"]));
  const numero = String(achar(d, ["nNFSe", "Numero", "NumeroNfse", "nDFSe"]) || "").replace(/^0+(?=\d)/, "");
  const emissao = String(achar(d, ["dhEmi", "DataEmissao", "dhProc", "DataEmissaoNfse", "Competencia", "dCompet"]) || "").slice(0, 10);
  const l = lado(prestDoc, tomaDoc, "1");
  const ehSaida = l.tipo === "SAIDA";
  return {
    modelo: "NFS-e", tipo: l.tipo, empresa: l.empresa, aviso: l.aviso || null,
    chave: null, chaveRegistro: `NFSE|${prestDoc}|${numero}`, numero, serie: null, emissao,
    parceiro: ehSaida ? tomaNome : prestNome, razao: ehSaida ? tomaNome : prestNome, documento: (ehSaida ? tomaDoc : prestDoc) || null, emitDoc: prestDoc,
    natureza: "PRESTAÇÃO DE SERVIÇO", cfops: [], valor: r2(valor),
    parcelas: [{ parcela: "1", vencimento: emissao, valor: r2(valor), semVencimento: true }],
  };
}

/* ---------------- PDF (DANFE ou NFS-e) — melhor esforço, tudo editável na conferência ---------------- */
export function dvChaveOk(ch) {
  if (!/^\d{44}$/.test(ch)) return false;
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(ch[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11, dv = r < 2 ? 0 : 11 - r;
  return dv === Number(ch[43]);
}
function acharChave(texto) {
  const runs = String(texto || "").match(/\d[\d .]{42,70}\d/g) || [];
  for (const r of runs) {
    const d = r.replace(/\D/g, "");
    for (let i = 0; i + 44 <= d.length; i++) { const c = d.slice(i, i + 44); if (dvChaveOk(c)) return c; }
  }
  return null;
}
const docsDoTexto = (t) => {
  const out = [];
  for (const m of String(t).matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/g)) { const d = so(m[0]); if ((d.length === 14 || d.length === 11) && !out.includes(d)) out.push(d); }
  return out;
};
const valorApos = (t, rx) => { const m = rx.exec(t); return m ? brNum(m[1]) : 0; };

export function lerPdfFiscal(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const chave = acharChave(t);
  const docs = docsDoTexto(t.replace(/\d{44}/g, " "));
  const emissao = isoBR((/EMISS[ÃA]O[^0-9]{0,40}(\d{2}\/\d{2}\/\d{4})/i.exec(t) || [])[1]) || isoBR((/(\d{2}\/\d{2}\/\d{4})/.exec(t) || [])[1]);
  let natureza = ((/NATUREZA\s+DA\s+OPERA[ÇC][ÃA]O\s*[:\-]?\s*([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú .\/\-]{3,60})/i.exec(t) || [])[1] || "").trim();
  if (natureza && !/VENDA|COMPRA|SERVI|PRESTA|REMESSA|RETORNO|DEVOLU|INDUSTRIALIZ|BONIFICA|BRINDE|AMOSTRA|CONSIGNA|COMODATO|CONSERTO|TRANSFER/i.test(natureza)) natureza = "";
  natureza = up(natureza.replace(/\s+(PROTOCOLO|INSCRI|CHAVE|N[ºO°]\.?)\b.*$/i, "")) || null;
  // duplicatas: só no trecho FATURA/DUPLICATA (até o cálculo do imposto)
  const ini = t.search(/FATURA|DUPLICATA/i);
  const fimRel = ini >= 0 ? t.slice(ini).search(/C[ÁA]LCULO\s+DO\s+IMPOSTO|TRANSPORTADOR|DADOS\s+DO\s+PRODUTO/i) : -1;
  const trecho = ini >= 0 ? t.slice(ini, fimRel > 0 ? ini + fimRel : ini + 1500) : "";
  const parcelas = [];
  for (const m of trecho.matchAll(/(?:N[ÚU]M(?:ERO)?\.?\s*)?(\d{1,3}(?:\/\d{1,3})?)\s*(?:VENC(?:IMENTO|\.)?\s*)?(\d{2}\/\d{2}\/\d{4})\s*(?:VALOR\s*)?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/gi)) {
    parcelas.push({ parcela: String(Number(m[1].split("/")[0]) || parcelas.length + 1), vencimento: isoBR(m[2]), valor: r2(brNum(m[3])) });
  }
  if (chave) {
    const emitDoc = chave.slice(6, 20);
    const outro = docs.find((d) => d !== emitDoc) || "";
    const l = lado(emitDoc, outro, "1");
    let valor = valorApos(t, /VALOR\s+TOTAL\s+DA\s+NOTA[^0-9]{0,60}(\d{1,3}(?:\.\d{3})*,\d{2})/i) || valorApos(t, /V\.?\s*TOTAL\s+(?:DA\s+)?N(?:OTA|F)[^0-9]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i);
    const somaDup = r2(parcelas.reduce((s, p) => s + p.valor, 0));
    if (!valor && somaDup) valor = somaDup;
    const numero = String(Number(chave.slice(25, 34)));
    return {
      modelo: chave.slice(20, 22) === "65" ? "NFC-e" : "NF-e", tipo: l.tipo, empresa: l.empresa, aviso: l.aviso || null,
      chave, chaveRegistro: `NFE|${chave}`, numero, serie: String(Number(chave.slice(22, 25))), emissao,
      parceiro: "", razao: "", documento: (l.parte === "emit" ? emitDoc : outro) || null, emitDoc, natureza, cfops: [], valor: r2(valor),
      parcelas: parcelas.length ? parcelas : [{ parcela: "1", vencimento: emissao, valor: r2(valor), semVencimento: true }],
      conferir: "lido do PDF (DANFE) — confira cliente/fornecedor, valor e vencimentos",
    };
  }
  // sem chave: NFS-e em PDF da prefeitura
  const numero = ((/N[ÚU]MERO\s+(?:DA\s+)?NFS-?E\s*[:\-]?\s*(\d+)/i.exec(t) || /NFS-?E\s*N?[º°o.]*\s*[:\-]?\s*(\d{1,12})/i.exec(t) || /N[ÚU]MERO\s+(?:DA\s+)?NOTA\s*[:\-]?\s*(\d+)/i.exec(t) || [])[1] || "").replace(/^0+(?=\d)/, "");
  const valor = valorApos(t, /VALOR\s+L[ÍI]QUIDO(?:\s+DA\s+(?:NOTA|NFS-?E))?[^0-9]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i)
    || valorApos(t, /VALOR\s+(?:TOTAL\s+)?(?:DO\s+SERVI[ÇC]O|DOS\s+SERVI[ÇC]OS|DA\s+NOTA|DA\s+NFS-?E)[^0-9]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  const prestDoc = docs[0] || "", tomaDoc = docs.find((d) => d !== prestDoc) || "";
  const l = lado(prestDoc, tomaDoc, "1");
  return {
    modelo: "NFS-e", tipo: l.tipo, empresa: l.empresa, aviso: l.aviso || null,
    chave: null, chaveRegistro: numero && prestDoc ? `NFSE|${prestDoc}|${numero}` : "", numero, serie: null, emissao,
    parceiro: "", razao: "", documento: (l.tipo === "SAIDA" ? tomaDoc : prestDoc) || null, emitDoc: prestDoc, natureza: "PRESTAÇÃO DE SERVIÇO", cfops: [], valor: r2(valor),
    parcelas: [{ parcela: "1", vencimento: emissao, valor: r2(valor), semVencimento: true }],
    conferir: "PDF sem chave de acesso — confira todos os dados",
  };
}

/* ---------------- títulos ---------------- */
export const tipoTitulo = (tipo) => (tipo === "SAIDA" ? "RECEBER" : "PAGAR");
export function tituloPadrao(n) {
  const base = n.tipo === "SAIDA" ? `NF ${n.numero}` : n.modelo === "NFS-e" ? `SERVIÇO NFS-e ${n.numero}` : `COMPRA NF ${n.numero}`;
  return n.empresa === "NORT" ? `NORT - ${base}` : base;
}
const chaveParcela = (n, p) => `${n.chaveRegistro}|${p.parcela}`;

async function nomeDoDoc(doc) {
  if (!doc) return "";
  const f = await prisma.fornecedorCnpj.findUnique({ where: { cnpj: doc }, select: { razaoSocial: true, fornecedor: { select: { nome: true, nomeFantasia: true, razaoSocial: true } } } }).catch(() => null);
  if (f) return up(f.fornecedor?.nome || f.fornecedor?.nomeFantasia || f.razaoSocial || f.fornecedor?.razaoSocial);
  const fmt = doc.length === 14 ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : doc;
  const c = await prisma.cliente.findFirst({ where: { cnpj: { in: [doc, fmt] } }, select: { razaoSocial: true, nomeFantasia: true } }).catch(() => null);
  if (c) return up(c.nomeFantasia || c.razaoSocial);
  const t = await prisma.finTitulo.findFirst({ where: { documento: doc }, orderBy: { createdAt: "desc" }, select: { parceiro: true } }).catch(() => null);
  return up(t?.parceiro);
}

// conta já lançada por outro caminho (posição de títulos, manual…): mesmo tipo, valor e vencimento ±5 dias,
// com o mesmo CNPJ ou o número da NF no título — conta que já é de outra NF não conta
async function contaParecida(tipo, n, p) {
  if (!p.vencimento || !(p.valor > 0)) return null;
  const d = dataUTC(p.vencimento);
  const l = await prisma.finTitulo.findMany({
    where: { tipo, status: { not: "CANCELADO" }, valor: { gte: p.valor - 0.01, lte: p.valor + 0.01 }, vencimento: { gte: new Date(+d - 5 * DIA), lte: new Date(+d + 5 * DIA) } },
    select: { id: true, titulo: true, numeroDoc: true, documento: true, chaveImport: true, status: true, parceiro: true, vencimento: true },
  });
  const rxNum = n.numero ? new RegExp(`(^|[^0-9])0*${n.numero}([^0-9]|$)`) : null;
  return l.find((t) => {
    const ck = String(t.chaveImport || "");
    if (/^(NFE|NFSE)\|/.test(ck) && !ck.startsWith(n.chaveRegistro)) return false;
    return (n.documento && t.documento === n.documento) || (rxNum && (rxNum.test(t.titulo) || rxNum.test(String(t.numeroDoc || ""))));
  }) || null;
}

let contaVendaId;
async function rateioPadrao(tipoT, n) {
  const ant = n.documento ? await prisma.finTitulo.findMany({ where: { tipo: tipoT, documento: n.documento }, orderBy: { createdAt: "desc" }, take: 10, select: { rateio: true } }) : [];
  const r = ant.map((a) => a.rateio).find((x) => Array.isArray(x) && x.some((y) => y.contaId && y.pct > 0));
  if (r) return { rateio: r, origem: "ÚLTIMA CONTA DESTE PARCEIRO" };
  if (tipoT === "RECEBER" && n.empresa !== "NORT") {
    if (contaVendaId === undefined) contaVendaId = (await prisma.finConta.findUnique({ where: { codigo: "1111000" }, select: { id: true } }).catch(() => null))?.id || null;
    if (contaVendaId) return { rateio: [{ contaId: contaVendaId, pct: 100 }], origem: "VENDA DE UNIFORMES" };
  }
  return { rateio: [], origem: null };
}

/* ---------------- 1) análise (não grava) ---------------- */
// arquivos: [{ nome, xml }] ou [{ nome, b64 }] (PDF). abrirPdf vem de fora para facilitar os testes.
export async function analisar(arquivos, { abrirPdf, senhas = [] } = {}) {
  const notas = [], erros = [];
  const pdfs = [];
  for (const a of arquivos || []) {
    const nome = String(a.nome || "arquivo");
    try {
      if (a.xml != null) {
        const n = lerXmlFiscal(a.xml, nome);
        if (notas.some((x) => x.chaveRegistro === n.chaveRegistro)) { erros.push(`${nome}: repetido no envio.`); continue; }
        notas.push({ ...n, xml: String(a.xml), xmlNome: nome, hashXml: hashTexto(a.xml), fonte: "XML" });
      } else if (a.b64) {
        const r = abrirPdf ? await abrirPdf(Buffer.from(a.b64, "base64"), senhas) : { ok: false, erro: "leitor de PDF indisponível" };
        if (!r.ok) { erros.push(`${nome}: ${r.precisaSenha ? "PDF com senha (cadastre em Dados financeiros › Senhas de PDF)" : r.erro || "não abriu"}.`); continue; }
        pdfs.push({ ...lerPdfFiscal(r.texto), pdf: a.b64, pdfNome: nome, hashPdf: hashB64(a.b64), fonte: "PDF" });
      } else erros.push(`${nome}: formato não aceito (só XML e PDF).`);
    } catch (e) { erros.push(`${nome}: ${e.message}`); }
  }
  // PDF que é a mesma nota de um XML do envio vira o PDF dessa nota
  for (const p of pdfs) {
    const par = notas.find((n) => (p.chave && n.chave === p.chave) || (!p.chave && p.chaveRegistro && n.chaveRegistro === p.chaveRegistro));
    if (par) { if (!par.pdf) Object.assign(par, { pdf: p.pdf, pdfNome: p.pdfNome, hashPdf: p.hashPdf, fonte: "XML+PDF" }); continue; }
    const dup = notas.find((n) => n.fonte === "PDF" && p.chaveRegistro && n.chaveRegistro === p.chaveRegistro);
    if (dup) { erros.push(`${p.pdfNome}: repetido no envio.`); continue; }
    notas.push(p);
  }
  // completa, compara com o que já existe e sugere a decisão
  const out = [];
  for (const n of notas) {
    const tipoT = tipoTitulo(n.tipo);
    if (!n.parceiro && n.documento) n.parceiro = await nomeDoDoc(n.documento);
    if (!n.razao) n.razao = n.parceiro;
    const existente = n.chaveRegistro ? await prisma.fiscalNota.findUnique({ where: { chaveRegistro: n.chaveRegistro }, select: { id: true, temXml: true, temPdf: true, parcelas: true } }).catch(() => null) : null;
    const semConta = motivoSemConta(n.natureza, n.cfops);
    const parcelas = [];
    for (const p of n.parcelas) {
      const ck = chaveParcela(n, p);
      const ja = n.chaveRegistro ? await prisma.finTitulo.findFirst({ where: { chaveImport: ck, status: { not: "CANCELADO" } }, select: { id: true, titulo: true, status: true } }) : null;
      if (ja) { parcelas.push({ ...p, chaveImport: ck, situacao: "JA_LANCADA", tituloId: ja.id, tituloDesc: `${ja.titulo} (${ja.status === "PAGO" ? "paga" : "em aberto"})`, marcado: true }); continue; }
      const par = await contaParecida(tipoT, n, p);
      if (par) parcelas.push({ ...p, chaveImport: ck, situacao: "LIGAR", tituloId: par.id, tituloDesc: `${par.titulo} · ${par.parceiro} (${par.status === "PAGO" ? "paga" : "em aberto"})`, marcado: true });
      else parcelas.push({ ...p, chaveImport: ck, situacao: "NOVA", marcado: true });
    }
    const { rateio, origem } = await rateioPadrao(tipoT, n);
    const completa = existente && ((n.pdf && !existente.temPdf) || (n.xml && !existente.temXml));
    const decisao = existente ? (completa ? "COMPLETAR" : "IGNORAR") : semConta ? "REGISTRAR" : "LANCAR";
    out.push({
      ...n, tipoTitulo: tipoT, titulo: tituloPadrao(n), parcelas, rateio, rateioOrigem: origem, motivoSemConta: semConta,
      existenteId: existente?.id || null, existenteFalta: completa ? (n.pdf && !existente.temPdf ? "PDF" : "XML") : null, decisao,
    });
  }
  return { notas: out, erros };
}

/* ---------------- 2) gravação ---------------- */
async function anexar(tituloId, arquivos, quem) {
  let n = 0;
  for (const a of arquivos) {
    if (!a || !a.conteudo) continue;
    const ja = await prisma.finTituloAnexo.findFirst({ where: { tituloId, hash: a.hash }, select: { id: true } });
    if (ja) continue;
    await prisma.finTituloAnexo.create({ data: { tituloId, nome: a.nome, mime: a.mime, tamanho: Buffer.from(a.conteudo, "base64").length, conteudo: a.conteudo, hash: a.hash, criadoPorNome: quem } });
    n++;
  }
  return n;
}
const arquivosDa = (n) => [
  n.xml ? { nome: n.xmlNome || `NF ${n.numero}.xml`, mime: "application/xml", conteudo: Buffer.from(String(n.xml), "utf8").toString("base64"), hash: n.hashXml || hashTexto(n.xml) } : null,
  n.pdf ? { nome: n.pdfNome || `NF ${n.numero}.pdf`, mime: "application/pdf", conteudo: n.pdf, hash: n.hashPdf || hashB64(n.pdf) } : null,
].filter(Boolean);

function validarNota(n) {
  const nome = `${n.modelo || "NF"} ${n.numero || "?"}`;
  if (!["ENTRADA", "SAIDA"].includes(n.tipo)) return `${nome}: escolha entrada ou saída.`;
  if (!String(n.numero || "").trim()) return `${nome}: informe o número da nota.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.emissao || ""))) return `${nome}: informe a data de emissão.`;
  if (!(r2(n.valor) > 0)) return `${nome}: informe o valor da nota.`;
  if (n.decisao === "LANCAR") {
    if (!up(n.parceiro)) return `${nome}: informe o ${n.tipo === "SAIDA" ? "cliente" : "fornecedor"}.`;
    const marc = (n.parcelas || []).filter((p) => p.marcado);
    if (!marc.length) return `${nome}: marque ao menos uma parcela (ou escolha "Só registrar").`;
    for (const p of marc) {
      if (p.situacao !== "NOVA") continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.vencimento || ""))) return `${nome}: parcela ${p.parcela} sem vencimento.`;
      if (!(r2(p.valor) > 0)) return `${nome}: parcela ${p.parcela} sem valor.`;
    }
    if (marc.some((p) => p.situacao === "NOVA")) { const rt = validarRateio(n.rateio); if (rt.erro) return `${nome}: ${rt.erro}`; }
  }
  return null;
}

// notas: as notas da análise, revisadas na tela. Retorna o resumo por nota.
export async function gravar(notas, u) {
  const quem = nomeU(u);
  const res = [];
  for (const n0 of notas || []) {
    const n = { ...n0, parceiro: up(n0.parceiro), documento: so(n0.documento) || null, numero: String(n0.numero || "").trim().replace(/^0+(?=\d)/, ""), valor: r2(n0.valor) };
    if (n.decisao === "IGNORAR") { res.push({ numero: n.numero, situacao: "IGNORADA" }); continue; }
    // PDF de NFS-e: a chave do registro sai dos dados conferidos na tela (prestador + número)
    if (!n.chaveRegistro || (n.fonte === "PDF" && n.modelo === "NFS-e")) {
      const prest = so(n.tipo === "SAIDA" ? n.emitDoc : n.documento);
      n.chaveRegistro = n.chave ? `NFE|${n.chave}` : prest && n.numero ? `NFSE|${prest}|${n.numero}` : `ARQ|${n.hashPdf || n.hashXml}`;
    }
    const tipoT = tipoTitulo(n.tipo);
    const arqs = arquivosDa(n);

    if (n.decisao === "COMPLETAR") {
      const ex = await prisma.fiscalNota.findUnique({ where: { chaveRegistro: n.chaveRegistro } });
      if (!ex) { res.push({ numero: n.numero, situacao: "ERRO", motivo: "registro não encontrado" }); continue; }
      const data = {};
      if (n.pdf && !ex.temPdf) Object.assign(data, { pdf: n.pdf, pdfNome: n.pdfNome, hashPdf: n.hashPdf, temPdf: true });
      if (n.xml && !ex.temXml) Object.assign(data, { xml: n.xml, xmlNome: n.xmlNome, hashXml: n.hashXml, temXml: true });
      await prisma.fiscalNota.update({ where: { id: ex.id }, data });
      let an = 0;
      for (const p of Array.isArray(ex.parcelas) ? ex.parcelas : []) if (p.tituloId) an += await anexar(p.tituloId, arqs, quem).catch(() => 0);
      res.push({ numero: n.numero, situacao: "COMPLETADA", anexos: an });
      continue;
    }

    const erro = validarNota(n);
    if (erro) { res.push({ numero: n.numero, situacao: "ERRO", motivo: erro }); continue; }

    let reg;
    try {
      reg = await prisma.fiscalNota.create({
        data: {
          tipo: n.tipo, empresa: n.empresa || "MERIDIAN", modelo: n.modelo || "NF-e", chave: n.chave || null, chaveRegistro: n.chaveRegistro,
          numero: n.numero, serie: n.serie || null, emissao: dataUTC(n.emissao), competencia: mesDe(n.emissao),
          parceiro: n.parceiro || "SEM NOME", documento: n.documento, natureza: n.natureza || null, valor: n.valor,
          acao: n.decisao === "LANCAR" ? "LANCADA" : "REGISTRADA", motivo: n.decisao === "LANCAR" ? null : n.motivoSemConta || "SÓ REGISTRO",
          xml: n.xml || null, xmlNome: n.xml ? n.xmlNome : null, hashXml: n.xml ? n.hashXml : null, temXml: !!n.xml,
          pdf: n.pdf || null, pdfNome: n.pdf ? n.pdfNome : null, hashPdf: n.pdf ? n.hashPdf : null, temPdf: !!n.pdf,
          parcelas: [], criadoPorId: u.id, criadoPorNome: quem,
        },
      });
    } catch (e) {
      if (String(e.code) === "P2002") { res.push({ numero: n.numero, situacao: "JA_IMPORTADA" }); continue; }
      throw e;
    }

    const parc = [];
    const r = { numero: n.numero, parceiro: n.parceiro, tipo: n.tipo, situacao: n.decisao === "LANCAR" ? "LANCADA" : "REGISTRADA", criadas: 0, ligadas: 0, valor: 0 };
    if (n.decisao === "LANCAR") {
      const marc = n.parcelas.filter((p) => p.marcado);
      const rt = validarRateio(n.rateio);
      const titulo0 = up(n.titulo) || tituloPadrao(n);
      for (const p of marc) {
        if (p.situacao !== "NOVA" && p.tituloId) {
          const t = await prisma.finTitulo.findUnique({ where: { id: Number(p.tituloId) }, select: { id: true } });
          if (t) {
            await anexar(t.id, arqs, quem);
            parc.push({ parcela: p.parcela, vencimento: p.vencimento, valor: r2(p.valor), tituloId: t.id, situacao: p.situacao === "LIGAR" ? "LIGADA" : "JA_LANCADA" });
            r.ligadas++;
            continue;
          }
        }
        // libera a chave de uma conta antiga cancelada
        const ck = chaveParcela(n, p);
        const velha = await prisma.finTitulo.findFirst({ where: { chaveImport: ck }, select: { id: true, status: true } });
        if (velha?.status === "CANCELADO") await prisma.finTitulo.update({ where: { id: velha.id }, data: { chaveImport: `${ck}|CANCELADA|${velha.id}`.slice(0, 190) } });
        else if (velha) { parc.push({ parcela: p.parcela, vencimento: p.vencimento, valor: r2(p.valor), tituloId: velha.id, situacao: "JA_LANCADA" }); await anexar(velha.id, arqs, quem); r.ligadas++; continue; }
        const multi = n.parcelas.length > 1;
        const t = await prisma.finTitulo.create({
          data: {
            tipo: tipoT, titulo: (multi ? `${titulo0} (${p.parcela}/${n.parcelas.length})` : titulo0).slice(0, 190), parceiro: n.parceiro, documento: n.documento,
            numeroDoc: `${n.modelo} ${n.numero}${multi ? ` · PARC ${p.parcela}` : ""}`, valor: r2(p.valor), vencimento: dataUTC(p.vencimento), competencia: mesDe(p.vencimento),
            previsao: false, rateio: rt.rateio, forma: "NF_XML", formaPagamento: p.semVencimento ? null : "BOLETO", chaveImport: ck,
            observacao: `MOVIMENTO FISCAL · NF DE ${n.tipo === "SAIDA" ? "SAÍDA" : "ENTRADA"} ${n.numero} · EMISSÃO ${n.emissao.split("-").reverse().join("/")}`,
            criadoPorId: u.id, criadoPorNome: quem,
          },
        });
        await anexar(t.id, arqs, quem);
        parc.push({ parcela: p.parcela, vencimento: p.vencimento, valor: r2(p.valor), tituloId: t.id, situacao: "CRIADA" });
        r.criadas++; r.valor = r2(r.valor + r2(p.valor));
      }
    }
    await prisma.fiscalNota.update({ where: { id: reg.id }, data: { parcelas: parc } });

    // entrada de NF-e: cadastra/completa o fornecedor pelo emitente
    if (n.tipo === "ENTRADA" && n.xml && n.modelo === "NF-e" && !empresaDoDoc(n.emitDoc)) {
      try {
        const { parseXmlNfe } = await import("@/lib/nf");
        const { fornecedorDoEmitente } = await import("@/lib/nfEntrada");
        await fornecedorDoEmitente(parseXmlNfe(n.xml));
      } catch {}
    }
    // saída: alimenta a base de NFs de saída (ranking de faturamento, recebimentos)
    if (n.tipo === "SAIDA") {
      const dados = {
        competencia: mesDe(n.emissao), numero: n.numero, serie: n.serie || null, emissao: dataUTC(n.emissao), valor: n.valor,
        destNome: n.parceiro || "SEM DESTINATÁRIO", destCnpj: n.documento ? (n.documento.length === 14 ? n.documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : n.documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")) : null,
        natureza: n.natureza || null,
      };
      const chave = (n.chave || n.chaveRegistro).slice(0, 60);
      await prisma.finNfSaida.upsert({ where: { chave }, create: { chave, ...dados }, update: dados }).catch(() => null);
    }
    res.push(r);
  }
  return res;
}

/* ---------------- 3) lista e exclusão ---------------- */
export async function listar({ de, ate, tipo, busca }) {
  const where = {};
  if (de || ate) where.emissao = { ...(de ? { gte: dataUTC(de) } : {}), ...(ate ? { lte: dataUTC(ate) } : {}) };
  if (tipo === "ENTRADA" || tipo === "SAIDA") where.tipo = tipo;
  const b = sem(busca);
  const l = await prisma.fiscalNota.findMany({
    where, orderBy: [{ emissao: "desc" }, { id: "desc" }], take: 2000,
    select: { id: true, tipo: true, empresa: true, modelo: true, chave: true, numero: true, serie: true, emissao: true, parceiro: true, documento: true, natureza: true,
      valor: true, acao: true, motivo: true, temXml: true, temPdf: true, parcelas: true, criadoPorNome: true, createdAt: true },
  });
  const ids = [...new Set(l.flatMap((n) => (Array.isArray(n.parcelas) ? n.parcelas : []).map((p) => p.tituloId)).filter(Boolean))];
  const ts = ids.length ? await prisma.finTitulo.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, vencimento: true, valor: true, valorPago: true } }) : [];
  const porId = Object.fromEntries(ts.map((t) => [t.id, t]));
  return l
    .map((n) => ({
      ...n, valor: Number(n.valor), emissao: n.emissao ? new Date(n.emissao).toISOString().slice(0, 10) : null,
      parcelas: (Array.isArray(n.parcelas) ? n.parcelas : []).map((p) => {
        const t = porId[p.tituloId];
        return { ...p, status: t ? t.status : "EXCLUIDA", vencimento: t ? new Date(t.vencimento).toISOString().slice(0, 10) : p.vencimento, valor: t ? Number(t.valor) : p.valor };
      }),
    }))
    .filter((n) => !b || sem(`${n.numero} ${n.parceiro} ${n.documento || ""} ${n.natureza || ""} ${n.chave || ""}`).includes(b) || String(n.valor.toFixed(2)).includes(b.replace(",", ".")));
}

// apaga o registro: contas CRIADAS por ele vão para a lixeira (só se nenhuma estiver baixada);
// das contas só LIGADAS sai apenas o anexo que esta importação colocou
export async function excluirRegistro(id, quem) {
  const n = await prisma.fiscalNota.findUnique({ where: { id: Number(id) } });
  if (!n) return { ok: true };
  const parc = Array.isArray(n.parcelas) ? n.parcelas : [];
  const criadas = parc.filter((p) => p.situacao === "CRIADA" && p.tituloId);
  const ts = criadas.length ? await prisma.finTitulo.findMany({ where: { id: { in: criadas.map((p) => p.tituloId) } } }) : [];
  if (ts.some((t) => t.status === "PAGO")) return { error: "Há conta desta nota já baixada. Estorne a baixa no contas a pagar/receber antes de excluir." };
  const { excluirTitulo } = await import("@/lib/finLote");
  for (const t of ts) await excluirTitulo(t, quem);
  const hashes = [n.hashXml, n.hashPdf].filter(Boolean);
  const ligadas = parc.filter((p) => p.situacao !== "CRIADA" && p.tituloId).map((p) => p.tituloId);
  if (ligadas.length && hashes.length) await prisma.finTituloAnexo.deleteMany({ where: { tituloId: { in: ligadas }, hash: { in: hashes } } });
  if (n.tipo === "SAIDA") await prisma.finNfSaida.deleteMany({ where: { chave: (n.chave || n.chaveRegistro).slice(0, 60), docId: null } }).catch(() => null);
  await prisma.fiscalNota.delete({ where: { id: n.id } });
  return { ok: true, contas: ts.length };
}
