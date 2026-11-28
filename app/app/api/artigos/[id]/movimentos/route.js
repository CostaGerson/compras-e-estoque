export const dynamic = "force-dynamic";
import { movimentosArtigo } from "@/lib/estoqueManual";

// v1199 — sem os lançamentos excluídos; com responsável (nome do usuário), etiqueta e ações (substituir/excluir)
export async function GET(req, { params }) {
  return Response.json(await movimentosArtigo(params.id));
}
