// v1189 — emissão de NF-e pelo ERP: numera, monta, assina, envia à SEFAZ-MG e guarda (NfeEmissao).
//   Etapa 2: nota de TESTE em homologação (Meridian → NORT e NORT → Meridian) para validar o caminho completo.
import { prisma } from "@/lib/prisma";
import { montarNFe, assinar } from "@/lib/nfeXml";
import { autorizar } from "@/lib/nfeSefaz";
import { certificado } from "@/lib/nfeCert";
import { dadosTributarios } from "@/lib/tributario";

const EMPS = ["MERIDIAN", "NORT"];
const amb = (a) => (a === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO");

// próximo número: maior número já usado (autorizada, denegada ou pendente) + 1 · rejeitada não consome número
export async function proximoNumero(empresa, ambiente, serie) {
  const u = await prisma.nfeEmissao.findFirst({ where: { empresa, ambiente: amb(ambiente), serie: Number(serie), status: { in: ["AUTORIZADA", "DENEGADA", "PENDENTE"] } }, orderBy: { numero: "desc" } });
  return (u?.numero || 0) + 1;
}

export async function emitir(nota, { empresa, ambiente, quem, origem = "AVULSA", pedidoNumero = null }) {
  if (!EMPS.includes(empresa)) return { error: "Empresa emitente inválida." };
  const t = await dadosTributarios();
  const emit = t.empresas[empresa];
  const a = amb(ambiente || emit.ambiente);
  const serie = Number(emit.serie) || 2;
  const numero = await proximoNumero(empresa, a, serie);
  let c;
  try { c = await certificado(empresa); } catch (e) { return { error: e.message }; }
  let n, xml;
  try {
    n = montarNFe({ ...nota, emit, ambiente: a, serie, numero });
    xml = assinar(n.infNFe, n.id, c);
  } catch (e) { return { error: `Não foi possível montar a NF-e: ${e.message}` }; }
  const base = { empresa, ambiente: a, serie, numero, chave: n.chave, natOp: nota.natOp, destNome: nota.dest?.nome || null, destDoc: String(nota.dest?.cnpj || nota.dest?.cpf || "").replace(/\D/g, "") || null,
    valor: n.totais.vNF, origem, pedidoNumero, xml, dados: { itens: nota.itens?.length || 0, totais: n.totais }, criadoPorNome: quem || null };
  const reg = await prisma.nfeEmissao.create({ data: { ...base, status: "PENDENTE" } });
  const r = await autorizar(empresa, a, xml).catch((e) => ({ ok: false, pendente: true, erro: e.message }));
  const status = r.ok ? "AUTORIZADA" : r.denegada ? "DENEGADA" : r.pendente ? "PENDENTE" : "REJEITADA";
  const fim = await prisma.nfeEmissao.update({ where: { id: reg.id }, data: { status, cStat: r.cStat || null, xMotivo: r.xMotivo || r.erro || null,
    protocolo: r.protocolo || null, dhRecbto: r.dhRecbto || null, xmlProc: r.nfeProc && (r.ok || r.denegada) ? r.nfeProc : null } });
  return { ok: !!r.ok, nota: resumo(fim) };
}

// nota de teste: uma empresa vende para a outra (as duas em BH, contribuintes) — só homologação
export async function emitirTeste(empresa, quem) {
  const t = await dadosTributarios();
  const outra = t.empresas[empresa === "NORT" ? "MERIDIAN" : "NORT"];
  const crt3 = String(t.empresas[empresa]?.crt) === "3";
  const nota = {
    natOp: crt3 ? "VENDA DE PRODUCAO DO ESTABELECIMENTO" : "VENDA DE MERCADORIA ADQUIRIDA",
    dest: { cnpj: outra.cnpj, nome: outra.razaoSocial, ie: outra.ie, logradouro: outra.logradouro, numero: outra.numero, complemento: outra.complemento, bairro: outra.bairro,
      municipio: outra.municipio, uf: outra.uf || "MG", cep: outra.cep, codigoMunicipio: outra.codigoMunicipio },
    indPres: 9, modFrete: 9,
    itens: [{ codigo: "TESTE-01", descricao: "CAMISETA MALHA PV - TESTE DE EMISSAO", ncm: "61091000", cfop: crt3 ? "5101" : "5102", unidade: "UN", qtd: 2, valorUnit: 35.9 },
      { codigo: "TESTE-02", descricao: "CALCA OPERACIONAL BRIM - TESTE DE EMISSAO", ncm: "61046900", cfop: crt3 ? "5101" : "5102", unidade: "UN", qtd: 1, valorUnit: 89.9 }],
    pag: [{ tPag: "90", vPag: 0 }],
    infCpl: crt3 ? "Empresa detentora de Regime Especial de Tributacao do Estado de Minas Gerais conforme e-PTA-RE 45.000047072-14" : "Documento emitido por ME ou EPP optante pelo Simples Nacional.",
  };
  return emitir(nota, { empresa, ambiente: "HOMOLOGACAO", quem, origem: "TESTE" });
}

const resumo = (x) => ({ id: x.id, empresa: x.empresa, ambiente: x.ambiente, serie: x.serie, numero: x.numero, chave: x.chave, status: x.status, cStat: x.cStat, xMotivo: x.xMotivo,
  protocolo: x.protocolo, dhRecbto: x.dhRecbto, natOp: x.natOp, destNome: x.destNome, valor: Number(x.valor), origem: x.origem, criadoPorNome: x.criadoPorNome, createdAt: x.createdAt });

export async function listarEmissoes(empresa) {
  const l = await prisma.nfeEmissao.findMany({ where: empresa ? { empresa } : {}, orderBy: { id: "desc" }, take: 30 });
  return l.map(resumo);
}
export async function xmlEmissao(id) {
  const x = await prisma.nfeEmissao.findUnique({ where: { id: Number(id) || 0 } });
  if (!x) return null;
  return { nome: `${x.chave}-${x.xmlProc ? "procNFe" : "nfe"}.xml`, xml: x.xmlProc || x.xml };
}
