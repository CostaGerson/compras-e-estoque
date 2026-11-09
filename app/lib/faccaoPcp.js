// v501 — contas a pagar de facção vindas do Cronograma PCP (/api/ext/faccao/apagar): só OS FECHADA.
// Regras do Maycon: a chave é o nº da OS (nunca duplica) · paga-se o valorLiquido · valor unitário chega resolvido ·
// itemCode liga ao item de produção · uma OS é de um item (romaneio agrupa a viagem).
// Lançamento só pela tela de conferência: cada OS vira um item dos "terceirizados da semana" (mesma conta-caixa de facção de hoje).
import { prisma } from "@/lib/prisma";
import { getPcp } from "@/lib/cronograma";
import { TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS, contaDoSetor, garantirContasPrestadores } from "@/lib/prestadores";
import { tituloDaData, recalcular } from "@/lib/finSemana";

const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const so = (v) => String(v || "").replace(/\D/g, "");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);

// tipo de peça (conta de facção) pelo nome do produto; null = não reconheceu (o operador escolhe)
export function tipoDePeca(produto) {
  const t = sa(produto);
  if (/JAQUETA|CORTA VENTO|PARKA/.test(t)) return "JAQUETA";
  if (/MOLETOM|BLUSAO|CANGURU/.test(t)) return "MOLETOM";
  if (/POLO/.test(t)) return "POLO";
  if (/CAMISA SOCIAL|CAMISA MANGA|CAMISA M L|CAMISA M C/.test(t)) return "CAMISA_SOCIAL";
  if (/JALECO|GUARDA PO|CAMISA OPERACIONAL|BRIM/.test(t) && !/CALCA/.test(t)) return "JALECO_OPERACIONAL";
  if (/CALCA/.test(t)) return /JEANS/.test(t) ? "CALCA_JEANS" : /SOCIAL|ALFAIATARIA/.test(t) ? "CALCA_SOCIAL" : "CALCA_OPERACIONAL";
  if (/CAMISETA|BABY ?LOOK|REGATA|T SHIRT|TSHIRT/.test(t)) return "CAMISETA";
  return null;
}
// grupo: costura/facção → FACCAO (tipo de peça por linha); serviço conhecido (silk, bordado…) → o próprio serviço
function grupoDe(c) {
  const sv = sa(c.servico);
  const serv = SERVICOS_TERCEIRIZADOS.find((s) => sv && (sv === s.k || sv.includes(s.k)));
  return serv && serv.k !== "OUTRO" ? serv.k : "FACCAO";
}
async function acharFaccao(os, lista) {
  const doc = so(os.faccaoDocumento), n = sa(os.faccao);
  return (doc && lista.find((p) => so(p.documento) === doc))
    || lista.find((p) => sa(p.nome) === n || sa(p.nomeKm) === n)
    || lista.find((p) => n && (sa(p.nome).startsWith(n + " ") || n.startsWith(sa(p.nome) + " ")))
    || lista.find((p) => n && n.split(" ").length === 1 && sa(p.nome).split(" ")[0] === n) || null;
}
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const brl = (v) => r2(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dias = (de, ate) => Math.round((dUTC(ate) - dUTC(de)) / 86400e3);
// primeira sexta a partir da data (a própria, se for sexta)
function sextaDe(venc) {
  const d = dUTC(venc); const add = (5 - d.getUTCDay() + 7) % 7;
  return iso(d.getTime() + add * 86400e3);
}

// v726 — a conta do PCP como ela vai para a tela "Editar facção" (doc do Maycon de 06/11):
// uma linha por itens[] (qtd aprovada × unitário), recebido = retornadoEm, prazo = vencimento − retornadoEm, pagamento na
// primeira sexta a partir do vencimento. Desconto do PCP (líquido < bruto) vira uma linha negativa. Não bate → aviso, não ajusta.
// setorPadrao: tipo de peça escolhido na conferência para as linhas que o nome do produto não identificou.
export function montarConta(c, { setorPadrao } = {}) {
  const grupo = grupoDe(c);
  const its = Array.isArray(c.itens) ? c.itens.filter((x) => x && (Number(x.quantidadeAprovada) || Number(x.valor))) : [];
  const avisos = [];
  let linhas;
  if (its.length) {
    linhas = its.map((x) => {
      const qtd = Number(x.quantidadeAprovada) || 0, unitario = r2(x.valorUnitario), total = r2(qtd * unitario);
      if (x.valor != null && Math.abs(total - r2(x.valor)) > 0.01) avisos.push(`Item ${x.itemCode || x.produto}: ${qtd} × ${brl(unitario)} = ${brl(total)}, mas o PCP diz ${brl(x.valor)}.`);
      const tipo = grupo === "FACCAO" ? tipoDePeca(x.produto) || setorPadrao || null : null;
      return { pedido: String(x.pedido || "").trim().toUpperCase(), item: String(x.produto || "").trim().toUpperCase().slice(0, 200) || null,
        ...(x.itemCode ? { itemCode: String(x.itemCode) } : {}), ...(tipo ? { tipo } : {}), qtd, unitario, total };
    });
  } else {
    // PCP antigo, sem itens[]: o resumo da conta (1 item)
    const qtd = Number(c.quantidadeAprovada) || 0, unit = r2(c.valorUnitario);
    const ok = qtd > 0 && unit > 0;
    const tipo = grupo === "FACCAO" ? tipoDePeca(c.produto) || setorPadrao || null : null;
    linhas = [{ pedido: String(c.pedido || "").trim().toUpperCase(), item: String(c.produto || "").trim().toUpperCase().slice(0, 200) || null,
      ...(c.itemCode ? { itemCode: String(c.itemCode) } : {}), ...(tipo ? { tipo } : {}), qtd: ok ? qtd : 1, unitario: ok ? unit : r2(c.valorBruto || c.valorLiquido), total: ok ? r2(qtd * unit) : r2(c.valorBruto || c.valorLiquido) }];
    avisos.push("O PCP não mandou o detalhe dos itens (itens[]): linha montada pelo resumo da conta.");
  }
  const soma = r2(linhas.reduce((s, l) => s + l.total, 0));
  const bruto = r2(c.valorBruto), liquido = r2(c.valorLiquido);
  if (bruto && Math.abs(soma - bruto) > 0.01) avisos.push(`Os itens somam R$ ${brl(soma)} e o bruto do PCP é R$ ${brl(bruto)}. Confira a OS no PCP antes de lançar.`);
  const desconto = r2(bruto - liquido);
  const principal = grupo === "FACCAO" ? (() => { const t = {}; for (const l of linhas) if (l.tipo) t[l.tipo] = (t[l.tipo] || 0) + l.total; return Object.entries(t).sort((x, y) => y[1] - x[1])[0]?.[0] || setorPadrao || null; })() : grupo;
  if (desconto > 0.01) {
    const mot = (c.descontos || []).map((d) => `${d.motivo || "desconto"}${d.quantidade ? ` ${d.quantidade}` : ""}`).join(", ");
    linhas.push({ pedido: "DESCONTO", item: `DESCONTO NO PCP${mot ? `: ${mot}` : ""}`.toUpperCase().slice(0, 200), ...(grupo === "FACCAO" && principal ? { tipo: principal } : {}),
      qtd: 1, unitario: -desconto, total: -desconto, desconto: true });
  } else if (desconto < -0.01) avisos.push(`O líquido (R$ ${brl(liquido)}) é maior que o bruto (R$ ${brl(bruto)}).`);
  const semTipo = grupo === "FACCAO" && linhas.some((l) => !l.tipo);
  // datas
  const receb = c.retornadoEm || c.fechadaEm || c.vencimento || null;
  const venc = c.vencimento || receb;
  const prazoDias = receb && c.vencimento ? Math.max(0, dias(receb, c.vencimento)) : 0;
  const sexta = venc ? sextaDe(venc) : null;
  const env = its.length ? its.reduce((s, x) => s + (Number(x.quantidadeEnviada) || 0), 0) : Number(c.quantidadeEnviada) || 0;
  const apr = linhas.filter((l) => !l.desconto).reduce((s, l) => s + l.qtd, 0);
  const soma3 = (k) => its.reduce((s, x) => s + (Number(x[k]) || 0), 0) || Number(c[k]) || 0;
  const pedidos = [...new Set(linhas.filter((l) => !l.desconto).map((l) => l.pedido).filter(Boolean))];
  const um = linhas.filter((l) => !l.desconto).length === 1;
  const observacao = [`PCP OS ${c.os}${c.romaneio ? ` · ROMANEIO ${c.romaneio}` : ""} · ACERTO ${chaveConta(c)}`,
    `${linhas.filter((l) => !l.desconto).length} ${um ? "ITEM" : "ITENS"}`, `ENVIADAS ${env} · APROVADAS ${apr}`,
    soma3("quantidadePerdida") ? `PERDA ${soma3("quantidadePerdida")}` : null, soma3("quantidadeSegunda") ? `2ª ${soma3("quantidadeSegunda")}` : null,
    soma3("quantidadeRetrabalho") ? `RETRABALHO ${soma3("quantidadeRetrabalho")}` : null,
    um ? `UNIT. R$ ${brl(linhas[0].unitario)}` : null, `BRUTO R$ ${brl(bruto || soma)}`,
    desconto > 0.01 ? `DESCONTO R$ ${brl(desconto)} · LÍQUIDO R$ ${brl(liquido)}` : null,
    c.vencimento ? `VENC. ${c.vencimento.split("-").reverse().join("/")}` : null].filter(Boolean).join(" · ").toUpperCase();
  return { grupo, setor: principal, linhas, valor: r2(linhas.reduce((s, l) => s + l.total, 0)), soma, bruto, liquido, desconto: desconto > 0 ? desconto : 0,
    recebimento: receb, prazoDias, vencimento: venc, sexta, observacao, avisos, semTipo, pedidos, qtdEnviada: env, qtdAprovada: apr, nItens: linhas.filter((l) => !l.desconto).length,
    bate: !(bruto && Math.abs(soma - bruto) > 0.01) && Math.abs(r2(linhas.reduce((s, l) => s + l.total, 0)) - liquido) <= 0.01 };
}

// v669 — chave da conta no PCP: "lancamento" ("12", "12-1"); PCP antigo sem o campo → nº da OS
export const chaveConta = (c) => String(c?.lancamento ?? c?.os ?? "").trim();
// registros antigos (antes da v669) ganham a chave = nº da OS
async function migrarChaves() {
  const velhos = await prisma.faccaoOsPcp.findMany({ where: { lancamento: null }, select: { id: true, os: true } });
  for (const v of velhos) await prisma.faccaoOsPcp.update({ where: { id: v.id }, data: { lancamento: String(v.os), parcela: 0 } }); }

// tela de conferência: contas do PCP (fechamento e parciais) + lançada / descartada + facção e conta encontradas
export async function conferirFaccoes({ desde } = {}) {
  let j;
  try { j = await getPcp(`/api/ext/faccao/apagar${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`); }
  catch (e) { return { erro: /HTTP 404/.test(e.message) ? "O endereço de facções do Cronograma ainda não está publicado (o Maycon está construindo)." : e.message, contas: [] }; }
  // v669 — FECHADA (parcela 0) e PARCIAL (recebimentos parciais) são contas a pagar
  const contas = (Array.isArray(j?.contas) ? j.contas : []).filter((c) => ["FECHADA", "PARCIAL"].includes(String(c.status || "").toUpperCase()) && Number(c.os) && chaveConta(c));
  await migrarChaves();
  const regs = await prisma.faccaoOsPcp.findMany({ where: { lancamento: { in: contas.map(chaveConta) } }, orderBy: { id: "asc" } });
  const ja = {}, desc = {}, hist = {};
  for (const x of regs) { (hist[x.lancamento] ||= []).push(x); if (x.status === "LANCADA") ja[x.lancamento] = x; if (x.status === "DESCARTADA") desc[x.lancamento] = x; }
  const prest = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" } });
  const out = [];
  for (const c of contas) {
    const p = await acharFaccao(c, prest);
    const m = montarConta(c);
    const k = chaveConta(c), L = ja[k], D = desc[k];
    const item = L?.semanaItemId ? await prisma.finSemanaItem.findUnique({ where: { id: L.semanaItemId }, select: { pago: true, lancamentoId: true, linhas: true } }) : null;
    const ls = Array.isArray(item?.linhas) ? item.linhas : [];
    out.push({ ...c, lancamento: k, os: Number(c.os), parcela: c.parcela ?? 0, valorLiquido: r2(c.valorLiquido), valorBruto: r2(c.valorBruto), jaLancadoEmPartes: c.jaLancadoEmPartes != null ? r2(c.jaLancadoEmPartes) : null,
      lancada: !!L, lancadaEm: L?.createdAt || null, lancadaPor: L?.lancadoPorNome || null, paga: !!(item && (item.pago || item.lancamentoId)),
      // v726 — lançada no formato antigo (1 × total): pode ser regravada com as linhas e datas certas
      formatoAntigo: !!L && ls.length === 1 && Number(ls[0].qtd) === 1 && !ls[0].itemCode && (m.nItens > 1 || m.qtdAprovada > 1),
      descartada: !!D, descartadaPor: D?.descartadoPorNome || null, descartadaEm: D?.descartadoEm || null, motivoDescarte: D?.motivo || null,
      estornos: (hist[k] || []).filter((x) => x.status === "ESTORNADA").map((x) => ({ por: x.estornadoPorNome, em: x.estornadoEm, motivo: x.motivo, valor: r2(x.valor) })),
      prestador: p ? { id: p.id, nome: p.nome, pix: !!p.chavePix, ativo: p.ativo } : null, grupo: m.grupo, setor: m.setor, conta: m.setor ? contaDoSetor(m.grupo, m.setor) : null,
      sexta: m.sexta, recebimento: m.recebimento, prazoDias: m.prazoDias, linhas: m.linhas, nItens: m.nItens, pedidos: m.pedidos, semTipo: m.semTipo,
      qtdEnviadaTotal: m.qtdEnviada, qtdAprovadaTotal: m.qtdAprovada, avisos: m.avisos, bate: m.bate });
  }
  out.sort((a, b) => (a.lancada - b.lancada) || (a.descartada - b.descartada) || String(a.vencimento || "").localeCompare(String(b.vencimento || "")) || a.os - b.os || (a.parcela || 0) - (b.parcela || 0));
  return { ok: true, geradoEm: j?.geradoEm || null, contas: out };
}

// v726 — linhas com a conta-caixa do tipo de peça (o rateio da semana sai por linha, como na tela Editar facção)
async function linhasComConta(m) {
  if (m.grupo !== "FACCAO") return m.linhas.map((l) => ({ ...l }));
  const cods = [...new Set(m.linhas.map((l) => contaDoSetor("FACCAO", l.tipo)).filter(Boolean))];
  const cs = await prisma.finConta.findMany({ where: { codigo: { in: cods } }, select: { id: true, codigo: true } });
  const id = Object.fromEntries(cs.map((x) => [x.codigo, x.id]));
  return m.linhas.map((l) => ({ ...l, contaId: id[contaDoSetor("FACCAO", l.tipo)] || null }));
}
const descricaoDe = (c) => `OS ${chaveConta(c)} PCP · ${c.servico || "FACÇÃO"}${String(c.status || "").toUpperCase() === "PARCIAL" ? " · PARCIAL" : ""}`.toUpperCase();
async function gravarItem(m, p, { quem, c }) {
  const conta = await prisma.finConta.findUnique({ where: { codigo: contaDoSetor(m.grupo, m.setor) } });
  if (!conta) return { erro: "Conta-caixa do tipo de peça / serviço não encontrada." };
  const casca = await tituloDaData("TERCEIRIZADO", m.sexta || new Date().toISOString().slice(0, 10), false);
  const item = await prisma.finSemanaItem.create({ data: {
    tituloId: casca.id, grupo: m.grupo, prestadorId: p.id, nome: p.nome.toUpperCase(), chavePix: p.chavePix || "", setor: m.setor, contaId: conta.id,
    linhas: await linhasComConta(m), valor: m.valor,
    dataRecebimento: m.recebimento ? dUTC(m.recebimento) : null, prazoDias: m.prazoDias, vencimentoNegociado: m.vencimento ? dUTC(m.vencimento) : null,
    descricao: descricaoDe(c), observacao: [m.observacao, p.chavePix ? null : "SEM PIX NO CADASTRO"].filter(Boolean).join(" · ").slice(0, 1000),
    criadoPorNome: quem || null,
  } });
  return { item };
}

// v726 — contas lançadas no formato antigo (1 × total, prazo 0): regrava linhas e datas pela chave "lancamento".
// Conta paga: só as linhas (histórico), sem mexer no valor nem no pagamento. Nunca cria conta nova.
export async function regravarFaccoes(chaves, quem) {
  const conf = await conferirFaccoes();
  if (conf.erro) return { error: conf.erro };
  const alvo = (conf.contas || []).filter((c) => c.lancada && (chaves?.length ? chaves.map(String).includes(c.lancamento) : c.formatoAntigo));
  const res = [], semanas = new Set();
  for (const c of alvo) {
    const reg = await prisma.faccaoOsPcp.findFirst({ where: { lancamento: c.lancamento, status: "LANCADA" }, orderBy: { id: "desc" } });
    const it = reg?.semanaItemId ? await prisma.finSemanaItem.findUnique({ where: { id: reg.semanaItemId } }) : null;
    if (!it) { res.push({ lancamento: c.lancamento, erro: "Item do contas a pagar não encontrado (baixa parcial ou apagado)." }); continue; }
    const ls0 = Array.isArray(it.linhas) ? it.linhas : [];
    const setorAntigo = ls0[0]?.tipo || it.setor;
    const m = montarConta(c, { setorPadrao: it.grupo === "FACCAO" ? setorAntigo : null });
    if (!m.bate) { res.push({ lancamento: c.lancamento, erro: m.avisos.join(" ") }); continue; }
    if (m.semTipo || !m.setor) { res.push({ lancamento: c.lancamento, erro: "Tipo de peça não identificado." }); continue; }
    const linhas = await linhasComConta(m);
    const paga = !!(it.pago || it.lancamentoId);
    if (paga) {
      if (Math.abs(Number(it.valor) - m.valor) > 0.01) { res.push({ lancamento: c.lancamento, erro: `Paga com R$ ${brl(it.valor)} e o PCP soma R$ ${brl(m.valor)}: não mexi.` }); continue; }
      await prisma.finSemanaItem.update({ where: { id: it.id }, data: { linhas, observacao: m.observacao.slice(0, 1000) } });
      semanas.add(it.tituloId);
      res.push({ lancamento: c.lancamento, ok: true, so: "linhas (paga)" });
      continue;
    }
    const conta = await prisma.finConta.findUnique({ where: { codigo: contaDoSetor(m.grupo, m.setor) } });
    const casca = it.excepcional ? { id: it.tituloId } : await tituloDaData("TERCEIRIZADO", m.sexta, false);
    await prisma.finSemanaItem.update({ where: { id: it.id }, data: {
      tituloId: casca.id, setor: m.setor, ...(conta ? { contaId: conta.id } : {}), linhas, valor: m.valor,
      dataRecebimento: m.recebimento ? dUTC(m.recebimento) : null, prazoDias: m.prazoDias, vencimentoNegociado: m.vencimento ? dUTC(m.vencimento) : null,
      observacao: [m.observacao, it.chavePix ? null : "SEM PIX NO CADASTRO"].filter(Boolean).join(" · ").slice(0, 1000) } });
    await prisma.faccaoOsPcp.update({ where: { id: reg.id }, data: { dados: c, tituloId: casca.id, valor: m.valor } });
    semanas.add(it.tituloId); semanas.add(casca.id);
    res.push({ lancamento: c.lancamento, ok: true, sexta: it.excepcional ? null : m.sexta, mudouSemana: casca.id !== it.tituloId });
  }
  for (const t of semanas) await recalcular(t).catch(() => null);
  return { ok: true, resultados: res, total: alvo.length };
}

// lança as contas escolhidas: [{ lancamento, prestadorId?, setor? }] (o operador pode corrigir facção e tipo de peça)
export async function lancarFaccoes(escolhas, quem) {
  const conf = await conferirFaccoes();
  if (conf.erro) return { error: conf.erro };
  await garantirContasPrestadores();
  const res = [], semanas = new Set();
  for (const e of escolhas || []) {
    const k = String(e.lancamento ?? e.os);
    const c = conf.contas.find((x) => x.lancamento === k);
    if (!c) { res.push({ os: e.os, lancamento: k, erro: "Conta não está mais no PCP." }); continue; }
    if (c.descartada) { res.push({ os: c.os, lancamento: k, erro: "Descartada — reative em Todas." }); continue; }
    if (c.lancada || (await prisma.faccaoOsPcp.findFirst({ where: { lancamento: k, status: "LANCADA" } }))) { res.push({ os: c.os, lancamento: k, erro: "Já lançada." }); continue; }
    const p = e.prestadorId ? await prisma.prestador.findUnique({ where: { id: Number(e.prestadorId) } }) : c.prestador ? await prisma.prestador.findUnique({ where: { id: c.prestador.id } }) : null;
    if (!p) { res.push({ os: c.os, erro: `Facção "${c.faccao}" não encontrada no cadastro de terceirizados.` }); continue; }
    const m = montarConta(c, { setorPadrao: e.setor && c.grupo === "FACCAO" ? e.setor : null });
    if (!m.bate) { res.push({ os: c.os, lancamento: k, erro: m.avisos.join(" ") || "Valores não batem." }); continue; }
    if (m.semTipo || !m.setor) { res.push({ os: c.os, lancamento: k, erro: "Escolha o tipo de peça (o nome do produto não identificou)." }); continue; }
    const r = await gravarItem(m, p, { quem, c });
    if (r.erro) { res.push({ os: c.os, lancamento: k, erro: r.erro }); continue; }
    const item = r.item, casca = { id: r.item.tituloId };
    await prisma.faccaoOsPcp.create({ data: { os: c.os, lancamento: c.lancamento, parcela: c.parcela ?? 0, status: "LANCADA", dados: c, semanaItemId: item.id, tituloId: casca.id, prestadorId: p.id, valor: c.valorLiquido, lancadoPorNome: quem || null } });
    semanas.add(casca.id);
    res.push({ os: c.os, lancamento: c.lancamento, ok: true, valor: c.valorLiquido, sexta: m.sexta, faccao: p.nome });
  }
  for (const t of semanas) await recalcular(t);
  return { ok: true, resultados: res };
}

// lista de facções (terceirizados) para o Cronograma, uma vez na implantação
export async function listaFaccoes() {
  const l = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" }, orderBy: { nome: "asc" } });
  return l.map((p) => ({ id: p.id, nome: p.nome, documento: so(p.documento) || "", nomeKm: p.nomeKm || null, ativo: p.ativo,
    servicos: (Array.isArray(p.servicos) ? p.servicos : []).map(String) }));
}

// v669 — estornar (Lançadas): apaga o item do contas a pagar e devolve a conta para "A lançar". Título com baixa → recusa.
export async function estornarFaccoes(chaves, quem, motivo) {
  const res = [], semanas = new Set();
  for (const k0 of chaves || []) {
    const k = String(k0);
    const r = await prisma.faccaoOsPcp.findFirst({ where: { lancamento: k, status: "LANCADA" } });
    if (!r) { res.push({ lancamento: k, erro: "Não está lançada." }); continue; }
    const it = r.semanaItemId ? await prisma.finSemanaItem.findUnique({ where: { id: r.semanaItemId } }) : null;
    if (it && (it.pago || it.lancamentoId)) { res.push({ lancamento: k, erro: "Já tem baixa (paga) no contas a pagar — cancele a baixa antes de estornar." }); continue; }
    if (it) { await prisma.finSemanaItem.delete({ where: { id: it.id } }); semanas.add(it.tituloId); }
    await prisma.faccaoOsPcp.update({ where: { id: r.id }, data: { status: "ESTORNADA", estornadoPorNome: quem || null, estornadoEm: new Date(), motivo: motivo ? String(motivo).slice(0, 500) : null } });
    res.push({ lancamento: k, ok: true, valor: r2(r.valor) });
  }
  for (const t of semanas) await recalcular(t).catch(() => null);
  return { ok: true, resultados: res };
}
// v669 — descartar (A lançar): sai da fila sem lançamento; continua em "Todas" com o motivo
export async function descartarFaccoes(chaves, quem, motivo) {
  if (String(motivo || "").trim().length < 3) return { error: "Escreva o motivo do descarte." };
  const conf = await conferirFaccoes();
  if (conf.erro) return { error: conf.erro };
  const res = [];
  for (const k0 of chaves || []) {
    const k = String(k0);
    const c = conf.contas.find((x) => x.lancamento === k);
    if (!c) { res.push({ lancamento: k, erro: "Conta não está no PCP." }); continue; }
    if (c.lancada) { res.push({ lancamento: k, erro: "Já lançada — estorne antes." }); continue; }
    if (c.descartada) { res.push({ lancamento: k, ok: true }); continue; }
    await prisma.faccaoOsPcp.create({ data: { os: c.os, lancamento: k, parcela: c.parcela ?? 0, status: "DESCARTADA", dados: c, valor: c.valorLiquido || 0,
      motivo: String(motivo).trim().slice(0, 500), descartadoPorNome: quem || null, descartadoEm: new Date() } });
    res.push({ lancamento: k, ok: true });
  }
  return { ok: true, resultados: res };
}
// v669 — reativar (Todas): desfaz o descarte; a conta volta para "A lançar"
export async function reativarFaccoes(chaves, quem) {
  const res = [];
  for (const k0 of chaves || []) {
    const k = String(k0);
    const r = await prisma.faccaoOsPcp.findFirst({ where: { lancamento: k, status: "DESCARTADA" } });
    if (!r) { res.push({ lancamento: k, erro: "Não está descartada." }); continue; }
    await prisma.faccaoOsPcp.update({ where: { id: r.id }, data: { status: "REATIVADA", motivo: `${r.motivo || ""} · REATIVADA POR ${quem || "?"} EM ${new Date().toLocaleDateString("pt-BR")}`.slice(0, 500) } });
    res.push({ lancamento: k, ok: true });
  }
  return { ok: true, resultados: res };
}
