// Contas a pagar e a receber: regras compartilhadas pelas rotas
import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";

export const MESES_A_FRENTE = 12; // recorrências: gera previsões até 12 meses à frente
export const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
export const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
export const so = (t) => String(t || "").replace(/\D/g, "");
export const mesDe = (d) => (typeof d === "string" ? d.slice(0, 7) : d.toISOString().slice(0, 7));
export const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export const dataUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
// feriados nacionais fixos (dia útil = seg a sex fora deles; no salário o sábado também conta)
const FERIADOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
// só o SALÁRIO conta sábado como dia útil (5º dia útil da CLT)
export const contaSabado = (r) => ["MATRIZ|pessoal|SALARIO", "NORT|FOLHA5"].includes(r?.chaveOrigem) || /^MATRIZ\|pessoal\|(PROLABORE|ESTAGIO)\|/.test(String(r?.chaveOrigem || "")) || /^SAL[AÁ]RIO( |$)/.test(String(r?.titulo || "").toUpperCase());
export function nDiaUtil(comp, n, sabado = false) {
  const [a, m] = comp.split("-").map(Number);
  let d = new Date(Date.UTC(a, m - 1, 1)), cont = 0;
  while (d.getUTCMonth() === m - 1) {
    const dow = d.getUTCDay(), md = d.toISOString().slice(5, 10);
    if (dow !== 0 && (sabado || dow !== 6) && !FERIADOS.includes(md) && ++cont === n) return d;
    d = new Date(d.getTime() + 86400000);
  }
  return new Date(Date.UTC(a, m, 0));
}
// Fim de semana (v122): conta que vence sábado/domingo passa para a segunda seguinte;
// folha (salário, folha NORT, pró-labore, estágio) e adiantamento do dia 20 são antecipados para a sexta.
const RX_FOLHA = /(^|[^A-Z])(SAL[AÁ]RIO|FOLHA|PR[OÓ][ -]?LABORE|EST[AÁ]GIO|ADIANTAMENTO SALARIAL)([^A-Z]|$)/;
export const ehFolha = (r) => contaSabado(r)
  || ["MATRIZ|pessoal|ADIANTAMENTO", "NORT|ADIANTAMENTO"].includes(r?.chaveOrigem)
  || RX_FOLHA.test(String(r?.titulo || "").toUpperCase());
export function ajustaFds(d, folha = false) {
  if (!d) return d;
  const x = d instanceof Date ? d : dataUTC(d), dow = x.getUTCDay();
  if (dow !== 0 && dow !== 6) return x;
  const n = folha ? (dow === 6 ? -1 : -2) : (dow === 6 ? 2 : 1);
  return new Date(x.getTime() + n * 86400000);
}
// vencimento no dia X do mês (ajusta para o último dia em meses curtos) — ou no X-ésimo dia útil
export const vencNoMes = (comp, dia, util = false, sabado = false) => {
  if (util) return nDiaUtil(comp, dia, sabado);
  const [a, m] = comp.split("-").map(Number);
  const ult = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1, Math.min(Math.max(1, dia), ult)));
};

// rateio: [{contaId, pct}] somando 100
export function validarRateio(rateio) {
  const l = (Array.isArray(rateio) ? rateio : []).map((r) => ({ contaId: Number(r.contaId), pct: r2(r.pct) })).filter((r) => r.contaId && r.pct > 0);
  if (!l.length) return { erro: "Informe a conta-caixa do rateio." };
  const tot = r2(l.reduce((s, r) => s + r.pct, 0));
  if (Math.abs(tot - 100) > 0.01) return { erro: `O rateio soma ${tot}% — precisa somar 100%.` };
  return { rateio: l };
}

export const tituloOut = (t) => ({
  ...t, valor: Number(t.valor), valorPago: t.valorPago != null ? Number(t.valorPago) : null,
  vencimento: t.vencimento.toISOString().slice(0, 10), dataPagamento: t.dataPagamento ? t.dataPagamento.toISOString().slice(0, 10) : null,
  arquivoXml: undefined, temXml: !!t.arquivoXml,
  _count: undefined, nAnexos: t._count?.anexos || 0,
});
export const COM_ANEXOS = { _count: { select: { anexos: true } } };

