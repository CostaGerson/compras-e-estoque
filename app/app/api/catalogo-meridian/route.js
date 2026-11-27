// v1165 — Catálogo Meridian: GET abre o HTML (arquivo do Drive) · GET ?info=1 dados do card · POST { acao: "atualizar" } republica
export const dynamic = "force-dynamic";
import { estadoCatalogo, htmlPublicado, publicarCatalogo } from "@/lib/catalogoMeridian";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  try {
    if (sp.get("info")) return Response.json(await estadoCatalogo());
    const html = await htmlPublicado();
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (e) {
    return new Response(`<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">Não foi possível abrir o Catálogo Meridian: ${String(e.message || e).replace(/</g, "&lt;")}</p>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  try { return Response.json(await publicarCatalogo({ forcar: b.acao === "atualizar" })); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
