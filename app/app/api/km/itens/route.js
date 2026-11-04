// v670 — Dados › Itens KM: todos os itens cadastrados no KM (enviados pelo agente do PC da fábrica), só leitura
//   GET → lista (sem o texto do detalhe) · GET ?codigo= → item com o detalhe completo
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const cod = new URL(req.url).searchParams.get("codigo");
  if (cod) {
    const p = await prisma.kmProduto.findUnique({ where: { codigo: cod } });
    return p ? Response.json({ ...p, preco: p.preco != null ? Number(p.preco) : null }) : Response.json({ error: "Item não encontrado." }, { status: 404 });
  }
  const [l, st] = await Promise.all([
    prisma.kmProduto.findMany({ orderBy: { codigo: "asc" }, select: { codigo: true, kmId: true, nome: true, parametros: true, preco: true, usos: true, ncm: true, gtin: true, unidade: true, kmSyncEm: true } }),
    prisma.finConfig.findUnique({ where: { chave: "KM_PRODUTOS_SYNC" } }).catch(() => null),
  ]);
  let sync = null; try { sync = st ? JSON.parse(st.valor) : null; } catch {}
  return Response.json({ sync, itens: l.map((p) => ({ ...p, preco: p.preco != null ? Number(p.preco) : null, parametros: Array.isArray(p.parametros) ? p.parametros : [] })) }, { headers: { "Cache-Control": "no-store" } });
}
