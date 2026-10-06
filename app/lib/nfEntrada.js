// v138 — NF de entrada (compra de mercadoria) → fornecedor + contas a pagar (+ estoque no fluxo normal)
// - Fluxo normal (Produção › Compras › NF de entrada): NF entra no estoque e as duplicatas viram contas a pagar EM ABERTO.
// - Histórico (importação em lote): NF fica registrada (XML guardado) SEM itens e SEM estoque; as duplicatas com
//   vencimento antes do corte (01/10/2026) entram como PAGAS (na data do vencimento) e as demais EM ABERTO.
import { prisma } from "@/lib/prisma";
import { parseXmlNfe, validarVenda } from "@/lib/nf";
import { lerXmlTitulo, previaNota, dataUTC, mesDe, r2 } from "@/lib/finTitulos";

export const CORTE_HISTORICO = "2026-10-01";
const DIA = 86400000;

// fornecedor pelo CNPJ do emitente (cria se não existir; completa só campos vazios)
export async function fornecedorDoEmitente(nf) {
  if (!nf.emit?.cnpj) return null;
  const e = nf.emit;
  const U = (v) => (v ? String(v).toUpperCase() : null);
  const ricos = {
    razaoSocial: U(e.razaoSocial), nomeFantasia: U(e.nomeFantasia), inscricaoEstadual: e.inscricaoEstadual || null,
    logradouro: U(e.logradouro), numero: e.numero || null, complemento: U(e.complemento), bairro: U(e.bairro),
    municipio: U(e.municipio), uf: U(e.uf), cep: e.cep || null, telefones: e.telefones || null,
  };
  const cnpjRow = await prisma.fornecedorCnpj.findUnique({ where: { cnpj: e.cnpj } });
  if (cnpjRow) {
    const atual = await prisma.fornecedor.findUnique({ where: { id: cnpjRow.fornecedorId } });
    const upd = {};
    for (const k of Object.keys(ricos)) if (ricos[k] && (atual[k] == null || String(atual[k]).trim() === "")) upd[k] = ricos[k];
    if (Object.keys(upd).length) await prisma.fornecedor.update({ where: { id: cnpjRow.fornecedorId }, data: upd });
    return cnpjRow.fornecedorId;
  }
  const forn = await prisma.fornecedor.create({ data: { nome: "", ...ricos, cnpjs: { create: [{ cnpj: e.cnpj, razaoSocial: e.razaoSocial || null }] } } });
  return forn.id;
}

// conta já lançada por outro caminho (posição de títulos, manual…): mesmo CNPJ, mesmo valor, vencimento ±5 dias
async function contaParecida(documento, valor, venc) {
  if (!documento) return null;
  const d = dataUTC(venc);
  const l = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", documento, status: { not: "CANCELADO" }, vencimento: { gte: new Date(d - 5 * DIA), lte: new Date(+d + 5 * DIA) } },
    select: { id: true, valor: true, nfId: true, chaveImport: true },
  });
  // conta que já é de outra NF (nfId ou chave NFE|) não conta — só as lançadas sem nota (posição, manual)
  return l.find((t) => Math.abs(Number(t.valor) - valor) < 0.01 && !t.nfId && !String(t.chaveImport || "").startsWith("NFE|")) || null;
}

