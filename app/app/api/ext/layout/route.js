// v753 — Cronograma PCP: foto (layout) e imagens anexadas de um item do pedido, para a
// "Ficha do produto" e o romaneio do PCP. GET ?pedido=26115009&chave=JT.02.001.0001
// Devolve { ok, fotos: [{ nome, src }] } — src é data URL, pronta para <img>.
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { tokenExterno, itensDoPedido } from "@/lib/compras";

const autorizado = async (req) => { const tk = req.headers.get("x-api-key") || ""; return !!tk && tk === (await tokenExterno()); };
const ehImg = (m, n) => /^image\//i.test(m || "") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(n || "") || /^data:image\//i.test(String(n || ""));
const comoSrc = (b64, mime) => {
  const s = String(b64 || "");
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  return `data:${mime || "image/jpeg"};base64,${s}`;
};

export async function GET(req) {
  if (!(await autorizado(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const u = new URL(req.url);
  const pedido = String(u.searchParams.get("pedido") || "").trim();
  const chave = String(u.searchParams.get("chave") || "").trim();
  if (!pedido || !chave) return Response.json({ ok: false, error: "Informe pedido e chave." }, { status: 400 });
  try {
    // posição do item no pedido: a mesma usada na lista de liberados (chave = código, ou código#2…)
    const pv = await prisma.pedidoVenda.findFirst({ where: { numero: pedido } });
    let idx = -1;
    if (pv) idx = itensDoPedido(pv).findIndex((x) => x.chave === chave);
    if (idx < 0) { const m = chave.match(/^ITEM(\d+)$/); if (m) idx = Number(m[1]) - 1; }
    const pp = await prisma.pp.findFirst({ where: { numero: pedido }, include: { itens: { orderBy: { id: "asc" }, select: { id: true, codigo: true, fotoBase64: true, anexosJson: true } } } });
    if (!pp) return Response.json({ ok: true, fotos: [] });
    let it = idx >= 0 ? pp.itens[idx] : null;
    const cod = chave.split("#")[0];
    if (!it || (it.codigo && cod && !cod.startsWith("ITEM") && it.codigo !== cod)) it = pp.itens.find((x) => x.codigo === cod) || it;
    if (!it) return Response.json({ ok: true, fotos: [] });
    const fotos = [];
    if (it.fotoBase64) fotos.push({ nome: "Layout", src: comoSrc(it.fotoBase64) });
    for (const a of Array.isArray(it.anexosJson) ? it.anexosJson : []) {
      if (!ehImg(a.mime, a.nome) && !String(a.base64 || "").startsWith("data:image/")) continue;
      fotos.push({ nome: a.nome || "Anexo", src: comoSrc(a.base64, a.mime) });
    }
    return Response.json({ ok: true, fotos });
  } catch (e) {
    console.log("ext/layout:", e.message);
    return Response.json({ ok: false, error: "Não consegui ler o layout." }, { status: 500 });
  }
}
