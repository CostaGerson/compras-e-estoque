// v1034 — conteúdo de importação do pedido (RET TTS/Confecções: até 40% → recolhimento efetivo de 2%)
export const dynamic = "force-dynamic";
import { conteudoImportacaoPedido } from "@/lib/conteudoImportacao";

export async function GET(req) {
  const numero = new URL(req.url).searchParams.get("pedido");
  if (!numero) return Response.json({ error: "Pedido?" }, { status: 400 });
  try { return Response.json(await conteudoImportacaoPedido(numero)); }
  catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }); }
}
