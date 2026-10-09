export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { sugestoes, baixar, desfazer, marcarVistas } from "@/lib/finBaixas";

// GET ?u=&competencia=  ou  ?u=&arquivoId= → baixas sugeridas
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  const arquivoId = sp.get("arquivoId");
  if (!arquivoId && !competenciaValida(competencia)) return Response.json({ error: "Informe a competência." }, { status: 400 });
  return Response.json({ ok: true, ...(await sugestoes({ competencia, arquivoId })) });
}

// POST { usuarioId, tituloId, lancamentoId } → autoriza a baixa
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  if (b.acao === "vistas") return Response.json({ ok: true, n: await marcarVistas(b.ids) });
  const r = await baixar({ tituloId: b.tituloId, lancamentoId: b.lancamentoId, quem: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json(r);
}

// DELETE ?u=&tituloId= → desfaz a baixa
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const r = await desfazer(sp.get("tituloId"));
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json(r);
}
