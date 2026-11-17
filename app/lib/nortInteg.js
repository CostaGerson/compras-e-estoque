// v906 — Integração com o sistema da loja NORT (Gerson)
//   · Peças prontas: o estoque é lançado no sistema da NORT; o ERP recebe cada movimento (entrada, venda, ajuste) por depósito
//     (SEDE | LOJA | ML), soma os saldos, relaciona o custo pela FPP do Item Padrão ligado ao nome e avisa Compras abaixo do mínimo.
//     Uma vez por dia a NORT manda o saldo completo (conferência): o ERP se alinha a ele e registra a divergência.
//   · Encomenda personalizada: vira pedido INTERNO da NORT (sem contas a receber da Meridian). Só segue para a produção quando
//     todos os itens têm FPP (pela equivalência de nome → Item Padrão NORT ou indexada no editor). Ao efetivar, o custo da FPP
//     × quantidade vai para o acerto NORT (conta "NORT - PEDIDO …" na guia NORT).
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const K_TOKEN = "NORT|TOKEN";
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
export const normNome = (s) => String(s || "").normalize("NFC").toUpperCase().replace(/\s+/g, " ").trim().slice(0, 200);
export const DEPOSITOS = ["SEDE", "LOJA", "ML"];   // v910 — ML = Mercado Livre
const CAMPO = { SEDE: "saldoSede", LOJA: "saldoLoja", ML: "saldoMl" };
// nome do depósito no sistema da NORT/Bling → SEDE | LOJA | ML (Reserva Fábrica = SEDE)
export function depositoDe(d) {
  const x = String(d || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/MERCADO|\bML\b|MELI/.test(x)) return "ML";
  if (/LOJA/.test(x)) return "LOJA";
  if (/SEDE|RESERVA|FABRICA|MATRIZ/.test(x)) return "SEDE";
  return null;
}

// ---------- token próprio da NORT (separado do token do PCP) ----------
export async function tokenNort(renovar = false) {
  if (process.env.NORT_EXT_TOKEN && process.env.NORT_EXT_TOKEN.length >= 16) return process.env.NORT_EXT_TOKEN;
  const atual = (await prisma.finConfig.findUnique({ where: { chave: K_TOKEN } }).catch(() => null))?.valor;
  if (atual && !renovar) return atual;
  const novo = crypto.randomBytes(24).toString("hex");
  await prisma.finConfig.upsert({ where: { chave: K_TOKEN }, create: { chave: K_TOKEN, valor: novo }, update: { valor: novo } });
  return novo;
}
export async function autorizadoNort(req) {
  const k = req.headers.get("x-api-key") || "";
  if (!k) return false;
  const t = await tokenNort();
  const a = Buffer.from(k), b = Buffer.from(t);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- itens e custo ----------
// v921 — o estoque da loja vem por tamanho ("CAMISETA ALGODÃO 30.1 PRETO M") e o pedido sem ("CAMISETA ALGODÃO 30.1 PRETO"):
//   modelo = nome sem o tamanho no fim. Indexar um tamanho indexa o modelo inteiro.
const TAM_FIM = /\s+(PPP|PP|P|M|G|GG|XG|XGG|EXG|EXGG|EXGGG|G[1-6]|G\/(?:PP|P|M|G|GG|G[1-6])|BL\s?(?:PP|P|M|G|GG|XG)|\d{1,2}|U|UN|UNICO|ÚNICO|ESP)$/;
export const modeloNort = (s) => normNome(s).replace(TAM_FIM, "").trim();
async function padraoDoModelo(n) {
  const mod = modeloNort(n);
  if (!mod) return null;
  const irmaos = await prisma.nortItem.findMany({ where: { itemPadraoId: { not: null }, OR: [{ nome: mod }, { nome: { startsWith: `${mod} ` } }] }, select: { nome: true, itemPadraoId: true } });
  return irmaos.find((x) => modeloNort(x.nome) === mod || x.nome === mod)?.itemPadraoId || null;
}
export async function indexarModelo(item, itemPadraoId) {
  const mod = modeloNort(item.nome);
  const l = await prisma.nortItem.findMany({ where: { OR: [{ nome: mod }, { nome: { startsWith: `${mod} ` } }] }, select: { id: true, nome: true } });
  const ids = l.filter((x) => modeloNort(x.nome) === mod || x.nome === mod).map((x) => x.id);
  if (!ids.includes(item.id)) ids.push(item.id);
  await prisma.nortItem.updateMany({ where: { id: { in: ids } }, data: { itemPadraoId: itemPadraoId || null } });
  return ids.length;
}
export async function itemPorNome(nome, { sku, criar = true } = {}) {
  const n = normNome(nome);
  if (!n) return null;
  let x = await prisma.nortItem.findUnique({ where: { nome: n } });
  if (x && !x.itemPadraoId) { const ip = await padraoDoModelo(n); if (ip) x = await prisma.nortItem.update({ where: { id: x.id }, data: { itemPadraoId: ip } }); }   // v921
  if (x || !criar) return x;
  const ip = await padraoDoModelo(n);
  try { return await prisma.nortItem.create({ data: { nome: n, sku: sku ? String(sku).slice(0, 80) : null, ...(ip ? { itemPadraoId: ip } : {}) } }); }
  catch { return prisma.nortItem.findUnique({ where: { nome: n } }); }   // criado ao mesmo tempo
}

// custo unitário = custo de produção da FPP do Item Padrão ligado (sem FPP = sem custo)
export async function custosDosItens(itens) {
  const ipIds = [...new Set(itens.map((i) => i.itemPadraoId).filter(Boolean))];
  const ips = ipIds.length ? await prisma.itemPadrao.findMany({ where: { id: { in: ipIds } }, select: { id: true, nomeInterno: true, codigoPadrao: true, fppId: true, fppNumero: true } }) : [];
  const fppIds = [...new Set(ips.map((i) => i.fppId).filter(Boolean))];
  const fpps = fppIds.length ? await prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, numero: true, custoProducao: true } }) : [];
  const IP = Object.fromEntries(ips.map((i) => [i.id, i])), F = Object.fromEntries(fpps.map((f) => [f.id, f]));
  return Object.fromEntries(itens.map((i) => {
    const ip = i.itemPadraoId ? IP[i.itemPadraoId] : null, f = ip?.fppId ? F[ip.fppId] : null;
    return [i.id, { itemPadrao: ip ? { id: ip.id, nome: ip.nomeInterno, codigo: ip.codigoPadrao || null } : null, fppNumero: f?.numero ?? ip?.fppNumero ?? null,
      custo: f && Number(f.custoProducao) > 0 ? r2(f.custoProducao) : null }];
  }));
}

