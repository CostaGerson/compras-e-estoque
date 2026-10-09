export const dynamic = "force-dynamic";
import { usuarioMaster, negado, soMaster } from "@/lib/fin";
import { gerencial, tem } from "@/lib/acesso";
import { nomeU, gerarRecorrencias } from "@/lib/finTitulos";
import { lerDocumento, analisarDocumentos, aplicarDocumentos } from "@/lib/finDocumentos";
import { corrigirMatriz } from "@/lib/finFolhaMatriz";
import { hashB64, jaImportados } from "@/lib/finHash";
import { sincronizarPessoal } from "@/lib/finMatrizRecDb";
import { usuarioRH, usuarioDocs, notificarQuadro } from "@/lib/rh";
import { lerComprovantes, analisarComprovantes, baixarComprovantes } from "@/lib/finComprovantes";
import { prisma } from "@/lib/prisma";
import { abrirComSenhas, identificarDocAnalise, sugerirCompetencia, importarArquivoAnalise, hashBuf } from "@/lib/finImportArquivo";

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo (base64) }] } → lançamentos encontrados e a conta de cada um
// POST { usuarioId, acao: "aplicar", itens: [...], arquivos: [{ nome, conteudo }] } → atualiza/cria as contas e anexa os arquivos
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioDocs(b.usuarioId);   // v170 — documentos de RH, contas ou documentos financeiros
  if (!u) return negado();
  try {
    if (b.acao === "analisar") {
      if (!Array.isArray(b.arquivos) || !b.arquivos.length) return Response.json({ error: "Envie ao menos um PDF." }, { status: 400 });
      await gerarRecorrencias("PAGAR");   // a conta do salário do mês precisa existir
      const docs = [], hashDe = {}, vistos = new Set(), repetidos = [], comps = [], analise = [], protegidos = [];
      const master = gerencial(u) || tem(u, "docsFinanceiros");
      for (const a of b.arquivos) {
        const h = hashB64(a.conteudo);
        if (vistos.has(h)) { repetidos.push(a.nome); continue; }   // o mesmo arquivo duas vezes no envio
        vistos.add(h); hashDe[a.nome] = h;
        const buf = Buffer.from(String(a.conteudo || ""), "base64");
        // abre com a senha digitada ou com as cadastradas em Senhas de PDF
        const ab = await abrirComSenhas(buf, a.senha);
        if (!ab.ok && ab.precisaSenha) { protegidos.push({ nome: a.nome, senhaErrada: !!a.senha }); continue; }
        const senha = ab.ok ? ab.senha : null;
        // relatório de comprovantes do banco (um por página) → baixa das contas
        try { const cs = await lerComprovantes(a.nome, buf, senha); if (cs.length) { comps.push(...cs); continue; } } catch { /* segue como documento */ }
        let d;
        try { d = await lerDocumento(a.nome, buf, senha); }
        catch (e) { d = { arquivo: a.nome, tipo: "DESCONHECIDO", erro: e.message || "Não consegui ler o PDF." }; }
        // não é documento de conta: pode ser extrato / fatura / relatório da Análise mensal
        if (d.tipo === "DESCONHECIDO" && master && ab.ok) {
          const t = await identificarDocAnalise(buf, ab.texto);
          if (t) {
            const dup = await prisma.finArquivo.findUnique({ where: { hash: hashBuf(buf) }, select: { id: true, competencia: true } });
            analise.push({ nome: a.nome, tipo: t, competencia: await sugerirCompetencia(t.codigo, buf, senha, ab.texto), senha: senha || null,
              jaEnviado: dup ? dup.competencia : null, arquivoId: dup ? dup.id : null });
            continue;
          }
        }
        docs.push(d);
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
      return Response.json({ itens, comprovantes, analise, protegidos, naoReconhecidos: repetidos.map((n) => ({ nome: n, erro: "arquivo repetido neste envio — ignorado" })) });
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
    // POST { usuarioId, acao: "analise", itens: [{ nome, tipoId, competencia, senha }], arquivos } → grava na Análise mensal
    if (b.acao === "analise") {
      if (!(gerencial(u) || tem(u, "docsFinanceiros"))) return Response.json({ error: "Sem permissão para documentos financeiros da análise mensal." }, { status: 403 });
      const porNome = Object.fromEntries((b.arquivos || []).map((a) => [a.nome, a]));
      const out = [];
      for (const it of b.itens || []) {
        const a = porNome[it.nome];
        if (!a || !/^\d{4}-\d{2}$/.test(it.competencia || "")) { out.push({ nome: it.nome, erro: "arquivo ou mês inválido" }); continue; }
        try { out.push({ nome: it.nome, ...(await importarArquivoAnalise({ u, competencia: it.competencia, tipoId: it.tipoId, nome: a.nome, conteudo: a.conteudo, senha: it.senha })) }); }
        catch (e) { out.push({ nome: it.nome, erro: e.message }); }
      }
      return Response.json({ resultados: out });
    }
    // POST { usuarioId, acao: "salvarSenha", senha, rotulo } → cadastra em Senhas de PDF
    if (b.acao === "salvarSenha") {
      const s2 = String(b.senha || "").trim();
      if (s2 && !(await prisma.finSenhaPdf.findFirst({ where: { senha: s2 } }))) await prisma.finSenhaPdf.create({ data: { rotulo: String(b.rotulo || "IMPORTAR DOCUMENTO").toUpperCase(), senha: s2 } });
      return Response.json({ ok: true });
    }
    if (b.acao === "aplicar") {
      return Response.json(await aplicarDocumentos(b.itens || [], b.arquivos || [], { quem: nomeU(u), usuarioId: u.id }));
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao importar o documento." }, { status: 400 });
  }
}
