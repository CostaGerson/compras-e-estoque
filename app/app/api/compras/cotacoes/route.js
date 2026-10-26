// v478 — Compras › Cotações
export const dynamic = "force-dynamic";
import { criarCotacoes, listarCotacoes, responderCotacao, aplicarCotacao, cancelarCotacao, marcarEnviada, gerarOcDaCotacao, vincularFornecedor } from "@/lib/cotacoes";

export async function GET() { return Response.json(await listarCotacoes()); }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
  switch (b.acao) {
    case "criar": return r(await criarCotacoes(b.grupos, b.pics, b.quem));
    case "responder": return r(await responderCotacao(b));
    case "aplicar": return r(await aplicarCotacao(b.id));
    case "enviada": return r(await marcarEnviada(b.id));   // v479
    case "gerarOc": return r(await gerarOcDaCotacao(b));
    case "vincular": return r(await vincularFornecedor(b.id, b.fornecedorId));   // v491
    case "cancelar": return r(await cancelarCotacao(b.id));
    default: return Response.json({ error: "Ação?" }, { status: 400 });
  }
}
