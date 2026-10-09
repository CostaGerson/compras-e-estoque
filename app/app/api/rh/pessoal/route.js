export const dynamic = "force-dynamic";
import { usuarioRHCompleto, negadoRH, salvarPessoa } from "@/lib/rh";

// POST { usuarioId, acao: EDITAR | ADMITIR | DESLIGAR | REATIVAR, pessoa: {...}, nomeCompleto? }
// grava na Matriz de custos oficial, atualiza as contas de pessoal e avisa financeiro e operação
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioRHCompleto(b.usuarioId);
  if (!u) return negadoRH();
  const r = await salvarPessoa({ acao: b.acao || "EDITAR", pessoa: b.pessoa || {}, nomeCompleto: b.nomeCompleto }, u);
  if (r.error) return Response.json(r, { status: 400 });
  return Response.json(r);
}
