export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { listarPendentes, buscarContas, confirmarPendente, rejeitarPendente, chaveAtalho } from "@/lib/finComprovanteCel";

// v1027 — comprovantes do celular
// GET ?u=                 → pendentes de confirmação
// GET ?u=&id=&arquivo=1   → o arquivo (ver o comprovante)
// GET ?u=&busca=          → contas a pagar para escolher (nome, título ou valor)
// GET ?u=&chave=1         → chave do atalho do usuário
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioMaster(sp.get("u"));
  if (!u) return negado();
  try {
    if (sp.get("arquivo")) {
      const p = await prisma.finComprovanteEnvio.findUnique({ where: { id: Number(sp.get("id")) }, select: { nome: true, mime: true, conteudo: true } });
      if (!p?.conteudo) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
      const ext = p.mime === "application/pdf" ? "pdf" : "jpg";
      return new Response(Buffer.from(p.conteudo, "base64"), { headers: { "content-type": p.mime, "content-disposition": `inline; filename="comprovante.${ext}"` } });
    }
    if (sp.get("busca") != null) return Response.json({ contas: await buscarContas(sp.get("busca")) });
    if (sp.get("chave")) return Response.json({ chave: await chaveAtalho(u.id) });
    return Response.json({ pendentes: await listarPendentes() });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}

// POST { usuarioId, acao: "confirmar", id, tituloId, data, valor } | { acao: "rejeitar", id } | { acao: "novaChave" }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  try {
    if (b.acao === "confirmar") return Response.json(await confirmarPendente(b.id, b, u));
    if (b.acao === "rejeitar") return Response.json(await rejeitarPendente(b.id));
    if (b.acao === "novaChave") return Response.json({ chave: await chaveAtalho(u.id, true) });
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
