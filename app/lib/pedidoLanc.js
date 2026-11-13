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
// v750 — desconto: na peça (sobre o preço cheio) e no total do pedido (sobre o valor dos itens)
export function valorDesconto(d, base) {
  if (!d || d.ativo === false) return 0;
  const v = Math.max(0, num(d.valor)), b = Math.max(0, num(base));
  if (!v || !b) return 0;
  return Math.round(Math.min(b, d.tipo === "PCT" ? b * Math.min(v, 100) / 100 : v) * 100) / 100;
}
export const precoComDesconto = (d) => Math.round(Math.max(0, num(d?.base) - valorDesconto(d, d?.base)) * 100) / 100;
// v746 — frete contratado por entrega: soma no total do pedido (não é distribuído entre os itens)
export function freteTotal({ entregaModo, entregas, frete } = {}) {
  if (frete != null && typeof frete !== "object") return Math.round(Math.max(0, num(frete)) * 100) / 100;   // pedido de venda: frete já somado (número)
  const v = (x) => (x && x.contratado ? Math.max(0, num(x.valor)) : 0);
  const t = !entregaModo || entregaModo === "UNICA" ? v(frete) : (Array.isArray(entregas) ? entregas : []).reduce((s, e) => s + v(e?.frete), 0);
  return Math.round(t * 100) / 100;
}
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
// v773 — #65: valor da entrada/parcela em R$ ou em % do total (campo pct) ·
// #66: restrição de pagamento do cliente (dias do mês, dias da semana ou "1ª quinta do mês"): o vencimento vai para a
// primeira data que atende; data digitada à mão (dataFixa) sempre prevalece
export const DOWS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const DOWS_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function textoRestricao(r) {
  if (!r || !r.tipo) return "";
  if (r.tipo === "DIA_MES") return `só dia${(r.dias || []).length > 1 ? "s" : ""} ${(r.dias || []).join(", ")} do mês`;
  if (r.tipo === "DIA_SEMANA") return `só ${(r.dows || []).map((d) => DOWS_LONGO[d]).join(", ")}`;
  if (r.tipo === "NESIMO") return `${r.n === 5 ? "última" : `${r.n}ª`} ${DOWS_LONGO[r.dow ?? 1]} do mês`;
  return "";
}
function atende(iso, r) {
  const d = new Date(`${iso}T00:00:00Z`), dia = d.getUTCDate(), dow = d.getUTCDay();
  if (r.tipo === "DIA_MES") { const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); return (r.dias || []).some((x) => Number(x) === dia || (Number(x) > ult && dia === ult)); }
  if (r.tipo === "DIA_SEMANA") return (r.dows || []).map(Number).includes(dow);
  if (r.tipo === "NESIMO") {
    if (dow !== Number(r.dow ?? 1)) return false;
    if (Number(r.n) === 5) return dia + 7 > new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();   // última do mês
    return Math.ceil(dia / 7) === Number(r.n || 1);
  }
  return true;
}
export function aplicarRestricao(iso, r) {
  if (!iso || !r || !r.tipo) return iso;
  if ((r.tipo === "DIA_MES" && !(r.dias || []).length) || (r.tipo === "DIA_SEMANA" && !(r.dows || []).length)) return iso;
  let d = String(iso).slice(0, 10);
  for (let k = 0; k < 400; k++) { if (atende(d, r)) return d; d = new Date(new Date(`${d}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10); }
  return iso;
}
const valorDe = (x, total) => (x?.pct ? r2(r2(total) * num(x.valor) / 100) : r2(num(x?.valor)));
export function parcelasCalc(pag, total, { emissao, nf, entrega } = {}) {
  const p = pag || {};
  const ent = p.entrada && (num(p.entrada.valor) > 0)
    ? { data: p.entrada.dataFixa || aplicarRestricao(p.entrada.data || emissao || null, p.entrada.restricao), valor: valorDe(p.entrada, total), pct: !!p.entrada.pct } : null;
  const lst = Array.isArray(p.parcelas) ? p.parcelas : [];
  const fixas = lst.filter((x) => num(x.valor) > 0);
  const livres = lst.filter((x) => !(num(x.valor) > 0));
  const resto = r2(r2(total) - (ent?.valor || 0) - fixas.reduce((s, x) => s + valorDe(x, total), 0));
  const cada = livres.length ? r2(resto / livres.length) : 0;
  let usadas = 0;
  const bases = { EMISSAO: emissao || null, NF: nf || null, ENTREGA: entrega || null };
  const parcelas = lst.map((x, i) => {
    let valor;
    if (num(x.valor) > 0) valor = valorDe(x, total);
    else { usadas++; valor = usadas === livres.length ? r2(resto - cada * (livres.length - 1)) : cada; }
    const base = BASES[x.base] ? x.base : "NF";
    const tipo = x.tipo === "UTEIS" ? "UTEIS" : "CORRIDOS";
    const dias = Math.max(0, Math.round(num(x.dias)));
    const calc = bases[base] ? aplicarRestricao(somaDias(bases[base], dias, tipo), x.restricao) : null;
    return { n: i + 1, de: lst.length, dias, tipo, base, valor, pct: !!x.pct, data: x.dataFixa || calc, dataCalc: calc, fixa: !!x.dataFixa, restricao: x.restricao || null };
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
    valorProposto: f.valorProposto ?? null, leadTime: Number(f.leadTime) > 0 ? Number(f.leadTime) : null,   // v702
    artigo: String(e.nomeArtigo || "").trim().toUpperCase() || null,
    artigoCor: det.cor || null, artigoCodigo: det.codigo || null, artigoFabricante: det.fornecedorNome ? String(det.fornecedorNome).toUpperCase() : null,   // v774 — #58
    cores: [det.cor ? { cor: det.cor, codigo: det.codigo || null } : null, ...(Array.isArray(det.variantes) ? det.variantes.filter((x) => x && x.cor).map((x) => ({ cor: x.cor, codigo: x.codigo || null })) : [])].filter(Boolean),   // v664
    tecidoTipo: malha ? "MALHA" : "PLANO",
    rendimento: malha ? rc : null, consumo: malha ? null : rc,
    medida: rc ? (malha ? `Rend. ${fmt(rc, 2)} pç/kg` : `Consumo ${fmt(rc)} m/pç`) : "",
    forro, consumoForro: forro ? cf : null,
    aplicacoes: aplicacoesDaFpp(e),   // v806
  };
}
// v806 — locais de aplicação (mesmos da FPP) e rótulos
export const LOCAIS_APL = [["PEITO_E", "Peito esq."], ["PEITO_D", "Peito dir."], ["PEITO_C", "Peito central"], ["COSTAS_SUP", "Costas sup."], ["COSTAS_MEIO", "Costas meio"], ["COSTAS_INF", "Costas inf."], ["MANGA_D", "Manga dir."], ["MANGA_E", "Manga esq."],
  ["PERNA_LAT_D", "Lateral perna dir."], ["PERNA_LAT_E", "Lateral perna esq."], ["BOLSO_DIANT_D", "Bolso diant. dir."], ["BOLSO_DIANT_E", "Bolso diant. esq."], ["BOLSO_TRAS_D", "Bolso tras. dir."], ["BOLSO_TRAS_E", "Bolso tras. esq."], ["TOTAL", "Total"]];
export const nomeLocalApl = (k) => (LOCAIS_APL.find((x) => x[0] === k) || [k, String(k || "").replace(/_/g, " ")])[1];
export const NOME_METODO = { SILK: "Silk", DTF: "DTF", BORDADO: "Bordado", SUBLIMACAO: "Sublimação" };
// "SILK 2 CORES · PEITO ESQ. · 10 × 8 CM"
export const rotuloAplicacao = (a) => [`${(NOME_METODO[a.metodo] || a.metodo || "").toUpperCase()}${a.metodo === "SILK" && a.cores ? ` ${a.cores} COR${a.cores > 1 ? "ES" : ""}` : ""}`,
  a.local ? nomeLocalApl(a.local).toUpperCase() : null, a.largura && a.altura ? `${String(a.largura).replace(".", ",")} × ${String(a.altura).replace(".", ",")} CM` : null].filter(Boolean).join(" · ");

// v806 — personalizações com arte (silk, DTF, bordado) da FPP: vão para o item do pedido com medidas e arquivos
export const METODOS_ARTE = ["SILK", "DTF", "BORDADO"];
export function aplicacoesDaFpp(e) {
  return (Array.isArray(e?.personalizacoes) ? e.personalizacoes : []).filter((a) => a && METODOS_ARTE.includes(a.metodo))
    .map((a, k) => ({ uid: a.uid || `fpp${k}`, metodo: a.metodo, local: a.local || null, ...(a.metodo === "SILK" ? { cores: Number(a.cores) || 1 } : {}),
      largura: a.largura || "", altura: a.altura || "", ...(a.obsArte ? { obs: a.obsArte } : {}) }));
}
// valor do parâmetro TECIDO montado pela FPP
// v774 — #58: guarda também nome do artigo, cor, código e fabricante (a OP mostra nessa ordem, sem o rendimento)
export const tecidoDaFpp = (rf, cor) => (rf ? { tipo: rf.tecidoTipo, artigo: [rf.artigo, cor || rf.artigoCor].filter(Boolean).join(" · ") || "", medida: rf.medida, ...((rf.cores || []).length > 1 ? { cor: cor || rf.artigoCor || null } : {}),
  nome: rf.artigo || null, corArtigo: cor || rf.artigoCor || null,
  codigo: ((rf.cores || []).find((c) => c.cor === (cor || rf.artigoCor)) || {}).codigo || rf.artigoCodigo || null, fabricante: rf.artigoFabricante || null,
  fpp: rf.numero, forro: rf.forro ? `${rf.forro}${rf.consumoForro ? ` · ${fmt(rf.consumoForro)} m/pç` : ""}` : "" } : null);
export const numFpp = (n) => (n != null ? String(n).padStart(5, "0") : "");
