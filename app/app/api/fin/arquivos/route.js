export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, competenciaValida, abrirPdf, classificarTexto, garantirTipos } from "@/lib/fin";
import { importarArquivoAnalise } from "@/lib/finImportArquivo";

// POST { usuarioId, competencia, tipoId ("auto" = classifica pelo texto), nome, conteudo(base64), senha?, salvarSenha?, rotuloSenha? }
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioSoMaster(b?.usuarioId, "docsFinanceiros");
  if (!u) return soMaster();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const auto = b.tipoId === "auto";
  let tipo = null;
  if (!auto) {
    tipo = await prisma.finDocTipo.findUnique({ where: { id: Number(b.tipoId) } });
    if (!tipo) return Response.json({ error: "Documento não encontrado." }, { status: 400 });
  }
  if (!b.conteudo) return Response.json({ error: "Arquivo vazio." }, { status: 400 });

  const buf = Buffer.from(String(b.conteudo), "base64");
  if (buf.slice(0, 5).toString() !== "%PDF-") return Response.json({ error: "Envie um arquivo PDF." }, { status: 400 });

  // duplicidade (mesmo arquivo já enviado)
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const dup = await prisma.finArquivo.findUnique({ where: { hash }, include: { tipo: true } });
  if (dup) {
    return Response.json({
      error: `Este arquivo já foi enviado em ${dup.competencia.split("-").reverse().join("/")} (${dup.tipo.banco} · ${dup.tipo.documento}).`,
    }, { status: 409 });
  }

  // abre o PDF (testa senha informada e/ou senhas salvas)
  const salvas = (await prisma.finSenhaPdf.findMany({ select: { senha: true } })).map((s) => s.senha);
  const tentar = b.senha ? [String(b.senha)] : salvas;
  const r = await abrirPdf(buf, tentar);
  if (!r.ok && r.precisaSenha) {
    return Response.json({ precisaSenha: true, senhaErrada: !!b.senha, error: b.senha ? "Senha incorreta." : "PDF protegido por senha." }, { status: 423 });
  }
  if (!r.ok) return Response.json({ error: "Não consegui abrir o PDF: " + r.erro }, { status: 422 });

  // classificação automática
  if (auto) {
    const cl = classificarTexto(r.texto);
    if (cl.codigo) {
      await garantirTipos();
      tipo = await prisma.finDocTipo.findUnique({ where: { codigo: cl.codigo } });
    }
    if (!tipo) {
      return Response.json({
        naoReconhecido: true,
        error: cl.semTexto ? "PDF sem texto (imagem/impressão) — escolha o documento." : "Documento não reconhecido — escolha o documento.",
      }, { status: 422 });
    }
  }

  if (r.senha && b.senha && b.salvarSenha && !salvas.includes(r.senha)) {
    await prisma.finSenhaPdf.create({ data: { rotulo: String(b.rotuloSenha || `${tipo.banco} · ${tipo.documento}`).toUpperCase(), senha: r.senha } });
  }

  const a = await importarArquivoAnalise({ u, competencia: b.competencia, tipoId: tipo.id, nome: b.nome, conteudo: b.conteudo, senha: r.senha });
  if (a.erro) return Response.json({ error: a.erro }, { status: a.duplicado ? 409 : 400 });
  return Response.json({ ...a, paginas: r.paginas });
}
