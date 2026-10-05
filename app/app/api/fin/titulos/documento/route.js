export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU, gerarRecorrencias } from "@/lib/finTitulos";
import { lerDocumento, analisarDocumentos, aplicarDocumentos } from "@/lib/finDocumentos";
import { corrigirMatriz } from "@/lib/finFolhaMatriz";
import { hashB64, jaImportados } from "@/lib/finHash";
import { sincronizarPessoal } from "@/lib/finMatrizRecDb";
import { usuarioRH, notificarQuadro } from "@/lib/rh";
import { lerComprovantes, analisarComprovantes, baixarComprovantes } from "@/lib/finComprovantes";

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
      const docs = [], hashDe = {}, vistos = new Set(), repetidos = [], comps = [];
      for (const a of b.arquivos) {
        const h = hashB64(a.conteudo);
        if (vistos.has(h)) { repetidos.push(a.nome); continue; }   // o mesmo arquivo duas vezes no envio
        vistos.add(h); hashDe[a.nome] = h;
        // relatório de comprovantes do banco (um por página) → baixa das contas
        try { const cs = await lerComprovantes(a.nome, Buffer.from(String(a.conteudo || ""), "base64")); if (cs.length) { comps.push(...cs); continue; } } catch { /* segue como documento */ }
        try { docs.push(await lerDocumento(a.nome, Buffer.from(String(a.conteudo || ""), "base64"))); }
        catch (e) { docs.push({ arquivo: a.nome, tipo: "DESCONHECIDO", erro: e.message || "Não consegui ler o PDF." }); }
      }
      // não reconhecidos viram "outro documento": escolhe-se a conta para anexar
      const itens = docs.length ? await analisarDocumentos(docs) : [];
      const comprovantes = await analisarComprovantes(comps);
      // documento já importado (o mesmo arquivo anexado numa conta ativa) não entra de novo
      const ja = await jaImportados(Object.values(hashDe));
      for (const it of itens) {
        it.hashes = it.arquivos.map((n) => hashDe[n] || null);
        const dup = it.hashes.map((h) => ja[h]).find(Boolean);
        if (dup && it.hashes.every((h) => ja[h])) {
          it.jaImportado = dup;
          it.avisos = [`Este documento já foi importado em ${new Date(dup.em).toLocaleDateString("pt-BR")} na conta "${dup.titulo}" — não será aplicado de novo.`];
        }
      }
      return Response.json({ itens, comprovantes, naoReconhecidos: repetidos.map((n) => ({ nome: n, erro: "arquivo repetido neste envio — ignorado" })) });
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
    // POST { usuarioId, acao: "baixarComprovantes", itens: [...], arquivos } → baixa as contas confirmadas e anexa o comprovante
    if (b.acao === "baixarComprovantes") {
      return Response.json(await baixarComprovantes(b.itens || [], b.arquivos || [], { quem: nomeU(u) }));
    }
    if (b.acao === "aplicar") {
      return Response.json(await aplicarDocumentos(b.itens || [], b.arquivos || [], { quem: nomeU(u), usuarioId: u.id }));
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao importar o documento." }, { status: 400 });
  }
}
