import { XMLParser } from "fast-xml-parser";

// CFOPs de VENDA (entrada de mercadoria por compra). 1xxx/2xxx = entrada; 5xxx/6xxx = saída do fornecedor.
const CFOP_VENDA = new Set([
  "1101","1102","1113","1116","1117","1118","1121","1122","2101","2102","2113","2116","2117","2118","2121","2122",
  "1401","1403","2401","2403",
  "5101","5102","5103","5104","5105","5106","5109","5110","5111","5112","5113","5114","5115","5116","5117","5118","5119","5120","5122","5123",
  "6101","6102","6103","6104","6105","6106","6107","6108","6109","6110","6111","6112","6113","6114","6115","6116","6117","6118","6119","6120","6122","6123",
  "5401","5402","5403","5405","6401","6402","6403","6404",
]);

// Palavras que denunciam operação que NÃO é venda -> recusar
const REJEITAR_NATUREZA = [
  "remessa", "industrializ", "comodato", "conserto", "consigna", "demonstra",
  "amostra", "brinde", "bonifica", "ativo imobilizado", "uso e consumo",
  "devolu", "transfer", "simples fatur", "outras saidas", "outras saídas",
];

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/\./g, ".").replace(",", "."));
  return isNaN(n) ? null : n;
};
const brNum = (s) => (s ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : null);

// Extrai categoria/composição/largura/gramatura a partir da descrição
export function camposDoTexto(txt) {
  const t = (txt || "").toUpperCase();
  let categoria = "AVIAMENTO";
  if (t.includes("MALHA")) categoria = "MALHA";
  else if (t.includes("TECIDO") || t.includes("PLANO") || t.includes("SARJA") || t.includes("OXFORD")) categoria = "TECIDO";

  const comp = /COMPOSI[ÇC][ÃA]O:?\s*([^,;]+(?:\+[^,;]+)*)/i.exec(txt || "");
  const larg = /LARGURA\s*([\d.,]+)\s*M/i.exec(txt || "");
  const gram = /GRAMATURA\s*([\d.,]+)\s*G/i.exec(txt || "");
  return {
    categoria,
    composicao: comp ? comp[1].trim() : null,
    largura: larg ? brNum(larg[1]) : null,
    gramatura: gram ? brNum(gram[1]) : null,
  };
}

// ---------- XML (NFe 4.00) ----------
export function parseXmlNfe(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);
  const nfe = doc?.nfeProc?.NFe || doc?.NFe;
  const inf = nfe?.infNFe;
  if (!inf) throw new Error("XML não é uma NFe válida.");

  const chave = String(inf["@_Id"] || "").replace(/^NFe/, "");
  const ide = inf.ide || {};
  const emit = inf.emit || {};
  let dets = inf.det || [];
  if (!Array.isArray(dets)) dets = [dets];

  const itens = dets.map((d) => {
    const p = d.prod || {};
    return {
      cProd: p.cProd != null ? String(p.cProd) : null,
      xProd: p.xProd || null,
      ncm: p.NCM != null ? String(p.NCM) : null,
      cfop: p.CFOP != null ? String(p.CFOP) : null,
      uCom: p.uCom || null,
      qCom: num(p.qCom),
      vUn: num(p.vUnCom),
      vProd: num(p.vProd),
      infAdProd: d.infAdProd || null,
    };
  });

  return {
    origem: "XML",
    chave,
    numero: ide.nNF != null ? String(ide.nNF) : null,
    serie: ide.serie != null ? String(ide.serie) : null,
    natOp: ide.natOp || null,
    tpNF: ide.tpNF != null ? String(ide.tpNF) : null,
    emit: {
      cnpj: emit.CNPJ ? String(emit.CNPJ) : null,
      nome: emit.xFant || emit.xNome || null,
      razaoSocial: emit.xNome || null,
    },
    itens,
  };
}

// ---------- PDF (DANFE) — melhor esforço ----------
export function parsePdfNfe(texto) {
  const t = texto || "";
  const chaveMatch = t.replace(/\s+/g, "").match(/(\d{44})/);
  const natMatch = /NATUREZA DA OPERA[ÇC][ÃA]O\s*([^\n]+)/i.exec(t);
  const cnpjMatch = /CNPJ\s*([\d./-]{14,20})/i.exec(t);
  return {
    origem: "PDF",
    chave: chaveMatch ? chaveMatch[1] : null,
    natOp: natMatch ? natMatch[1].trim() : null,
    tpNF: "1",
    emit: { cnpj: cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : null, nome: null, razaoSocial: null },
    itens: [], // itens do PDF ficam para conferência manual (o XML é a fonte confiável)
  };
}

// ---------- Validação: só VENDA ----------
export function validarVenda(nf) {
  const nat = (nf.natOp || "").toLowerCase();
  for (const kw of REJEITAR_NATUREZA)
    if (nat.includes(kw))
      return { ok: false, motivo: `Natureza "${nf.natOp}" não é venda — nota recusada.` };

  const cfops = (nf.itens || []).map((i) => i.cfop).filter(Boolean);
  const temCfopVenda = cfops.some((c) => CFOP_VENDA.has(c));
  const ehVenda = nat.includes("venda") || temCfopVenda;

  if (!ehVenda)
    return { ok: false, motivo: "Natureza da operação não é venda — nota recusada." };
  if (!nf.chave || nf.chave.length !== 44)
    return { ok: false, motivo: "Chave de acesso não encontrada/ inválida." };
  return { ok: true };
}

export const unidadeDoUCom = (u) => {
  const x = (u || "").toUpperCase();
  return ["M", "KG", "UN", "PC", "CM"].includes(x) ? x : "UN";
};
