// v747 — venda comissionada: vendedores (Dados › Vendedores) e comissão no contas a pagar.
//   No lançamento do pedido: { vendedorId, tipo: PCT | VALOR, valor }. % sobre o valor dos itens (o frete não entra).
//   A comissão é dividida entre as contas a receber do pedido, na proporção do valor de cada uma sobre o total do pedido
//   (entrada, parcelas da emissão e, depois do faturamento, as parcelas da NF / entrega — cada fatura leva a sua parte).
//   SPOT: uma conta a pagar no vencimento de cada conta a receber.
//   MENSAL: todas as partes com vencimento no mês M viram uma só conta a pagar no dia 10 do mês M+1.
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const so = (s) => String(s || "").replace(/\D/g, "");
const up = (s) => (s == null ? null : String(s).trim().toUpperCase() || null);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const num = (v) => { if (v == null || v === "") return 0; if (typeof v === "number") return v; const s = String(v).trim().replace(/\s|R\$|%/g, ""); return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) || 0; };
export const FECHAMENTOS = { SPOT: "Spot — no vencimento de cada conta a receber", MENSAL: "Mensal — uma conta no dia 10 do mês seguinte" };
export const PIX_TIPOS = ["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"];
const CONTA_COMISSAO = ["2119000", "COMISSÃO DE VENDAS"];

async function contaComissao() {
  const [codigo, nome] = CONTA_COMISSAO;
  return (await prisma.finConta.findUnique({ where: { codigo }, select: { id: true } }))
    || prisma.finConta.create({ data: { codigo, nome }, select: { id: true } }).catch(() => prisma.finConta.findUnique({ where: { codigo }, select: { id: true } }));
}

// ---------- cadastro ----------
export async function listarVendedores({ todos = false } = {}) {
  return prisma.vendedor.findMany({ where: todos ? {} : { ativo: true }, orderBy: { nome: "asc" } });
}
export async function salvarVendedor(b, quem) {
  const nome = up(b.nome);
  if (!nome) return { error: "Informe o nome do vendedor." };
  const fechamento = b.fechamento === "MENSAL" ? "MENSAL" : "SPOT";
  const data = { nome, documento: so(b.documento) || null, telefone: b.telefone ? String(b.telefone).trim() : null, email: b.email ? String(b.email).trim().toLowerCase() : null,
    endereco: up(b.endereco), pixTipo: PIX_TIPOS.includes(b.pixTipo) ? b.pixTipo : null, pixChave: b.pixChave ? String(b.pixChave).trim() : null,
    banco: up(b.banco), agencia: b.agencia ? String(b.agencia).trim() : null, conta: b.conta ? String(b.conta).trim() : null,
    fechamento, obs: b.obs ? String(b.obs).trim() : null, ativo: b.ativo !== false };
  const v = b.id ? await prisma.vendedor.update({ where: { id: Number(b.id) }, data }) : await prisma.vendedor.create({ data: { ...data, criadoPorNome: quem || null } });
  // mudou o fechamento: refaz as contas das comissões ainda não pagas
  if (b.id) { const ps = await prisma.vendaComissao.findMany({ where: { vendedorId: v.id }, select: { pedidoNumero: true } }); for (const n of [...new Set(ps.map((p) => p.pedidoNumero))]) await sincronizarComissoes(n, quem).catch(() => null); }
  return { ok: true, vendedor: v };
}

// ---------- cálculo ----------
// comissão total do pedido (R$): % sobre os itens (sem frete) ou valor fixo
export function comissaoTotal(com, valorItens) {
  if (!com || !com.vendedorId) return 0;
  return com.tipo === "PCT" ? r2(valorItens * num(com.valor) / 100) : r2(num(com.valor));
}
// divide a comissão entre as contas a receber (proporcional ao valor de cada uma sobre o total do pedido)
export function partesComissao(total, totalPedido, receber) {
  if (!(total > 0) || !(totalPedido > 0)) return [];
  const l = receber.map((t) => ({ ...t, valorReceber: r2(t.valor), valor: r2(total * Number(t.valor) / totalPedido) }));
  // fecha o arredondamento quando as contas a receber já somam o pedido inteiro
  const somaR = r2(receber.reduce((s, t) => s + Number(t.valor), 0));
  if (l.length && Math.abs(somaR - totalPedido) < 0.05) { const d = r2(total - l.reduce((s, x) => s + x.valor, 0)); l[l.length - 1].valor = r2(l[l.length - 1].valor + d); }
  return l.filter((x) => x.valor > 0);
}
const mesSeguinteDia10 = (venc) => { const d = new Date(venc); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10)); };
const chaveMensal = (vid, venc) => `COM|V${vid}|${iso(venc).slice(0, 7)}`;
const chaveSpot = (chaveReceber) => `COM|${chaveReceber}`;

async function gravarPagar({ chave, vend, valor, venc, titulo, obs, quem }) {
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true, status: true } });
  if (ja && ja.status === "PAGO") return;   // já pago: não mexe
  if (!(valor > 0)) { if (ja && ja.status !== "CANCELADO") await prisma.finTitulo.update({ where: { id: ja.id }, data: { status: "CANCELADO", atualizadoPorNome: quem } }); return; }
  const conta = await contaComissao();
  const v = iso(venc);
  const dados = { tipo: "PAGAR", titulo: titulo.slice(0, 190), parceiro: vend.nome, documento: vend.documento || null, numeroDoc: null, emissao: null,
    valor: r2(valor), vencimento: dUTC(v), competencia: v.slice(0, 7), previsao: false, rateio: conta ? [{ contaId: conta.id, pct: 100 }] : [],
    forma: "COMISSAO", formaPagamento: vend.pixChave ? "PIX" : null, chavePix: vend.pixChave || null, observacao: obs };
  if (ja) await prisma.finTitulo.update({ where: { id: ja.id }, data: { ...dados, status: "ABERTO", atualizadoPorNome: quem } });
  else await prisma.finTitulo.create({ data: { ...dados, chaveImport: chave, criadoPorNome: quem } });
}

