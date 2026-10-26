// v486 — XML e PDF da NF do fornecedor na OC. O XML preenche o nº e a emissão da NF.
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { salvarOc } from "@/lib/pic";

const MAX = 15 * 1024 * 1024;
export async function GET(req) {
  const id = Number(new URL(req.url).searchParams.get("id")) || 0;
  const a = await prisma.ocArquivo.findUnique({ where: { id } });
  if (!a) return new Response("Não encontrado.", { status: 404 });
  return new Response(Buffer.from(a.conteudo, "base64"), { headers: { "Content-Type": a.mime || (a.tipo === "XML" ? "application/xml" : "application/pdf"), "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(b.ocId) || 0 } });
  if (!oc) return Response.json({ error: "OC não encontrada." }, { status: 400 });
  const conteudo = String(b.conteudo || "").replace(/^data:[^,]*,/, "");
  const tamanho = Math.floor((conteudo.length * 3) / 4);
  if (!conteudo) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  if (tamanho > MAX) return Response.json({ error: `${b.nome}: maior que 15 MB.` }, { status: 400 });
  const nome = String(b.nome || "arquivo");
  const tipo = /\.xml$/i.test(nome) || /xml/i.test(b.mime || "") ? "XML" : /\.pdf$/i.test(nome) || /pdf/i.test(b.mime || "") ? "PDF" : "OUTRO";
  await prisma.ocArquivo.create({ data: { ocId: oc.id, tipo, nome: nome.slice(0, 200), mime: b.mime || null, tamanho, conteudo, criadoPorNome: b.quem || null } });
  let nf = null;
  if (tipo === "XML") {
    const xml = Buffer.from(conteudo, "base64").toString("utf8");
    const nNF = (/<nNF>(\d+)<\/nNF>/.exec(xml) || [])[1];
    const em = (/<dhEmi>(\d{4}-\d{2}-\d{2})/.exec(xml) || /<dEmi>(\d{4}-\d{2}-\d{2})/.exec(xml) || [])[1];
    if (nNF && !oc.nfNumero) { await salvarOc({ id: oc.id, nfNumero: String(Number(nNF)), nfEmissao: em || null }); nf = { numero: String(Number(nNF)), emissao: em || null }; }
  }
  return Response.json({ ok: true, tipo, nf });
}
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  await prisma.ocArquivo.deleteMany({ where: { id: Number(b.id) || 0 } });
  return Response.json({ ok: true });
}
