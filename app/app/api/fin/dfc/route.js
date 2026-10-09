export const dynamic = "force-dynamic";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { dfc } from "@/lib/finDfc";

// GET ?u=&dIni=AAAA-MM-DD&dFim=AAAA-MM-DD&ap=1&ar=0 → DFC do período (ap/ar: incluir atrasados a pagar/receber em hoje)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  const ok = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : null);
  return Response.json(await dfc({ dIni: ok(sp.get("dIni")), dFim: ok(sp.get("dFim")), atrasadosPagar: sp.get("ap") !== "0", atrasadosReceber: sp.get("ar") === "1" }));
}
