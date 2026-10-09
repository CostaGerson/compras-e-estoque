export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { usuarioMaster, usuarioSoMaster, soMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { analisarAntecipacao, aplicarAntecipacao, listarAntecipacoes, conciliarAntecipacoesPendentes } from "@/lib/finAntecipacao";

// GET ?u= → contratos de desconto importados
export async function GET(req) {
  const u = await usuarioMaster(new URL(req.url).searchParams.get("u"));
  if (!u) return negado();
  await conciliarAntecipacoesPendentes(nomeU(u)).catch(() => 0);
  return Response.json({ contratos: await listarAntecipacoes() });
}

// POST { usuarioId, acao: "analisar" | "aplicar", arquivo: { nome, conteudo } }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasReceber");
  if (!u) return soMaster();
  if (!b.arquivo?.conteudo) return Response.json({ error: "Envie o PDF do contrato." }, { status: 400 });
  try {
    if (b.acao === "analisar") return Response.json(await analisarAntecipacao(b.arquivo.nome, b.arquivo.conteudo));
    if (b.acao === "aplicar") return Response.json(await aplicarAntecipacao(b.arquivo.nome, b.arquivo.conteudo, { quem: nomeU(u) }));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message || "Erro ao ler o contrato." }, { status: 400 }); }
}
