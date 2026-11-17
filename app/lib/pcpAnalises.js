// v928 — sugestão #90 (Maycon): o ERP lê todo mês as análises do PCP (GET /api/ext/analises) e grava nas Análises operacionais.
//   Fluxo (analises-pcp-erp.md, PCP v111):
//   1. o ERP grava no PCP o custo interno do mês de cada setor (pessoal pela Matriz + freelancers identificados) — POST /api/ext/analises/custos;
//   2. lê as análises do mês e grava as peças (corte, expedição, silk, bordado, costura) em OpAnalise, como a importação da planilha;
//   3. roda sozinho do dia 1 ao dia 5 de cada mês (mês anterior; o último dia vale como fechamento) e pelo botão "Ler do PCP".
//   O DTF ainda não tem análise no ERP: vem guardado no resumo da leitura.
import { prisma } from "@/lib/prisma";
import { conexao } from "@/lib/cronograma";
import { gravarAnalises, custoDoSetor, CATEGORIAS_OP, PECAS_PERS } from "@/lib/opAnalise";
import { tipoDaPeca } from "@/lib/finOsKm";

const K_ST = "PCP_ANALISES|STATUS";
const TIPO_SETOR = { corte: "CORTE", expedicao: "EXPEDICAO", silk: "SILK", bordado: "BORDADO", costura: "COSTURA" };
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")) || 0);
const mesAnterior = () => { const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7); const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 2, 1)); return d.toISOString().slice(0, 7); };

async function pcp(path, body) {
  const { url, token } = await conexao();
  if (!token) throw new Error("Token do PCP não configurado.");
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(`${url}${path}`, { method: body ? "POST" : "GET", headers: { "X-Api-Key": token, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: ac.signal, cache: "no-store" });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch { throw new Error(`${path}: resposta não é JSON (HTTP ${r.status})`); }
    if (!r.ok || j?.ok === false) throw new Error(`${path}: ${j?.error || `HTTP ${r.status}`}`);
    return j;
  } catch (e) { throw new Error(e.name === "AbortError" ? `${path}: o PCP não respondeu em 60 s` : e.message); }
  finally { clearTimeout(t); }
}

// "porCategoria" pode vir como objeto { CAMISETA: 10 } ou lista [{ categoria, pecas }]
const paresCat = (x) => (Array.isArray(x) ? x.map((c) => [c.categoria ?? c.nome ?? c.tipo ?? c.chave, num(c.pecas ?? c.qtde ?? c.quantidade ?? c.qtd)]) : Object.entries(x || {}).map(([k, v]) => [k, typeof v === "object" ? num(v?.pecas ?? v?.qtde) : num(v)]));
const catErp = (setor, nome) => { const k = sa(nome); const cats = CATEGORIAS_OP[setor] || []; return cats.find(([c]) => c === k)?.[0] || cats.find(([, n]) => sa(n) === k)?.[0] || null; };
const ehTerc = (i) => i?.terceirizado === true || /TERCEIR/i.test(String(i?.origem || ""));
// tipo da tabela de facção do PCP ("camiseta_mc", "moletom_faixa", "camiseta_gv"…) → categoria da costura do ERP
function catCostura(chave, label) {
  const x = sa(`${chave || ""} ${label || ""}`);
  if (!x) return null;
  const com = /FAIXA|RECORTE/.test(x) ? "_COM" : "_SEM";
  if (/POLO/.test(x)) return /RECORTE/.test(x) ? "POLO_RECORTE" : "POLO_COMUM";
  if (/MOLETOM/.test(x)) return `MOLETOM_${/COLEGIAL/.test(x) ? "COLEGIAL" : "NORMAL"}${com}`;
  if (/CAMISETA/.test(x)) return `CAMISETA_${/(^|_)ML(_|$)|MANGA_LONGA/.test(x) ? "ML" : "MC"}${com}`;
  return catErp("COSTURA", label) || catErp("COSTURA", chave);
}
const tipoPers = (prod) => (/AVENTAL/.test(sa(prod)) ? "AVENTAL" : tipoDaPeca(prod));

