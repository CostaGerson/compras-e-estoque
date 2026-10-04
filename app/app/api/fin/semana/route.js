export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { abrirSemana, salvarItem, excluirItem, garantirSemanas } from "@/lib/finSemana";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u=&titulo=ID → a semana aberta (itens, catálogos e prestadores)
// GET ?u=&competencia=AAAA-MM → garante as contas das sextas do mês
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioMaster(q.get("u")))) return negado();
  const comp = q.get("competencia");
  if (comp) {
    if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
    return Response.json(await garantirSemanas(comp));
  }
  const r = await abrirSemana(q.get("titulo"));
  if (!r.ok) return Response.json({ error: r.erro }, { status: 404 });
  return Response.json(r);
}

// POST { usuarioId, tituloId, item, id? } → lança ou edita uma linha da semana
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await salvarItem(b.tituloId, b.item || {}, { id: b.id, quem: quemE(u) });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, ...(await abrirSemana(b.tituloId)) });
}

// DELETE { usuarioId, id } → apaga uma linha
export async function DELETE(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await excluirItem(b.id);
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, ...(b.tituloId ? await abrirSemana(b.tituloId) : {}) });
}
