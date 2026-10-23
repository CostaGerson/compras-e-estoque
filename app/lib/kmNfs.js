// v408 — NFs de saída emitidas no KM (livsaida) × arquivos (XML/PDF) no sistema.
// · o agente manda as NFs de cada pedido (pedidos[].nfs) e, a partir da v408, todas as NFs dos últimos 60 dias (nfs + nfsDesde)
// · cada NF fica em KmNfSaida; enquanto não houver FiscalNota de SAÍDA com XML ou PDF (mesmo nº e CNPJ), vira crítica
//   no Movimento fiscal e, a partir do dia seguinte à emissão, uma mensagem (uma vez por NF) para master + financeiro + administrativo
// · some sozinha quando os arquivos sobem (movimento fiscal ou ZIP da contabilidade); NF cancelada no KM sai; dá para vistar
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const semZ = (n) => String(n ?? "").trim().replace(/^0+(?=\d)/, "");
const so = (s) => String(s || "").replace(/\D/g, "");
const isoD = (s) => { const t = String(s || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const up = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase() || null;
export const chaveKm = (numero, emissao) => `${semZ(numero)}|${isoD(emissao) || ""}`;
export const CRITICA_KM = "NF emitida no KM sem XML/PDF no sistema — importe os arquivos";
const JANELA = 60;   // dias

// junta as NFs do envio (topo + por pedido), sem repetir
export function nfsDoEnvio(pedidos, nfsTopo) {
  const m = new Map();
  const add = (x, ped) => {
    const numero = semZ(x?.numero); if (!numero) return;
    const emissao = isoD(x.emissao);
    const k = chaveKm(numero, emissao);
    const o = m.get(k) || {};
    m.set(k, { chave: k, numero, emissao, valor: r2(x.valor ?? o.valor), pedido: semZ(x.pedido || ped?.numero) || o.pedido || null,
      cliente: up(x.cliente || ped?.cliente) || o.cliente || null, cnpj: so(x.cnpj || ped?.cnpj) || o.cnpj || null });
  };
  for (const p of Array.isArray(pedidos) ? pedidos : []) for (const x of Array.isArray(p?.nfs) ? p.nfs : []) add(x, p);
  for (const x of Array.isArray(nfsTopo) ? nfsTopo : []) add(x, null);
  return [...m.values()];
}

async function gravarNfs(lista, { reativar = true } = {}) {
  if (!lista.length) return 0;
  const ex = Object.fromEntries((await prisma.kmNfSaida.findMany({ where: { chave: { in: lista.map((x) => x.chave) } } })).map((x) => [x.chave, x]));
  const novas = lista.filter((x) => !ex[x.chave]);
  if (novas.length) await prisma.kmNfSaida.createMany({ data: novas.map((x) => ({ ...x, emissao: x.emissao ? dUTC(x.emissao) : null })), skipDuplicates: true });
  for (const x of lista) {
    const e = ex[x.chave]; if (!e) continue;
    const data = {};
    if (r2(e.valor) !== x.valor && x.valor > 0) data.valor = x.valor;
    if (x.pedido && e.pedido !== x.pedido) data.pedido = x.pedido;
    if (x.cliente && e.cliente !== x.cliente) data.cliente = x.cliente;
    if (x.cnpj && e.cnpj !== x.cnpj) data.cnpj = x.cnpj;
    if (e.canceladaEm && reativar) data.canceladaEm = null;   // voltou no envio do KM
    if (Object.keys(data).length) await prisma.kmNfSaida.update({ where: { id: e.id }, data });
  }
  return novas.length;
}

// pendentes que já têm XML/PDF no sistema (FiscalNota de saída, mesmo nº; CNPJ igual quando os dois têm) → resolvidas
export async function conciliarKmNfs() {
  const pend = await prisma.kmNfSaida.findMany({ where: { arquivoEm: null, canceladaEm: null, vistoEm: null } });
  if (!pend.length) return [];
  const fn = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", numero: { in: [...new Set(pend.map((p) => p.numero))] }, OR: [{ temXml: true }, { temPdf: true }] },
    select: { numero: true, documento: true } });
  const resta = [];
  for (const p of pend) {
    const ok = fn.some((f) => f.numero === p.numero && (!p.cnpj || !f.documento || so(f.documento) === p.cnpj));
    if (ok) await prisma.kmNfSaida.update({ where: { id: p.id }, data: { arquivoEm: new Date() } });
    else resta.push(p);
  }
  return resta;
}

