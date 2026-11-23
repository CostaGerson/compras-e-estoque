// v917 — sugestão #89: item do pedido no padrão "CLIENTE - PRODUTO" (ex.: GRABER - JAQUETA TÁTICA)
// O prefixo é o que já se usou nos pedidos anteriores do mesmo cliente (CNPJ); senão o nome fantasia; senão o nome sem LTDA/ME/S.A.
import { prisma } from "./prisma";
const so = (s) => String(s || "").replace(/\D/g, "");
const up = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const semAc = (s) => up(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const LIXO = /\b(LTDA|EIRELI|ME|EPP|S\/?A|SA|S\.A\.?|LIMITADA|COMERCIO|COMERCIAL|SERVICOS|SERVICO|INDUSTRIA|INDUSTRIAL|E|DE|DA|DO|DOS|DAS)\b\.?/g;
export function prefixoDoNome(nome) {
  const n = semAc(nome).replace(LIXO, " ").replace(/[^A-Z0-9& ]/g, " ").replace(/\s+/g, " ").trim();
  return n.split(" ").slice(0, 2).join(" ") || up(nome);
}
export const temPrefixo = (desc) => /^\s*[^-]{2,40}\s-\s\S/.test(String(desc || ""));
export async function prefixoCliente(cnpj, nome, db = prisma) {
  const c = so(cnpj);
  if (c) {
    const peds = await db.pedidoVenda.findMany({ where: { cnpj: c }, select: { itens: true }, orderBy: { emissao: "desc" }, take: 30 }).catch(() => []);
    const conta = {};
    for (const p of peds) for (const it of Array.isArray(p.itens) ? p.itens : []) {
      const m = String(it?.descricao || "").match(/^\s*([^-]{2,40}?)\s-\s\S/);
      if (m) { const k = up(m[1]); conta[k] = (conta[k] || 0) + 1; }
    }
    const melhor = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
    if (melhor) return melhor[0];
    const cli = await db.cliente.findFirst({ where: { cnpj: c }, select: { nomeFantasia: true } }).catch(() => null);
    if (cli?.nomeFantasia && up(cli.nomeFantasia)) return prefixoDoNome(cli.nomeFantasia);
  }
  return nome ? prefixoDoNome(nome) : null;
}
export function comPrefixo(desc, prefixo) {
  const d = up(desc);
  if (!d || !prefixo || temPrefixo(d) || semAc(d).startsWith(semAc(prefixo))) return d;
  return `${prefixo} - ${d}`;
}

// v1042 — sugestão #91: pedidos efetivados antes da v917 ficaram só com o nome do produto. Corrige uma vez
// (marca em FinConfig) os itens dos pedidos do sistema em andamento: PpItem.descricao e PedidoVenda.itens[].descricao.
const MARCA_91 = "PEDIDO|PREFIXO_CLIENTE_V1042";
export async function corrigirPrefixosAntigos({ forcar = false } = {}) {
  if (!forcar && await prisma.finConfig.findUnique({ where: { chave: MARCA_91 } }).catch(() => null)) return null;
  const pps = await prisma.pp.findMany({
    where: { numero: { not: null }, efetivadoEm: { not: null }, portalClienteId: null },   // serviço e NORT saem no laço (NOT do Prisma descartaria os nulos)
    select: { id: true, numero: true, clienteNome: true, clienteCnpj: true, tipoPedido: true, extRef: true, itens: { select: { id: true, descricao: true } } },
  });
  const pvs = await prisma.pedidoVenda.findMany({ where: { numero: { in: pps.map((p) => p.numero) }, fonte: "SISTEMA", status: "ANDAMENTO" }, select: { id: true, numero: true, itens: true } });
  const pvDe = Object.fromEntries(pvs.map((v) => [v.numero, v]));
  const cache = {}, feitos = [];
  for (const pp of pps) {
    const pv = pvDe[pp.numero];
    if (!pv || pp.tipoPedido === "SERVIÇO" || String(pp.extRef || "").startsWith("NORT|")) continue;
    const ck = so(pp.clienteCnpj) || up(pp.clienteNome);
    if (!(ck in cache)) cache[ck] = await prefixoCliente(pp.clienteCnpj, pp.clienteNome);
    const pref = cache[ck];
    if (!pref) continue;
    const troca = {};
    for (const it of pp.itens) {
      const nova = comPrefixo(it.descricao, pref);
      if (nova && nova !== up(it.descricao)) { troca[up(it.descricao)] = nova; await prisma.ppItem.update({ where: { id: it.id }, data: { descricao: nova } }); }
    }
    const itens = Array.isArray(pv.itens) ? pv.itens : [];
    let mudou = false;
    const novos = itens.map((x) => {
      const nova = troca[up(x?.descricao)] || comPrefixo(x?.descricao, pref);
      if (x && nova && nova !== x.descricao && nova !== up(x.descricao)) { mudou = true; return { ...x, descricao: nova }; }
      return x;
    });
    if (mudou) await prisma.pedidoVenda.update({ where: { id: pv.id }, data: { itens: novos } });
    if (mudou || Object.keys(troca).length) feitos.push(pp.numero);
  }
  await prisma.finConfig.upsert({ where: { chave: MARCA_91 }, create: { chave: MARCA_91, valor: JSON.stringify({ em: new Date().toISOString(), pedidos: feitos }) }, update: { valor: JSON.stringify({ em: new Date().toISOString(), pedidos: feitos }) } });
  return feitos;
}
