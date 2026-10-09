export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, usuarioSoMaster, soMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { excluirRegistro } from "@/lib/fiscal";

// GET ?u=&arq=xml|pdf → arquivo da nota
export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const n = await prisma.fiscalNota.findUnique({ where: { id: Number(params.id) }, select: { numero: true, xml: true, xmlNome: true, pdf: true, pdfNome: true } });
  const pdf = sp.get("arq") === "pdf";
  if (!n || !(pdf ? n.pdf : n.xml)) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  const buf = pdf ? Buffer.from(n.pdf, "base64") : Buffer.from(n.xml, "utf8");
  const nome = (pdf ? n.pdfNome : n.xmlNome) || `NF ${n.numero}.${pdf ? "pdf" : "xml"}`;
  return new Response(buf, { headers: {
    "Content-Type": pdf ? "application/pdf" : "application/xml; charset=utf-8",
    "Content-Disposition": `${sp.get("baixar") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nome)}`,
  } });
}

// DELETE { usuarioId } → exclui o registro (contas criadas por ele vão para a lixeira)
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "nfEntrada", "contasPagar", "contasReceber", "faturamento");
  if (!u) return soMaster();
  const r = await excluirRegistro(params.id, nomeU(u));
  if (r.error) return Response.json(r, { status: 400 });
  return Response.json(r);
}