// análise do PCP → registro da análise operacional do ERP (mesmo formato da importação da planilha)
export function paraErp(tipo, a, mes) {
  const setor = TIPO_SETOR[tipo];
  const T = a?.totais || {}, K = a?.calculo || {}, itens = Array.isArray(a?.itens) ? a.itens : [];
  const base = { competencia: mes, detalhe: itens.slice(0, 3000), extraPcp: { rev: a?.rev, custos: a?.custos || null, custosOrigem: a?.custosOrigem || null, calculo: K } };
  if (setor === "CORTE" || setor === "EXPEDICAO") {
    const qtds = {}; let fora = 0;
    for (const [nome, q] of paresCat(T.porCategoria)) { const k = catErp(setor, nome); if (k) qtds[k] = (qtds[k] || 0) + q; else fora += q; }
    const mercado = {};
    for (const c of Array.isArray(K.porCategoria) ? K.porCategoria : []) { const k = catErp(setor, c.categoria); if (k && c.valorMercado != null) mercado[k] = num(c.valorMercado); }
    return { ...base, qtds, semCategoria: Math.round(num(T.pecasSemCategoria) + fora), total: Object.values(qtds).reduce((s, v) => s + v, 0),
      ...(K.pecasEstimadas ? { pecasEstimadas: num(K.pecasEstimadas) } : {}), mercado: Object.keys(mercado).length ? mercado : null,
      detalhe: itens.map((i) => ({ pedido: String(i.pedido ?? ""), cliente: i.cliente, produto: i.produto, categoria: catErp(setor, i.categoria) || "SEM_CATEGORIA", qtde: num(i.qtde ?? i.pecas), concluido: i.data })) };
  }
  if (setor === "SILK") {   // grade peça × nº de cores, como a planilha
    const qtds = {}; let semCat = 0, unidSem = 0;
    for (const i of itens) {
      if (ehTerc(i)) continue;
      const pecas = num(i.pecas), cores = Math.max(1, Math.round(num(i.cores) || 1));
      const cat = tipoPers(i.produto);
      if (!cat || !PECAS_PERS.some(([k]) => k === cat)) { semCat += pecas; unidSem += num(i.impressoes) || pecas * cores; continue; }
      const k = `${cat}__C${Math.min(cores, 6)}`; qtds[k] = (qtds[k] || 0) + pecas;
    }
    const vm = num(K.vm), tinta = num(K.tinta);
    return { ...base, qtds, semCategoria: semCat, total: Object.values(qtds).reduce((s, v) => s + v, 0),
      mercado: vm ? Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`C${n}`, r2(n * vm)])) : null,
      extra: { unidades: num(T.impressoes), unidSemCat: unidSem, mercadoUnit: vm || null, tintaUnit: tinta || null, tinta: K.custoTinta != null ? r2(K.custoTinta) : null,
        terceirizado: { pecas: num(T.pecasTerceirizadas), unidades: num(T.impressoesTerceirizadas), valor: K.custoTerceirizacao != null ? r2(K.custoTerceirizacao) : null, fornecedores: {} }, fonte: "PCP" },
      detalhe: itens.map((i) => ({ pedido: String(i.pedido ?? ""), cliente: i.cliente, produto: i.produto, categoria: tipoPers(i.produto) || "SEM_CATEGORIA", qtde: num(i.pecas), nivel: num(i.cores), unidades: num(i.impressoes), origem: ehTerc(i) ? `Terceirizado · ${i.provider || ""}` : "Interno", concluido: i.data })) };
  }
  if (setor === "BORDADO") {   // flat por peça: valor = média do valor de referência das peças internas
    const int = itens.filter((i) => !ehTerc(i));
    const pecas = int.reduce((s, i) => s + num(i.pecas), 0) || num(T.pecas);
    const valor = int.reduce((s, i) => s + num(i.valor), 0) || num(K.custoMercado);
    return { ...base, qtds: pecas ? { PECA: pecas } : {}, semCategoria: 0, total: pecas, mercado: pecas ? { PECA: valor / pecas } : null,
      extra: { valorTabela: r2(valor), terceirizado: { pecas: num(T.pecasTerceirizadas), valor: K.custoTerceirizacao != null ? r2(K.custoTerceirizacao) : null, fornecedores: {} }, fonte: "PCP" },
      detalhe: itens.map((i) => ({ pedido: String(i.pedido ?? ""), cliente: i.cliente, produto: i.produto, categoria: "PECA", qtde: num(i.pecas), preco: r2(i.vUnit ?? i.porPeca), valor: r2(i.valor), origem: ehTerc(i) ? `Terceirizado · ${i.provider || ""}` : "Interno", concluido: i.data })) };
  }
  if (setor === "COSTURA") {   // peças INTERNAS por tipo da tabela de facção do PCP → categorias da costura do ERP; valor de mercado = valor de facção médio
    const qtds = {}, soma = {}; let fora = 0;
    for (const [chave, t] of Object.entries(T.porTipo || {})) {
      const pecas = num(t?.pecasInt), valor = num(t?.valorInt);
      if (!pecas) continue;
      const k = chave === "_sem" ? null : catCostura(chave, t?.label);
      if (!k) { fora += pecas; continue; }
      qtds[k] = (qtds[k] || 0) + pecas; soma[k] = (soma[k] || 0) + valor;
    }
    const mercado = Object.fromEntries(Object.keys(soma).filter((k) => qtds[k]).map((k) => [k, r2(soma[k] / qtds[k])]));
    return { ...base, qtds, semCategoria: Math.round(fora), total: Object.values(qtds).reduce((s, v) => s + v, 0), mercado: Object.keys(mercado).length ? mercado : null,
      detalhe: itens.map((i) => ({ pedido: String(i.pedido ?? ""), cliente: i.cliente, produto: i.produto, categoria: catCostura(i.tipo, i.tipoLabel) || "SEM_CATEGORIA", tipoPcp: i.tipoLabel || i.tipo, qtde: num(i.pecas), valor: r2(i.valor), origem: ehTerc(i) ? `Terceirizado · ${i.provider || ""}` : "Interno", concluido: i.data })) };
  }
  return null;
}

