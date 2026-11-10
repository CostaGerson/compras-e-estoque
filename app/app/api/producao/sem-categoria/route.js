export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// v741 — itens do PCP sem categoria (sugestão do Igor): a agenda lembra de classificar antes do relatório do mês.
// Só aparece para quem cuida do PCP: master, diretoria e setores PCP / Produção.
import { usuarioAtivoFin } from "@/lib/fin";
import { getPcp, conexao } from "@/lib/cronograma";

const VE = (u) => u && (u.isMaster || u.diretoria || ["PCP", "PRODUCAO"].includes(u.setor));

export async function GET(req) {
  const u = await usuarioAtivoFin(new URL(req.url).searchParams.get("u"));
  if (!VE(u)) return Response.json({ mostrar: false });
  try {
    const j = await getPcp("/api/ext/sem-categoria");
    const { url } = await conexao();
    return Response.json({ mostrar: true, total: Number(j.total) || 0, pecas: Number(j.pecas) || 0, itens: Array.isArray(j.itens) ? j.itens : [], link: url + (j.abrir || "/#reports/corte") });
  } catch (e) { return Response.json({ mostrar: true, erro: e.message || String(e), total: 0, itens: [] }); }
}
