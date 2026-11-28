// v1196 — cobrança Bradesco pelo ERP: emitir boleto (registro), alterar vencimento/valor, abatimento, baixa, protesto
//   e sustação. Cada pedido vira uma instrução PENDENTE; "Gerar remessa" junta as pendentes num arquivo CNAB 400 no
//   padrão do KM (lib/cnabBradesco) e o retorno do banco confirma ou rejeita (lib/finRetorno).
import { prisma } from "@/lib/prisma";
import { gerarRemessa, nomeRemessa, dvNossoNumero, CONTA_PADRAO } from "@/lib/cnabBradesco";
import { dataUTC, mesDe } from "@/lib/finTitulos";
import { nfDaConta } from "@/lib/finRetorno";

const K_CFG = "COBRANCA|BRADESCO";
export const TIPOS = {
  REGISTRO: { oc: "01", nome: "Emitir boleto (registro)", confirma: ["02"] },
  BAIXA: { oc: "02", nome: "Baixar / cancelar boleto", confirma: ["09", "10"] },
  ABATIMENTO: { oc: "04", nome: "Conceder abatimento", confirma: ["12"] },
  CANC_ABATIMENTO: { oc: "05", nome: "Cancelar abatimento", confirma: ["13"] },
  VENCIMENTO: { oc: "06", nome: "Alterar vencimento", confirma: ["14"] },
  PROTESTO: { oc: "09", nome: "Protestar", confirma: ["19"] },
  SUSTAR: { oc: "18", nome: "Sustar protesto e baixar", confirma: ["20", "09", "10"] },
  VALOR: { oc: "31", nome: "Alterar valor", confirma: ["33"] },
};
export const REJEICAO = ["03", "24", "27", "30", "32"];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const so = (s) => String(s || "").replace(/\D/g, "");
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export async function configCobranca() {
  const c = await prisma.finConfig.findUnique({ where: { chave: K_CFG } }).catch(() => null);
  let v = {}; try { v = JSON.parse(c?.valor || "{}"); } catch {}
  // nosso número do ERP numa faixa própria (o KM está em ~15.6 mil) · remessa continua a numeração do KM (MX0000163 em 27/11/2026)
  return { proxNossoNumero: 100000, proxRemessa: 164, ...v };
}
export async function salvarConfig(p) {
  const atual = await configCobranca();
  const v = { ...atual };
  if (p.proxNossoNumero != null) { const n = Number(so(p.proxNossoNumero)); if (!(n > 0 && n < 1e11)) return { error: "Nosso número inválido." }; v.proxNossoNumero = n; }
  if (p.proxRemessa != null) { const n = Number(so(p.proxRemessa)); if (!(n > 0 && n < 1e7)) return { error: "Nº da remessa inválido." }; v.proxRemessa = n; }
  await prisma.finConfig.upsert({ where: { chave: K_CFG }, create: { chave: K_CFG, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return { ok: true, config: v };
}

// seu número no padrão do KM: "NF-parcela/total" (ex.: 2112-1/1)
function seuNumero(t) {
  if (t.numeroDoc && /^\S{1,10}$/.test(t.numeroDoc.trim())) return t.numeroDoc.trim();
  const nf = nfDaConta(t);
  if (nf) { const s = `${nf.nf}-${nf.parc || 1}/${nf.total || 1}`; if (s.length <= 10) return s; }
  return `T${t.id}`.slice(0, 10);
}
const nossoBase = (t) => { const d = String(t.nossoNumero || "").replace(/\D/g, ""); return d.length >= 12 ? d.slice(0, 11) : d.padStart(11, "0").slice(-11); };

export async function solicitar(tituloId, tipo, dados = {}, quem) {
  const T = TIPOS[tipo];
  if (!T) return { error: "Instrução inválida." };
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) || 0 } });
  if (!t || t.tipo !== "RECEBER") return { error: "Conta a receber não encontrada." };
  if (!["ABERTO", "EXECUCAO"].includes(t.status) && tipo !== "BAIXA") return { error: `A conta está ${t.status.toLowerCase()}.` };
  // a mesma instrução ainda não enviada é substituída (ex.: mudou o vencimento de novo); instruções diferentes seguem juntas
  const pend = await prisma.boletoInstrucao.findFirst({ where: { tituloId: t.id, status: "PENDENTE", tipo } });
  if (pend && tipo === "REGISTRO") return { error: "O boleto já está esperando a próxima remessa." };
  const alt = Array.isArray(t.alteracoes) ? t.alteracoes : [];
  const marca = (campo, texto) => [...alt, { campo, texto, em: new Date().toISOString(), por: quem || null, manual: true }];
  const data = {};
  let d = {};
  if (tipo === "REGISTRO") {
    if (t.nossoNumero && t.registradoEm) return { error: "Esse título já tem boleto registrado no banco." };
    if (!t.documento || ![11, 14].includes(so(t.documento).length)) return { error: "A conta não tem CNPJ/CPF do cliente." };
    const cfg = await configCobranca();
    let nn = t.nossoNumero ? nossoBase(t) : null;
    if (!nn) {
      nn = String(cfg.proxNossoNumero).padStart(11, "0");
      await salvarConfig({ proxNossoNumero: cfg.proxNossoNumero + 1 });
      data.nossoNumero = nn + dvNossoNumero(CONTA_PADRAO.carteira, nn);
    }
    data.numeroDoc = seuNumero(t); data.formaPagamento = "BOLETO"; data.cobranca = "EMITIDO";
    d = { nossoNumero: nn, documento: data.numeroDoc };
  } else {
    if (!t.nossoNumero) return { error: "A conta não tem boleto (nosso número). Emita o boleto primeiro." };
    if (tipo === "VENCIMENTO") {
      const v = String(dados.vencimento || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < hoje()) return { error: "Informe o novo vencimento (hoje ou depois)." };
      const de = dISO(t.vencimento);
      const rep = Array.isArray(t.reprogramacoes) ? t.reprogramacoes : [];
      Object.assign(data, { vencimento: dataUTC(v), competencia: mesDe(v), vencimentoOriginal: t.vencimentoOriginal || t.vencimento, vencimentoBoleto: dataUTC(v),
        reprogramacoes: [...rep, { de, para: v, em: new Date().toISOString(), por: quem || null, motivo: "BOLETO: ALTERAÇÃO DE VENCIMENTO NO BANCO" }],
        alteracoes: marca("vencimento", `Vencimento ${de.split("-").reverse().join("/")} → ${v.split("-").reverse().join("/")} (instrução ao banco)`) });
      d = { vencimento: v, de };
    } else if (tipo === "VALOR") {
      const v = r2(dados.valor);
      if (!(v > 0)) return { error: "Informe o novo valor." };
      Object.assign(data, { valor: v, valorBruto: v, alteracoes: marca("valor", `Valor ${Number(t.valor).toFixed(2)} → ${v.toFixed(2)} (instrução ao banco)`) });
      d = { valor: v, de: Number(t.valor) };
    } else if (tipo === "ABATIMENTO") {
      const a = r2(dados.abatimento);
      if (!(a > 0) || a >= Number(t.valor)) return { error: "Abatimento deve ser maior que zero e menor que o valor do boleto." };
      Object.assign(data, { valor: r2(Number(t.valor) - a), valorBruto: t.valorBruto || t.valor, alteracoes: marca("valor", `Abatimento de ${a.toFixed(2)} no boleto (instrução ao banco)`) });
      d = { abatimento: a, de: Number(t.valor) };
    } else if (tipo === "CANC_ABATIMENTO") {
      const ult = await prisma.boletoInstrucao.findFirst({ where: { tituloId: t.id, tipo: "ABATIMENTO", status: { in: ["ENVIADA", "CONFIRMADA"] } }, orderBy: { id: "desc" } });
      const a = r2(ult?.dados?.abatimento);
      if (!a) return { error: "Não há abatimento enviado para cancelar." };
      Object.assign(data, { valor: r2(Number(t.valor) + a), alteracoes: marca("valor", `Abatimento de ${a.toFixed(2)} cancelado (instrução ao banco)`) });
      d = { abatimento: a };
    } else if (tipo === "BAIXA") { data.cobranca = "BAIXA SOLICITADA"; d = { motivo: dados.motivo || null }; }
    else if (tipo === "PROTESTO") { data.cobranca = "PROTESTO SOLICITADO"; }
    else if (tipo === "SUSTAR") { data.cobranca = "SUSTAÇÃO SOLICITADA"; }
  }
  if (pend) await prisma.boletoInstrucao.update({ where: { id: pend.id }, data: { status: "CANCELADA", retornoTxt: "substituída por outra igual" } }).catch(() => null);
  await prisma.finTitulo.update({ where: { id: t.id }, data: { ...data, atualizadoPorNome: quem || null } });
  const i = await prisma.boletoInstrucao.create({ data: { tituloId: t.id, tipo, ocorrencia: T.oc, dados: d, criadoPorNome: quem || null } });
  return { ok: true, instrucao: i };
}

