export const dynamic = "force-dynamic";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, garantirContas } from "@/lib/fin";
import { nomeU, gerarRecorrencias } from "@/lib/finTitulos";
import { lerPosicao, analisarPosicao, importarPosicao } from "@/lib/finPosicao";

// POST { usuarioId, acao: "analisar", conteudo (base64 do .xls/.xlsx) } → linhas com situação e decisão sugerida
// POST { usuarioId, acao: "importar", linhas: [...] }                  → cria / substitui conforme a decisão de cada linha
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasPagar", "contasReceber");
  if (!u) return soMaster();
  try {
    if (b.acao === "analisar") {
      if (!b.conteudo) return Response.json({ error: "Envie a planilha." }, { status: 400 });
      await garantirContas();
      await gerarRecorrencias();   // as previsões das recorrências precisam existir para a checagem de duplicidade
      const linhas = lerPosicao(Buffer.from(String(b.conteudo), "base64"));
      if (!linhas.length) return Response.json({ error: "Nenhum título em aberto encontrado na planilha." }, { status: 400 });
      return Response.json(await analisarPosicao(linhas));
    }
    if (b.acao === "importar") {
      if (!Array.isArray(b.linhas) || !b.linhas.length) return Response.json({ error: "Nada para importar." }, { status: 400 });
      const r = await importarPosicao(b.linhas, { quem: nomeU(u), usuarioId: u.id });
      if (r.error) return Response.json(r, { status: 400 });
      return Response.json(r);
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao ler a planilha." }, { status: 400 });
  }
}
