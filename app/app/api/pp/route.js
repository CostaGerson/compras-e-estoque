export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP, ppParaUsuario, nomeQuem } from "@/lib/pp";
import { salvarPp } from "@/lib/pedidoEfetivar";   // v595
import { proximoNumero } from "@/lib/pedidoLanc";
import { garantirPpTodos } from "@/lib/pedidos";

export async function GET(req) {
  const u = await usuarioPP(req, "ve");
  if (!u) return negadoPP();
  // v595 — próximo número (prévia; o número é gravado ao efetivar)
  if (new URL(req.url).searchParams.get("proximo") === "1") {
    const [a, b] = await Promise.all([prisma.pp.findMany({ where: { numero: { not: null } }, select: { numero: true } }), prisma.pedidoVenda.findMany({ select: { numero: true } })]);
    return Response.json({ numero: proximoNumero([...a, ...b].map((x) => x.numero)) });
  }
  // v328 — todo pedido do sistema aparece no Lançar PP: cria as cascas que faltam
  try { await garantirPpTodos([u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase()); } catch {}
  // v320 — lista sem o conteúdo dos PDFs (só se existem)
  const pps = await prisma.pp.findMany({
    where: { status: { not: "EXCLUIDO" } },   // v552 — pedido na lixeira
    orderBy: { createdAt: "desc" },
    select: { id: true, numero: true, status: true, clienteNome: true, oc: true, valorTotal: true, origem: true, dtDespacho: true, vendedor: true, createdAt: true, _count: { select: { itens: true } },
      interno: true, efetivadoEm: true, entregaModo: true, anexos: { select: { id: true, nome: true, tipo: true, categoria: true }, orderBy: { id: "asc" } } },   // v595
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

// v595 — salvar (rascunho) pelo editor novo
export async function POST(req) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const b = await req.json();
  try {
    const id = await salvarPp(null, b, nomeQuem(u));
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: "Falha ao salvar: " + (e?.message || String(e)) }, { status: 500 });
  }
}