// refaz a conta mensal de um vendedor num mês (soma de todas as partes com vencimento a receber naquele mês)
async function refazerMensal(vend, mes, quem) {
  const ini = dUTC(`${mes}-01`), fim = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 1, 1));
  const ps = await prisma.vendaComissao.findMany({ where: { vendedorId: vend.id, vencReceber: { gte: ini, lt: fim } }, orderBy: { vencReceber: "asc" } });
  const tot = r2(ps.reduce((s, p) => s + Number(p.valor), 0));
  const [a, m] = mes.split("-");
  await gravarPagar({ chave: `COM|V${vend.id}|${mes}`, vend, valor: tot, venc: mesSeguinteDia10(ini), quem,
    titulo: `COMISSÃO ${vend.nome} - ${m}/${a}`,
    obs: `COMISSÃO MENSAL (${m}/${a}) · ${ps.length} conta(s) a receber · pedidos ${[...new Set(ps.map((p) => p.pedidoNumero))].join(", ")}` });
}

// sincroniza a comissão de um pedido com as contas a receber dele (chamar depois de efetivar e de faturar)
export async function sincronizarComissoes(numero, quem = null) {
  numero = String(numero || ""); if (!numero) return { ok: false };
  const pp = await prisma.pp.findFirst({ where: { numero }, orderBy: { id: "desc" }, include: { itens: { select: { quantidade: true, valorUnitario: true } } } });
  const antes = await prisma.vendaComissao.findMany({ where: { pedidoNumero: numero } });
  const com = pp?.comissao && pp.comissao.vendedorId ? pp.comissao : null;
  const vend = com ? await prisma.vendedor.findUnique({ where: { id: Number(com.vendedorId) } }) : null;
  let novas = [];
  if (com && vend && pp && !pp.interno) {
    const valorItens = r2(pp.itens.reduce((s, it) => s + num(it.quantidade) * num(it.valorUnitario), 0));
    const totalPedido = Number(pp.valorTotal) || valorItens;
    const receber = (await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", chaveImport: { startsWith: `PED|${numero}|` }, status: { not: "CANCELADO" } }, orderBy: { vencimento: "asc" },
      select: { chaveImport: true, valor: true, vencimento: true, titulo: true } }));
    const total = comissaoTotal(com, valorItens);
    novas = partesComissao(total, totalPedido, receber.map((t) => ({ chave: t.chaveImport, valor: Number(t.valor), venc: t.vencimento, titulo: t.titulo })))
      .map((p) => ({ ...p, chavePagar: vend.fechamento === "MENSAL" ? chaveMensal(vend.id, p.venc) : chaveSpot(p.chave) }));
  }
  // grava as partes (e tira as que não valem mais)
  const ficam = new Set(novas.map((p) => p.chave));
  for (const a of antes) if (!ficam.has(a.chaveReceber)) await prisma.vendaComissao.delete({ where: { id: a.id } });
  for (const p of novas) {
    const data = { vendedorId: vend.id, pedidoNumero: numero, vencReceber: p.venc, valorReceber: p.valorReceber, valor: p.valor, chavePagar: p.chavePagar };
    await prisma.vendaComissao.upsert({ where: { chaveReceber: p.chave }, update: data, create: { ...data, chaveReceber: p.chave } });
  }
  // contas a pagar: spot por parte; mensal refaz os meses afetados (antes e agora)
  const vends = new Map();
  const getV = async (id) => { if (!vends.has(id)) vends.set(id, await prisma.vendedor.findUnique({ where: { id } })); return vends.get(id); };
  const mensais = new Set();
  for (const a of antes) {
    if (a.chavePagar.startsWith("COM|V")) mensais.add(`${a.vendedorId}|${iso(a.vencReceber).slice(0, 7)}`);
    else if (!novas.some((p) => p.chavePagar === a.chavePagar)) { const v = await getV(a.vendedorId); if (v) await gravarPagar({ chave: a.chavePagar, vend: v, valor: 0, venc: a.vencReceber, titulo: "", quem }); }
  }
  for (const p of novas) {
    if (vend.fechamento === "MENSAL") mensais.add(`${vend.id}|${iso(p.venc).slice(0, 7)}`);
    else await gravarPagar({ chave: p.chavePagar, vend, valor: p.valor, venc: p.venc, quem, titulo: `COMISSÃO ${vend.nome} - PEDIDO ${numero} · ${String(p.titulo || "").replace(/^PEDIDO \S+ - /, "")}`,
      obs: `COMISSÃO DO PEDIDO ${numero} (${com.tipo === "PCT" ? `${String(com.valor).replace(".", ",")}% DOS ITENS` : "VALOR FIXO"}) · PROPORCIONAL À CONTA A RECEBER ${p.chave}` });
  }
  for (const k of mensais) { const [vid, mes] = k.split("|"); const v = await getV(Number(vid)); if (v) await refazerMensal(v, mes, quem); }
  return { ok: true, partes: novas.length, total: r2(novas.reduce((s, p) => s + p.valor, 0)) };
}
