// v1081 — Financeiro do portal do cliente (Loja Way): cópia simplificada do financeiro da Meridian.
//   Contas a pagar e a receber próprias do cliente (PortalFinTitulo) + plano de contas enxuto (PortalFinConta)
//   + análise mensal (DRE simplificada: receita, margem, EBITDA, lucro e resultado, realizado e previsto).
//   As contas a pagar à Meridian são um ESPELHO das contas a receber da Meridian dos pedidos do cliente
//   (FinTitulo RECEBER "PED|<nº>|…", ou com o CNPJ/nome do cliente): valor, vencimento e baixa vêm da Meridian, sem digitação.
import { prisma } from "@/lib/prisma";
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();   // = portalCliente
const fmtNumPortal = (n) => (n ? String(n).padStart(4, "0") : "");

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const so = (s) => String(s || "").replace(/\D/g, "");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const okData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(dUTC(s));
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const num = (v) => { if (typeof v === "number") return v; const s = String(v ?? "").trim(); if (!s) return 0; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const somaMeses = (isoD, m) => { const [a, b, c] = isoD.split("-").map(Number); const alvo = new Date(Date.UTC(a, b - 1 + m, 1)); const ult = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate(); return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(c, ult))).toISOString().slice(0, 10); };

// ---------- plano de contas ----------
export const GRUPOS = [
  { k: "RECEITA", nome: "Receita bruta", tipo: "RECEBER" },
  { k: "DEDUCAO", nome: "Deduções (devoluções e descontos)", tipo: "PAGAR" },
  { k: "CMV", nome: "Custo das mercadorias (CMV)", tipo: "PAGAR" },
  { k: "DESPESA", nome: "Despesas operacionais", tipo: "PAGAR" },
  { k: "IMPOSTO", nome: "Impostos", tipo: "PAGAR" },
  { k: "FINANCEIRO", nome: "Resultado financeiro (juros e tarifas)", tipo: "PAGAR" },
  { k: "INVESTIMENTO", nome: "Investimentos", tipo: "PAGAR" },
];
const GRUPO_OK = new Set(GRUPOS.map((g) => g.k));
export const CONTA_MERIDIAN = "3.01";
const PLANO_PADRAO = [
  ["1.01", "VENDAS DE PRODUTOS", "RECEITA", true], ["1.02", "OUTRAS RECEITAS", "RECEITA"],
  ["2.01", "DEVOLUÇÕES E DESCONTOS", "DEDUCAO"],
  [CONTA_MERIDIAN, "COMPRAS MERIDIAN (PEDIDOS)", "CMV", true], ["3.02", "OUTRAS COMPRAS DE MERCADORIA", "CMV"], ["3.03", "FRETE DE ENVIO AO CLIENTE", "CMV"],
  ["4.01", "PESSOAL", "DESPESA"], ["4.02", "ALUGUEL E OCUPAÇÃO", "DESPESA"], ["4.03", "MARKETING", "DESPESA"], ["4.04", "TAXAS DE VENDA E MARKETPLACE", "DESPESA"],
  ["4.05", "SISTEMAS E SERVIÇOS", "DESPESA"], ["4.06", "DESPESAS ADMINISTRATIVAS", "DESPESA"], ["4.07", "OUTRAS DESPESAS", "DESPESA"],
  ["5.01", "IMPOSTOS SOBRE VENDAS (SIMPLES/DAS)", "IMPOSTO"], ["5.02", "OUTROS IMPOSTOS", "IMPOSTO"],
  ["6.01", "JUROS E TARIFAS BANCÁRIAS", "FINANCEIRO"],
  ["7.01", "INVESTIMENTOS", "INVESTIMENTO"],
];
export async function garantirPlano(clienteId) {
  const n = await prisma.portalFinConta.count({ where: { clienteId } });
  if (n) return;
  await prisma.portalFinConta.createMany({ data: PLANO_PADRAO.map(([codigo, nome, grupo, sistema]) => ({ clienteId, codigo, nome, grupo, sistema: !!sistema })), skipDuplicates: true });
}
export async function listarContas(clienteId) {
  await garantirPlano(clienteId);
  return prisma.portalFinConta.findMany({ where: { clienteId }, orderBy: { codigo: "asc" } });
}
export async function salvarConta(clienteId, b) {
  const nome = String(b.nome || "").trim().toUpperCase().slice(0, 80);
  if (b.id) {
    const c = await prisma.portalFinConta.findFirst({ where: { id: Number(b.id), clienteId } });
    if (!c) return { error: "Conta não encontrada." };
    if (b.ativo === false && c.sistema) return { error: "Esta conta é do sistema e não pode ser desativada." };
    if (b.ativo === false && c.codigo === CONTA_MERIDIAN) return { error: "Esta conta é do sistema." };
    return { ok: true, conta: await prisma.portalFinConta.update({ where: { id: c.id }, data: { ...(nome ? { nome } : {}), ...(typeof b.ativo === "boolean" ? { ativo: b.ativo } : {}) } }) };
  }
  if (!nome) return { error: "Dê um nome para a conta." };
  if (!GRUPO_OK.has(b.grupo)) return { error: "Escolha o grupo da conta." };
  const ls = await prisma.portalFinConta.findMany({ where: { clienteId }, select: { codigo: true } });
  const pre = String(GRUPOS.findIndex((g) => g.k === b.grupo) + 1);
  const max = Math.max(0, ...ls.map((x) => x.codigo).filter((c) => c.startsWith(`${pre}.`)).map((c) => Number(c.split(".")[1]) || 0));
  const codigo = `${pre}.${String(max + 1).padStart(2, "0")}`;
  return { ok: true, conta: await prisma.portalFinConta.create({ data: { clienteId, codigo, nome, grupo: b.grupo } }) };
}

