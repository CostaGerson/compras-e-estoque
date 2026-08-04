export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// lista enxuta (sem senha) para escolher destinatário de mensagem
export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, sobrenome: true, setor: true, fotoBase64: true },
    orderBy: { nome: "asc" },
  });
  return Response.json(usuarios);
}
