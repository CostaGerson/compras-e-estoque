export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado, competenciaValida, conciliarCompetencia, forcarVinculo, desfazerVinculo } from "@/lib/fin";

// POST { usuarioId, competencia, acao: "refazer" | "forcar" | "desfazer", chave?, ids? }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const quem = [u.nome, u.sobrenome].join(" ").trim().toUpperCase();
  try {
    if (b.acao === "forcar") return Response.json(await forcarVinculo(b.competencia, b.chave, (b.ids || []).map(Number), quem));
    if (b.acao === "desfazer") { await desfazerVinculo(b.competencia, b.chave); return Response.json({ ok: true }); }
    await conciliarCompetencia(b.competencia);
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
