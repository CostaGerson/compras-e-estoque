// v595 — lançamento de pedido sem o KM: cálculos puros (usados na tela e no servidor)
import { feriados } from "./diasUteis";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const num = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s|R\$/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const iso = (d) => d.toISOString().slice(0, 10);
export const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // Brasília
export const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");

const cacheF = {};
const ehUtil = (d) => {
  const w = d.getUTCDay();
  if (w === 0 || w === 6) return false;
  const a = d.getUTCFullYear();
  const F = cacheF[a] || (cacheF[a] = feriados(a));
  return !F.has(iso(d).slice(5, 10));
};
// n dias (úteis ou corridos) depois da data
export function somaDias(base, n, tipo = "CORRIDOS") {
  if (!base) return null;
  let d = dUTC(base);
  const q = Math.max(0, Math.round(Number(n) || 0));
  if (tipo === "UTEIS") { let c = 0; while (c < q) { d = new Date(+d + 86400000); if (ehUtil(d)) c++; } }
  else d = new Date(+d + q * 86400000);
  return iso(d);
}

// ---------- numerador ----------
// AAMM + sequência de 4 dígitos (o KM usa a mesma forma: 26070078). Enquanto o KM ainda lança, o sistema usa a faixa a partir de INICIO
export const SEQ_INICIO = 5001;
export function proximoNumero(existentes, hoje = hojeISO(), inicio = SEQ_INICIO) {
  const pref = hoje.slice(2, 4) + hoje.slice(5, 7);
  let max = inicio - 1;
  for (const n of existentes || []) {
    const s = String(n || "").trim();
    if (s.length === 8 && s.startsWith(pref) && /^\d+$/.test(s)) { const q = Number(s.slice(4)); if (q >= inicio && q > max) max = q; }
  }
  return pref + String(max + 1).padStart(4, "0");
}

// ---------- itens e grade ----------
export const qtdGrade = (grade) => (Array.isArray(grade) ? grade.reduce((s, g) => s + num(g.qtd), 0) : 0);
// grade de cada item somada nas entregas × grade do item: { ok, itens: [{ idx, falta: { tam: dif } }] } (dif > 0 = falta entregar, < 0 = sobra)
export function conferirEntregas(itens, entregas, modo) {
  if (!modo || modo === "UNICA") return { ok: true, itens: [] };
  const lista = Array.isArray(entregas) ? entregas : [];
  if (!lista.length) return { ok: false, semLocais: true, itens: [] };
  const out = [];
  (itens || []).forEach((it, idx) => {
    const dif = {};
    for (const g of it.grade || []) {
      const pedido = num(g.qtd);
      const soma = lista.reduce((s, e) => s + num(e.grade?.[idx]?.[g.tam]), 0);
      if (Math.abs(pedido - soma) > 0.0001) dif[g.tam] = pedido - soma;
    }
    if (Object.keys(dif).length) out.push({ idx, dif });
  });
  return { ok: out.length === 0, itens: out };
}

