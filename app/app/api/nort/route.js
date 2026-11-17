// v906 — tela Produção › Estoque › Peças prontas e Dados › Integrações › NORT
//   GET ?u=                 → itens (peças prontas e nomes vindos dos pedidos) com custo, saldos e mínimo + pedidos aguardando FPP
//   GET ?u=&movs=ITEM       → últimos movimentos do item
//   GET ?u=&itensPadrao=1   → itens padrão para a indexação
//   GET ?u=&token=1         → token e endereços (master)  · POST { acao: "token" } renova (master)
//   POST { usuarioId, acao: "indexar", itemId, itemPadraoId|null } · { acao: "minimo", itemId, minimo|null }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";
import { gerencial } from "@/lib/acesso";
import { listarItens, tokenNort, reprocessarPendentes } from "@/lib/nortInteg";

const ENDPOINTS = [
  { metodo: "POST", caminho: "/api/ext/nort/estoque", desc: "Movimentos de estoque de peças prontas (entrada, venda, ajuste) por depósito SEDE/LOJA · ou { saldos } para a conferência diária" },
  { metodo: "GET", caminho: "/api/ext/nort/itens", desc: "Itens pelo nome, com equivalência (Item Padrão), FPP, custo e saldos · ?estoque=1" },
  { metodo: "POST", caminho: "/api/ext/nort/pedido", desc: "Encomenda personalizada → pedido interno NORT (não duplica pela ref) · anexos (layout) com acao anexar / iniciar / parte" },
  { metodo: "GET", caminho: "/api/ext/nort/pedido?ref=", desc: "Situação do pedido (aguardando FPP, em andamento, etapa no PCP, entrega)" },
];
const nome = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const podeEditar = (u) => gerencial(u) || ["COMPRAS", "PCP", "PRODUCAO", "ESTOQUE"].includes(u.setor);

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivoFin(sp.get("u"));
  if (!u || u.setor === "CLIENTE") return Response.json({ error: "Sem acesso." }, { status: 403 });
  if (sp.get("token")) {
    if (!u.isMaster) return Response.json({ error: "Só o master vê o token." }, { status: 403 });
    return Response.json({ token: await tokenNort(), cabecalho: "X-Api-Key", endpoints: ENDPOINTS, fixoNoServidor: !!(process.env.NORT_EXT_TOKEN && process.env.NORT_EXT_TOKEN.length >= 16) });
  }
  if (sp.get("movs")) {
    const l = await prisma.nortMov.findMany({ where: { itemId: Number(sp.get("movs")) || 0 }, orderBy: [{ data: "desc" }, { id: "desc" }], take: 300 });
    return Response.json({ movs: l.map((m) => ({ ...m, quantidade: Number(m.quantidade) })) });
  }
  if (sp.get("itensPadrao")) {
    const l = await prisma.itemPadrao.findMany({ where: { ativo: true }, select: { id: true, nomeInterno: true, codigoPadrao: true, fppNumero: true, fppId: true }, orderBy: { nomeInterno: "asc" } });
    return Response.json({ itens: l });
  }
  const pend = await prisma.pp.findMany({ where: { extRef: { startsWith: "NORT|" }, efetivadoEm: null }, select: { id: true, numero: true, extRef: true, clienteFinal: true, createdAt: true, itens: { select: { descricao: true, fppId: true } } }, orderBy: { id: "desc" } });
  return Response.json({ itens: await listarItens(), podeEditar: podeEditar(u),
    pendentes: pend.map((p) => ({ id: p.id, numero: p.numero, ref: p.extRef.replace(/^NORT\|/, ""), cliente: p.clienteFinal?.nome || null, em: p.createdAt, semFpp: p.itens.filter((i) => !i.fppId).map((i) => i.descricao) })) });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivoFin(b.usuarioId);
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
  if (b.acao === "token") {
    if (!u.isMaster) return Response.json({ error: "Só o master renova o token." }, { status: 403 });
    return Response.json({ token: await tokenNort(true), cabecalho: "X-Api-Key", endpoints: ENDPOINTS });
  }
  if (!podeEditar(u)) return Response.json({ error: "Sem permissão para alterar." }, { status: 403 });
  const it = await prisma.nortItem.findUnique({ where: { id: Number(b.itemId) || 0 } });
  if (!it) return Response.json({ error: "Item não encontrado." }, { status: 404 });
  if (b.acao === "indexar") {
    const ip = b.itemPadraoId ? await prisma.itemPadrao.findUnique({ where: { id: Number(b.itemPadraoId) }, select: { id: true } }) : null;
    if (b.itemPadraoId && !ip) return Response.json({ error: "Item padrão não encontrado." }, { status: 404 });
    await prisma.nortItem.update({ where: { id: it.id }, data: { itemPadraoId: ip ? ip.id : null } });
    const r = ip ? await reprocessarPendentes(nome(u)).catch((e) => ({ erro: e.message })) : null;   // pedidos que aguardavam este item seguem
    return Response.json({ ok: true, reprocessados: r });
  }
  if (b.acao === "minimo") {
    const m = b.minimo === "" || b.minimo == null ? null : Math.max(0, Number(String(b.minimo).replace(",", ".")) || 0);
    await prisma.nortItem.update({ where: { id: it.id }, data: { minimo: m, avisoMinEm: null } });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
