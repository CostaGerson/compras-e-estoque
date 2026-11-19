// v747 — Dados › Vendedores (comissionados): GET ?u=&todos=1 · POST { usuarioId, vendedor } · DELETE { usuarioId, id } (inativa)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioAtivoFin } from "@/lib/fin";
import { gerencial, tipoDe, lancaPP } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { usuarioServicoPcp } from "@/lib/servicoPcp";   // v1006
import { listarVendedores, salvarVendedor, FECHAMENTOS, PIX_TIPOS } from "@/lib/comissoes";

const pode = (u) => u && (gerencial(u) || lancaPP(u) || ["FINANCEIRO", "ADMINISTRATIVO", "COMERCIAL"].includes(tipoDe(u)));
const negado = () => Response.json({ error: "Sem permissão para o cadastro de vendedores." }, { status: 403 });
const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const idU = q.get("u") || req.headers.get("x-usuario-id");
  const svc = usuarioServicoPcp(idU);   // v1006 — a ferramenta de serviço do PCP escolhe o vendedor (só os ativos, sem os totais)
  if (svc) return Response.json({ vendedores: (await listarVendedores({ todos: false })).map((v) => Object.fromEntries(Object.entries(v).filter(([k]) => !/pix|cpf|cnpj|doc|banco|agencia|conta|telefone|email|endereco/i.test(k)))), fechamentos: FECHAMENTOS, pixTipos: PIX_TIPOS });
  const u = await usuarioAtivoFin(idU);
  if (!pode(u)) return negado();
  const vendedores = await listarVendedores({ todos: q.get("todos") === "1" });
  const totais = await prisma.vendaComissao.groupBy({ by: ["vendedorId"], _sum: { valor: true }, _count: { _all: true } }).catch(() => []);
  const T = Object.fromEntries(totais.map((t) => [t.vendedorId, { total: Number(t._sum.valor || 0), partes: t._count._all }]));
  return Response.json({ vendedores: vendedores.map((v) => ({ ...v, comissoes: T[v.id] || { total: 0, partes: 0 } })), fechamentos: FECHAMENTOS, pixTipos: PIX_TIPOS });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivoFin(b.usuarioId);
  if (!pode(u)) return negado();
  const r = await salvarVendedor(b.vendedor || {}, quemE(u));
  return Response.json(r, { status: r.error ? 400 : 200 });
}

export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivoFin(b.usuarioId);
  if (!pode(u)) return negado();
  await prisma.vendedor.update({ where: { id: Number(b.id) || 0 }, data: { ativo: false } }).catch(() => null);
  return Response.json({ ok: true });
}
