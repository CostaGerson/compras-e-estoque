export const dynamic = "force-dynamic";
import { usuarioAtivo, detalhe, editar, excluir, play, stop, concluir, reabrir, marcarSubtarefa, encerrarSerie } from "@/lib/tarefas";

export async function GET(req, { params }) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const t = await detalhe(params.id, u);
  return t ? Response.json(t) : Response.json({ error: "Demanda não encontrada ou privada." }, { status: 404 });
}

// PATCH { usuarioId, acao: editar|play|stop|concluir|reabrir|subtarefa|encerrarSerie, ... }
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const id = params.id;
  const r = b.acao === "play" ? await play(id, u)
    : b.acao === "stop" ? await stop(id, u)
    : b.acao === "concluir" ? await concluir(id, b.retorno, u)
    : b.acao === "reabrir" ? await reabrir(id, u)
    : b.acao === "subtarefa" ? await marcarSubtarefa(id, Number(b.indice), b.feita, u)
    : b.acao === "encerrarSerie" ? await encerrarSerie(id, u)
    : b.acao === "votar" ? await (await import("@/lib/decisoes")).votar(id, u, b.opcao)   // v655
    : b.acao === "pauta" ? await (await import("@/lib/decisoes")).adicionarPauta(id, u, b.texto)
    : b.acao === "tirarPauta" ? await (await import("@/lib/decisoes")).tirarPauta(id, u, b.pautaId)
    : b.acao === "ordenarPautas" ? await (await import("@/lib/decisoes")).ordenarPautas(id, u, b.ids)   // v1026
    : b.acao === "rascunhoTarefa" ? await (await import("@/lib/decisoes")).rascunhoTarefa(id, u, b.tarefa)
    : b.acao === "tirarRascunho" ? await (await import("@/lib/decisoes")).tirarRascunho(id, u, b.rascunhoId)
    : b.acao === "efetivarRascunhos" ? await (await import("@/lib/decisoes")).efetivarRascunhos(id, u)
    : b.acao === "colaborar" ? await (await import("@/lib/tarefaColaboracao")).responderColaboracao(id, b.texto, u)   // v992
    : b.acao === "restaurar" ? await (await import("@/lib/tarefas")).restaurar(id, u)   // v566 — lixeira
    : await editar(id, b.tarefa || {}, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}

export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await excluir(params.id, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