async function avisar(pend) {
  const hoje = hojeBR();
  const l = pend.filter((p) => !p.avisadoEm && p.emissao && p.emissao.toISOString().slice(0, 10) < hoje)
    .sort((a, b) => String(a.emissao).localeCompare(String(b.emissao)));
  if (!l.length) return 0;
  const destinos = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { setor: { in: ["FINANCEIRO", "ADMINISTRATIVO"] } }] }, select: { id: true, isMaster: true } });
  if (destinos.length) {
    const de = (destinos.find((u) => u.isMaster) || destinos[0]).id;
    const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const linhas = l.slice(0, 40).map((p) => `• NF ${p.numero} · ${p.cliente || "SEM CLIENTE"} · R$ ${brl(p.valor)} · emissão ${p.emissao.toISOString().slice(0, 10).split("-").reverse().join("/")}${p.pedido ? ` · pedido ${p.pedido}` : ""}`);
    const texto = `📄 ${l.length} NF(s) emitida(s) no KM sem XML/PDF no sistema:\n${linhas.join("\n")}${l.length > 40 ? `\n… e mais ${l.length - 40}` : ""}\nImporte os arquivos em ADM › Movimento fiscal (a crítica some sozinha).`;
    await prisma.mensagem.createMany({ data: destinos.map((u) => ({ deId: de, paraId: u.id, texto: texto.slice(0, 2000) })) });
  }
  await prisma.kmNfSaida.updateMany({ where: { id: { in: l.map((p) => p.id) } }, data: { avisadoEm: new Date() } });
  return l.length;
}

// chamado a cada sincronização do agente
export async function processarNfsKm(pedidos, { nfs, nfsDesde } = {}) {
  const lista = nfsDoEnvio(pedidos, nfs);
  // NFs já guardadas nos pedidos (kmNfs) dos últimos 60 dias — pega o que não veio neste envio
  const desde = new Date(Date.now() - JANELA * 86400e3).toISOString().slice(0, 10);
  const peds = await prisma.pedidoVenda.findMany({ where: { NOT: { kmNfs: { equals: null } }, updatedAt: { gte: dUTC(desde) } }, select: { numero: true, cliente: true, cnpj: true, kmNfs: true } }).catch(() => []);
  const daBase = nfsDoEnvio(peds.map((p) => ({ numero: p.numero, cliente: p.cliente, cnpj: p.cnpj, nfs: (Array.isArray(p.kmNfs) ? p.kmNfs : []).filter((x) => !x.emissao || String(x.emissao) >= desde) })), []);
  const chaves = new Set(lista.map((x) => x.chave));
  const novas = (await gravarNfs(lista)) + (await gravarNfs(daBase.filter((x) => !chaves.has(x.chave)), { reativar: false }));
  // lista completa do KM (agente v408): NF da janela que sumiu foi cancelada
  let canceladas = 0;
  const ini = isoD(nfsDesde);
  if (Array.isArray(nfs) && ini) {
    const doTopo = new Set(nfsDoEnvio([], nfs).map((x) => x.chave));
    const sumiram = await prisma.kmNfSaida.findMany({ where: { canceladaEm: null, arquivoEm: null, emissao: { gte: dUTC(ini) } }, select: { id: true, chave: true } });
    const ids = sumiram.filter((x) => !doTopo.has(x.chave)).map((x) => x.id);
    if (ids.length) canceladas = (await prisma.kmNfSaida.updateMany({ where: { id: { in: ids } }, data: { canceladaEm: new Date() } })).count;
  }
  const pend = await conciliarKmNfs();
  const avisadas = await avisar(pend);
  return { nfsKmNovas: novas, nfsSemArquivo: pend.length, nfsAvisadas: avisadas, nfsCanceladas: canceladas };
}

// linhas de crítica para o Movimento fiscal
export async function pendentesMovimento({ de, ate, busca } = {}) {
  const pend = await conciliarKmNfs();
  const b = String(busca || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  return pend
    .map((p) => ({
      id: `KM${p.id}`, kmId: p.id, km: true, tipo: "SAIDA", empresa: "MERIDIAN", modelo: "NF", chave: null, numero: p.numero, serie: null,
      emissao: p.emissao ? p.emissao.toISOString().slice(0, 10) : null, parceiro: p.cliente || "SEM CLIENTE", documento: p.cnpj, natureza: p.pedido ? `PEDIDO ${p.pedido}` : null,
      valor: Number(p.valor), acao: "KM", motivo: null, temXml: false, temPdf: false, parcelas: [], origem: "KM", pedido: p.pedido, critica: CRITICA_KM,
    }))
    .filter((n) => (!de || !n.emissao || n.emissao >= de) && (!ate || !n.emissao || n.emissao <= ate))
    .filter((n) => !b || `${n.numero} ${n.parceiro} ${n.documento || ""} ${n.natureza || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes(b) || n.valor.toFixed(2).includes(b.replace(",", ".")));
}

// vistar: tira a crítica sem arquivo (fica registrado quem e quando)
export async function vistarKm(id, quem) {
  const n = await prisma.kmNfSaida.findUnique({ where: { id: Number(String(id).replace(/^KM/, "")) } });
  if (!n) return { error: "NF do KM não encontrada." };
  await prisma.kmNfSaida.update({ where: { id: n.id }, data: { vistoEm: new Date(), vistoPor: String(quem || "").slice(0, 120) || null } });
  return { ok: true };
}
