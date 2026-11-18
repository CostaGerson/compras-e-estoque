// v910 — o ERP LÊ o sistema da loja NORT (Gerson): encomendas conferidas e saldo de estoque por depósito.
//   Configuração em Dados › Integrações › NORT (endereço base + token do sistema dele, cabeçalho X-Api-Key).
//   · Pedidos: GET {url}/api/erp/pedidos?desde=ISO → { pedidos: [{ ref, cliente, contato?, emissao?, entrega, obs?,
//       itens: [{ seq, nome, sku?, descricao?, grade: [{ tam, qtd }], personalizacao?, artes?: [{ nome, url }] }] }] }
//     a cada 1 min (v947); cada ref entra uma vez (pedido interno NORT; aguarda FPP se faltar). Artes viram anexo LAYOUT e o item
//     vai com "dispensa layout"; a aprovação de layout fica com o usuário NORT do ERP.
//   · Estoque: GET {url}/api/erp/estoque → { itens: [{ nome, sku?, depositos: { "<nome do depósito>": saldo } }] }
//     a cada 1 h; Loja → LOJA, Reserva Fábrica → SEDE, Mercado Livre → ML. O ERP se alinha ao saldo lido.
import { prisma } from "@/lib/prisma";
import { criarPedidoNort, conferirSaldos, depositoDe } from "@/lib/nortInteg";

export const K_CFG = "NORT|LEITURA", K_ST = "NORT|LEITURA_STATUS";
const H = 3600e3;
async function json(chave) { try { return JSON.parse((await prisma.finConfig.findUnique({ where: { chave } }))?.valor || "{}"); } catch { return {}; } }
async function gravar(chave, v) { const valor = JSON.stringify(v); await prisma.finConfig.upsert({ where: { chave }, create: { chave, valor }, update: { valor } }); }
export const configLeitura = () => json(K_CFG);
export const statusLeitura = () => json(K_ST);
export async function salvarConfig({ url, token }) {
  const atual = await configLeitura();
  const u = String(url || "").trim().replace(/\/+$/, "") || atual.url || "";   // v914 — endereço em branco mantém o salvo
  if (u && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(u)) throw new Error("Endereço inválido: use https://dominio-do-sistema");
  await gravar(K_CFG, { url: u, token: String(token || "").trim() || atual.token || "" });
}

async function getNort(cfg, caminho) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(`${cfg.url}${caminho}`, { headers: { "X-Api-Key": cfg.token, Accept: "application/json" }, signal: ac.signal, cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error || `O sistema da NORT respondeu ${r.status}.`);
    return j || {};
  } finally { clearTimeout(t); }
}
// arte: só baixa do próprio sistema da NORT (mesmo domínio configurado) — não segue endereço de terceiros
async function baixarArte(cfg, url) {
  let u; try { u = new URL(url, cfg.url); } catch { return null; }
  if (u.origin !== new URL(cfg.url).origin) return null;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await fetch(u, { headers: { "X-Api-Key": cfg.token }, signal: ac.signal });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 40 * 1048576) return null;
    return { mime: r.headers.get("content-type") || null, buf };
  } catch { return null; } finally { clearTimeout(t); }
}

