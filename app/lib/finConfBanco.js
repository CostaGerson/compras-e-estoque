// v823 — Conferência das cobranças em aberto no banco × contas a receber.
//   1) a IA lê o print/PDF da lista de boletos do banco (pagador, nº do documento, nosso número, vencimento, valor);
//   2) o sistema casa cada boleto com o contas a receber (nosso número → NF + parcela → valor/vencimento/nome)
//      e separa: confere · diverge · só no banco · só no sistema.
import { prisma } from "@/lib/prisma";
import { perguntarIA, iaDisponivel } from "@/lib/finIA";
import { SEM_NORT } from "@/lib/finNort";

const DIA = 86400000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const so = (s) => String(s || "").replace(/\D/g, "");
const semZero = (s) => so(s).replace(/^0+(?=\d)/, "");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const GEN = new Set("LTDA ME EPP EIRELI SA S A DE DA DO DAS DOS E EM COMERCIO SERVICOS SERVICO".split(" "));
const tk = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 3 && !GEN.has(p));

const SISTEMA = `Você lê prints ou PDFs de internet banking com a lista de boletos/cobranças em aberto de uma empresa.
Extraia TODAS as linhas da tabela, sem pular nenhuma, e devolva só uma lista JSON entre <json></json>:
[{"pagador":"...","documento":"1893-1/1","nossoNumero":"00000015367","vencimento":"AAAA-MM-DD","valor":1022.00,"status":"A VENCER / VENCIDO"}]
Regras: datas em AAAA-MM-DD; valor como número (ponto decimal, sem milhar); mantenha o nº do documento como está escrito;
campo que não aparece → null. Não invente linhas. Ignore totais e cabeçalhos.`;

export async function lerCobrancas(arquivos) {
  if (!iaDisponivel()) throw new Error("A leitura por IA não está configurada no servidor (falta ANTHROPIC_API_KEY).");
  const blocos = [];
  for (const a of arquivos || []) {
    const b64 = String(a.base64 || "").replace(/^data:[^,]+,/, "");
    if (!b64) continue;
    const mime = a.mime || (/\.pdf$/i.test(a.nome || "") ? "application/pdf" : "image/png");
    if (mime === "application/pdf") blocos.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
    else if (/^image\/(png|jpe?g|gif|webp)$/.test(mime)) blocos.push({ type: "image", source: { type: "base64", media_type: mime.replace("jpg", "jpeg"), data: b64 } });
  }
  if (!blocos.length) throw new Error("Envie o print (imagem) ou o PDF da lista de cobranças.");
  blocos.push({ type: "text", text: "Extraia as cobranças destas imagens/PDFs." });
  const l = await perguntarIA(SISTEMA, blocos);
  return (Array.isArray(l) ? l : []).map((x) => ({
    pagador: String(x.pagador || "").trim().toUpperCase() || null, documento: String(x.documento || "").trim() || null,
    nossoNumero: x.nossoNumero ? String(x.nossoNumero).trim() : null, vencimento: /^\d{4}-\d{2}-\d{2}$/.test(String(x.vencimento || "")) ? x.vencimento : null,
    valor: r2(x.valor), status: x.status ? String(x.status).toUpperCase() : null,
  })).filter((x) => x.valor > 0);
}

// "1893-1/1" → { nf: "1893", parc: 1, de: 1 } · "1893" → { nf: "1893" }
function docBanco(d) {
  const m = String(d || "").match(/(\d+)\s*[-\/ ]\s*(\d+)\s*\/\s*(\d+)/);
  if (m) return { nf: semZero(m[1]), parc: Number(m[2]), de: Number(m[3]) };
  const n = String(d || "").match(/\d+/);
  return n ? { nf: semZero(n[0]) } : {};
}
function parcTitulo(t) {
  const s = `${t.titulo || ""} ${t.numeroDoc || ""}`;
  const m = s.match(/PARC\.?\s*(\d+)\s*\/\s*(\d+)/i) || s.match(/\((\d+)\s*\/\s*(\d+)\)/);
  return m ? { parc: Number(m[1]), de: Number(m[2]) } : null;
}
const temNf = (t, nf) => !!nf && new RegExp(`(^|\\D)0*${nf}(\\D|$)`).test(`${t.titulo || ""} ${t.numeroDoc || ""}`);

