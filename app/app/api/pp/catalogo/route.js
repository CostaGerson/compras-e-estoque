// v595 — lançamento de pedido: itens cadastrados no KM (?q=) e FPPs para indexar (?fpp=texto&cliente=nome)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP } from "@/lib/pp";
import { catalogoItens, buscarFpps } from "@/lib/pedidoEfetivar";
import { resumoFpp } from "@/lib/pedidoLanc";

export async function GET(req) {
  if (!(await usuarioPP(req, "ve"))) return negadoPP();
  const sp = new URL(req.url).searchParams;
  if (sp.get("fppId")) return Response.json(resumoFpp(await prisma.fpp.findUnique({ where: { id: Number(sp.get("fppId")) } })));
  if (sp.has("fpp")) return Response.json(await buscarFpps(sp.get("fpp"), sp.get("cliente")));
  if (sp.get("status") === "1") {
    const st = await prisma.finConfig.findUnique({ where: { chave: "KM_PRODUTOS_SYNC" } });
    return Response.json({ produtos: await prisma.kmProduto.count(), ultima: st ? JSON.parse(st.valor) : null });
  }
  return Response.json(await catalogoItens(sp.get("q")));
}
