// v1085 — DTF e sublimação de qualquer canal (Meridian, NORT, loja física, portal) → sistema de produção do Gerson.
//   · Demanda = item de pedido efetivado com DTF ou sublimação (aplicações do item, texto de personalização ou a FPP), uma por método.
//   · O sistema do Gerson LÊ: GET /api/ext/personalizacao?desde=ISO (X-Api-Key = token da NORT) e baixa as artes.
//   · E DEVOLVE o status: POST /api/ext/personalizacao/status { id | chave, status, refExterna?, obs?, em?, por? }.
//   · O PCP do Maycon vê o status em cada item de GET /api/ext/compras (campo personalizacao), sem mudar nada lá.
//   Ver claude/integracao-dtf-sublimacao.md.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const METODOS = ["DTF", "SUBLIMACAO"];
export const STATUS = ["NOVA", "RECEBIDA", "EM_PRODUCAO", "PRONTA", "ENTREGUE", "PROBLEMA", "CANCELADA"];
const STATUS_EXT = ["RECEBIDA", "EM_PRODUCAO", "PRONTA", "ENTREGUE", "PROBLEMA"];   // o que o sistema do Gerson pode mandar
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const metodoDe = (s) => { const n = norm(s); return /\bDTF\b/.test(n) ? "DTF" : /SUBLIMA/.test(n) ? "SUBLIMACAO" : null; };
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const js = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const BASE = () => String(process.env.APP_URL || "https://erp.meridianpro.com.br").replace(/\/+$/, "");

function canalDe(pp) {
  if (pp.canalVenda === "LOJA") return "LOJA";
  if (pp.canalVenda === "NORT" || String(pp.extRef || "").startsWith("NORT|")) return "NORT";
  if (pp.portalClienteId) return "PORTAL";
  return "MERIDIAN";
}
// métodos do item: aplicações > texto de personalização > FPP
function metodosDoItem(it, fpp) {
  const ap = Array.isArray(it.aplicacoes) ? it.aplicacoes : [];
  const m = new Map();
  for (const a of ap) { const k = metodoDe(a.metodo); if (k) (m.get(k) || m.set(k, []).get(k)).push(a); }
  if (!m.size) {
    const par = js(it.parametrosJson, {});
    const txt = Object.entries(par).filter(([k]) => /PERSONALIZ|ESTAMPA|SUBLIMA|DTF/.test(norm(k))).map(([, v]) => (typeof v === "string" ? v : "")).join(" ");
    if (/\bDTF\b/.test(norm(txt))) m.set("DTF", []);
    if (/SUBLIMA/.test(norm(txt))) m.set("SUBLIMACAO", []);
  }
  if (!m.size && fpp) for (const p of Array.isArray(fpp.entradas?.personalizacoes) ? fpp.entradas.personalizacoes : []) {
    const k = metodoDe(p.metodo); if (k && !m.has(k)) m.set(k, [{ metodo: k, local: p.local || null, largura: p.largura ?? null, altura: p.altura ?? null, obs: p.obs || null, fpp: true }]);
  }
  return m;
}

