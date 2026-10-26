// v501 — leitura externa para o Cronograma PCP: cadastro de facções (terceirizados) com nome, documento e id interno.
// Autenticação: cabeçalho X-Api-Key (o mesmo token de /api/ext/compras).
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { listaFaccoes } from "@/lib/faccaoPcp";

export async function GET(req) {
  const tk = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("token") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  return Response.json({ geradoEm: new Date().toISOString(), faccoes: await listaFaccoes() });
}
