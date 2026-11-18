// v957 — cartela da Stamp Lite (fotos de 18/11/2026): um artigo de MALHA por artigo × cor, com composição, gramatura,
// largura, tipo (tubular/ramada) e rendimento da cartela. A classe da cor (clara/escura/especial) vai na especificação.
// Roda uma vez (flag em FinConfig): cria o fornecedor STAMP LITE se não existir e não duplica artigo × cor já cadastrado.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "SEED|CARTELA|STAMP LITE|2026-11-18";

const CLA = "CLARA", ESC = "ESCURA", ESP = "ESPECIAL";
const c = (s) => s.split("|").map((x) => { const [cor, k] = x.split(":"); return [cor, k === "C" ? CLA : k === "E" ? ESC : k === "S" ? ESP : null]; });

const ARTIGOS = [
  { nome: "MALHA CARDADA", interno: "ALGODAO 30.1 CARDADO", composicao: "100% ALGODÃO", gramatura: 165, largura: 1.2, tipo: "TUBULAR", rendimento: 2.6,
    cores: c("AMARELO BB:C|HANOI:E|MAÇÃ VERDE:E|OURO:E|LARANJA:E|SALMON:C|VERMELHO:S|AZUL BB:C|MARIMAR:E|TURQUESA:E|CINZA:E|ROYAL:S|MARINHO:E|PRETO:S|BRANCO|PRATA:C|VERDE BB:C|JADE:E|PETRÓLEO:E|BANDEIRA:S|MUSGO:E|MARFIM:C|BEGE:C|CAQUI:E|AGRESTE:C|CANELA:E|MARROM:E|BORDEAUX:E|ROSA BB:C|TUTTI-FRUTTI:C|PINK:E|LILÁS:C") },
  { nome: "MALHA PIQUET PA", interno: "PIQUET P.A", composicao: "50% POLIÉSTER 50% ALGODÃO", gramatura: 210, largura: 1.2, tipo: "TUBULAR", rendimento: 2.0,
    cores: c("BRANCO|AZUL JEANS:E|MESCLA ESCURO:E|OURO:E|MUSGO:E|BANDEIRA:S|ROYAL:S|MARINHO:E|VERMELHO:S|BORDEAUX:E|PRETO:E") },
  { nome: "MALHA PENTEADA 100% ALGODÃO", interno: "ALGODAO 30.1 PENTEADO", composicao: "100% ALGODÃO", gramatura: 165, largura: 1.2, tipo: "TUBULAR", rendimento: 2.5,
    cores: c("BRANCO|CRISTAL:C|OPALA:C|SKY:S|ROYAL:S|MARINHO:E|MARINHO NOITE:S|VERDE BB:C|AQUA SEA:C|JADE:E|PETRÓLEO:E|MUSGO:E|CACTO:E|BANDEIRA:S|MARFIM:C|ARENA:C|BEGE:C|CAQUI:E|AGRESTE:C|CROMO:E|MARROM:E|GLACIAL:C|PRATA:C|CINZA:E|CONCRETO:E|GRAFITE:E|PRETO:S|ROXO:S|LIMA:C|IPANEMA:C|HANOI:E|OURO:E|LARANJA:E|CORAL:E|GOLDEN:E|ROSA BB:C|AZALÉIA:E|FRAMBOESA:E|MAUVE:E|VERMELHO:S|TOMATE:S|BORDEAUX:E|NUDE:C|SALMON:C") },
  { nome: "MALHA PA", interno: "PA", composicao: "50% POLIÉSTER 50% ALGODÃO", gramatura: 173, largura: 1.2, tipo: "TUBULAR", rendimento: 2.4,
    cores: c("BRANCO|MARFIM:C|BEGE:C|PRATA:C|CINZA:E|GRAFITE:E|PRETO:E|HANOI:E|OURO:E|MUSGO:E|BANDEIRA:S|JADE:E|ROYAL:S|MARINHO:E") },
  // na cartela esta página da Malha PA está impressa com "50% Poliéster 50% Elastano" — mantido como está; conferir com o fornecedor
  { nome: "MALHA PA", interno: "PA", composicao: "50% POLIÉSTER 50% ELASTANO", gramatura: 173, largura: 1.2, tipo: "TUBULAR", rendimento: 2.4,
    cores: c("BORDEAUX:E|MARROM:E|VERMELHO:E|CAQUI MESCLA:E|ATLÂNTICO MESCLA:E|ROYAL MESCLA:E|MARINHO MESCLA:E|VERMELHO MESCLA:E|BORDEAUX MESCLA:E|PRETO MESCLA:E|CINZA MESCLA (FIO TINTO)") },
  { nome: "COTTON LITE PENTEADO", interno: "ALGODAO PENTEADO COM ELASTANO", composicao: "95% ALGODÃO 5% ELASTANO", gramatura: 185, largura: 1.8, tipo: "TUBULAR", rendimento: 3.0,
    cores: c("BRANCO|MARFIM:C|MOCASSIM:C|AMARELO BB:C|LIMA:C|VERDE BB:C|CRISTAL:C|ROSA BB:C|TULIPERA:E|ROMANCE:C|MAUVE:E|RACY:E|BORDEAUX:S|ROXO:S|CANELA:C|CASTANHO:E|MARROM:E|SALMON:C|CORAL:E|PIMENTA:E|VERMELHO:S|PRATA:C|CINZA:E|CHUMBO:E|AZUL JEANS:E|ROYAL:S|MARINHO:E|MUSGO:E|PRETO:E") },
];

