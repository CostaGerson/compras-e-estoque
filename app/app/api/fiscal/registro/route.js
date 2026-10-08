export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { registro } from "@/lib/fiscal";

// GET ?u=&de=&ate= → registro geral de NFs (entrada e saída), movimento fiscal + NFs antigas do Compras
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  return Response.json(await registro({ de: sp.get("de"), ate: sp.get("ate") }));
}