// gera / atualiza as demandas de um pedido (chamado ao efetivar e na leitura)
export async function sincronizarPedido(ppId) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" } }, anexos: { select: { id: true, nome: true, tipo: true, categoria: true, tamanho: true } } } });
  if (!pp || !pp.numero || !pp.efetivadoEm) return { n: 0 };
  const pv = await prisma.pedidoVenda.findUnique({ where: { numero: pp.numero }, select: { status: true, despacho: true, entregaPrevista: true } }).catch(() => null);
  const cancelado = pp.status === "EXCLUIDO" || pv?.status === "CANCELADO";
  const fppIds = [...new Set(pp.itens.map((i) => i.fppId).filter(Boolean))];
  const fpps = fppIds.length ? await prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, numero: true, entradas: true } }) : [];
  const F = Object.fromEntries(fpps.map((f) => [f.id, f]));
  const canal = canalDe(pp), cf = pp.clienteFinal && typeof pp.clienteFinal === "object" ? pp.clienteFinal : null;
  const vistas = new Set();
  let n = 0;
  for (const [k, it] of pp.itens.entries()) {
    const mets = metodosDoItem(it, it.fppId ? F[it.fppId] : null);
    for (const [metodo, aps] of mets) {
      const chave = `${pp.numero}|${k + 1}|${metodo}`;
      vistas.add(chave);
      const par = js(it.parametrosJson, {});
      const dados = {
        pedido: pp.numero, emissao: pp.emissao || null, entrega: iso(pv?.entregaPrevista || pv?.despacho) || (pp.dtDespacho ? pp.dtDespacho.split("/").reverse().join("-") : null),
        cliente: pp.clienteNome || null, clienteFinal: cf ? { nome: String((cf.tipo === "PJ" ? cf.razaoSocial : cf.nome) || "").toUpperCase() || null, telefone: cf.whatsapp || cf.telefone || null } : null,
        vendedor: pp.vendedor || null, obsPedido: pp.obs || null,
        item: { seq: k + 1, descricao: it.descricao, codigo: it.codigo || null, tipoPeca: it.tipoPecaNome || null, fppNumero: it.fppNumero || null, quantidade: Number(it.quantidade) || 0,
          grade: js(it.gradeJson, []).filter((g) => Number(g.qtd) > 0).map((g) => ({ tam: g.tam, qtd: Number(g.qtd) })), parametros: par },
        aplicacoes: aps.map((a) => ({ local: a.local || null, larguraCm: a.largura ?? null, alturaCm: a.altura ?? null, cores: a.cores ?? null, obs: a.obs || null })),
        personalizacaoTexto: par["PERSONALIZAÇÃO"] || par.PERSONALIZACAO || null,
        dadosUnitarios: it.dadosUnitarios && Array.isArray(it.dadosUnitarios.linhas) ? { campos: it.dadosUnitarios.campos || [], linhas: it.dadosUnitarios.linhas } : null,
        artes: [
          ...(Array.isArray(it.anexosJson) ? it.anexosJson : []).map((a, i) => ({ id: `I${it.id}.${i}`, nome: a.nome || `arquivo ${i + 1}`, mime: a.mime || null })),
          ...(it.fotoBase64 ? [{ id: `F${it.id}`, nome: `layout item ${k + 1}`, mime: null }] : []),
          ...pp.anexos.filter((a) => ["LAYOUT", "ARTE", "OUTRO"].includes(a.categoria || "OUTRO") && a.categoria !== "NF_CLIENTE").map((a) => ({ id: `P${a.id}`, nome: a.nome, mime: a.tipo || null, tamanho: a.tamanho || null, doPedido: true })),
        ],
      };
      const assinatura = crypto.createHash("sha1").update(JSON.stringify(dados)).digest("hex");
      const ja = await prisma.personalizacaoDemanda.findUnique({ where: { chave } });
      if (!ja) { await prisma.personalizacaoDemanda.create({ data: { chave, pedidoNumero: pp.numero, ppId: pp.id, ppItemId: it.id, itemSeq: k + 1, metodo, canal, dados, assinatura, status: cancelado ? "CANCELADA" : "NOVA" } }); n++; continue; }
      const mudou = ja.assinatura !== assinatura;
      const virouCancelada = cancelado && !["CANCELADA", "ENTREGUE"].includes(ja.status);
      if (mudou || virouCancelada || ja.ppItemId !== it.id) await prisma.personalizacaoDemanda.update({ where: { id: ja.id }, data: { dados, assinatura, ppItemId: it.id, canal,
        ...(mudou ? { versao: ja.versao + 1 } : {}), ...(virouCancelada ? { status: "CANCELADA", statusEm: new Date(), statusObs: "PEDIDO CANCELADO NO ERP", statusPor: "ERP" } : {}),
        historico: [...(Array.isArray(ja.historico) ? ja.historico : []), { em: new Date().toISOString(), por: "ERP", txt: virouCancelada ? "pedido cancelado" : "pedido alterado (nova versão)" }].slice(-50) } });
    }
  }
  // item que deixou de ter DTF/sublimação (ou saiu do pedido): cancela
  const sobras = await prisma.personalizacaoDemanda.findMany({ where: { ppId: pp.id, status: { notIn: ["CANCELADA", "ENTREGUE"] } } });
  for (const d of sobras.filter((x) => !vistas.has(x.chave))) await prisma.personalizacaoDemanda.update({ where: { id: d.id }, data: { status: "CANCELADA", statusEm: new Date(), statusObs: "ITEM SEM DTF/SUBLIMAÇÃO OU FORA DO PEDIDO", statusPor: "ERP" } });
  return { n };
}

