export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

// v861 — ação em várias mensagens recebidas: { usuarioId, ids: [], acao: "arquivar" | "desarquivar" | "excluir" | "restaurar" | "lida" }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const usuarioId = Number(b.usuarioId);
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean);
  if (!usuarioId || !ids.length) return Response.json({ error: "Nada selecionado." }, { status: 400 });
  const data = {
    arquivar: { arquivada: true, lida: true },
    desarquivar: { arquivada: false },
    excluir: { excluidaEm: new Date(), lida: true },
    restaurar: { excluidaEm: null },
    lida: { lida: true },
  }[b.acao];
  if (!data) return Response.json({ error: "Ação inválida." }, { status: 400 });
  // aviso do desenvolvedor sem "ciente" não sai da caixa
  const r = await prisma.mensagem.updateMany({ where: { id: { in: ids }, paraId: usuarioId, NOT: { aviso: true, lida: false } }, data });
  return Response.json({ ok: true, n: r.count });
}
