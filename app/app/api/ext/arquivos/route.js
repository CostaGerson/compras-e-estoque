// v775 — sugestão #59: arquivos de cada item do pedido para o sistema do PCP (tela de personalização do pedido)
//   GET ?pedido=26115011&item=1                     → JSON { layout: {nome,mime,url}|null, personalizacao: [{nome,mime,url}] }
//   GET ?pedido=26115011&item=1&arquivo=layout      → o arquivo do layout
//   GET ?pedido=26115011&item=1&arquivo=2           → o 2º arquivo de detalhes de personalização
// Autenticação: cabeçalho X-Api-Key (o mesmo token de /api/ext/compras).
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { tokenExterno } from "@/lib/compras";

const dataUrl = (s) => { const m = String(s || "").match(/^data:([^;,]*)(?:;base64)?,(.*)$/s); return m ? { mime: m[1] || null, b64: m[2] } : { mime: null, b64: String(s || "") }; };
const ext = (mime) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" }[mime] || "bin");

export async function GET(req) {
  const tk = req.headers.get("x-api-key") || "";
  if (!tk || tk !== (await tokenExterno())) return Response.json({ error: "Token inválido." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const numero = String(sp.get("pedido") || "").trim(), idx = Number(sp.get("item")) || 0;
  if (!numero || idx < 1) return Response.json({ error: "Informe pedido e item (1, 2, 3…)." }, { status: 400 });
  const pp = await prisma.pp.findFirst({ where: { numero }, orderBy: { id: "desc" }, include: { itens: { orderBy: { id: "asc" }, select: { id: true, fotoBase64: true, anexosJson: true, descricao: true } } } });
  const it = pp?.itens?.[idx - 1];
  if (!it) return Response.json({ error: "Item não encontrado." }, { status: 404 });
  const pers = (Array.isArray(it.anexosJson) ? it.anexosJson : []).filter((a) => a && a.base64 && a.categoria !== "LAYOUT");
  const arq = sp.get("arquivo");
  if (arq) {
    let nome, d;
    if (arq === "layout") { if (!it.fotoBase64) return Response.json({ error: "Item sem layout." }, { status: 404 }); d = dataUrl(it.fotoBase64); nome = `layout-${numero}-item${idx}.${ext(d.mime)}`; }
    else { const a = pers[Number(arq) - 1]; if (!a) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 }); d = dataUrl(a.base64); d.mime = a.mime || d.mime; nome = a.nome; }
    return new Response(Buffer.from(d.b64, "base64"), { headers: { "Content-Type": d.mime || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome)}`, "Cache-Control": "no-store" } });
  }
  const base = `${new URL(req.url).origin}/api/ext/arquivos?pedido=${encodeURIComponent(numero)}&item=${idx}`;
  return Response.json({
    pedido: numero, item: idx, descricao: it.descricao || "",
    layout: it.fotoBase64 ? { nome: `layout-${numero}-item${idx}.${ext(dataUrl(it.fotoBase64).mime)}`, mime: dataUrl(it.fotoBase64).mime, url: `${base}&arquivo=layout` } : null,
    personalizacao: pers.map((a, k) => ({ nome: a.nome, mime: a.mime || null, url: `${base}&arquivo=${k + 1}` })),
  });
}
