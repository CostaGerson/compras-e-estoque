// v595 — lançamento de pedido sem o KM: salvar, efetivar (nº automático, pedido de venda, entrada e parcelas no contas a receber,
// FPP → Compras) e faturar (NF + previsão de entrega → restante das parcelas)
import { prisma } from "@/lib/prisma";
import { chaveEntrada } from "@/lib/pedidos";
import { itensDoPedido, demandaDoItem } from "@/lib/compras";
import { parametrosDoDetalhe, rtfTexto } from "@/lib/kmSync";
import {
  num, hojeISO, somaDias, proximoNumero, qtdGrade, conferirEntregas, parcelasCalc, textoCondicao, textoObsNf, paramFora, resumoFpp,
} from "@/lib/pedidoLanc";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const so = (s) => String(s || "").replace(/\D/g, "");
const up = (s) => (s == null ? null : String(s).trim().toUpperCase() || null);
const brData = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : null);
export const chaveParcela = (numero, i) => `PED|${numero}|PARC|${i}`;

// ---------- salvar (rascunho ou edição) ----------
const CAMPOS_PP = ["clienteNome", "clienteCnpj", "clienteIe", "clienteEndereco", "clienteContato", "oc", "vendedor", "obs", "nfObs"];
export async function salvarPp(id, b, quem) {
  const itens = Array.isArray(b.itens) ? b.itens : [];
  const interno = !!b.interno;
  const emissao = /^\d{4}-\d{2}-\d{2}$/.test(String(b.emissao || "")) ? b.emissao : hojeISO();
  const prazoDias = b.prazoDias === "" || b.prazoDias == null ? null : Math.max(0, Math.round(num(b.prazoDias)));
  const prazoTipo = b.prazoTipo === "UTEIS" ? "UTEIS" : "CORRIDOS";
  const despacho = prazoDias != null ? somaDias(emissao, prazoDias, prazoTipo) : null;
  const total = r2(itens.reduce((s, it) => s + qtdGrade(it.grade) * num(it.valorUnitario), 0));
  const data = {
    ...Object.fromEntries(CAMPOS_PP.map((k) => [k, b[k] ? String(b[k]).trim() || null : null])),
    interno, tipoPedido: interno ? "INTERNO" : "VENDA NORMAL", emissao, prazoDias, prazoTipo,
    prazoEntrega: prazoDias != null ? `${prazoDias} DIAS ${prazoTipo === "UTEIS" ? "ÚTEIS" : "CORRIDOS"}` : null,
    dtDespacho: brData(despacho),
    entregaModo: ["UNICA", "FRACIONADA", "TERCEIROS"].includes(b.entregaModo) ? b.entregaModo : "UNICA",
    entregas: b.entregaModo && b.entregaModo !== "UNICA" && Array.isArray(b.entregas) ? b.entregas : [],
    pagamento: interno ? null : (b.pagamento || null),
    condicaoPagamento: interno ? "INTERNO" : textoCondicao(b.pagamento, total) || null,
    valorTotal: total,
  };
  const itensData = itens.map((it) => ({
    tipoPecaNome: it.tipoPecaNome || null, codigo: up(it.codigo), descricao: up(it.descricao),
    quantidade: qtdGrade(it.grade), valorUnitario: num(it.valorUnitario) || null, valorTotal: r2(qtdGrade(it.grade) * num(it.valorUnitario)) || null,
    gradeJson: JSON.stringify(it.grade || []),
    parametrosJson: JSON.stringify(Object.fromEntries(Object.entries(it.parametros || {}).filter(([k]) => !paramFora(k)))),
    fotoBase64: it.fotoBase64 || null, fppId: it.fppId ? Number(it.fppId) : null, fppNumero: it.fppNumero != null ? Number(it.fppNumero) : null,
  }));
  let pp;
  if (id) {
    pp = await prisma.pp.findUnique({ where: { id: Number(id) }, select: { id: true } });
    if (!pp) throw new Error("Pedido não encontrado.");
    await prisma.$transaction([
      prisma.ppItem.deleteMany({ where: { ppId: pp.id } }),
      prisma.pp.update({ where: { id: pp.id }, data: { ...data, origem: null, itens: { create: itensData } } }),
    ]);
  } else {
    pp = await prisma.pp.create({ data: { ...data, itens: { create: itensData } }, select: { id: true } });
  }
  // anexos: os que ficaram na lista (por id) + os novos (com base64)
  if (Array.isArray(b.anexos)) {
    const manter = b.anexos.filter((a) => a.id).map((a) => Number(a.id));
    await prisma.ppAnexo.deleteMany({ where: { ppId: pp.id, id: { notIn: manter.length ? manter : [0] } } });
    for (const a of b.anexos.filter((x) => x.id && x.categoria)) await prisma.ppAnexo.updateMany({ where: { id: Number(a.id), ppId: pp.id }, data: { categoria: a.categoria } });
    for (const a of b.anexos.filter((x) => !x.id && x.base64)) {
      const b64 = String(a.base64).replace(/^data:[^,]+,/, "");
      await prisma.ppAnexo.create({ data: { ppId: pp.id, nome: String(a.nome || "anexo").slice(0, 200), tipo: a.tipo || null, categoria: a.categoria || "OUTRO",
        tamanho: Math.floor(b64.length * 3 / 4), base64: b64, criadoPorNome: quem || null } });
    }
  }
  return pp.id;
}

