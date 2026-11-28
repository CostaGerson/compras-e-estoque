// v1192 — NF-e a partir do pedido de venda: monta o rascunho (cliente, itens pela grade, NCM, CFOP, duplicatas,
//   frete e observações) para conferir na tela e emite pela SEFAZ-MG (lib/nfeEmissao).
import { prisma } from "@/lib/prisma";
import { dadosTributarios, naturezaPara, CLASSES_NCM } from "@/lib/tributario";
import { aliquotaIcms } from "@/lib/icmsInterestadual";
import { condicaoParaPagamento } from "@/lib/lancamentoSkill";
import { emitir } from "@/lib/nfeEmissao";
import IBGE from "@/lib/municipiosIbge.json";

// código IBGE pelo nome do município + UF (tabela IBGE, 5.570 municípios)
export const ibgeMunicipio = (municipio, uf) => IBGE[String(uf || "").toUpperCase()]?.[String(municipio || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "")] || "";

const dig = (s) => String(s || "").replace(/\D/g, "");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { if (v === "" || v == null) return 0; const s = String(v).trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
function somaDias(iso, dias, uteis) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (!uteis) { d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); }
  let n = dias; while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); if (![0, 6].includes(d.getUTCDay())) n--; }
  return d.toISOString().slice(0, 10);
}
// NCM: item padrão (código do KM) → última NF de saída com o mesmo código → classe pelo nome da peça
async function mapaNcm(codigos) {
  const m = {};
  const ip = await prisma.itemPadrao.findMany({ where: { codigo: { in: codigos }, ncm: { not: null } }, select: { codigo: true, ncm: true } }).catch(() => []);
  for (const x of ip) if (dig(x.ncm).length === 8) m[x.codigo] = { ncm: dig(x.ncm), fonte: "item padrão" };
  if (codigos.some((c) => !m[c])) {
    const nfs = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", temXml: true }, orderBy: { id: "desc" }, take: 250, select: { xml: true } }).catch(() => []);
    for (const n of nfs) for (const [, cp, ncm] of String(n.xml || "").matchAll(/<cProd>([^<]+)<\/cProd>[\s\S]*?<NCM>(\d{8})<\/NCM>/g)) if (!m[cp]) m[cp] = { ncm, fonte: "NF anterior" };
  }
  return m;
}
const CLASSE_ALIAS = { CALCA: "CALÇA", "GUARDA PO": "GUARDA-PÓ", SUETER: "SUÉTER", BONE: "BONÉ", LENCO: "LENÇO", BLUSAO: "BLUSÃO DE FRIO", REGATA: "CAMISETA", MOLETOM: "AGASALHO", CORTA: "JAQUETA" };
function ncmPeloNome(desc) {
  const d = sem(desc);
  for (const [cl, ncm] of CLASSES_NCM) if (d.includes(sem(cl))) return { ncm, fonte: `classe ${cl}` };
  for (const [k, cl] of Object.entries(CLASSE_ALIAS)) if (d.includes(k)) { const c = CLASSES_NCM.find((x) => x[0] === cl); if (c) return { ncm: c[1], fonte: `classe ${cl}` }; }
  return null;
}