// duplicatas da NF → contas a pagar. historico: antes do corte entram pagas.
export async function gerarContasNf({ xml, nfId, historico = false, corte = CORTE_HISTORICO, quem = null, quemId = null }) {
  const r = { criadas: 0, pagas: 0, abertas: 0, valorPago: 0, valorAberto: 0, vinculadas: 0, jaExistiam: 0 };
  let x;
  try { x = lerXmlTitulo(xml); } catch { return r; }
  if (x.modelo !== "NF-e") return r;
  const n = await previaNota("PAGAR", x, { nfId });
  const titulo0 = `COMPRA NF ${n.numero}`;
  for (const p of n.parcelas) {
    const valor = r2(p.valor);
    if (!(valor > 0)) continue;
    if (p.jaImportada) { r.jaExistiam++; continue; }
    const parecida = await contaParecida(n.documento, valor, p.vencimento);
    if (parecida) {   // liga à NF em vez de duplicar
      await prisma.finTitulo.update({ where: { id: parecida.id }, data: { ...(parecida.nfId ? {} : { nfId }), ...(parecida.chaveImport ? {} : { chaveImport: p.chaveImport }) } }).catch(() => null);
      r.vinculadas++;
      continue;
    }
    const paga = historico && p.vencimento < corte;
    const multi = n.parcelas.length > 1;
    try {
      await prisma.finTitulo.create({
        data: {
          tipo: "PAGAR", titulo: multi ? `${titulo0} (${p.parcela}/${n.parcelas.length})` : titulo0,
          parceiro: String(n.parceiro || "").toUpperCase(), documento: n.documento || null,
          numeroDoc: `NF-e ${n.numero}${multi ? ` · PARC ${p.parcela}` : ""}`, valor, vencimento: dataUTC(p.vencimento), competencia: mesDe(p.vencimento),
          previsao: false, rateio: n.rateioSugerido || [], forma: "NF_XML", chaveImport: p.chaveImport, nfId: nfId || null,
          formaPagamento: "BOLETO",
          ...(paga ? { status: "PAGO", dataPagamento: dataUTC(p.vencimento), valorPago: valor, valorConfirmado: true } : {}),
          observacao: historico ? (paga ? `HISTÓRICO: VENCIDA ANTES DE ${corte.split("-").reverse().join("/")} — CONSIDERADA PAGA` : "HISTÓRICO: EM ABERTO") : null,
          criadoPorId: quemId, criadoPorNome: quem,
        },
      });
      r.criadas++;
      if (paga) { r.pagas++; r.valorPago = r2(r.valorPago + valor); } else { r.abertas++; r.valorAberto = r2(r.valorAberto + valor); }
    } catch (e) {
      if (String(e.code) === "P2002") r.jaExistiam++; else throw e;
    }
  }
  return r;
}

// um XML do histórico: registra a NF (sem itens / sem estoque) e lança as contas
export async function importarHistorico(nome, xml, { quem, quemId, corte = CORTE_HISTORICO } = {}) {
  let nf;
  try { nf = parseXmlNfe(xml); } catch (e) { return { nome, situacao: "ERRO", motivo: `não é NF-e (${e.message})` }; }
  const v = validarVenda(nf);
  if (!v.ok) return { nome, numero: nf.numero, situacao: "RECUSADA", motivo: v.motivo };
  const fornecedorId = await fornecedorDoEmitente(nf);
  if (!fornecedorId) return { nome, numero: nf.numero, situacao: "ERRO", motivo: "NF sem CNPJ do emitente." };
  let nota = await prisma.notaFiscal.findUnique({ where: { chave: nf.chave }, select: { id: true, numero: true, historico: true } });
  let novaNf = false;
  if (!nota) {
    nota = await prisma.notaFiscal.create({
      data: {
        numero: nf.numero || nf.chave.slice(25, 34).replace(/^0+/, "") || nf.chave, chave: nf.chave, fornecedorId, status: "LANCADA",
        arquivoXml: xml, temXml: true, dataEmissao: nf.dataEmissao ? new Date(nf.dataEmissao) : null, valorTotal: nf.valorTotal ?? null, historico: true,
      },
      select: { id: true, numero: true, historico: true },
    });
    novaNf = true;
  }
  const c = await gerarContasNf({ xml, nfId: nota.id, historico: true, corte, quem, quemId });
  return { nome, numero: nota.numero, situacao: novaNf ? "IMPORTADA" : "JA_EXISTIA", fornecedor: String(nf.emit?.razaoSocial || "").toUpperCase(), ...c };
}
