// v171 — Transmissão de arquivos: um só lugar para enviar qualquer documento.
// Identifica o que é cada arquivo e diz para onde vai; o processamento usa as telas que já existem
// (documentos de contas/comprovantes/análise mensal, NFs, retorno CNAB, antecipação, posição, histórico, cartão de ponto, contabilidade).
import { ehAntecipacao } from "@/lib/finAntecipacao";
import { lerHistorico } from "@/lib/finHistorico";
import { DESTINOS } from "@/lib/finTransmissaoDestinos";

export { DESTINOS };

const BANCO_OFX = { "237": "BRADESCO", "341": "ITAU", "77": "INTER", "336": "C6", "1": "BB", "104": "CAIXA" };
const ext = (nome) => String(nome || "").split(".").pop().toLowerCase();

// mês mais frequente das datas (AAAA-MM)
function mesMaisFrequente(datas) {
  const c = {};
  for (const d of datas) if (/^\d{4}-\d{2}$/.test(d)) c[d] = (c[d] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || null;
}

export function lerOfx(texto) {
  const t = String(texto || "");
  const bankId = String(Number((t.match(/<BANKID>\s*(\d+)/i) || [])[1] || NaN));
  const banco = BANCO_OFX[bankId] || null;
  const datas = [...t.matchAll(/<DTPOSTED>\s*(\d{4})(\d{2})/gi)].map((m) => `${m[1]}-${m[2]}`);
  const fim = (t.match(/<DTEND>\s*(\d{4})(\d{2})/i) || []);
  const competencia = mesMaisFrequente(datas) || (fim[1] ? `${fim[1]}-${fim[2]}` : null);
  return { banco, codigoTipo: banco ? `${banco}_EXTRATO` : null, competencia, bankId: bankId === "NaN" ? null : bankId };
}

export function lerSped(texto) {
  const l = String(texto || "").split(/\r?\n/).find((x) => x.startsWith("|0000|"));
  if (!l) return null;
  const f = l.split("|");
  const d = f.find((x, i) => i > 2 && /^\d{8}$/.test(x));   // DT_INI ddmmaaaa
  return { competencia: d ? `${d.slice(4, 8)}-${d.slice(2, 4)}` : null };
}

const ehRetornoCnab = (txt) => {
  const h = String(txt || "").split(/\r?\n/).find((l) => l.trim());
  return !!h && h[0] === "0" && /RETORNO/.test(h.slice(0, 20));
};
const ehNfXml = (txt) => /<(nfeProc|NFe|procNFe|CompNfse|Nfse|NFSe|cteProc)[\s>]/i.test(txt);
export const ehDanfe = (t) => /DANFE|DOCUMENTO\s+AUXILIAR\s+DA\s+NOTA\s+FISCAL/i.test(t)
  || (/NFS-?e|NOTA\s+FISCAL\s+(?:ELETR[ÔO]NICA\s+)?DE\s+SERVI[ÇC]OS?/i.test(t) && /PRESTADOR/i.test(t) && /TOMADOR/i.test(t));
export const ehPonto = (t) => /Cart[aã]o\s+de\s+Ponto/i.test(t);

// texto de um arquivo não-PDF (UTF-8, ou Windows-1252 se tiver caractere inválido)
export function textoDe(buf) {
  let t = buf.toString("utf8");
  if (t.includes("�")) t = buf.toString("latin1");
  return t;
}

// identifica um arquivo. pdf: { ok, precisaSenha, texto } já aberto (só para PDF); dica: rótulo do documento da análise mensal
export function identificar(nome, buf, pdf = null, dica = null) {
  const e = ext(nome);
  const r = (destino, extra = {}) => ({ nome, destino, ...extra });
  if (e === "pdf") {
    if (!pdf) return r("DESCONHECIDO", { motivo: "PDF não lido" });
    if (!pdf.ok && pdf.precisaSenha) return r("DOCUMENTO", { detalhe: "PDF com senha — digite a senha na próxima tela" });
    if (!pdf.ok) return r("DESCONHECIDO", { motivo: pdf.erro || "PDF inválido" });
    const t = pdf.texto || "";
    if (ehPonto(t)) return r("PONTO");
    if (ehAntecipacao(t.replace(/\s+/g, " "))) return r("ANTECIPACAO");
    if (ehDanfe(t)) return r("NF", { detalhe: /DANFE|DOCUMENTO\s+AUXILIAR/i.test(t) ? "DANFE" : "NFS-e" });
    return r("DOCUMENTO", { detalhe: dica || null });
  }
  if (e === "zip") return r("DESCONHECIDO", { motivo: "ZIP dentro de ZIP — extraia antes" });
  const txt = textoDe(buf);
  if (e === "xml") return ehNfXml(txt) ? r("NF", { detalhe: "XML" }) : r("DESCONHECIDO", { motivo: "XML que não é nota fiscal" });
  if (e === "ofx") {
    const o = lerOfx(txt);
    return r("OFX", { detalhe: [o.banco || `banco ${o.bankId || "?"}`, o.competencia].filter(Boolean).join(" · "), competencia: o.competencia, codigoTipo: o.codigoTipo });
  }
  if (["ret", "txt", "cnab", "rem"].includes(e) || /^cb\d+/i.test(nome)) {
    if (ehRetornoCnab(txt)) return r("RETORNO");
    const sp = lerSped(txt);
    if (sp) return r("SPED", { competencia: sp.competencia, detalhe: sp.competencia });
    try { const h = lerHistorico(txt); if (h?.itens?.length) return r("HISTORICO", { detalhe: `${h.itens.length} lançamento(s)` }); } catch { /* segue */ }
    return r("DESCONHECIDO", { motivo: "Texto em formato não cadastrado" });
  }
  if (["xls", "xlsx"].includes(e)) return r("POSICAO");
  return r("DESCONHECIDO", { motivo: `Formato .${e} não cadastrado` });
}
