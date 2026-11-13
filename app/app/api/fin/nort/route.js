// v808 — guia NORT do contas a pagar e receber: GET ?u=&de=AAAA-MM&ate=AAAA-MM
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { movimentoNort, padronizarNort } from "@/lib/finNort";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await padronizarNort().catch(() => null);
  return Response.json(await movimentoNort({ de: sp.get("de") || null, ate: sp.get("ate") || null }));
}
