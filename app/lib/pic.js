// v469 — PIC (pedido interno de compras) a partir do cruzamento com o estoque e OCs agrupadas por fornecedor
import { prisma } from "@/lib/prisma";
import { simularCruzamento, necessidade, ehAvulsa } from "@/lib/compras";
const juntaEnd = (o) => [[o.logradouro, o.numero].filter(Boolean).join(", "), o.complemento, o.bairro, [o.municipio, o.uf].filter(Boolean).join(" - "), o.cep ? `CEP ${o.cep}` : null].filter(Boolean).join(", ");

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const nomeForn = (f) => (f ? f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}` : null);

// gera o PIC com os itens que o estoque não atende (os marcados "compra" no cruzamento)
export async function gerarPic(quem) {
  const { artigos, atendidos, itens } = await simularCruzamento();
  const at = new Set(atendidos);
  const doCruz = itens.filter((i) => !at.has(i.id) && Object.keys(necessidade(i)).length);
  // v483 — itens reprovados no cruzamento (o operador mandou comprar mesmo havendo estoque)
  const reprov = (await prisma.compraItem.findMany({ where: { status: "REPROVADO" } })).filter((i) => Object.keys(necessidade(i)).length);
  const compra = [...doCruz, ...reprov];
  if (!compra.length) return { error: "Nenhum item para comprar: o estoque atende todo o levantamento." };
  // pedidos de origem por artigo
  const origem = {};
  for (const i of compra) for (const [a, q] of Object.entries(necessidade(i))) (origem[a] ||= []).push({ pedido: i.pedidoNumero, chave: i.chave, cliente: i.cliente, quantidade: r3(q), avulsa: ehAvulsa(i.pedidoNumero), reprovado: i.status === "REPROVADO" });
  const porArt = Object.fromEntries(artigos.map((a) => [String(a.artigoId), { ...a }]));
  for (const i of reprov) {
    for (const [a, q] of Object.entries(necessidade(i))) {
      if (!porArt[a]) { const d = (i.demanda || []).find((x) => String(x.equiparadoA || x.artigoId) === a) || {};
        porArt[a] = { artigoId: Number(a), nome: d.nome, cor: d.cor, codigo: d.codigo, largura: d.largura, unidade: d.unidade, embalagem: d.embalagem || null, fornecedorId: d.fornecedorId, comprar: 0, paraCompra: 0, sobra: 0 }; }
      porArt[a].comprar = r3((porArt[a].comprar || 0) + q); porArt[a].paraCompra = r3((porArt[a].paraCompra || 0) + q);
    }
  }
  const linhas = Object.values(porArt).filter((a) => a.comprar > 0 && origem[a.artigoId]);
  if (!linhas.length) return { error: "O que falta já está coberto pela sobra do estoque." };
  const arts = Object.fromEntries((await prisma.artigo.findMany({ where: { id: { in: linhas.map((a) => a.artigoId) } }, select: { id: true, fornecedorId: true, valorUnitario: true } })).map((a) => [a.id, a]));
  const pic = await prisma.pic.create({ data: { numero: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, criadoPorNome: quem || null } });
  const numero = `PIC ${String(pic.id).padStart(4, "0")}`;
  await prisma.pic.update({ where: { id: pic.id }, data: { numero } });
  for (const a of linhas) {
    const q = a.embalagem ? Math.ceil(a.comprar / a.embalagem - 1e-9) * a.embalagem : a.comprar;
    await prisma.picItem.create({ data: {
      picId: pic.id, artigoId: a.artigoId, quantidade: r3(q),
      fornecedorId: arts[a.artigoId]?.fornecedorId || a.fornecedorId || null,
      valorUnitario: arts[a.artigoId]?.valorUnitario ?? null,
      info: { nome: a.nome, cor: a.cor || null, codigo: a.codigo || null, largura: a.largura || null, unidade: a.unidade, embalagem: a.embalagem || null, demanda: a.paraCompra, sobra: a.sobra, pedidos: origem[a.artigoId] },
    } });
  }
  await prisma.compraItem.updateMany({ where: { id: { in: compra.map((i) => i.id) } }, data: { status: "PIC", picId: pic.id } });
  return { ok: true, id: pic.id, numero, itens: compra.length, artigos: linhas.length };
}

export async function listarPics() {
  const pics = await prisma.pic.findMany({ where: { status: { not: "CANCELADO" } }, orderBy: { id: "desc" }, take: 60,
    include: { itens: { orderBy: { id: "asc" }, include: { ocItens: { select: { ocId: true, oc: { select: { numero: true } } } } } } } });
  const fIds = [...new Set(pics.flatMap((p) => p.itens.map((i) => i.fornecedorId)).filter(Boolean))];
  const forn = Object.fromEntries((await prisma.fornecedor.findMany({ where: { id: { in: fIds } } })).map((f) => [f.id, nomeForn(f)]));
  return pics.map((p) => ({ id: p.id, numero: p.numero, data: p.data, status: p.status, criadoPorNome: p.criadoPorNome, obs: p.obs,
    itens: p.itens.map((i) => ({ id: i.id, artigoId: i.artigoId, quantidade: Number(i.quantidade), fornecedorId: i.fornecedorId, fornecedor: forn[i.fornecedorId] || null, fornecedoresCotacao: Array.isArray(i.fornecedoresCotacao) ? i.fornecedoresCotacao : [],
      valorUnitario: i.valorUnitario != null ? Number(i.valorUnitario) : null, info: i.info || {}, oc: i.ocItens[0] ? { id: i.ocItens[0].ocId, numero: i.ocItens[0].oc.numero } : null })) }));
}

// comprador preenche fornecedor, valor e quantidade: [{ id, fornecedorId, valorUnitario, quantidade }]
// v477 — picId opcional: itens de PICs diferentes na mesma gravação
export async function salvarItensPic(picId, itens) {
  const ids = (itens || []).map((x) => Number(x.id)).filter(Boolean);
  const l = await prisma.picItem.findMany({ where: picId ? { picId: Number(picId) } : { id: { in: ids } }, include: { ocItens: { select: { id: true } } } });
  const porId = Object.fromEntries(l.map((i) => [i.id, i]));
  for (const x of itens || []) {
    const i = porId[Number(x.id)]; if (!i || i.ocItens.length) continue;
    const q = num(x.quantidade);
    await prisma.picItem.update({ where: { id: i.id }, data: {
      fornecedorId: x.fornecedorId ? Number(x.fornecedorId) : null,
      ...(Array.isArray(x.fornecedoresCotacao) ? { fornecedoresCotacao: x.fornecedoresCotacao.filter((f) => f && f.id).slice(0, 4).map((f) => ({ id: Number(f.id), nome: String(f.nome || "") })) } : {}),   // v482
      valorUnitario: num(x.valorUnitario),
      ...(q != null && q > 0 ? { quantidade: r3(q) } : {}),
    } });
  }
  return { ok: true };
}

// v477 — OCs com itens de um ou vários PICs (os mesmos fornecedores viram uma OC só)
export async function gerarOcsItens(itemIds, quem) {
  const its = await prisma.picItem.findMany({ where: { id: { in: (itemIds || []).map(Number).filter(Boolean) } }, include: { ocItens: { select: { id: true } } } });
  const livres = its.filter((i) => !i.ocItens.length);
  const prontos = livres.filter((i) => i.fornecedorId && i.valorUnitario != null && Number(i.valorUnitario) > 0 && Number(i.quantidade) > 0);
  if (!prontos.length) return { error: "Preencha fornecedor e valor unitário dos itens para gerar as OCs." };
  const grupos = {};
  for (const i of prontos) (grupos[i.fornecedorId] ||= []).push(i);
  const ocs = [];
  for (const [fid, gi] of Object.entries(grupos)) {
    const pics = [...new Set(gi.map((i) => i.picId))];
    const oc = await prisma.ordemCompra.create({ data: { numero: `TMP-${Date.now()}-${fid}-${Math.random().toString(36).slice(2, 6)}`, fornecedorId: Number(fid), picId: pics.length === 1 ? pics[0] : null, criadoPorNome: quem || null,
      itens: { create: gi.map((i) => ({ artigoId: i.artigoId, picItemId: i.id, quantidade: i.quantidade, valorUnitario: i.valorUnitario })) } } });
    const numero = `OC ${String(oc.id).padStart(4, "0")}`;
    await prisma.ordemCompra.update({ where: { id: oc.id }, data: { numero } });
    for (const i of gi) await prisma.artigo.update({ where: { id: i.artigoId }, data: { valorUnitario: i.valorUnitario, fornecedorId: i.fornecedorId } }).catch(() => null);
    ocs.push({ id: oc.id, numero, itens: gi.length, pics: pics.length });
  }
  for (const pid of [...new Set(its.map((i) => i.picId))]) await fecharPicSeCompleto(pid);
  return { ok: true, ocs, faltam: livres.length - prontos.length };
}
// PIC com todos os itens em OC: PIC = OC, itens de compra = OC, avulsas completas = COMPRADA
async function fecharPicSeCompleto(picId) {
  const resto = await prisma.picItem.count({ where: { picId, ocItens: { none: {} } } });
  if (resto) return;
  await prisma.pic.update({ where: { id: picId }, data: { status: "OC" } });
  const its = await prisma.compraItem.findMany({ where: { picId }, select: { pedidoNumero: true } });
  await prisma.compraItem.updateMany({ where: { picId }, data: { status: "OC" } });
  for (const av of [...new Set(its.map((x) => x.pedidoNumero).filter(ehAvulsa))]) {
    const n = await prisma.compraItem.count({ where: { pedidoNumero: av, status: { in: ["LEVANTAMENTO", "PIC"] } } });
    if (!n) await prisma.compraAvulsa.updateMany({ where: { id: Number(av.slice(2)), status: "ABERTA" }, data: { status: "COMPRADA" } });
  }
}

// OCs: uma por fornecedor, com os itens do PIC que têm fornecedor e valor e ainda não estão em OC
export async function gerarOcs(picId, quem) {
  const pic = await prisma.pic.findUnique({ where: { id: Number(picId) }, include: { itens: { include: { ocItens: { select: { id: true } } } } } });
  if (!pic) return { error: "PIC não encontrado." };
  return gerarOcsItens(pic.itens.map((i) => i.id), quem);
}

// desfaz o PIC (antes de qualquer OC): os itens voltam ao levantamento
export async function cancelarPic(picId) {
  const pic = await prisma.pic.findUnique({ where: { id: Number(picId) }, include: { itens: { include: { ocItens: { select: { id: true } } } } } });
  if (!pic) return { error: "PIC não encontrado." };
  if (pic.itens.some((i) => i.ocItens.length)) return { error: "Já há OC gerada deste PIC." };
  await prisma.compraItem.updateMany({ where: { picId: pic.id }, data: { status: "LEVANTAMENTO", picId: null } });
  await prisma.pic.delete({ where: { id: pic.id } });
  return { ok: true };
}

export async function listarOcs() {
  const l = await prisma.ordemCompra.findMany({ orderBy: { id: "desc" }, take: 100, include: { fornecedor: true, itens: { include: { artigo: { select: { nome: true, cor: true, codigo: true, unidade: true } }, picItem: { select: { picId: true } } } } } });
  const piPorOc = {};
  for (const o of l) piPorOc[o.id] = [...new Set(o.itens.map((i) => i.picItem?.picId).filter(Boolean))];
  const picIds = [...new Set([...l.map((o) => o.picId), ...Object.values(piPorOc).flat()].filter(Boolean))];
  const pics = Object.fromEntries((await prisma.pic.findMany({ where: { id: { in: picIds } }, select: { id: true, numero: true } })).map((p) => [p.id, p.numero]));
  const cots = Object.fromEntries((await prisma.cotacao.findMany({ where: { id: { in: l.map((o) => o.cotacaoId).filter(Boolean) } }, select: { id: true, numero: true } })).map((c) => [c.id, c.numero]));
  return l.map((o) => ({ id: o.id, numero: o.numero, status: o.status, createdAt: o.createdAt, criadoPorNome: o.criadoPorNome, obs: o.obs,
    condicaoFaturamento: o.condicaoFaturamento, prazoFabrica: o.prazoFabrica, prazoTransportadora: o.prazoTransportadora, pic: (piPorOc[o.id].length ? piPorOc[o.id] : [o.picId]).map((x) => pics[x]).filter(Boolean).join(", ") || null,
    fornecedor: { id: o.fornecedor.id, nome: nomeForn(o.fornecedor), razaoSocial: o.fornecedor.razaoSocial, contato: o.fornecedor.contato || o.fornecedor.preposto, telefone: o.fornecedor.telefone || o.fornecedor.telefones, email: o.fornecedor.email, endereco: juntaEnd(o.fornecedor) },
    cotacao: cots[o.cotacaoId] || null, formaRecebimento: o.formaRecebimento, diasAposFaturamento: o.diasAposFaturamento,
    nfNumero: o.nfNumero, nfEmissao: o.nfEmissao ? o.nfEmissao.toISOString().slice(0, 10) : null,
    itens: o.itens.map((i) => ({ id: i.id, nome: i.artigo.nome, cor: i.artigo.cor, codigo: i.artigo.codigo, unidade: i.artigo.unidade, quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario) })),
    total: Math.round(o.itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valorUnitario), 0) * 100) / 100 }));
}
export async function salvarOc(b) {
  const o = await prisma.ordemCompra.findUnique({ where: { id: Number(b.id) } });
  if (!o) return { error: "OC não encontrada." };
  const dt = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null);
  await prisma.ordemCompra.update({ where: { id: o.id }, data: {
    ...(b.condicaoFaturamento !== undefined ? { condicaoFaturamento: String(b.condicaoFaturamento || "").trim() || null } : {}),
    ...(b.prazoFabrica !== undefined ? { prazoFabrica: dt(b.prazoFabrica) } : {}),
    ...(b.prazoTransportadora !== undefined ? { prazoTransportadora: dt(b.prazoTransportadora) } : {}),
    ...(b.obs !== undefined ? { obs: String(b.obs || "").trim() || null } : {}),
    ...(["ABERTA", "ENVIADA", "NF_EMITIDA", "RECEBIDA", "CANCELADA"].includes(b.status) ? { status: b.status } : {}),
    ...(b.formaRecebimento !== undefined ? { formaRecebimento: ["COLETA", "TRANSPORTADORA", "ENTREGA_PROPRIA"].includes(b.formaRecebimento) ? b.formaRecebimento : null } : {}),
    ...(b.diasAposFaturamento !== undefined ? { diasAposFaturamento: parseInt(b.diasAposFaturamento, 10) || null } : {}),
  } });
  // v479 — NF do fornecedor na OC: OC = NF emitida e os itens de compra dos artigos dela = NF
  if (b.nfNumero !== undefined) {
    const nf = String(b.nfNumero || "").trim();
    await prisma.ordemCompra.update({ where: { id: o.id }, data: nf
      ? { nfNumero: nf, nfEmissao: dt(b.nfEmissao), nfEm: new Date(), ...(["ABERTA", "ENVIADA"].includes(o.status) ? { status: "NF_EMITIDA" } : {}) }
      : { nfNumero: null, nfEmissao: null, nfEm: null, ...(o.status === "NF_EMITIDA" ? { status: "ENVIADA" } : {}) } });
    await statusNfItens(o.id);
  }
  return { ok: true };
}

// v479 — item de compra passa a "NF emitida" quando todos os artigos dele estão em OCs com NF (e volta a "OC" se a NF sair)
async function statusNfItens(ocId) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: ocId }, include: { itens: { include: { picItem: { select: { picId: true } } } } } });
  const picIds = [...new Set(oc.itens.map((i) => i.picItem?.picId).filter(Boolean))];
  for (const pid of picIds) {
    const ocis = await prisma.ocItem.findMany({ where: { picItem: { picId: pid } }, include: { oc: { select: { nfNumero: true, status: true } } } });
    const comNf = new Set(ocis.filter((x) => x.oc.nfNumero && x.oc.status !== "CANCELADA").map((x) => x.artigoId));
    const its = await prisma.compraItem.findMany({ where: { picId: pid, status: { in: ["OC", "NF"] } } });
    for (const it of its) {
      const arts = Object.keys(necessidade(it)).map(Number);
      const st = arts.length && arts.every((a) => comNf.has(a)) ? "NF" : "OC";
      if (st !== it.status) await prisma.compraItem.update({ where: { id: it.id }, data: { status: st } });
    }
  }
}
