export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const up = (v) => (v ? String(v).toUpperCase().trim() : null);

// POST { usuarioId, grupo, descricao, valor, exigivel?, parcelado?, parcelaMensal? }
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();
  const valor = dec(b.valor);
  if (!up(b.descricao) || valor === null) return Response.json({ error: "Informe descrição e valor." }, { status: 400 });
  const t = await prisma.finTributo.create({
    data: {
      grupo: up(b.grupo) || "OUTRO", descricao: up(b.descricao), valor,
      exigivel: b.exigivel !== false, parcelado: !!b.parcelado,
      parcelaMensal: dec(b.parcelaMensal), observacao: up(b.observacao),
    },
  });
  return Response.json({ ok: true, tributo: t });
}

// PUT { usuarioId, id, campo, valor }
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();
  const campos = ["grupo", "descricao", "valor", "exigivel", "parcelado", "parcelaMensal", "observacao"];
  if (!campos.includes(b.campo)) return Response.json({ error: "Campo inválido." }, { status: 400 });
  const d = {};
  if (["valor", "parcelaMensal"].includes(b.campo)) d[b.campo] = dec(b.valor);
  else if (["exigivel", "parcelado"].includes(b.campo)) d[b.campo] = !!b.valor;
  else d[b.campo] = up(b.valor);
  const t = await prisma.finTributo.update({ where: { id: Number(b.id) }, data: d }).catch(() => null);
  if (!t) return Response.json({ error: "Tributo não encontrado." }, { status: 404 });
  return Response.json({ ok: true, tributo: t });
}

// DELETE ?u=&id=
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await prisma.finTributo.delete({ where: { id: Number(sp.get("id")) } }).catch(() => null);
  return Response.json({ ok: true });
}
