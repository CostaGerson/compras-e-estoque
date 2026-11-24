// v1084 — Frente de caixa da loja física (NORT) no ERP: catálogo, orçamento, fechamento da venda, pagamentos e entrega.
//   Preço: tabelas da calculadora (lib/lojaPreco.js), editáveis. Cada item do catálogo é um modelo (produto + cor) ligado a uma FPP.
//   Fechar a venda:
//     · itens que vão para a produção (personalizado, encomenda, outra cor, manga longa, sublimação, bolso) → pedido NORT × Meridian
//       canal LOJA, efetivado (acerto pelo custo da FPP da peça lisa; PCP e Compras como qualquer pedido);
//     · peça lisa do estoque → baixa o saldo LOJA no ERP e lança o acerto do custo da FPP (sem produção);
//     · pagamentos e saldo → contas a receber no Portal NORT.
//   Integrações nunca travam a loja: se o lançamento na produção falhar, a venda fecha e fica o "Tentar de novo".
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { PADRAO, POSICOES, grupoDe, grupoPorNome, limparItem, totaisPedido, vaiProducao, textoPersonalizacao, qtdDe, coresDosModelos, hexDaCor, fotosDoGrupo } from "@/lib/lojaPreco";
import { modeloNort, registrarMovimentos } from "@/lib/nortInteg";
import { somaDias } from "@/lib/pedidoLanc";

const K_TAB = "LOJA|TABELAS", K_SENHA = "LOJA|SENHA_SOCIO";
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase() || null;
const cfg = async (k) => (await prisma.finConfig.findUnique({ where: { chave: k } }).catch(() => null))?.valor || "";
const gravarCfg = (chave, valor) => prisma.finConfig.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });

// ---------- tabelas de preço (padrão da calculadora + o que foi editado) ----------
export async function tabelas() {
  let t = {}; try { t = JSON.parse((await cfg(K_TAB)) || "{}"); } catch {}
  const grupos = PADRAO.grupos.map((g) => ({ ...g, ...((t.grupos || []).find((x) => x.k === g.k) || {}) }));
  return { ...PADRAO, ...t, grupos, faixas: PADRAO.faixas };
}
export async function salvarTabelas(b) {
  const atual = await tabelas();
  const lim = (arr, n) => (Array.isArray(arr) && arr.length === n && arr.every((x) => Number.isFinite(Number(x)) && Number(x) >= 0) ? arr.map((x) => Math.round(Number(x))) : null);
  const out = {};
  for (const k of ["DTF", "BORDADO"]) if (b[k]) out[k] = Object.fromEntries(Object.entries(atual[k]).map(([tam, v]) => [tam, lim(b[k][tam], 4) || v]));
  for (const k of ["bolso", "sublimacao"]) if (b[k]) out[k] = lim(b[k], 4) || atual[k];
  for (const k of ["sublimacaoLonga", "texturizada", "mangaLonga", "taxaBordado"]) if (b[k] != null && Number(b[k]) >= 0) out[k] = Math.round(Number(b[k]));
  if (Array.isArray(b.grupos)) out.grupos = atual.grupos.map((g) => { const x = b.grupos.find((y) => y.k === g.k); return { k: g.k, base: x && Number(x.base) > 0 ? Math.round(Number(x.base)) : g.base }; });
  let prev = {}; try { prev = JSON.parse((await cfg(K_TAB)) || "{}"); } catch {}
  await gravarCfg(K_TAB, JSON.stringify({ ...prev, ...out }));
  return { ok: true, tabelas: await tabelas() };
}

