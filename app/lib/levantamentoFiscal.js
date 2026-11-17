// v936 — preparação da troca KM → Bling/API: levantamento do que o KM de fato emitiu (XMLs de SAÍDA no Movimento fiscal).
//   Natureza × CFOP × tributação, NCM por produto, série/numeração, regime (CRT), destinatários com cadastro incompleto,
//   DIFAL, IBS/CBS, informações complementares. Só leitura.
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { tokenDe, lerBase64 } from "@/lib/arquivos";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, trimValues: true });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const n = (v) => { const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const r2 = (v) => Math.round(v * 100) / 100;
const inc = (m, k, v = 1, val = 0, ex = null) => { const o = m.get(k) || { qtd: 0, valor: 0, ex: [] }; o.qtd += v; o.valor += val; if (ex && o.ex.length < 3 && !o.ex.includes(ex)) o.ex.push(ex); m.set(k, o); };
const lista = (m, campos) => [...m.entries()].map(([k, o]) => ({ ...Object.fromEntries(k.split("|").map((x, i) => [campos[i], x])), qtd: o.qtd, valor: r2(o.valor), exemplos: o.ex })).sort((a, b) => b.qtd - a.qtd);

async function textoXml(x) {
  if (!x) return null;
  if (tokenDe(x)) return Buffer.from(await lerBase64(x), "base64").toString("utf8");
  return String(x);
}
const grupo = (o) => { if (!o || typeof o !== "object") return {}; const k = Object.keys(o).find((x) => !x.startsWith("@_")); return k ? { nome: k, ...o[k] } : {}; };

export async function levantamentoFiscal({ meses = 12, empresa = "MERIDIAN" } = {}) {
  const desde = new Date(); desde.setMonth(desde.getMonth() - meses);
  const notas = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", empresa, temXml: true, emissao: { gte: desde } }, select: { id: true, numero: true, serie: true, emissao: true, xml: true, parceiro: true, documento: true }, orderBy: { emissao: "asc" } });
  const ops = new Map(), ncm = new Map(), series = new Map(), crt = new Map(), indIE = new Map(), ufs = new Map(), pag = new Map(), frete = new Map(), finalidade = new Map(), consFinal = new Map(), modelos = new Map();
  const infCpl = new Map(), cadastro = new Map();
  let lidas = 0, erros = 0, comIbsCbs = 0, comDifal = 0, valorDifal = 0, de = null, ate = null, comCest = 0, totalItens = 0;
  for (const nf of notas) {
    let x; try { x = parser.parse((await textoXml(nf.xml)) || ""); } catch { erros++; continue; }
    const inf = x?.nfeProc?.NFe?.infNFe || x?.NFe?.infNFe;
    if (!inf) { erros++; continue; }
    lidas++;
    const ide = inf.ide || {}, emit = inf.emit || {}, dest = inf.dest || {}, ender = dest.enderDest || {};
    const d = String(ide.dhEmi || ide.dEmi || "").slice(0, 10);
    if (d) { if (!de || d < de) de = d; if (!ate || d > ate) ate = d; }
    const s = String(ide.serie ?? ""), num = Number(ide.nNF) || 0;
    const so = series.get(s) || { qtd: 0, primeiro: num, ultimo: num, ultimaData: d };
    so.qtd++; if (num < so.primeiro) so.primeiro = num; if (num > so.ultimo) { so.ultimo = num; so.ultimaData = d; } series.set(s, so);
    inc(crt, String(emit.CRT ?? "?")); inc(modelos, String(ide.mod ?? "?"));
    inc(finalidade, String(ide.finNFe ?? "?")); inc(consFinal, `${ide.indFinal ?? "?"}|${ide.idDest ?? "?"}|${ide.indPres ?? "?"}`);
    inc(indIE, String(dest.indIEDest ?? "?"), 1, 0, String(dest.xNome || "").slice(0, 40));
    inc(ufs, String(ender.UF ?? "?"));
    for (const p of arr(inf.pag?.detPag)) inc(pag, String(p.tPag ?? "?"));
    inc(frete, String(inf.transp?.modFrete ?? "?"));
    const tot = inf.total?.ICMSTot || {};
    if (n(tot.vICMSUFDest) > 0 || n(tot.vFCPUFDest) > 0) { comDifal++; valorDifal += n(tot.vICMSUFDest) + n(tot.vFCPUFDest); }
    if (inf.total?.IBSCBSTot || JSON.stringify(inf.det || "").includes("IBSCBS")) comIbsCbs++;
    const cpl = String(inf.infAdic?.infCpl || "").replace(/\d{2}\/\d{2}\/\d{4}|\d+[.,]\d{2}|\b\d{5,}\b/g, "#").slice(0, 220);
    if (cpl) inc(infCpl, cpl);
    // destinatário com cadastro incompleto
    const falta = [];
    if (!dest.CNPJ && !dest.CPF) falta.push("CNPJ/CPF");
    if (String(dest.indIEDest) === "1" && !dest.IE) falta.push("IE");
    if (!ender.cMun) falta.push("cód. IBGE");
    if (!ender.CEP) falta.push("CEP");
    if (!dest.email) falta.push("e-mail");
    if (falta.length) { const k = String(dest.CNPJ || dest.CPF || dest.xNome); const o = cadastro.get(k) || { cliente: dest.xNome, documento: dest.CNPJ || dest.CPF || "", falta: new Set(), nfs: 0 }; falta.forEach((f) => o.falta.add(f)); o.nfs++; cadastro.set(k, o); }
    for (const det of arr(inf.det)) {
      totalItens++;
      const pr = det.prod || {}, imp = det.imposto || {};
      const icms = grupo(imp.ICMS), ipi = imp.IPI || {}, ipiG = grupo({ a: ipi.IPITrib || ipi.IPINT }), pis = grupo(imp.PIS), cof = grupo(imp.COFINS);
      const icmsCod = icms.CST != null ? `CST ${icms.CST}` : icms.CSOSN != null ? `CSOSN ${icms.CSOSN}` : "?";
      const vItem = n(pr.vProd) - n(pr.vDesc);
      const k = [ide.natOp, pr.CFOP, icmsCod, icms.orig ?? "", icms.pICMS ?? "", icms.pRedBC ?? "", icms.pICMSST ? `ST ${icms.pICMSST}` : "", ipiG.CST ?? "", ipi.cEnq ?? "", pis.CST ?? "", pis.pPIS ?? "", cof.CST ?? "", cof.pCOFINS ?? ""].map((v) => String(v ?? "")).join("|");
      inc(ops, k, 1, vItem, String(pr.xProd || "").slice(0, 50));
      inc(ncm, `${pr.NCM || "?"}|${pr.uCom || ""}`, 1, vItem, String(pr.xProd || "").slice(0, 50));
      if (pr.CEST) comCest++;
    }
  }
  return {
    empresa, periodo: { de, ate, meses }, notas: notas.length, lidas, erros, itens: totalItens,
    series: [...series.entries()].map(([serie, o]) => ({ serie, ...o })),
    crt: lista(crt, ["crt"]), modelos: lista(modelos, ["modelo"]), finalidade: lista(finalidade, ["finNFe"]),
    destino: lista(consFinal, ["indFinal", "idDest", "indPres"]), indIEDest: lista(indIE, ["indIEDest"]), ufs: lista(ufs, ["uf"]),
    pagamento: lista(pag, ["tPag"]), frete: lista(frete, ["modFrete"]),
    operacoes: lista(ops, ["natOp", "cfop", "icms", "origem", "pICMS", "pRedBC", "st", "ipiCst", "ipiEnq", "pisCst", "pPIS", "cofinsCst", "pCOFINS"]),
    ncm: lista(ncm, ["ncm", "unidade"]), comCest, difal: { notas: comDifal, valor: r2(valorDifal) }, ibsCbs: comIbsCbs,
    infCpl: lista(infCpl, ["texto"]).slice(0, 8),
    cadastroIncompleto: [...cadastro.values()].map((o) => ({ ...o, falta: [...o.falta].join(", ") })).sort((a, b) => b.nfs - a.nfs),
  };
}
