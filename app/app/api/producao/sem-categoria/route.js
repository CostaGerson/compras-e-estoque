export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// v741 — itens do PCP sem categoria (sugestão do Igor): a agenda lembra de classificar antes do relatório do mês.
// v742 — só para o Maycon (usuário Diretoria), a pedido dele.
import { usuarioAtivoFin } from "@/lib/fin";
import { getPcp, conexao } from "@/lib/cronograma";

const semAc = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const VE = (u) => u && u.diretoria && semAc(u.nome).split(/\s+/)[0] === "MAYCON";

export async function GET(req) {
  const u = await usuarioAtivoFin(new URL(req.url).searchParams.get("u"));
  if (!VE(u)) return Response.json({ mostrar: false });
  try {
    const j = await getPcp("/api/ext/sem-categoria");
    const { url } = await conexao();
    return Response.json({ mostrar: true, total: Number(j.total) || 0, pecas: Number(j.pecas) || 0, itens: Array.isArray(j.itens) ? j.itens : [], link: url + (j.abrir || "/#reports/corte") });
  } catch (e) { return Response.json({ mostrar: true, erro: e.message || String(e), total: 0, itens: [] }); }
}
