export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { usuarioRH, usuarioRHCompleto, negadoRH } from "@/lib/rh";
import { veRHCompleto } from "@/lib/acesso";
import { painelRH, salvarMedalhas } from "@/lib/rhPainel";

// GET ?u=&comp=AAAA-MM → indicadores de ponto, gráficos, ranking, carômetro, alertas e freelancer × folha
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioRH(sp.get("u"));
  if (!u) return negadoRH();
  try {
    const p = await painelRH(sp.get("comp"));
    if (veRHCompleto(u)) return Response.json(p);
    // v170 — só documentos de RH: competências e crítica do ponto, sem indicadores de pessoal
    return Response.json({ competencias: p.competencias, competencia: p.competencia, pendencias: p.pendencias, ranking: [], series: [], porFuncionario: {}, alertas: [], medalhas: p.medalhas, limiteHE: p.limiteHE, deptos: p.deptos, restrito: true });
  }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

// POST { usuarioId, acao: "medalhas", lista: [{ anos, nome, cor, premio }] }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRHCompleto(b.usuarioId);
  if (!u) return negadoRH();
  if (b.acao === "medalhas") return Response.json({ medalhas: await salvarMedalhas(b.lista) });
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