export async function rascunhoNfePedido(numero, empresa = "MERIDIAN") {
  const p = await prisma.pedidoVenda.findUnique({ where: { numero: String(numero) } });
  if (!p) return { error: `Pedido ${numero} não encontrado.` };
  const t = await dadosTributarios();
  const emit = t.empresas[empresa] || t.empresas.MERIDIAN;
  const avisos = [];
  // destinatário pelo CNPJ do pedido
  const doc = dig(p.cnpj);
  let c = null;
  if (doc) {
    c = await prisma.cliente.findFirst({ where: { cnpj: { in: [doc, p.cnpj].filter(Boolean) } } }).catch(() => null);
    if (!c) { const h = (await prisma.cliente.findMany({ where: { cnpj: { not: null } }, select: { id: true, cnpj: true } })).find((x) => dig(x.cnpj) === doc); if (h) c = await prisma.cliente.findUnique({ where: { id: h.id } }); }
  }
  if (!doc) avisos.push("O pedido está sem CNPJ/CPF do cliente.");
  else if (!c) avisos.push("Cliente não encontrado no cadastro: preencha o endereço abaixo.");
  const dest = { cnpj: doc.length === 14 ? doc : "", cpf: doc.length === 11 ? doc : "", nome: c?.razaoSocial || p.cliente, ie: c?.inscricaoEstadual || "",
    logradouro: c?.logradouro || "", numero: c?.numero || "", complemento: c?.complemento || "", bairro: c?.bairro || "", municipio: c?.municipio || "",
    uf: (c?.uf || "MG").toUpperCase(), cep: c?.cep || "", codigoMunicipio: ibgeMunicipio(c?.municipio, c?.uf),
    email: c?.emailNf || "", telefone: dig(c?.telefones).slice(0, 11) };
  if (!dest.codigoMunicipio && c) avisos.push(`Município "${c.municipio || ""}/${c.uf || ""}" do cliente não encontrado na tabela do IBGE: confira o nome.`);
  // natureza e CFOP
  const nat = await naturezaPara("VENDA");
  const fora = dest.uf !== "MG";
  const cfop = (fora ? nat?.cfopForaEstado : nat?.cfopEstado) || (fora ? "6101" : "5101");
  // itens: uma linha por tamanho da grade (como o KM), código do item e " - TAM" na descrição
  const itensP = Array.isArray(p.itens) ? p.itens : [];
  const ncms = await mapaNcm([...new Set(itensP.map((i) => i.codigo).filter(Boolean))]);
  const itens = [];
  for (const it of itensP) {
    const preco = num(it.preco) || (num(it.total) && num(it.qtd) ? r2(num(it.total) / num(it.qtd)) : 0);
    const n = (it.codigo && ncms[it.codigo]) || ncmPeloNome(it.descricao);
    const grade = (it.grade || []).filter((g) => num(g.qtd) > 0);
    const linhas = grade.length ? grade.map((g) => ({ tam: g.tam, qtd: num(g.qtd) })) : [{ tam: null, qtd: num(it.qtd) }];
    for (const l of linhas) {
      if (!l.qtd) continue;
      itens.push({ codigo: it.codigo || "", descricao: l.tam ? `${it.descricao} - ${l.tam}` : it.descricao, ncm: n?.ncm || "", ncmFonte: n?.fonte || "", cfop, unidade: "UN", qtd: l.qtd, valorUnit: preco });
    }
  }
  if (!itens.length) avisos.push("O pedido não tem itens com quantidade.");
  if (itens.some((i) => !i.ncm)) avisos.push("Há itens sem NCM: preencha antes de emitir.");
  if (itens.some((i) => !i.valorUnit)) avisos.push("Há itens sem preço.");
  const total = r2(itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0));
  // duplicatas pela condição do pedido (a entrada já recebida sai das duplicatas)
  const pg = p.pagamento?.parcelas?.length ? p.pagamento : condicaoParaPagamento(p.condicao, total, p.emissao);
  const entrada = num(p.entradaValor ?? pg?.entrada?.valor);
  const hoje = hojeBR();
  const parc = (pg?.parcelas || []);
  const livre = r2(total - entrada - parc.reduce((s, x) => s + num(x.valor), 0));
  const semValor = parc.filter((x) => !num(x.valor)).length;
  let dup = parc.map((x) => ({ venc: somaDias(hoje, Number(x.dias) || 0, x.tipo === "UTEIS"), valor: num(x.valor) || (semValor ? r2(livre / semValor) : 0) }));
  if (dup.length) { const dif = r2(total - entrada - dup.reduce((s, x) => s + x.valor, 0)); dup[dup.length - 1].valor = r2(dup[dup.length - 1].valor + dif); }
  dup = dup.filter((x) => x.valor > 0);
  if (!dup.length && total - entrada > 0) { dup = [{ venc: somaDias(hoje, 30), valor: r2(total - entrada) }]; avisos.push("Sem condição de pagamento no pedido: deixei uma duplicata de 30 dias. Confira."); }
  // frete
  const ft = sem(p.freteTipo);
  const modFrete = p.formaEntrega === "PROPRIA" ? 3 : p.formaEntrega === "RETIRADA" ? 4 : /FOB/.test(ft) ? 1 : /CIF/.test(ft) ? 0 : p.formaEntrega === "TRANSPORTADORA" ? 0 : 3;
  const crt3 = String(emit.crt) === "3";
  const obs = [`Pedido ${p.numero}${p.oc ? ` - OC ${p.oc}` : ""}`, p.nfObs, crt3 ? "Empresa detentora de Regime Especial de Tributacao do Estado de Minas Gerais conforme e-PTA-RE 45.000047072-14" : "Documento emitido por ME ou EPP optante pelo Simples Nacional."].filter(Boolean).join(" | ");
  const indIEDest = dest.ie && !/ISENT/i.test(dest.ie) ? 1 : 9;
  if (fora && indIEDest === 9) avisos.push("Venda para fora de MG a não contribuinte exige DIFAL (ainda não feito no ERP): emita pelo KM.");
  return {
    pedido: { numero: p.numero, cliente: p.cliente, total: Number(p.total), condicao: p.condicao, oc: p.oc, entrada },
    nota: { empresa, ambiente: emit.ambiente, natOp: nat?.nome || "VENDA DE PRODUCAO DO ESTABELECIMENTO", indPres: nat?.presenca ?? 9, indFinal: 1, dest, itens,
      pICMS: fora && indIEDest === 1 ? aliquotaIcms("MG", dest.uf) : 12, dup, tPag: "15", modFrete, volumes: { qVol: 1, esp: "FARDO", pesoB: "", pesoL: "" }, infCpl: obs },
    avisos,
  };
}

