// v1190 — DANFE (retrato, A4) em HTML a partir do XML da NF-e (nfeProc ou NFe assinada).
//   Abre numa janela e imprime/salva em PDF pelo navegador. Código de barras Code 128-C da chave (44 dígitos).
import fs from "fs";
import path from "path";

const P = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"];
export function code128C(dig) {
  const cs = []; for (let i = 0; i < dig.length; i += 2) cs.push(Number(dig.slice(i, i + 2)));
  let soma = 105; cs.forEach((c, i) => { soma += c * (i + 1); });
  return [105, ...cs, soma % 103, 106].map((c) => P[c]).join("");
}
function barras(dig) {
  const w = code128C(dig); let x = 0; const rs = [];
  [...w].forEach((d, i) => { const l = Number(d); if (i % 2 === 0) rs.push(`<rect x="${x}" y="0" width="${l}" height="40"/>`); x += l; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 40" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000" style="display:block;width:100%;height:100%">${rs.join("")}</svg>`;
}

// ── leitura do XML ──
const un = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const blk = (x, t) => (String(x || "").match(new RegExp(`<${t}[\\s>][\\s\\S]*?</${t}>`)) || [])[0] || "";
const blks = (x, t) => String(x || "").match(new RegExp(`<${t}[\\s>][\\s\\S]*?</${t}>`, "g")) || [];
const v = (x, t) => un((String(x || "").match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1] || "");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n2 = (s, d = 2) => (s === "" || s == null ? "" : Number(s).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const nq = (s) => Number(s || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const dBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");
const hBR = (s) => (s ? s.slice(11, 19) : "");
const cnpjF = (s) => (s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : s.length === 11 ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : s);
const cepF = (s) => (s && s.length === 8 ? `${s.slice(0, 5)}-${s.slice(5)}` : s || "");
const foneF = (s) => (!s ? "" : s.length === 10 ? `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}` : s.length === 11 ? `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}` : s);
const chaveF = (c) => c.replace(/(\d{4})(?=\d)/g, "$1 ");
const MODFRETE = { 0: "0 - Por conta do Remetente", 1: "1 - Por conta do Destinatário", 2: "2 - Por conta de Terceiros", 3: "3 - Próprio por conta do Remetente", 4: "4 - Próprio por conta do Destinatário", 9: "9 - Sem Ocorrência de Transporte" };

function logo(cnpj) {
  if (cnpj !== "48011287000181") return "";
  try { const s = fs.readFileSync(path.join(process.cwd(), "public", "meridian-logo.svg")); return `<img src="data:image/svg+xml;base64,${s.toString("base64")}" style="max-height:62px;max-width:100%;filter:brightness(0)">`; } catch { return ""; }
}

const cx = (rot, val, est = "") => `<td class="c" style="${est}"><div class="r">${rot}</div><div class="v">${val || "&nbsp;"}</div></td>`;

export function htmlDanfe(xml, { autoPrint = true } = {}) {
  const inf = blk(xml, "infNFe"), ide = blk(inf, "ide"), emit = blk(inf, "emit"), ee = blk(emit, "enderEmit"), dest = blk(inf, "dest"), ed = blk(dest, "enderDest");
  const tot = blk(inf, "ICMSTot"), transp = blk(inf, "transp"), transporta = blk(transp, "transporta"), vol = blk(transp, "vol"), cobr = blk(inf, "cobr"), prot = blk(xml, "infProt");
  const chave = (inf.match(/Id="NFe(\d{44})"/) || [])[1] || "";
  const hom = v(ide, "tpAmb") === "2", autorizada = v(prot, "cStat") === "100" || v(prot, "cStat") === "150";
  const docE = v(emit, "CNPJ") || v(emit, "CPF"), docD = v(dest, "CNPJ") || v(dest, "CPF");
  const nNF = v(ide, "nNF").padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3"), serie = v(ide, "serie").padStart(3, "0");
  const dups = blks(cobr, "dup").map((d) => `<div class="dup"><span>${esc(v(d, "nDup"))}</span><span>${dBR(v(d, "dVenc"))}</span><b>${n2(v(d, "vDup"))}</b></div>`).join("");
  const itens = blks(inf, "det").map((d) => {
    const p = blk(d, "prod"), icms = blk(d, "ICMS"), ipi = blk(d, "IPI");
    const cst = v(icms, "orig") + (v(icms, "CST") || v(icms, "CSOSN"));
    return `<tr><td>${esc(v(p, "cProd"))}</td><td class="l">${esc(v(p, "xProd"))}${v(blk(d, "infAdProd"), "infAdProd") ? `<br><i>${esc(v(d, "infAdProd"))}</i>` : ""}</td><td>${v(p, "NCM")}</td><td>${cst}</td><td>${v(p, "CFOP")}</td><td>${esc(v(p, "uCom"))}</td>`
      + `<td class="n">${nq(v(p, "qCom"))}</td><td class="n">${n2(v(p, "vUnCom"), 2)}</td><td class="n">${n2(v(p, "vDesc") || 0)}</td><td class="n">${n2(v(p, "vProd"))}</td>`
      + `<td class="n">${n2(v(icms, "vBC") || 0)}</td><td class="n">${n2(v(icms, "vICMS") || 0)}</td><td class="n">${n2(v(ipi, "vIPI") || 0)}</td><td class="n">${n2(v(icms, "pICMS") || 0)}</td><td class="n">${n2(v(ipi, "pIPI") || 0)}</td></tr>`;
  }).join("");
  const infCpl = v(blk(inf, "infAdic"), "infCpl"), infFisco = v(blk(inf, "infAdic"), "infAdFisco");
  const ibs = blk(inf, "IBSCBSTot");
  const adic = [infFisco, infCpl, ibs ? `IBS: R$ ${n2(v(ibs, "vIBS"))} · CBS: R$ ${n2(v(ibs, "vCBS"))} (base R$ ${n2(v(ibs, "vBCIBSCBS"))})` : ""].filter(Boolean).map(esc).join("<br>");
  const endE = `${esc(v(ee, "xLgr"))}, ${esc(v(ee, "nro"))}${v(ee, "xCpl") ? ` - ${esc(v(ee, "xCpl"))}` : ""}<br>${esc(v(ee, "xBairro"))} - ${cepF(v(ee, "CEP"))}<br>${esc(v(ee, "xMun"))} - ${v(ee, "UF")}${v(ee, "fone") ? ` · Fone: ${foneF(v(ee, "fone"))}` : ""}`;
  const protTxt = autorizada ? `${v(prot, "nProt")} - ${dBR(v(prot, "dhRecbto"))} ${hBR(v(prot, "dhRecbto"))}` : "NF-e NÃO AUTORIZADA";
  const marca = hom ? "SEM VALOR FISCAL<br><small>Emitida em ambiente de homologação</small>" : !autorizada ? "SEM VALOR FISCAL<br><small>NF-e não autorizada</small>" : "";
  const css = `@page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:8px}
