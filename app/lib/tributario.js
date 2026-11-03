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

const num = (v) => { if (v === "" || v == null) return null; const s = String(v).trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const txt = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());

export async function dadosTributarios(db = prisma) {
  if (!(await db.tribNatureza.count())) await db.tribNatureza.createMany({ data: NATUREZAS_INICIAIS });
  const [cfg, naturezas, produtos] = await Promise.all([
    db.finConfig.findUnique({ where: { chave: K_EMP } }).catch(() => null),
    db.tribNatureza.findMany({ where: { ativo: true }, orderBy: [{ tipo: "desc" }, { nome: "asc" }] }),
    db.tribProduto.findMany({ orderBy: { tipoPeca: "asc" } }),
  ]);
  let empresa = { ...EMPRESA_PADRAO }; try { empresa = { ...empresa, ...JSON.parse(cfg?.valor || "{}") }; } catch {}
  const n = (v) => (v == null ? null : Number(v));
  return { empresa, usos: USOS, produtos,
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
    unidade: txt(b.unidade) || "UN", gtin: txt(b.gtin), codigoServico: txt(b.codigoServico), obs: b.obs ? String(b.obs).trim() : null };
  await db.tribProduto.upsert({ where: { tipoPeca }, create: { tipoPeca, ...data }, update: data });
  return { ok: true };
}
// natureza a usar para um pedido/entrega (documento de entrega do lançamento) — para a emissão pelo Bling
export async function naturezaPara(uso, db = prisma) {
  return (await db.tribNatureza.findFirst({ where: { uso, ativo: true }, orderBy: [{ padrao: "desc" }, { id: "asc" }] })) || null;
}
