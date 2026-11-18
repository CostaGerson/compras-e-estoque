// v978 — conserta grupos de cores das FPPs contaminados por cópias (clonar dentro da ficha herdava grupoCores/corPrincipal):
//   cada grupo fica com 1 principal (a mais antiga); as demais "principais" e os membros criados bem depois do lote das cores
//   (mais de 30 min) voltam a ser FPPs independentes. Roda uma vez (flag em FinConfig).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "fix_grupos_cores_fpp_v978";
async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  const l = await prisma.fpp.findMany({ select: { id: true, numero: true, createdAt: true, entradas: true }, orderBy: { createdAt: "asc" } });
  const G = new Map();
  for (const f of l) { const g = f.entradas?.grupoCores; if (g) (G.get(g) || G.set(g, []).get(g)).push(f); }
  const soltar = [];
  for (const [, arr] of G) {
    const prins = arr.filter((f) => f.entradas?.corPrincipal);
    const prin = prins[0] || null;
    for (const p of prins.slice(1)) soltar.push(p);
    const filhos = arr.filter((f) => !f.entradas?.corPrincipal);
    if (filhos.length) {
      const t0 = filhos[0].createdAt.getTime();
      for (const f of filhos) if (f.createdAt.getTime() - t0 > 30 * 60e3) soltar.push(f);
    }
    if (!prin && !filhos.length) continue;
  }
  for (const f of soltar) {
    const e = { ...(f.entradas || {}) }; delete e.grupoCores; delete e.corPrincipal;
    await prisma.fpp.update({ where: { id: f.id }, data: { entradas: e } });
  }
  console.log(`[v978] FPPs tiradas de grupos de cores: ${soltar.length}${soltar.length ? " — " + soltar.map((f) => f.numero).join(", ") : ""}`);
  await prisma.finConfig.create({ data: { chave: FLAG, valor: JSON.stringify(soltar.map((f) => f.numero)).slice(0, 5000) } });
}
main().catch((e) => console.error("[v978]", e.message)).finally(() => prisma.$disconnect());
