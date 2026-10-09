export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, conciliarCompetencia } from "@/lib/fin";

// GET ?u= → abre o PDF
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const a = await prisma.finArquivo.findUnique({ where: { id: Number(params.id) }, select: { nome: true, conteudo: true } });
  if (!a) return new Response("Arquivo não encontrado", { status: 404 });
  return new Response(Buffer.from(a.conteudo, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"`,
    },
  });
}

// DELETE ?u=
export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioSoMaster(sp.get("u")))) return soMaster();
  const a = await prisma.finArquivo.findUnique({ where: { id: Number(params.id) }, select: { competencia: true } });
  await prisma.finArquivo.delete({ where: { id: Number(params.id) } }).catch(() => null);
  if (a) await conciliarCompetencia(a.competencia).catch(() => null); // desfaz trocas que dependiam deste arquivo
  return Response.json({ ok: true });
}
