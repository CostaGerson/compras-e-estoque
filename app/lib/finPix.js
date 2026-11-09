// v698 — a chave PIX digitada numa conta comum fica no cadastro do fornecedor (e volta sozinha na próxima conta).
// Fornecedor do Compras (pelo CNPJ ou pelo nome) recebe em Fornecedor.chavePix; os demais ficam lembrados em FinConfig "PIX|<NOME>".
// PIX copia e cola (000201…) é de uma cobrança só: não vai para o cadastro.
import { prisma } from "@/lib/prisma";

const so = (s) => String(s || "").replace(/\D/g, "");
const nome = (s) => String(s || "").trim().toUpperCase();
export const ehCopiaCola = (c) => /^000201/.test(String(c || "").replace(/\s/g, ""));

async function acharFornecedor(parceiro, documento) {
  const doc = so(documento);
  if (doc.length >= 11) {
    const c = await prisma.fornecedorCnpj.findFirst({ where: { cnpj: { in: [doc, documento] } }, select: { fornecedorId: true } }).catch(() => null);
    if (c) return c.fornecedorId;
  }
  const n = nome(parceiro);
  if (!n) return null;
  const f = await prisma.fornecedor.findFirst({ where: { OR: [{ nome: { equals: n, mode: "insensitive" } }, { nomeFantasia: { equals: n, mode: "insensitive" } }, { razaoSocial: { equals: n, mode: "insensitive" } }] }, select: { id: true } }).catch(() => null);
  return f?.id || null;
}

export async function lembrarPix(parceiro, documento, chave) {
  const c = String(chave || "").trim();
  if (!c || ehCopiaCola(c) || !nome(parceiro)) return null;
  const fid = await acharFornecedor(parceiro, documento);
  if (fid) await prisma.fornecedor.update({ where: { id: fid }, data: { chavePix: c } }).catch(() => null);
  const k = `PIX|${nome(parceiro)}`;
  await prisma.finConfig.upsert({ where: { chave: k }, create: { chave: k, valor: c }, update: { valor: c } }).catch(() => null);
  return { fornecedorId: fid };
}

// parceiros da lista do contas a pagar com a chave PIX conhecida
export async function pixDosParceiros(parceiros) {
  const [cfg, forn] = await Promise.all([
    prisma.finConfig.findMany({ where: { chave: { startsWith: "PIX|" } } }).catch(() => []),
    prisma.fornecedor.findMany({ where: { chavePix: { not: null } }, select: { nome: true, nomeFantasia: true, razaoSocial: true, chavePix: true, cnpjs: { select: { cnpj: true } } } }).catch(() => []),
  ]);
  const porNome = Object.fromEntries(cfg.map((x) => [x.chave.slice(4), x.valor]));
  const porDoc = {};
  for (const f of forn) {
    for (const n of [f.nome, f.nomeFantasia, f.razaoSocial]) if (n && !porNome[nome(n)]) porNome[nome(n)] = f.chavePix;
    for (const c of f.cnpjs) porDoc[so(c.cnpj)] = f.chavePix;
  }
  return parceiros.map((p) => ({ ...p, chavePix: porDoc[so(p.documento)] || porNome[nome(p.parceiro)] || null }));
}