export async function emitirNfePedido(numero, nota, quem) {
  const p = await prisma.pedidoVenda.findUnique({ where: { numero: String(numero) } });
  if (!p) return { error: `Pedido ${numero} não encontrado.` };
  const d = { ...(nota.dest || {}) };
  d.uf = String(d.uf || "MG").toUpperCase();
  d.codigoMunicipio = ibgeMunicipio(d.municipio, d.uf) || d.codigoMunicipio;
  if (d.uf && d.uf !== "MG" && !(d.ie && !/ISENT/i.test(d.ie))) return { error: "Venda para fora de MG a não contribuinte exige o DIFAL, que ainda não está no ERP." };
  for (const [k, rot] of [["logradouro", "endereço"], ["bairro", "bairro"], ["municipio", "município"], ["codigoMunicipio", "código IBGE do município"], ["cep", "CEP"]]) if (!String(d[k] || "").trim()) return { error: `Destinatário sem ${rot}.` };
  const itens = (nota.itens || []).filter((i) => num(i.qtd) > 0).map((i) => ({ codigo: i.codigo, descricao: i.descricao, ncm: dig(i.ncm), cfop: i.cfop, unidade: i.unidade || "UN",
    qtd: num(i.qtd), valorUnit: num(i.valorUnit), desconto: num(i.desconto), pICMS: num(nota.pICMS) || 12, xPed: p.oc ? String(p.oc).slice(0, 15) : undefined }));
  const total = r2(itens.reduce((s, i) => s + r2(i.qtd * i.valorUnit) - i.desconto, 0));
  const dup = (nota.dup || []).map((x) => ({ venc: x.venc, valor: num(x.valor) })).filter((x) => x.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.venc));
  const somaDup = r2(dup.reduce((s, x) => s + x.valor, 0));
  if (somaDup > total + 0.01) return { error: `As duplicatas (R$ ${somaDup.toFixed(2)}) passam do total da nota (R$ ${total.toFixed(2)}).` };
  const aprazo = dup.some((x) => x.venc > hojeBR());
  const n = {
    natOp: nota.natOp, indPres: Number(nota.indPres ?? 9), indFinal: Number(nota.indFinal ?? 1), dest: d, itens,
    modFrete: Number(nota.modFrete ?? 9), volumes: nota.volumes?.qVol ? nota.volumes : null, infCpl: nota.infCpl,
    dup, pag: [{ indPag: aprazo ? 1 : 0, tPag: nota.tPag || "15", vPag: total }],
  };
  return emitir(n, { empresa: nota.empresa === "NORT" ? "NORT" : "MERIDIAN", ambiente: nota.ambiente, quem, origem: "PEDIDO", pedidoNumero: p.numero });
}

export async function nfesDoPedido(numero) {
  const l = await prisma.nfeEmissao.findMany({ where: { pedidoNumero: String(numero) }, orderBy: { id: "desc" } });
  return l.map((x) => ({ id: x.id, empresa: x.empresa, ambiente: x.ambiente, serie: x.serie, numero: x.numero, status: x.status, cStat: x.cStat, xMotivo: x.xMotivo, protocolo: x.protocolo, valor: Number(x.valor), createdAt: x.createdAt }));
}
