export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { analisarVencidos, aplicarVencidos } from "@/lib/finAntecipacao";

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  const b64 = String(b?.conteudo || "").replace(/^data:[^,]+,/, "");
  if (!b64) return Response.json({ error: "Envie o relatório." }, { status: 400 });
  try {
    if (b.acao === "aplicar") return Response.json({ ok: true, ...(await aplicarVencidos(b64, { ids: b.ids, quem })) });
    return Response.json({ ok: true, ...(await analisarVencidos(b64)) });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