// ---------- pagamento ----------
export const BASES = { EMISSAO: "emissão do pedido", NF: "emissão da NF", ENTREGA: "data de entrega" };
// parcelas com o valor de cada uma: parcela sem valor divide igualmente o que sobra do total − entrada − parcelas com valor
export function parcelasCalc(pag, total, { emissao, nf, entrega } = {}) {
  const p = pag || {};
  const ent = p.entrada && (num(p.entrada.valor) > 0) ? { data: p.entrada.data || emissao || null, valor: r2(num(p.entrada.valor)) } : null;
  const lst = Array.isArray(p.parcelas) ? p.parcelas : [];
  const fixas = lst.filter((x) => num(x.valor) > 0);
  const livres = lst.filter((x) => !(num(x.valor) > 0));
  const resto = r2(r2(total) - (ent?.valor || 0) - fixas.reduce((s, x) => s + r2(num(x.valor)), 0));
  const cada = livres.length ? r2(resto / livres.length) : 0;
  let usadas = 0;
  const bases = { EMISSAO: emissao || null, NF: nf || null, ENTREGA: entrega || null };
  const parcelas = lst.map((x, i) => {
    let valor;
    if (num(x.valor) > 0) valor = r2(num(x.valor));
    else { usadas++; valor = usadas === livres.length ? r2(resto - cada * (livres.length - 1)) : cada; }
    const base = BASES[x.base] ? x.base : "NF";
    const tipo = x.tipo === "UTEIS" ? "UTEIS" : "CORRIDOS";
    const dias = Math.max(0, Math.round(num(x.dias)));
    return { n: i + 1, de: lst.length, dias, tipo, base, valor, data: bases[base] ? somaDias(bases[base], dias, tipo) : null };
  });
  const soma = r2((ent?.valor || 0) + parcelas.reduce((s, x) => s + x.valor, 0));
  const dif = r2(r2(total) - soma);
  return { entrada: ent, parcelas, soma, dif, ok: Math.abs(dif) < 0.01 && parcelas.every((x) => x.valor > 0) && (!livres.length || resto > 0), resto };
}
// texto da condição para o pedido / previsão (ex.: "ENTRADA R$ 1.500,00 + 30 DD NF / 60 DU ENTREGA")
const brl = (n) => "R$ " + r2(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SIG = { EMISSAO: "PEDIDO", NF: "NF", ENTREGA: "ENTREGA" };
export function textoCondicao(pag, total) {
  const c = parcelasCalc(pag, total);
  const partes = [];
  if (c.entrada) partes.push(`ENTRADA ${brl(c.entrada.valor)}`);
  if (c.parcelas.length) partes.push(c.parcelas.map((x) => `${x.dias} ${x.tipo === "UTEIS" ? "DU" : "DD"} ${SIG[x.base]}`).join(" / "));
  return partes.join(" + ") || (r2(total) > 0 ? "À VISTA" : "");
}

// ---------- NF ----------
export function textoObsNf({ numero, oc, nfObs } = {}) {
  const p = [`PEDIDO Nº ${numero || "(GERADO AO EFETIVAR)"}`];
  if (String(oc || "").trim()) p.push(`OC DO CLIENTE: ${String(oc).trim().toUpperCase()}`);
  if (String(nfObs || "").trim()) p.push(String(nfObs).trim().toUpperCase());
  return p.join(" · ");
}

// ---------- entregas ----------
export const MODOS_ENTREGA = { UNICA: "Entrega única", FRACIONADA: "Entrega fracionada", TERCEIROS: "Terceiros envolvidos" };
export const DOCS_ENTREGA = {
  VENDA: "Venda de produção do estabelecimento",
  REVENDA: "Mercadoria adquirida ou recebida de terceiros",
  REMESSA: "Remessa",
  CONTA_ORDEM: "Remessa por conta e ordem de terceiros",
};
// parâmetros que não são mais lançados no pedido
export const PARAMS_FORA = ["PERÍODO PERSONALIZAÇÃO", "PERÍODO FACÇÃO", "VALOR TERCEIRIZADO"];
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
export const paramFora = (t) => PARAMS_FORA.some((x) => semAc(x) === semAc(t));

// ---------- FPP indexada ao item ----------
// artigo e rendimento (malha: peças/kg · plano: m/peça) vêm da FPP — o lançamento não digita mais
const fmt = (n, c = 3) => (n == null ? "" : String(Math.round(n * 10 ** c) / 10 ** c).replace(".", ","));
export function resumoFpp(f) {
  if (!f) return null;
  const e = f.entradas || {}, r = f.resultados || {};
  const malha = f.tipo !== "PLANO" && f.tipo !== "REVENDA";
  const rc = num(r.rendCons) || null;
  const forro = String(e.nomeArtigoForro || "").trim() && e.forrada !== false && f.tipo === "PLANO" ? String(e.nomeArtigoForro).trim().toUpperCase() : null;
  const cf = num(e.consumoForro) || num(r.consumoForro) || num(r.consumoForroEst) || null;
  const det = e.artigoDet || {};
  return {
    id: f.id, numero: f.numero, item: f.item, nomeComercial: f.nomeComercial, cliente: f.clienteNome, tipo: f.tipo,
    valorProposto: f.valorProposto ?? null,
    artigo: String(e.nomeArtigo || "").trim().toUpperCase() || null,
    artigoCor: det.cor || null, artigoCodigo: det.codigo || null,
    tecidoTipo: malha ? "MALHA" : "PLANO",
    rendimento: malha ? rc : null, consumo: malha ? null : rc,
    medida: rc ? (malha ? `Rend. ${fmt(rc, 2)} pç/kg` : `Consumo ${fmt(rc)} m/pç`) : "",
    forro, consumoForro: forro ? cf : null,
  };
}
// valor do parâmetro TECIDO montado pela FPP
export const tecidoDaFpp = (rf) => (rf ? { tipo: rf.tecidoTipo, artigo: [rf.artigo, rf.artigoCor].filter(Boolean).join(" · ") || "", medida: rf.medida,
  fpp: rf.numero, forro: rf.forro ? `${rf.forro}${rf.consumoForro ? ` · ${fmt(rf.consumoForro)} m/pç` : ""}` : "" } : null);
export const numFpp = (n) => (n != null ? String(n).padStart(5, "0") : "");
