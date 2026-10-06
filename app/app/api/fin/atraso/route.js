export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { visaoAtraso, moverParaExecucao, reconhecerPerda, voltarParaCobranca, receberNaExecucao } from "@/lib/finAtraso";

// GET ?u= → atrasadas (em cobrança), execuções e perdas
export async function GET(req) {
  const u = await usuarioMaster(new URL(req.url).searchParams.get("u"));
  if (!u) return negado();
  return Response.json(await visaoAtraso());
}

// POST { usuarioId, acao, ... }
//   execucao: { ids, execucaoId? , nova? }   perda: { ids, justificativa, data? }
//   voltar: { id }                           receber: { id, data?, valor? }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const quem = nomeU(u);
  try {
    if (b.acao === "execucao") return Response.json(await moverParaExecucao(b.ids || [], { execucaoId: b.execucaoId, nova: b.nova }, quem));
    if (b.acao === "perda") return Response.json(await reconhecerPerda(b.ids || [], { justificativa: b.justificativa, data: b.data }, quem));
    if (b.acao === "voltar") return Response.json(await voltarParaCobranca(b.id, quem));
    if (b.acao === "receber") return Response.json(await receberNaExecucao(b.id, { data: b.data, valor: b.valor }, quem));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro." }, { status: 400 });
  }
}