export async function cancelarInstrucao(id) {
  const i = await prisma.boletoInstrucao.findUnique({ where: { id: Number(id) || 0 } });
  if (!i || i.status !== "PENDENTE") return { error: "Só dá para desfazer instrução que ainda não foi para a remessa." };
  await prisma.boletoInstrucao.update({ where: { id: i.id }, data: { status: "CANCELADA" } });
  return { ok: true, aviso: i.tipo === "REGISTRO" ? null : "A conta mantém o que foi alterado; ajuste-a se precisar." };
}

async function pagadorDe(t) {
  const doc = so(t.documento);
  let c = doc ? await prisma.cliente.findFirst({ where: { cnpj: { in: [doc, t.documento] } } }).catch(() => null) : null;
  if (!c && doc) { const h = (await prisma.cliente.findMany({ where: { cnpj: { not: null } }, select: { id: true, cnpj: true } })).find((x) => so(x.cnpj) === doc); if (h) c = await prisma.cliente.findUnique({ where: { id: h.id } }); }
  return { doc, nome: c?.razaoSocial || t.parceiro, logradouro: c?.logradouro || "", numero: c?.numero || "", bairro: c?.bairro || "", cep: so(c?.cep), municipio: c?.municipio || "", uf: c?.uf || "" };
}
const boletoDe = async (t) => ({ controle: String(t.id), nossoNumero: nossoBase(t), documento: seuNumero(t), vencimento: dISO(t.vencimento), valor: Number(t.valorBruto || t.valor),
  emissao: dISO(t.emissao) || hoje(), pagador: await pagadorDe(t) });

