export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { listarLixeira, restaurar, excluirDefinitivo } from "@/lib/finLixeira";

// GET ?u= → itens da lixeira (os vencidos de 30 dias somem antes)
export async function GET(req) {
  const u = await usuarioMaster(new URL(req.url).searchParams.get("u"));
  if (!u) return negado();
  return Response.json({ itens: await listarLixeira() });
}

// POST { usuarioId, acao: "reativar" | "excluir", ids: [...] }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map(Number).filter(Boolean);
  const r = { feitos: 0, avisos: [], erros: [] };
  for (const id of ids) {
    try {
      if (b.acao === "reativar") { const x = await restaurar(id, nomeU(u)); r.avisos.push(...x.avisos); }
      else if (b.acao === "excluir") await excluirDefinitivo(id);
      else return Response.json({ error: "Ação inválida." }, { status: 400 });
      r.feitos++;
    } catch (e) { r.erros.push(e.message); }
  }
  return Response.json(r);
}
