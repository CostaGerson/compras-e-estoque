export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  const nf = await prisma.notaFiscal.findUnique({
    where: { id: Number(params.id) },
    select: { arquivoPdf: true, numero: true },
  });
  if (!nf?.arquivoPdf) return new Response("Sem PDF para esta NF", { status: 404 });
  const buf = Buffer.from(nf.arquivoPdf, "base64");
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="NF-${nf.numero}.pdf"`,
    },
  });
}
