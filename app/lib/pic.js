// v469 — PIC (pedido interno de compras) a partir do cruzamento com o estoque e OCs agrupadas por fornecedor
import { prisma } from "@/lib/prisma";
import { simularCruzamento, necessidade, ehAvulsa } from "@/lib/compras";

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const nomeForn = (f) => (f ? f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}` : null);

// gera o PIC com os itens que o estoque não atende (os marcados "compra" no cruzamento)
export async function gerarPic(quem) {
  const { artigos, atendidos, itens } = await simularCruzamento();
  const at = new Set(atendidos);
  const compra = itens.filter((i) => !at.has(i.id) && Object.keys(necessidade(i)).length);
  if (!compra.length) return { error: "Nenhum item para comprar: o estoque atende todo o levantamento." };
  // pedidos de origem por artigo
  const origem = {};
  for (const i of compra) for (const [a, q] of Object.entries(necessidade(i))) (origem[a] ||= []).push({ pedido: i.pedidoNumero, chave: i.chave, cliente: i.cliente, quantidade: r3(q), avulsa: ehAvulsa(i.pedidoNumero) });
  const linhas = artigos.filter((a) => a.comprar > 0 && origem[a.artigoId]);
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
    itens: p.itens.map((i) => ({ id: i.id, artigoId: i.artigoId, quantidade: Number(i.quantidade), fornecedorId: i.fornecedorId, fornecedor: forn[i.fornecedorId] || null,
      valorUnitario: i.valorUnitario != null ? Number(i.valorUnitario) : null, info: i.info || {}, oc: i.ocItens[0] ? { id: i.ocItens[0].ocId, numero: i.ocItens[0].oc.numero } : null })) }));
}

// comprador preenche fornecedor, valor e quantidade: [{ id, fornecedorId, valorUnitario, quantidade }]
export async function salvarItensPic(picId, itens) {
  const l = await prisma.picItem.findMany({ where: { picId: Number(picId) }, include: { ocItens: { select: { id: true } } } });
  const porId = Object.fromEntries(l.map((i) => [i.id, i]));
  for (const x of itens || []) {
    const i = porId[Number(x.id)]; if (!i || i.ocItens.length) continue;
    const q = num(x.quantidade);
    await prisma.picItem.update({ where: { id: i.id }, data: {
      fornecedorId: x.fornecedorId ? Number(x.fornecedorId) : null,
      valorUnitario: num(x.valorUnitario),
      ...(q != null && q > 0 ? { quantidade: r3(q) } : {}),
    } });
  }
  return { ok: true };
}

// OCs: uma por fornecedor, com os itens do PIC que têm fornecedor e valor e ainda não estão em OC
export async function gerarOcs(picId, quem) {
  const pic = await prisma.pic.findUnique({ where: { id: Number(picId) }, include: { itens: { include: { ocItens: { select: { id: true } } } } } });
  if (!pic) return { error: "PIC não encontrado." };
  const livres = pic.itens.filter((i) => !i.ocItens.length);
  const prontos = livres.filter((i) => i.fornecedorId && i.valorUnitario != null && Number(i.valorUnitario) > 0 && Number(i.quantidade) > 0);
  if (!prontos.length) return { error: "Preencha fornecedor e valor unitário dos itens para gerar as OCs." };
  const grupos = {};
  for (const i of prontos) (grupos[i.fornecedorId] ||= []).push(i);
  const ocs = [];
  for (const [fid, its] of Object.entries(grupos)) {
    const oc = await prisma.ordemCompra.create({ data: { numero: `TMP-${Date.now()}-${fid}-${Math.random().toString(36).slice(2, 6)}`, fornecedorId: Number(fid), picId: pic.id, criadoPorNome: quem || null,
      itens: { create: its.map((i) => ({ artigoId: i.artigoId, picItemId: i.id, quantidade: i.quantidade, valorUnitario: i.valorUnitario })) } } });
    const numero = `OC ${String(oc.id).padStart(4, "0")}`;
    await prisma.ordemCompra.update({ where: { id: oc.id }, data: { numero } });
    // o artigo passa a ter esse fornecedor e o último preço de compra
    for (const i of its) await prisma.artigo.update({ where: { id: i.artigoId }, data: { valorUnitario: i.valorUnitario, ...(i.fornecedorId ? { fornecedorId: i.fornecedorId } : {}) } }).catch(() => null);
    ocs.push({ id: oc.id, numero, itens: its.length });
  }
  const faltam = livres.length - prontos.length;
  if (!faltam) {
    await prisma.pic.update({ where: { id: pic.id }, data: { status: "OC" } });
    const its = await prisma.compraItem.findMany({ where: { picId: pic.id }, select: { id: true, pedidoNumero: true } });
    await prisma.compraItem.updateMany({ where: { picId: pic.id }, data: { status: "OC" } });
    // compra avulsa com todos os itens em OC passa a COMPRADA
    for (const av of [...new Set(its.map((x) => x.pedidoNumero).filter(ehAvulsa))]) {
      const resto = await prisma.compraItem.count({ where: { pedidoNumero: av, status: { in: ["LEVANTAMENTO", "PIC"] } } });
      if (!resto) await prisma.compraAvulsa.updateMany({ where: { id: Number(av.slice(2)), status: "ABERTA" }, data: { status: "COMPRADA" } });
    }
  }
  return { ok: true, ocs, faltam };
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
  const l = await prisma.ordemCompra.findMany({ orderBy: { id: "desc" }, take: 100, include: { fornecedor: true, itens: { include: { artigo: { select: { nome: true, cor: true, codigo: true, unidade: true } } } } } });
  const picIds = [...new Set(l.map((o) => o.picId).filter(Boolean))];
  const pics = Object.fromEntries((await prisma.pic.findMany({ where: { id: { in: picIds } }, select: { id: true, numero: true } })).map((p) => [p.id, p.numero]));
  return l.map((o) => ({ id: o.id, numero: o.numero, status: o.status, createdAt: o.createdAt, criadoPorNome: o.criadoPorNome, obs: o.obs,
    condicaoFaturamento: o.condicaoFaturamento, prazoFabrica: o.prazoFabrica, prazoTransportadora: o.prazoTransportadora, pic: pics[o.picId] || null,
    fornecedor: { id: o.fornecedor.id, nome: nomeForn(o.fornecedor), razaoSocial: o.fornecedor.razaoSocial, contato: o.fornecedor.contato, telefone: o.fornecedor.telefone, email: o.fornecedor.email },
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
    ...(["ABERTA", "ENVIADA", "RECEBIDA", "CANCELADA"].includes(b.status) ? { status: b.status } : {}),
  } });
  return { ok: true };
}
