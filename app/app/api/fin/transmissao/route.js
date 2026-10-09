export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { classificarTexto, garantirTipos, negado } from "@/lib/fin";
import { usuarioDocs } from "@/lib/rh";
import { abrirComSenhas } from "@/lib/finImportArquivo";
import { identificar } from "@/lib/finTransmissao";

// v171 — Transmissão de arquivos
// POST { usuarioId, acao: "identificar", arquivos: [{ nome, conteudo (base64) }] } → [{ nome, destino, detalhe, competencia, tipoId }]
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioDocs(b.usuarioId);
  if (!u) return negado();
  if (b.acao !== "identificar") return Response.json({ error: "Ação inválida." }, { status: 400 });
  const arquivos = Array.isArray(b.arquivos) ? b.arquivos.filter((a) => a?.nome) : [];
  if (!arquivos.length) return Response.json({ error: "Envie ao menos um arquivo." }, { status: 400 });
  await garantirTipos();
  const tipos = await prisma.finDocTipo.findMany({ select: { id: true, codigo: true, banco: true, documento: true } });
  const porCodigo = Object.fromEntries(tipos.map((t) => [t.codigo, t]));
  const itens = [];
  for (const a of arquivos) {
    try {
      const buf = Buffer.from(String(a.conteudo || ""), "base64");
      let pdf = null, dica = null;
      if (/\.pdf$/i.test(a.nome)) {
        pdf = await abrirComSenhas(buf, a.senha);
        if (pdf.ok) { const cl = classificarTexto(pdf.texto); const t = cl.codigo && porCodigo[cl.codigo]; if (t) dica = `${t.banco} · ${t.documento} → análise mensal`; }
      }
      const it = identificar(a.nome, buf, pdf, dica);
      if (it.codigoTipo) { it.tipoId = porCodigo[it.codigoTipo]?.id || null; delete it.codigoTipo; }
      itens.push(it);
    } catch (e) { itens.push({ nome: a.nome, destino: "DESCONHECIDO", motivo: e.message || "Não consegui ler o arquivo." }); }
  }
  return Response.json({ itens });
}
