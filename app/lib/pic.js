// v469 — PIC (pedido interno de compras) a partir do cruzamento com o estoque e OCs agrupadas por fornecedor
import { prisma } from "@/lib/prisma";
import { simularCruzamento, necessidade, ehAvulsa, pedidoDoItemAvulsa } from "@/lib/compras";
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
  // v484 — situação das cotações de cada item do PIC (valor, não tem, aguardando)
  const cots = await prisma.cotacao.findMany({ where: { status: { not: "CANCELADA" } }, select: { numero: true, fornecedorNome: true, status: true, itens: true } });
  const cotPorItem = {};
  for (const c of cots) for (const i of Array.isArray(c.itens) ? c.itens : []) for (const pid of i.picItemIds || [])
    (cotPorItem[pid] ||= []).push({ numero: c.numero, fornecedor: c.fornecedorNome, situacao: i.naoTem ? "NAO_TEM" : i.valorUnitario != null ? "VALOR" : "AGUARDANDO", valor: i.valorUnitario ?? null });
  return pics.map((p) => ({ id: p.id, numero: p.numero, data: p.data, status: p.status, criadoPorNome: p.criadoPorNome, obs: p.obs,
    itens: p.itens.map((i) => ({ id: i.id, artigoId: i.artigoId, quantidade: Number(i.quantidade), fornecedorId: i.fornecedorId, fornecedor: forn[i.fornecedorId] || null, fornecedoresCotacao: Array.isArray(i.fornecedoresCotacao) ? i.fornecedoresCotacao : [],
      cotacoes: cotPorItem[i.id] || [], semCotacao: !!(cotPorItem[i.id]?.length && cotPorItem[i.id].every((x) => x.situacao === "NAO_TEM")),
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
  const cotL = await prisma.cotacao.findMany({ where: { OR: [{ id: { in: l.map((o) => o.cotacaoId).filter(Boolean) } }, { ocId: { in: l.map((o) => o.id) } }] }, select: { id: true, numero: true, ocId: true } });   // v488
  const cotsDaOc = (o) => [...new Set(cotL.filter((c) => c.ocId === o.id || c.id === o.cotacaoId).map((c) => c.numero))].sort().join(", ") || null;
  const rotas = await rotasDeColeta(l);   // v486
  const fnL = await prisma.fiscalNota.findMany({ where: { ocId: { in: l.map((o) => o.id) } }, select: { id: true, ocId: true, numero: true, emissao: true, valor: true, temXml: true, temPdf: true, acao: true, parcelas: true, parceiro: true }, orderBy: { emissao: "asc" } });   // v494
  const arqs = await prisma.ocArquivo.findMany({ where: { ocId: { in: l.map((o) => o.id) } }, select: { id: true, ocId: true, tipo: true, nome: true, tamanho: true, createdAt: true }, orderBy: { id: "asc" } });
  return l.map((o) => ({ id: o.id, numero: o.numero, status: o.status, createdAt: o.createdAt, criadoPorNome: o.criadoPorNome, obs: o.obs,
    condicaoFaturamento: o.condicaoFaturamento, prazoFabrica: o.prazoFabrica, prazoTransportadora: o.prazoTransportadora, pic: (piPorOc[o.id].length ? piPorOc[o.id] : [o.picId]).map((x) => pics[x]).filter(Boolean).join(", ") || null,
    fornecedor: { id: o.fornecedor.id, nome: nomeForn(o.fornecedor), razaoSocial: o.fornecedor.razaoSocial, contato: o.fornecedor.contato || o.fornecedor.preposto, telefone: o.fornecedor.telefone || o.fornecedor.telefones, email: o.fornecedor.email, endereco: juntaEnd(o.fornecedor) },
    cotacao: cotsDaOc(o), rota: rotas[o.id] || null, arquivos: arqs.filter((a) => a.ocId === o.id),
    entrega: entregaDaOc(o, rotas[o.id]), previsaoEntrega: o.previsaoEntrega ? o.previsaoEntrega.toISOString().slice(0, 10) : null,   // v497
    nfs: fnL.filter((n) => n.ocId === o.id).map((n) => ({ id: n.id, numero: n.numero, emissao: n.emissao?.toISOString().slice(0, 10) || null, valor: Number(n.valor), temXml: n.temXml, temPdf: n.temPdf, acao: n.acao, contas: (Array.isArray(n.parcelas) ? n.parcelas : []).length, parceiro: n.parceiro })), formaRecebimento: o.formaRecebimento, diasAposFaturamento: o.diasAposFaturamento,
    nfNumero: o.nfNumero, nfEmissao: o.nfEmissao ? o.nfEmissao.toISOString().slice(0, 10) : null,
    itens: o.itens.map((i) => ({ id: i.id, nome: i.artigo.nome, cor: i.artigo.cor, codigo: i.artigo.codigo, unidade: i.artigo.unidade, quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario) })),
    total: Math.round(o.itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valorUnitario), 0) * 100) / 100 }));
}
export async function salvarOc(b) {
  const o = await prisma.ordemCompra.findUnique({ where: { id: Number(b.id) } });
  if (!o) return { error: "OC não encontrada." };
  const dt = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null);
  // v487 — itens da OC (quantidade e valor unitário): atualiza o item do PIC, o preço do artigo e a cotação de origem
  if (Array.isArray(b.itens)) {
    if (["RECEBIDA", "CANCELADA"].includes(o.status)) return { error: "OC recebida ou cancelada não pode ser alterada." };
    const its = await prisma.ocItem.findMany({ where: { ocId: o.id } });
    for (const x of b.itens) {
      const i = its.find((y) => y.id === Number(x.id)); if (!i) continue;
      const q = num(x.quantidade), v = num(x.valorUnitario);
      if (!(q > 0) || !(v > 0)) return { error: "Quantidade e valor unitário precisam ser maiores que zero." };
      await prisma.ocItem.update({ where: { id: i.id }, data: { quantidade: r3(q), valorUnitario: v } });
      if (i.picItemId) await prisma.picItem.update({ where: { id: i.picItemId }, data: { quantidade: r3(q), valorUnitario: v } }).catch(() => null);
      await prisma.artigo.update({ where: { id: i.artigoId }, data: { valorUnitario: v } }).catch(() => null);
    }
  }
  await prisma.ordemCompra.update({ where: { id: o.id }, data: {
    ...(b.condicaoFaturamento !== undefined ? { condicaoFaturamento: String(b.condicaoFaturamento || "").trim() || null } : {}),
    ...(b.prazoFabrica !== undefined ? { prazoFabrica: dt(b.prazoFabrica) } : {}),
    ...(b.prazoTransportadora !== undefined ? { prazoTransportadora: dt(b.prazoTransportadora) } : {}),
    ...(b.previsaoEntrega !== undefined ? { previsaoEntrega: dt(b.previsaoEntrega) } : {}),   // v497
    ...(b.obs !== undefined ? { obs: String(b.obs || "").trim() || null } : {}),
    ...(["ABERTA", "ENVIADA", "NF_EMITIDA", "RECEBIDA", "CANCELADA"].includes(b.status) ? { status: b.status } : {}),
    ...(b.formaRecebimento !== undefined ? { formaRecebimento: ["COLETA", "TRANSPORTADORA", "ENTREGA_PROPRIA"].includes(b.formaRecebimento) ? b.formaRecebimento : null } : {}),
    ...(b.diasAposFaturamento !== undefined ? { diasAposFaturamento: parseInt(b.diasAposFaturamento, 10) || null } : {}),
  } });
  await sincronizarCotacaoDaOc(o.id).catch((e) => console.log("oc→cotação:", e.message));   // v487
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
export async function statusNfItens(ocId) {
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

// v486 — rota de coleta de cada OC (pelo vínculo ocId ou pelo "COLETA OC 000x" no o que fazer)
export async function rotasDeColeta(ocs) {
  if (!ocs.length) return {};
  const sel = { id: true, ocId: true, tarefa: true, data: true, status: true, blocoId: true, concluidaEm: true, destinoTipo: true, destinoId: true, createdAt: true };
  const ds = await prisma.rotaDemanda.findMany({ where: { status: { not: "CANCELADA" }, OR: [{ ocId: { in: ocs.map((o) => o.id) } }, ...ocs.map((o) => ({ tarefa: { contains: `COLETA ${o.numero}`, mode: "insensitive" } }))] }, select: sel, orderBy: { id: "desc" } });
  // v499 — coleta criada à mão (sem "COLETA OC x"): demanda de coleta no mesmo fornecedor, criada depois da OC
  const fIds = [...new Set(ocs.filter((o) => o.fornecedorId && o.formaRecebimento === "COLETA").map((o) => o.fornecedorId))];
  const porForn = fIds.length ? await prisma.rotaDemanda.findMany({ where: { status: { not: "CANCELADA" }, objetivo: "COLETA", destinoTipo: "FORNECEDOR", destinoId: { in: fIds }, ocId: null }, select: sel, orderBy: { data: "asc" } }) : [];
  const out = {}, usados = new Set();
  const fmt = (d) => ({ id: d.id, data: d.data.toISOString().slice(0, 10), status: d.status, blocoId: d.blocoId, concluidaEm: d.concluidaEm });
  for (const o of ocs) {
    const d = ds.find((x) => x.ocId === o.id) || ds.find((x) => String(x.tarefa || "").toUpperCase().includes(`COLETA ${o.numero}`.toUpperCase()));
    if (d) { out[o.id] = fmt(d); usados.add(d.id); }
  }
  for (const o of [...ocs].sort((a, z) => new Date(a.createdAt || 0) - new Date(z.createdAt || 0))) {
    if (out[o.id] || o.formaRecebimento !== "COLETA" || !o.fornecedorId) continue;
    const ini = o.createdAt ? new Date(new Date(o.createdAt).getTime() - 2 * 86400e3) : null;
    const d = porForn.find((x) => !usados.has(x.id) && x.destinoId === o.fornecedorId && (!ini || x.createdAt >= ini || x.data >= ini));
    if (d) { out[o.id] = fmt(d); usados.add(d.id); }
  }
  return out;
}

// v486 — painel de compras: todos os itens de PIC com a etapa em que estão
// EM_COTACAO (sem OC) → AGUARDANDO_NF (OC sem NF) → EM_COLETA / EM_TRANSPORTADORA / ENTREGA_FORNECEDOR (OC com NF) → RECEBIDA
export async function painelDemandas({ avulsasAbertas = false, soAvulsas = true } = {}) {
  const its = await prisma.picItem.findMany({ where: { pic: { status: { not: "CANCELADO" } } }, orderBy: { id: "desc" }, take: 500,
    include: { pic: { select: { numero: true, data: true } }, ocItens: { include: { oc: true } } } });
  const ocs = [...new Map(its.flatMap((i) => i.ocItens.map((x) => [x.oc.id, x.oc]))).values()];
  const rotas = await rotasDeColeta(ocs);
  const fIds = [...new Set([...its.map((i) => i.fornecedorId), ...ocs.map((o) => o.fornecedorId)].filter(Boolean))];
  const forn = Object.fromEntries((await prisma.fornecedor.findMany({ where: { id: { in: fIds } } })).map((f) => [f.id, nomeForn(f)]));
  const cots = await prisma.cotacao.findMany({ where: { status: { not: "CANCELADA" } }, select: { numero: true, fornecedorNome: true, itens: true } });
  const cotPor = {};
  for (const c of cots) for (const i of Array.isArray(c.itens) ? c.itens : []) for (const pid of i.picItemIds || []) (cotPor[pid] ||= []).push({ n: c.numero, f: c.fornecedorNome, s: i.naoTem ? "NAO_TEM" : i.valorUnitario != null ? "VALOR" : "AGUARDANDO" });
  const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  // v496 — pedido de cada item de avulsa lido da própria avulsa (não do texto gravado no PIC)
  const avIds = [...new Set(its.flatMap((i) => (i.info?.pedidos || []).filter((x) => x.avulsa).map((x) => Number(String(x.pedido).slice(2)))).filter(Boolean))];
  const avMap = {};
  for (const c of await prisma.compraAvulsa.findMany({ where: { id: { in: avIds } } })) {
    let k = 0;
    for (const it of Array.isArray(c.itens) ? c.itens : []) if (it.nome && Number(it.quantidade) > 0) avMap[`AV${c.id}|ITEM${++k}`] = pedidoDoItemAvulsa(c, it);
  }
  // v502 — data de criação da demanda (o item de compra mais antigo que originou a linha)
  const cisPic = await prisma.compraItem.findMany({ where: { picId: { in: [...new Set(its.map((i) => i.picId))] } }, select: { pedidoNumero: true, chave: true, createdAt: true } });
  const criadoPor = Object.fromEntries(cisPic.map((x) => [`${x.pedidoNumero}|${x.chave}`, x.createdAt]));
  const linhas = its.map((i) => {
    const oc = i.ocItens[0]?.oc || null, inf = i.info || {};
    let etapa = "EM_COTACAO", previsao = null;
    if (oc) {
      if (oc.status === "CANCELADA") etapa = "EM_COTACAO";
      else if (oc.status === "RECEBIDA") etapa = "RECEBIDA";
      else if (!oc.nfNumero) etapa = "AGUARDANDO_NF";
      else if (oc.formaRecebimento === "TRANSPORTADORA") etapa = "EM_TRANSPORTADORA";
      else if (oc.formaRecebimento === "ENTREGA_PROPRIA") etapa = "ENTREGA_FORNECEDOR";
      else etapa = "EM_COLETA";
    }
    if (oc) previsao = entregaDaOc(oc, rotas[oc.id])?.previsao || null;   // v497 — mesma previsão da OC
    return { id: i.id, pic: i.pic.numero, picData: i.pic.data, nome: inf.nome || `Artigo #${i.artigoId}`, det: [inf.cor, inf.codigo].filter(Boolean).join(" · "), quantidade: Number(i.quantidade), unidade: inf.unidade,
      pedidos: [...new Set((inf.pedidos || []).map((x) => (x.avulsa ? `Avulsa ${String(x.cliente || "").split("·")[0].replace("AVULSA", "").trim() || x.pedido}` : `Ped. ${x.pedido}`)))],
      // v489 — destino: pedido(s) indexado(s) ou operação (avulsa sem pedido)
      destinos: [...new Set((inf.pedidos || []).map((x) => { if (!x.avulsa) return `PED ${x.pedido}`; const p = avMap[`${x.pedido}|${x.chave}`]; return p ? `PED ${p}` : "OPERACAO"; }))],
      origens: (inf.pedidos || []).map((x) => `${x.pedido}|${x.chave}`),   // v493
      criadoEm: (inf.pedidos || []).map((x) => criadoPor[`${x.pedido}|${x.chave}`]).filter(Boolean).sort((a, b) => a - b)[0] || i.pic.data,
      fornecedor: forn[oc?.fornecedorId || i.fornecedorId] || null, etapa, previsao,
      oc: oc ? { id: oc.id, numero: oc.numero, nf: oc.nfNumero, forma: oc.formaRecebimento, valor: Number(i.ocItens[0].valorUnitario) } : null,
      rota: oc ? rotas[oc.id] || null : null, cotacoes: cotPor[i.id] || [],
      origem: (inf.pedidos || []).some((x) => !x.avulsa) ? ((inf.pedidos || []).some((x) => x.avulsa) ? "AP" : "P") : "A" };   // v495 — A avulsa · P pedido
  });
  if (!avulsasAbertas) return linhas;
  // v495 — compras avulsas ainda antes do PIC (levantamento, atendidas pelo estoque, reprovadas)
  const abertos = await prisma.compraItem.findMany({ where: { pedidoNumero: { startsWith: "AV" }, status: { in: ["LEVANTAMENTO", "ESTOQUE", "REPROVADO"] } }, orderBy: { id: "desc" } });
  const avs = Object.fromEntries((await prisma.compraAvulsa.findMany({ where: { id: { in: abertos.map((x) => Number(x.pedidoNumero.slice(2))).filter(Boolean) } }, select: { id: true, numero: true, status: true } })).map((a) => [a.id, a]));
  const avFull = Object.fromEntries((await prisma.compraAvulsa.findMany({ where: { id: { in: Object.keys(avs).map(Number) } } })).map((c) => [c.id, c]));
  const pedAv = (num, chave) => { const c = avFull[Number(num.slice(2))]; if (!c) return null; let k = 0; for (const it of Array.isArray(c.itens) ? c.itens : []) if (it.nome && Number(it.quantidade) > 0 && `ITEM${++k}` === chave) return pedidoDoItemAvulsa(c, it); return null; };
  const extra = abertos.filter((x) => avs[Number(x.pedidoNumero.slice(2))] && avs[Number(x.pedidoNumero.slice(2))].status !== "CANCELADA").map((x) => {
    const d = (Array.isArray(x.demanda) ? x.demanda : [])[0] || {};
    const pr = pedAv(x.pedidoNumero, x.chave);
    return { id: `C${x.id}`, pic: null, nome: x.descricao || d.nome, det: "", quantidade: Number(x.quantidade), unidade: d.unidade,
      pedidos: [`Avulsa ${avs[Number(x.pedidoNumero.slice(2))]?.numero || x.pedidoNumero}`], destinos: [pr ? `PED ${pr}` : "OPERACAO"], origens: [`${x.pedidoNumero}|${x.chave}`],
      fornecedor: d.fornecedor || null, etapa: x.status, previsao: x.entrega ? x.entrega.toISOString().slice(0, 10) : null, oc: null, rota: null, cotacoes: [], origem: "A", criadoEm: x.createdAt };
  });
  return [...extra, ...(soAvulsas ? linhas.filter((l) => l.origem !== "P") : linhas)];   // v504 — painel principal: tudo + avulsas pendentes
}

// v487 — a cotação que originou a OC acompanha a OC: valor negociado, quantidade, prazo e condição
export async function sincronizarCotacaoDaOc(ocId) {
  const o = await prisma.ordemCompra.findUnique({ where: { id: ocId }, include: { itens: true } });
  if (!o) return;
  const cs = await prisma.cotacao.findMany({ where: { OR: [{ ocId: o.id }, ...(o.cotacaoId ? [{ id: o.cotacaoId }] : [])] } });   // v488 — todas as cotações da OC
  for (const c of cs) {
  const porPi = Object.fromEntries(o.itens.filter((i) => i.picItemId).map((i) => [i.picItemId, i]));
  const itens = (Array.isArray(c.itens) ? c.itens : []).map((ci) => {
    const ois = (ci.picItemIds || []).map((p) => porPi[p]).filter(Boolean);
    if (!ois.length) return ci;
    return { ...ci, quantidade: r3(ois.reduce((s0, x) => s0 + Number(x.quantidade), 0)), valorNegociado: Number(ois[0].valorUnitario) };
  });
  await prisma.cotacao.update({ where: { id: c.id }, data: { itens, condicao: o.condicaoFaturamento || c.condicao, prazoEntrega: o.prazoFabrica || c.prazoEntrega } });
  }
}

// v497 — situação de entrega da OC e a previsão de chegada
// coleta: a data da rota (reagendou a coleta, muda aqui) · transportadora/fornecedor: a previsão informada na NF/OC,
// ou emissão da NF + dias após o faturamento, ou o prazo da OC
export function entregaDaOc(o, rota) {
  const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  if (o.status === "CANCELADA") return null;
  if (o.status === "RECEBIDA") return { status: "RECEBIDA", previsao: null };
  if (o.formaRecebimento === "COLETA") {
    if (rota?.status === "CONCLUIDA") return { status: "COLETADA", previsao: dt(rota.concluidaEm) || rota.data, fonte: "rota" };
    return { status: "EM_COLETA", previsao: rota?.data || dt(o.previsaoEntrega) || dt(o.prazoFabrica), fonte: rota ? "rota" : "oc" };
  }
  const calc = o.nfEmissao && o.diasAposFaturamento ? dt(new Date(new Date(o.nfEmissao).getTime() + o.diasAposFaturamento * 86400e3)) : null;
  const previsao = dt(o.previsaoEntrega) || calc || dt(o.prazoFabrica);
  if (o.formaRecebimento === "TRANSPORTADORA") return { status: "EM_TRANSPORTADORA", previsao, fonte: o.previsaoEntrega ? "informada" : calc ? "calculada" : "oc" };
  if (o.formaRecebimento === "ENTREGA_PROPRIA") return { status: "ENTREGA_FORNECEDOR", previsao, fonte: o.previsaoEntrega ? "informada" : "oc" };
  return { status: null, previsao };
}
