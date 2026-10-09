export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { painel, salvarPainel } from "@/lib/finDre";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u=&competencia=AAAA-MM → painel de previsão do mês
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  const comp = q.get("competencia") || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  return Response.json(await painel(comp));
}

// PUT { usuarioId, competencia, dados?, saldoInicial? } → grava os campos manuais
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  const comp = b?.competencia || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const out = await salvarPainel(comp, {
    saldoInicial: b.saldoInicial === undefined ? undefined : (b.saldoInicial === null ? null : Number(b.saldoInicial)),
    dados: b.dados,
    quem: quemE(u),
  });
  return Response.json({ ok: true, ...out });
}
