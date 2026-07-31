export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  const nf = await prisma.notaFiscal.findUnique({
    where: { id: Number(params.id) },
    select: { arquivoXml: true, numero: true },
  });
  if (!nf?.arquivoXml) return new Response("Sem XML para esta NF", { status: 404 });
  return new Response(nf.arquivoXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="NF-${nf.numero}.xml"`,
    },
  });
}