// ---------- estoque mínimo: aviso para Compras ----------
async function verificarMinimo(item) {
  if (item.minimo == null) return;
  const total = num(item.saldoSede) + num(item.saldoLoja) + num(item.saldoMl), min = num(item.minimo);
  if (total >= min) { if (item.avisoMinEm) await prisma.nortItem.update({ where: { id: item.id }, data: { avisoMinEm: null } }); return; }
  if (item.avisoMinEm) return;   // já avisado; só avisa de novo depois de voltar acima
  const us = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ setor: "COMPRAS" }, { isMaster: true }] }, select: { id: true } }).catch(() => []);
  const txt = `📦 ESTOQUE MÍNIMO — ${item.nome}: ${r3(total)} peça(s) (SEDE ${r3(item.saldoSede)} · LOJA ${r3(item.saldoLoja)} · MERCADO LIVRE ${r3(item.saldoMl)}), abaixo do mínimo de ${r3(min)}. Veja em Produção › Estoque › Peças prontas.`;
  if (us.length) await prisma.mensagem.createMany({ data: us.map((u) => ({ deId: u.id, paraId: u.id, texto: txt.slice(0, 2000) })) }).catch(() => null);
  await prisma.nortItem.update({ where: { id: item.id }, data: { avisoMinEm: new Date() } });
}

