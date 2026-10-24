// v317 — leitura do Cronograma PCP (sistema do Maycon): programação de entrega por nº de pedido → PedidoVenda.entregaPrevista
// Endpoints só-leitura com token no cabeçalho X-Api-Key: /api/ext/pedidos (itens) e /api/ext/etapas (programação por etapa).
// v353 — regras novas do Maycon (como-ler-o-cronograma): situacao LEVANTAMENTO/A_PROGRAMAR/EM_PRODUCAO/CONCLUIDO;
//   peças = campo `pecas` (complemento = forro/entretela/recorte… vale 0); `quantidade` só p/ corte e matéria-prima;
//   item sem `pedido` = amostra/piloto (sem contrapartida); OP de agrupamento casa pelos números de `pedidosAgrupados`.
// O formato é lido de forma tolerante (nomes de campo alternativos); "diagnostico" mostra o que veio, para ajustar se precisar.
import { prisma } from "@/lib/prisma";

const K_URL = "CRONO|URL", K_TOKEN = "CRONO|TOKEN", K_SYNC = "CRONO|SYNC";
const URL_ANTIGA = "http://147.93.35.189:8124";
const URL_PADRAO = "https://pcp.meridianpro.com.br", TOKEN_PADRAO = "meridian-pcp";   // v353
const INTERVALO_MS = 10 * 60 * 1000;

const cfg = async (k) => (await prisma.finConfig.findUnique({ where: { chave: k } }).catch(() => null))?.valor || "";
export async function conexao() {
  let url = (await cfg(K_URL)) || process.env.CRONO_URL || URL_PADRAO;
  if (url.replace(/\/+$/, "") === URL_ANTIGA) url = URL_PADRAO;   // v353 — endereço novo do PCP
  const token = (await cfg(K_TOKEN)) || process.env.CRONO_TOKEN || TOKEN_PADRAO;
  return { url: url.replace(/\/+$/, ""), token };
}
export async function salvarConexao({ url, token }) {
  const up = (chave, valor) => prisma.finConfig.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
  if (url !== undefined) await up(K_URL, String(url || "").trim());
  if (token) await up(K_TOKEN, String(token).trim());
}
export async function statusSync() {
  const { url, token } = await conexao();
  let s = {}; try { s = JSON.parse(await cfg(K_SYNC) || "{}"); } catch {}
  return { url, temToken: !!token, tokenFim: token ? token.slice(-4) : "", ...s };
}