// ---------- espelho: contas a receber da Meridian = contas a pagar do cliente ----------
function descMeridian(t, portalDe) {
  const m = String(t.chaveImport || "").match(/^PED\|([^|]+)\|([^|]+)(?:\|(\d+))?/);
  if (!m) return String(t.titulo || "Meridian").toUpperCase();
  const [, numero, tipo, n] = m;
  const pt = portalDe[numero] ? ` (portal ${portalDe[numero]})` : "";
  const qual = tipo === "ENTRADA" ? "entrada" : tipo === "PARC" ? `parcela ${n}` : tipo === "SEMNOTA" ? `parcela ${n || ""}`.trim() : tipo.toLowerCase();
  return `PEDIDO ${numero}${pt} · ${qual}`.toUpperCase();
}
export async function espelhoMeridian(cliente) {
  const pps = await prisma.pp.findMany({ where: { portalClienteId: cliente.id, numero: { not: null }, efetivadoEm: { not: null } }, select: { numero: true, portalNumero: true } });
  const portalDe = Object.fromEntries(pps.filter((p) => p.numero).map((p) => [p.numero, fmtNumPortal(p.portalNumero)]));
  const nomes = [...new Set([cliente.nomeFantasia, cliente.razaoSocial].filter(Boolean).map((s) => String(s).trim().toUpperCase()))];
  const doc = so(cliente.cnpj);
  const OR = [
    ...Object.keys(portalDe).map((n) => ({ chaveImport: { startsWith: `PED|${n}|` } })),
    ...(doc ? [{ documento: doc }] : []),
    ...nomes.map((n) => ({ parceiro: { equals: n, mode: "insensitive" } })),
  ];
  if (!OR.length) return [];
  const ts = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: { not: "CANCELADO" }, OR },
    select: { id: true, titulo: true, chaveImport: true, valor: true, valorPago: true, vencimento: true, dataPagamento: true, status: true, previsao: true, numeroDoc: true } });
  return ts.map((t) => ({
    id: `M${t.id}`, meridian: true, tipo: "PAGAR", descricao: descMeridian(t, portalDe), parceiro: "MERIDIAN", numeroDoc: t.numeroDoc || null,
    valor: r2(t.valor), vencimento: iso(t.vencimento), status: t.status === "PAGO" ? "PAGO" : "ABERTO",
    dataPagamento: t.status === "PAGO" ? iso(t.dataPagamento || t.vencimento) : null, valorPago: t.status === "PAGO" ? r2(t.valorPago ?? t.valor) : null,
    previsao: !!t.previsao, conta: CONTA_MERIDIAN,
  }));
}

// ---------- títulos ----------
const tituloOut = (t, contas) => ({
  id: t.id, tipo: t.tipo, descricao: t.descricao, parceiro: t.parceiro, numeroDoc: t.numeroDoc, parcela: t.parcela, parcelas: t.parcelas,
  valor: r2(t.valor), vencimento: iso(t.vencimento), status: t.status, dataPagamento: iso(t.dataPagamento), valorPago: t.valorPago != null ? r2(t.valorPago) : null,
  contaId: t.contaId, conta: contas[t.contaId]?.codigo || null, formaPagamento: t.formaPagamento, ppId: t.ppId, observacao: t.observacao,
  criadoPorNome: t.criadoPorNome, atualizadoPorNome: t.atualizadoPorNome, createdAt: t.createdAt,
});

