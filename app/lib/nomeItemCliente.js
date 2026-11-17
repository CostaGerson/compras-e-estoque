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
