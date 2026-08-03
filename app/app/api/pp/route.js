export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const pps = await prisma.pp.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { itens: true } } },
  });
  return Response.json(pps);
}

const dec = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
};
const decPonto = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

export async function POST(req) {
  const b = await req.json();
  const itens = Array.isArray(b.itens) ? b.itens : [];
  try {
    const pp = await prisma.pp.create({
      data: {
        numero: b.numero || null,
        clienteNome: b.clienteNome || null,
        clienteCnpj: b.clienteCnpj || null,
        clienteIe: b.clienteIe || null,
        clienteEndereco: b.clienteEndereco || null,
        clienteContato: b.clienteContato || null,
        oc: b.oc || null,
        condicaoPagamento: b.condicaoPagamento || null,
        prazoEntrega: b.prazoEntrega || null,
        dtDespacho: b.dtDespacho || null,
        tipoPedido: b.tipoPedido || null,
        vendedor: b.vendedor || null,
        obs: b.obs || null,
        valorTotal: decPonto(b.valorTotal),
        arquivoPcPdf: b.arquivoPcPdf || null,
        arquivoLancPdf: b.arquivoLancPdf || null,
        arquivoPedidoPdf: b.arquivoPedidoPdf || null,
        itens: {
          create: itens.map((it) => ({
            tipoPecaNome: it.tipoPecaNome || null,
            codigo: it.codigo || null,
            descricao: it.descricao || null,
            quantidade: decPonto(it.quantidade) ?? 0,
            valorUnitario: decPonto(it.valorUnitario),
            valorTotal: decPonto(it.valorTotal),
            gradeJson: it.gradeJson || null,
            parametrosJson: it.parametrosJson || null,
            fotoBase64: it.fotoBase64 || null,
          })),
        },
      },
    });
    return Response.json({ id: pp.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: "Falha ao salvar PP: " + (e?.message || String(e)) }, { status: 500 });
  }
}