// período por vencimento (de/ate AAAA-MM-DD) + todas as contas em aberto vencidas antes dele
export async function listarTitulos(cliente, { tipo, de, ate }) {
  const tp = tipo === "RECEBER" ? "RECEBER" : "PAGAR";
  const ini = okData(de) ? de : `${hoje().slice(0, 7)}-01`;
  const fim = okData(ate) ? ate : somaMeses(ini, 1);
  const contasL = await listarContas(cliente.id);
  const contas = Object.fromEntries(contasL.map((c) => [c.id, c]));
  const proprios = await prisma.portalFinTitulo.findMany({ where: { clienteId: cliente.id, tipo: tp, status: { not: "CANCELADO" },
    OR: [{ vencimento: { gte: dUTC(ini), lte: dUTC(fim) } }, { status: "ABERTO", vencimento: { lt: dUTC(ini) } }] }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] });
  let l = proprios.map((t) => tituloOut(t, contas));
  if (tp === "PAGAR") l = l.concat((await espelhoMeridian(cliente)).filter((t) => (t.vencimento >= ini && t.vencimento <= fim) || (t.status === "ABERTO" && t.vencimento < ini)));
  l.sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0));
  const h = hoje();
  const soma = (f) => r2(l.filter(f).reduce((s, t) => s + t.valor, 0));
  const resumo = {
    aberto: soma((t) => t.status === "ABERTO"), vencido: soma((t) => t.status === "ABERTO" && t.vencimento < h),
    venceHoje: soma((t) => t.status === "ABERTO" && t.vencimento === h), pago: r2(l.filter((t) => t.status === "PAGO").reduce((s, t) => s + (t.valorPago ?? t.valor), 0)),
    qtdVencido: l.filter((t) => t.status === "ABERTO" && t.vencimento < h).length,
  };
  return { tipo: tp, de: ini, ate: fim, hoje: h, titulos: l, resumo, contas: contasL.filter((c) => c.ativo) };
}

export async function salvarTitulo(cliente, b, u) {
  const tp = b.tipo === "RECEBER" ? "RECEBER" : "PAGAR";
  const descricao = String(b.descricao || "").trim().toUpperCase().slice(0, 160);
  const valor = r2(num(b.valor));
  if (!descricao) return { error: "Descreva a conta." };
  if (!(valor > 0)) return { error: "Informe o valor." };
  if (!okData(b.vencimento)) return { error: "Informe o vencimento." };
  let contaId = Number(b.contaId) || null;
  if (contaId) {
    const c = await prisma.portalFinConta.findFirst({ where: { id: contaId, clienteId: cliente.id } });
    if (!c) return { error: "Conta do plano inválida." };
    if (c.codigo === CONTA_MERIDIAN) return { error: "A conta \"Compras Meridian\" é preenchida sozinha pelos pedidos. Escolha outra." };
  }
  let ppId = Number(b.ppId) || null;
  if (ppId && !(await prisma.pp.findFirst({ where: { id: ppId, portalClienteId: cliente.id }, select: { id: true } }))) ppId = null;
  const base = {
    descricao, parceiro: String(b.parceiro || "").trim().toUpperCase().slice(0, 120) || null, numeroDoc: String(b.numeroDoc || "").trim().slice(0, 60) || null,
    contaId, formaPagamento: b.formaPagamento || null, ppId, observacao: String(b.observacao || "").trim().slice(0, 500) || null,
  };
  const quem = nomeU(u) || null;
  if (b.id) {
    const t = await prisma.portalFinTitulo.findFirst({ where: { id: Number(b.id), clienteId: cliente.id } });
    if (!t) return { error: "Conta não encontrada." };
    const d = { ...base, valor, vencimento: dUTC(b.vencimento), atualizadoPorNome: quem };
    if (t.status === "PAGO" && b.dataPagamento !== undefined) {
      if (!okData(b.dataPagamento)) return { error: "Data do pagamento inválida." };
      d.dataPagamento = dUTC(b.dataPagamento); d.valorPago = r2(num(b.valorPago)) || valor;
    }
    return { ok: true, titulo: await prisma.portalFinTitulo.update({ where: { id: t.id }, data: d }) };
  }
  // nova: em N parcelas mensais (o valor informado é o total)
  const n = Math.min(Math.max(1, Math.round(num(b.parcelas)) || 1), 48);
  const cada = Math.floor((valor / n) * 100) / 100;
  const grupo = n > 1 ? `G${Date.now()}${Math.floor(Math.random() * 1000)}` : null;
  const pago = !!b.pago;
  if (pago && n > 1) return { error: "Conta já paga: lance em uma parcela só." };
  if (pago && !okData(b.dataPagamento)) return { error: "Informe a data do pagamento." };
  const criadas = [];
  for (let i = 0; i < n; i++) {
    const v = i === n - 1 ? r2(valor - cada * (n - 1)) : cada;
    criadas.push(await prisma.portalFinTitulo.create({ data: {
      clienteId: cliente.id, tipo: tp, ...base, valor: v, vencimento: dUTC(somaMeses(b.vencimento, i)),
      ...(n > 1 ? { parcela: i + 1, parcelas: n, grupoParcelas: grupo, descricao: `${descricao} ${i + 1}/${n}`.slice(0, 160) } : {}),
      ...(pago ? { status: "PAGO", dataPagamento: dUTC(b.dataPagamento), valorPago: r2(num(b.valorPago)) || v } : {}),
      criadoPorNome: quem } }));
  }
  return { ok: true, n: criadas.length };
}