// ---------- movimentos ----------
// [{ id, nome, sku?, deposito: SEDE|LOJA, tipo: ENTRADA|SAIDA|AJUSTE, quantidade, data?, ref?, obs? }]
export async function registrarMovimentos(lista) {
  const res = { gravados: 0, repetidos: 0, erros: [] };
  for (const [i, m] of (Array.isArray(lista) ? lista : []).entries()) {
    const ident = String(m?.id ?? "").trim(), dep = String(m?.deposito || "").toUpperCase(), tipo = String(m?.tipo || "").toUpperCase(), q = num(m?.quantidade);
    const onde = `movimento ${i + 1}${ident ? ` (${ident})` : ""}`;
    if (!ident) { res.erros.push(`${onde}: falta o id do movimento.`); continue; }
    if (!normNome(m?.nome)) { res.erros.push(`${onde}: falta o nome do item.`); continue; }
    if (!DEPOSITOS.includes(dep)) { res.erros.push(`${onde}: depósito deve ser SEDE (Reserva Fábrica), LOJA ou ML (Mercado Livre).`); continue; }
    if (!["ENTRADA", "SAIDA", "AJUSTE"].includes(tipo)) { res.erros.push(`${onde}: tipo deve ser ENTRADA, SAIDA ou AJUSTE.`); continue; }
    if (!q) { res.erros.push(`${onde}: quantidade zero.`); continue; }
    const chave = `NORT|${ident}`.slice(0, 190);
    if (await prisma.nortMov.findUnique({ where: { chave }, select: { id: true } })) { res.repetidos++; continue; }
    const item = await itemPorNome(m.nome, { sku: m.sku });
    const delta = tipo === "ENTRADA" ? Math.abs(q) : tipo === "SAIDA" ? -Math.abs(q) : q;
    const data = /^\d{4}-\d{2}-\d{2}/.test(String(m.data || "")) ? new Date(m.data) : new Date();
    try {
      const [, it] = await prisma.$transaction([
        prisma.nortMov.create({ data: { chave, itemId: item.id, deposito: dep, tipo, quantidade: r3(delta), data, ref: m.ref ? String(m.ref).slice(0, 120) : null, obs: m.obs ? String(m.obs).slice(0, 500) : null } }),
        prisma.nortItem.update({ where: { id: item.id }, data: { [CAMPO[dep]]: { increment: r3(delta) }, temEstoque: true, ultimoMovEm: new Date(),
          ...(m.sku && !item.sku ? { sku: String(m.sku).slice(0, 80) } : {}) } }),
      ]);
      res.gravados++;
      await verificarMinimo(it);
    } catch (e) {
      if (e.code === "P2002") res.repetidos++; else res.erros.push(`${onde}: ${e.message}`);
    }
  }
  return res;
}

// conferência diária: [{ nome, deposito, saldo }] → o ERP se alinha ao saldo da NORT e registra a diferença
export async function conferirSaldos(lista) {
  const res = { conferidos: 0, ajustados: [], erros: [] };
  const dia = hojeSP();
  for (const [i, s] of (Array.isArray(lista) ? lista : []).entries()) {
    const dep = depositoDe(s?.deposito);
    if (!normNome(s?.nome) || !DEPOSITOS.includes(dep) || s?.saldo == null) { res.erros.push(`saldo ${i + 1}: informe nome, deposito (SEDE/LOJA/ML) e saldo.`); continue; }
    const item = await itemPorNome(s.nome, { sku: s.sku });
    const campo = CAMPO[dep], erp = num(item[campo]), nort = r3(num(s.saldo)), dif = r3(nort - erp);
    res.conferidos++;
    const divergencia = { ...(item.divergencia || {}), em: new Date().toISOString(), [dep]: { erp, nort } };
    if (!dif) { await prisma.nortItem.update({ where: { id: item.id }, data: { temEstoque: item.temEstoque || nort !== 0, divergencia } }); continue; }
    const chave = `CONF|${dia}|${item.id}|${dep}`;
    const ja = await prisma.nortMov.findUnique({ where: { chave } });
    const ops = [prisma.nortItem.update({ where: { id: item.id }, data: { [campo]: { increment: dif }, temEstoque: true, divergencia, ultimoMovEm: new Date() } })];
    ops.unshift(ja ? prisma.nortMov.update({ where: { chave }, data: { quantidade: { increment: dif } } })
      : prisma.nortMov.create({ data: { chave, itemId: item.id, deposito: dep, tipo: "CONFERENCIA", quantidade: dif, data: new Date(), obs: `Conferência com o saldo da NORT: ERP ${erp} → ${nort}` } }));
    const [, it] = await prisma.$transaction(ops);
    res.ajustados.push({ nome: item.nome, deposito: dep, erp, nort, diferenca: dif });
    await verificarMinimo(it);
  }
  return res;
}

// ---------- lista para a tela e para a NORT ----------
export async function listarItens({ soEstoque = false } = {}) {
  const l = await prisma.nortItem.findMany({ where: { ativo: true, ...(soEstoque ? { temEstoque: true } : {}) }, orderBy: { nome: "asc" } });
  const C = await custosDosItens(l);
  return l.map((i) => {
    const sede = num(i.saldoSede), loja = num(i.saldoLoja), ml = num(i.saldoMl), total = r3(sede + loja + ml), c = C[i.id];
    return { id: i.id, nome: i.nome, sku: i.sku, sede, loja, ml, total, minimo: i.minimo == null ? null : num(i.minimo), abaixoMinimo: i.minimo != null && total < num(i.minimo),
      itemPadrao: c.itemPadrao, fppNumero: c.fppNumero, custoUnit: c.custo, custoTotal: c.custo != null ? r2(c.custo * total) : null,
      temEstoque: i.temEstoque, divergencia: i.divergencia || null, ultimoMovEm: i.ultimoMovEm };
  });
}

