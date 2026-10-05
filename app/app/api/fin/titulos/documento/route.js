export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU, gerarRecorrencias } from "@/lib/finTitulos";
import { lerDocumento, analisarDocumentos, aplicarDocumentos } from "@/lib/finDocumentos";
import { corrigirMatriz } from "@/lib/finFolhaMatriz";
import { sincronizarPessoal } from "@/lib/finMatrizRecDb";
import { usuarioRH, notificarQuadro } from "@/lib/rh";

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo (base64) }] } → lançamentos encontrados e a conta de cada um
// POST { usuarioId, acao: "aplicar", itens: [...], arquivos: [{ nome, conteudo }] } → atualiza/cria as contas e anexa os arquivos
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);   // financeiro e RH
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
      // não reconhecidos viram "outro documento": escolhe-se a conta para anexar
      const itens = await analisarDocumentos(docs);
      return Response.json({ itens, naoReconhecidos: [] });
    }
    // POST { usuarioId, acao: "corrigirMatriz", pessoas: [...], ref } → inclui/nomeia na Matriz oficial e atualiza as contas de pessoal
    if (b.acao === "corrigirMatriz") {
      const r = await corrigirMatriz(b.pessoas || [], { quem: nomeU(u), ref: b.ref });
      if (r.error) return Response.json(r, { status: 400 });
      let contas = null;
      if (r.incluidas || r.nomeadas) {
        contas = await sincronizarPessoal(nomeU(u));
        await notificarQuadro(`RH · Matriz de pessoal atualizada pela folha ${b.ref || ""}: ${r.resumo || ""}. Por ${nomeU(u)}.`, u.id);
      }
      return Response.json({ ...r, contas });
    }
    if (b.acao === "aplicar") {
      return Response.json(await aplicarDocumentos(b.itens || [], b.arquivos || [], { quem: nomeU(u), usuarioId: u.id }));
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao importar o documento." }, { status: 400 });
  }
}
