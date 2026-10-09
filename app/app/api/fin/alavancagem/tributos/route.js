export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const int = (v) => { const x = dec(v); return x === null ? null : Math.round(x); };
const data = (v) => { const t = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00.000Z`) : null; };
const up = (v) => (v ? String(v).toUpperCase().trim() : null);

// POST { usuarioId, grupo, descricao, valor, exigivel?, parcelado?, parcelaMensal? }
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioGerencial(b?.usuarioId))) return negadoGerencial();
  const valor = dec(b.valor) ?? 0;   // parcelamento pode nascer sem valor
  if (!up(b.descricao)) return Response.json({ error: "Informe a descrição." }, { status: 400 });
  const t = await prisma.finTributo.create({
    data: {
      grupo: up(b.grupo) || "OUTRO", descricao: up(b.descricao), valor,
      exigivel: b.exigivel !== false, parcelado: !!b.parcelado,
      parcelaMensal: dec(b.parcelaMensal), observacao: up(b.observacao),
      parcelas: int(b.parcelas), parcelasPagas: int(b.parcelasPagas), inicio: data(b.inicio),
    },
  });
  return Response.json({ ok: true, tributo: t });
}

// PUT { usuarioId, id, campo, valor }
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioGerencial(b?.usuarioId))) return negadoGerencial();
  const campos = ["grupo", "descricao", "valor", "exigivel", "parcelado", "parcelaMensal", "observacao", "parcelas", "parcelasPagas", "inicio"];
  if (!campos.includes(b.campo)) return Response.json({ error: "Campo inválido." }, { status: 400 });
  const d = {};
  if (["valor", "parcelaMensal"].includes(b.campo)) d[b.campo] = dec(b.valor);
  else if (["parcelas", "parcelasPagas"].includes(b.campo)) d[b.campo] = int(b.valor);
  else if (b.campo === "inicio") d.inicio = data(b.valor);
  else if (["exigivel", "parcelado"].includes(b.campo)) d[b.campo] = !!b.valor;
  else d[b.campo] = up(b.valor);
  const t = await prisma.finTributo.update({ where: { id: Number(b.id) }, data: d }).catch(() => null);
  if (!t) return Response.json({ error: "Tributo não encontrado." }, { status: 404 });
  return Response.json({ ok: true, tributo: t });
}

// DELETE ?u=&id=
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  await prisma.finTributo.delete({ where: { id: Number(sp.get("id")) } }).catch(() => null);
  return Response.json({ ok: true });
}