// página antipilling: ● PV · ★ poliéster tubular · ■ poliéster ramado (marcas embaixo de cada cor)
const ANTI = c("BRANCO|ROSA BB:C|TUTTI FRUTI:C|PINK:E|BORDEAUX:E|LILÁS:C|ROXO:E|COLEGIAL:C|MOTORISTA:C|TURQUESA:S|PETRÓLEO:S|ROYAL:S|MARINHO:E|PRETO:E|VERDE BB:C|MAÇÃ VERDE:E|MARIMAR:E|JADE:S|BANDEIRA:S|ATLÂNTICO:S|MUSGO:E|MARFIM:C|AMARELO BB:C|HANOI:E|OURO:E|SALMON:C|LARANJA:E|VERMELHO:E|PRATA:C|MESCLA CLARO:E|CINZA:E|CAQUI:E|MOSTARDA:E|MARROM:E|MESCLA CLARO (FIO TINTO)");
const MARCAS = "PTR|PTR|PTR|PTR|PTR|PTR|P|PTR|P|PT|P|PTR|PTR|PTR|PTR|PT|PR|P|PT|PTR|P|P|PTR|PT|PT|PR|PT|PTR|PT|P|P|P|P|P|T".split("|");
const sel = (l) => ANTI.filter((_, i) => MARCAS[i].includes(l));
ARTIGOS.push(
  { nome: "PV ANTIPILLING", interno: "PV", composicao: "67% POLIÉSTER 33% VISCOSE", gramatura: 175, largura: 1.2, tipo: "TUBULAR", rendimento: 2.4, cores: sel("P") },
  { nome: "POLIÉSTER TUBULAR ANTIPILLING", interno: "PP", composicao: "100% POLIÉSTER", gramatura: 178, largura: 1.2, tipo: "TUBULAR", rendimento: 2.3, cores: sel("T") },
  { nome: "POLIÉSTER RAMADO ANTIPILLING", interno: "PP", composicao: "100% POLIÉSTER", gramatura: 170, largura: 1.2, tipo: "RAMADA", rendimento: 3.3, cores: sel("R") },
);
export { ARTIGOS };

const NOVOS_TIPOS = ["PA", "ALGODAO PENTEADO COM ELASTANO"];
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  // artigos internos: se a tabela ainda está vazia, carrega a lista inicial antes (senão ela nunca seria carregada)
  if (!(await prisma.artigoTipoInterno.count())) {
    const src = readFileSync(new URL("../lib/artigosInternos.js", import.meta.url), "utf8");
    const ini = new Function("return " + src.match(/TIPOS_INICIAIS = (\{[\s\S]*?\n\});/)[1])();
    await prisma.artigoTipoInterno.createMany({ data: Object.entries(ini).flatMap(([categoria, ns]) => ns.map((nome) => ({ categoria, nome }))), skipDuplicates: true });
  }
  for (const nome of NOVOS_TIPOS) await prisma.artigoTipoInterno.upsert({ where: { categoria_nome: { categoria: "MALHA", nome } }, update: {}, create: { categoria: "MALHA", nome } });

  let forn = (await prisma.fornecedor.findMany()).find((f) => sa(f.nome).replace(/\s/g, "").includes("STAMPLITE") || sa(f.nomeFantasia).replace(/\s/g, "").includes("STAMPLITE"));
  if (!forn) forn = await prisma.fornecedor.create({ data: { nome: "STAMP LITE", nomeFantasia: "STAMP LITE INDÚSTRIA TÊXTIL", obs: "CADASTRADO PELA CARTELA DE CORES (18/11/2026)" } });

  const existentes = await prisma.artigo.findMany({ where: { fornecedorId: forn.id, ativo: true }, select: { nome: true, cor: true, composicao: true } });
  const chave = (n, cor, comp) => [sa(n), sa(cor), sa(comp)].join("|");
  const ja = new Set(existentes.map((a) => chave(a.nome, a.cor, a.composicao)));
  let novos = 0, pulados = 0;
  for (const a of ARTIGOS) for (const [cor, classe] of a.cores) {
    if (ja.has(chave(a.nome, cor, a.composicao))) { pulados++; continue; }
    await prisma.artigo.create({ data: {
      categoria: "MALHA", fornecedorId: forn.id, nome: a.nome, artigoInterno: a.interno, cor, composicao: a.composicao,
      gramatura: a.gramatura, largura: a.largura, tipoMalha: a.tipo, rendimento: a.rendimento, unidade: "KG",
      especificacao: classe ? `COR ${classe}` : null, origem: "CARTELA",
    } });
    ja.add(chave(a.nome, cor, a.composicao)); novos++;
  }
  await prisma.finConfig.create({ data: { chave: FLAG, valor: new Date().toISOString() } });
  console.log(`Seed cartela Stamp Lite: ${novos} artigo(s) criado(s), ${pulados} já existia(m).`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((e) => console.log("Seed cartela Stamp Lite: ignorado (" + (e?.message || e) + ")")).finally(() => prisma.$disconnect());
}
