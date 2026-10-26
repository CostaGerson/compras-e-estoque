// v478 — cotações: geradas no PIC (uma por fornecedor), resposta do fornecedor e aplicação do preço nos itens do PIC
import { prisma } from "@/lib/prisma";

const num = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const out = (c) => ({ ...c, prazoEntrega: c.prazoEntrega ? c.prazoEntrega.toISOString().slice(0, 10) : null });

export async function criarCotacoes(grupos, pics, quem) {
  const criadas = [];
  for (const g of grupos || []) {
    const itens = (g.itens || []).map((i) => ({ nome: String(i.nome || ""), det: i.det || "", quantidade: Number(i.quantidade) || 0, unidade: i.unidade || null,
      picItemIds: (i.picItemIds || []).map(Number).filter(Boolean), valorUnitario: null, prazo: null, obs: null }));
    if (!itens.length) continue;
    const c = await prisma.cotacao.create({ data: { numero: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fornecedorId: g.fornecedor?.id ? Number(g.fornecedor.id) : null,
      fornecedorNome: String(g.fornecedor?.nomeFantasia || g.fornecedor?.nome || g.fornecedor?.razaoSocial || "").toUpperCase() || "SEM NOME", pics: pics || null, itens, criadoPorNome: quem || null } });
    const numero = `COT ${String(c.id).padStart(4, "0")}`;
    criadas.push(out(await prisma.cotacao.update({ where: { id: c.id }, data: { numero } })));
  }
  return { ok: true, cotacoes: criadas };
}

export async function listarCotacoes() {
  const l = await prisma.cotacao.findMany({ where: { status: { not: "CANCELADA" } }, orderBy: { id: "desc" }, take: 150 });
  const fIds = [...new Set(l.map((c) => c.fornecedorId).filter(Boolean))];
  const fs = Object.fromEntries((await prisma.fornecedor.findMany({ where: { id: { in: fIds } } })).map((f) => [f.id, f]));
  return l.map((c) => ({ ...out(c), fornecedor: fs[c.fornecedorId] ? { id: c.fornecedorId, nome: fs[c.fornecedorId].nomeFantasia || fs[c.fornecedorId].nome, nomeFantasia: fs[c.fornecedorId].nomeFantasia, razaoSocial: fs[c.fornecedorId].razaoSocial, telefone: fs[c.fornecedorId].telefone, telefones: fs[c.fornecedorId].telefones } : { nome: c.fornecedorNome } }));
}

// resposta do fornecedor: { id, itens: [{ valorUnitario, prazo, obs }] (mesma ordem), condicao, prazoEntrega, obs }
export async function responderCotacao(b) {
  const c = await prisma.cotacao.findUnique({ where: { id: Number(b.id) } });
  if (!c) return { error: "Cotação não encontrada." };
  const its = (Array.isArray(c.itens) ? c.itens : []).map((i, k) => {
    const r = (b.itens || [])[k] || {};
    return { ...i, valorUnitario: num(r.valorUnitario), prazo: /^\d{4}-\d{2}-\d{2}$/.test(String(r.prazo || "")) ? r.prazo : null, obs: String(r.obs || "").trim() || null };
  });
  const algum = its.some((i) => i.valorUnitario != null);
  const n = await prisma.cotacao.update({ where: { id: c.id }, data: { itens: its, condicao: String(b.condicao || "").trim() || null,
    prazoEntrega: /^\d{4}-\d{2}-\d{2}$/.test(String(b.prazoEntrega || "")) ? new Date(`${b.prazoEntrega}T12:00:00Z`) : null, obs: String(b.obs || "").trim() || null,
    ...(c.status === "ENVIADA" && algum ? { status: "RESPONDIDA", respondidaEm: new Date() } : {}) } });
  return { ok: true, cotacao: out(n) };
}

// aplica preço e fornecedor da cotação nos itens do PIC que ainda não estão em OC
export async function aplicarCotacao(id) {
  const c = await prisma.cotacao.findUnique({ where: { id: Number(id) } });
  if (!c) return { error: "Cotação não encontrada." };
  if (!c.fornecedorId) return { error: "Fornecedor da cotação não está no cadastro." };
  let n = 0, emOc = 0;
  for (const i of Array.isArray(c.itens) ? c.itens : []) {
    if (i.valorUnitario == null) continue;
    for (const pid of i.picItemIds || []) {
      const pi = await prisma.picItem.findUnique({ where: { id: pid }, include: { ocItens: { select: { id: true } } } });
      if (!pi) continue;
      if (pi.ocItens.length) { emOc++; continue; }
      await prisma.picItem.update({ where: { id: pi.id }, data: { fornecedorId: c.fornecedorId, valorUnitario: i.valorUnitario } });
      n++;
    }
  }
  if (!n) return { error: emOc ? "Os itens desta cotação já estão em OC." : "Preencha o valor unitário de algum item da cotação." };
  await prisma.cotacao.update({ where: { id: c.id }, data: { status: "APLICADA", aplicadaEm: new Date() } });
  return { ok: true, aplicados: n, emOc };
}

export async function cancelarCotacao(id) {
  await prisma.cotacao.update({ where: { id: Number(id) }, data: { status: "CANCELADA" } });
  return { ok: true };
}
