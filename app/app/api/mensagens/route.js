export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

const selUser = { id: true, nome: true, sobrenome: true, fotoBase64: true, setor: true };

// GET /api/mensagens?usuarioId=  -> recebidas (não arquivadas), arquivadas, enviadas, naoLidas
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const usuarioId = Number(searchParams.get("usuarioId"));
  if (!usuarioId) return Response.json({ recebidas: [], arquivadas: [], enviadas: [], naoLidas: 0 });
  const [recebidasTodas, enviadas] = await Promise.all([
    prisma.mensagem.findMany({ where: { paraId: usuarioId }, orderBy: { createdAt: "desc" }, take: 200, include: { de: { select: selUser } } }),
    prisma.mensagem.findMany({ where: { deId: usuarioId }, orderBy: { createdAt: "desc" }, take: 2000, include: { para: { select: selUser } } }),
  ]);
  // v568 — aviso do desenvolvedor ainda sem "ciente" fica fixo no topo das recebidas
  const recebidas = recebidasTodas.filter((m) => !m.arquivada).sort((a, b) => (Number(b.aviso && !b.lida) - Number(a.aviso && !a.lida)));
  const arquivadas = recebidasTodas.filter((m) => m.arquivada);
  const naoLidas = recebidas.filter((m) => !m.lida).length;
  return Response.json({ recebidas, arquivadas, enviadas, naoLidas });
}

// POST /api/mensagens  { deId, paraId, texto } · { deId, texto, aviso: true } → aviso do desenvolvedor para todos (só master)
export async function POST(req) {
  const b = await req.json();
  const deId = Number(b.deId), paraId = Number(b.paraId);
  const texto = String(b.texto || "").trim();
  if (b.aviso) {   // v568
    const de = deId ? await prisma.usuario.findUnique({ where: { id: deId }, select: { isMaster: true, ativo: true } }) : null;
    if (!de?.ativo || !de.isMaster) return Response.json({ error: "Só o desenvolvedor (master) envia avisos." }, { status: 403 });
    if (!texto) return Response.json({ error: "Escreva o aviso" }, { status: 400 });
    const todos = await prisma.usuario.findMany({ where: { ativo: true, NOT: { id: deId } }, select: { id: true } });
    const quando = new Date();
    await prisma.mensagem.createMany({ data: todos.map((u) => ({ deId, paraId: u.id, texto, aviso: true, createdAt: quando })) });
    try { const { notificar } = await import("@/lib/push"); for (const u of todos) await notificar(u.id, { titulo: "📢 Aviso do desenvolvedor", texto: texto.slice(0, 180), url: "/", tag: `aviso-${+quando}` }).catch(() => null); } catch {}
    return Response.json({ ok: true, enviados: todos.length }, { status: 201 });
  }
  if (!deId || !paraId) return Response.json({ error: "Remetente e destinatário são obrigatórios" }, { status: 400 });
  if (!texto) return Response.json({ error: "Escreva a mensagem" }, { status: 400 });
  const m = await prisma.mensagem.create({ data: { deId, paraId, texto } });
  return Response.json(m, { status: 201 });
}
