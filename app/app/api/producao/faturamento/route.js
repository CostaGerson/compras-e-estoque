// v555 — casamento NF de venda ↔ pedido: ?pedido=N (NFs que podem atender) · ?nota=ID (pedidos que a NF pode atender)
// POST { acao: "casar", pedido, fiscalNotaId, quem } · { acao: "descasar", pedido, numero, quem }
export const dynamic = "force-dynamic";
import { nfsParaPedido, candidatosParaNota, casarNf, descasarNf } from "@/lib/faturamentoCasamento";

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (q.get("log") === "v556") { const { prisma } = await import("@/lib/prisma"); const c = await prisma.finConfig.findUnique({ where: { chave: "FAT|REMOVE_AUTO_V556" } }); return Response.json(c ? JSON.parse(c.valor) : { pendente: true }); }   // v556 — o que foi descasado
  const r = q.get("nota") ? await candidatosParaNota(q.get("nota")) : await nfsParaPedido(q.get("pedido"));
  return Response.json(r, { status: r?.error ? 400 : 200 });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = b.acao === "descasar" ? await descasarNf({ pedidoNumero: b.pedido, numero: b.numero, quem: b.quem }) : await casarNf({ pedidoNumero: b.pedido, fiscalNotaId: b.fiscalNotaId, quem: b.quem });
  return Response.json(r, { status: r?.error ? 400 : 200 });
}
