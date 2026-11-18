// v959 — catálogo Santanense SW02 (Ematex Workwear, PDF de 18/11/2026): um artigo de TECIDO por artigo × cor, com armação,
// composição, gramatura e largura. A cor é o código do fabricante (o catálogo não dá nome); a classe da cor vai na especificação.
// Roda uma vez (flag em FinConfig): cria o fornecedor SANTANENSE se não existir e não duplica artigo × cor já cadastrado.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "SEED|CARTELA|SANTANENSE SW02|2026-11-18";

const CLASSE = { C: "CLARA", M: "MÉDIA", E: "ESCURA", S: "ESPECIAL", X: "EXCLUSIVA", U: "ULTRA EXCLUSIVA", F: "FLUORESCENTE" };
// "1417E 1234S 5137F*" → [[cor, classe, marca]]
const g = (s) => s.trim().split(/\s+/).map((t) => { const m = t.match(/^(\d{4})([CMESXUF]?)([*"#]*)$/); if (!m) throw new Error("cor inválida: " + t); return [m[1], CLASSE[m[2]] || null, m[3]]; });

const FIRE_1 = g("1417E 1234S 1213X 1207F 1002C 1009M 1021M 1010C 1279E 1014X 1018X");
const FIRE_2 = g("1012E 1232M 1233E 1281F 1414E 1014X 1018X 1155X 1002C 1009M 1021M 1010C");
const XTREME = g("5001C 5024S 5264E 5015X 5064S 5006E 5010C 5021C 5053C 5009M 5003C 5414E 5014U 5151S 5152S 5008S 5808M 5018E 5818M 5866M 5016M 5137F");
// cartela da linha Master: " = Universal e Unisoft · * = Uniforte, Unileve, Unipacific e Uniquality · # = Unicolor
const MASTER = g(`1001C"*# 1029S" 1012E"* 1232M"# 1233E" 1017X" 1010C"*# 1021M"*# 1002C"*# 1009M"*# 1006E"*# 1016M"*#
  1038C" 1007M" 1043E"*# 1243S" 1015X"*# 1003C"* 1019M"*# 1239E" 1839M"*# 1414E"*# 1014U"*# 1008X"*# 1808M"*# 1240S" 1241E"#
  1018S"* 1818M"*# 1242S"* 1842M"*#`);
const master = (marca) => MASTER.filter((c) => c[2].includes(marca)).map(([cor, cl]) => [cor, cl, ""]);
// Unistretch: a cartela vale para todos; as cores com * são as do Unistretch Pro (título com *)
const STRETCH = g("5401* 5404* 5405* 5409* 5406 5407 5411 5439 5420 5412* 5416*");
const SERVICE = g("2001C 2003C 2014U 2046X 2008S 2018E 2010C 2021C 2203E 2002C 2050M 2016M 2015X 2106X 2107E");

const A = (ref, nome, linha, armacao, composicao, gramatura, largura, interno, cores) => ({ ref, nome: `${ref} ${nome}`, linha, armacao, composicao, gramatura, largura, interno, cores });
const ARTIGOS = [
  A("540", "UNISAFE PRO FR", "FIRE", "SARJA 3X1", "88% ALGODÃO 12% POLIAMIDA", 260, 1.6, "BRIM FR ANTICHAMA", FIRE_1),
  A("479", "UNISAFE SLIM FR", "FIRE", "SARJA 3X1", "88% ALGODÃO 12% POLIAMIDA", 237, 1.58, "BRIM FR ANTICHAMA", FIRE_1),
  A("544", "UNICOMPANY FR", "FIRE", "SARJA 3X1", "100% ALGODÃO", 290, 1.6, "BRIM FR ANTICHAMA", FIRE_2),
  A("435", "UNIFORTE PRO FR", "FIRE", "SARJA 3X1", "100% ALGODÃO", 260, 1.6, "BRIM FR ANTICHAMA", FIRE_2),
  A("205", "UNIPOWER METAL LÍQUIDO", "FIRE", "SARJA 3X1", "100% ALGODÃO", 415, 1.6, "BRIM FR ANTICHAMA", g("1018X 1021M 1009M")),
  A("347", "UNILESTER RIP STOP", "TECHNO", "RIP STOP", "67% POLIÉSTER 33% ALGODÃO", 230, 1.6, "RIPSTOP", g("2021C 2055M 2050M 2018E 2350X 2016M 2107E 2106X 2232X 2179U 2065X")),
  A("476", "UNICOR RIP STOP", "TECHNO", "RIP STOP", "50% ALGODÃO 50% POLIAMIDA", 225, 1.63, "RIPSTOP", g("4438X 4406U 4450U 4401E")),
  A("714", "UNITECH RIP STOP", "TECHNO", "TELA RIP STOP", "67% ALGODÃO 33% POLIÉSTER", 234, 1.6, "RIPSTOP", g("5295C 5296U 5016M 5260E 5298M")),
  A("715", "UNIFLEX RIP STOP", "TECHNO", "SARJA 3X1 RIP STOP", "48% ALGODÃO 40% POLIÉSTER 12% ELASTOMULTIÉSTER", 225, 1.6, "RIPSTOP FLEX", g("5395C 5396U 5137F* 5360E 5350U* 5398M 5316M")),
  A("279", "UNITECH", "XTREME", "SARJA 3X1", "67% ALGODÃO 33% POLIÉSTER", 265, 1.6, "BRIM MISTO ALGODAO E POLIESTER", XTREME),
  A("711", "UNITECH SOFT", "XTREME", "SARJA 3X1", "67% ALGODÃO 33% POLIÉSTER", 238, 1.6, "BRIM MISTO ALGODAO E POLIESTER", XTREME),
  A("712", "UNIFIT", "XTREME", "SARJA 2X1", "67% ALGODÃO 33% POLIÉSTER", 195, 1.6, "BRIM MISTO ALGODAO E POLIESTER", XTREME),
  A("242", "UNIOFFICE CAMISARIA", "XTREME", "SARJA 2X1", "62% ALGODÃO 38% POLIÉSTER", 163, 1.6, "CAMISARIA UNIOFFICE",
    g("5010C 5021C 5053C 5009M 5003C 5018E 3001C 3015M 3007S 3008X 3014M 3009M 3031M 3002E 3033E 3013E 3017C 3025M 3004E 3003E 3006X 3020U 3029X")),
  A("035", "UNIFORTE", "MASTER", "SARJA 3X1", "100% ALGODÃO", 260, 1.6, "BRIM PESADO ALGODAO", master("*")),
  A("037", "UNILEVE", "MASTER", "SARJA 2X1", "100% ALGODÃO", 208, 1.6, "BRIM LEVE ALGODAO", master("*")),
  A("196", "UNIPACIFIC", "MASTER", "SARJA 3X1", "100% ALGODÃO", 265, 1.6, "BRIM PESADO ALGODAO", master("*")),
  A("200", "UNIQUALITY", "MASTER", "SARJA 2X1", "100% ALGODÃO", 220, 1.6, "BRIM LEVE ALGODAO", master("*")),
  A("206", "UNIVERSAL", "MASTER", "SARJA 3X1", "100% ALGODÃO", 250, 1.6, "BRIM PESADO ALGODAO", master('"')),
  A("225", "UNISOFT", "MASTER", "SARJA 2X1", "100% ALGODÃO", 200, 1.6, "BRIM LEVE ALGODAO", master('"')),
  A("686", "UNICOLOR", "MASTER", "SARJA 3X1", "100% ALGODÃO", 235, 1.6, "BRIM PESADO ALGODAO", master("#")),
  A("717", "UNIDENIM", "WORK DENIM", "SARJA 3X1 'S'", "63% ALGODÃO 37% POLIÉSTER", 250, 1.6, "BRIM MISTO ALGODAO E POLIESTER", g("3004E 3006X 3020U 3029X")),
  A("724", "UNISTRETCH LIGHT", "WORK DENIM", "SARJA 2X1", "97,5% ALGODÃO 2,5% ELASTANO", 261, 1.6, "BRIM COM ELASTANO", STRETCH.map(([c]) => [c, null, ""])),
  A("746", "UNISTRETCH PRO", "WORK DENIM", "SARJA 2X1", "98,5% ALGODÃO 1,5% ELASTANO", 296, 1.62, "BRIM COM ELASTANO", STRETCH.filter((c) => c[2]).map(([c]) => [c, null, ""])),
  A("747", "UNISTRETCH RIP STOP", "WORK DENIM", "RIP STOP", "98% ALGODÃO 2% ELASTANO", 235, 1.65, "RIPSTOP FLEX", STRETCH.map(([c]) => [c, null, ""])),
  A("201", "UNILESTER PLUS", "SERVICE", "SARJA 2X1", "67% POLIÉSTER 33% ALGODÃO", 245, 1.62, "BRIM POLIESTER", SERVICE),
  A("710", "UNILESTER POLY", "SERVICE", "SARJA 2X1", "67% POLIÉSTER 33% ALGODÃO", 223, 1.6, "BRIM POLIESTER", SERVICE),
  A("209", "UNILESTER SOFT", "SERVICE", "SARJA 2X1", "67% POLIÉSTER 33% ALGODÃO", 205, 1.61, "BRIM POLIESTER", SERVICE),
  A("716", "UNISTILL", "SERVICE", "TELA", "67% POLIÉSTER 33% ALGODÃO", 135, 1.6, "TELA POLIESTER E ALGODAO", g("6501C 6563C 6504M 6509M 6547C 6539C 6514S 6516E")),
];
export { ARTIGOS };

const NOVOS_TIPOS = ["BRIM FR ANTICHAMA", "BRIM COM ELASTANO", "TELA POLIESTER E ALGODAO"];
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  if (!(await prisma.artigoTipoInterno.count())) {
    const src = readFileSync(new URL("../lib/artigosInternos.js", import.meta.url), "utf8");
    const ini = new Function("return " + src.match(/TIPOS_INICIAIS = (\{[\s\S]*?\n\});/)[1])();
    await prisma.artigoTipoInterno.createMany({ data: Object.entries(ini).flatMap(([categoria, ns]) => ns.map((nome) => ({ categoria, nome }))), skipDuplicates: true });
  }
  for (const nome of NOVOS_TIPOS) await prisma.artigoTipoInterno.upsert({ where: { categoria_nome: { categoria: "TECIDO", nome } }, update: {}, create: { categoria: "TECIDO", nome } });

  const achar = (f) => [f.nome, f.nomeFantasia, f.razaoSocial].some((n) => /SANTANENSE/.test(sa(n)));
  let forn = (await prisma.fornecedor.findMany()).find(achar);
  if (!forn) forn = await prisma.fornecedor.create({ data: { nome: "SANTANENSE", nomeFantasia: "SANTANENSE (EMATEX WORKWEAR)", obs: "CADASTRADO PELO CATÁLOGO DIGITAL SW02 (18/11/2026)" } });

  const existentes = await prisma.artigo.findMany({ where: { fornecedorId: forn.id, ativo: true }, select: { nome: true, cor: true, composicao: true } });
  const chave = (n, cor, comp) => [sa(n), sa(cor), sa(comp)].join("|");
  const ja = new Set(existentes.map((a) => chave(a.nome, a.cor, a.composicao)));
  let novos = 0, pulados = 0;
  for (const a of ARTIGOS) for (const [cor, classe, marca] of a.cores) {
    if (ja.has(chave(a.nome, cor, a.composicao))) { pulados++; continue; }
    const esp = [`ARMAÇÃO ${a.armacao}`, `LINHA ${a.linha}`, classe && `COR ${classe}`, marca === "*" && "COR COM * NA CARTELA"].filter(Boolean).join(" · ");
    await prisma.artigo.create({ data: {
      categoria: "TECIDO", fornecedorId: forn.id, codigoFornecedor: a.ref, nome: a.nome, artigoInterno: a.interno, cor, composicao: a.composicao,
      gramatura: a.gramatura, largura: a.largura, unidade: "M", especificacao: esp, origem: "CARTELA",
    } });
    ja.add(chave(a.nome, cor, a.composicao)); novos++;
  }
  await prisma.finConfig.create({ data: { chave: FLAG, valor: new Date().toISOString() } });
  console.log(`Seed catálogo Santanense: ${novos} artigo(s) criado(s), ${pulados} já existia(m).`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((e) => console.log("Seed catálogo Santanense: ignorado (" + (e?.message || e) + ")")).finally(() => prisma.$disconnect());
}
