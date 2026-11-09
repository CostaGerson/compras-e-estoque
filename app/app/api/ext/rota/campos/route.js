// v725 — Cronograma PCP: descrição do formulário de demanda de rota (mesmos campos e ordem da tela Logística › Rotas)
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { camposRota } from "@/lib/rotaExt";

export async function GET(req) {
  const tk = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("token") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  return Response.json(await camposRota());
}
