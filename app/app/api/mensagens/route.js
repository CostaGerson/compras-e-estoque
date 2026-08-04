export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const selUser = { id: true, nome: true, sobrenome: true, fotoBase64: true, setor: true };

// GET /api/mensagens?usuarioId=  -> caixa de entrada (recebidas) + enviadas
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const usuarioId = Number(searchParams.get("usuarioId"));
  if (!usuarioId) return Response.json({ recebidas: [], enviadas: [], naoLidas: 0 });
  const [recebidas, enviadas] = await Promise.all([
    prisma.mensagem.findMany({ where: { paraId: usuarioId }, orderBy: { createdAt: "desc" }, take: 100, include: { de: { select: selUser } } }),
    prisma.mensagem.findMany({ where: { deId: usuarioId }, orderBy: { createdAt: "desc" }, take: 100, include: { para: { select: selUser } } }),
  ]);
  const naoLidas = recebidas.filter((m) => !m.lida).length;
  return Response.json({ recebidas, enviadas, naoLidas });
}

// POST /api/mensagens  { deId, paraId, texto }
export async function POST(req) {
  const b = await req.json();
  const deId = Number(b.deId), paraId = Number(b.paraId);
  const texto = String(b.texto || "").trim();
  if (!deId || !paraId) return Response.json({ error: "Remetente e destinatário são obrigatórios" }, { status: 400 });
  if (!texto) return Response.json({ error: "Escreva a mensagem" }, { status: 400 });
  const m = await prisma.mensagem.create({ data: { deId, paraId, texto } });
  return Response.json(m, { status: 201 });
}
