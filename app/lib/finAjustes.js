// Ajustes pontuais nos dados que já estão no banco (rodam uma vez só, controlados por FinConfig).
// Servem para mudanças combinadas que não podem vir só pelo seed, porque o banco já existe.
import { prisma } from "@/lib/prisma";

const CHAVE_ADIANT = "AJUSTE_ADIANTAMENTO_40";

// Quem passou a receber adiantamento (40% do líquido no dia 20).
export const OPTANTES_ADIANTAMENTO = [
  "BRENDA", "CINTIA", "DAVID", "DORALICE", "FRANKLIN", "HIGLEY",
  "MARIA CLARA", "RAQUEL", "ROSIANE", "SILVIA", "TADEU",
];

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Marca os optantes em todas as matrizes (oficial e cenários). Roda uma vez.
export async function ajustarAdiantamento() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_ADIANT } }).catch(() => null);
  if (ja) return { ok: true, jaFeito: true };

  const matrizes = await prisma.finMatriz.findMany();
  const alvos = OPTANTES_ADIANTAMENTO.map(semAcento);
  let marcados = 0, naoAchados = [...OPTANTES_ADIANTAMENTO];

  for (const m of matrizes) {
    const dados = { ...(m.dados || {}) };
    if (!Array.isArray(dados.pessoal)) continue;
    dados.pessoal = dados.pessoal.map((p) => {
      const nome = semAcento(p.nome);
      const bate = alvos.find((a) => nome.startsWith(a) || nome.includes(` ${a}`) || nome === a);
      if (!bate) return p;
      const i = naoAchados.findIndex((x) => semAcento(x) === bate);
      if (i >= 0) naoAchados.splice(i, 1);
      if (p.adiantamento) return p;
      marcados++;
      return { ...p, adiantamento: true };
    });
    await prisma.finMatriz.update({ where: { id: m.id }, data: { dados } });
  }

  await prisma.finConfig.upsert({
    where: { chave: CHAVE_ADIANT },
    create: { chave: CHAVE_ADIANT, valor: new Date().toISOString() },
    update: {},
  });
  return { ok: true, marcados, naoAchados };
}