// Gera as previsões das recorrências que faltam (do início até 12 meses à frente)
export async function gerarRecorrencias(tipo) {
  const recs = await prisma.finRecorrencia.findMany({ where: { ativo: true, ...(tipo ? { tipo } : {}) } });
  if (!recs.length) return 0;
  const ate = somaMes(mesAtual(), MESES_A_FRENTE);
  const exist = await prisma.finTitulo.findMany({ where: { recorrenciaId: { in: recs.map((r) => r.id) } }, select: { recorrenciaId: true, competencia: true } });
  const tem = new Set(exist.map((e) => `${e.recorrenciaId}|${e.competencia}`));
  const data = [];
  for (const r of recs) {
    const fim = r.fim && r.fim < ate ? r.fim : ate;
    const passo = Math.max(1, Number(r.periodicidade) || 1);   // 1 mensal, 3 trimestral…
    for (let c = r.inicio; c <= fim; c = somaMes(c, passo)) {
      if (tem.has(`${r.id}|${c}`)) continue;
      data.push({
        tipo: r.tipo, titulo: r.titulo, parceiro: r.parceiro, documento: r.documento, valor: r.valor, vencimento: ajustaFds(vencNoMes(c, r.diaVencimento, r.diaUtil, contaSabado(r)), ehFolha(r)),
        competencia: c, previsao: true, rateio: r.rateio, observacao: r.observacao, forma: "RECORRENCIA", formaPagamento: r.formaPagamento || null, recorrenciaId: r.id, criadoPorNome: r.criadoPorNome,
      });
    }
  }
  if (data.length) await prisma.finTitulo.createMany({ data, skipDuplicates: true });
  return data.length;
}

// ---------- leitura de XML: NF-e (compra) e NFS-e (serviço, vários padrões) ----------
const P = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, parseTagValue: false });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
// procura a 1ª chave (sem diferenciar maiúsculas) em qualquer nível; "dentro" restringe a um ramo (ex.: prestador)
function achar(obj, nomes, dentro) {
  const alvo = nomes.map((n) => n.toLowerCase());
  let achado;
  const vis = (o, ok) => {
    if (achado !== undefined || o == null || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      const kl = k.toLowerCase();
      const ok2 = ok || (dentro ? dentro.some((d) => kl.includes(d)) : true);
      if (ok2 && alvo.includes(kl) && (typeof v !== "object" || v?.["#text"] != null)) { achado = typeof v === "object" ? v["#text"] : v; return; }
      vis(v, ok2);
      if (achado !== undefined) return;
    }
  };
  vis(obj, !dentro);
  return achado;
}

export function lerXmlTitulo(xml, nomeArq = "") {
  const d = P.parse(xml);
  const inf = d?.nfeProc?.NFe?.infNFe || d?.NFe?.infNFe;
  if (inf) {
    const chave = String(inf["@_Id"] || "").replace(/^NFe/, "");
    const emit = inf.emit || {}, ide = inf.ide || {};
    const total = num(inf.total?.ICMSTot?.vNF);
    const dups = arr(inf.cobr?.dup);
    const base = { modelo: "NF-e", parceiro: String(emit.xFant || emit.xNome || "").toUpperCase(), razao: String(emit.xNome || "").toUpperCase(),
      documento: so(emit.CNPJ || emit.CPF), numero: String(ide.nNF || ""), emissao: String(ide.dhEmi || ide.dEmi || "").slice(0, 10), total, chave, natOp: ide.natOp || "" };
    const parcelas = dups.length
      ? dups.map((p, i) => ({ parcela: String(p.nDup || i + 1), vencimento: String(p.dVenc || base.emissao).slice(0, 10), valor: num(p.vDup) }))
      : [{ parcela: "1", vencimento: base.emissao, valor: total, semVencimento: true }];
    return { ...base, parcelas, chaveBase: `NFE|${chave}` };
  }
  // NFS-e: ABRASF, padrão nacional e variações municipais
  const valor = num(achar(d, ["vLiq", "ValorLiquidoNfse", "ValorLiquido", "vServ", "ValorServicos", "ValorTotal", "ValorNota"]));
  if (!valor) throw new Error(`${nomeArq || "arquivo"}: não reconheci como NF-e nem NFS-e.`);
  const prest = ["prestador", "emit"];
  const parceiro = String(achar(d, ["xFant", "NomeFantasia", "xNome", "RazaoSocial", "Nome"], prest) || "").toUpperCase();
  const documento = so(achar(d, ["CNPJ", "Cnpj", "CPF", "Cpf"], prest));
  const numero = String(achar(d, ["nNFSe", "Numero", "NumeroNfse", "nDFSe"]) || "");
  const emissao = String(achar(d, ["dhEmi", "DataEmissao", "dhProc", "DataEmissaoNfse", "Competencia", "dCompet"]) || "").slice(0, 10);
  return {
    modelo: "NFS-e", parceiro, razao: parceiro, documento, numero, emissao, total: valor, chave: "", natOp: "",
    parcelas: [{ parcela: "1", vencimento: emissao, valor, semVencimento: true }], chaveBase: `NFSE|${documento}|${numero}`,
  };
}

