// Garante que sempre exista um usuário master para conseguir entrar no sistema.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

try {
  const master = await prisma.usuario.findFirst({ where: { isMaster: true } });
  if (!master) {
    await prisma.usuario.upsert({
      where: { login: "igor" },
      update: { isMaster: true, ativo: true },
      create: {
        nome: "IGOR", sobrenome: "", email: "", login: "igor", senha: "meridian",
        setor: "FINANCEIRO", isMaster: true, ativo: true,
        permLancaPedidos: true, permLancaContas: true, permAlteraStatus: true, permVeValores: true,
      },
    });
    console.log("Seed: master 'igor' criado (senha: meridian).");
  } else {
    console.log("Seed: master já existe, nada a fazer.");
  }
  // RH: lorraine / rh123 (só cria se não existir)
  const rh = await prisma.usuario.findUnique({ where: { login: "lorraine" } });
  if (!rh) {
    await prisma.usuario.create({ data: { nome: "LORRAINE", sobrenome: "(RH)", email: "", login: "lorraine", senha: "rh123", setor: "RH", ativo: true } });
    console.log("Seed: usuária 'lorraine' (RH) criada.");
  }
} catch (e) {
  console.log("Seed: ignorado (" + (e?.message || e) + ")");
} finally {
  await prisma.$disconnect();
}
