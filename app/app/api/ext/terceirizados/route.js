// v725 — leitura externa para o Cronograma PCP: o ERP é o dono do cadastro de terceirizados (costura e personalização).
// Autenticação: X-Api-Key (o mesmo token de /api/ext/compras). ?desde=ISO devolve só quem mudou depois disso.
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { terceirizadosExt } from "@/lib/rotaExt";

export async function GET(req) {
  const u = new URL(req.url);
  const tk = req.headers.get("x-api-key") || u.searchParams.get("token") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  return Response.json(await terceirizadosExt({ desde: u.searchParams.get("desde") }));
}