table{border-collapse:collapse;width:100%;table-layout:fixed}td.c{border:1px solid #000;padding:1px 3px;vertical-align:top;height:24px}
.r{font-size:6px;text-transform:uppercase;line-height:1.2}.v{font-size:9px;font-weight:bold;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t{font-size:7.5px;font-weight:bold;margin:5px 0 1px;text-transform:uppercase}.n{text-align:right}
.it th{border:1px solid #000;font-size:6px;padding:2px 1px;font-weight:normal;text-transform:uppercase}.it td{border-left:1px solid #000;border-right:1px solid #000;font-size:7.5px;padding:1px 2px;text-align:center;vertical-align:top}
.it td.l{text-align:left}.it td.n{text-align:right}.it tbody tr:last-child td{border-bottom:1px solid #000}.it thead{display:table-header-group}
.dup{display:inline-flex;gap:6px;border:1px solid #000;padding:2px 5px;margin:0 3px 3px 0;font-size:8px}
.marca{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:54px;font-weight:bold;color:rgba(200,0,0,.18);transform:rotate(-24deg);pointer-events:none;line-height:1.1}.marca small{font-size:20px}
.pg{display:flex;flex-direction:column;min-height:281mm}.prod{flex:1;display:flex;flex-direction:column}.prod table{flex:1}.it tr.fill td{height:auto}.it tbody tr{height:1px}.it tbody tr.fill{height:auto}
@media screen{body{background:#888}.pg{background:#fff;width:210mm;min-height:297mm;margin:10px auto;padding:7mm;box-shadow:0 2px 10px #0006}}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFE ${v(ide, "nNF")} - ${esc(v(emit, "xNome"))}</title><style>${css}</style></head><body><div class="pg">
${marca ? `<div class="marca">${marca}</div>` : ""}
<table><tr><td class="c" style="width:80%;height:30px"><div class="r">Recebemos de ${esc(v(emit, "xNome"))} os produtos e/ou serviços constantes da nota fiscal eletrônica indicada ao lado. Emissão: ${dBR(v(ide, "dhEmi"))} · Valor total: R$ ${n2(v(tot, "vNF"))} · Destinatário: ${esc(v(dest, "xNome"))}</div></td>
<td class="c" rowspan="2" style="text-align:center;vertical-align:middle"><b style="font-size:11px">NF-e</b><br><b>Nº ${nNF}</b><br><b>Série ${serie}</b></td></tr>
<tr><td class="c" style="padding:0"><table><tr><td class="c" style="width:28%;border:0;border-right:1px solid #000"><div class="r">Data de recebimento</div></td><td class="c" style="border:0"><div class="r">Identificação e assinatura do recebedor</div></td></tr></table></td></tr></table>
<div style="border-top:1px dashed #000;margin:4px 0"></div>
<table><tr>
<td class="c" style="width:38%;text-align:center;height:auto">${logo(docE)}<div style="font-size:11px;font-weight:bold;margin-top:2px">${esc(v(emit, "xNome"))}</div><div style="font-size:8px;line-height:1.3">${endE}</div></td>
<td class="c" style="width:16%;text-align:center;height:auto"><div style="font-size:14px;font-weight:bold">DANFE</div><div style="font-size:7px">Documento Auxiliar da Nota Fiscal Eletrônica</div>
<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin:4px 0;font-size:7.5px"><div style="text-align:left">0 - ENTRADA<br>1 - SAÍDA</div><div style="border:1px solid #000;padding:2px 6px;font-size:13px;font-weight:bold">${v(ide, "tpNF")}</div></div>
<div style="font-size:9px;font-weight:bold">Nº ${nNF}<br>SÉRIE ${serie}</div><div style="font-size:8px">FOLHA 1/1</div></td>
<td class="c" style="height:auto"><div style="height:42px;margin:2px 6px">${chave ? barras(chave) : ""}</div><div class="r" style="margin-top:3px">Chave de acesso</div><div class="v" style="font-size:9.5px;text-align:center">${chaveF(chave)}</div>
<div style="font-size:8px;text-align:center;margin-top:4px">Consulta de autenticidade no portal nacional da NF-e<br>www.nfe.fazenda.gov.br/portal ou no site da SEFAZ autorizadora</div></td></tr></table>
<table><tr>${cx("Natureza da operação", esc(v(ide, "natOp")), "width:62%")}${cx("Protocolo de autorização de uso", protTxt)}</tr></table>
<table><tr>${cx("Inscrição estadual", v(emit, "IE"))}${cx("Insc. estadual do subst. trib.", v(emit, "IEST"))}${cx("CNPJ", cnpjF(docE))}</tr></table>
<div class="t">Destinatário / remetente</div>
<table><tr>${cx("Nome / razão social", esc(v(dest, "xNome")), "width:58%")}${cx("CNPJ / CPF", cnpjF(docD))}${cx("Data da emissão", dBR(v(ide, "dhEmi")), "width:14%")}</tr>
<tr>${cx("Endereço", `${esc(v(ed, "xLgr"))}${v(ed, "nro") ? `, ${esc(v(ed, "nro"))}` : ""}${v(ed, "xCpl") ? ` - ${esc(v(ed, "xCpl"))}` : ""}`)}${cx("Bairro / distrito", esc(v(ed, "xBairro")))}${cx("Data da saída/entrada", dBR(v(ide, "dhSaiEnt")))}</tr>
<tr><td colspan="3" style="padding:0"><table><tr>${cx("Município", esc(v(ed, "xMun")), "width:34%")}${cx("UF", v(ed, "UF"), "width:6%")}${cx("CEP", cepF(v(ed, "CEP")), "width:12%")}${cx("Fone / fax", foneF(v(ed, "fone")), "width:16%")}${cx("Inscrição estadual", v(dest, "IE"))}${cx("Hora da saída", hBR(v(ide, "dhSaiEnt")), "width:12%")}</tr></table></td></tr></table>
${dups ? `<div class="t">Fatura / duplicatas</div><div>${dups}</div>` : ""}
<div class="t">Cálculo do imposto</div>
<table><tr>${cx("Base de cálc. do ICMS", n2(v(tot, "vBC")))}${cx("Valor do ICMS", n2(v(tot, "vICMS")))}${cx("Base cálc. ICMS ST", n2(v(tot, "vBCST")))}${cx("Valor do ICMS ST", n2(v(tot, "vST")))}${cx("V. imp. importação", n2(v(tot, "vII")))}${cx("Valor do PIS", n2(v(tot, "vPIS")))}${cx("Valor total dos produtos", n2(v(tot, "vProd")))}</tr>
<tr>${cx("Valor do frete", n2(v(tot, "vFrete")))}${cx("Valor do seguro", n2(v(tot, "vSeg")))}${cx("Desconto", n2(v(tot, "vDesc")))}${cx("Outras despesas", n2(v(tot, "vOutro")))}${cx("Valor total do IPI", n2(v(tot, "vIPI")))}${cx("Valor da COFINS", n2(v(tot, "vCOFINS")))}${cx("Valor total da nota", n2(v(tot, "vNF")))}</tr></table>
<div class="t">Transportador / volumes transportados</div>
<table><tr>${cx("Razão social", esc(v(transporta, "xNome")), "width:34%")}${cx("Frete por conta", MODFRETE[v(transp, "modFrete")] || v(transp, "modFrete"), "width:20%")}${cx("Código ANTT", "")}${cx("Placa do veículo", v(blk(transp, "veicTransp"), "placa"))}${cx("UF", v(blk(transp, "veicTransp"), "UF"), "width:5%")}${cx("CNPJ / CPF", cnpjF(v(transporta, "CNPJ") || v(transporta, "CPF")))}</tr>
<tr>${cx("Endereço", esc(v(transporta, "xEnder")), "width:34%")}${cx("Município", esc(v(transporta, "xMun")))}${cx("UF", v(transporta, "UF"), "width:5%")}${cx("Inscrição estadual", v(transporta, "IE"))}</tr>
<tr>${cx("Quantidade", v(vol, "qVol"))}${cx("Espécie", esc(v(vol, "esp")))}${cx("Marca", esc(v(vol, "marca")))}${cx("Numeração", esc(v(vol, "nVol")))}${cx("Peso bruto", v(vol, "pesoB") ? n2(v(vol, "pesoB"), 3) : "")}${cx("Peso líquido", v(vol, "pesoL") ? n2(v(vol, "pesoL"), 3) : "")}</tr></table>
<div class="prod"><div class="t">Dados dos produtos / serviços</div>
<table class="it"><colgroup><col style="width:9%"><col style="width:27%"><col style="width:6.5%"><col style="width:4%"><col style="width:4.5%"><col style="width:3.5%"><col style="width:6%"><col style="width:6.5%"><col style="width:5%"><col style="width:7%"><col style="width:6%"><col style="width:5.5%"><col style="width:4.5%"><col style="width:3%"><col style="width:3%"></colgroup>
<thead><tr><th>Código</th><th>Descrição do produto / serviço</th><th>NCM/SH</th><th>CST</th><th>CFOP</th><th>Un.</th><th>Quant.</th><th>Valor unit.</th><th>Desc.</th><th>Valor total</th><th>B. cálc. ICMS</th><th>Valor ICMS</th><th>Valor IPI</th><th>Alíq. ICMS</th><th>Alíq. IPI</th></tr></thead>
<tbody>${itens}<tr class="fill">${"<td></td>".repeat(15)}</tr></tbody></table></div>
<div class="t">Dados adicionais</div>
<table><tr><td class="c" style="width:65%;height:70px"><div class="r">Informações complementares</div><div style="font-size:8px;line-height:1.35">${adic || "&nbsp;"}</div></td><td class="c"><div class="r">Reservado ao fisco</div></td></tr></table>
<div style="font-size:6.5px;margin-top:2px">Impresso pelo ERP Meridian em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
</div>${autoPrint ? `<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>` : ""}</body></html>`;
}
