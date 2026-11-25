export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gerencial } from "@/lib/acesso";
import { resumoDesconto, decidirDesconto } from "@/lib/descontoAprov";

// v1122 — aprovação do desconto do pedido pelo financeiro (tarefa "APROVAR DESCONTO")
async function quem(req, id) {
  const uid = Number(req.headers.get("x-usuario-id") || new URL(req.url).searchParams.get("u") || id) || 0;
  const u = uid ? await prisma.usuario.findUnique({ where: { id: uid } }) : null;
  return u?.ativo ? u : null;
}
const podeDecidir = (u) => gerencial(u) || u.setor === "FINANCEIRO";

export async function GET(req, { params }) {
  const u = await quem(req);
  if (!u || !podeDecidir(u)) return Response.json({ error: "Só o financeiro aprova descontos." }, { status: 403 });
  const pp = await prisma.pp.findUnique({ where: { id: Number(params.id) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  return Response.json({ id: pp.id, numero: pp.numero, cliente: pp.clienteNome, vendedor: pp.vendedor, status: pp.status, obs: pp.descontoObs || "",
    aprov: pp.descontoAprov || null, condicao: pp.condicaoPagamento, ...resumoDesconto(pp) });
}
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await quem(req, b.usuarioId);
  if (!u || !podeDecidir(u)) return Response.json({ error: "Só o financeiro aprova descontos." }, { status: 403 });
  const r = await decidirDesconto(Number(params.id), u, b.acao === "aprovar", b.motivo);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
