// v557 — CT-e (conhecimento de transporte) no movimento fiscal: leitura do XML e do DACTE (PDF).
// Gera a "nota" no mesmo formato de lerXmlFiscal (vira conta a pagar do tomador) e os dados logísticos (FreteCte).
// Tipo do frete pela NF atendida: emitente da NF é a Meridian/NORT → ENTREGA (NF de saída); senão → COMPRA.
const so = (v) => String(v ?? "").replace(/\D/g, "");
const up = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const brNum = (s) => { const n = Number(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const isoBR = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
export const PROPRIAS_CTE = { "48011287": "MERIDIAN", "55116246": "NORT" };
const propria = (d) => { const s = so(d); return s.length === 14 ? PROPRIAS_CTE[s.slice(0, 8)] || null : null; };

// tipo do frete pela(s) NF(s) atendida(s) (CNPJ do emitente nas posições 7–20 da chave) ou, sem NF, pelo remetente
export function tipoFrete(chavesNf = [], remetenteCnpj = "") {
  if (chavesNf.some((c) => propria(String(c).slice(6, 20)))) return "ENTREGA";
  if (chavesNf.length) return "COMPRA";
  return propria(remetenteCnpj) ? "ENTREGA" : "COMPRA";
}

const parte = (o = {}) => ({ nome: up(o.xNome), fant: up(o.xFant), cnpj: so(o.CNPJ || o.CPF) || null });

// d = XML já convertido (fast-xml-parser, sem namespaces). Devolve null se não for CT-e.
export function lerCteObj(d, nome = "") {
  const inf = d?.cteProc?.CTe?.infCte || d?.CTe?.infCte;
  if (!inf) return null;
  const ide = inf.ide || {}, emit = parte(inf.emit), rem = parte(inf.rem), dest = parte(inf.dest), exped = parte(inf.exped), receb = parte(inf.receb);
  const chave = so(inf["@_Id"]);
  if (chave.length !== 44) throw new Error(`${nome || "arquivo"}: CT-e sem chave de acesso.`);
  // tomador: toma3 (0 remetente · 1 expedidor · 2 recebedor · 3 destinatário) ou toma4 (outro)
  const t3 = ide.toma3?.toma ?? ide.toma03?.toma, t4 = ide.toma4 || ide.toma04;
  const tom = t4 ? parte(t4) : [rem, exped, receb, dest][Number(t3 ?? 3)] || dest;
  const vp = inf.vPrest || {};
  const valor = r2(num(vp.vTPrest) || num(vp.vRec));
  const norm = inf.infCTeNorm || {};
  const chavesNf = [...new Set(arr(norm.infDoc?.infNFe).map((x) => so(x?.chave)).filter((c) => c.length === 44))];
  const nfsPapel = arr(norm.infDoc?.infNF).map((x) => String(x?.nDoc || "").replace(/^0+(?=\d)/, "")).filter(Boolean);
  const qs = arr(norm.infCarga?.infQ).map((q) => ({ un: String(q.cUnid || ""), tp: up(q.tpMed), q: num(q.qCarga) }));
  const vol = qs.find((q) => q.un === "03") || qs.find((q) => /VOLUM|CAIXA|UNID/.test(q.tp));
  const peso = qs.find((q) => q.un === "01" && /BASE/.test(q.tp)) || qs.find((q) => q.un === "01" && /DECLAR/.test(q.tp)) || qs.find((q) => q.un === "01");
  const obs = arr(inf.compl?.ObsCont);
  const prevTxt = obs.find((o) => /dPrev|PREV/i.test(o?.["@_xCampo"] || ""))?.xTexto || "";
  const previsao = String(inf.compl?.Entrega?.comData?.dProg || inf.compl?.Entrega?.comPeriodo?.dFim || "").slice(0, 10) || isoBR(prevTxt) || null;
  const emissao = String(ide.dhEmi || "").slice(0, 10);
  const empresa = propria(tom.cnpj) || propria(dest.cnpj) || propria(rem.cnpj) || null;
  const tipo = tipoFrete(chavesNf, rem.cnpj);
  const numero = String(ide.nCT || chave.slice(25, 34)).replace(/^0+(?=\d)/, "");
  const cte = {
    chave, numero, serie: ide.serie != null ? String(ide.serie) : null, tipo, emissao,
    transportadora: emit.fant || emit.nome, transpCnpj: emit.cnpj,
    origemCidade: up(ide.xMunIni) || null, origemUf: up(ide.UFIni) || null, destinoCidade: up(ide.xMunFim) || null, destinoUf: up(ide.UFFim) || null,
    remetente: rem.nome || null, remetenteCnpj: rem.cnpj, destinatario: dest.nome || null, destinatarioCnpj: dest.cnpj,
    tomador: tom.nome || null, tomadorCnpj: tom.cnpj, valorFrete: valor, valorCarga: r2(num(norm.infCarga?.vCarga)) || null,
    volumes: vol ? vol.q : null, pesoKg: peso ? peso.q : null, previsaoEntrega: previsao, chavesNf, nfsPapel,
  };
  return montarNota(cte, { emit, tomProprio: !!propria(tom.cnpj), natureza: up(ide.natOp) || "PRESTAÇÃO DE SERVIÇO DE TRANSPORTE", cfop: String(ide.CFOP || "") });
}

function montarNota(cte, { emit, tomProprio, natureza, cfop, conferir = null }) {
  const nfs = cte.chavesNf.map((c) => String(Number(c.slice(25, 34))));
  const titulo = `FRETE ${cte.tipo} CT-e ${cte.numero}${nfs.length ? ` · NF ${nfs.join(", ")}` : ""}`;
  return {
    modelo: "CT-e", tipo: "ENTRADA", empresa: propria(cte.tomadorCnpj) || propria(cte.destinatarioCnpj) || propria(cte.remetenteCnpj) || null,
    aviso: tomProprio ? null : `o tomador do frete é ${cte.tomador || "outra empresa"}${cte.tomadorCnpj ? ` (${cte.tomadorCnpj})` : ""}, não a Meridian/NORT`,
    chave: cte.chave, chaveRegistro: `CTE|${cte.chave}`, numero: cte.numero, serie: cte.serie, emissao: cte.emissao,
    parceiro: cte.transportadora, razao: emit?.nome || cte.transportadora, documento: cte.transpCnpj, emitDoc: cte.transpCnpj,
    natureza, cfops: cfop ? [cfop] : [], valor: cte.valorFrete,
    parcelas: [{ parcela: "1", vencimento: cte.emissao, valor: cte.valorFrete, semVencimento: true }],
    tituloCte: titulo, cte, freteTomadorProprio: tomProprio,
    ...(conferir ? { conferir } : {}),
  };
}

/* ---------------- DACTE (PDF) — melhor esforço ---------------- */
function dvOk(ch) {
  if (!/^\d{44}$/.test(ch)) return false;
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(ch[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11; return (r < 2 ? 0 : 11 - r) === Number(ch[43]);
}
const valida = (c, mods) => dvOk(c) && Number(c.slice(0, 2)) >= 11 && Number(c.slice(0, 2)) <= 53 && Number(c.slice(4, 6)) >= 1 && Number(c.slice(4, 6)) <= 12 && mods.includes(c.slice(20, 22));
export function chavesNoTexto(texto, mods, nome = "") {
  const out = [];
  const add = (c) => { if (valida(c, mods) && !out.includes(c)) out.push(c); };
  for (const c of String(nome).match(/\d{44}/g) || []) add(c);
  for (const m of String(texto || "").matchAll(/\d[\d .]{42,70}\d/g)) {
    const d = m[0].replace(/\D/g, "");
    for (let i = 0; i + 44 <= d.length; i++) add(d.slice(i, i + 44));
  }
  return out;
}
export const pareceDacte = (texto, nome = "") => /DACTE|CONHECIMENTO\s+DE\s+TRANSPORTE/i.test(String(texto)) || chavesNoTexto("", ["57"], nome).length > 0;

export function lerDacte(texto, nome = "") {
  const t = String(texto || "").replace(/\s+/g, " ");
  const [chave] = chavesNoTexto(t, ["57", "67"], nome);
  if (!chave) return null;
  const chavesNf = chavesNoTexto(t.split(chave).join(" "), ["55"]);
  const valor = brNum((/VALOR\s+TOTAL\s+(?:DO\s+)?SERVI[ÇC]O\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t) || /VALOR\s+A\s+RECEBER\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t) || [])[1]);
  const carga = brNum((/VALOR\s+TOT(?:AL)?\.?\s+(?:DA\s+)?CARGA\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t) || /CARGA[^0-9]{0,30}R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t) || [])[1]);
  const emissao = isoBR((/EMISS[ÃA]O[^0-9]{0,40}(\d{2}\/\d{2}\/\d{4})/i.exec(t) || [])[1]);
  const prev = isoBR((/PREVIS[ÃA]O\s+(?:DE\s+)?ENTREGA\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(t) || [])[1]) || null;
  // início/término: "UF - código IBGE - cidade"; o layout muda de emissor para emissor, então a origem é a cidade
  // cujo código IBGE é da UF da chave do CT-e (UF de emissão), senão a 1ª
  const munis = [...t.matchAll(/([A-Z]{2})\s*-\s*(\d{7})\s*-\s*(.+?)(?=[A-Z]{2}\s*-\s*\d{7}|\s+IN[ÍI]CIO|\s+T[ÉE]RMINO|\s+REMETENTE|\s+MUNIC|$)/g)]
    .map((m) => ({ uf: m[1], cod: m[2], cidade: up(m[3]) })).filter((m, i, a) => a.findIndex((x) => x.cod === m.cod) === i).slice(0, 2);
  const ori = munis.find((m) => m.cod.slice(0, 2) === chave.slice(0, 2)) || munis[0] || null;
  const des = munis.find((m) => m !== ori) || null;
  const vol = /CAIXAS?\s+E\s+ETC\s*(\d+(?:[.,]\d+)?)/i.exec(t) || /VOLUMES?\s*:?\s*(\d+(?:[.,]\d+)?)/i.exec(t);
  const peso = /PESO\s+BASE\s+DE\s*(\d+(?:\.\d{3})*(?:,\d+)?)/i.exec(t) || /PESO\s+DECLARA\w*\s*(\d+(?:\.\d{3})*(?:,\d+)?)/i.exec(t);
  const transpCnpj = chave.slice(6, 20);
  const remCnpj = chavesNf[0] ? chavesNf[0].slice(6, 20) : null;   // o emitente da NF é o remetente
  const tipo = tipoFrete(chavesNf, remCnpj);
  const numero = String(Number(chave.slice(25, 34)));
  const cte = {
    chave, numero, serie: String(Number(chave.slice(22, 25))), tipo, emissao,
    transportadora: "", transpCnpj,   // o nome sai do cadastro pelo CNPJ (ou é digitado na conferência)
    origemCidade: ori?.cidade || null, origemUf: ori?.uf || null, destinoCidade: des?.cidade || null, destinoUf: des?.uf || null,
    remetente: null, remetenteCnpj: remCnpj, destinatario: null, destinatarioCnpj: null, tomador: null, tomadorCnpj: null,
    valorFrete: r2(valor), valorCarga: carga ? r2(carga) : null, volumes: vol ? brNum(vol[1]) : null, pesoKg: peso ? brNum(peso[1]) : null,
    previsaoEntrega: prev, chavesNf, nfsPapel: [],
  };
  return montarNota(cte, { emit: null, tomProprio: true, natureza: "PRESTAÇÃO DE SERVIÇO DE TRANSPORTE", cfop: "",
    conferir: "CT-e lido do PDF (DACTE) — confira transportadora, valor e vencimento; suba o XML junto para ter todos os dados do frete" });
}
