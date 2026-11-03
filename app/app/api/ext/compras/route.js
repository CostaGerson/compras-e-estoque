// v406 — leitura externa para o PCP (sistema do Maycon): itens de pedido liberados por compras para programar.
// Autenticação: cabeçalho X-Api-Key (token em Compras › Levantamento › Integração PCP). Parâmetros: ?desde=ISO  ?pedido=NUM
export const dynamic = "force-dynamic";
import { tokenExterno, liberadosParaPcp, emComprasParaPcp } from "@/lib/compras";

export async function GET(req) {
  const tk = req.headers.get("x-api-key") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  const u = new URL(req.url);
  const pedidos = await liberadosParaPcp({ desde: u.searchParams.get("desde"), pedido: u.searchParams.get("pedido") });
  // v622 — pedidos do sistema ainda em compras (só para conhecimento do PCP; não programar)
  const emCompras = u.searchParams.get("emCompras") === "0" ? [] : await emComprasParaPcp({ pedido: u.searchParams.get("pedido") });
  return Response.json({ versao: 2, geradoEm: new Date().toISOString(), pedidos, emCompras });
}
