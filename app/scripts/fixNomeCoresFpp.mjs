// v979 — variações de cor salvas com a cor da principal no nome ("… PRETO OFF WHITE"): tira a cor da principal. Roda uma vez.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "fix_nome_cores_fpp_v979";
const corNome = (cor) => { const c0 = String(cor || "").toUpperCase().trim(); if (!c0) return ""; const c = c0.replace(/\(\s*[\dA-Z-]+\s*\)/g, " ").replace(/^([A-Z]{1,3}\s)?[\dA-Z]?\d{2,5}[A-Z]?\b\s*/, "").replace(/\s+/g, " ").trim(); return c || c0; };
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  const l = await prisma.fpp.findMany({ select: { id: true, numero: true, nomeComercial: true, entradas: true } });
  const G = new Map();
  for (const f of l) { const g = f.entradas?.grupoCores; if (g) (G.get(g) || G.set(g, []).get(g)).push(f); }
  const mud = [];
  for (const [, arr] of G) {
    const p = arr.find((f) => f.entradas?.corPrincipal);
    const cp = corNome(p?.entradas?.artigoDet?.cor);
    if (!cp) continue;
    for (const f of arr) {
      if (f === p) continue;
      const cf = corNome(f.entradas?.artigoDet?.cor);
      if (!cf || cf === cp) continue;
      const nome = String(f.nomeComercial || "");
      const re = new RegExp(`\\s+${esc(cp)}\\s+${esc(cf)}$`);
      if (!re.test(nome)) continue;
      const novo = nome.replace(re, ` ${cf}`);
      await prisma.fpp.update({ where: { id: f.id }, data: { nomeComercial: novo, entradas: { ...f.entradas, nomeComercial: novo } } });
      mud.push(f.numero);
    }
  }
  console.log(`[v979] nomes de variações de cor corrigidos: ${mud.length}`);
  await prisma.finConfig.create({ data: { chave: FLAG, valor: JSON.stringify(mud).slice(0, 5000) } });
}
main().catch((e) => console.error("[v979]", e.message)).finally(() => prisma.$disconnect());
