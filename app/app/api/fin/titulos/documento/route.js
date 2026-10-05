export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU, gerarRecorrencias } from "@/lib/finTitulos";
import { lerDocumento, analisarDocumentos, aplicarDocumentos } from "@/lib/finDocumentos";

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo (base64) }] } → lançamentos encontrados e a conta de cada um
// POST { usuarioId, acao: "aplicar", itens: [...], arquivos: [{ nome, conteudo }] } → atualiza/cria as contas e anexa os arquivos
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  try {
    if (b.acao === "analisar") {
      if (!Array.isArray(b.arquivos) || !b.arquivos.length) return Response.json({ error: "Envie ao menos um PDF." }, { status: 400 });
      await gerarRecorrencias("PAGAR");   // a conta do salário do mês precisa existir
      const docs = [];
      for (const a of b.arquivos) {
        try { docs.push(await lerDocumento(a.nome, Buffer.from(String(a.conteudo || ""), "base64"))); }
        catch (e) { docs.push({ arquivo: a.nome, tipo: "DESCONHECIDO", erro: e.message || "Não consegui ler o PDF." }); }
      }
      const itens = await analisarDocumentos(docs.filter((d) => d.tipo !== "DESCONHECIDO"));
      return Response.json({ itens, naoReconhecidos: docs.filter((d) => d.tipo === "DESCONHECIDO").map((d) => ({ nome: d.arquivo, erro: d.erro })) });
    }
    if (b.acao === "aplicar") {
      return Response.json(await aplicarDocumentos(b.itens || [], b.arquivos || [], { quem: nomeU(u), usuarioId: u.id }));
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao importar o documento." }, { status: 400 });
  }
}
