// v757 — demanda com aprovação (arte finalista): GET ?u= → arquivos da rodada · POST { usuarioId, acao: enviar|aprovar|reprovar, motivo }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivo } from "@/lib/tarefas";
import { arquivosDaRodada, enviarParaAprovacao, decidirAprovacao } from "@/lib/tarefaAprovacao";

const pode = (t, u) => !!t && !!u && (t.responsavelId === u.id || t.criadoPorId === u.id || !!u.isMaster || Number(t.aprovacao?.solicitanteId) === u.id);

export async function GET(req, { params }) {
  const u = await usuarioAtivo(new URL(req.url).searchParams.get("u"));
  const t = await prisma.tarefa.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!t?.aprovacao || !pode(t, u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  return Response.json({ arquivos: await arquivosDaRodada(t), aprovacao: t.aprovacao });
}

export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  const t = await prisma.tarefa.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!t?.aprovacao || !pode(t, u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  let r;
  if (b.acao === "enviar") r = await enviarParaAprovacao(t, u);
  else if (b.acao === "aprovar") r = await decidirAprovacao(t, u, true);
  else if (b.acao === "reprovar") r = await decidirAprovacao(t, u, false, b.motivo);
  else r = { error: "Ação?" };
  return Response.json(r, { status: r.error ? 400 : 200 });
}