// ---------- senha de sócio (4 dígitos) ----------
const hash = (s, salt) => crypto.scryptSync(String(s), salt, 32).toString("hex");
export async function definirSenha(s) {
  if (!/^\d{4}$/.test(String(s || ""))) return { error: "A senha de sócio tem 4 dígitos." };
  const salt = crypto.randomBytes(8).toString("hex");
  await gravarCfg(K_SENHA, `${salt}:${hash(s, salt)}`);
  return { ok: true };
}
export async function temSenha() { return !!(await cfg(K_SENHA)); }
async function senhaOk(s) {
  const v = await cfg(K_SENHA);
  if (!v || !/^\d{4}$/.test(String(s || ""))) return false;
  const [salt, h] = v.split(":");
  const a = Buffer.from(hash(s, salt)), b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- catálogo ----------
const tamDe = (nome, modelo) => String(nome).slice(modelo.length).trim() || "U";
// v1091 — a loja vende do depósito LOJA e da Reserva Fábrica (SEDE), como a calculadora
async function saldosPorModelo(modelos) {
  if (!modelos.length) return {};
  const l = await prisma.nortItem.findMany({ where: { ativo: true, OR: modelos.map((m) => ({ nome: { startsWith: m } })) }, select: { id: true, nome: true, saldoLoja: true, saldoSede: true } });
  const out = {};
  for (const x of l) { const m = modeloNort(x.nome); if (!modelos.includes(m)) continue; const loja = Math.max(0, Number(x.saldoLoja) || 0), sede = Math.max(0, Number(x.saldoSede) || 0);
    (out[m] ||= {})[tamDe(x.nome, m)] = { saldo: loja + sede, loja, sede, nome: x.nome }; }
  return out;
}
// v1091 — liga a FPP pelo nome quando o estoque e a FPP escrevem diferente ("CAMISETA MALHA PV GOLA VIÉS PRETO" × "CAMISETA PV GOLA VIES PRETO")
const PALAVRAS_FORA = new Set(["MALHA", "DE", "DA", "DO", "COM", "C/", "E", "MC", "M/C"]);
const tokens = (s) => new Set(String(s || "").normalize("NFD").replace(/\bVERDE BB\b/gi, "VERDE BANDEIRA").replace(/\bROSA BB\b/gi, "ROSA BEBE").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9.\/ -]/g, " ").split(/[\s-]+/).filter((w) => w && !PALAVRAS_FORA.has(w)));
function fppPorNome(modelo, fpps) {
  const tm = tokens(modelo);
  const ok = fpps.filter((f) => { const tf = tokens(f.nomeComercial); if (!tf.size) return false; const falta = [...tm].filter((w) => !tf.has(w)), sobra = [...tf].filter((w) => !tm.has(w));
    return sobra.length === 0 && (falta.length === 0 || (falta.length === 1 && falta[0] === "AZUL")); });
  const loja = ok.filter((f) => /LOJA/i.test(f.negociacao || ""));
  const l = loja.length ? loja : ok;
  return l.length === 1 ? l[0] : l.find((f) => tokens(f.nomeComercial).size === tm.size) || null;
}
async function ligarFppsPorNome(ps) {
  const sem = ps.filter((p) => !p.fppId);
  if (!sem.length) return 0;
  const fpps = await prisma.fpp.findMany({ where: { nomeComercial: { not: null } }, select: { id: true, numero: true, nomeComercial: true, negociacao: true }, orderBy: { id: "desc" } });
  let n = 0;
  for (const p of sem) { const f = fppPorNome(p.modelo, fpps); if (f) { await prisma.lojaProduto.update({ where: { id: p.id }, data: { fppId: f.id, fppNumero: f.numero } }); Object.assign(p, { fppId: f.id, fppNumero: f.numero }); n++; } }
  return n;
}
export async function catalogo({ todos = false } = {}) {
  const tab = await tabelas();
  const ps = await prisma.lojaProduto.findMany({ where: todos ? {} : { ativo: true }, orderBy: { modelo: "asc" } });
  await ligarFppsPorNome(ps).catch((e) => console.log("loja/fpp:", e.message));   // v1091
  const sal = await saldosPorModelo(ps.map((p) => p.modelo));
  const corDe = {};   // v1091 — cor de cada modelo (o que sobra do nome comum do produto)
  for (const g of [...new Set(ps.map((p) => p.grupo))]) { const l = ps.filter((p) => p.grupo === g); coresDosModelos(l.map((p) => p.modelo)).forEach((c, i) => { corDe[l[i].id] = c; }); }
  const fpps = await prisma.fpp.findMany({ where: { id: { in: ps.map((p) => p.fppId).filter(Boolean) } }, select: { id: true, numero: true, custoProducao: true, nomeComercial: true } });
  const F = Object.fromEntries(fpps.map((f) => [f.id, f]));
  return ps.map((p) => {
    const g = grupoDe(tab, p.grupo), s = sal[p.modelo] || {};
    return { id: p.id, modelo: p.modelo, grupo: p.grupo, grupoNome: g?.nome || p.grupo, tipo: g?.tipo || null, base: g?.base || 0, longa: !!g?.longa, tecnicas: g?.tecnicas || [], bolso: !!g?.bolso,
      fppId: p.fppId, fppNumero: p.fppNumero, custo: F[p.fppId]?.custoProducao != null ? r2(F[p.fppId].custoProducao) : null, ativo: p.ativo,
      estoque: Object.fromEntries(Object.entries(s).map(([t, x]) => [t, x.saldo])), estoqueTotal: Object.values(s).reduce((a, x) => a + Math.max(0, x.saldo), 0),
      estoqueLoja: Object.values(s).reduce((a, x) => a + x.loja, 0), cor: corDe[p.id] || "", hex: hexDaCor(corDe[p.id] || ""), fotos: fotosDoGrupo(p.grupo) };
  });
}
// cria o catálogo a partir dos modelos do estoque da NORT (grupo pelo nome; FPP pelo nome comercial igual ao modelo)
export async function importarDoEstoque() {
  const tab = await tabelas();
  const its = await prisma.nortItem.findMany({ where: { ativo: true }, select: { nome: true } });
  const modelos = [...new Set(its.map((i) => modeloNort(i.nome)).filter(Boolean))];
  const ja = new Set((await prisma.lojaProduto.findMany({ select: { modelo: true } })).map((x) => x.modelo));
  const fpps = await prisma.fpp.findMany({ where: { nomeComercial: { not: null } }, select: { id: true, numero: true, nomeComercial: true, negociacao: true }, orderBy: { id: "desc" } });
  const fppDe = (m) => { const l = fpps.filter((f) => String(f.nomeComercial).trim().toUpperCase() === m); return l.find((f) => /LOJA/i.test(f.negociacao || "")) || l[0] || null; };
  let criados = 0, semGrupo = [];
  for (const m of modelos) {
    if (ja.has(m)) continue;
    const g = grupoPorNome(tab, m);
    if (!g) { semGrupo.push(m); continue; }
    const f = fppDe(m);
    await prisma.lojaProduto.create({ data: { modelo: m, grupo: g.k, fppId: f?.id || null, fppNumero: f?.numero || null } }).catch(() => null);
    criados++;
  }
  // os que já existem sem FPP tentam de novo pelo nome
  for (const p of await prisma.lojaProduto.findMany({ where: { fppId: null } })) { const f = fppDe(p.modelo); if (f) await prisma.lojaProduto.update({ where: { id: p.id }, data: { fppId: f.id, fppNumero: f.numero } }); }
  return { ok: true, criados, semGrupo };
}
export async function salvarProduto(b) {
  const tab = await tabelas();
  const modelo = modeloNort(b.modelo);
  if (b.grupo && !grupoDe(tab, b.grupo)) return { error: "Grupo de preço inválido." };
  let fpp = null;
  if (b.fppId) { fpp = await prisma.fpp.findUnique({ where: { id: Number(b.fppId) }, select: { id: true, numero: true } }); if (!fpp) return { error: "FPP não encontrada." }; }
  const d = { ...(b.grupo ? { grupo: b.grupo } : {}), ...(b.fppId !== undefined ? { fppId: fpp?.id || null, fppNumero: fpp?.numero || null } : {}), ...(typeof b.ativo === "boolean" ? { ativo: b.ativo } : {}) };
  if (b.id) return { ok: true, produto: await prisma.lojaProduto.update({ where: { id: Number(b.id) }, data: d }) };
  if (!modelo) return { error: "Informe o modelo (produto + cor, sem o tamanho)." };
  if (!b.grupo) return { error: "Escolha o grupo de preço." };
  return { ok: true, produto: await prisma.lojaProduto.create({ data: { modelo, ...d } }) };
}
export async function buscarFpps(q) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const n = Number(t.replace(/\D/g, ""));
  return (await prisma.fpp.findMany({ where: { OR: [{ nomeComercial: { contains: t, mode: "insensitive" } }, { item: { contains: t, mode: "insensitive" } }, ...(n ? [{ numero: n }] : [])] },
    select: { id: true, numero: true, nomeComercial: true, item: true, negociacao: true, clienteNome: true, custoProducao: true }, orderBy: { id: "desc" }, take: 30 }))
    .map((f) => ({ ...f, custoProducao: f.custoProducao != null ? r2(f.custoProducao) : null }));
}

