export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { dreAno } from "@/lib/finDreAno";

// GET ?u=&ano=2026 → DRE do ano até o momento + evolução da dívida
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioMaster(q.get("u")))) return negado();
  const ano = Number(q.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return Response.json({ error: "Ano inválido." }, { status: 400 });
  return Response.json(await dreAno(ano));
}
