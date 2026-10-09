export const dynamic = "force-dynamic";
import { usuarioAtivo, listar, criar, usuariosParaTarefa, statusEquipe, SETORES_TAREFA } from "@/lib/tarefas";

// GET ?u=&de=&ate=&escopo=minhas|criadas|todas&pendentes=1 → demandas visíveis + usuários + status da equipe
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const ok = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : null);
  const [tarefas, usuarios, equipe] = await Promise.all([
    listar(u, { de: ok(sp.get("de")), ate: ok(sp.get("ate")), escopo: sp.get("escopo") || "todas", incluirConcluidas: sp.get("pendentes") !== "1" }),
    usuariosParaTarefa(), statusEquipe(u),
  ]);
  return Response.json({ tarefas, usuarios, equipe, setores: SETORES_TAREFA });
}

// POST { usuarioId, tarefa: { titulo, descricao, setor, responsavelId, prazo, tipo, publica, recorrencia, subtarefas, dependencias } }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await criar(b.tarefa || {}, u);
  return Response.json(r, { status: r.error ? 400 : 201 });
}