// ---------- conferência antes de efetivar ----------
export function criticas(pp) {
  const erros = [], avisos = [];
  const itens = (pp.itens || []).map((it) => ({ ...it, grade: safe(it.gradeJson, []) }));
  if (!String(pp.clienteNome || "").trim()) erros.push("Informe o cliente.");
  if (!pp.interno && so(pp.clienteCnpj).length < 11) avisos.push("Cliente sem CNPJ/CPF.");
  if (!itens.length || itens.every((it) => qtdGrade(it.grade) <= 0)) erros.push("Lance ao menos um item com grade.");
  itens.forEach((it, i) => {
    if (qtdGrade(it.grade) <= 0) erros.push(`Item ${i + 1}: grade vazia.`);
    if (!String(it.descricao || "").trim()) erros.push(`Item ${i + 1}: sem descrição.`);
    if (!pp.interno && !(num(it.valorUnitario) > 0)) erros.push(`Item ${i + 1}: sem valor unitário.`);
    if (!it.fppId) avisos.push(`Item ${i + 1}: sem FPP indexada (artigo e rendimento não vão para Compras).`);
  });
  if (pp.prazoDias == null) erros.push("Informe o prazo de entrega (dias).");
  const ce = conferirEntregas(itens, pp.entregas, pp.entregaModo);
  if (ce.semLocais) erros.push("Entrega fracionada/terceiros: cadastre os locais de entrega.");
  for (const x of ce.itens) erros.push(`Item ${x.idx + 1}: a soma das entregas não bate com a grade (${Object.entries(x.dif).map(([t, d]) => `${t} ${d > 0 ? "falta " + d : "sobra " + -d}`).join(", ")}).`);
  if (pp.entregaModo && pp.entregaModo !== "UNICA") (pp.entregas || []).forEach((e, i) => {
    if (!String(e.endereco || "").trim() || !String(e.local || "").trim()) erros.push(`Entrega ${i + 1}: informe endereço e nome do local.`);
    if (!e.documento) erros.push(`Entrega ${i + 1}: escolha o documento de entrega.`);
  });
  if (!pp.interno) {
    const c = parcelasCalc(pp.pagamento, Number(pp.valorTotal) || 0, { emissao: pp.emissao });
    if (!c.entrada && !c.parcelas.length) erros.push("Monte o prazo de pagamento (entrada e/ou parcelas).");
    else if (!c.ok) erros.push(`Prazo de pagamento não fecha com o total do pedido (diferença R$ ${c.dif.toFixed(2).replace(".", ",")}).`);
    if (c.entrada && !c.entrada.data) erros.push("Informe a data da entrada.");
  }
  return { erros, avisos };
}
const safe = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// ---------- contas a receber ----------
async function contaVenda() { return prisma.finConta.findUnique({ where: { codigo: "1111000" }, select: { id: true } }).catch(() => null); }
async function titulo({ chave, numero, cliente, cnpj, emissao, valor, venc, nome, numeroDoc, obs, quem }) {
  const venda = await contaVenda();
  const dados = { tipo: "RECEBER", titulo: nome, parceiro: cliente, documento: so(cnpj) || null, numeroDoc: numeroDoc || numero,
    emissao: emissao ? dUTC(emissao) : null, valor: r2(valor), vencimento: dUTC(venc), competencia: String(venc).slice(0, 7), previsao: false,
    rateio: venda ? [{ contaId: venda.id, pct: 100 }] : [], forma: "PEDIDO", observacao: obs };
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true, status: true } });
  if (ja && ja.status !== "ABERTO" && ja.status !== "CANCELADO") return { id: ja.id, mantido: true };   // já recebido: não mexe
  if (ja) return prisma.finTitulo.update({ where: { id: ja.id }, data: { ...dados, status: "ABERTO", atualizadoPorNome: quem } });
  return prisma.finTitulo.create({ data: { ...dados, chaveImport: chave, criadoPorNome: quem } });
}
async function cancelarTitulo(chave, quem) {
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave, status: "ABERTO" }, select: { id: true } });
  if (ja) await prisma.finTitulo.update({ where: { id: ja.id }, data: { status: "CANCELADO", atualizadoPorNome: quem } });
}

