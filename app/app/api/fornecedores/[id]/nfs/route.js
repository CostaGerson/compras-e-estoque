export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(_req, { params }) {
  const fornecedorId = Number(params.id);
  const nfs = await prisma.notaFiscal.findMany({
    where: { fornecedorId },
    orderBy: [{ dataEmissao: "desc" }, { createdAt: "desc" }],
    include: { itens: { include: { artigo: { select: { unidade: true } } } } },
  });

  let totalComprado = 0, totalM = 0, totalKg = 0;
  const linhas = nfs.map((nf) => {
    let metros = 0, kg = 0;
    for (const it of nf.itens) {
      const q = it.quantidade != null ? Number(it.quantidade) : 0;
      const u = it.artigo?.unidade || null;
      if (u === "M") metros += q;
      else if (u === "KG") kg += q;
    }
    const valor = nf.valorTotal != null ? Number(nf.valorTotal) : 0;
    totalComprado += valor; totalM += metros; totalKg += kg;
    return {
      id: nf.id,
      numero: nf.numero,
      dataEmissao: nf.dataEmissao,
      valorTotal: valor,
      metros,
      kg,
      itens: nf.itens.length,
      temPdf: nf.temPdf,
      temXml: nf.temXml,
    };
  });

  return Response.json({ linhas, totalComprado, totalM, totalKg, qtdNfs: nfs.length });
}
