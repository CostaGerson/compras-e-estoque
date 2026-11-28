// v1194 — boleto Bradesco em HTML (recibo do pagador + ficha de compensação), no mesmo conteúdo do boleto do KM:
//   juros de 0,03% ao dia e multa de 1% a partir do dia seguinte ao vencimento; código de barras ITF (2 de 5 intercalado).
import fs from "fs";
import path from "path";
import { CONTA_PADRAO, codigoBarras, linhaDigitavel, dvNossoNumero } from "@/lib/cnabBradesco";

const ITF = ["00110", "10001", "01001", "11000", "00101", "10100", "01100", "00011", "10010", "01010"];
function barrasItf(cod) {
  const seq = ["0000"]; // início: fino barra/espaço ×2
  for (let i = 0; i < cod.length; i += 2) {
    const a = ITF[cod[i]], b = ITF[cod[i + 1]];
    let s = ""; for (let k = 0; k < 5; k++) s += a[k] + b[k];
    seq.push(s);
  }
  seq.push("100");
  const p = seq.join(""), F = 1, L = 3; let x = 0; const rs = [];
  [...p].forEach((c, i) => { const w = c === "1" ? L : F; if (i % 2 === 0) rs.push(`<rect x="${x}" y="0" width="${w}" height="50"/>`); x += w; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 50" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:103mm;height:13mm;display:block">${rs.join("")}</svg>`;
}
// v1195 — logo do Bradesco: a mesma imagem do boleto do KM (public/bradesco-boleto.jpg)
let LOGO = null;
const logoBradesco = () => { if (LOGO === null) { try { LOGO = "data:image/jpeg;base64," + fs.readFileSync(path.join(process.cwd(), "public", "bradesco-boleto.jpg")).toString("base64"); } catch { LOGO = ""; } } return LOGO; };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const mais1 = (s) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const cnpjF = (s) => { const d = String(s || "").replace(/\D/g, ""); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d; };

/** b = { nossoNumero, documento, vencimento, valor, emissao, pagador:{doc,nome,logradouro,numero,bairro,cep,municipio,uf}, beneficiario:{endereco} } */
export function htmlBoletos(boletos, { conta = CONTA_PADRAO, beneficiarioEndereco = "", autoPrint = true } = {}) {
  const c = { ...CONTA_PADRAO, ...conta };
  const ag = `${c.agencia}-${c.agenciaDv}/${c.conta}-${c.contaDv}`;
  const um = (b) => {
    const barras = codigoBarras(b, c), linha = linhaDigitavel(barras);
    const nn = `${c.carteira}/${String(b.nossoNumero).padStart(11, "0")}-${dvNossoNumero(c.carteira, b.nossoNumero)}`;
    const p = b.pagador || {};
    const juros = Math.round(Number(b.valor) * (c.jurosDiaPct / 100) * 100) / 100;
    const instr = `Cobrar juros de R$ ${brl(juros)} por dia de atraso para pagamento a partir de ${dBR(mais1(b.vencimento))}.<br>Cobrar multa de ${brl(c.multaPct)}% para pagamento a partir de ${dBR(mais1(b.vencimento))}.`;
    const endP = `${esc(p.logradouro)}${p.numero ? `, ${esc(p.numero)}` : ""} - ${esc(p.bairro || "")} - ${esc(p.cep || "")} - ${esc(p.municipio || "")} / ${esc(p.uf || "")}`;
    const cel = (r, v, est = "") => `<td style="${est}"><div class="r">${r}</div><div class="v">${v || "&nbsp;"}</div></td>`;
    const cab = (titulo) => `<div class="cab"><span class="bco">${logoBradesco() ? `<img src="${logoBradesco()}" style="height:30px;display:block">` : "<b>Bradesco</b>"}</span><b class="cod">237-2</b><span class="ld">${titulo}</span></div>`;
    return `<div class="bol">
${cab('<span style="float:right;font-size:12px">Recibo do Pagador</span>')}
<table><tr>${cel("Beneficiário", esc(c.razao), "width:45%")}${cel("CNPJ/CPF", cnpjF(c.cnpj))}${cel("Vencimento", `<b>${dBR(b.vencimento)}</b>`, "width:20%;text-align:right")}</tr>
<tr>${cel("Endereço beneficiário", esc(beneficiarioEndereco), "")}<td colspan="2"></td></tr>
<tr>${cel("Nosso número", nn)}${cel("Número do documento", esc(b.documento))}${cel("Agência / código do beneficiário", ag, "text-align:right")}</tr>
<tr>${cel("Data do documento", dBR(b.emissao))}${cel("Espécie doc. / aceite", "DM / N")}${cel("( = ) Valor do documento", `<b>${brl(b.valor)}</b>`, "text-align:right")}</tr>
<tr><td colspan="3"><div class="r">Pagador</div><div class="v">${esc(p.nome)} · CPF/CNPJ ${esc(String(p.doc || "").replace(/\D/g, ""))}</div><div style="font-size:9px">${endP}</div></td></tr></table>
<div class="corte">Autenticação mecânica</div>
${cab(linha)}
<table><tr>${cel("Local de pagamento", "Pagar preferencialmente nas agências do BRADESCO", "width:75%")}${cel("Vencimento", `<b>${dBR(b.vencimento)}</b>`, "text-align:right")}</tr>
<tr>${cel("Beneficiário", `${esc(c.razao)} · CNPJ ${cnpjF(c.cnpj)}`)}${cel("Agência / código do beneficiário", ag, "text-align:right")}</tr>
<tr><td style="padding:0"><table><tr>${cel("Data do documento", dBR(b.emissao))}${cel("Nº do documento", esc(b.documento))}${cel("Espécie doc.", "DM")}${cel("Aceite", "N")}${cel("Data do processamento", dBR(b.emissao))}</tr>
<tr>${cel("Uso do banco", "")}${cel("Carteira", c.carteira)}${cel("Espécie", "R$")}${cel("Quantidade", "")}${cel("Valor", "")}</tr></table></td>${cel("Nosso número", nn, "text-align:right")}</tr>
<tr><td rowspan="5" style="vertical-align:top"><div class="r">Instruções de responsabilidade do BENEFICIÁRIO. Qualquer dúvida sobre este boleto, contate o BENEFICIÁRIO.</div><div style="font-size:10px;margin-top:4px">${instr}</div></td>${cel("( = ) Valor do documento", `<b>${brl(b.valor)}</b>`, "text-align:right")}</tr>
<tr>${cel("( - ) Desconto / abatimento", "")}</tr><tr>${cel("( + ) Mora / multa / juros", "")}</tr><tr>${cel("( + ) Outros acréscimos", "")}</tr><tr>${cel("( = ) Valor cobrado", "")}</tr>
<tr><td colspan="2"><div class="r">Pagador</div><div class="v">${esc(p.nome)} · CPF/CNPJ ${esc(String(p.doc || "").replace(/\D/g, ""))}</div><div style="font-size:9px">${endP}</div></td></tr></table>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:4px">${barrasItf(barras)}<div style="font-size:9px;text-align:right">Autenticação mecânica / <b>FICHA DE COMPENSAÇÃO</b></div></div>
</div>`;
  };
  const css = `@page{size:A4;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#000}.bol{page-break-after:always}.bol:last-child{page-break-after:auto}
table{border-collapse:collapse;width:100%}td{border:1px solid #000;padding:1px 4px;vertical-align:top}.r{font-size:7.5px}.v{font-size:11px;min-height:13px}
.cab{display:flex;align-items:flex-end;gap:12px;border-bottom:2px solid #000;margin-top:6px;padding-bottom:2px}.bco{width:150px}
.cod{font-size:20px;border-left:2px solid #000;border-right:2px solid #000;padding:0 10px}.ld{font-size:14px;font-weight:bold;flex:1}
.corte{border-bottom:1px dashed #000;font-size:8px;text-align:right;padding:4px 0 18px;margin-bottom:12px}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Boletos</title><style>${css}</style></head><body>${boletos.map(um).join("")}${autoPrint ? "<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>" : ""}</body></html>`;
}
