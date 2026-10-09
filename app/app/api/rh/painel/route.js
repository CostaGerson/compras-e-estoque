export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { usuarioRH, negadoRH } from "@/lib/rh";
import { painelRH, salvarMedalhas } from "@/lib/rhPainel";

// GET ?u=&comp=AAAA-MM → indicadores de ponto, gráficos, ranking, carômetro, alertas e freelancer × folha
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioRH(sp.get("u"));
  if (!u) return negadoRH();
  try { return Response.json(await painelRH(sp.get("comp"))); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

// POST { usuarioId, acao: "medalhas", lista: [{ anos, nome, cor, premio }] }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRH(b.usuarioId);
  if (!u) return negadoRH();
  if (b.acao === "medalhas") return Response.json({ medalhas: await salvarMedalhas(b.lista) });
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
