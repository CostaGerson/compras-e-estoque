export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { montarMatrizRec, aplicarMatrizRec } from "@/lib/finMatrizRecDb";

// GET ?u= → propostas (novas, já criadas, com valor mudado) + obsoletas
export async function GET(req) {
  if (!(await usuarioMaster(new URL(req.url).searchParams.get("u")))) return negado();
  const r = await montarMatrizRec();
  return Response.json(r, { status: r.error ? 400 : 200 });
}

// POST { usuarioId, chaves, atualizar, encerrar, inicio }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const r = await aplicarMatrizRec({ quem: nomeU(u), chaves: b.chaves || [], atualizar: b.atualizar || [], encerrar: b.encerrar || [], inicio: b.inicio });
  return Response.json(r, { status: r.error ? 400 : 200 });
}