// ---------- encomendas → pedido interno NORT ----------
const ITEM_NORT = "ITEM NORT";
async function clienteNort() {
  const c = await prisma.cliente.findFirst({ where: { OR: [{ razaoSocial: { contains: "NORT SPORTS", mode: "insensitive" } }, { nomeFantasia: { contains: "NORT SPORTS", mode: "insensitive" } }] }, select: { razaoSocial: true, nomeFantasia: true, cnpj: true, inscricaoEstadual: true } }).catch(() => null);
  return { nome: c?.razaoSocial || c?.nomeFantasia || "NORT SPORTS LTDA", cnpj: c?.cnpj || "", ie: c?.inscricaoEstadual || "" };
}
const limparGrade = (g) => (Array.isArray(g) ? g : []).map((x) => ({ tam: String(x?.tam || "").toUpperCase().trim().slice(0, 16), qtd: String(Math.max(0, Math.round(num(x?.qtd))) || "") })).filter((x) => x.tam && Number(x.qtd) > 0);

// dados do Item Padrão para o item do pedido (FPP, tipo de peça, parâmetros)
async function doItemPadrao(ipId) {
  if (!ipId) return null;
  const d = await prisma.itemPadrao.findUnique({ where: { id: Number(ipId) }, select: { id: true, nomeNf: true, nomeInterno: true, tipoPecaNome: true, codigo: true, codigoPadrao: true, fppId: true, fppNumero: true, parametros: true } });
  if (!d) return null;
  let tecido = null;
  if (d.fppId) {
    try { const { resumoFpp, tecidoDaFpp } = await import("@/lib/pedidoLanc"); tecido = tecidoDaFpp(resumoFpp(await prisma.fpp.findUnique({ where: { id: d.fppId } }))); } catch { /* sem tecido */ }
  }
  return { ...d, tecido };
}

export async function criarPedidoNort(b, quem = "INTEGRAÇÃO NORT") {
  const ref = String(b?.ref || "").trim().slice(0, 80);
  if (!ref) return { ok: false, error: "Falta a referência do pedido (ref)." };
  const extRef = `NORT|${ref}`;
  const ja = await prisma.pp.findUnique({ where: { extRef }, select: { id: true } });
  if (ja) return { ...(await situacaoPedidoNort(ref)), jaExistia: true };
  const itensIn = Array.isArray(b?.itens) ? b.itens : [];
  if (!itensIn.length) return { ok: false, error: "O pedido não tem itens." };
  const emissao = /^\d{4}-\d{2}-\d{2}$/.test(String(b.emissao || "")) ? b.emissao : hojeSP();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.entrega || ""))) return { ok: false, error: "Informe a data de entrega (entrega: AAAA-MM-DD)." };
  if (b.entrega < emissao) return { ok: false, error: "A entrega é anterior à emissão." };
  const itens = [];
  for (const [k, p] of itensIn.entries()) {
    const nome = normNome(p?.nome || p?.descricao);
    if (!nome) return { ok: false, error: `Item ${k + 1}: falta o nome do item.` };
    const grade = limparGrade(p.grade);
    if (!grade.length) return { ok: false, error: `Item ${k + 1} (${nome}): grade vazia.` };
    const ni = await itemPorNome(nome, { sku: p.sku });
    const ip = await doItemPadrao(ni.itemPadraoId);
    const pers = (Array.isArray(p.personalizacao) ? p.personalizacao : []).map((x) => [x.metodo, x.local, x.larguraCm && x.alturaCm ? `${x.larguraCm}x${x.alturaCm} cm` : "", x.obs].filter(Boolean).join(" · ")).filter(Boolean);
    const parametros = { ...(ip?.parametros && typeof ip.parametros === "object" ? Object.fromEntries(Object.entries(ip.parametros).filter(([kk, v]) => v && kk !== "TECIDO")) : {}),
      ...(ip?.tecido ? { TECIDO: ip.tecido } : {}), ...(pers.length ? { "PERSONALIZAÇÃO": pers.join(" | ").toUpperCase() } : {}), [ITEM_NORT]: nome };
    itens.push({
      tipoPecaNome: ip?.tipoPecaNome || "", codigo: ip?.codigo || p.sku || "", descricao: normNome(p.descricao) || ip?.nomeNf || nome, itemPadraoId: ip?.id || null,
      valorUnitario: "", grade, parametros, fppId: ip?.fppId || null, fppNumero: ip?.fppNumero ?? null, dispensaDesign: !!p.dispensaDesign,
    });
  }
  const cli = await clienteNort();
  const prazoDias = Math.max(0, Math.round((dUTC(b.entrega) - dUTC(emissao)) / 864e5));
  const obs = [`PEDIDO DA LOJA NORT · REF ${ref}${b.canal ? ` · ${String(b.canal).toUpperCase()}` : ""}`, b.obs ? String(b.obs).slice(0, 1500) : ""].filter(Boolean).join(" · ");
  const { salvarPp } = await import("@/lib/pedidoEfetivar");
  const id = await salvarPp(null, { interno: true, emissao, prazoDias, prazoTipo: "CORRIDOS", clienteNome: cli.nome, clienteCnpj: cli.cnpj, clienteIe: cli.ie,
    vendedor: normNome(b.vendedor) || "LOJA NORT", obs, entregaModo: "UNICA", entregas: [], pagamento: null, itens }, quem);
  const cf = normNome(b.cliente);
  await prisma.pp.update({ where: { id }, data: { extRef, ...(cf ? { clienteFinal: { tipo: "PF", nome: cf, ...(b.contato ? { whatsapp: String(b.contato).slice(0, 60) } : {}) } } : {}) } });
  const r = await seguirSeTemFpp(id, quem);
  return { ok: true, jaExistia: false, ...(await situacaoPedidoNort(ref)), ...(r.erros?.length ? { avisos: r.erros } : {}) };
}

