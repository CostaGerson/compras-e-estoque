export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { estadoWhats, conectarWhats, desconectarWhats, filaWhats, enviarWhats, ignorarWhats, mensagem } from "@/lib/finWhats";

// v1031 — comprovantes pelo WhatsApp da empresa
// GET ?u=&estado=1          → conexão do WhatsApp da empresa
// GET ?u=[&dias=][&todos=1] → fila de comprovantes a enviar (+ estado)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioMaster(sp.get("u"));
  if (!u) return negado();
  try {
    if (sp.get("estado")) return Response.json(await estadoWhats());
    const [estado, itens] = await Promise.all([estadoWhats(), filaWhats({ dias: sp.get("dias"), todos: sp.get("todos") === "1" })]);
    return Response.json({ estado, itens: itens.map((i) => ({ ...i, mensagem: mensagem(i) })) });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}

// POST { usuarioId, acao: "conectar" | "desconectar" | "enviar" (id, fone, salvar) | "ignorar" (id, voltar) }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  try {
    if (b.acao === "conectar") return Response.json(await conectarWhats());
    if (b.acao === "desconectar") return Response.json(await desconectarWhats());
    if (b.acao === "enviar") return Response.json(await enviarWhats(b.id, { fone: b.fone, salvar: b.salvar !== false }));
    if (b.acao === "ignorar") return Response.json(await ignorarWhats(b.id, !!b.voltar));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