// ---------- vendas ----------
const fmtVenda = (v) => ({ ...v, previsao: iso(v.previsao) });
const pago = (v) => (Array.isArray(v.pagamentos) ? v.pagamentos : []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
export async function listarVendas({ status } = {}) {
  const where = status && status !== "TODAS" ? (status === "ABERTAS" ? { status: { in: ["EM_PRODUCAO", "PRONTA"] } } : { status }) : {};
  const l = await prisma.lojaVenda.findMany({ where, orderBy: { numero: "desc" }, take: 300 });
  return l.map((v) => ({ ...fmtVenda(v), pago: pago(v), saldo: Math.max(0, v.total - pago(v)) }));
}
export async function venda(numero) {
  const v = await prisma.lojaVenda.findUnique({ where: { numero: Number(numero) || 0 } });
  return v ? { ...fmtVenda(v), pago: pago(v), saldo: Math.max(0, v.total - pago(v)) } : null;
}
async function proximoNumero() { const m = await prisma.lojaVenda.aggregate({ _max: { numero: true } }); return (m._max.numero || 0) + 1; }
const hist = (v, txt, u) => [...(Array.isArray(v?.historico) ? v.historico : []), { em: new Date().toISOString(), por: nomeU(u), txt }].slice(-100);

// monta e confere itens, totais e estoque (servidor recalcula tudo)
async function montar(tab, b) {
  const cat = Object.fromEntries((await catalogo()).map((p) => [p.id, p]));
  const itens = [];
  for (const [k, raw] of (Array.isArray(b.itens) ? b.itens : []).entries()) {
    const p = cat[Number(raw?.produtoId)];
    if (!p) return { error: `Item ${k + 1}: produto fora do catálogo da loja.` };
    const it = limparItem(tab, { ...raw, grupo: p.grupo, modelo: p.modelo, fppId: p.fppId, fppNumero: p.fppNumero });
    if (it.erro) return { error: `Item ${k + 1}: ${it.erro}` };
    if (!qtdDe(it.grade)) return { error: `Item ${k + 1} (${p.modelo}): informe a grade.` };
    if (!it.fppId) return { error: `${p.modelo}: sem FPP ligada no catálogo da loja.` };
    if (!b.semEstoque && !ehEncomenda(tab, it)) for (const [tam, q] of Object.entries(it.grade)) {   // grade limitada pelo estoque LOJA (encomenda não)
      const s = Math.max(0, Number(p.estoque?.[tam]) || 0);
      if (q > s) return { error: `${p.modelo} ${tam}: o estoque da loja tem ${s}. Diminua ou marque o item como encomenda.` };
    }
    itens.push(it);
  }
  if (!itens.length) return { error: "O carrinho está vazio." };
  const desconto = b.desconto && Number(b.desconto.valor) > 0 ? { tipo: b.desconto.tipo === "VALOR" ? "VALOR" : "PCT", valor: Number(b.desconto.valor) } : null;
  const acrescimo = !desconto && b.acrescimo && Number(b.acrescimo.valor) > 0 ? { tipo: b.acrescimo.tipo === "VALOR" ? "VALOR" : "PCT", valor: Number(b.acrescimo.valor), obs: String(b.acrescimo.obs || "").trim().slice(0, 200) } : null;
  if (acrescimo && !acrescimo.obs) return { error: "Acréscimo precisa de observação." };
  const totais = totaisPedido(tab, itens, { desconto, acrescimo });
  return { itens, desconto, acrescimo, totais, cat };
}
const clienteDe = (b) => {
  const c = b.cliente || {};
  const nome = String(c.nome || "").trim().toUpperCase().slice(0, 120);
  const tel = String(c.telefone || "").replace(/\D/g, "").slice(0, 13);
  return !nome && !tel ? { balcao: true, cliente: { nome: "CLIENTE BALCÃO", telefone: null, documento: null } } : { balcao: false, cliente: { nome: nome || "CLIENTE", telefone: tel || null, documento: String(c.documento || "").replace(/\D/g, "").slice(0, 14) || null } };
};

export async function salvarOrcamento(b, u) {
  const tab = await tabelas();
  const m = await montar(tab, b);
  if (m.error) return m;
  const { cliente, balcao } = clienteDe(b);
  const dados = { cliente, balcao, itens: m.itens, desconto: m.desconto, acrescimo: m.acrescimo, totais: { ...m.totais, linhas: undefined }, total: m.totais.total, obs: String(b.obs || "").slice(0, 1000) || null, vendedorNome: nomeU(u) };
  if (b.numero) {
    const v = await prisma.lojaVenda.findUnique({ where: { numero: Number(b.numero) } });
    if (!v) return { error: "Orçamento não encontrado." };
    if (v.status !== "ORCAMENTO") return { error: "Venda fechada não muda mais o preço." };
    await prisma.lojaVenda.update({ where: { id: v.id }, data: { ...dados, historico: hist(v, "Orçamento alterado", u) } });
    return { ok: true, numero: v.numero };
  }
  for (let t = 0; t < 4; t++) {
    try { const v = await prisma.lojaVenda.create({ data: { numero: await proximoNumero(), ...dados, criadoPorNome: nomeU(u), historico: hist(null, "Orçamento criado", u) } }); return { ok: true, numero: v.numero }; }
    catch (e) { if (e.code !== "P2002") throw e; }
  }
  return { error: "Não consegui numerar a venda, tente de novo." };
}

// encomenda: não sai do estoque da loja (produz a peça); o resto usa a peça do estoque LOJA (lisa ou para personalizar)
const ehEncomenda = (tab, it) => !!(it.encomenda || it.outraCor || it.manga === "LONGA" || grupoDe(tab, it.grupo)?.tipo === "SUBLIMACAO");
// estampas da frente de caixa → aplicações do item do pedido (método, local, largura × altura em cm)
function aplicacoesDe(tab, it) {
  const out = [];
  if (grupoDe(tab, it.grupo)?.tipo === "SUBLIMACAO") out.push({ metodo: "SUBLIMACAO", local: "TOTAL", obs: it.malha === "TEXTURIZADA" ? "MALHA TEXTURIZADA" : null });
  if (it.bolso) out.push({ metodo: "BORDADO", local: "BOLSO" });
  for (const e of it.estampas || []) {
    const [l, a] = String(e.tamanho).split("x").map(Number);
    out.push({ metodo: it.tecnica, local: (POSICOES.find((p) => p.k === e.local)?.nome || e.local).toUpperCase(), largura: l || null, altura: a || null, obs: e.obs || null });
  }
  return out.length ? out : undefined;
}
const tipoPeca = (grupo) => (/polo/.test(grupo) ? "POLO" : /calca/.test(grupo) ? "CALÇA" : "CAMISETA");
// pedido de produção (canal LOJA) com os itens que precisam ser feitos
async function lancarProducao(v, tab, u) {
  const its = (v.itens || []).filter((it) => vaiProducao(tab, it));
  if (!its.length) return { ok: true };
  const enc = its.some((it) => it.encomenda || it.outraCor || it.manga === "LONGA" || grupoDe(tab, it.grupo)?.tipo === "SUBLIMACAO");
  const itens = its.map((it) => ({
    tipoPecaNome: tipoPeca(it.grupo), codigo: "", descricao: `${it.modelo}${it.manga === "LONGA" ? " MANGA LONGA" : ""}${it.outraCor ? ` · COR ${it.corNome || "ESPECIAL"}` : ""}`,
    valorUnitario: "", grade: Object.entries(it.grade).map(([tam, qtd]) => ({ tam, qtd: String(qtd) })),
    parametros: { ...(textoPersonalizacao(it) ? { "PERSONALIZAÇÃO": textoPersonalizacao(it) } : {}), ...(ehEncomenda(tab, it) ? { ENCOMENDA: "SIM" } : { "PEÇA DO ESTOQUE DA LOJA": "SIM (SÓ PERSONALIZAR)" }), ...(it.malha === "TEXTURIZADA" ? { MALHA: "TEXTURIZADA" } : {}), ...(it.obs ? { "OBS LOJA": it.obs.toUpperCase() } : {}) },
    fppId: it.fppId, fppNumero: it.fppNumero, dispensaDesign: !it.tecnica,
    aplicacoes: aplicacoesDe(tab, it),   // v1085 — DTF/sublimação vira demanda para o sistema da NORT
  }));
  const quem = nomeU(u) || "FRENTE DE CAIXA";
  const { salvarPp, efetivarPedido } = await import("@/lib/pedidoEfetivar");
  let id = v.ppId;
  try {
    id = await salvarPp(id || null, { nort: { canal: "LOJA", clienteFinal: { tipo: "PF", nome: v.cliente?.nome || "CLIENTE BALCÃO", whatsapp: v.cliente?.telefone || "" } }, emissao: hojeSP(),
      prazoDias: enc ? tab.prazos.encomenda : tab.prazos.personalizado, prazoTipo: "UTEIS", vendedor: "LOJA FÍSICA NORT", obs: `LOJA FÍSICA · VENDA ${v.numero}${v.obs ? ` · ${v.obs}` : ""}`.slice(0, 1500),
      entregaModo: "UNICA", entregas: [], itens }, quem);
    await prisma.lojaVenda.update({ where: { id: v.id }, data: { ppId: id } });
    const r = await efetivarPedido(id, quem);
    if (!r.ok) throw new Error((r.erros || ["não efetivou"]).join(" "));
    await prisma.lojaVenda.update({ where: { id: v.id }, data: { pedidoNumero: r.numero, producaoErro: null } });
    return { ok: true, numero: r.numero };
  } catch (e) {
    await prisma.lojaVenda.update({ where: { id: v.id }, data: { ppId: id || null, producaoErro: e.message.slice(0, 500) } });
    return { ok: false, erro: e.message };
  }
}
// peça lisa do estoque: baixa o saldo LOJA e lança o acerto do custo da FPP (sem produção)
async function baixarEstoqueEAcerto(v, tab, u) {
  if (v.estoqueBaixado) return { ok: true };
  const doEstoque = (v.itens || []).filter((it) => !ehEncomenda(tab, it));
  const its = (v.itens || []).filter((it) => !vaiProducao(tab, it));   // acerto aqui só da peça lisa; a personalizada vai no pedido
  if (!doEstoque.length) { await prisma.lojaVenda.update({ where: { id: v.id }, data: { estoqueBaixado: true } }); return { ok: true }; }
  const sal = await saldosPorModelo([...new Set(doEstoque.map((i) => i.modelo))]);
  const movs = [], avisos = [];
  doEstoque.forEach((it, k) => Object.entries(it.grade).forEach(([tam, q]) => {
    const x = sal[it.modelo]?.[tam];
    if (!x) { avisos.push(`${it.modelo} ${tam}: sem item no estoque da NORT (não baixou)`); return; }
    const daLoja = Math.min(q, x.loja), daSede = q - daLoja;   // v1091 — LOJA primeiro, o resto da Reserva Fábrica
    if (daLoja > 0) movs.push({ id: `LOJAV-${v.numero}-${k}-${tam}`, nome: x.nome, deposito: "LOJA", tipo: "SAIDA", quantidade: daLoja, ref: `VENDA LOJA ${v.numero}` });
    if (daSede > 0) movs.push({ id: `LOJAV-${v.numero}-${k}-${tam}-S`, nome: x.nome, deposito: "SEDE", tipo: "SAIDA", quantidade: daSede, ref: `VENDA LOJA ${v.numero}` });
  }));
  const rm = movs.length ? await registrarMovimentos(movs) : { erros: [] };
  avisos.push(...(rm.erros || []));
  const fpps = await prisma.fpp.findMany({ where: { id: { in: its.map((i) => i.fppId).filter(Boolean) } }, select: { id: true, numero: true, custoProducao: true } });
  const F = Object.fromEntries(fpps.map((f) => [f.id, f]));
  let valor = 0; const linhas = [];
  for (const it of its) { const f = F[it.fppId], q = qtdDe(it.grade), c = Number(f?.custoProducao) || 0; if (!c) { avisos.push(`${it.modelo}: FPP sem custo`); continue; } valor += q * c; linhas.push(`${q} × ${it.modelo} (FPP ${String(f.numero || "").padStart(5, "0")} · R$ ${c.toFixed(2).replace(".", ",")})`); }
  valor = r2(valor);
  if (valor > 0) {
    const chave = `NORTPED|LOJA-V${v.numero}`, hoje = hojeSP();
    const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });
    const d = { tipo: "RECEBER", titulo: `NORT - LOJA FÍSICA VENDA ${v.numero} · PEÇAS DO ESTOQUE`, parceiro: "NORT SPORTS", numeroDoc: `LOJA-${v.numero}`, emissao: dUTC(hoje), valor, vencimento: dUTC(hoje),
      competencia: hoje.slice(0, 7), previsao: false, rateio: [], forma: "PEDIDO", observacao: `Acerto NORT da venda ${v.numero} da loja física: custo da peça lisa pela FPP.\n${linhas.join("\n")}`.slice(0, 4000) };
    if (!ja) await prisma.finTitulo.create({ data: { ...d, chaveImport: chave, criadoPorNome: nomeU(u) } });
  }
  await prisma.lojaVenda.update({ where: { id: v.id }, data: { estoqueBaixado: true, estoqueMovs: movs.map((m) => ({ id: m.id, nome: m.nome, deposito: m.deposito, quantidade: m.quantidade })) } });
  return { ok: true, avisos };
}
// contas a receber no Portal NORT: um título pago por pagamento e o saldo em aberto (vencimento = previsão)
async function sincronizarPortal(v) {
  const { clienteNortRow, garantirPlano } = await import("@/lib/portalFin");
  const cli = await clienteNortRow();
  if (!cli) return;
  await garantirPlano(cli.id);
  const conta = await prisma.portalFinConta.findFirst({ where: { clienteId: cli.id, codigo: "1.01" }, select: { id: true } });
  const pre = `LOJA|${v.numero}|`;
  const ja = await prisma.portalFinTitulo.findMany({ where: { clienteId: cli.id, chave: { startsWith: pre } } });
  const por = Object.fromEntries(ja.map((t) => [t.chave, t]));
  const base = { clienteId: cli.id, tipo: "RECEBER", parceiro: v.cliente?.nome || null, numeroDoc: v.pedidoNumero || `LOJA ${v.numero}`, contaId: conta?.id || null, observacao: v.obs || null };
  const pg = Array.isArray(v.pagamentos) ? v.pagamentos : [];
  for (const [i, p] of pg.entries()) {
    const chave = `${pre}P${i + 1}`;
    if (por[chave]) continue;
    const dt = String(p.em || new Date().toISOString()).slice(0, 10);
    await prisma.portalFinTitulo.create({ data: { ...base, chave, descricao: `LOJA FÍSICA · VENDA ${v.numero} · ${p.tipo === "SALDO" ? "SALDO" : "ENTRADA"}${pg.length > 1 ? ` ${i + 1}` : ""}`, valor: r2(p.valor / 100),
      vencimento: dUTC(dt), status: "PAGO", dataPagamento: dUTC(dt), valorPago: r2(p.valor / 100), formaPagamento: p.forma || null, criadoPorNome: p.por || null } });
  }
  const saldo = v.status === "CANCELADA" ? 0 : Math.max(0, v.total - pago(v));
  const sk = `${pre}SALDO`, t = por[sk];
  if (saldo > 0) {
    const d = { ...base, descricao: `LOJA FÍSICA · VENDA ${v.numero} · SALDO NA RETIRADA`, valor: r2(saldo / 100), vencimento: v.previsao ? new Date(v.previsao) : dUTC(hojeSP()), status: "ABERTO" };
    if (t) await prisma.portalFinTitulo.update({ where: { id: t.id }, data: d }); else await prisma.portalFinTitulo.create({ data: { ...d, chave: sk } });
  } else if (t) await prisma.portalFinTitulo.delete({ where: { id: t.id } });
}

