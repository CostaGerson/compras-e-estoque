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

// v1193 — tamanho no fim da descrição do item da NF ("… - M")
const tamDe = (desc) => { const ps = String(desc || "").split(/\s+-\s+/); return ps.length > 1 ? ps[ps.length - 1].trim().toUpperCase() : ""; };
// quanto de cada item/tamanho já saiu em NF: produção = NFs casadas com o pedido (movimento fiscal);
// homologação = NF-e de teste autorizadas para o pedido (não mexem no faturamento)
async function jaFaturado(p, ambiente) {
  const { lerNfItens } = await import("@/lib/pedidos");
  const xmls = [];
  if (ambiente === "PRODUCAO") {
    const nfs = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
    const ids = nfs.map((x) => Number(x.fiscalNotaId)).filter(Boolean), chaves = nfs.map((x) => x.chave).filter((c) => /^\d{44}$/.test(String(c || "")));
    if (ids.length || chaves.length) xmls.push(...(await prisma.fiscalNota.findMany({ where: { OR: [{ id: { in: ids } }, { chave: { in: chaves } }] }, select: { xml: true, numero: true } })).map((x) => ({ xml: x.xml, numero: x.numero })));
  } else {
    xmls.push(...(await prisma.nfeEmissao.findMany({ where: { pedidoNumero: p.numero, ambiente: "HOMOLOGACAO", status: "AUTORIZADA" }, select: { xml: true, numero: true } })).map((x) => ({ xml: x.xml, numero: `${x.numero} (homologação)` })));
  }
  const m = {}, nfs = [];
  for (const x of xmls) {
    if (!x.xml) continue;
    nfs.push(String(x.numero));
    for (const i of lerNfItens(x.xml).itens) { const k = `${i.codigo}|${tamDe(i.descricao)}`; m[k] = (m[k] || 0) + (Number(i.qtd) || 0); }
  }
  return { m, nfs, semXml: (Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []).length > xmls.length && ambiente === "PRODUCAO" };
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
  let pcp = null;
  const ncms = await mapaNcm([...new Set(itensP.map((i) => i.codigo).filter(Boolean))]);
  const fat = await jaFaturado(p, emit.ambiente);
  const resto = { ...fat.m };   // consome o já faturado: primeiro o mesmo tamanho, depois a linha sem tamanho do código
  const itens = [];
  for (const it of itensP) {
    const preco = num(it.preco) || (num(it.total) && num(it.qtd) ? r2(num(it.total) / num(it.qtd)) : 0);
    const n = (it.codigo && ncms[it.codigo]) || ncmPeloNome(it.descricao);
    const grade = (it.grade || []).filter((g) => num(g.qtd) > 0);
    const linhas = grade.length ? grade.map((g) => ({ tam: g.tam, qtd: num(g.qtd) })) : [{ tam: null, qtd: num(it.qtd) }];
    for (const l of linhas) {
      if (!l.qtd) continue;
      const tam = String(l.tam || "").toUpperCase();
      let faturada = 0;
      for (const k of [`${it.codigo || ""}|${tam}`, `${it.codigo || ""}|`]) { const u = Math.min(resto[k] || 0, l.qtd - faturada); if (u > 0) { faturada += u; resto[k] -= u; } }
      itens.push({ codigo: it.codigo || "", tam: l.tam || "", descricao: l.tam ? `${it.descricao} - ${l.tam}` : it.descricao, ncm: n?.ncm || "", ncmFonte: n?.fonte || "", cfop, unidade: "UN",
        pedida: l.qtd, faturada, qtd: Math.max(0, l.qtd - faturada), valorUnit: preco });
    }
  }
  if (fat.nfs.length) avisos.push(`Já faturado neste pedido: NF ${fat.nfs.join(", ")}. As quantidades abaixo são o saldo; ajuste o que vai nesta nota.`);
  if (fat.semXml) avisos.push("Há NF casada com o pedido sem XML: o saldo por tamanho pode não descontá-la. Confira.");
  // peças concluídas na expedição (PCP) e ainda não faturadas: o casamento não deixa faturar além disso
  try { const { pecasDoPedidoInfo } = await import("@/lib/faturamentoCasamento"); const info = await pecasDoPedidoInfo(p); if (info.emPcp) pcp = { concluidas: info.concluidas, faturadas: info.faturadas, livres: info.livres, total: info.total }; } catch {}
  if (!itens.length) avisos.push("O pedido não tem itens com quantidade.");
  if (itens.length && !itens.some((i) => i.qtd > 0)) avisos.push("Tudo o que foi pedido já foi faturado.");
  if (itens.some((i) => !i.ncm)) avisos.push("Há itens sem NCM: preencha antes de emitir.");
  if (itens.some((i) => !i.valorUnit)) avisos.push("Há itens sem preço.");
  const total = r2(itens.reduce((s, i) => s + i.qtd * i.valorUnit, 0));
  const totalPedido = r2(itens.reduce((s, i) => s + i.pedida * i.valorUnit, 0)) || Number(p.total) || total;
  // duplicatas: a estrutura da condição (prazos e fração de cada parcela) aplicada ao valor desta nota.
  // A entrada já recebida é abatida das primeiras notas até acabar (como o movimento fiscal faz com o KM).
  const pg = p.pagamento?.parcelas?.length ? p.pagamento : condicaoParaPagamento(p.condicao, totalPedido, p.emissao);
  const entrada = num(p.entradaValor ?? pg?.entrada?.valor);
  const abatida = r2((Array.isArray(p.entradaAbatidaNfs) ? p.entradaAbatidaNfs : []).reduce((s2, x) => s2 + num(x.valor), 0));
  const entradaRestante = r2(Math.max(0, entrada - abatida));
  const parc = pg?.parcelas || [];
  const baseParc = Math.max(0.01, totalPedido - entrada);
  const fixo = parc.reduce((s2, x) => s2 + num(x.valor), 0), semValor = parc.filter((x) => !num(x.valor)).length;
  let estrutura = parc.map((x) => ({ dias: Number(x.dias) || 0, uteis: x.tipo === "UTEIS", fr: num(x.valor) ? num(x.valor) / baseParc : semValor ? Math.max(0, baseParc - fixo) / baseParc / semValor : 0 }));
  const somaFr = estrutura.reduce((s2, x) => s2 + x.fr, 0);
  estrutura = somaFr > 0 ? estrutura.map((x) => ({ ...x, fr: x.fr / somaFr })).filter((x) => x.fr > 0) : [];
  if (!estrutura.length) { estrutura = [{ dias: 30, uteis: false, fr: 1 }]; avisos.push("Sem condição de pagamento no pedido: deixei uma duplicata de 30 dias. Confira."); }
  const hoje = hojeBR();
  estrutura = estrutura.map((x) => ({ ...x, venc: somaDias(hoje, x.dias, x.uteis) }));
  const dup = duplicatas(total, entradaRestante, estrutura);
  // frete
  const ft = sem(p.freteTipo);
  const modFrete = p.formaEntrega === "PROPRIA" ? 3 : p.formaEntrega === "RETIRADA" ? 4 : /FOB/.test(ft) ? 1 : /CIF/.test(ft) ? 0 : p.formaEntrega === "TRANSPORTADORA" ? 0 : 3;
  const crt3 = String(emit.crt) === "3";
  const obs = [`Pedido ${p.numero}${p.oc ? ` - OC ${p.oc}` : ""}`, p.nfObs, crt3 ? "Empresa detentora de Regime Especial de Tributacao do Estado de Minas Gerais conforme e-PTA-RE 45.000047072-14" : "Documento emitido por ME ou EPP optante pelo Simples Nacional."].filter(Boolean).join(" | ");
  const indIEDest = dest.ie && !/ISENT/i.test(dest.ie) ? 1 : 9;
  if (fora && indIEDest === 9) avisos.push("Venda para fora de MG a não contribuinte exige DIFAL (ainda não feito no ERP): emita pelo KM.");
  return {
    pedido: { numero: p.numero, cliente: p.cliente, total: Number(p.total), condicao: p.condicao, oc: p.oc, entrada, entradaRestante, status: p.status }, estrutura, pcp,
    nota: { empresa, ambiente: emit.ambiente, natOp: nat?.nome || "VENDA DE PRODUCAO DO ESTABELECIMENTO", indPres: nat?.presenca ?? 9, indFinal: 1, dest, itens,
      pICMS: fora && indIEDest === 1 ? aliquotaIcms("MG", dest.uf) : 12, dup, tPag: "15", modFrete, volumes: { qVol: 1, esp: "FARDO", pesoB: "", pesoL: "" }, infCpl: obs },
    avisos,
  };
}