// Prévia de uma nota para virar conta(s) a pagar: sugere nome/rateio já usados e marca parcelas já lançadas
export async function previaNota(tipo, x, extra = {}) {
  const ant = x.documento ? await prisma.finTitulo.findFirst({ where: { tipo, documento: x.documento }, orderBy: { createdAt: "desc" } }) : null;
  const chaves = x.parcelas.map((p) => `${x.chaveBase}|${p.parcela}`);
  // só marca como já lançada se a conta ainda está ativa (cancelada não bloqueia)
  const ja = await prisma.finTitulo.findMany({ where: { chaveImport: { in: chaves }, status: { not: "CANCELADO" } }, select: { chaveImport: true } });
  const jaSet = new Set(ja.map((j) => j.chaveImport));
  return {
    ...x, ...extra, parceiro: ant?.parceiro || x.parceiro, rateioSugerido: ant?.rateio || null,
    parcelas: x.parcelas.map((p) => ({ ...p, chaveImport: `${x.chaveBase}|${p.parcela}`, jaImportada: jaSet.has(`${x.chaveBase}|${p.parcela}`) })),
  };
}

// Nota lançada pelo Compras → estrutura de leitura (pelo XML guardado ou, sem XML, pelos dados da nota)
export function notaParaLeitura(nf) {
  const f = nf.fornecedor || {};
  const nomeF = (f.nome || f.nomeFantasia || f.razaoSocial || "").toUpperCase();
  if (nf.arquivoXml) {
    try {
      const x = lerXmlTitulo(nf.arquivoXml, `NF ${nf.numero}`);
      return { ...x, parceiro: nomeF || x.parceiro };
    } catch {}
  }
  const emissao = nf.dataEmissao ? nf.dataEmissao.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const total = Number(nf.valorTotal || 0);
  return {
    modelo: nf.modelo === "NFSE" ? "NFS-e" : "NF-e", parceiro: nomeF, razao: (f.razaoSocial || nomeF).toUpperCase(),
    documento: f.cnpjs?.[0]?.cnpj || "", numero: nf.numero, emissao, total, chave: nf.chave || "", natOp: "",
    parcelas: [{ parcela: "1", vencimento: emissao, valor: total, semVencimento: true }],
    chaveBase: nf.chave ? `NFE|${nf.chave}` : `NF|${nf.id}`, semXml: true,
  };
}

// Contas em aberto que vencem no fim de semana → aplica a regra acima (roda a cada abertura da tela; idempotente)
export async function ajustarFinsDeSemana() {
  const abertas = await prisma.finTitulo.findMany({ where: { status: "ABERTO" }, select: { id: true, titulo: true, vencimento: true, chaveImport: true, recorrenciaId: true } });
  const fds = abertas.filter((t) => [0, 6].includes(t.vencimento.getUTCDay()) && !String(t.chaveImport || "").startsWith("SEMANA|"));
  if (!fds.length) return 0;
  const recIds = [...new Set(fds.map((t) => t.recorrenciaId).filter(Boolean))];
  const recs = recIds.length ? await prisma.finRecorrencia.findMany({ where: { id: { in: recIds } }, select: { id: true, titulo: true, chaveOrigem: true } }) : [];
  const porId = Object.fromEntries(recs.map((r) => [r.id, r]));
  for (const t of fds) {
    const r = porId[t.recorrenciaId];
    const novo = ajustaFds(t.vencimento, ehFolha(t) || (r && ehFolha(r)));
    await prisma.finTitulo.update({ where: { id: t.id }, data: { vencimento: novo } });
  }
  return fds.length;
}
