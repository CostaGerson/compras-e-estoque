export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { listar, atualizar, levarParaMatriz, excluir } from "@/lib/finRecorrentes";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u= → recorrentes com a crítica contra a Matriz
export async function GET(req) {
  if (!(await usuarioMaster(new URL(req.url).searchParams.get("u")))) return negado();
  return Response.json(await listar());
}

// PUT { usuarioId, id, campos, atualizarMatriz? }
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await atualizar(b.id, b.campos || {}, { atualizarMatriz: !!b.atualizarMatriz, quem: quemE(u) });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, ...(await listar()) });
}

// POST { usuarioId, id, acao:"usarMatriz"|"levarParaMatriz" } → resolve a divergência
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const { recorrencias } = await listar();
  const r = recorrencias.find((x) => x.id === Number(b.id));
  if (!r) return Response.json({ error: "Recorrência não encontrada." }, { status: 404 });

  if (b.acao === "usarMatriz") {
    if (r.valorMatriz == null) return Response.json({ error: "Esta conta não vem da Matriz." }, { status: 400 });
    const out = await atualizar(r.id, { valor: r.valorMatriz }, { quem: quemE(u) });
    return Response.json({ ok: true, aplicado: "MATRIZ→CONTA", ...out, ...(await listar()) });
  }
  if (b.acao === "levarParaMatriz") {
    const m = await levarParaMatriz(r.chaveOrigem, r.valor, quemE(u));
    if (!m.ok) return Response.json({ error: m.erro }, { status: 400 });
    return Response.json({ ok: true, aplicado: "CONTA→MATRIZ", matriz: m, ...(await listar()) });
  }
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}

// DELETE { usuarioId, id } → apaga a recorrência e as previsões futuras em aberto
export async function DELETE(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await excluir(b.id, { quem: quemE(u) });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, ...(await listar()) });
}
