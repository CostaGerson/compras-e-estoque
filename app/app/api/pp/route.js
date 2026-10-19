export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP, ppParaUsuario } from "@/lib/pp";

export async function GET(req) {
  const u = await usuarioPP(req, "ve");
  if (!u) return negadoPP();
  // v320 — lista sem o conteúdo dos PDFs (só se existem)
  const pps = await prisma.pp.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, numero: true, status: true, clienteNome: true, oc: true, valorTotal: true, origem: true, dtDespacho: true, vendedor: true, createdAt: true, _count: { select: { itens: true } } },
  });
  const tem = async (campo) => new Set((await prisma.pp.findMany({ where: { [campo]: { not: null } }, select: { id: true } })).map((x) => x.id));
  const [pv, op, pc, lanc] = await Promise.all([tem("arquivoPedidoPdf"), tem("arquivoOpPdf"), tem("arquivoPcPdf"), tem("arquivoLancPdf")]);
  return Response.json(pps.map((p) => ppParaUsuario({ ...p, temPv: pv.has(p.id), temOp: op.has(p.id), temPc: pc.has(p.id), temLanc: lanc.has(p.id) }, u)));
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
  if (!(await usuarioPP(req))) return negadoPP();
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
        arquivoOpPdf: b.arquivoOpPdf || null,
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
