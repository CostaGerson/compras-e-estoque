// v628 — Tributário: emitente, naturezas de operação e classificação fiscal dos produtos — o que o Bling precisa para emitir a NF-e
import { prisma } from "@/lib/prisma";

const K_EMP = "TRIB|EMPRESA";
export const USOS = { VENDA: "Venda de produção do estabelecimento", ADQUIRIDA: "Venda de mercadoria adquirida/recebida de terceiros", REMESSA: "Remessa",
  CONTA_ORDEM: "Remessa por conta e ordem de terceiros", SERVICO: "Prestação de serviço (NFS-e)", DEVOLUCAO: "Devolução", OUTRO: "Outra" };
export const NATUREZAS_INICIAIS = [
  { nome: "VENDA DE PRODUÇÃO DO ESTABELECIMENTO", uso: "VENDA", cfopEstado: "5101", cfopForaEstado: "6101", padrao: true },
  { nome: "VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS", uso: "ADQUIRIDA", cfopEstado: "5102", cfopForaEstado: "6102", padrao: true },
  { nome: "REMESSA", uso: "REMESSA", cfopEstado: "5949", cfopForaEstado: "6949", padrao: true },
  { nome: "REMESSA POR CONTA E ORDEM DE TERCEIROS", uso: "CONTA_ORDEM", cfopEstado: "5923", cfopForaEstado: "6923", padrao: true },
  { nome: "PRESTAÇÃO DE SERVIÇO", uso: "SERVICO", padrao: true },
  { nome: "DEVOLUÇÃO DE COMPRA PARA INDUSTRIALIZAÇÃO", uso: "DEVOLUCAO", finalidade: 4, cfopEstado: "5201", cfopForaEstado: "6201", padrao: true },
];
export const EMPRESA_PADRAO = { razaoSocial: "MERIDIAN LTDA", cnpj: "48.011.287/0001-81", ie: "", im: "", crt: "1", serie: "1", ambiente: "HOMOLOGACAO",
  logradouro: "RUA DR. NATALINO TRIGINELLI", numero: "281", bairro: "JARDIM ATLÂNTICO", municipio: "BELO HORIZONTE", uf: "MG", cep: "31710-420", codigoMunicipio: "3106200",
  telefone: "", email: "", infoComplementar: "" };

// v677 — classes de produto com NCM e tributação da planilha "NCM_Produtos - Planilha Atualizada" (Meridian Artigos Militares e Outdoor).
//   Um NCM por classe (o tipo de peça do item); todas com ICMS tributado CST 00 (18% interno MG; interestadual pela tabela),
//   PIS/COFINS lucro presumido CST 01 (alíquotas 0,65% / 3%) e IPI CST 51 = código "saída tributada com alíquota zero" (alíquota 0%). CST é código, não %.
const TRIB_PADRAO = { icmsTributacao: "TRIBUTADO", icmsCst: "00", icmsAliquotaInterna: 18, pisCofinsTributacao: "TRIBUTADO ALÍQUOTA BÁSICA", pisCofinsCst: "01",
  pisAliquota: 0.65, cofinsAliquota: 3, ipiTributacao: "TRIBUTADO ALÍQUOTA BÁSICA", ipiCst: "51", ipiAliquota: 0 };
