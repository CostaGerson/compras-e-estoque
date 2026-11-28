// v1189 — NF-e 4.00: monta o XML (infNFe), calcula os impostos por regime e assina (XMLDSig RSA-SHA1, C14N).
//   O XML é gerado já na forma canônica (sem espaços, sem tags vazias, atributos em ordem), então a C14N do
//   infNFe é a própria string com o xmlns herdado do <NFe> — dispensa biblioteca de XML.
//   Regras de imposto copiadas das notas autorizadas em produção:
//   · MERIDIAN (CRT 3, KM): ICMS00 12% (regime especial e-PTA-RE 45.000047072-14), IPI NT CST 53 (cEnq 999),
//     PIS 0,65% / COFINS 3% (CST 01) e o grupo IBS/CBS de 2026 (IBS UF 0,10%, CBS 0,90%, base = valor − ICMS − PIS − COFINS).
//   · NORT (CRT 1, Bling): ICMSSN102 (CSOSN 102), PIS/COFINS Outr CST 49 zerados, sem IPI e sem IBS/CBS.
import crypto from "crypto";

export const NS = "http://www.portalfiscal.inf.br/nfe";
const DS = "http://www.w3.org/2000/09/xmldsig#";
export const HOMOLOG_NOME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

const r2 = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
const f2 = (x) => r2(x).toFixed(2);
const f4 = (x) => (Math.round(Number(x) * 10000) / 10000).toFixed(4);
const dig = (v) => String(v || "").replace(/\D/g, "");
// texto: sem acento, sem quebra, sem espaço duplo; escape C14N (& < >)
export const limpa = (v, max = 0) => {
  let s = String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (max && s.length > max) s = s.slice(0, max).trim();
  return s;
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const el = (t, v, max) => { if (v == null || v === "") return ""; const s = esc(limpa(v, max)); return s === "" ? "" : `<${t}>${s}</${t}>`; };
const raw = (t, v) => (v == null || v === "" ? "" : `<${t}>${v}</${t}>`);

export function dvChave(c43) {
  let soma = 0, p = 2;
  for (let i = c43.length - 1; i >= 0; i--) { soma += Number(c43[i]) * p; p = p === 9 ? 2 : p + 1; }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
export function dhBrasil(d = new Date()) {   // AAAA-MM-DDThh:mm:ss-03:00 (Brasília, sem horário de verão)
  const t = new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 19);
  return `${t}-03:00`;
}

// ── impostos de um item ──
export function impostosItem(crt, it, aliq = {}) {
  const vProd = r2(it.qtd * it.valorUnit), vDesc = r2(it.desconto || 0), base = r2(vProd - vDesc + (it.frete || 0) + (it.outros || 0));
  const orig = Number(it.origem) || 0;
  if (String(crt) === "1" || String(crt) === "2") {
    const csosn = it.csosn || "102";
    return { vProd, vDesc, base, vBC: 0, vICMS: 0, vPIS: 0, vCOFINS: 0, vIBS: 0, vCBS: 0, vIPI: 0, ibs: null,
      xml: `<ICMS><ICMSSN${csosn}><orig>${orig}</orig><CSOSN>${csosn}</CSOSN></ICMSSN${csosn}></ICMS>`
        + `<PIS><PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`
        + `<COFINS><COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>` };
  }
  const pICMS = it.pICMS ?? aliq.icms ?? 12, pPIS = aliq.pis ?? 0.65, pCOF = aliq.cofins ?? 3, pIBS = aliq.ibsUf ?? 0.1, pIBSm = aliq.ibsMun ?? 0, pCBS = aliq.cbs ?? 0.9;
  const vICMS = r2(base * pICMS / 100), vPIS = r2(base * pPIS / 100), vCOFINS = r2(base * pCOF / 100);
  const bIBS = r2(base - vICMS - vPIS - vCOFINS), vIBSUF = r2(bIBS * pIBS / 100), vIBSMun = r2(bIBS * pIBSm / 100), vCBS = r2(bIBS * pCBS / 100);
  const ipi = it.ipiCst && it.ipiCst !== "53"
    ? `<IPI><cEnq>999</cEnq><IPITrib><CST>${it.ipiCst}</CST><vBC>${f2(base)}</vBC><pIPI>0.00</pIPI><vIPI>0.00</vIPI></IPITrib></IPI>`
    : `<IPI><cEnq>999</cEnq><IPINT><CST>53</CST></IPINT></IPI>`;
  return { vProd, vDesc, base, vBC: base, vICMS, vPIS, vCOFINS, vIBSUF, vIBSMun, vIBS: r2(vIBSUF + vIBSMun), vCBS, bIBS, vIPI: 0,
    xml: `<ICMS><ICMS00><orig>${orig}</orig><CST>00</CST><modBC>3</modBC><vBC>${f2(base)}</vBC><pICMS>${f2(pICMS)}</pICMS><vICMS>${f2(vICMS)}</vICMS></ICMS00></ICMS>`
      + ipi
      + `<PIS><PISAliq><CST>01</CST><vBC>${f2(base)}</vBC><pPIS>${f2(pPIS)}</pPIS><vPIS>${f2(vPIS)}</vPIS></PISAliq></PIS>`
      + `<COFINS><COFINSAliq><CST>01</CST><vBC>${f2(base)}</vBC><pCOFINS>${f2(pCOF)}</pCOFINS><vCOFINS>${f2(vCOFINS)}</vCOFINS></COFINSAliq></COFINS>`
      + `<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>${f2(bIBS)}</vBC>`
      + `<gIBSUF><pIBSUF>${f2(pIBS)}</pIBSUF><vIBSUF>${f2(vIBSUF)}</vIBSUF></gIBSUF><gIBSMun><pIBSMun>${f2(pIBSm)}</pIBSMun><vIBSMun>${f2(vIBSMun)}</vIBSMun></gIBSMun>`
      + `<vIBS>${f2(vIBSUF + vIBSMun)}</vIBS><gCBS><pCBS>${f2(pCBS)}</pCBS><vCBS>${f2(vCBS)}</vCBS></gCBS></gIBSCBS></IBSCBS>` };
}

const ender = (tag, e, fone) => `<${tag}>${el("xLgr", e.logradouro, 60)}${el("nro", e.numero || "SN", 60)}${el("xCpl", e.complemento, 60)}${el("xBairro", e.bairro, 60)}`
  + `${raw("cMun", dig(e.codigoMunicipio))}${el("xMun", e.municipio, 60)}${raw("UF", e.uf)}${raw("CEP", dig(e.cep))}<cPais>1058</cPais><xPais>BRASIL</xPais>${raw("fone", fone ? dig(fone) : "")}</${tag}>`;

/**
 * n = { emit:{razaoSocial,fantasia,cnpj,ie,crt,logradouro,…,telefone,email}, ambiente:"HOMOLOGACAO"|"PRODUCAO", serie, numero, dhEmi?,
 *       natOp, finNFe=1, tpNF=1, indFinal, indPres=9, refNFe:[chave], dest:{cnpj|cpf,nome,ie,email,logradouro,…,uf,codigoMunicipio},
 *       itens:[{codigo,descricao,ncm,cfop,unidade,qtd,valorUnit,desconto,origem,pICMS,csosn,ipiCst,xPed,nItemPed}],
 *       modFrete=9, volumes:{qVol,esp,pesoL,pesoB}, pag:[{tPag,vPag,xPag,indPag}], dup:[{numero,venc,valor}], infCpl, aliq:{icms,…}, respTec:{cnpj,contato,email,fone} }
 */
export function montarNFe(n) {
  const e = n.emit, crt = String(e.crt || "3"), hom = n.ambiente !== "PRODUCAO";
  const cnpj = dig(e.cnpj), serie = Number(n.serie) || 1, numero = Number(n.numero);
  if (!/^\d{14}$/.test(cnpj)) throw new Error("CNPJ do emitente inválido.");
  if (!(numero > 0 && numero < 1e9)) throw new Error("Número da NF-e inválido.");
  const dhEmi = n.dhEmi || dhBrasil();
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  let cNF = n.cNF || String(crypto.randomInt(10000000, 99999999));
  if (Number(cNF) === numero) cNF = String((Number(cNF) + 1) % 1e8).padStart(8, "0");
  const c43 = `31${aamm}${cnpj}55${String(serie).padStart(3, "0")}${String(numero).padStart(9, "0")}1${cNF}`;
  const cDV = dvChave(c43), chave = c43 + cDV, id = `NFe${chave}`;
  const d = n.dest || {}, ufDest = d.uf || "MG";
  const idDest = ufDest === "EX" ? 3 : ufDest === "MG" ? 1 : 2;
  const docDest = dig(d.cnpj || d.cpf);
  const ieDest = d.ie && !/isento/i.test(d.ie) ? dig(d.ie) : "";
  const indIEDest = d.indIEDest || (ieDest ? 1 : (docDest.length === 14 && /isento/i.test(d.ie || "") ? 2 : 9));
  const indFinal = n.indFinal != null ? Number(n.indFinal) : (indIEDest === 9 ? 1 : 0);
  const indPres = Number(n.indPres ?? 9);
  if (!n.itens?.length) throw new Error("NF-e sem itens.");

  let det = "", T = { vBC: 0, vICMS: 0, vProd: 0, vDesc: 0, vPIS: 0, vCOFINS: 0, vIPI: 0, bIBS: 0, vIBSUF: 0, vIBSMun: 0, vCBS: 0 };
  n.itens.forEach((it, i) => {
    const im = impostosItem(crt, it, n.aliq);
    for (const k of Object.keys(T)) T[k] = r2(T[k] + (im[k] || 0));
    const cfop = String(it.cfop || "");
    if (!/^\d{4}$/.test(cfop)) throw new Error(`Item ${i + 1}: CFOP inválido.`);
    if (!/^\d{8}$/.test(dig(it.ncm))) throw new Error(`Item ${i + 1}: NCM inválido.`);
    det += `<det nItem="${i + 1}"><prod>${el("cProd", it.codigo || String(i + 1), 60)}<cEAN>SEM GTIN</cEAN>${el("xProd", it.descricao, 120)}${raw("NCM", dig(it.ncm))}`
      + `${raw("CFOP", cfop)}${el("uCom", it.unidade || "UN", 6)}<qCom>${f4(it.qtd)}</qCom><vUnCom>${f4(it.valorUnit)}</vUnCom><vProd>${f2(im.vProd)}</vProd>`
      + `<cEANTrib>SEM GTIN</cEANTrib>${el("uTrib", it.unidade || "UN", 6)}<qTrib>${f4(it.qtd)}</qTrib><vUnTrib>${f4(it.valorUnit)}</vUnTrib>`
      + `${im.vDesc ? `<vDesc>${f2(im.vDesc)}</vDesc>` : ""}<indTot>1</indTot>${el("xPed", it.xPed, 15)}${raw("nItemPed", it.nItemPed)}</prod>`
      + `<imposto>${im.xml}</imposto></det>`;
  });
  const vNF = r2(T.vProd - T.vDesc);
  const ide = `<ide><cUF>31</cUF><cNF>${cNF}</cNF>${el("natOp", n.natOp, 60)}<mod>55</mod><serie>${serie}</serie><nNF>${numero}</nNF>`
    + `<dhEmi>${dhEmi}</dhEmi><dhSaiEnt>${dhEmi}</dhSaiEnt><tpNF>${n.tpNF ?? 1}</tpNF><idDest>${idDest}</idDest><cMunFG>${dig(e.codigoMunicipio) || "3106200"}</cMunFG>`
    + `<tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${cDV}</cDV><tpAmb>${hom ? 2 : 1}</tpAmb><finNFe>${n.finNFe || 1}</finNFe><indFinal>${indFinal}</indFinal>`
    + `<indPres>${indPres}</indPres>${[2, 3, 4, 9].includes(indPres) ? `<indIntermed>${n.indIntermed || 0}</indIntermed>` : ""}<procEmi>0</procEmi><verProc>ERP Meridian 1.0</verProc>`
    + (n.refNFe || []).map((k) => `<NFref><refNFe>${dig(k)}</refNFe></NFref>`).join("") + `</ide>`;
  const emit = `<emit><CNPJ>${cnpj}</CNPJ>${el("xNome", e.razaoSocial, 60)}${el("xFant", e.fantasia, 60)}${ender("enderEmit", e, e.telefone)}`
    + `${raw("IE", dig(e.ie))}<CRT>${crt}</CRT></emit>`;
  const dest = docDest ? `<dest>${docDest.length === 14 ? `<CNPJ>${docDest}</CNPJ>` : `<CPF>${docDest}</CPF>`}${el("xNome", hom ? HOMOLOG_NOME : d.nome, 60)}`
    + `${d.logradouro ? ender("enderDest", { ...d, uf: ufDest }, d.telefone) : ""}<indIEDest>${indIEDest}</indIEDest>${indIEDest === 1 ? raw("IE", ieDest) : ""}${el("email", d.email, 60)}</dest>` : "";
  const tot = `<total><ICMSTot><vBC>${f2(T.vBC)}</vBC><vICMS>${f2(T.vICMS)}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST>`
    + `<vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${f2(T.vProd)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${f2(T.vDesc)}</vDesc><vII>0.00</vII>`
    + `<vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>${f2(T.vPIS)}</vPIS><vCOFINS>${f2(T.vCOFINS)}</vCOFINS><vOutro>0.00</vOutro><vNF>${f2(vNF)}</vNF></ICMSTot>`
    + (crt === "3" ? `<IBSCBSTot><vBCIBSCBS>${f2(T.bIBS)}</vBCIBSCBS><gIBS><gIBSUF><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>${f2(T.vIBSUF)}</vIBSUF></gIBSUF>`
      + `<gIBSMun><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>${f2(T.vIBSMun)}</vIBSMun></gIBSMun><vIBS>${f2(T.vIBSUF + T.vIBSMun)}</vIBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gIBS>`
      + `<gCBS><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vCBS>${f2(T.vCBS)}</vCBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gCBS></IBSCBSTot>` : "")
    + `</total>`;
  const v = n.volumes;
  const transp = `<transp><modFrete>${n.modFrete ?? 9}</modFrete>${v && v.qVol ? `<vol><qVol>${Number(v.qVol)}</qVol>${el("esp", v.esp, 60)}<pesoL>${(Number(v.pesoL) || 0).toFixed(3)}</pesoL><pesoB>${(Number(v.pesoB) || 0).toFixed(3)}</pesoB></vol>` : ""}</transp>`;
  const cobr = n.dup?.length ? `<cobr><fat><nFat>${numero}</nFat><vOrig>${f2(vNF)}</vOrig><vDesc>0.00</vDesc><vLiq>${f2(vNF)}</vLiq></fat>`
    + n.dup.map((x, i) => `<dup><nDup>${String(i + 1).padStart(3, "0")}</nDup><dVenc>${x.venc}</dVenc><vDup>${f2(x.valor)}</vDup></dup>`).join("") + `</cobr>` : "";
  const pags = n.pag?.length ? n.pag : [{ tPag: "90", vPag: 0 }];
  const pag = `<pag>${pags.map((p) => `<detPag>${p.indPag != null ? `<indPag>${p.indPag}</indPag>` : ""}<tPag>${p.tPag}</tPag>${p.tPag === "99" ? el("xPag", p.xPag || "OUTROS", 60) : ""}<vPag>${f2(p.tPag === "90" ? 0 : p.vPag)}</vPag></detPag>`).join("")}</pag>`;
  const infAdic = n.infCpl ? `<infAdic>${el("infCpl", n.infCpl, 5000)}</infAdic>` : "";
  const rt = n.respTec || {};
  const respTec = `<infRespTec><CNPJ>${dig(rt.cnpj || cnpj)}</CNPJ>${el("xContato", rt.contato || e.razaoSocial, 60)}${el("email", rt.email || e.email || "contato@nortsports.com.br", 60)}${raw("fone", dig(rt.fone || e.telefone || "3136564398"))}</infRespTec>`;
  const infNFe = `<infNFe Id="${id}" versao="4.00">${ide}${emit}${dest}${det}${tot}${transp}${cobr}${pag}${infAdic}${respTec}</infNFe>`;
  return { chave, id, cNF, dhEmi, serie, numero, infNFe, totais: { ...T, vNF } };
}

// ── assinatura (enveloped, C14N inclusiva, RSA-SHA1 + SHA-1 — padrão da NF-e 4.00) ──
export function assinar(infNFe, id, { keyPem, certPem }) {
  const canon = infNFe.replace(/^<infNFe /, `<infNFe xmlns="${NS}" `);
  const digest = crypto.createHash("sha1").update(canon, "utf8").digest("base64");
  const si = `<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>`
    + `<SignatureMethod Algorithm="${DS}rsa-sha1"></SignatureMethod><Reference URI="#${id}"><Transforms>`
    + `<Transform Algorithm="${DS}enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms>`
    + `<DigestMethod Algorithm="${DS}sha1"></DigestMethod><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
  const siCanon = si.replace(/^<SignedInfo>/, `<SignedInfo xmlns="${DS}">`);
  const valor = crypto.createSign("RSA-SHA1").update(siCanon, "utf8").sign(keyPem, "base64");
  const x509 = String(certPem).replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return `<NFe xmlns="${NS}">${infNFe}<Signature xmlns="${DS}">${si}<SignatureValue>${valor}</SignatureValue><KeyInfo><X509Data><X509Certificate>${x509}</X509Certificate></X509Data></KeyInfo></Signature></NFe>`;
}