// acao: BAIXAR { data, valor } | ESTORNAR | EXCLUIR
export async function acaoTitulo(cliente, { id, acao, data, valor }, u) {
  const t = await prisma.portalFinTitulo.findFirst({ where: { id: Number(id) || 0, clienteId: cliente.id } });
  if (!t) return { error: String(id).startsWith("M") ? "Conta da Meridian: a baixa é feita pela Meridian quando ela recebe." : "Conta não encontrada." };
  const quem = nomeU(u) || null;
  if (acao === "BAIXAR") {
    if (t.status === "PAGO") return { error: "Esta conta já está baixada." };
    const dt = okData(data) ? data : hoje();
    const v = r2(num(valor)) || r2(t.valor);
    await prisma.portalFinTitulo.update({ where: { id: t.id }, data: { status: "PAGO", dataPagamento: dUTC(dt), valorPago: v, atualizadoPorNome: quem } });
    return { ok: true };
  }
  if (acao === "ESTORNAR") {
    await prisma.portalFinTitulo.update({ where: { id: t.id }, data: { status: "ABERTO", dataPagamento: null, valorPago: null, atualizadoPorNome: quem } });
    return { ok: true };
  }
  if (acao === "EXCLUIR") { await prisma.portalFinTitulo.delete({ where: { id: t.id } }); return { ok: true }; }
  return { error: "Ação inválida." };
}

// pedidos do portal para ligar à conta a receber (preenche cliente final e valor vendido)
export async function pedidosParaReceber(cliente) {
  const pps = await prisma.pp.findMany({ where: { portalClienteId: cliente.id, status: { not: "EXCLUIDO" }, portalEnviadoEm: { not: null } }, orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, portalNumero: true, numero: true, efetivadoEm: true, clienteFinal: true, portalEnviadoEm: true, itens: { select: { quantidade: true, valorVenda: true } } } });
  const ligados = await prisma.portalFinTitulo.groupBy({ by: ["ppId"], where: { clienteId: cliente.id, tipo: "RECEBER", ppId: { in: pps.map((p) => p.id) } }, _sum: { valor: true } }).catch(() => []);
  const jaDe = Object.fromEntries(ligados.map((x) => [x.ppId, r2(x._sum.valor)]));
  return pps.map((p) => {
    const cf = p.clienteFinal || {};
    const venda = r2(p.itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valorVenda) || 0), 0));
    return { id: p.id, numero: fmtNumPortal(p.portalNumero), numeroMeridian: p.efetivadoEm ? p.numero : null, cliente: String((cf.tipo === "PJ" ? cf.razaoSocial : cf.nome) || "").toUpperCase(),
      venda, lancado: jaDe[p.id] || 0, data: iso(p.portalEnviadoEm) };
  });
}

