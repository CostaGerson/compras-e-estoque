// v1194 — Cobrança Bradesco CNAB 400 (carteira 09), no mesmo padrão do KM já homologado no banco:
//   · remessa: header "01REMESSA01COBRANCA", código da empresa 5946108, detalhe tipo 1 com multa 1%, papeleta emitida
//     pelo cliente (2), espécie 01, aceite N, sem juros no arquivo (vão impressos no boleto), trailer 9; linhas de 400 + CRLF
//   · retorno: o mesmo leiaute que o banco devolve hoje (ocorrências 02 entrada, 06 liquidação, 09/10 baixa…)
//   · boleto: código de barras/linha digitável Bradesco (campo livre agência + carteira + nosso número + conta + 0)
//   Conferido byte a byte com cb271101.rem (KM, 27/11/2026), com os retornos CB*.RET e com os boletos em PDF do KM.

export const CONTA_PADRAO = {
  banco: "237", agencia: "1408", agenciaDv: "7", conta: "0013137", contaDv: "7", carteira: "09",
  codigoEmpresa: "5946108", razao: "MERIDIAN LTDA", cnpj: "48011287000181",
  multaPct: 1, jurosDiaPct: 0.03,
};

const so = (s) => String(s ?? "").replace(/\D/g, "");
const txt = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 .,/\-&()]/g, " ").replace(/\s+$/g, "");
const A = (s, n) => txt(s).slice(0, n).padEnd(n, " ");
const N = (v, n) => so(v).slice(-n).padStart(n, "0");
const V = (valor, n = 13) => String(Math.round(Number(valor || 0) * 100)).padStart(n, "0");
const ddmmaa = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}${m}${a.slice(2)}`; };
const iso = (dma) => (/^\d{6}$/.test(dma) && dma !== "000000" ? `20${dma.slice(4)}-${dma.slice(2, 4)}-${dma.slice(0, 2)}` : null);

// dígito do nosso número: módulo 11 base 7 sobre carteira + nosso número (resto 1 → "P", 0 → "0")
export function dvNossoNumero(carteira, nn) {
  const s = N(carteira, 2) + N(nn, 11);
  let t = 0, w = 2;
  for (let i = s.length - 1; i >= 0; i--) { t += Number(s[i]) * w; w = w === 7 ? 2 : w + 1; }
  const r = t % 11;
  return r === 0 ? "0" : r === 1 ? "P" : String(11 - r);
}

/**
 * Remessa. titulos: [{ controle, nossoNumero, documento, vencimento:"AAAA-MM-DD", valor, emissao,
 *   pagador:{ doc, nome, logradouro, numero, bairro, cep }, ocorrencia="01", multaPct }]
 */
export function gerarRemessa({ sequencial, data, titulos, conta = CONTA_PADRAO }) {
  const c = { ...CONTA_PADRAO, ...conta };
  const L = [];
  L.push(("01REMESSA01" + A("COBRANCA", 15) + N(c.codigoEmpresa, 20) + A(c.razao, 30) + "237" + A("BRADESCO", 15) + ddmmaa(data) + " ".repeat(8) + "MX" + N(sequencial, 7)).padEnd(394, " ") + N(1, 6));
  titulos.forEach((t, i) => {
    const p = t.pagador || {}, doc = so(p.doc);
    const multa = t.multaPct ?? c.multaPct;
    const ender = [p.logradouro, p.numero].filter(Boolean).join(" ") + (p.bairro ? `  ${p.bairro}` : "");
    const l = "1" + "00000" + "0" + "00000" + "0000000" + "0"
      + "0" + N(c.carteira, 3) + N(c.agencia, 5) + N(c.conta, 7) + N(c.contaDv, 1)
      + A(t.controle, 25) + "000" + (multa > 0 ? "2" : "0") + V(multa, 4)
      + N(t.nossoNumero, 11) + dvNossoNumero(c.carteira, t.nossoNumero)
      + "0".repeat(10) + "2" + " " + " ".repeat(10) + " " + "2" + "  "
      + N(t.ocorrencia || "01", 2) + A(t.documento, 10) + ddmmaa(t.vencimento) + V(t.valor)
      + "000" + "00000" + "01" + "N" + ddmmaa(t.emissao || data) + "00" + "00"
      + V(0) + "000000" + V(0) + V(0) + V(t.abatimento || 0)
      + (doc.length === 11 ? "01" : "02") + N(doc, 14) + A(p.nome, 40) + A(ender, 40) + " ".repeat(12) + N(p.cep, 8) + " ".repeat(60) + N(i + 2, 6);
    L.push(l);
  });
  L.push("9" + " ".repeat(393) + N(titulos.length + 2, 6));
  for (const l of L) if (l.length !== 400) throw new Error(`linha da remessa com ${l.length} posições`);
  return L.join("\r\n") + "\r\n";
}
// nome do arquivo no padrão do KM: CBDDMMnn.REM (nn = sequência do dia)
export const nomeRemessa = (data, n = 1) => `CB${ddmmaa(data).slice(0, 4)}${String(n).padStart(2, "0")}.REM`;

export const OCORRENCIAS = { "02": "Entrada confirmada", "03": "Entrada rejeitada", "06": "Liquidação normal", "09": "Baixado automaticamente", "10": "Baixado pelo banco",
  "11": "Em ser", "12": "Abatimento concedido", "13": "Abatimento cancelado", "14": "Vencimento alterado", "15": "Liquidação em cartório", "16": "Título pago em cheque — vinculado",
  "17": "Liquidação após baixa", "18": "Acerto de depositária", "19": "Instrução de protesto recebida", "20": "Sustação de protesto recebida", "21": "Acerto do controle do participante",
  "22": "Título com pagamento cancelado", "23": "Entrada do título em cartório", "24": "Entrada rejeitada por CEP irregular", "27": "Baixa rejeitada", "28": "Débito de tarifas/custas",
  "30": "Alteração de outros dados rejeitada", "32": "Instrução rejeitada", "33": "Confirmação de pedido de alteração", "34": "Retirado de cartório e manutenção carteira",
  "35": "Desagendamento do débito automático", "68": "Acerto dos dados do rateio", "69": "Cancelamento dos dados do rateio" };

export function lerRetorno(texto) {
  const L = String(texto).split(/\r?\n/).filter((l) => l.length >= 395);
  const h = L.find((l) => l.startsWith("02RETORNO"));
  if (!h || h.slice(76, 79) !== "237") throw new Error("Não é um retorno CNAB 400 do Bradesco.");
  const v = (l, a, b) => Number(l.slice(a - 1, b)) / 100;
  const titulos = L.filter((l) => l[0] === "1").map((l) => ({
    controle: l.slice(37, 62).trim(), nossoNumero: l.slice(70, 81), dvNossoNumero: l.slice(81, 82), carteira: l.slice(107, 108),
    ocorrencia: l.slice(108, 110), ocorrenciaDesc: OCORRENCIAS[l.slice(108, 110)] || `Ocorrência ${l.slice(108, 110)}`, dataOcorrencia: iso(l.slice(110, 116)),
    documento: l.slice(116, 126).trim(), vencimento: iso(l.slice(146, 152)), valor: v(l, 153, 165), bancoCobrador: l.slice(165, 168), agenciaCobradora: l.slice(168, 173),
    tarifa: v(l, 176, 188), outrasDespesas: v(l, 189, 201), juros: v(l, 202, 214), iof: v(l, 215, 227), abatimento: v(l, 228, 240), desconto: v(l, 241, 253),
    pago: v(l, 254, 266), mora: v(l, 267, 279), outrosCreditos: v(l, 280, 292), dataCredito: iso(l.slice(295, 301)), motivos: (l.slice(318, 328).match(/../g) || []).filter((x) => x !== "00"),
    seq: Number(l.slice(394, 400)),
  }));
  return { dataGravacao: iso(h.slice(94, 100)), aviso: h.slice(108, 113), dataCredito: iso(h.slice(379, 385)), titulos,
    liquidados: titulos.filter((t) => ["06", "15", "17"].includes(t.ocorrencia)), total: Math.round(titulos.filter((t) => ["06", "15", "17"].includes(t.ocorrencia)).reduce((s, t) => s + t.pago, 0) * 100) / 100 };
}

// ── boleto: código de barras e linha digitável ──
const mod10 = (s) => { let t = 0, w = 2; for (let i = s.length - 1; i >= 0; i--) { let x = Number(s[i]) * w; t += x > 9 ? x - 9 : x; w = w === 2 ? 1 : 2; } return String((10 - (t % 10)) % 10); };
const mod11Barra = (s) => { let t = 0, w = 2; for (let i = s.length - 1; i >= 0; i--) { t += Number(s[i]) * w; w = w === 9 ? 2 : w + 1; } const r = 11 - (t % 11); return String(r === 0 || r === 10 || r === 11 ? 1 : r); };
// fator de vencimento: reiniciado em 22/02/2025 = 1000 (FEBRABAN)
export function fatorVencimento(venc) {
  const d = Math.round((Date.parse(`${venc}T12:00:00Z`) - Date.parse("2025-02-22T12:00:00Z")) / 864e5);
  return String(1000 + (d >= 0 ? d : d + 9000)).padStart(4, "0");
}
export function codigoBarras({ nossoNumero, vencimento, valor }, conta = CONTA_PADRAO) {
  const c = { ...CONTA_PADRAO, ...conta };
  const livre = N(c.agencia, 4) + N(c.carteira, 2) + N(nossoNumero, 11) + N(c.conta, 7) + "0";
  const sem = "2379" + fatorVencimento(vencimento) + V(valor, 10) + livre;
  const dv = mod11Barra(sem);
  return sem.slice(0, 4) + dv + sem.slice(4);
}
export function linhaDigitavel(barras) {
  const b = barras, l = b.slice(19);
  const c1 = b.slice(0, 4) + l.slice(0, 5), c2 = l.slice(5, 15), c3 = l.slice(15, 25);
  const f1 = c1 + mod10(c1), f2 = c2 + mod10(c2), f3 = c3 + mod10(c3);
  return `${f1.slice(0, 5)}.${f1.slice(5)} ${f2.slice(0, 5)}.${f2.slice(5)} ${f3.slice(0, 5)}.${f3.slice(5)} ${b[4]} ${b.slice(5, 19)}`;
}
