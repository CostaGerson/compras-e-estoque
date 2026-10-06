// Nº único das FPPs: 00001, 00002… pela data de criação. As antigas são numeradas uma vez, na ordem em que foram criadas.
import { prisma } from "@/lib/prisma";

export const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "");

let numerando = null;
export async function garantirNumeros() {
  if (numerando) return numerando;
  numerando = (async () => {
    const faltam = await prisma.fpp.findMany({ where: { numero: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
    if (!faltam.length) return 0;
    const max = (await prisma.fpp.aggregate({ _max: { numero: true } }))._max.numero || 0;
    let n = max;
    for (const f of faltam) await prisma.fpp.update({ where: { id: f.id }, data: { numero: ++n } });
    return faltam.length;
  })();
  try { return await numerando; } finally { numerando = null; }
}

// cria a FPP já com o próximo número (tenta de novo se duas forem salvas ao mesmo tempo)
export async function criarComNumero(data) {
  await garantirNumeros();
  for (let i = 0; i < 6; i++) {
    const max = (await prisma.fpp.aggregate({ _max: { numero: true } }))._max.numero || 0;
    try { return await prisma.fpp.create({ data: { ...data, numero: max + 1 } }); }
    catch (e) { if (e?.code !== "P2002") throw e; }
  }
  throw new Error("Não foi possível numerar a FPP. Tente de novo.");
}