// todos os itens com FPP → efetiva (vai para Compras/PCP); senão reserva o número e fica aguardando FPP
export async function seguirSeTemFpp(ppId, quem = "INTEGRAÇÃO NORT") {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" }, select: { id: true, fppId: true, parametrosJson: true, tipoPecaNome: true } } } });
  if (!pp || pp.efetivadoEm) return { ok: true };
  const semFpp = pp.itens.filter((i) => !i.fppId && i.tipoPecaNome !== "SERVIÇO");
  const { salvarRascunho, efetivarPedido } = await import("@/lib/pedidoEfetivar");
  if (semFpp.length) { await salvarRascunho(pp.id); return { ok: true, aguardando: semFpp.length }; }
  try {
    const r = await efetivarPedido(pp.id, quem);
    if (!r.ok) { await salvarRascunho(pp.id); return { ok: false, erros: r.erros }; }
    return { ok: true, numero: r.numero };
  } catch (e) { await salvarRascunho(pp.id).catch(() => null); return { ok: false, erros: [e.message] }; }
}

// equivalência indexada → completa os itens dos pedidos NORT que aguardavam FPP e efetiva os que ficaram completos
export async function reprocessarPendentes(quem) {
  const pps = await prisma.pp.findMany({ where: { extRef: { startsWith: "NORT|" }, efetivadoEm: null }, include: { itens: { orderBy: { id: "asc" } } } });
  let efetivados = 0;
  for (const pp of pps) {
    for (const it of pp.itens) {
      if (it.fppId) continue;
      let par = {}; try { par = JSON.parse(it.parametrosJson || "{}"); } catch {}
      const ni = par[ITEM_NORT] ? await prisma.nortItem.findUnique({ where: { nome: normNome(par[ITEM_NORT]) } }) : null;
      const ip = await doItemPadrao(ni?.itemPadraoId);
      if (!ip?.fppId) continue;
      const parametros = { ...(ip.parametros && typeof ip.parametros === "object" ? Object.fromEntries(Object.entries(ip.parametros).filter(([kk, v]) => v && kk !== "TECIDO")) : {}), ...(ip.tecido ? { TECIDO: ip.tecido } : {}), ...par };
      await prisma.ppItem.update({ where: { id: it.id }, data: { fppId: ip.fppId, fppNumero: ip.fppNumero ?? null, itemPadraoId: ip.id, tipoPecaNome: it.tipoPecaNome || ip.tipoPecaNome || null,
        codigo: it.codigo || ip.codigo || null, parametrosJson: JSON.stringify(parametros) } });
    }
    const r = await seguirSeTemFpp(pp.id, quem);
    if (r.numero) efetivados++;
  }
  return { pendentes: pps.length, efetivados };
}

