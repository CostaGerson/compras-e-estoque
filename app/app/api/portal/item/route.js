// v699 — portal: anexos (layout/medidas) de um item padrão do cliente, para conferir antes de pedir
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioPortal, negadoPortal, itensDoCliente } from "@/lib/portalCliente";

export async function GET(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const sp = new URL(req.url).searchParams;
  const id = Number(sp.get("id"));
  if (!(await itensDoCliente(p.cliente.id)).some((i) => i.id === id)) return negadoPortal();
  const anx = sp.get("anexo");
  if (anx) {
    const a = await prisma.itemPadraoAnexo.findFirst({ where: { id: Number(anx), itemId: id } });
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    return new Response(Buffer.from(a.base64, "base64"), { headers: { "Content-Type": a.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
  }
  const it = await prisma.itemPadrao.findUnique({ where: { id }, select: { id: true, nomeInterno: true, nomeNf: true, obs: true, anexos: { select: { id: true, tipo: true, nome: true, mime: true } } } });
  return Response.json(it);
}
