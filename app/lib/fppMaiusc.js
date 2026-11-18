// v973 — tudo que é texto na FPP é gravado em MAIÚSCULAS (campos da ficha, detalhes dos artigos, extras, aplicações…).
//   Ficam como estão: arquivos/imagens (data:, arq:), links, e-mails, ids, datas e textos-código longos sem espaço.
const PULA_CHAVE = /(grupoCores|chaveGrupo|base64|url|src|link|arquivo|anexo|foto|imagem|email|mime|token|^id$|Id$|Ids$|Em$|^data$|^createdAt$|^updatedAt$)/i;
const ehCodigo = (s) => /^(data:|arq:|https?:\/\/|blob:)/i.test(s) || /@/.test(s) || (s.length > 120 && !/\s/.test(s)) || /^\d{4}-\d{2}-\d{2}(T|$)/.test(s);
export function maiusc(v, chave = "") {
  if (typeof v === "string") return PULA_CHAVE.test(chave) || ehCodigo(v) ? v : v.toLocaleUpperCase("pt-BR");
  if (Array.isArray(v)) return v.map((x) => maiusc(x, chave));
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if (PULA_CHAVE.test(chave)) return v;
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = maiusc(x, k);
    return o;
  }
  return v;
}
export const up = (s) => (s ? String(s).trim().toLocaleUpperCase("pt-BR") : s);