// varre os pedidos efetivados/alterados recentemente (leitura do sistema do Gerson)
export async function sincronizarRecentes({ dias = 120 } = {}) {
  const k = "PERSO|SYNC";
  const ult = await prisma.finConfig.findUnique({ where: { chave: k } }).catch(() => null);
  const desde = ult?.valor ? new Date(Number(ult.valor) - 10 * 60e3) : new Date(Date.now() - dias * 864e5);
  const pps = await prisma.pp.findMany({ where: { numero: { not: null }, efetivadoEm: { not: null }, updatedAt: { gte: desde } }, select: { id: true } });
  const pvs = await prisma.pedidoVenda.findMany({ where: { updatedAt: { gte: desde } }, select: { numero: true } }).catch(() => []);
  const extra = pvs.length ? await prisma.pp.findMany({ where: { numero: { in: pvs.map((p) => p.numero) }, efetivadoEm: { not: null } }, select: { id: true } }) : [];
  const ids = [...new Set([...pps, ...extra].map((p) => p.id))];
  for (const id of ids) await sincronizarPedido(id).catch((e) => console.log("perso/sync:", id, e.message));
  await prisma.finConfig.upsert({ where: { chave: k }, create: { chave: k, valor: String(Date.now()) }, update: { valor: String(Date.now()) } }).catch(() => null);
  return { pedidos: ids.length };
}

