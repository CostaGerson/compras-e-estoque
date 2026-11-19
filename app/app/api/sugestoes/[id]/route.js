export const dynamic = "force-dynamic";
import { usuarioAtivo, decidir, aprofundar, responderAutor } from "@/lib/sugestoes";
import { ehMaster } from "@/lib/acesso";

// PATCH { usuarioId, acao: ANALISE | ACATAR | RECUSAR | REABRIR, resposta } → só o master
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  // v1006 — o autor responde às perguntas do master
  if (u && b.acao === "RESPONDER") { const r = await responderAutor(params.id, b.texto, u); return Response.json(r, { status: r.error ? 400 : 200 }); }
  if (u && ehMaster(u) && b.acao === "APROFUNDAR") { const r = await aprofundar(params.id, b.texto, u); return Response.json(r, { status: r.error ? 400 : 200 }); }
  if (!u || !ehMaster(u)) return Response.json({ error: "Só o master julga as sugestões." }, { status: 403 });
  const r = await decidir(params.id, b.acao, b.resposta, u);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