export async function painelCobranca() {
  const pend = await prisma.boletoInstrucao.findMany({ where: { status: { in: ["PENDENTE", "ENVIADA", "REJEITADA"] } }, orderBy: { id: "desc" }, take: 300 });
  const tits = await prisma.finTitulo.findMany({ where: { id: { in: [...new Set(pend.map((x) => x.tituloId))] } }, select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, nossoNumero: true, numeroDoc: true } });
  const porT = Object.fromEntries(tits.map((t) => [t.id, t]));
  const remessas = await prisma.boletoRemessa.findMany({ orderBy: { id: "desc" }, take: 20, select: { id: true, sequencial: true, arquivo: true, qtd: true, criadoPorNome: true, createdAt: true } });
  return { config: await configCobranca(), tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.nome])),
    instrucoes: pend.map((i) => ({ ...i, titulo: porT[i.tituloId] ? { ...porT[i.tituloId], valor: Number(porT[i.tituloId].valor) } : null })), remessas };
}

export async function gerarRemessaPendentes(quem) {
  const pend = await prisma.boletoInstrucao.findMany({ where: { status: "PENDENTE" }, orderBy: { id: "asc" } });
  if (!pend.length) return { error: "Nenhuma instrução esperando remessa." };
  const cfg = await configCobranca();
  const titulos = [], usados = [], erros = [];
  for (const i of pend) {
    const t = await prisma.finTitulo.findUnique({ where: { id: i.tituloId } });
    if (!t?.nossoNumero) { erros.push(`conta ${i.tituloId}: sem nosso número`); continue; }
    const b = await boletoDe(t);
    if (i.tipo === "REGISTRO" && (!b.pagador.logradouro || b.pagador.cep.length !== 8)) { erros.push(`${t.titulo} (${t.parceiro}): cliente sem endereço/CEP no cadastro`); continue; }
    if (i.tipo === "VENCIMENTO") b.vencimento = i.dados?.vencimento || b.vencimento;
    titulos.push({ ...b, ocorrencia: i.ocorrencia, abatimento: i.tipo === "ABATIMENTO" || i.tipo === "CANC_ABATIMENTO" ? Number(i.dados?.abatimento || 0) : 0 });
    usados.push(i);
  }
  if (!titulos.length) return { error: `Nada a enviar: ${erros.join(" · ")}` };
  const data = hoje();
  const nDia = (await prisma.boletoRemessa.count({ where: { createdAt: { gte: new Date(`${data}T03:00:00Z`) } } })) + 1;
  const conteudo = gerarRemessa({ sequencial: cfg.proxRemessa, data, titulos });
  const arquivo = nomeRemessa(data, 50 + nDia);   // CBDDMM51.REM… (o KM usa 01, 02… no mesmo dia)
  const rem = await prisma.boletoRemessa.create({ data: { sequencial: cfg.proxRemessa, arquivo, conteudo, qtd: titulos.length, criadoPorNome: quem || null } });
  await salvarConfig({ proxRemessa: cfg.proxRemessa + 1 });
  for (const i of usados) {
    await prisma.boletoInstrucao.update({ where: { id: i.id }, data: { status: "ENVIADA", remessaId: rem.id } });
    if (i.tipo === "REGISTRO") await prisma.finTitulo.update({ where: { id: i.tituloId }, data: { remessa: String(cfg.proxRemessa), remessaEm: dataUTC(data) } });
  }
  return { ok: true, remessa: { id: rem.id, arquivo, sequencial: rem.sequencial, qtd: titulos.length }, erros };
}
export async function arquivoRemessa(id) {
  return prisma.boletoRemessa.findUnique({ where: { id: Number(id) || 0 } });
}
export async function boletosHtml(ids) {
  const { htmlBoletos } = await import("@/lib/boletoHtml");
  const { dadosTributarios } = await import("@/lib/tributario");
  const e = (await dadosTributarios()).empresa;
  const ts = await prisma.finTitulo.findMany({ where: { id: { in: ids.map(Number).filter(Boolean) }, tipo: "RECEBER" }, orderBy: { vencimento: "asc" } });
  const bs = [];
  for (const t of ts) if (t.nossoNumero) bs.push(await boletoDe(t));
  if (!bs.length) return null;
  const end = `${e.logradouro}, ${e.numero} - ${e.bairro} - ${e.municipio}/${e.uf} ${e.cep}${e.telefone ? ` - ${e.telefone}` : ""}`;
  return htmlBoletos(bs, { beneficiarioEndereco: end });
}