const FORMAS = ["PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO"];
// fechar: { numero?, itens, cliente, desconto, acrescimo, obs, pagamentos: [{ valor (R$), forma }], senha?, socio? }
export async function fecharVenda(b, u) {
  const tab = await tabelas();
  const s = await salvarOrcamento(b, u);
  if (s.error) return s;
  let v = await prisma.lojaVenda.findUnique({ where: { numero: s.numero } });
  const t = v.totais;
  const pg = (Array.isArray(b.pagamentos) ? b.pagamentos : []).map((p) => ({ valor: Math.round(Number(String(p.valor).replace(",", ".")) * 100) || 0, forma: FORMAS.includes(p.forma) ? p.forma : "PIX" })).filter((p) => p.valor > 0);
  const soma = pg.reduce((a, p) => a + p.valor, 0);
  if (!soma) return { error: "Registre o pagamento recebido agora.", numero: v.numero };
  if (soma > v.total) return { error: "O pagamento passou do total da venda.", numero: v.numero };
  const precisaSenha = t.precisaSenha || (t.producao ? soma < t.entradaMinima : soma < v.total);
  if (!t.producao && soma < v.total) return { error: "Peça do estoque sem personalização: o pagamento é total.", numero: v.numero };
  if (precisaSenha && !(await senhaOk(b.senha))) return { error: t.precisaSenha ? `Desconto acima de ${tab.descontoLivrePct}%: precisa da senha de sócio.` : `Entrada abaixo de ${tab.entradaMinPct}%: precisa da senha de sócio.`, senha: true, numero: v.numero };
  const agora = new Date().toISOString(), quem = nomeU(u);
  const abaixo = t.producao && soma < t.entradaMinima;
  const pagamentos = pg.map((p) => ({ ...p, em: agora, por: quem, tipo: soma >= v.total ? "SALDO" : "ENTRADA", ...(abaixo ? { abaixoMinimo: true, liberadoPor: String(b.socio || "SÓCIO").toUpperCase().slice(0, 40) } : {}) }));
  const previsao = t.producao ? somaDias(hojeSP(), v.itens.some((it) => it.encomenda || it.outraCor || it.manga === "LONGA" || grupoDe(tab, it.grupo)?.tipo === "SUBLIMACAO") ? tab.prazos.encomenda : tab.prazos.personalizado, "UTEIS") : null;
  const status = t.producao ? "EM_PRODUCAO" : "ENTREGUE";
  v = await prisma.lojaVenda.update({ where: { id: v.id }, data: { status, pagamentos, previsao: previsao ? dUTC(previsao) : null, fechadaEm: new Date(), ...(status === "ENTREGUE" ? { entregueEm: new Date() } : {}),
    ...(t.precisaSenha ? { desconto: { ...v.desconto, liberadoPor: String(b.socio || "SÓCIO").toUpperCase().slice(0, 40) } } : {}),
    historico: hist(v, `Venda fechada · pago ${(soma / 100).toFixed(2).replace(".", ",")}${abaixo ? " (entrada abaixo do mínimo, liberada)" : ""}`, u) } });
  const est = await baixarEstoqueEAcerto(v, tab, u);
  const prod = await lancarProducao(v, tab, u);
  v = await prisma.lojaVenda.findUnique({ where: { id: v.id } });
  await sincronizarPortal(v).catch((e) => console.log("loja/portal:", e.message));
  return { ok: true, numero: v.numero, status: v.status, pedido: prod.numero || null, producaoErro: prod.ok ? null : prod.erro, avisos: est.avisos || [] };
}
export async function tentarProducao(numero, u) {
  const tab = await tabelas();
  const v = await prisma.lojaVenda.findUnique({ where: { numero: Number(numero) || 0 } });
  if (!v || v.status === "ORCAMENTO" || v.status === "CANCELADA") return { error: "Venda não encontrada ou não fechada." };
  if (v.pedidoNumero) return { ok: true, pedido: v.pedidoNumero };
  const r = await lancarProducao(v, tab, u);
  await sincronizarPortal(await prisma.lojaVenda.findUnique({ where: { id: v.id } })).catch(() => null);
  return r.ok ? { ok: true, pedido: r.numero } : { error: `Não lançou na produção: ${r.erro}` };
}
export async function registrarPagamento(numero, { valor, forma }, u) {
  const v = await prisma.lojaVenda.findUnique({ where: { numero: Number(numero) || 0 } });
  if (!v || !["EM_PRODUCAO", "PRONTA"].includes(v.status)) return { error: "Só venda em produção ou pronta recebe pagamento." };
  const c = Math.round(Number(String(valor).replace(",", ".")) * 100) || 0;
  const saldo = v.total - pago(v);
  if (!(c > 0)) return { error: "Informe o valor." };
  if (c > saldo) return { error: "Passou do saldo da venda." };
  const pagamentos = [...(v.pagamentos || []), { valor: c, forma: FORMAS.includes(forma) ? forma : "PIX", em: new Date().toISOString(), por: nomeU(u), tipo: "SALDO" }];
  const n = await prisma.lojaVenda.update({ where: { id: v.id }, data: { pagamentos, historico: hist(v, `Pagamento ${(c / 100).toFixed(2).replace(".", ",")}`, u) } });
  await sincronizarPortal(n).catch(() => null);
  return { ok: true };
}
export async function mudarStatus(numero, acao, { motivo } = {}, u) {
  const v = await prisma.lojaVenda.findUnique({ where: { numero: Number(numero) || 0 } });
  if (!v) return { error: "Venda não encontrada." };
  if (acao === "PRONTA") {
    if (v.status !== "EM_PRODUCAO") return { error: "Só venda em produção fica pronta." };
    await prisma.lojaVenda.update({ where: { id: v.id }, data: { status: "PRONTA", prontaEm: new Date(), historico: hist(v, "Pronta para retirada", u) } });
    return { ok: true };
  }
  if (acao === "ENTREGAR") {
    if (!["EM_PRODUCAO", "PRONTA"].includes(v.status)) return { error: "Venda não está aberta." };
    if (v.total - pago(v) > 0) return { error: "Receba o saldo antes de entregar." };
    await prisma.lojaVenda.update({ where: { id: v.id }, data: { status: "ENTREGUE", entregueEm: new Date(), historico: hist(v, "Entregue ao cliente", u) } });
    return { ok: true, nfce: true };
  }
  if (acao === "CANCELAR") {
    if (["ENTREGUE", "CANCELADA"].includes(v.status)) return { error: "Venda entregue ou já cancelada." };
    const m = String(motivo || "").trim();
    if (m.length < 3) return { error: "Informe o motivo do cancelamento." };
    // estoque baixado volta (peça lisa)
    if (v.estoqueBaixado) {
      const tab = await tabelas();
      // v1091 — estorna no mesmo depósito de onde saiu
      const movs = (Array.isArray(v.estoqueMovs) ? v.estoqueMovs : []).map((m) => ({ id: `${m.id}-EST`, nome: m.nome, deposito: m.deposito, tipo: "ENTRADA", quantidade: m.quantidade, ref: `CANCELAMENTO VENDA LOJA ${v.numero}` }));
      if (movs.length) await registrarMovimentos(movs);
      await prisma.finTitulo.updateMany({ where: { chaveImport: `NORTPED|LOJA-V${v.numero}`, status: "ABERTO" }, data: { status: "CANCELADO", atualizadoPorNome: nomeU(u) } });
    }
    const n = await prisma.lojaVenda.update({ where: { id: v.id }, data: { status: "CANCELADA", canceladaEm: new Date(), motivoCancel: m.slice(0, 300), historico: hist(v, `Cancelada: ${m}`, u) } });
    await sincronizarPortal(n).catch(() => null);
    return { ok: true, avisoPedido: v.pedidoNumero ? `Cancele também o pedido ${v.pedidoNumero} na Produção (ele já foi para o PCP).` : null, devolver: pago(v) > 0 ? pago(v) : 0 };
  }
  return { error: "Ação inválida." };
}
