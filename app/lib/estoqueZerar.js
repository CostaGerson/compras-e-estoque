// v1156 — estoque zerado em 27/11/2026: os artigos (catálogo, NF, FPP) continuam cadastrados, mas o saldo só existe
//   a partir de agora, por NF ou lançamento manual. As entradas manuais já feitas hoje (inventário) são mantidas.
import { prisma } from "@/lib/prisma";
const K = "ESTQ|ZERO|2026-11-27";
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
export async function zerarEstoqueInventario() {
  if (await prisma.finConfig.findUnique({ where: { chave: K } }).catch(() => null)) return null;
  await prisma.finConfig.create({ data: { chave: K, valor: new Date().toISOString() } });
  const desde = new Date("2026-11-27T03:00:00Z");   // 00:00 de 27/11 em Brasília
  const manuais = await prisma.estoqueVolume.groupBy({ by: ["artigoId"], where: { fiscalNotaId: null, origem: { not: null }, createdAt: { gte: desde } }, _sum: { quantidade: true } });
  const manualDe = new Map(manuais.map((m) => [m.artigoId, r3(m._sum.quantidade)]));
  const arts = await prisma.artigo.findMany({ where: { OR: [{ quantidade: { not: 0 } }, { id: { in: [...manualDe.keys()] } }] }, select: { id: true, quantidade: true } });
  let n = 0;
  for (const a of arts) {
    const atual = r3(a.quantidade), novo = manualDe.get(a.id) || 0;
    if (Math.abs(atual - novo) < 0.0005) continue;
    await prisma.estoqueMovimentacao.create({ data: { artigoId: a.id, tipo: "AJUSTE", quantidade: r3(novo - atual),
      observacao: `ESTOQUE ZERADO EM 27/11/2026 (INVENTÁRIO): SALDO ANTERIOR ${atual}${novo ? ` · MANTIDA A ENTRADA MANUAL DE HOJE (${novo})` : ""}` } });
    await prisma.artigo.update({ where: { id: a.id }, data: { quantidade: novo, abaixoMinimoAvisado: false } });
    n++;
  }
  await prisma.estoqueSaldo.updateMany({ data: { saldo: 0 } }).catch(() => null);
  await prisma.finConfig.update({ where: { chave: K }, data: { valor: JSON.stringify({ em: new Date().toISOString(), artigosZerados: n, manuaisMantidos: manualDe.size }) } }).catch(() => null);
  console.log(`[v1156] estoque zerado: ${n} artigo(s); ${manualDe.size} com entrada manual de hoje mantida`);
  return n;
}
