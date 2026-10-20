export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { painel, salvarPainel, atualizarPainel, painelSalvo, excluirSalvo, previstoRealizado, mesSeguinte } from "@/lib/finPainel";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const mesAnt = (c) => { const d = new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 2, 1)); return d.toISOString().slice(0, 7); };

// GET ?u=&competencia=AAAA-MM                 → painel (previsão do mês seguinte)
//     &acao=salvo&idx=N                        → um painel salvo (retrato)
//     &acao=comparar                           → previsto × realizado do painel ANTERIOR (o que previu o mês corrente do painel)
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  const comp = q.get("competencia") || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  if (q.get("acao") === "salvo") {
    const s = await painelSalvo(comp, Number(q.get("idx") ?? -1));
    return s ? Response.json(s) : Response.json({ error: "Painel salvo não encontrado." }, { status: 404 });
  }
  if (q.get("acao") === "comparar") {
    const r = await previstoRealizado(mesAnt(comp));
    return r ? Response.json(r) : Response.json({ error: "O painel do mês anterior não foi salvo." }, { status: 404 });
  }
  return Response.json(await painel(comp));
}

// DELETE ?u=&competencia=&idx=&em= → exclui um painel salvo
export async function DELETE(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  const comp = q.get("competencia") || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const ok = await excluirSalvo(comp, Number(q.get("idx")), q.get("em") || null);
  return ok ? Response.json({ ok: true, ...(await painel(comp)) }) : Response.json({ error: "Painel salvo não encontrado (recarregue a página)." }, { status: 404 });
}

// PUT { usuarioId, competencia, dados?, saldoInicial?, retrato? } → grava os campos (retrato = guarda o painel datado)
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  const comp = b?.competencia || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  if (b.acao === "atualizar") {
    try { return Response.json({ ok: true, ...(await atualizarPainel(comp, quemE(u))) }); }
    catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
  }
  const out = await salvarPainel(comp, {
    saldoInicial: b.saldoInicial === undefined ? undefined : (b.saldoInicial === null ? null : Number(b.saldoInicial)),
    dados: b.dados, quem: quemE(u), retrato: !!b.retrato,
  });
  return Response.json({ ok: true, ...out });
}