// lê (e grava) as análises do mês. dry = só mostra o que gravaria (para conferir o formato)
export async function lerAnalisesPcp({ mes = null, dry = false, quem = "PCP (automático)", custos = true } = {}) {
  const m = /^\d{4}-\d{2}$/.test(mes || "") ? mes : mesAnterior();
  const res = { mes: m, em: new Date().toISOString(), ok: true, erro: null, custos: [], setores: {}, dtf: null, mesEncerrado: null };
  try {
    if (custos && !dry) {   // 1. custo interno de cada setor (o mesmo das nossas análises) vai para o PCP
      const lista = [];
      for (const [tipo, setor] of Object.entries(TIPO_SETOR)) {
        const c = await custoDoSetor(setor, m).catch(() => null);
        const a = await prisma.opAnalise.findUnique({ where: { setor_competencia: { setor, competencia: m } } }).catch(() => null);
        const pessoal = a?.pessoalManual ?? c?.pessoal, free = a?.freelancerManual ?? c?.freelancer;
        if (pessoal > 0 || free > 0) lista.push({ mes: m, tipo, pessoal: r2(pessoal || 0), freelancer: r2(free || 0), por: "ERP Meridian" });
      }
      if (lista.length) { await pcp("/api/ext/analises/custos", { custos: lista }); res.custos = lista.map((x) => `${x.tipo}: ${x.pessoal + x.freelancer}`); }
    }
    const j = await pcp(`/api/ext/analises?mes=${m}`);
    res.mesEncerrado = j.mesEncerrado ?? null; res.rev = j.rev ?? null;
    for (const [tipo, a] of Object.entries(j.analises || {})) {
      if (tipo === "dtf") { res.dtf = { totais: a?.totais || null, calculo: a?.calculo || null }; continue; }
      if (!TIPO_SETOR[tipo]) continue;
      const reg = paraErp(tipo, a, m);
      if (!reg) continue;
      res.setores[TIPO_SETOR[tipo]] = { pecas: reg.total, semCategoria: reg.semCategoria, categorias: Object.keys(reg.qtds).length,
        ...(dry ? { amostra: { totais: a?.totais, calculoChaves: Object.keys(a?.calculo || {}), item: (a?.itens || [])[0] || null }, qtds: reg.qtds } : {}) };
      if (!dry && reg.total > 0) {
        const { extraPcp, ...r } = reg;
        await gravarAnalises(TIPO_SETOR[tipo], [{ ...r, extra: { ...(r.extra || {}), pcp: extraPcp } }], { nome: `PCP · análise de ${m}`, quem });
      }
    }
    if (!dry) {
      try { const { atualizarParamsFpp } = await import("@/lib/fppAnalises"); await atualizarParamsFpp({ forcar: true }); } catch {}
      try { const { sincronizarPecasKpi } = await import("@/lib/opAnalise"); await sincronizarPecasKpi(); } catch {}
    }
  } catch (e) { res.ok = false; res.erro = e.message; }
  if (!dry) await prisma.finConfig.upsert({ where: { chave: K_ST }, create: { chave: K_ST, valor: JSON.stringify(res) }, update: { valor: JSON.stringify(res) } }).catch(() => null);
  return res;
}
export async function statusAnalisesPcp() {
  try { return JSON.parse((await prisma.finConfig.findUnique({ where: { chave: K_ST } }))?.valor || "null"); } catch { return null; }
}

// todo dia, às 7h: do dia 1 ao 5, relê o mês anterior (o dia 5 vale como fechamento)
export function agendarAnalisesPcp() {
  if (globalThis.__anPcp) return; globalThis.__anPcp = true;
  const tick = async () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const dia = Number(p.day), hora = Number(p.hour) % 24;
    if (dia < 1 || dia > 5 || hora !== 7) return;
    const st = await statusAnalisesPcp();
    const hoje = new Date().toISOString().slice(0, 10);
    if (st?.ok && st.mes === mesAnterior() && String(st.em || "").slice(0, 10) === hoje) return;   // já leu hoje
    const r = await lerAnalisesPcp({ quem: "PCP (automático)" }).catch((e) => ({ ok: false, erro: e.message }));
    console.log(`[análises PCP] ${r.mes}: ${r.ok ? Object.entries(r.setores || {}).map(([s, x]) => `${s} ${x.pecas}`).join(" · ") : r.erro}`);
  };
  setInterval(() => tick().catch(() => null), 20 * 60 * 1000);
  setTimeout(() => tick().catch(() => null), 60 * 1000);
}