// duplicatas de uma nota de valor V: abate a entrada ainda não abatida e reparte o resto pela estrutura (a última fecha a conta)
export function duplicatas(V, entradaRestante, estrutura) {
  const liquido = r2(Math.max(0, V - Math.min(entradaRestante || 0, V)));
  let acum = 0;
  return estrutura.map((x, i) => { const v = i === estrutura.length - 1 ? r2(liquido - acum) : r2(liquido * x.fr); acum = r2(acum + v); return { venc: x.venc, valor: v }; }).filter((x) => x.valor > 0);
}

export async function emitirNfePedido(numero, nota, u) {
  const quem = u?.nome || null;
  const p = await prisma.pedidoVenda.findUnique({ where: { numero: String(numero) } });
  if (!p) return { error: `Pedido ${numero} não encontrado.` };
  // não passa do saldo de cada item/tamanho (pedido − já faturado)
  const rasc = await rascunhoNfePedido(numero, nota.empresa === "NORT" ? "NORT" : "MERIDIAN");
  if (!rasc.error) {
    for (const i of nota.itens || []) {
      const r = rasc.nota.itens.find((x) => x.codigo === i.codigo && String(x.tam || "") === String(i.tam || ""));
      if (r && num(i.qtd) > r.qtd + 0.0001) return { error: `${i.descricao}: ${num(i.qtd)} na nota, mas o saldo a faturar é ${r.qtd} (pedido ${r.pedida}, já faturado ${r.faturada}).` };
    }
  }
  const d = { ...(nota.dest || {}) };
  d.uf = String(d.uf || "MG").toUpperCase();
  d.codigoMunicipio = ibgeMunicipio(d.municipio, d.uf) || d.codigoMunicipio;
  if (d.uf && d.uf !== "MG" && !(d.ie && !/ISENT/i.test(d.ie))) return { error: "Venda para fora de MG a não contribuinte exige o DIFAL, que ainda não está no ERP." };
  for (const [k, rot] of [["logradouro", "endereço"], ["bairro", "bairro"], ["municipio", "município"], ["codigoMunicipio", "código IBGE do município"], ["cep", "CEP"]]) if (!String(d[k] || "").trim()) return { error: `Destinatário sem ${rot}.` };
  const itens = (nota.itens || []).filter((i) => num(i.qtd) > 0).map((i) => ({ tam: i.tam, codigo: i.codigo, descricao: i.descricao, ncm: dig(i.ncm), cfop: i.cfop, unidade: i.unidade || "UN",
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
  if (!itens.length) return { error: "Nenhum item com quantidade nesta nota." };
  const r = await emitir(n, { empresa: nota.empresa === "NORT" ? "NORT" : "MERIDIAN", ambiente: nota.ambiente, quem, origem: "PEDIDO", pedidoNumero: p.numero });
  // produção: a NF autorizada entra no movimento fiscal, gera as contas a receber e casa com o pedido (parcial ou completo)
  if (r.ok && r.nota?.ambiente === "PRODUCAO") {
    try { r.faturamento = await registrarNoFaturamento(r.nota.id, p, r2(Math.min(rasc.pedido?.entradaRestante || 0, Math.max(0, total - somaDup))), u); }
    catch (e) { r.faturamento = { erro: `NF autorizada, mas não entrou no faturamento: ${e.message}. Suba o XML em "Incluir faturamento".` }; }
  }
  return r;
}

async function registrarNoFaturamento(emissaoId, p, entradaAbate, u) {
  const x = await prisma.nfeEmissao.findUnique({ where: { id: emissaoId } });
  if (!x?.xmlProc) return { erro: "NF sem protocolo." };
  const { analisar, gravar } = await import("@/lib/fiscal");
  const a = await analisar([{ nome: `${x.chave}-procNFe.xml`, xml: x.xmlProc }]);
  const n = a.notas?.[0];
  if (!n) return { erro: a.erros?.join(" · ") || "XML não lido pelo movimento fiscal." };
  // as duplicatas da nota já vêm sem a entrada: desfaz o abatimento automático e registra o abatimento desta nota
  for (const pc of n.parcelas || []) if (pc.valorNf != null) { pc.valor = pc.valorNf; pc.marcado = true; }
  n.entradaPedido = entradaAbate > 0 ? { pedido: p.numero, pedidoId: p.id, abate: entradaAbate, aviso: `ENTRADA DO PEDIDO ${p.numero} ABATIDA: R$ ${entradaAbate.toFixed(2).replace(".", ",")}`, critica: null } : null;
  const g = await gravar([{ ...n, pedidoCasar: p.status === "ANDAMENTO" ? p.numero : undefined }], u);
  const res = Array.isArray(g) ? g[0] : g?.resultados?.[0] || g;
  return { ok: true, resultado: res };
}

export async function nfesDoPedido(numero) {
  const l = await prisma.nfeEmissao.findMany({ where: { pedidoNumero: String(numero) }, orderBy: { id: "desc" } });
  return l.map((x) => ({ id: x.id, empresa: x.empresa, ambiente: x.ambiente, serie: x.serie, numero: x.numero, status: x.status, cStat: x.cStat, xMotivo: x.xMotivo, protocolo: x.protocolo, valor: Number(x.valor), createdAt: x.createdAt }));
}
