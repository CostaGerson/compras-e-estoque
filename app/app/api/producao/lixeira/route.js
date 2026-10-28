// v552 — lixeira de pedidos (Produção): listar, excluir, restaurar
export const dynamic = "force-dynamic";
import { excluirPedido, restaurarPedido, listarExcluidos } from "@/lib/pedidoLixeira";

export async function GET() { return Response.json(await listarExcluidos()); }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = b.acao === "restaurar" ? await restaurarPedido(b.numero, b.quem) : await excluirPedido(b.numero, { motivo: b.motivo, quem: b.quem });
  return Response.json(r, { status: r.error ? 400 : 200 });
}
