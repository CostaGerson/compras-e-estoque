// v986 — faixa refletiva no PLANO estava com consumo 0 (m/peça) em todas as aplicações → a faixa não somava no preço da calça/camisa de plano.
//   Copia o consumo da mesma aplicação da MALHA (o comprimento da faixa na peça é o mesmo), só onde o PLANO está zerado. Uma vez, com histórico.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "AJUSTE|fpp-faixa-plano-consumo-v986";
async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  const malha = await prisma.fppParam.findMany({ where: { tipo: "MALHA", grupo: "FAIXA" } });
  const plano = await prisma.fppParam.findMany({ where: { tipo: "PLANO", grupo: "FAIXA" } });
  const n = (v) => Number(v) || 0;
  const feitos = [];
  for (const p of plano) {
    const m = malha.find((x) => x.chave === p.chave);
    const de = n(p.extra?.consumo), para = n(m?.extra?.consumo);
    if (de > 0 || !(para > 0)) continue;
    await prisma.fppParam.update({ where: { id: p.id }, data: { extra: { ...(p.extra || {}), consumo: para } } });
    await prisma.fppParamHist.create({ data: { paramId: p.id, campo: "consumo", deNum: de, paraNum: para, usuarioNome: "SISTEMA (v986 · igual à malha)" } }).catch(() => {});
    feitos.push(`${p.chave}: ${para}`);
  }
  console.log(`[v986] faixa plano — consumo preenchido: ${feitos.join(" · ") || "nada"}`);
  await prisma.finConfig.create({ data: { chave: FLAG, valor: JSON.stringify(feitos) } });
}
main().catch((e) => console.error("[v986]", e.message)).finally(() => prisma.$disconnect());
