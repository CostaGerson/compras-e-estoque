export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, usuarioSoMaster, soMaster, negado } from "@/lib/fin";

const MIME = {
  PDF: "application/pdf", OFX: "application/x-ofx", XML: "application/xml",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  TXT: "text/plain; charset=utf-8", ZIP: "application/zip",
};

// GET ?u= → abre/baixa o arquivo
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const d = await prisma.finContabDoc.findUnique({
    where: { id: Number(params.id) },
    select: { nome: true, conteudo: true, formato: true },
  });
  if (!d) return new Response("Arquivo não encontrado", { status: 404 });
  const inline = d.formato === "PDF";
  return new Response(Buffer.from(d.conteudo, "base64"), {
    headers: {
      "Content-Type": MIME[d.formato] || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(d.nome)}`,
    },
  });
}

// DELETE ?u=
export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioSoMaster(sp.get("u")))) return soMaster();
  const id = Number(params.id);
  await prisma.finNfSaida.deleteMany({ where: { docId: id } }).catch(() => null);
  await prisma.finContabDoc.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