export const CLASSES_NCM = [
  ["CAMISETA", "61091000", "Camisetas e regatas de malha"],
  ["POLO", "62052000", "Camisas polo (piquet, PV) e camisas de malha"],
  ["CAMISA", "62069000", "Camisas sociais, operacionais e administrativas de tecido plano (brim, tricoline)"],
  ["JAQUETA", "61019090", "Jaquetas e corta-ventos"],
  ["CALÇA", "61046900", "Calças (táticas, brim, operacionais, fiscais)"],
  ["BERMUDA", "61034900", "Bermudas"],
  ["JALECO", "62029900", "Jalecos"],
  ["GUARDA-PÓ", "63090010", "Guarda-pós"],
  ["AGASALHO", "61013000", "Agasalhos desportivos e de uniforme"],
  ["BLUSÃO DE FRIO", "61013000", "Blusões de frio"],
  ["BLUSÃO INDUSTRIAL", "62069000", "Blusões industriais de brim (manga comprida)"],
  ["CONJUNTO AGASALHO", "61012000", "Conjuntos de agasalho"],
  ["CASACO", "61029000", "Casacos"],
  ["SUÉTER", "61109000", "Suéteres"],
  ["BLAZER", "61043900", "Blazers sociais"],
  ["VESTIDO", "61044900", "Vestidos"],
  ["BONÉ", "65051900", "Bonés"],
  ["LENÇO", "62029900", "Lenços"],
  ["MEIA", "61151022", "Meias e meiões"],
  ["SAPATO", "64042000", "Sapatos"],
];
const K_NCM = "TRIB|NCM_PLANILHA_V1";
async function aplicarPlanilhaNcm(db) {
  if (await db.finConfig.findUnique({ where: { chave: K_NCM } }).catch(() => null)) return;
  for (const [tipoPeca, ncm, descricao] of CLASSES_NCM) {
    const d = { ncm, descricao, ...TRIB_PADRAO };
    await db.tribProduto.upsert({ where: { tipoPeca }, create: { tipoPeca, unidade: "PC", gtin: "SEM GTIN", origem: 0, ...d }, update: d });
  }
  await db.finConfig.create({ data: { chave: K_NCM, valor: JSON.stringify({ em: new Date().toISOString(), classes: CLASSES_NCM.length }) } }).catch(() => null);
}

const num = (v) => { if (v === "" || v == null) return null; const s = String(v).trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const txt = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());

