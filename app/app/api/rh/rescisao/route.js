export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioRHCompleto, negadoRH } from "@/lib/rh";
import { analisarTrct, aplicarTrct } from "@/lib/rhRescisao";

// v204 — Rescisão pelo TRCT
// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo }] }                     → leitura + funcionário + data limite
// POST { usuarioId, acao: "aplicar", arquivo: { nome, conteudo }, pessoaId, vencimento, valor } → conta a pagar + desligamento + documento
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRHCompleto(b.usuarioId);
  if (!u) return negadoRH();
  try {
    if (b.acao === "analisar") return Response.json(await analisarTrct(b.arquivos));
    if (b.acao === "aplicar") {
      const r = await aplicarTrct(b, u);
      return Response.json(r, { status: r.error ? 400 : 200 });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message || "Erro ao ler o TRCT." }, { status: 400 }); }
}
