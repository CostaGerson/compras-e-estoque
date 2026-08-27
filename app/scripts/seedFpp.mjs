// Popula os parâmetros padrão da FPP (banco de dados das planilhas Malha e Plano).
// Idempotente: se o parâmetro já existe, NÃO sobrescreve (preserva edições feitas no modo OS).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ---------- MALHA: peça -> rendimento (peças/kg) + corte + expedição + proporção volume ----------
const PECAS_MALHA = [
  ["CAMISETA MC MALHA",        4.5,  0.83, 1.23, 1.0],
  ["CAMISETA MC DRY",          5.0,  0.83, 1.23, 1.0],
  ["CAMISETA MANGA LONGA MALHA", 3.11, 0.83, 1.23, 1.0],
  ["CAMISETA MANGA LONGA DRY", 3.11, 0.83, 1.23, 1.0],
  ["POLO MALHA",               4.5,  0.99, 2.22, 0.8],
  ["POLO DRY",                 5.0,  0.99, 2.22, 0.8],
  ["POLO PIQUET",              3.4,  0.99, 2.22, 0.7],
  ["AGASALHO HELANCA",         1.66, 1.65, 1.23, 0.6],
  ["BERMUDA HELANCA",          5.0,  1.65, 1.15, 0.6],
  ["CALÇA HELANCA",            2.5,  1.65, 1.15, 0.6],
];
// ---------- PLANO: peça -> consumo (m/peça) + corte + acabamento + proporção volume ----------
const PECAS_PLANO = [
  ["CALÇA BRIM CONVENCIONAL", 1.30, 1.65, 1.15, 1.0],
  ["CALÇA BRIM REFORÇADA",    1.40, 1.65, 1.15, 1.0],
  ["CALÇA JEANS",             1.32, 1.65, 1.15, 1.0],
  ["CALÇA TACTEL",            1.25, 1.65, 1.15, 1.2],
  ["BLUSÃO BRIM",             1.40, 2.20, 4.53, 0.6],
  ["JALECO MANGA CURTA",      1.30, 2.20, 4.53, 0.6],
  ["CAMISA SOCIAL M. LONGA",  1.50, 2.20, 4.53, 0.6],
  ["CAMISA SOCIAL M. CURTA",  1.30, 2.20, 4.53, 0.6],
  ["JAQUETA NYLON",           2.00, 1.65, 1.23, 0.3],
  ["AGASALHO TACTEL",         1.70, 1.65, 1.23, 0.5],
];

const GOLA_MALHA = [["GOLA VIÉS", 0], ["GOLA RIBANA", 0.41952], ["GOLA POLO P.A", 2.1], ["GOLA POLIÉSTER", 2.3]];
const PUNHO_MALHA = [["SEM PUNHO", 0], ["PUNHO RIBANA", 0.186453], ["PUNHO PA/POLIÉSTER", 1]];
const ELASTICO_PLANO = [["SEM ELÁSTICO", 0], ["CORDAO ELASTICO TOTAL", 0.53], ["MEIO CÓS", 0.28], ["PUNHOS E BARRAS", 0.75]];
const FAIXA_MALHA = [
  ["SEM FAIXA", 0],
  ["CAMISA (TÓRAX + MANGAS) 5CM", 1.79], ["CALÇA (UMA EM CADA PERNA) 5CM", 1.16],
  ["CAMISA (TÓRAX + MANGAS) 10CM", 2.64], ["CALÇA (UMA EM CADA PERNA) 10CM", 1.64],
];
const FAIXA_PLANO = [
  ["SEM FAIXA", 0],
  ["CAMISA (TÓRAX + MANGAS) 5CM", 2.44], ["CALÇA (UMA EM CADA PERNA) 5CM", 1.6],
  ["CAMISA (TÓRAX + MANGAS) 10CM", 3.28], ["CALÇA (UMA EM CADA PERNA) 10CM", 2.06],
];
// Embalagem externa: valor / und por embalagem / fita
const EMB_MALHA = [
  ["CAIXA GRANDE (ACIMA DE 80UN)", 19.05, 140, 0.07],
  ["CAIXA MÉDIA (ATÉ 80UN)",       13.2,  80,  0.07],
  ["PEQUENA (ATÉ 25UN)",           4.5,   40,  0.07],
  ["FARDO (ACIMA 80 UN)",          0.81,  140, 0.03],
  ["ENVELOPE BÁSICO (ATÉ 5UN)",    1.5,   5,   0.0],
  ["ENVELOPE PREMIUM (INDIVIDUAL)",2.8,   1,   0.0],
];
const EMB_PLANO = [
  ["CAIXA GRANDE (ACIMA DE 80UN)", 19.05, 100, 0.07],
  ["CAIXA MÉDIA (ATÉ 80UN)",       13.2,  60,  0.07],
  ["PEQUENA (ATÉ 25UN)",           4.5,   25,  0.07],
  ["FARDO (ACIMA 80UN)",           0.81,  100, 0.03],
  ["ENVELOPE BÁSICO (ATÉ 5UN)",    1.5,   5,   0.0],
  ["ENVELOPE PREMIUM (INDIVIDUAL)",2.8,   1,   0.0],
];
const EMB_INT = [["SIMPLES", 0.04], ["PREMIUM", 0.17]];

