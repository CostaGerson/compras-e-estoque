export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

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
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await prisma.finArquivo.delete({ where: { id: Number(params.id) } }).catch(() => null);
  return Response.json({ ok: true });
}
