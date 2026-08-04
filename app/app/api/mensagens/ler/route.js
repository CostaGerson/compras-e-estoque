export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// POST /api/mensagens/ler { usuarioId }  -> marca todas recebidas como lidas
export async function POST(req) {
  const b = await req.json();
  const usuarioId = Number(b.usuarioId);
  if (!usuarioId) return Response.json({ ok: false });
  await prisma.mensagem.updateMany({ where: { paraId: usuarioId, lida: false }, data: { lida: true } });
  return Response.json({ ok: true });
}
