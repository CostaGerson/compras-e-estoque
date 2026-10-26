// v501 — Facções a pagar (PCP): conferência e lançamento manual
export const dynamic = "force-dynamic";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { conferirFaccoes, lancarFaccoes, listaFaccoes } from "@/lib/faccaoPcp";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioSoMaster(sp.get("u"), "contasPagar");
  if (!u) return soMaster();
  if (sp.get("lista")) return Response.json(await listaFaccoes());
  return Response.json(await conferirFaccoes({ desde: sp.get("desde") || null }));
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasPagar");
  if (!u) return soMaster();
  const r = await lancarFaccoes(b.escolhas, nomeU(u));
  return Response.json(r, { status: r.error ? 400 : 200 });
}
