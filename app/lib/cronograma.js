// v317 — leitura do Cronograma PCP (sistema do Maycon): programação de entrega por nº de pedido → PedidoVenda.entregaPrevista
// Endpoints só-leitura com token no cabeçalho X-Api-Key: /api/ext/pedidos (itens) e /api/ext/etapas (programação por etapa).
// O formato é lido de forma tolerante (nomes de campo alternativos); "diagnostico" mostra o que veio, para ajustar se precisar.
import { prisma } from "@/lib/prisma";

const K_URL = "CRONO|URL", K_TOKEN = "CRONO|TOKEN", K_SYNC = "CRONO|SYNC";
const URL_PADRAO = "http://147.93.35.189:8124";
const INTERVALO_MS = 10 * 60 * 1000;

const cfg = async (k) => (await prisma.finConfig.findUnique({ where: { chave: k } }).catch(() => null))?.valor || "";
export async function conexao() {
  const url = (await cfg(K_URL)) || process.env.CRONO_URL || URL_PADRAO;
  const token = (await cfg(K_TOKEN)) || process.env.CRONO_TOKEN || "";
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
const pedidoDe = (o) => {
  const p = pick(o, "pedido", "numeroPedido", "pedidoNumero", "nPedido", "numero_pedido", "pedidoNum");
  const v = p && typeof p === "object" ? pick(p, "numero", "codigo", "id") : p;
  if (v) return soDig(v);
  const ic = pick(o, "itemCode", "codigoItem", "item");
  return ic ? soDig(String(ic).split(/[-/]/)[0]) : "";
};
const itemDe = (o) => String(pick(o, "itemCode", "codigoItem", "item_code") || "");
const ehConcluido = (s) => /CONCLU|FINALIZ|ENTREGUE|EXPEDID/i.test(String(s || ""));

export function normalizarItem(o) {
  return {
    itemCode: itemDe(o), pedido: pedidoDe(o),
    produto: String(pick(o, "produto", "descricao", "nome", "item") || ""),
    quantidade: Number(pick(o, "quantidade", "qtd", "qtde", "pecas")) || 0,
    entrega: dataDe(pick(o, "entrega", "dataEntrega", "prazoEntrega", "prazo", "entregaPrevista", "previsaoEntrega", "dataPrevista")),
    situacao: String(pick(o, "situacao", "status", "fase") || ""),
    etapaAtual: String(pick(o, "etapaAtual", "etapa", "setorAtual", "setor") || ""),
  };
}
export function normalizarEtapa(o) {
  return {
    itemCode: itemDe(o), pedido: pedidoDe(o),
    etapa: String(pick(o, "etapa", "setor", "nome") || ""), subetapa: String(pick(o, "subetapa", "tipo") || ""),
    inicio: dataDe(pick(o, "planejadoInicio", "inicioPlanejado", "inicio", "dataInicio")),
    fim: dataDe(pick(o, "planejadoFim", "fimPlanejado", "fim", "dataFim", "previsaoFim")),
    concluida: !!(pick(o, "concluida", "concluido", "concluidaEm", "concluidoEm", "fimReal", "saidaEm")),
  };
}

// agrupa por pedido: prazo (maior entrega dos itens), fim programado (maior fim planejado das etapas)
export function agruparPorPedido(itens, etapas) {
  const g = {};
  const de = (n) => (g[n] = g[n] || { pedido: n, itens: [], etapas: [], prazo: null, fimProgramado: null });
  for (const i of itens) if (i.pedido) { const p = de(i.pedido); p.itens.push(i); if (i.entrega && (!p.prazo || i.entrega > p.prazo)) p.prazo = i.entrega; }
  for (const e of etapas) if (e.pedido) { const p = de(e.pedido); p.etapas.push(e); if (e.fim && (!p.fimProgramado || e.fim > p.fimProgramado)) p.fimProgramado = e.fim; }
  for (const p of Object.values(g)) {
    p.concluido = p.itens.length > 0 && p.itens.every((i) => ehConcluido(i.situacao));
    const sits = [...new Set(p.itens.map((i) => i.situacao).filter(Boolean))];
    const etps = [...new Set(p.itens.filter((i) => !ehConcluido(i.situacao)).map((i) => i.etapaAtual).filter(Boolean))];
    p.situacao = p.concluido ? "CONCLUÍDO" : sits.join(" · ").toUpperCase() || (p.etapas.length ? "PROGRAMADO" : "");
    p.etapa = etps.join(" · ").toUpperCase();
    // resumo por item: fim programado do item = maior fim das etapas dele
    p.resumo = p.itens.map((i) => {
      const fims = p.etapas.filter((e) => e.itemCode && e.itemCode === i.itemCode && e.fim).map((e) => e.fim).sort();
      return { itemCode: i.itemCode, produto: i.produto, qtd: i.quantidade, situacao: i.situacao, etapa: i.etapaAtual, entrega: i.entrega, fimProgramado: fims[fims.length - 1] || null };
    });
    // entrega do pedido = a do último item a ficar pronto (fim programado do item; sem programação, o prazo de entrega dele)
    const datas = p.resumo.map((r) => r.fimProgramado || r.entrega).filter(Boolean);
    if (!p.resumo.length && p.fimProgramado) datas.push(p.fimProgramado);
    p.entregaPrevista = datas.sort().pop() || p.fimProgramado || p.prazo || null;
  }
  return g;
}

// ---------- sincronização ----------
let rodando = null;
export async function sincronizar({ forcar = false } = {}) {
  const st = await statusSync();
  if (!st.temToken) return { ok: false, erro: "Token do Cronograma não configurado.", ...st };
  if (!forcar && st.em && Date.now() - new Date(st.em).getTime() < INTERVALO_MS && !st.erro) return { ok: true, pulado: true, ...st };
  if (rodando) return rodando;
  rodando = (async () => {
    const res = { em: new Date().toISOString(), erro: null, itens: 0, etapas: 0, pedidosCrono: 0, casados: 0, semPedidoAqui: 0 };
    try {
      const jp = await get("/api/ext/pedidos");
      let je = []; try { je = await get("/api/ext/etapas"); } catch (e) { res.avisoEtapas = e.message; }
      const itens = listaDe(jp).map(normalizarItem), etapas = listaDe(je).map(normalizarEtapa);
      res.itens = itens.length; res.etapas = etapas.length; res.rev = jp?.rev ?? null;
      const g = agruparPorPedido(itens, etapas);
      res.pedidosCrono = Object.keys(g).length;
      const aqui = await prisma.pedidoVenda.findMany({ select: { id: true, numero: true } });
      for (const p of aqui) {
        const c = g[soDig(p.numero)];
        if (!c) { await prisma.pedidoVenda.update({ where: { id: p.id }, data: { cronoSituacao: "NÃO ESTÁ NO CRONOGRAMA", cronoEtapa: null, cronoEm: new Date(res.em), entregaPrevista: null, cronoItens: [] } }); continue; }
        res.casados++;
        await prisma.pedidoVenda.update({ where: { id: p.id }, data: {
          entregaPrevista: c.entregaPrevista ? new Date(`${c.entregaPrevista}T00:00:00Z`) : null,
          cronoPrazo: c.prazo ? new Date(`${c.prazo}T00:00:00Z`) : null,
          cronoFimProgramado: c.fimProgramado ? new Date(`${c.fimProgramado}T00:00:00Z`) : null,
          cronoSituacao: c.situacao || null, cronoEtapa: c.etapa || null, cronoConcluido: c.concluido, cronoEm: new Date(res.em), cronoItens: c.resumo,
        } });
      }
      const nums = new Set(aqui.map((p) => soDig(p.numero)));
      res.semPedidoAqui = Object.keys(g).filter((n) => !nums.has(n)).length;
    } catch (e) { res.erro = e.message; }
    await prisma.finConfig.upsert({ where: { chave: K_SYNC }, create: { chave: K_SYNC, valor: JSON.stringify(res) }, update: { valor: JSON.stringify(res) } });
    return { ok: !res.erro, ...(await statusSync()) };
  })();
  try { return await rodando; } finally { rodando = null; }
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
