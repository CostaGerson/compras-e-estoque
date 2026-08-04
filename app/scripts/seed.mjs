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
} catch (e) {
  console.log("Seed: ignorado (" + (e?.message || e) + ")");
} finally {
  await prisma.$disconnect();
}
