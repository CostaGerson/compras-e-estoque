export const dynamic = "force-dynamic";
import { usuarioAtivo, criar, listar, anexo } from "@/lib/sugestoes";

// GET ?u= → master: todas · demais: as suas
// GET ?u=&anexo=ID → o arquivo anexado (v206)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  if (sp.get("anexo")) {
    const a = await anexo(u, sp.get("anexo"));
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    return new Response(Buffer.from(a.conteudo, "base64"), { headers: { "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `${sp.get("baixar") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.nome)}` } });
  }
  return Response.json({ sugestoes: await listar(u) });
}

// POST { usuarioId, texto, tela }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const r = await criar(u, b);
  return Response.json(r, { status: r.error ? 400 : 201 });
}
