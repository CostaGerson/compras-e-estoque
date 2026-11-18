// v991 — sugestão #91 (Maycon): itens de pedidos em andamento fora do padrão "CLIENTE - PRODUTO" são renomeados no ERP
//   (PP e pedido), e o pedido é marcado como alterado para o PCP reler. Portal, NORT e serviço ficam como estão. Uma vez.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "AJUSTE|nome-itens-cliente-produto-v991";
const so = (s) => String(s || "").replace(/\D/g, "");
const up = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const semAc = (s) => up(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const LIXO = /\b(LTDA|EIRELI|ME|EPP|S\/?A|SA|S\.A\.?|LIMITADA|COMERCIO|COMERCIAL|SERVICOS|SERVICO|INDUSTRIA|INDUSTRIAL|E|DE|DA|DO|DOS|DAS)\b\.?/g;
const prefixoDoNome = (nome) => { const n = semAc(nome).replace(LIXO, " ").replace(/[^A-Z0-9& ]/g, " ").replace(/\s+/g, " ").trim(); return n.split(" ").slice(0, 2).join(" ") || up(nome); };
const temPrefixo = (d) => /^\s*[^-]{2,40}\s-\s\S/.test(String(d || ""));
const comPrefixo = (d0, p) => { const d = up(d0); if (!d || !p || temPrefixo(d) || semAc(d).startsWith(semAc(p))) return d; return `${p} - ${d}`; };
async function prefixo(cnpj, nome) {
  const c = so(cnpj);
  if (c) {
    const peds = await prisma.pedidoVenda.findMany({ where: { cnpj: c }, select: { itens: true }, orderBy: { emissao: "desc" }, take: 30 });
    const conta = {};
    for (const p of peds) for (const it of Array.isArray(p.itens) ? p.itens : []) { const m = String(it?.descricao || "").match(/^\s*([^-]{2,40}?)\s-\s\S/); if (m) conta[up(m[1])] = (conta[up(m[1])] || 0) + 1; }
    const m = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]; if (m) return m[0];
    const cli = await prisma.cliente.findFirst({ where: { cnpj: c }, select: { nomeFantasia: true } }).catch(() => null);
    if (cli?.nomeFantasia) return prefixoDoNome(cli.nomeFantasia);
  }
  return nome ? prefixoDoNome(nome) : null;
}
async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  const pps = await prisma.pp.findMany({ where: { numero: { not: null }, portalClienteId: null, OR: [{ tipoPedido: null }, { tipoPedido: { not: "SERVIÇO" } }] }, include: { itens: { orderBy: { id: "asc" } } } });
  const peds = Object.fromEntries((await prisma.pedidoVenda.findMany({ where: { numero: { in: pps.map((p) => p.numero) }, status: "ANDAMENTO" } })).map((p) => [p.numero, p]));
  const feitos = [];
  for (const pp of pps) {
    const pv = peds[pp.numero];
    if (!pv || String(pp.extRef || "").startsWith("NORT|")) continue;
    const pref = await prefixo(pp.clienteCnpj || pv.cnpj, pp.clienteNome || pv.cliente);
    if (!pref) continue;
    let mudou = false;
    for (const it of pp.itens) { const n = comPrefixo(it.descricao, pref); if (n && n !== it.descricao) { await prisma.ppItem.update({ where: { id: it.id }, data: { descricao: n } }); mudou = true; } }
    const itens = (Array.isArray(pv.itens) ? pv.itens : []).map((it) => { const n = comPrefixo(it?.descricao, pref); if (it && n && n !== it.descricao) { mudou = true; return { ...it, descricao: n }; } return it; });
    if (mudou) { await prisma.pedidoVenda.update({ where: { id: pv.id }, data: { itens } }); feitos.push(pp.numero); }
  }
  console.log(`[v991] pedidos com itens renomeados (CLIENTE - PRODUTO): ${feitos.length} ${feitos.join(", ")}`);
  await prisma.finConfig.create({ data: { chave: FLAG, valor: JSON.stringify(feitos).slice(0, 5000) } });
}
main().catch((e) => console.error("[v991]", e.message)).finally(() => prisma.$disconnect());
