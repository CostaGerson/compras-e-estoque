// v184 — acesso às rotas do PP (Lançar PP): master, diretoria e Leandro (PCP)
import { usuarioAtivoFin } from "@/lib/fin";
import { lancaPP } from "@/lib/acesso";
export async function usuarioPP(req) {
  const u = await usuarioAtivoFin(req.headers.get("x-usuario-id"));
  return u && lancaPP(u) ? u : null;
}
export const negadoPP = () => Response.json({ error: "Lançar PP: só master, diretoria e o encarregado do PCP." }, { status: 403 });
