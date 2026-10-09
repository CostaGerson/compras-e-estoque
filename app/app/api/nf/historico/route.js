export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { prisma } from "@/lib/prisma";
import { importarHistorico, CORTE_HISTORICO } from "@/lib/nfEntrada";

// POST { usuarioId, arquivos: [{ nome, xml }] } → importa um lote de XMLs do histórico (sem estoque)
// vencimento antes de 01/10/2026 = conta paga; depois = conta em aberto
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = b.usuarioId ? await prisma.usuario.findUnique({ where: { id: Number(b.usuarioId) }, select: { id: true, nome: true, sobrenome: true, ativo: true } }) : null;
  if (!u?.ativo) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  if (!(await usuarioSoMaster(u.id, "nfEntrada"))) return soMaster();   // v170 — por permissão
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  const resultados = [];
  for (const a of (b.arquivos || []).slice(0, 50)) {
    try { resultados.push(await importarHistorico(a.nome, String(a.xml || ""), { quem, quemId: u.id, corte: CORTE_HISTORICO })); }
    catch (e) { resultados.push({ nome: a.nome, situacao: "ERRO", motivo: e.message }); }
  }
  return Response.json({ resultados });
}