// retorno: confirma/rejeita a instrução ENVIADA do título (chamado por finRetorno)
export async function instrucaoDoRetorno(tituloId, ocorrencia) {
  const env = await prisma.boletoInstrucao.findMany({ where: { tituloId, status: "ENVIADA" }, orderBy: { id: "asc" } });
  if (!env.length) return null;
  if (REJEICAO.includes(ocorrencia)) return { i: env[0], rejeita: true };
  const i = env.find((x) => TIPOS[x.tipo]?.confirma.includes(ocorrencia));
  return i ? { i, rejeita: false } : null;
}
export async function aplicarInstrucaoRetorno(i, rejeita, texto) {
  await prisma.boletoInstrucao.update({ where: { id: i.id }, data: { status: rejeita ? "REJEITADA" : "CONFIRMADA", retornoTxt: String(texto || "").slice(0, 500) } });
  const cob = { BAIXA: "BAIXADO", SUSTAR: "BAIXADO", PROTESTO: "EM PROTESTO" }[i.tipo];
  if (!rejeita && cob) await prisma.finTitulo.update({ where: { id: i.tituloId }, data: { cobranca: cob } }).catch(() => null);
  if (rejeita) await prisma.finTitulo.update({ where: { id: i.tituloId }, data: { critica: `Banco rejeitou "${TIPOS[i.tipo]?.nome}": ${texto}`.slice(0, 500) } }).catch(() => null);
}
