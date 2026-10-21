export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// v382 — Previsto × realizado
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { listar, abrir, analisar, justificar } from "@/lib/finPrevReal";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u= → lista · ?u=&competencia=&salvoEm= → um painel
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  if (q.get("competencia") && q.get("salvoEm")) {
    const r = await abrir(q.get("competencia"), q.get("salvoEm"));
    return r ? Response.json(r) : Response.json({ error: "Painel não encontrado." }, { status: 404 });
  }
  return Response.json({ paineis: await listar() });
}

// POST { usuarioId, acao: "analisar" | "justificar", competencia, salvoEm, k?, texto? }
export async function POST(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId); if (!u) return negadoGerencial();
  try {
    if (b.acao === "analisar") return Response.json(await analisar(b.competencia, b.salvoEm, quemE(u)));
    if (b.acao === "justificar") return Response.json(await justificar(b.competencia, b.salvoEm, b.k, b.texto));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