async function get(path) {
  const { url, token } = await conexao();
  if (!token) throw new Error("Token do Cronograma não configurado.");
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(`${url}${path}`, { headers: { "X-Api-Key": token, Accept: "application/json" }, signal: ac.signal, cache: "no-store" });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${txt.slice(0, 160)}`);
    try { return JSON.parse(txt); } catch { throw new Error(`${path}: resposta não é JSON (${txt.slice(0, 120)})`); }
  } catch (e) { throw new Error(e.name === "AbortError" ? `${path}: sem resposta em 20 s (${url})` : e.message); }
  finally { clearTimeout(t); }
}

// ---------- leitura tolerante ----------
const listaDe = (j) => (Array.isArray(j) ? j : j && typeof j === "object" ? (j.itens || j.items || j.pedidos || j.etapas || j.data || j.rows || j.result || []) : []);
const chaves = (o) => Object.fromEntries(Object.keys(o || {}).map((k) => [k.toLowerCase().replace(/[_\s-]/g, ""), k]));
function pick(o, ...nomes) {
  const m = chaves(o);
  for (const n of nomes) { const k = m[n.toLowerCase().replace(/[_\s-]/g, "")]; if (k != null && o[k] != null && o[k] !== "") return o[k]; }
  return null;
}
const dataDe = (v) => {
  if (!v) return null;
  const s = String(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};
const soDig = (v) => String(v || "").replace(/\D/g, "");
const temCampo = (o, ...nomes) => { const m = chaves(o); return nomes.some((n) => m[n.toLowerCase().replace(/[_\s-]/g, "")] != null); };
const pedidoDe = (o) => {
  const p = pick(o, "pedido", "numeroPedido", "pedidoNumero", "nPedido", "numero_pedido", "pedidoNum");
  const v = p && typeof p === "object" ? pick(p, "numero", "codigo", "id") : p;
  if (v) return soDig(v);
  if (temCampo(o, "pedido")) return "";   // v353 — campo existe e veio vazio: amostra/piloto/grade sem OP (não deduzir pelo itemCode)
  const ic = pick(o, "itemCode", "codigoItem", "item");
  return ic ? soDig(String(ic).split(/[-/]/)[0]) : "";
};
const itemDe = (o) => String(pick(o, "itemCode", "codigoItem", "item_code") || "");
// v353 — produção em aberto = situacao != CONCLUIDO (LEVANTAMENTO, A_PROGRAMAR, EM_PRODUCAO). Termos antigos mantidos por tolerância.
const ehConcluido = (s) => /CONCLU|FINALIZ|ENTREGUE|EXPEDID|FATUR/i.test(String(s || ""));
const SITUACAO_TXT = { LEVANTAMENTO: "LEVANTAMENTO", A_PROGRAMAR: "A PROGRAMAR", EM_PRODUCAO: "EM PRODUÇÃO", CONCLUIDO: "CONCLUÍDO" };
const situacaoTxt = (s) => SITUACAO_TXT[String(s || "").toUpperCase()] || String(s || "").toUpperCase();
const simNao = (v) => v === true || /^(true|1|sim|s)$/i.test(String(v ?? ""));
const listaNums = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,;\s]+/)).map((x) => soDig(x && typeof x === "object" ? pick(x, "numero", "pedido", "codigo") : x)).filter(Boolean);
const ehFaturado = (s) => /FATUR/i.test(String(s || ""));   // v347

export function normalizarItem(o) {
  const quantidade = Number(pick(o, "quantidade", "qtd", "qtde")) || 0;   // v353 — unidades a cortar (corte / matéria-prima)
  const complemento = simNao(pick(o, "complemento"));
  const pc = pick(o, "pecas");
  const pecas = pc != null ? Number(pc) || 0 : complemento ? 0 : quantidade;   // v353 — peças de verdade (complemento = 0)
  const agrupamento = simNao(pick(o, "agrupamento"));
  return {
    itemCode: itemDe(o), pedido: pedidoDe(o),
    produto: String(pick(o, "produto", "descricao", "nome", "item") || ""),
    cliente: String(pick(o, "cliente", "clienteNome", "razaoSocial") || ""),
    quantidade, pecas, complemento, agrupamento,
    oc: (() => { const v = String(pick(o, "oc", "ordemCompra") || "").trim(); return /^0*$/.test(v) ? "" : v; })(),   // v375
    pedidosAgrupados: agrupamento ? listaNums(pick(o, "pedidosAgrupados", "pedidos_agrupados")) : [],
    entrega: dataDe(pick(o, "entrega", "dataEntrega", "prazoEntrega", "prazo", "entregaPrevista", "previsaoEntrega", "dataPrevista")),
    situacao: String(pick(o, "situacao", "status", "fase") || ""),
    etapaAtual: String(pick(o, "etapaAtual", "etapa", "setorAtual", "setor") || ""),
  };
}
export function normalizarEtapa(o) {
  const e = normalizarEtapa0(o);
  return { ...e, fim: e.concluida && e.saida ? e.saida : e.planejadoFim };
}
function normalizarEtapa0(o) {
  return {
    itemCode: itemDe(o), pedido: pedidoDe(o),
    etapa: String(pick(o, "etapa", "setor", "nome") || ""), subetapa: String(pick(o, "subetapa", "tipo") || ""),
    inicio: dataDe(pick(o, "planejadoInicio", "inicioPlanejado", "inicio", "dataInicio")),
    // v318 — etapa concluída vale a data real de saída; aberta, o fim planejado
    planejadoFim: dataDe(pick(o, "planejadoFim", "fimPlanejado", "fim", "dataFim", "previsaoFim")),
    saida: dataDe(pick(o, "saidaEm", "fimReal", "concluidaEm", "concluidoEm")),
    concluida: pick(o, "concluida", "concluido") === true || /^(true|1|sim)$/i.test(String(pick(o, "concluida", "concluido") ?? "")),
  };
}

// agrupa por pedido: prazo (maior entrega dos itens), fim programado (maior fim planejado das etapas)
export function agruparPorPedido(itens, etapas) {
  const g = {};
  const de = (n) => (g[n] = g[n] || { pedido: n, itens: [], etapas: [], prazo: null, fimProgramado: null });
  for (const i of itens) if (i.pedido) { const p = de(i.pedido); p.itens.push(i); if (i.entrega && (!p.prazo || i.entrega > p.prazo)) p.prazo = i.entrega; }
  for (const e of etapas) if (e.pedido) { const p = de(e.pedido); p.etapas.push(e); if (e.fim && (!p.fimProgramado || e.fim > p.fimProgramado)) p.fimProgramado = e.fim; }
  for (const p of Object.values(g)) {
    // v353 — OP de agrupamento: lista dos pedidos comerciais que ela contempla
    p.agrupamento = p.itens.some((i) => i.agrupamento);
    p.pedidosAgrupados = [...new Set(p.itens.flatMap((i) => i.pedidosAgrupados))];
    p.pecas = p.itens.reduce((s, i) => s + i.pecas, 0);             // peças reais (sem complementos)
    p.oc = (p.itens.find((i) => i.oc) || {}).oc || "";               // v375 — O.C. do cliente informada no PCP
    p.quantidadeCorte = p.itens.reduce((s, i) => s + i.quantidade, 0); // unidades a cortar
    p.emProducao = p.itens.some((i) => !ehConcluido(i.situacao));
    p.concluido = p.itens.length > 0 && p.itens.every((i) => ehConcluido(i.situacao));
    p.faturado = p.itens.length > 0 && p.itens.every((i) => ehFaturado(i.situacao));
    const sits = [...new Set(p.itens.map((i) => i.situacao).filter(Boolean))];
    const etps = [...new Set(p.itens.filter((i) => !ehConcluido(i.situacao)).map((i) => i.etapaAtual).filter(Boolean))];
    p.situacao = p.concluido ? "CONCLUÍDO" : sits.filter((x) => !ehConcluido(x)).map(situacaoTxt).join(" · ") || (p.etapas.length ? "PROGRAMADO" : "");
    p.etapa = etps.join(" · ").toUpperCase();
    // resumo por item: fim programado do item = maior fim das etapas dele
    p.resumo = p.itens.map((i) => {
      const fims = p.etapas.filter((e) => e.itemCode && e.itemCode === i.itemCode && e.fim).map((e) => e.fim).sort();
      return { op: p.pedido, itemCode: i.itemCode, produto: i.produto, qtd: i.pecas, pecas: i.pecas, qtdCorte: i.quantidade, complemento: i.complemento, situacao: situacaoTxt(i.situacao), etapa: i.etapaAtual, entrega: i.entrega, fimProgramado: fims[fims.length - 1] || null };
    });
    // entrega do pedido = a do último item a ficar pronto (fim programado do item; sem programação, o prazo de entrega dele)
    const datas = p.resumo.map((r) => r.fimProgramado || r.entrega).filter(Boolean);
    if (!p.resumo.length && p.fimProgramado) datas.push(p.fimProgramado);
    p.entregaPrevista = datas.sort().pop() || p.fimProgramado || p.prazo || null;
  }
  return g;
}

// v353 — índice nº comercial → OPs: a própria OP e, quando é agrupamento, cada número de pedidosAgrupados
export function indiceComercial(g) {
  const ix = {};
  const add = (n, op) => { (ix[n] = ix[n] || []).includes(op) || ix[n].push(op); };
  for (const op of Object.values(g)) { add(op.pedido, op.pedido); for (const n of op.pedidosAgrupados) add(n, op.pedido); }
  return ix;
}
// junta as OPs de um pedido comercial (normalmente 1; agrupado pode cair em mais de uma)
export function visaoDoPedido(g, ops, numero) {
  const l = ops.map((o) => g[o]).filter(Boolean);
  if (!l.length) return null;
  if (l.length === 1 && l[0].pedido === numero) return { ...l[0], viaAgrupamento: null };
  const datas = (k) => l.map((x) => x[k]).filter(Boolean).sort().pop() || null;
  const agr = l.filter((x) => x.pedido !== numero).map((x) => x.pedido);
  return {
    pedido: numero, itens: l.flatMap((x) => x.itens), etapas: l.flatMap((x) => x.etapas),
    prazo: datas("prazo"), fimProgramado: datas("fimProgramado"), entregaPrevista: datas("entregaPrevista"),
    concluido: l.every((x) => x.concluido), faturado: l.every((x) => x.faturado), emProducao: l.some((x) => x.emProducao),
    pecas: l.reduce((s, x) => s + x.pecas, 0), quantidadeCorte: l.reduce((s, x) => s + x.quantidadeCorte, 0),
    situacao: [...new Set(l.map((x) => x.situacao).filter(Boolean))].join(" · "),
    etapa: [...new Set(l.map((x) => x.etapa).filter(Boolean))].join(" · "),
    resumo: l.flatMap((x) => x.resumo), agrupamento: true, viaAgrupamento: agr, oc: (l.find((x) => x.oc) || {}).oc || "",
  };
}

// ---------- sincronização ----------
let rodando = null;
export async function sincronizar({ forcar = false, intervaloMs = INTERVALO_MS } = {}) {   // v420 — gestão da produção lê a cada 1 min
  const st = await statusSync();
  if (!st.temToken) return { ok: false, erro: "Token do Cronograma não configurado.", ...st };
  if (!forcar && st.em && Date.now() - new Date(st.em).getTime() < intervaloMs && !st.erro) return { ok: true, pulado: true, ...st };
  if (rodando) return rodando;
  rodando = (async () => {
    const res = { em: new Date().toISOString(), erro: null, itens: 0, etapas: 0, pedidosCrono: 0, casados: 0, semPedidoAqui: 0 };
    try {
      const jp = await get("/api/ext/pedidos");
      let je = []; try { je = await get("/api/ext/etapas"); } catch (e) { res.avisoEtapas = e.message; }
      const itens = listaDe(jp).map(normalizarItem), etapas = listaDe(je).map(normalizarEtapa);
      res.itens = itens.length; res.etapas = etapas.length; res.rev = jp?.rev ?? null;
      const g = agruparPorPedido(itens, etapas);
      const ix = indiceComercial(g);
      res.pedidosCrono = Object.keys(g).length;
      // v353 — números de controle (regras do Maycon)
      res.semNumero = itens.filter((i) => !i.pedido).length;                       // amostras/pilotos sem OP
      res.complementos = itens.filter((i) => i.complemento).length;
      res.pecas = itens.reduce((s, i) => s + i.pecas, 0);
      res.quantidadeCorte = itens.reduce((s, i) => s + i.quantidade, 0);
      res.opsAgrupamento = Object.values(g).filter((o) => o.agrupamento).length;
      res.opsEmProducao = Object.values(g).filter((o) => o.emProducao).length;
      res.pecasEmProducao = itens.filter((i) => i.pedido && !ehConcluido(i.situacao)).reduce((s, i) => s + i.pecas, 0);
      // v421 — compras do PCP: pendentes por OP (coluna Compras) e compras avulsas
      let jc = null; try { jc = await get("/api/ext/compras"); } catch (e) { res.avisoCompras = e.message; }
      const pend = Array.isArray(jc?.pendentes) ? jc.pendentes : [];
      const comprasPorOp = {};
      for (const c of pend.filter((x) => !x.avulsa)) (comprasPorOp[soDig(c.orderNo)] ||= []).push({ produto: String(c.produto || ""), nome: String(c.nome || ""), fornecedor: String(c.fornecedor || "") || null, pedido: !!c.pedido, dataPedido: c.dataPedido || null });
      res.comprasPendentes = pend.filter((x) => !x.avulsa).length;
      if (jc) { try { res.avulsasPcp = await importarAvulsasPcp([...pend.filter((x) => x.avulsa), ...(Array.isArray(jc.concluidas) ? jc.concluidas.filter((x) => x.avulsa) : [])]); } catch (e) { res.avisoAvulsas = e.message; } }
      const aqui = await prisma.pedidoVenda.findMany({ select: { id: true, numero: true, status: true, oc: true } });
      for (const p of aqui) {
        const c = visaoDoPedido(g, ix[soDig(p.numero)] || [], soDig(p.numero));
        const ops = [...new Set([soDig(p.numero), ...(ix[soDig(p.numero)] || [])])];
        const cc = ops.flatMap((o) => comprasPorOp[o] || []);   // v421
        if (!c) { await prisma.pedidoVenda.update({ where: { id: p.id }, data: { cronoSituacao: "NÃO ESTÁ NO CRONOGRAMA", cronoEtapa: null, cronoEm: new Date(res.em), entregaPrevista: null, cronoItens: [], cronoCompras: cc } }); continue; }
        res.casados++;
        await prisma.pedidoVenda.update({ where: { id: p.id }, data: {
          entregaPrevista: c.entregaPrevista ? new Date(`${c.entregaPrevista}T00:00:00Z`) : null,
          cronoPrazo: c.prazo ? new Date(`${c.prazo}T00:00:00Z`) : null,
          cronoFimProgramado: c.fimProgramado ? new Date(`${c.fimProgramado}T00:00:00Z`) : null,
          ...(!p.oc && c.oc ? { oc: String(c.oc).slice(0, 60) } : {}),   // v375 — O.C. do PCP quando o PV não trouxe
          cronoSituacao: (c.viaAgrupamento?.length ? `${c.situacao || "—"} · AGRUPADO NA OP ${c.viaAgrupamento.join("/")}` : c.situacao) || null, cronoEtapa: c.etapa || null, cronoConcluido: c.concluido, cronoEm: new Date(res.em), cronoItens: c.resumo, cronoCompras: cc,
          // v373 — o PCP não fecha o pedido: concluído na produção continua em andamento no financeiro até a NF (faturarPelasNfs)
        } });
      }
      const nums = new Set(aqui.map((p) => soDig(p.numero)));
      // v353 — OP do PCP sem PV aqui: não conta se ela própria ou algum pedido agrupado nela casou; só produção em aberto
      res.semPedidoAqui = Object.values(g).filter((o) => o.emProducao && !nums.has(o.pedido) && !o.pedidosAgrupados.some((n) => nums.has(n))).length;
      // v321 — pedidos em andamento no PCP que ainda não têm PV aqui (para saber o que falta subir)
    } catch (e) { res.erro = e.message; }
    await prisma.finConfig.upsert({ where: { chave: K_SYNC }, create: { chave: K_SYNC, valor: JSON.stringify(res) }, update: { valor: JSON.stringify(res) } });
    return { ok: !res.erro, ...(await statusSync()) };
  })();
  try { return await rodando; } finally { rodando = null; }
}

// v421 — compras avulsas do PCP (orderNo 1210, 1310…): cria aqui (origem PCP) e acompanha comprada/recebida; itens editados aqui não são sobrescritos
async function importarAvulsasPcp(lista) {
  const { sincronizarAvulsa } = await import("@/lib/compras");
  const por = {};
  for (const x of lista) (por[String(x.orderNo || x.id)] ||= []).push(x);
  let novas = 0;
  for (const [num, its] of Object.entries(por)) {
    its.sort((a, b) => (a.idx || 0) - (b.idx || 0));
    const status = its.every((i) => i.recebido) ? "RECEBIDA" : its.every((i) => i.pedido || i.recebido) ? "COMPRADA" : "ABERTA";
    const ex = await prisma.compraAvulsa.findFirst({ where: { numero: num, origem: "PCP" } });
    if (!ex) {
      if (status === "RECEBIDA") continue;   // já encerrada no PCP antes da integração
      const c = await prisma.compraAvulsa.create({ data: { numero: num, origem: "PCP", destino: "OPERACAO", obs: "Compra avulsa do PCP", status, criadoPorNome: "PCP (MAYCON)",
        itens: its.map((i) => ({ nome: String(i.nome || "").replace(/\s+/g, " ").trim().toUpperCase(), quantidade: Number(i.qtd) || 0, unidade: "UN",
          fornecedorId: null, fornecedorNome: String(i.fornecedor || "").trim().toUpperCase() || null, bomPara: null, recebido: !!i.recebido })) } });
      await sincronizarAvulsa(c); novas++;
    } else if (ex.status !== "CANCELADA" && ex.status !== status) {
      const c = await prisma.compraAvulsa.update({ where: { id: ex.id }, data: { status } });
      await sincronizarAvulsa(c);
    }
  }
  return novas;
}

// mostra o que o Cronograma devolve (amostra crua + como foi lido)
export async function diagnostico() {
  const out = { conexao: await statusSync() };
  for (const [k, path, norm] of [["pedidos", "/api/ext/pedidos", normalizarItem], ["etapas", "/api/ext/etapas", normalizarEtapa]]) {
    try {
      const j = await get(path); const l = listaDe(j);
      out[k] = { ok: true, chavesTopo: Array.isArray(j) ? "(lista)" : Object.keys(j || {}), total: l.length, amostra: l.slice(0, 2), lido: l.slice(0, 2).map(norm) };
    } catch (e) { out[k] = { ok: false, erro: e.message }; }
  }
  return out;
}

// v381 — Comercial › Acompanhamento: lê ao vivo do PCP os itens e etapas de um pedido (inclui OP de agrupamento)
export async function pcpDoPedido(numero) {
  const n = soDig(numero);
  const [jp, je] = await Promise.all([get("/api/ext/pedidos"), get("/api/ext/etapas").catch(() => [])]);
  const brutos = listaDe(jp);
  const itens = brutos.map((o) => ({ ...normalizarItem(o), atualizadoEm: dataDe(pick(o, "atualizadoEm")), prestadorItem: null }));
  const g = agruparPorPedido(itens, []);
  const ops = (indiceComercial(g)[n] || []);
  const meus = itens.filter((i) => ops.includes(i.pedido));
  const codes = new Set(meus.map((i) => i.itemCode));
  const etapas = listaDe(je).filter((e) => codes.has(itemDe(e)) || ops.includes(pedidoDe(e))).map((e) => ({
    ...normalizarEtapa(e), entrada: dataDe(pick(e, "entradaEm")), prestador: String(pick(e, "prestador") || ""), quantidade: Number(pick(e, "quantidade")) || null,
  }));
  return { numero: n, ops, agrupado: ops.some((o) => o !== n), itens: meus, etapas };
}

// v401 — Conferência Pedidos em andamento × PCP do Maycon (ao vivo): o que está em andamento aqui e lá, e onde diverge
// · PCP em andamento = OP com algum item não concluído (OP de agrupamento conta 1, cobrindo os pedidos agrupados nela)
// · cada pedido em andamento aqui: OP própria aberta | só via OP de agrupamento | todas as OPs concluídas | fora do PCP
// · cada OP aberta no PCP sem pedido em andamento aqui: diz como o pedido está aqui (faturado, interno, inexistente…)
export async function confrontoPcp() {
  const jp = await get("/api/ext/pedidos");
  const itens = listaDe(jp).map(normalizarItem);
  const g = agruparPorPedido(itens, []);
  const ix = indiceComercial(g);
  const ops = Object.values(g);
  const abertas = ops.filter((o) => !o.concluido && !o.faturado);
  const nossos = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO" }, select: { numero: true, cliente: true, interno: true, total: true, cronoSituacao: true } });
  const todosAqui = Object.fromEntries((await prisma.pedidoVenda.findMany({ select: { numero: true, status: true, interno: true, cliente: true } })).map((p) => [soDig(p.numero), p]));
  const cliOp = (o) => (o.itens.find((i) => i.cliente) || {}).cliente || "";
  const linhaOp = (o) => ({ op: o.pedido, cliente: cliOp(o), situacao: o.situacao || "", pecas: o.pecas, agrupamento: !!o.agrupamento, pedidosAgrupados: o.pedidosAgrupados });
  const aqui = nossos.map((p) => {
    const n = soDig(p.numero);
    const lops = (ix[n] || []).map((o) => g[o]).filter(Boolean);
    const propria = lops.find((o) => o.pedido === n);
    const abertasDele = lops.filter((o) => !o.concluido && !o.faturado);
    const grupo = !lops.length ? "FORA_PCP" : !abertasDele.length ? "CONCLUIDO_PCP" : propria && abertasDele.includes(propria) ? "OP_PROPRIA" : "SO_AGRUPADO";
    return { numero: p.numero, cliente: p.cliente, interno: p.interno, total: Number(p.total) || 0, grupo,
      ops: lops.map((o) => ({ op: o.pedido, situacao: o.concluido ? "CONCLUÍDO" : o.situacao, agrupamento: !!o.agrupamento })) };
  });
  const nossosSet = new Set(nossos.map((p) => soDig(p.numero)));
  const pcpSemAqui = abertas
    .filter((o) => ![o.pedido, ...o.pedidosAgrupados].some((n) => nossosSet.has(soDig(n))))
    .map((o) => { const p = todosAqui[soDig(o.pedido)] || o.pedidosAgrupados.map((n) => todosAqui[soDig(n)]).find(Boolean);
      return { ...linhaOp(o), aqui: !p ? "NÃO EXISTE AQUI" : p.interno ? `INTERNO (${p.status})` : p.status }; });
  const conta = (k, internos = false) => aqui.filter((x) => x.grupo === k && (internos ? x.interno : !x.interno)).length;
  return {
    em: new Date().toISOString(),
    pcp: { opsAbertas: abertas.length, opsAbertasAgrupamento: abertas.filter((o) => o.agrupamento).length, opsConcluidas: ops.filter((o) => o.concluido).length },
    aqui: { emAndamento: nossos.filter((p) => !p.interno).length, internos: nossos.filter((p) => p.interno).length,
      opPropria: conta("OP_PROPRIA"), soAgrupado: conta("SO_AGRUPADO"), concluidoPcp: conta("CONCLUIDO_PCP"), foraPcp: conta("FORA_PCP") },
    pedidos: aqui.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.numero.localeCompare(b.numero)),
    pcpSemAqui: pcpSemAqui.sort((a, b) => String(a.op).localeCompare(String(b.op))),
  };
}
