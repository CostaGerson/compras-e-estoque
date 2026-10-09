export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const up = (v) => (v ? String(v).toUpperCase().trim() : null);

// POST { usuarioId, banco, produto, limite, taxaMensal?, utilizado? } → novo limite
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioGerencial(b?.usuarioId))) return negadoGerencial();
  const banco = up(b.banco), produto = up(b.produto);
  if (!banco || !produto) return Response.json({ error: "Informe banco e produto." }, { status: 400 });
  const limite = dec(b.limite);
  if (limite === null) return Response.json({ error: "Informe o limite." }, { status: 400 });
  const ult = await prisma.finLimiteCredito.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
  const l = await prisma.finLimiteCredito.upsert({
    where: { banco_produto: { banco, produto } },
    create: { banco, produto, limite, taxaMensal: dec(b.taxaMensal), utilizado: dec(b.utilizado), observacao: up(b.observacao), ordem: (ult?.ordem || 0) + 1 },
    update: { limite, taxaMensal: dec(b.taxaMensal), utilizado: dec(b.utilizado), observacao: up(b.observacao), ativo: true },
  });
  return Response.json({ ok: true, limite: l });
}

// PUT { usuarioId, id, campo, valor } → edita uma célula
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioGerencial(b?.usuarioId))) return negadoGerencial();
  const campos = ["banco", "produto", "limite", "taxaMensal", "utilizado", "observacao"];
  if (!campos.includes(b.campo)) return Response.json({ error: "Campo inválido." }, { status: 400 });
  const d = {};
  if (["limite", "taxaMensal", "utilizado"].includes(b.campo)) d[b.campo] = dec(b.valor);
  else d[b.campo] = up(b.valor);
  const l = await prisma.finLimiteCredito.update({ where: { id: Number(b.id) }, data: d }).catch(() => null);
  if (!l) return Response.json({ error: "Limite não encontrado." }, { status: 404 });
  return Response.json({ ok: true, limite: l });
}

// DELETE ?u=&id=
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  await prisma.finLimiteCredito.delete({ where: { id: Number(sp.get("id")) } }).catch(() => null);
  return Response.json({ ok: true });
}