// itens do pedido de venda no formato do KM (codigo, descricao, qtd, preco, total, grade, parametros)
function itensPv(pp) {
  return (pp.itens || []).map((it) => {
    const grade = safe(it.gradeJson, []).filter((g) => num(g.qtd) > 0).map((g) => ({ tam: g.tam, qtd: num(g.qtd) }));
    const params = Object.entries(safe(it.parametrosJson, {})).filter(([k, v]) => !paramFora(k) && v)
      .map(([t, v]) => ({ t, v: typeof v === "object" ? [v.tipo, v.artigo, v.medida, v.forro ? `FORRO ${v.forro}` : ""].filter(Boolean).join(" · ") : String(v) }));
    const qtd = grade.reduce((s, g) => s + g.qtd, 0);
    return { codigo: it.codigo || null, descricao: it.descricao || "", qtd, preco: num(it.valorUnitario), total: r2(qtd * num(it.valorUnitario)), grade, parametros: params,
      fppId: it.fppId || null, fppNumero: it.fppNumero ?? null, tipoPeca: it.tipoPecaNome || null };
  });
}

// ---------- efetivar ----------
export async function efetivarPedido(id, quem) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(id) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp) throw new Error("Pedido não encontrado.");
  const { erros, avisos } = criticas(pp);
  if (erros.length) return { ok: false, erros, avisos };
  let numero = pp.numero;
  if (!numero) {
    for (let t = 0; t < 5 && !numero; t++) {
      const [a, b] = await Promise.all([prisma.pp.findMany({ where: { numero: { not: null } }, select: { numero: true } }), prisma.pedidoVenda.findMany({ select: { numero: true } })]);
      const n = proximoNumero([...a, ...b].map((x) => x.numero));
      try { await prisma.pp.update({ where: { id: pp.id }, data: { numero: n } }); numero = n; } catch { /* nº tomado ao mesmo tempo: tenta o próximo */ }
    }
    if (!numero) throw new Error("Não consegui gerar o número do pedido — tente de novo.");
  }
  const itens = itensPv(pp);
  const total = r2(itens.reduce((s, i) => s + i.total, 0));
  const qtd = itens.reduce((s, i) => s + i.qtd, 0);
  const despacho = pp.prazoDias != null ? somaDias(pp.emissao || hojeISO(), pp.prazoDias, pp.prazoTipo) : null;
  const pag = pp.interno ? null : pp.pagamento;
  const calc = pag ? parcelasCalc(pag, total, { emissao: pp.emissao }) : null;
  const nfObs = textoObsNf({ numero, oc: pp.oc, nfObs: pp.nfObs });
  const atual = await prisma.pedidoVenda.findUnique({ where: { numero }, select: { id: true, status: true, fonte: true } });
  if (atual && atual.fonte !== "SISTEMA") return { ok: false, erros: [`O pedido ${numero} veio do KM: as contas e o faturamento seguem pelo KM. Lance pedidos novos pelo botão "Novo pedido".`], avisos };
  const dados = {
    cliente: up(pp.clienteNome) || "SEM CLIENTE", cnpj: so(pp.clienteCnpj) || null, emissao: pp.emissao ? dUTC(pp.emissao) : dUTC(hojeISO()),
    despacho: despacho ? dUTC(despacho) : null, condicao: pp.condicaoPagamento || null, entradaValor: calc ? (calc.entrada?.valor || 0) : null,
    vendedor: up(pp.vendedor), tipoPedido: pp.interno ? "INTERNO" : "VENDA NORMAL", oc: up(pp.oc), total, qtd, itens, interno: !!pp.interno,
    obs: pp.obs || null, pagamento: pag || null, entregaModo: pp.entregaModo || "UNICA", entregas: pp.entregas || [], nfObs, fonte: "SISTEMA", atualizadoPorNome: quem,
  };
  const ped = atual
    ? await prisma.pedidoVenda.update({ where: { id: atual.id }, data: dados, select: { id: true } })
    : await prisma.pedidoVenda.create({ data: { numero, ...dados, status: "ANDAMENTO", criadoPorNome: quem }, select: { id: true } });
  await prisma.pp.update({ where: { id: pp.id }, data: { status: pp.status === "FATURADO" ? "FATURADO" : "LANCADO", efetivadoEm: new Date(), efetivadoPorNome: quem, valorTotal: total } });

  // contas a receber: entrada (na data informada) e parcelas contadas da emissão do pedido. NF/entrega: no faturamento
  const lancadas = [];
  const base = { numero, cliente: dados.cliente, cnpj: dados.cnpj, emissao: pp.emissao, quem };
  if (calc?.entrada) {
    await titulo({ ...base, chave: chaveEntrada(numero), valor: calc.entrada.valor, venc: calc.entrada.data, nome: `PEDIDO ${numero} - ENTRADA`,
      obs: `ENTRADA DO PEDIDO ${numero} · CONDIÇÃO ${dados.condicao || "—"}` });
    lancadas.push({ tipo: "ENTRADA", valor: calc.entrada.valor, data: calc.entrada.data });
  } else await cancelarTitulo(chaveEntrada(numero), quem);
  for (let i = 1; i <= 24; i++) {
    const x = calc?.parcelas?.[i - 1];
    if (x && x.base === "EMISSAO") {
      await titulo({ ...base, chave: chaveParcela(numero, i), valor: x.valor, venc: x.data, nome: `PEDIDO ${numero} - PARC ${i}/${x.de}`,
        numeroDoc: `${numero} · PARC ${i}/${x.de}`, obs: `PARCELA ${i}/${x.de} DO PEDIDO ${numero} · ${x.dias} ${x.tipo === "UTEIS" ? "DIAS ÚTEIS" : "DIAS"} DA EMISSÃO` });
      lancadas.push({ tipo: `PARC ${i}/${x.de}`, valor: x.valor, data: x.data });
    } else if (!(x && atual?.status === "FATURADO")) await cancelarTitulo(chaveParcela(numero, i), quem);   // parcela que saiu/mudou de base
  }

  // FPP indexada → item vai para Compras (levantamento) com a demanda de matéria-prima
  const compras = [];
  const chaves = itensDoPedido({ itens });
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    if (!it.fppId) continue;
    try {
      const fpp = await prisma.fpp.findUnique({ where: { id: Number(it.fppId) } });
      if (!fpp) continue;
      const ch = chaves[i].chave;
      const at = await prisma.compraItem.findUnique({ where: { pedidoNumero_chave: { pedidoNumero: numero, chave: ch } } });
      if (at && at.status !== "LEVANTAMENTO") continue;
      if (at && at.fppId === fpp.id && Number(at.quantidade) === it.qtd) continue;
      const demanda = await demandaDoItem(fpp, it.qtd);
      const d = { descricao: it.descricao, quantidade: it.qtd, valorUnitario: it.preco || null, cliente: dados.cliente, entrega: dados.despacho,
        fppId: fpp.id, fppNumero: fpp.numero, status: "LEVANTAMENTO", demanda, vinculadoPorNome: quem };
      if (at) await prisma.compraItem.update({ where: { id: at.id }, data: d });
      else await prisma.compraItem.create({ data: { pedidoNumero: numero, chave: ch, ...d } });
      compras.push(ch);
    } catch (e) { avisos.push(`Item ${i + 1}: não foi para Compras (${e.message}).`); }
  }
  return { ok: true, numero, pedidoId: ped.id, lancadas, compras, avisos, nfObs };
}