export async function dadosTributarios(db = prisma) {
  if (!(await db.tribNatureza.count())) await db.tribNatureza.createMany({ data: NATUREZAS_INICIAIS });
  await aplicarPlanilhaNcm(db).catch((e) => console.log("trib/ncm:", e.message));   // v677
  const [cfg, naturezas, produtos] = await Promise.all([
    db.finConfig.findUnique({ where: { chave: K_EMP } }).catch(() => null),
    db.tribNatureza.findMany({ where: { ativo: true }, orderBy: [{ tipo: "desc" }, { nome: "asc" }] }),
    db.tribProduto.findMany({ orderBy: { tipoPeca: "asc" } }),
  ]);
  let empresa = { ...EMPRESA_PADRAO }; try { empresa = { ...empresa, ...JSON.parse(cfg?.valor || "{}") }; } catch {}
  const n = (v) => (v == null ? null : Number(v));
  const { ICMS_INTERESTADUAL } = await import("@/lib/icmsInterestadual");
  return { empresa, usos: USOS, icmsInterestadual: ICMS_INTERESTADUAL,
    produtos: produtos.map((p) => ({ ...p, icmsAliquotaInterna: n(p.icmsAliquotaInterna), pisAliquota: n(p.pisAliquota), cofinsAliquota: n(p.cofinsAliquota), ipiAliquota: n(p.ipiAliquota) })),
    naturezas: naturezas.map((x) => ({ ...x, icmsAliquota: n(x.icmsAliquota), icmsReducao: n(x.icmsReducao), icmsStAliquota: n(x.icmsStAliquota), ipiAliquota: n(x.ipiAliquota),
      pisAliquota: n(x.pisAliquota), cofinsAliquota: n(x.cofinsAliquota), issAliquota: n(x.issAliquota) })) };
}
export async function salvarEmpresa(e, db = prisma) {
  const permitidos = Object.keys(EMPRESA_PADRAO);
  const v = Object.fromEntries(permitidos.map((k) => [k, e?.[k] == null ? "" : String(e[k]).trim()]));
  await db.finConfig.upsert({ where: { chave: K_EMP }, create: { chave: K_EMP, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return { ok: true };
}
export async function salvarNatureza(b, db = prisma) {
  const data = {
    nome: txt(b.nome), tipo: b.tipo === "ENTRADA" ? "ENTRADA" : "SAIDA", uso: USOS[b.uso] ? b.uso : null, finalidade: [1, 2, 3, 4].includes(Number(b.finalidade)) ? Number(b.finalidade) : 1,
    cfopEstado: txt(b.cfopEstado), cfopForaEstado: txt(b.cfopForaEstado), consumidorFinal: !!b.consumidorFinal, presenca: [0, 1, 2, 3, 4, 5, 9].includes(Number(b.presenca)) ? Number(b.presenca) : 9,
    icmsCst: txt(b.icmsCst), icmsAliquota: num(b.icmsAliquota), icmsReducao: num(b.icmsReducao), icmsStAliquota: num(b.icmsStAliquota),
    ipiCst: txt(b.ipiCst), ipiEnquadramento: txt(b.ipiEnquadramento), ipiAliquota: num(b.ipiAliquota), pisCst: txt(b.pisCst), pisAliquota: num(b.pisAliquota),
    cofinsCst: txt(b.cofinsCst), cofinsAliquota: num(b.cofinsAliquota), issAliquota: num(b.issAliquota),
    infoComplementar: b.infoComplementar ? String(b.infoComplementar).trim() : null, blingId: b.blingId ? String(b.blingId).trim() : null, padrao: !!b.padrao,
  };
  if (!data.nome) return { error: "Informe o nome da natureza de operação." };
  if (data.cfopEstado && !/^\d{4}$/.test(data.cfopEstado)) return { error: "CFOP dentro do estado: 4 dígitos." };
  if (data.cfopForaEstado && !/^\d{4}$/.test(data.cfopForaEstado)) return { error: "CFOP fora do estado: 4 dígitos." };
  const r = b.id ? await db.tribNatureza.update({ where: { id: Number(b.id) }, data }) : await db.tribNatureza.create({ data });
  if (data.padrao && data.uso) await db.tribNatureza.updateMany({ where: { uso: data.uso, id: { not: r.id } }, data: { padrao: false } });   // um padrão por uso
  return { ok: true, natureza: r };
}
export async function excluirNatureza(id, db = prisma) { await db.tribNatureza.update({ where: { id: Number(id) || 0 }, data: { ativo: false } }); return { ok: true }; }
export async function salvarProduto(b, db = prisma) {
  const tipoPeca = txt(b.tipoPeca);
  if (!tipoPeca) return { error: "Tipo de peça?" };
  const ncm = b.ncm ? String(b.ncm).replace(/\D/g, "") : null;
  if (ncm && ncm.length !== 8) return { error: `NCM de ${tipoPeca}: 8 dígitos.` };
  const data = { ncm, cest: b.cest ? String(b.cest).replace(/\D/g, "") || null : null, origem: Math.min(8, Math.max(0, Number(b.origem) || 0)),
    unidade: txt(b.unidade) || "UN", gtin: txt(b.gtin), codigoServico: txt(b.codigoServico), obs: b.obs ? String(b.obs).trim() : null,
    // v677 — tributação da classe
    descricao: b.descricao ? String(b.descricao).trim() : null, icmsTributacao: txt(b.icmsTributacao), icmsCst: txt(b.icmsCst), icmsAliquotaInterna: num(b.icmsAliquotaInterna),
    pisCofinsTributacao: txt(b.pisCofinsTributacao), pisCofinsCst: txt(b.pisCofinsCst), pisAliquota: num(b.pisAliquota), cofinsAliquota: num(b.cofinsAliquota),
    ipiTributacao: txt(b.ipiTributacao), ipiCst: txt(b.ipiCst), ipiAliquota: num(b.ipiAliquota) };
  await db.tribProduto.upsert({ where: { tipoPeca }, create: { tipoPeca, ...data }, update: data });
  return { ok: true };
}
// natureza a usar para um pedido/entrega (documento de entrega do lançamento) — para a emissão pelo Bling
export async function naturezaPara(uso, db = prisma) {
  return (await db.tribNatureza.findFirst({ where: { uso, ativo: true }, orderBy: [{ padrao: "desc" }, { id: "asc" }] })) || null;
}
