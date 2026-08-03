import { XMLParser } from "fast-xml-parser";

const soDig = (v) => String(v || "").replace(/\D/g, "");
const up = (v) => (v == null ? null : String(v).trim().toUpperCase() || null);
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

// ---------- XML NFe -> dados do CLIENTE (destinatário) + a nota ----------
export function parseClienteXml(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);
  const nfe = doc?.nfeProc?.NFe || doc?.NFe;
  const inf = nfe?.infNFe;
  if (!inf) throw new Error("XML não é uma NFe válida.");

  const chave = String(inf["@_Id"] || "").replace(/^NFe/, "");
  const ide = inf.ide || {};
  const dest = inf.dest || {};
  const end = dest.enderDest || {};

  const cnpj = soDig(dest.CNPJ || dest.CPF);
  if (!cnpj) throw new Error("Nota sem destinatário (CNPJ/CPF).");

  // pedido de venda: xPed do 1º item; senão procura no infCpl
  let dets = inf.det || [];
  if (!Array.isArray(dets)) dets = [dets];
  let pedido = null;
  for (const d of dets) {
    if (d?.prod?.xPed != null) { pedido = String(d.prod.xPed).trim(); break; }
  }
  if (!pedido) {
    const cpl = inf.infAdic?.infCpl || "";
    const m = /(?:PEDIDO|PED\.?|PV|O\.?S\.?)\s*[:#-]?\s*([0-9]{3,})/i.exec(cpl);
    if (m) pedido = m[1];
  }

  const tot = inf.total?.ICMSTot;
  const valorTotal = tot && tot.vNF != null ? num(tot.vNF) : null;

  return {
    chave,
    numero: ide.nNF != null ? String(ide.nNF) : null,
    dataEmissao: ide.dhEmi || ide.dEmi || null,
    tpNF: ide.tpNF != null ? String(ide.tpNF) : null,
    valorTotal,
    pedido,
    cliente: {
      cnpj,
      razaoSocial: up(dest.xNome),
      inscricaoEstadual: up(dest.IE),
      logradouro: up(end.xLgr),
      numero: up(end.nro),
      complemento: up(end.xCpl),
      bairro: up(end.xBairro),
      municipio: up(end.xMun),
      uf: up(end.UF),
      cep: soDig(end.CEP) || null,
      // no XML de venda, o telefone/email do dest às vezes existem:
      telefones: end.fone ? String(end.fone) : null,
      emailNf: dest.email ? String(dest.email).toLowerCase() : null,
    },
  };
}

// ---------- Planilha (xlsx/csv) -> linhas mapeadas por palavra-chave ----------
// Recebe uma matriz de linhas (array de arrays) já lida pelo SheetJS.
const COLS = [
  ["cnpj", /CNPJ|CPF/],
  ["razaoSocial", /RAZAO/],
  ["nomeFantasia", /FANTASIA|NOME FANT/],
  ["inscricaoEstadual", /INSCRI|(^|\s)IE(\s|$)|EST(A|Á)DUAL/],
  ["preposto", /PREPOSTO|CONTATO|RESPONS/],
  ["telefones", /TELEFONE|FONE|CELULAR|WHATS|CONTATO TEL/],
  ["emailNf", /E-?MAIL|BOLETO|NF-?E|ENVIO/],
  ["obs", /OBS|OBSERVA/],
  ["logradouro", /ENDERE|LOGRADOURO|RUA|AV\./],
  ["municipio", /MUNIC|CIDADE/],
  ["uf", /(^|\s)UF(\s|$)|ESTADO/],
];

export function mapPlanilha(rows) {
  if (!rows || !rows.length) return [];
  // acha a linha de cabeçalho (a que tem "CNPJ" ou "RAZAO")
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = norm(rows[i].join(" "));
    if (/CNPJ|RAZAO SOCIAL|FANTASIA/.test(joined)) { headerIdx = i; break; }
  }
  const header = rows[headerIdx].map((h) => norm(h));
  // mapeia índice de coluna -> campo
  const colMap = {};
  header.forEach((h, idx) => {
    for (const [campo, re] of COLS) {
      if (colMap[campo] === undefined && re.test(h)) { colMap[campo] = idx; break; }
    }
  });

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.length) continue;
    const get = (campo) => {
      const idx = colMap[campo];
      if (idx === undefined) return null;
      const v = r[idx];
      return v === undefined || v === null || String(v).trim() === "" ? null : v;
    };
    const cnpj = soDig(get("cnpj"));
    const razao = get("razaoSocial") || get("nomeFantasia");
    if (!cnpj && !razao) continue;
    out.push({
      cnpj: cnpj || null,
      matchNome: norm(razao),
      razaoSocial: up(get("razaoSocial")),
      nomeFantasia: up(get("nomeFantasia")),
      inscricaoEstadual: up(get("inscricaoEstadual")),
      preposto: up(get("preposto")),
      telefones: get("telefones") != null ? String(get("telefones")).trim() : null,
      emailNf: get("emailNf") != null ? String(get("emailNf")).trim().toLowerCase() : null,
      obs: get("obs") != null ? String(get("obs")).trim() : null,
      logradouro: up(get("logradouro")),
      municipio: up(get("municipio")),
      uf: up(get("uf")),
    });
  }
  return { colMap, linhas: out };
}

export { norm as normNome };