async function usuarioNort() {
  const us = await prisma.usuario.findMany({ where: { ativo: true, setor: "NORT" }, select: { nome: true, sobrenome: true }, orderBy: { id: "asc" } }).catch(() => []);
  const u = us[0];
  return u ? [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() : "LOJA NORT";
}

export async function lerPedidos() {
  const cfg = await configLeitura(), st = await statusLeitura();
  if (!cfg.url || !cfg.token) return { ok: false, erro: "Leitura da NORT não configurada." };
  const desde = st.pedidos?.desde ? new Date(new Date(st.pedidos.desde).getTime() - H).toISOString() : "";
  const inicio = new Date().toISOString();
  const res = { em: inicio, ok: true, erro: null, lidos: 0, novos: 0, aguardandoFpp: 0, erros: [], desde: st.pedidos?.desde || null };
  try {
    const j = await getNort(cfg, `/api/erp/pedidos${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`);
    const l = Array.isArray(j.pedidos) ? j.pedidos : [];
    res.lidos = l.length;
    const vendedor = await usuarioNort();
    for (const p of l) {
      const ref = String(p?.ref || "").trim();
      if (!ref) continue;
      if (await prisma.pp.findUnique({ where: { extRef: `NORT|${ref}` }, select: { id: true } })) continue;   // já trazido
      const itens = (Array.isArray(p.itens) ? p.itens : []).map((it) => ({ ...it, dispensaDesign: (Array.isArray(it.artes) && it.artes.length > 0) || !(Array.isArray(it.personalizacao) && it.personalizacao.length) }));   // v950 — peça lisa (sem personalização) não pede layout
      const r = await criarPedidoNort({ ...p, vendedor, itens }, "LEITURA NORT");
      if (!r.ok) { res.erros.push(`${ref}: ${r.error}`); continue; }
      res.novos++; if (r.status === "AGUARDANDO_FPP") res.aguardandoFpp++;
      const pp = await prisma.pp.findUnique({ where: { extRef: `NORT|${ref}` }, select: { id: true } });
      for (const [k, it] of itens.entries()) for (const a of Array.isArray(it.artes) ? it.artes : []) {
        const arq = a?.url ? await baixarArte(cfg, a.url) : null;
        if (!arq) { res.erros.push(`${ref}: arte "${a?.nome || a?.url}" não baixou`); continue; }
        await prisma.ppAnexo.create({ data: { ppId: pp.id, nome: `Item ${it.seq || k + 1} · ${String(a.nome || "arte").slice(0, 150)}`, tipo: arq.mime, categoria: "LAYOUT",
          tamanho: arq.buf.length, base64: arq.buf.toString("base64"), criadoPorNome: "NORT" } }).catch((e) => res.erros.push(`${ref}: ${e.message}`));
      }
    }
    res.desde = inicio;
  } catch (e) { res.ok = false; res.erro = e.name === "AbortError" ? "O sistema da NORT não respondeu (20 s)." : e.message; }
  await gravar(K_ST, { ...(await statusLeitura()), pedidos: res });
  return res;
}

export async function lerEstoque() {
  const cfg = await configLeitura();
  if (!cfg.url || !cfg.token) return { ok: false, erro: "Leitura da NORT não configurada." };
  const res = { em: new Date().toISOString(), ok: true, erro: null, itens: 0, ajustados: 0, ignorados: [] };
  try {
    const j = await getNort(cfg, "/api/erp/estoque");
    const saldos = [];
    const ign = new Set();
    for (const it of Array.isArray(j.itens) ? j.itens : []) {
      if (!it?.nome) continue;
      res.itens++;
      for (const [dep, saldo] of Object.entries(it.depositos || {})) {
        const d = depositoDe(dep);
        if (!d) { ign.add(dep); continue; }
        saldos.push({ nome: it.nome, sku: it.sku, deposito: d, saldo: Number(saldo) || 0 });
      }
    }
    // mesmo depósito do ERP vindo de dois depósitos de lá: soma
    const soma = new Map();
    for (const s of saldos) { const k = `${s.nome}|${s.deposito}`; const x = soma.get(k); if (x) x.saldo += s.saldo; else soma.set(k, { ...s }); }
    const r = await conferirSaldos([...soma.values()]);
    res.ajustados = r.ajustados.length; res.ignorados = [...ign];
    if (r.erros.length) res.erros = r.erros.slice(0, 20);
  } catch (e) { res.ok = false; res.erro = e.name === "AbortError" ? "O sistema da NORT não respondeu (20 s)." : e.message; }
  await gravar(K_ST, { ...(await statusLeitura()), estoque: res });
  return res;
}

// v947 — pedidos e estoque a cada 1 min (só se a leitura estiver configurada); um ciclo não começa antes do anterior terminar
export function agendarLeituraNort() {
  if (globalThis.__leituraNort) return; globalThis.__leituraNort = true;
  let rodando = false;
  const ciclo = async () => {
    if (rodando) return; rodando = true;
    try {
      const cfg = await configLeitura(); if (!cfg.url || !cfg.token) return;
      await lerPedidos();
      await lerEstoque();
    } catch (e) { console.error("[leitura NORT]", e.message); }
    finally { rodando = false; }
  };
  setTimeout(ciclo, 60 * 1000);
  setInterval(ciclo, 60 * 1000);
}