const saida = (d) => ({
  id: d.id, chave: d.chave, pedido: d.pedidoNumero, itemSeq: d.itemSeq, metodo: d.metodo, canal: d.canal, versao: d.versao,
  status: d.status, statusEm: d.statusEm, statusObs: d.statusObs, refExterna: d.refExterna, criadaEm: d.createdAt, atualizadaEm: d.updatedAt,
  ...d.dados,
  artes: (d.dados?.artes || []).map((a) => ({ ...a, url: `${BASE()}/api/ext/personalizacao/arquivo?demanda=${d.id}&arte=${encodeURIComponent(a.id)}` })),
  urlPedido: `${BASE()}/?v=pedido&numero=${d.pedidoNumero}`,
});
export async function listarDemandas({ desde, status, pedido, metodo } = {}) {
  const dt = desde ? new Date(desde) : null;
  const where = {
    ...(dt && !isNaN(dt) ? { updatedAt: { gte: dt } } : {}),
    ...(status ? { status: { in: String(status).toUpperCase().split(",") } } : !dt ? { status: { notIn: ["ENTREGUE", "CANCELADA"] } } : {}),
    ...(pedido ? { pedidoNumero: String(pedido) } : {}), ...(metodo ? { metodo: String(metodo).toUpperCase() } : {}),
  };
  const l = await prisma.personalizacaoDemanda.findMany({ where, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 500 });
  return l.map(saida);
}
// arquivo de uma arte da demanda: I<itemId>.<k> (arquivo do item) · F<itemId> (layout/foto do item) · P<anexoId> (anexo do pedido)
export async function arteDaDemanda(demandaId, arteId) {
  const d = await prisma.personalizacaoDemanda.findUnique({ where: { id: Number(demandaId) || 0 } });
  if (!d) return null;
  const a = String(arteId || "");
  if (!(d.dados?.artes || []).some((x) => x.id === a)) return null;
  if (a.startsWith("P")) { const x = await prisma.ppAnexo.findFirst({ where: { id: Number(a.slice(1)) || 0, ppId: d.ppId } }); return x ? { base64: x.base64, nome: x.nome, mime: x.tipo } : null; }
  const m = a.match(/^([IF])(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const it = await prisma.ppItem.findFirst({ where: { id: Number(m[2]), ppId: d.ppId }, select: { anexosJson: true, fotoBase64: true } });
  if (!it) return null;
  if (m[1] === "F") return it.fotoBase64 ? { base64: it.fotoBase64, nome: `layout-${d.pedidoNumero}-${d.itemSeq}`, mime: null } : null;
  const x = (Array.isArray(it.anexosJson) ? it.anexosJson : [])[Number(m[3]) || 0];
  return x?.base64 ? { base64: x.base64, nome: x.nome || "arquivo", mime: x.mime || null } : null;
}
// devolutiva do sistema do Gerson: { id | chave, status, refExterna?, obs?, em?, por? }
export async function atualizarStatus(b) {
  const d = b.id ? await prisma.personalizacaoDemanda.findUnique({ where: { id: Number(b.id) || 0 } }) : await prisma.personalizacaoDemanda.findUnique({ where: { chave: String(b.chave || "") } });
  if (!d) return { ok: false, error: "Demanda não encontrada (id ou chave)." };
  const st = String(b.status || "").toUpperCase();
  if (!STATUS_EXT.includes(st)) return { ok: false, error: `Status inválido. Use: ${STATUS_EXT.join(", ")}.` };
  if (d.status === "CANCELADA") return { ok: false, error: "Demanda cancelada no ERP (pedido cancelado ou item alterado).", demanda: saida(d) };
  const em = b.em && !isNaN(new Date(b.em)) ? new Date(b.em) : new Date();
  const obs = b.obs ? String(b.obs).slice(0, 500) : null;
  const n = await prisma.personalizacaoDemanda.update({ where: { id: d.id }, data: { status: st, statusEm: em, statusObs: obs, statusPor: b.por ? String(b.por).slice(0, 80) : "SISTEMA NORT",
    ...(b.refExterna ? { refExterna: String(b.refExterna).slice(0, 80) } : {}),
    historico: [...(Array.isArray(d.historico) ? d.historico : []), { em: em.toISOString(), por: b.por || "SISTEMA NORT", txt: `${st}${obs ? ` · ${obs}` : ""}` }].slice(-50) } });
  if (st === "PROBLEMA") {   // avisa a gestão e o PCP
    const us = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { setor: "PCP" }] }, select: { id: true } }).catch(() => []);
    if (us.length) await prisma.mensagem.createMany({ data: us.map((u) => ({ deId: u.id, paraId: u.id, texto: `⚠️ ${d.metodo === "DTF" ? "DTF" : "SUBLIMAÇÃO"} — PEDIDO ${d.pedidoNumero} ITEM ${d.itemSeq}: o sistema da NORT marcou PROBLEMA${obs ? `: ${obs}` : ""}.`.slice(0, 2000) })) }).catch(() => null);
  }
  return { ok: true, demanda: saida(n) };
}
// para o PCP: status por pedido e item
export async function statusParaPcp(numeros) {
  if (!numeros.length) return {};
  const l = await prisma.personalizacaoDemanda.findMany({ where: { pedidoNumero: { in: numeros } }, select: { pedidoNumero: true, itemSeq: true, metodo: true, status: true, statusEm: true, statusObs: true } });
  const out = {};
  for (const d of l) (out[`${d.pedidoNumero}|${d.itemSeq}`] ||= []).push({ metodo: d.metodo, etapa: d.metodo === "DTF" ? "DTF" : "SUBLIMAÇÃO", sistema: "NORT", status: d.status, statusEm: d.statusEm, obs: d.statusObs || null });
  return out;
}