// ---------- faturar ----------
// NF emitida: lança as parcelas contadas da NF e da entrega (pede a previsão de entrega quando alguma usa a entrega)
export async function faturarPedido(id, { nf, emissaoNf, entrega } = {}, quem) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(id) }, select: { id: true, numero: true, efetivadoEm: true, interno: true } });
  if (!pp?.numero || !pp.efetivadoEm) throw new Error("Efetive o pedido antes de faturar.");
  const ped = await prisma.pedidoVenda.findUnique({ where: { numero: pp.numero } });
  if (!ped) throw new Error("Pedido de venda não encontrado.");
  const nfN = String(nf || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!nfN) throw new Error("Informe o número da NF.");
  const dNf = /^\d{4}-\d{2}-\d{2}$/.test(String(emissaoNf || "")) ? emissaoNf : hojeISO();
  const calc = ped.interno || !ped.pagamento ? null : parcelasCalc(ped.pagamento, Number(ped.total), { emissao: ped.emissao?.toISOString().slice(0, 10), nf: dNf, entrega });
  const precisaEntrega = !!calc?.parcelas.some((x) => x.base === "ENTREGA");
  if (precisaEntrega && !/^\d{4}-\d{2}-\d{2}$/.test(String(entrega || ""))) return { ok: false, pedirEntrega: true };
  const lancadas = [];
  for (const x of calc?.parcelas || []) {
    if (x.base === "EMISSAO") continue;
    await titulo({ chave: chaveParcela(ped.numero, x.n), numero: ped.numero, cliente: ped.cliente, cnpj: ped.cnpj, emissao: dNf, valor: x.valor, venc: x.data,
      nome: `NF ${nfN} - PEDIDO ${ped.numero} - PARC ${x.n}/${x.de}`, numeroDoc: `${nfN} · PARC ${x.n}/${x.de}`, quem,
      obs: `PARCELA ${x.n}/${x.de} DO PEDIDO ${ped.numero} · ${x.dias} ${x.tipo === "UTEIS" ? "DIAS ÚTEIS" : "DIAS"} DA ${x.base === "NF" ? "EMISSÃO DA NF" : "ENTREGA (PREVISÃO " + brData(entrega) + ")"}` });
    lancadas.push({ tipo: `PARC ${x.n}/${x.de}`, valor: x.valor, data: x.data, base: x.base });
  }
  const nfs = [...new Set([...String(ped.nfNumero || "").split(/[,\s]+/).filter(Boolean), nfN])].join(", ");
  await prisma.pedidoVenda.update({ where: { id: ped.id }, data: { status: "FATURADO", nfNumero: nfs, faturadoEm: dUTC(dNf),
    ...(entrega ? { entregaPrevista: dUTC(entrega) } : {}), atualizadoPorNome: quem } });
  await prisma.pp.update({ where: { id: pp.id }, data: { status: "FATURADO" } });
  return { ok: true, lancadas };
}

