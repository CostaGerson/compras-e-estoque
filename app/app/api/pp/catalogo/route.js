// v595 — lançamento de pedido: itens cadastrados no KM (?q=) e FPPs para indexar (?fpp=texto&cliente=nome)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP } from "@/lib/pp";
import { catalogoItens, buscarFpps } from "@/lib/pedidoEfetivar";
import { resumoFpp } from "@/lib/pedidoLanc";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  // v668 — busca de item do KM (código/descrição) também para o cadastro de itens padrão: basta usuário ativo
  if (sp.has("q") && !sp.get("fppId") && !sp.has("fpp") && sp.get("status") !== "1") {
    const { usuarioAtivoFin } = await import("@/lib/fin");
    const id = req.headers.get("x-usuario-id") || sp.get("_u");
    const ok = usuarioAtivoFin ? await usuarioAtivoFin(id) : await usuarioPP(req, "ve");
    if (!ok) return negadoPP();
    return Response.json(await catalogoItens(sp.get("q")));
  }
  if (!(await usuarioPP(req, "ve"))) return negadoPP();
  if (sp.get("fppId")) {   // v806 — com os arquivos de cada estampa (sem o conteúdo)
    const r = resumoFpp(await prisma.fpp.findUnique({ where: { id: Number(sp.get("fppId")) } }));
    if (r && r.aplicacoes?.length) {
      const arqs = await prisma.fppAnexo.findMany({ where: { fppId: r.id, aplicacaoUid: { in: r.aplicacoes.map((a) => a.uid) } }, orderBy: { id: "asc" }, select: { id: true, nome: true, mime: true, aplicacaoUid: true } }).catch(() => []);
      for (const a of r.aplicacoes) a.arquivos = arqs.filter((x) => x.aplicacaoUid === a.uid).map(({ aplicacaoUid, ...x }) => x);
    }
    return Response.json(r);
  }
  if (sp.has("fpp")) return Response.json(await buscarFpps(sp.get("fpp"), sp.get("cliente")));
  if (sp.get("status") === "1") {
    const st = await prisma.finConfig.findUnique({ where: { chave: "KM_PRODUTOS_SYNC" } });
    return Response.json({ produtos: await prisma.kmProduto.count(), ultima: st ? JSON.parse(st.valor) : null });
  }
  return Response.json(await catalogoItens(sp.get("q")));
}