// ---------- análise mensal (DRE simplificada) ----------
// regime REALIZADO: o que foi pago/recebido, pela data do pagamento.
// regime PREVISTO: o realizado + o que está em aberto, pelo vencimento (cenário do ano).
export async function analiseMensal(cliente, { ano, regime }) {
  const a = Number(ano) || Number(hoje().slice(0, 4));
  const prev = regime === "PREVISTO";
  const contasL = await listarContas(cliente.id);
  const porId = Object.fromEntries(contasL.map((c) => [c.id, c]));
  const porCod = Object.fromEntries(contasL.map((c) => [c.codigo, c]));
  const ini = dUTC(`${a}-01-01`), fim = dUTC(`${a}-12-31`);
  const proprios = await prisma.portalFinTitulo.findMany({ where: { clienteId: cliente.id, status: { not: "CANCELADO" },
    OR: [{ dataPagamento: { gte: ini, lte: fim } }, ...(prev ? [{ status: "ABERTO", vencimento: { gte: ini, lte: fim } }] : [])] } });
  const lista = [
    ...proprios.map((t) => ({ tipo: t.tipo, status: t.status, valor: r2(t.valor), valorPago: t.valorPago != null ? r2(t.valorPago) : null, vencimento: iso(t.vencimento), dataPagamento: iso(t.dataPagamento), conta: porId[t.contaId] || null })),
    ...(await espelhoMeridian(cliente)).map((t) => ({ ...t, conta: porCod[CONTA_MERIDIAN] || null })),
  ];
  const semConta = { RECEBER: { id: "SR", codigo: "1.99", nome: "RECEBIMENTOS SEM CONTA", grupo: "RECEITA" }, PAGAR: { id: "SP", codigo: "4.99", nome: "PAGAMENTOS SEM CONTA", grupo: "DESPESA" } };
  const zero = () => Array(12).fill(0);
  const linhas = {};   // contaId → { conta, m[12] }
  const caixa = { entradas: zero(), saidas: zero() };
  const aberto = { receber: zero(), pagar: zero() };
  for (const t of lista) {
    let data, v;
    if (t.status === "PAGO") { data = t.dataPagamento; v = t.valorPago ?? t.valor; }
    else if (prev) { data = t.vencimento; v = t.valor; }
    else continue;
    if (!data || Number(data.slice(0, 4)) !== a) continue;
    const m = Number(data.slice(5, 7)) - 1;
    const c = t.conta || semConta[t.tipo];
    const s = t.tipo === "RECEBER" ? v : -v;
    (linhas[c.id] ||= { conta: c, m: zero() }).m[m] += s;
    if (t.tipo === "RECEBER") caixa.entradas[m] += v; else caixa.saidas[m] += v;
    if (t.status !== "PAGO") { if (t.tipo === "RECEBER") aberto.receber[m] += v; else aberto.pagar[m] += v; }
  }
  const grupos = GRUPOS.map((g) => {
    const cs = Object.values(linhas).filter((l) => l.conta.grupo === g.k).sort((x, y) => (x.conta.codigo < y.conta.codigo ? -1 : 1))
      .map((l) => ({ codigo: l.conta.codigo, nome: l.conta.nome, m: l.m.map(r2), total: r2(l.m.reduce((s, x) => s + x, 0)) }));
    const m = zero().map((_, i) => r2(cs.reduce((s, c) => s + c.m[i], 0)));
    return { k: g.k, nome: g.nome, contas: cs, m, total: r2(m.reduce((s, x) => s + x, 0)) };
  });
  const G = Object.fromEntries(grupos.map((g) => [g.k, g.m]));
  const somaM = (...ks) => zero().map((_, i) => r2(ks.reduce((s, k) => s + G[k][i], 0)));
  const receitaLiq = somaM("RECEITA", "DEDUCAO");
  const margem = zero().map((_, i) => r2(receitaLiq[i] + G.CMV[i]));
  const ebitda = zero().map((_, i) => r2(margem[i] + G.DESPESA[i]));
  const lucro = zero().map((_, i) => r2(ebitda[i] + G.IMPOSTO[i] + G.FINANCEIRO[i]));
  const resultado = zero().map((_, i) => r2(lucro[i] + G.INVESTIMENTO[i]));
  const tot = (arr) => r2(arr.reduce((s, x) => s + x, 0));
  const pct = (arr) => arr.map((x, i) => (G.RECEITA[i] ? Math.round((x / G.RECEITA[i]) * 1000) / 10 : null));
  const res = (k, nome, arr) => ({ k, nome, m: arr, total: tot(arr), pct: pct(arr), pctTotal: tot(G.RECEITA) ? Math.round((tot(arr) / tot(G.RECEITA)) * 1000) / 10 : null });
  const saldo = zero().map((_, i) => r2(caixa.entradas[i] - caixa.saidas[i]));
  let acc = 0;
  return {
    ano: a, regime: prev ? "PREVISTO" : "REALIZADO", hoje: hoje(),
    grupos,
    resultados: {
      receitaLiquida: res("receitaLiquida", "Receita líquida", receitaLiq), margem: res("margem", "Margem bruta", margem),
      ebitda: res("ebitda", "EBITDA", ebitda), lucro: res("lucro", "Lucro líquido", lucro), resultado: res("resultado", "Resultado de caixa (após investimentos)", resultado),
    },
    caixa: { entradas: caixa.entradas.map(r2), saidas: caixa.saidas.map(r2), saldo, acumulado: saldo.map((x) => r2((acc += x))) },
    aberto: { receber: aberto.receber.map(r2), pagar: aberto.pagar.map(r2) },
  };
}

