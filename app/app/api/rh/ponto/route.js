export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { usuarioRH, negadoRH } from "@/lib/rh";
import { veRHCompleto } from "@/lib/acesso";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { lerJornadas, salvarJornadas } from "@/lib/rhJornada";
import { analisarArquivos, gravarCartoes, justificar, desfazerJustificativa, listarImportacoes, MOTIVOS, apurarPeriodo } from "@/lib/rhPonto";

// GET ?u=            → cartões importados + motivos de justificativa
// GET ?u=&arquivo=id → o PDF do cartão
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioRH(sp.get("u"));
  if (!u) return negadoRH();
  // v169 — carômetro por período e síntese de um funcionário
  const de = sp.get("de"), ate = sp.get("ate");
  if ((sp.get("acao") === "carometro" || sp.get("acao") === "sintese") && !(/^\d{4}-\d{2}-\d{2}$/.test(de || "") && /^\d{4}-\d{2}-\d{2}$/.test(ate || "")))
    return Response.json({ error: "Período inválido." }, { status: 400 });
  if (sp.get("acao") === "jornadas") {
    const { lerPessoal } = await import("@/lib/rh");
    const { pessoas } = await lerPessoal();
    return Response.json({ jornadas: await lerJornadas(), pessoas: pessoas.filter((p) => p.ativo !== false).map((p) => ({ id: p.id, nome: p.nome })) });
  }
  if (["carometro", "sintese"].includes(sp.get("acao")) && !veRHCompleto(u)) return negadoRH();   // v170 — indicadores de pessoal: RH, master e diretoria
  if (sp.get("acao") === "carometro") return Response.json(await apurarPeriodo(de, ate));
  if (sp.get("acao") === "sintese") return Response.json(await apurarPeriodo(de, ate, String(sp.get("pessoaId") || "")));
  if (sp.get("arquivo")) {
    const x = await prisma.rhPontoImport.findUnique({ where: { id: Number(sp.get("arquivo")) }, select: { arquivo: true, conteudo: true } });
    if (!x) return new Response("Não encontrado.", { status: 404 });
    return new Response(Buffer.from(x.conteudo, "base64"), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(x.arquivo)}"` } });
  }
  return Response.json({ importacoes: await listarImportacoes(), motivos: MOTIVOS });
}

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo }] }
// POST { usuarioId, acao: "gravar", itens: [{ arquivo, indice, pessoaId }], arquivos }
// POST { usuarioId, acao: "justificar", chaves: ["p3|2026-05-05"], motivo, texto }
// POST { usuarioId, acao: "desfazer", chave }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  try {
    if (b.acao === "analisar") {
      if (!Array.isArray(b.arquivos) || !b.arquivos.length) return Response.json({ error: "Envie ao menos um cartão de ponto (PDF)." }, { status: 400 });
      return Response.json(await analisarArquivos(b.arquivos));
    }
    if (b.acao === "gravar") return Response.json({ resultados: await gravarCartoes(b.itens || [], b.arquivos || [], u) });
    if (b.acao === "justificar") {
      const r = await justificar(b.chaves, b.motivo, b.texto, u);
      return Response.json(r, { status: r.error ? 400 : 200 });
    }
    if (b.acao === "jornadas") { const r = await salvarJornadas(b.jornadas || {}); return Response.json(r, { status: r.error ? 400 : 200 }); }
    if (b.acao === "desfazer") return Response.json(await desfazerJustificativa(b.chave));
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// DELETE { usuarioId, id } → exclui um cartão importado (só o master, regra v167)
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioSoMaster(b.usuarioId, "docsRH"))) return soMaster();
  await prisma.rhPontoImport.deleteMany({ where: { id: Number(b.id) || 0 } });
  return Response.json({ ok: true });
}
