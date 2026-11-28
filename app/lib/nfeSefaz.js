// v1188 — comunicação com a SEFAZ-MG (NF-e 4.00) com TLS mútuo pelo certificado A1 da empresa.
//   Etapa 1: consulta de status do serviço (NfeStatusServico4) — prova certificado, rede da VPS e resposta da SEFAZ.
//   As próximas (autorização, retorno, cancelamento, CC-e, inutilização) usam o mesmo `soap()`.
import https from "https";
import { certificado } from "@/lib/nfeCert";

const UF_MG = "31";
// webservices da SEFAZ-MG (autorizador próprio)
const ws = (h) => ({ status: `https://${h}/nfe2/services/NFeStatusServico4`, autorizacao: `https://${h}/nfe2/services/NFeAutorizacao4`,
  retAutorizacao: `https://${h}/nfe2/services/NFeRetAutorizacao4`, consulta: `https://${h}/nfe2/services/NFeConsultaProtocolo4`, evento: `https://${h}/nfe2/services/NFeRecepcaoEvento4` });
export const WS_MG = { HOMOLOGACAO: ws("hnfe.fazenda.mg.gov.br"), PRODUCAO: ws("nfe.fazenda.mg.gov.br") };
const tag = (xml, t) => (String(xml).match(new RegExp(`<(?:\\w+:)?${t}>([^<]*)</(?:\\w+:)?${t}>`)) || [])[1] || null;

export async function soap(url, servico, corpo, { key, cert, ca }) {
  const env = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">${corpo}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname, method: "POST", key, cert, ca,
      // a cadeia da SEFAZ é ICP-Brasil, fora da lista de CAs do Node: a autenticação que importa aqui é a NOSSA (TLS mútuo)
      rejectUnauthorized: false, minVersion: "TLSv1.2", timeout: 30000,
      headers: { "Content-Type": "application/soap+xml; charset=utf-8", "Content-Length": Buffer.byteLength(env) },
    }, (res) => { let d = ""; res.setEncoding("utf8"); res.on("data", (c) => (d += c)); res.on("end", () => resolve({ http: res.statusCode, xml: d })); });
    req.on("timeout", () => req.destroy(new Error("a SEFAZ não respondeu em 30 s")));
    req.on("error", reject);
    req.end(env);
  });
}

export async function statusServico(emp, ambiente = "HOMOLOGACAO") {
  const amb = ambiente === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO";
  const c = await certificado(emp);
  const corpo = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${amb === "PRODUCAO" ? 1 : 2}</tpAmb><cUF>${UF_MG}</cUF><xServ>STATUS</xServ></consStatServ>`;
  const t0 = Date.now();
  let r;
  try { r = await soap(WS_MG[amb].status, "NFeStatusServico4", corpo, { key: c.keyPem, cert: c.certPem, ca: c.cadeia }); }
  catch (e) { return { ok: false, empresa: emp, ambiente: amb, erro: `Sem comunicação com a SEFAZ-MG: ${e.message}` }; }
  const cStat = tag(r.xml, "cStat"), xMotivo = tag(r.xml, "xMotivo");
  return {
    ok: cStat === "107", empresa: emp, ambiente: amb, http: r.http, cStat, xMotivo, tMed: tag(r.xml, "tMed"), dhRecbto: tag(r.xml, "dhRecbto"), ms: Date.now() - t0,
    ...(cStat ? {} : { erro: `Resposta inesperada da SEFAZ (HTTP ${r.http}).`, resposta: String(r.xml).slice(0, 800) }),
  };
}

// v1189 — autorização síncrona (indSinc=1). Se a SEFAZ devolver 103 (lote recebido), consulta o recibo até 5 vezes.
const bloco = (xml, t) => (String(xml).match(new RegExp(`<(?:\\w+:)?${t}[\\s>][\\s\\S]*?</(?:\\w+:)?${t}>`)) || [])[0] || null;
export async function autorizar(emp, ambiente, nfeAssinada) {
  const amb = ambiente === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO";
  const c = await certificado(emp);
  const tls = { key: c.keyPem, cert: c.certPem, ca: c.cadeia };
  const lote = String(Date.now()).slice(-15);
  const corpo = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${lote}</idLote><indSinc>1</indSinc>${nfeAssinada}</enviNFe>`;
  let r;
  try { r = await soap(WS_MG[amb].autorizacao, "NFeAutorizacao4", corpo, tls); }
  catch (e) { return { ok: false, pendente: true, erro: `Sem comunicação com a SEFAZ-MG: ${e.message}` }; }
  let cStat = tag(r.xml, "cStat"), xMotivo = tag(r.xml, "xMotivo"), prot = bloco(r.xml, "protNFe");
  if (!prot && cStat === "103") {
    const nRec = tag(r.xml, "nRec");
    for (let i = 0; i < 5 && !prot; i++) {
      await new Promise((ok) => setTimeout(ok, 2000 + i * 1500));
      const q = await soap(WS_MG[amb].retAutorizacao, "NFeRetAutorizacao4",
        `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${amb === "PRODUCAO" ? 1 : 2}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`, tls).catch(() => null);
      if (q) { prot = bloco(q.xml, "protNFe"); if (!prot && tag(q.xml, "cStat") !== "105") { cStat = tag(q.xml, "cStat"); xMotivo = tag(q.xml, "xMotivo"); break; } }
    }
    if (!prot && cStat === "103") return { ok: false, pendente: true, cStat, xMotivo: `Lote em processamento (recibo ${nRec}). Consulte de novo em instantes.`, nRec };
  }
  if (!prot) return { ok: false, cStat, xMotivo: xMotivo || `Resposta inesperada da SEFAZ (HTTP ${r.http}).`, resposta: cStat ? undefined : String(r.xml).slice(0, 800) };
  const pc = tag(prot, "cStat"), pm = tag(prot, "xMotivo");
  const protNFe = prot.replace(/<(\/?)\w+:/g, "<$1");   // tira prefixo de namespace, se vier
  return { ok: pc === "100" || pc === "150", denegada: ["110", "301", "302", "303"].includes(pc), cStat: pc, xMotivo: pm, protocolo: tag(prot, "nProt"), dhRecbto: tag(prot, "dhRecbto"),
    nfeProc: `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfeAssinada}${protNFe.includes("xmlns=") ? protNFe : protNFe.replace(/^<protNFe/, '<protNFe xmlns="http://www.portalfiscal.inf.br/nfe"')}</nfeProc>` };
}