// ---------- catálogo de itens do KM ----------
// KmProduto (enviado pelo agente) + itens dos pedidos que já vieram do KM (código, descrição e parâmetros de produção)
export async function catalogoItens(q, max = 15) {
  const t = String(q || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  if (t.length < 2) return [];
  const palavras = t.split(/\s+/).filter(Boolean);
  const casa = (s) => { const x = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(); return palavras.every((w) => x.includes(w)); };
  const out = new Map();
  const doKm = await prisma.kmProduto.findMany({ where: { AND: palavras.map((w) => ({ OR: [{ codigo: { contains: w, mode: "insensitive" } }, { nome: { contains: w, mode: "insensitive" } }] })) },
    orderBy: [{ usos: "desc" }, { nome: "asc" }], take: max }).catch(() => []);
  for (const p of doKm) out.set(p.codigo, { codigo: p.codigo, descricao: p.nome, parametros: (Array.isArray(p.parametros) ? p.parametros : []).filter((x) => !paramFora(x.t)), preco: p.preco != null ? Number(p.preco) : null, origem: "KM" });
  if (out.size < max) {
    const peds = await prisma.pedidoVenda.findMany({ where: { OR: [{ fonte: null }, { fonte: { not: "SISTEMA" } }] }, select: { itens: true, emissao: true }, orderBy: { emissao: "desc" }, take: 1500 });
    for (const p of peds) for (const it of Array.isArray(p.itens) ? p.itens : []) {
      const cod = String(it.codigo || "").trim();
      if (!cod || out.has(cod) || !(casa(cod) || casa(it.descricao) || casa(it.descricaoPP))) continue;
      out.set(cod, { codigo: cod, descricao: String(it.descricaoPP || it.descricao || "").toUpperCase(), parametros: (it.parametros || []).filter((x) => x?.t && !paramFora(x.t)),
        preco: it.preco ?? null, origem: "PEDIDO KM" });
      if (out.size >= max) break;
    }
  }
  return [...out.values()].slice(0, max);
}

// agente do PC → KmProduto
export async function sincronizarProdutosKm(lista) {
  const l = (Array.isArray(lista) ? lista : []).filter((x) => x && String(x.codigo || "").trim());
  const res = { recebidos: l.length, gravados: 0, erros: [] };
  const agora = new Date();
  for (let i = 0; i < l.length; i += 200) {
    const ops = l.slice(i, i + 200).map((p) => {
      const codigo = String(p.codigo).trim();
      const nome = String(p.nome || p.descricao || codigo).replace(/\s+/g, " ").trim().toUpperCase();
      const detalhe = p.detalhe ? rtfTexto(p.detalhe).slice(0, 8000) : null;
      const data = { kmId: Number.isFinite(Number(p.id)) ? Number(p.id) : null, nome, detalhe, parametros: p.detalhe ? parametrosDoDetalhe(p.detalhe) : [],
        preco: Number.isFinite(Number(p.preco)) && p.preco != null ? Number(p.preco) : null, usos: Number(p.usos) || 0, kmSyncEm: agora };
      return prisma.kmProduto.upsert({ where: { codigo }, create: { codigo, ...data }, update: data });
    });
    try { await prisma.$transaction(ops); res.gravados += ops.length; } catch (e) { if (res.erros.length < 10) res.erros.push(String(e.message).slice(0, 200)); }
  }
  await prisma.finConfig.upsert({ where: { chave: "KM_PRODUTOS_SYNC" }, update: { valor: JSON.stringify({ em: agora.toISOString(), ...res }) },
    create: { chave: "KM_PRODUTOS_SYNC", valor: JSON.stringify({ em: agora.toISOString(), ...res }) } });
  return res;
}

// FPPs para indexar no item (busca por nº, item, nome comercial ou cliente; as do cliente primeiro)
export async function buscarFpps(q, cliente, max = 12) {
  const t = String(q || "").trim();
  const n = Number(t.replace(/\D/g, ""));
  const lista = await prisma.fpp.findMany({ orderBy: { createdAt: "desc" }, take: 3000,
    select: { id: true, numero: true, tipo: true, item: true, nomeComercial: true, clienteNome: true, valorProposto: true, entradas: true, resultados: true, createdAt: true } });
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const pal = norm(t).split(/\s+/).filter(Boolean);
  const cli = norm(cliente).split(/\s+/).filter((w) => w.length > 2).slice(0, 2);
  const doCli = (f) => cli.length && cli.every((w) => norm(f.clienteNome).includes(w));
  const ok = (f) => !pal.length || (/^\d+$/.test(t) && f.numero === n) || pal.every((w) => norm([f.numero, f.item, f.nomeComercial, f.clienteNome].join(" ")).includes(w));
  return lista.filter((f) => ok(f) && (pal.length || doCli(f))).sort((a, b) => (doCli(b) ? 1 : 0) - (doCli(a) ? 1 : 0)).slice(0, max).map(resumoFpp);
}