export async function conferirCobrancas(linhas) {
  const datas = linhas.map((l) => l.vencimento).filter(Boolean).sort();
  const ini = datas.length ? new Date(+new Date(datas[0]) - 120 * DIA) : new Date(Date.now() - 400 * DIA);
  const fim = datas.length ? new Date(+new Date(datas[datas.length - 1]) + 120 * DIA) : new Date(Date.now() + 400 * DIA);
  const tits = await prisma.finTitulo.findMany({
    where: { ...SEM_NORT, tipo: "RECEBER", status: { not: "CANCELADO" }, vencimento: { gte: ini, lte: fim } },
    select: { id: true, titulo: true, parceiro: true, numeroDoc: true, valor: true, valorBruto: true, vencimento: true, vencimentoBoleto: true, status: true,
      nossoNumero: true, cobranca: true, formaPagamento: true, remessa: true, dataPagamento: true },
  });
  const T = tits.map((t) => ({ ...t, vFace: r2(t.valorBruto ?? t.valor), vVenc: iso(t.vencimentoBoleto || t.vencimento), nn: semZero(t.nossoNumero) }));
  const usados = new Set();
  const out = [];
  for (const b of linhas) {
    const d = docBanco(b.documento), nn = semZero(b.nossoNumero);
    let t = null, como = "";
    if (nn) { t = T.find((x) => !usados.has(x.id) && x.nn && x.nn === nn); if (t) como = "nosso número"; }
    if (!t && d.nf) {
      const c = T.filter((x) => !usados.has(x.id) && temNf(x, d.nf));
      const comParc = d.parc ? c.filter((x) => { const p = parcTitulo(x); return p ? p.parc === d.parc : (d.de === 1); }) : c;
      const pool = comParc.length ? comParc : c;
      t = pool.find((x) => Math.abs(x.vFace - b.valor) < 0.01) || (pool.length === 1 ? pool[0] : null);
      if (t) como = `NF ${d.nf}${d.parc ? ` parc ${d.parc}/${d.de}` : ""}`;
    }
    if (!t) {
      const tb = tk(b.pagador);
      t = T.find((x) => !usados.has(x.id) && Math.abs(x.vFace - b.valor) < 0.01 && b.vencimento && Math.abs(new Date(x.vVenc) - new Date(b.vencimento)) <= 5 * DIA
        && (!tb.length || tk(x.parceiro).some((p) => tb.includes(p))));
      if (t) como = "valor + vencimento + pagador";
    }
    if (!t) { out.push({ grupo: "SO_BANCO", banco: b, motivo: "Não achei a conta no contas a receber." }); continue; }
    usados.add(t.id);
    const difs = [];
    if (Math.abs(t.vFace - b.valor) >= 0.01) difs.push(`valor: banco ${b.valor.toFixed(2)} × sistema ${t.vFace.toFixed(2)}`);
    if (b.vencimento && t.vVenc !== b.vencimento) difs.push(`vencimento: banco ${b.vencimento.split("-").reverse().join("/")} × sistema ${String(t.vVenc).split("-").reverse().join("/")}`);
    const descontado = t.cobranca === "DESCONTADO" || t.valorBruto != null;
    if (t.status === "PAGO" && !descontado) difs.push(`no sistema já está ${t.dataPagamento ? `recebida em ${iso(t.dataPagamento).split("-").reverse().join("/")}` : "baixada"}, mas o banco ainda mostra em aberto`);
    out.push({ grupo: difs.length ? "DIVERGE" : "OK", banco: b, como, difs, titulo: { id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: t.vFace, vencimento: t.vVenc, status: t.status, antecipado: descontado } });
  }
  // em aberto no sistema, como boleto, dentro das datas do print, que o banco não listou
  const dIni = datas[0], dFim = datas[datas.length - 1];
  const soSistema = T.filter((x) => !usados.has(x.id) && x.status === "ABERTO" && (x.formaPagamento === "BOLETO" || x.nn || x.remessa)
    && dIni && x.vVenc >= dIni && x.vVenc <= dFim)
    .map((x) => ({ grupo: "SO_SISTEMA", titulo: { id: x.id, titulo: x.titulo, parceiro: x.parceiro, valor: x.vFace, vencimento: x.vVenc, status: x.status }, motivo: "Boleto em aberto no sistema que não está na lista do banco (entre as datas do print)." }));
  const res = [...out, ...soSistema];
  const soma = (g) => r2(res.filter((x) => x.grupo === g).reduce((s, x) => s + (x.banco?.valor ?? x.titulo?.valor ?? 0), 0));
  return {
    linhas: res,
    resumo: { lidas: linhas.length, ok: res.filter((x) => x.grupo === "OK").length, diverge: res.filter((x) => x.grupo === "DIVERGE").length,
      soBanco: res.filter((x) => x.grupo === "SO_BANCO").length, soSistema: soSistema.length, valorBanco: r2(linhas.reduce((s, l) => s + l.valor, 0)),
      vOk: soma("OK"), vDiverge: soma("DIVERGE"), vSoBanco: soma("SO_BANCO"), vSoSistema: soma("SO_SISTEMA"), periodo: dIni ? [dIni, dFim] : null },
  };
}
