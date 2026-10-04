export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { MATRIZ_SEED } from "@/lib/matrizSeed";
import { ajustarAdiantamento, separarMutuos } from "@/lib/finAjustes";

const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// cria a oficial e o cenário "Simulação" a partir da planilha, na primeira vez
async function garantirMatriz() {
  if (await prisma.finMatriz.count()) return;
  await prisma.finMatriz.create({ data: { nome: "MATRIZ OFICIAL", oficial: true, dados: MATRIZ_SEED.oficial, atualizadoPor: "IMPORTAÇÃO DA PLANILHA" } });
  await prisma.finMatriz.create({ data: { nome: "SIMULAÇÃO (PLANILHA)", oficial: false, dados: MATRIZ_SEED.simulacao, atualizadoPor: "IMPORTAÇÃO DA PLANILHA" } });
}

// GET ?u= → lista (oficial primeiro) — sem os dados
export async function GET(req) {
  if (!(await usuarioMaster(new URL(req.url).searchParams.get("u")))) return negado();
  await garantirMatriz();
  await ajustarAdiantamento().catch(() => null);   // marca os optantes pelo adiantamento (uma vez)
  await separarMutuos().catch(() => null);         // uma linha de mútuo por sócio (uma vez)
  const l = await prisma.finMatriz.findMany({ orderBy: [{ oficial: "desc" }, { createdAt: "asc" }], select: { id: true, nome: true, oficial: true, updatedAt: true, atualizadoPor: true } });
  return Response.json(l);
}

// POST { usuarioId, nome, copiarDe } → novo cenário (cópia de outra matriz)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const base = await prisma.finMatriz.findUnique({ where: { id: Number(b.copiarDe) } });
  if (!base) return Response.json({ error: "Matriz de origem não encontrada." }, { status: 404 });
  const m = await prisma.finMatriz.create({
    data: { nome: String(b.nome || `CENÁRIO ${new Date().toLocaleDateString("pt-BR")}`).toUpperCase(), oficial: false, dados: base.dados, atualizadoPor: nomeU(u) },
  });
  return Response.json({ id: m.id });
}
