// v962 — carga genérica de cartelas/catálogos de fornecedores. Cada arquivo em scripts/cartelas/*.json é um catálogo:
// { flag, fornecedor: { nome, nomeFantasia, obs, busca }, tiposNovos: [{ categoria, nome }],
//   artigos: [{ categoria, ref, nome, interno, composicao, gramatura, largura, tipoMalha, rendimento, unidade, especificacao,
//               cores: [[cor, especificacaoDaCor]] }] }
// Roda cada catálogo uma vez (flag em FinConfig): cria o fornecedor se não existir e não duplica artigo × cor já cadastrado.
import { readFileSync, readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const DIR = new URL("./cartelas/", import.meta.url);
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function tiposIniciais() {
  if (await prisma.artigoTipoInterno.count()) return;
  const src = readFileSync(new URL("../lib/artigosInternos.js", import.meta.url), "utf8");
  const ini = new Function("return " + src.match(/TIPOS_INICIAIS = (\{[\s\S]*?\n\});/)[1])();
  await prisma.artigoTipoInterno.createMany({ data: Object.entries(ini).flatMap(([categoria, ns]) => ns.map((nome) => ({ categoria, nome }))), skipDuplicates: true });
}

// v1166 — artigos da cartela que ficaram sem fornecedor (fornecedor excluído/mesclado) voltam para o fornecedor da cartela
async function reatribuir(cat) {
  const nomes = [...new Set(cat.artigos.map((a) => a.nome))];
  const orfaos = await prisma.artigo.count({ where: { fornecedorId: null, origem: "CARTELA", nome: { in: nomes } } });
  if (!orfaos) return;
  const busca = sa(cat.fornecedor.busca || cat.fornecedor.nome).replace(/\s/g, "");
  let forn = (await prisma.fornecedor.findMany()).find((f) => [f.nome, f.nomeFantasia, f.razaoSocial].some((n) => sa(n).replace(/\s/g, "").includes(busca)));
  if (!forn) forn = await prisma.fornecedor.create({ data: { nome: cat.fornecedor.nome, nomeFantasia: cat.fornecedor.nomeFantasia || null, obs: cat.fornecedor.obs || null } });
  const r = await prisma.artigo.updateMany({ where: { fornecedorId: null, origem: "CARTELA", nome: { in: nomes } }, data: { fornecedorId: forn.id } });
  console.log(`Seed cartelas · ${cat.fornecedor.nome}: ${r.count} artigo(s) sem fornecedor voltaram para ${forn.nome}.`);
}

async function carregar(cat) {
  await reatribuir(cat).catch((e) => console.log("reatribuir:", e.message));
  if (await prisma.finConfig.findUnique({ where: { chave: cat.flag } })) return;
  await tiposIniciais();
  for (const t of cat.tiposNovos || []) await prisma.artigoTipoInterno.upsert({ where: { categoria_nome: t }, update: {}, create: t });
  const busca = sa(cat.fornecedor.busca || cat.fornecedor.nome).replace(/\s/g, "");
  let forn = (await prisma.fornecedor.findMany()).find((f) => [f.nome, f.nomeFantasia, f.razaoSocial].some((n) => sa(n).replace(/\s/g, "").includes(busca)));
  if (!forn) forn = await prisma.fornecedor.create({ data: { nome: cat.fornecedor.nome, nomeFantasia: cat.fornecedor.nomeFantasia || null, obs: cat.fornecedor.obs || null } });
  const existentes = await prisma.artigo.findMany({ where: { fornecedorId: forn.id, ativo: true }, select: { nome: true, cor: true, composicao: true } });
  const chave = (n, cor, comp) => [sa(n), sa(cor), sa(comp)].join("|");
  const ja = new Set(existentes.map((a) => chave(a.nome, a.cor, a.composicao)));
  let novos = 0, pulados = 0;
  for (const a of cat.artigos) for (const [cor, espCor] of a.cores) {
    if (ja.has(chave(a.nome, cor, a.composicao))) { pulados++; continue; }
    await prisma.artigo.create({ data: {
      categoria: a.categoria, fornecedorId: forn.id, codigoFornecedor: a.ref || null, nome: a.nome, artigoInterno: a.interno || null, cor,
      composicao: a.composicao || null, gramatura: a.gramatura ?? null, largura: a.largura ?? null, tipoMalha: a.tipoMalha || null,
      rendimento: a.rendimento ?? null, unidade: a.unidade || (a.categoria === "MALHA" ? "KG" : "M"),
      especificacao: [a.especificacao, espCor].filter(Boolean).join(" · ") || null, origem: "CARTELA",
    } });
    ja.add(chave(a.nome, cor, a.composicao)); novos++;
  }
  await prisma.finConfig.create({ data: { chave: cat.flag, valor: new Date().toISOString() } });
  console.log(`Seed cartelas · ${cat.fornecedor.nome} (${cat.flag}): ${novos} artigo(s) criado(s), ${pulados} já existia(m).`);
}

try {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
    try { await carregar(JSON.parse(readFileSync(new URL(f, DIR), "utf8"))); }
    catch (e) { console.log(`Seed cartelas · ${f}: ignorado (${e?.message || e})`); }
  }
} finally { await prisma.$disconnect(); }
