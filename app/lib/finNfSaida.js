// Lê os XMLs das notas de SAÍDA enviados na Contabilidade.
// Serve de base para o cruzamento "valor recebido x NF x nome x CNPJ" na planilha de recebimentos.
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, trimValues: true });

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
};
const soDigitos = (s) => String(s || "").replace(/\D/g, "");
export const formatarCnpj = (s) => {
  const d = soDigitos(s);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d || null;
};
const dia = (s) => {
  const t = String(s || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00.000Z`) : null;
};
const prim = (x) => (Array.isArray(x) ? x[0] : x);

// NF-e / NFC-e (modelo 55/65)
function lerNfe(doc) {
  const nfe = prim(doc?.nfeProc?.NFe) || prim(doc?.NFe);
  const inf = nfe?.infNFe;
  if (!inf) return null;
  const ide = inf.ide || {};
  const dest = inf.dest || {};
  const tot = inf.total?.ICMSTot || {};
  const chave = String(inf["@_Id"] || "").replace(/^NFe/i, "").replace(/\D/g, "");
  const emissao = dia(ide.dhEmi || ide.dEmi);
  const valor = num(tot.vNF);
  if (!chave || !emissao || valor === null) return null;
  return {
    chave,
    numero: String(ide.nNF || "").trim(),
    serie: String(ide.serie || "").trim() || null,
    emissao,
    valor,
    destNome: String(dest.xNome || "").toUpperCase().trim() || "SEM DESTINATÁRIO",
    destCnpj: formatarCnpj(dest.CNPJ || dest.CPF || ""),
    natureza: String(ide.natOp || "").toUpperCase().trim() || null,
  };
}

// NFS-e (padrão ABRASF e nacional) — serviço prestado
function lerNfse(doc) {
  const achar = (no, nomes, prof = 0) => {
    if (!no || typeof no !== "object" || prof > 8) return null;
    for (const k of Object.keys(no)) {
      if (nomes.includes(k)) return no[k];
      const r = achar(prim(no[k]), nomes, prof + 1);
      if (r != null) return r;
    }
    return null;
  };
  const inf = prim(achar(doc, ["InfNfse", "infNFSe", "InfNFSe"]));
  if (!inf) return null;
  const numero = String(prim(achar(inf, ["Numero", "nNFSe"])) || "").trim();
  const emissao = dia(prim(achar(inf, ["DataEmissao", "dhEmi", "dhProc"])));
  const valor = num(prim(achar(inf, ["ValorLiquidoNfse", "ValorServicos", "vLiq", "vServ"])));
  const tomador = prim(achar(inf, ["TomadorServico", "Tomador", "toma"])) || {};
  const nome = String(prim(achar(tomador, ["RazaoSocial", "xNome"])) || "").toUpperCase().trim();
  const cnpj = prim(achar(tomador, ["Cnpj", "CNPJ", "Cpf", "CPF"]));
  const chave = String(prim(achar(inf, ["CodigoVerificacao", "chNFSe"])) || `NFSE-${numero}-${emissao ? emissao.toISOString().slice(0, 10) : ""}`);
  if (!numero || !emissao || valor === null) return null;
  return {
    chave: chave.replace(/\s/g, "").slice(0, 60),
    numero, serie: null, emissao, valor,
    destNome: nome || "SEM TOMADOR",
    destCnpj: formatarCnpj(cnpj),
    natureza: "SERVIÇO PRESTADO",
  };
}

// Devolve os dados da nota ou null se o XML não for nota.
export function lerXmlSaida(xmlTexto) {
  let doc;
  try { doc = parser.parse(String(xmlTexto)); } catch { return null; }
  return lerNfe(doc) || lerNfse(doc);
}

// v360 — evento de cancelamento de NF-e (tpEvento 110111): devolve a chave cancelada
export function chaveCancelada(xmlTexto) {
  const t = String(xmlTexto || "");
  if (!/<tpEvento>\s*110111\s*<\/tpEvento>/.test(t)) return null;
  const m = t.match(/<chNFe>\s*(\d{44})\s*<\/chNFe>/);
  return m ? m[1] : null;
}

// v360 — ZIP do mês (XML + DANFE, pode vir com ZIP dentro de ZIP): lê as notas e aplica os cancelamentos
export async function processarZipSaidas(competencia, buf, docId, unzipSync) {
  const xmls = [], pdfsArq = {}; let pdfs = 0, outros = 0;
  const abrir = (u8, nivel) => {
    const ent = unzipSync(u8);
    for (const [caminho, dado] of Object.entries(ent)) {
      const nome = caminho.split("/").pop();
      if (!nome || caminho.includes("__MACOSX") || nome.startsWith(".")) continue;
      if (/\.zip$/i.test(nome) && nivel < 3) abrir(dado, nivel + 1);
      else if (/\.xml$/i.test(nome)) xmls.push({ nome, texto: Buffer.from(dado).toString("utf8") });
      else if (/\.pdf$/i.test(nome)) { pdfs++; const ch = (nome.match(/\d{44}/) || [])[0]; if (ch) pdfsArq[ch] = { nome, b64: Buffer.from(dado).toString("base64") }; }
      else outros++;
    }
  };
  abrir(new Uint8Array(buf), 0);
  const canceladas = new Set(xmls.map((x) => chaveCancelada(x.texto)).filter(Boolean));
  let lidas = 0, ignoradas = 0, semMovimento = 0, soRegistro = 0;
  const { registrarDaContabilidade } = await import("@/lib/fiscal");
  for (const x of xmls) {
    if (chaveCancelada(x.texto)) continue;
    const n = lerXmlSaida(x.texto);
    if (!n) { ignoradas++; continue; }
    const cancelada = canceladas.has(n.chave);
    if (!cancelada) { await registrarXmlSaida(competencia, x.texto, docId); lidas++; }
    // v360 — não estava no movimento fiscal: entra lá; com recebível, em vermelho com a crítica; cancelada/remessa só registrada
    const r = await registrarDaContabilidade(x.texto, x.nome, pdfsArq[soDigitos(n.chave)] || null, { cancelada }).catch((e) => { console.log(`contab→fiscal NF ${n.numero}:`, e.message); return null; });
    if (r === "CRITICA") semMovimento++; else if (r === "REGISTRO") soRegistro++;
  }
  const removidas = canceladas.size ? (await prisma.finNfSaida.deleteMany({ where: { chave: { in: [...canceladas] } } })).count : 0;
  return { xmls: xmls.length, pdfs, outros, lidas, canceladas: canceladas.size, removidas, ignoradas, semMovimento, soRegistro };
}

// Grava (ou atualiza) a nota lida de um XML. Retorna { ok, nota } ou { ok:false, erro }.
export async function registrarXmlSaida(competencia, xmlTexto, docId = null) {
  const n = lerXmlSaida(xmlTexto);
  if (!n) return { ok: false, erro: "XML não reconhecido como nota fiscal." };
  const nota = await prisma.finNfSaida.upsert({
    where: { chave: n.chave },
    create: { ...n, competencia, docId },
    update: { ...n, competencia, docId },
    select: { id: true, numero: true, valor: true, destNome: true, destCnpj: true, emissao: true },
  });
  return { ok: true, nota };
}
