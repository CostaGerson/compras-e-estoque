// v406 — leitura externa para o PCP (sistema do Maycon): itens de pedido liberados por compras para programar.
// Autenticação: cabeçalho X-Api-Key (token em Compras › Levantamento › Integração PCP). Parâmetros: ?desde=ISO  ?pedido=NUM
export const dynamic = "force-dynamic";
import { tokenExterno, liberadosParaPcp } from "@/lib/compras";

export async function GET(req) {
  const tk = req.headers.get("x-api-key") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  const u = new URL(req.url);
  const pedidos = await liberadosParaPcp({ desde: u.searchParams.get("desde"), pedido: u.searchParams.get("pedido") });
  return Response.json({ geradoEm: new Date().toISOString(), pedidos });
}
