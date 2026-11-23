export const dynamic = "force-dynamic";
// v1043 — sugestão #101: endereço na tarefa — sugestões do Google, lugar escolhido, tempo de deslocamento e endereços particulares
import { usuarioAtivo } from "@/lib/tarefas";
import { autocompletar, lugar, temGoogle } from "@/lib/googleMaps";
import { listarFavoritos, salvarFavorito, excluirFavorito, deslocamento } from "@/lib/tarefaLocal";

const erro = (e, s = 502) => Response.json({ error: e?.message || String(e) }, { status: s });

// GET ?u=&auto=texto&sessao= · ?u=&lugar=placeId&sessao=&digitado= · ?u=&favoritos=1
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const u = await usuarioAtivo(q.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  if (q.get("auto") != null) { try { return Response.json(await autocompletar(q.get("auto"), q.get("sessao"))); } catch (e) { return erro(e); } }
  if (q.get("lugar")) { try { return Response.json(await lugar(q.get("lugar"), q.get("sessao"), q.get("digitado"))); } catch (e) { return erro(e); } }
  return Response.json({ favoritos: await listarFavoritos(u), google: temGoogle() });
}

// POST { usuarioId, acao: "tempo", de: {lat,lng,endereco}, para: {...}, quando: ISO } · { acao: "salvar", endereco: { id?, nome, endereco, lat, lng } } · { acao: "excluir", id }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  try {
    const r = b.acao === "tempo" ? await deslocamento(b.de, b.para, b.quando)
      : b.acao === "salvar" ? await salvarFavorito(u, b.endereco || {})
      : b.acao === "excluir" ? await excluirFavorito(u, b.id)
      : { error: "Ação inválida." };
    return Response.json(r, { status: r.error ? 400 : 200 });
  } catch (e) { return erro(e); }
}
