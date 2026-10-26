// v494 — NFs da OC: conferência, correção da OC, aceite de CNPJ, exclusão e arquivos
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { conferirOc, corrigirOcPelaNf, aceitarCnpj, desligarNfOc } from "@/lib/ocNf";

// GET ?oc= → conferência · GET ?id=&arq=xml|pdf → arquivo da nota
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (sp.get("id")) {
    const n = await prisma.fiscalNota.findUnique({ where: { id: Number(sp.get("id")) }, select: { numero: true, ocId: true, xml: true, xmlNome: true, pdf: true, pdfNome: true } });
    const pdf = sp.get("arq") === "pdf";
    if (!n?.ocId || !(pdf ? n.pdf : n.xml)) return new Response("Não encontrado.", { status: 404 });
    const nome = (pdf ? n.pdfNome : n.xmlNome) || `NF ${n.numero}.${pdf ? "pdf" : "xml"}`;
    return new Response(pdf ? Buffer.from(n.pdf, "base64") : Buffer.from(n.xml, "utf8"), { headers: { "Content-Type": pdf ? "application/pdf" : "application/xml; charset=utf-8", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome)}` } });
  }
  const r = await conferirOc(sp.get("oc"));
  return Response.json(r, { status: r.error ? 400 : 200 });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
  switch (b.acao) {
    case "corrigir": return r(await corrigirOcPelaNf(b));
    case "aceitarCnpj": return r(await aceitarCnpj(b.ocId, b.cnpj, b.razao));
    case "excluir": return r(await desligarNfOc(b.ocId, b.fiscalNotaId, !!b.excluirRegistro, b.quem));
    default: return Response.json({ error: "Ação?" }, { status: 400 });
  }
}