// Constantes (levers do cálculo) — editáveis no modo OS
const CONST_MALHA = [
  ["REEMBOLSO_CONSUMO", 0.3,   "Reembolso de consumo (R$/peça)"],
  ["LINHA_CUSTO",       0.5,   "Custo de linha (R$/peça)"],
  ["LOGISTICA_BASE",    1.72,  "Logística base (R$/peça)"],
  ["BOTAO_UNIT",        0.06,  "Custo por botão (R$)"],
];
const CONST_PLANO = [
  ["REEMBOLSO_CONSUMO", 0.3,  "Reembolso de consumo (R$/peça)"],
  ["LOGISTICA_BASE",    1.0,  "Logística base (R$/peça)"],
  ["BOTAO_UNIT",        0.06, "Custo por botão (R$)"],
  ["LINHA_CUSTO",       0.5,  "Custo de linha (R$/peça)"],
  ["FORRO_FATOR",       0.7,  "Consumo do forro = fator × consumo do tecido"],
];
const CONST_COMUM = [
  ["IMPOSTO", 0.0793, "Imposto sobre venda (fração)"],
  ["OP_INVEST_TAXA", 0.03,  "Operação financeira — investimento (a.m.)"],
  ["OP_TITULO_TAXA", 0.058, "Operação financeira — título (a.m.)"],
];

async function up(tipo, grupo, chave, valor, extra, ordem, rotulo) {
  await prisma.fppParam.upsert({
    where: { tipo_grupo_chave: { tipo, grupo, chave } },
    update: {}, // já existe -> não mexe (preserva modo OS)
    create: { tipo, grupo, chave, valor, extra: extra || undefined, ordem, rotulo: rotulo || null, ativo: true },
  });
}

async function main() {
  const existe = await prisma.fppParam.count();
  // limpa constantes de fator que não são mais usadas (bancos já semeados na v32/v33)
  await prisma.fppParam.deleteMany({ where: { tipo: "MALHA", grupo: "CONST", chave: { in: ["LINHA_FATOR_GOLA", "LINHA_FATOR_PUNHO", "LINHA_MULT"] } } }).catch(() => {});
  let o = 0;
  for (const [n, rend, corte, exped, vol] of PECAS_MALHA) await up("MALHA", "PECA", n, rend, { corte, exped, volProp: vol }, o++);
  o = 0;
  for (const [n, cons, corte, acab, vol] of PECAS_PLANO) await up("PLANO", "PECA", n, cons, { corte, acab, volProp: vol }, o++);
  o = 0; for (const [n, v] of GOLA_MALHA)     await up("MALHA", "GOLA", n, v, null, o++);
  o = 0; for (const [n, v] of PUNHO_MALHA)    await up("MALHA", "PUNHO", n, v, null, o++);
  o = 0; for (const [n, v] of ELASTICO_PLANO) await up("PLANO", "ELASTICO", n, v, null, o++);
  o = 0; for (const [n, v] of FAIXA_MALHA)    await up("MALHA", "FAIXA", n, v, null, o++);
  o = 0; for (const [n, v] of FAIXA_PLANO)    await up("PLANO", "FAIXA", n, v, null, o++);
  o = 0; for (const [n, v, und, fita] of EMB_MALHA) await up("MALHA", "EMB_EXT", n, v, { und, fita }, o++);
  o = 0; for (const [n, v, und, fita] of EMB_PLANO) await up("PLANO", "EMB_EXT", n, v, { und, fita }, o++);
  o = 0; for (const [n, v] of EMB_INT)        await up("COMUM", "EMB_INT", n, v, null, o++);
  o = 0; for (const [k, v, r] of CONST_MALHA) await up("MALHA", "CONST", k, v, null, o++, r);
  o = 0; for (const [k, v, r] of CONST_PLANO) await up("PLANO", "CONST", k, v, null, o++, r);
  o = 0; for (const [k, v, r] of CONST_COMUM) await up("COMUM", "CONST", k, v, null, o++, r);
  console.log(`Seed FPP: ok (antes havia ${existe} parâmetros).`);
}

main().catch((e) => console.log("Seed FPP ignorado: " + (e?.message || e))).finally(() => prisma.$disconnect());