// acerto NORT do pedido: custo da FPP × quantidade de cada item → conta "NORT - PEDIDO …" (guia NORT, fora da DRE da Meridian)
export async function acertoDoPedidoNort(pp, numero, despacho, quem) {
  const itens = pp.itens || [];
  const fppIds = [...new Set(itens.map((i) => i.fppId).filter(Boolean))];
  const fpps = fppIds.length ? await prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, numero: true, custoProducao: true } }) : [];
  const F = Object.fromEntries(fpps.map((f) => [f.id, f]));
  let valor = 0; const linhas = [], semCusto = [];
  for (const it of itens) {
    const q = num(it.quantidade), f = it.fppId ? F[it.fppId] : null, c = f && Number(f.custoProducao) > 0 ? Number(f.custoProducao) : null;
    if (c == null) { semCusto.push(it.descricao || "item"); continue; }
    valor += q * c; linhas.push(`${q} × ${it.descricao} (FPP ${String(f.numero || "").padStart(5, "0")} · R$ ${c.toFixed(2).replace(".", ",")})`);
  }
  valor = r2(valor);
  const chave = `NORTPED|${numero}`;
  const cf = pp.clienteFinal && typeof pp.clienteFinal === "object" ? normNome(pp.clienteFinal.nome || pp.clienteFinal.razaoSocial) : "";
  const venc = despacho || pp.emissao || hojeSP();
  const dados = { tipo: "RECEBER", titulo: `NORT - PEDIDO ${numero}${cf ? ` · ${cf}` : ""}`.slice(0, 190), parceiro: "NORT SPORTS", numeroDoc: numero, emissao: pp.emissao ? dUTC(pp.emissao) : null,
    valor, vencimento: dUTC(venc), competencia: String(venc).slice(0, 7), previsao: false, rateio: [], forma: "PEDIDO",
    observacao: `Acerto NORT do pedido ${numero} (${String(pp.extRef || "").replace(/^NORT\|/, "REF ")}): custo de produção pela FPP.\n${linhas.join("\n")}${semCusto.length ? `\nSem custo na FPP: ${semCusto.join(", ")}` : ""}`.slice(0, 4000) };
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true, status: true } });
  if (ja && ja.status !== "ABERTO" && ja.status !== "CANCELADO") return { id: ja.id, mantido: true, valor };
  if (!valor) return { valor: 0, semCusto };
  if (ja) await prisma.finTitulo.update({ where: { id: ja.id }, data: { ...dados, status: "ABERTO", atualizadoPorNome: quem } });
  else await prisma.finTitulo.create({ data: { ...dados, chaveImport: chave, criadoPorNome: quem } });
  return { valor, semCusto };
}

// situação para a NORT mostrar ao cliente
export async function situacaoPedidoNort(ref) {
  const pp = await prisma.pp.findUnique({ where: { extRef: `NORT|${String(ref || "").trim()}` }, include: { itens: { orderBy: { id: "asc" }, select: { descricao: true, fppId: true, parametrosJson: true } } } });
  if (!pp) return { ok: false, error: "Pedido não encontrado." };
  const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, "") : "https://erp.meridianpro.com.br";
  const pend = pp.itens.filter((i) => !i.fppId).map((i) => { try { return JSON.parse(i.parametrosJson || "{}")[ITEM_NORT] || i.descricao; } catch { return i.descricao; } });
  const out = { ok: true, ref: String(ref), numero: pp.numero || null, url: pp.numero ? `${base}/?v=pedido&numero=${pp.numero}` : null };
  if (!pp.efetivadoEm) return { ...out, status: "AGUARDANDO_FPP", pendentes: pend };
  const pv = await prisma.pedidoVenda.findUnique({ where: { numero: pp.numero }, select: { status: true, despacho: true, entregaPrevista: true, cronoSituacao: true, cronoEtapa: true, cronoConcluido: true } });
  return { ...out, status: pv?.cronoConcluido ? "CONCLUIDO" : pv?.status === "CANCELADO" ? "CANCELADO" : "EM_ANDAMENTO",
    situacaoPcp: pv?.cronoSituacao || null, etapa: pv?.cronoEtapa || null, entrega: iso(pv?.despacho), entregaPrevista: iso(pv?.entregaPrevista), concluido: !!pv?.cronoConcluido };
}
