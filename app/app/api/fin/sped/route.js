// v1035 — SPED Fiscal (EFD ICMS/IPI) gerado pelo ERP
// GET ?u=&competencia=AAAA-MM            → prévia: resumo, críticas e comparação com o SPED guardado na Contabilidade (o do KM)
// GET ?u=&competencia=AAAA-MM&baixar=1   → arquivo TXT (ISO-8859-1)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { gerarEfd, latin1, compararEfd } from "@/lib/spedEfd";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  try {
    const r = await gerarEfd(competencia);
    if (sp.get("baixar")) {
      const [a, m] = competencia.split("-");
      return new Response(latin1(r.texto), { headers: { "content-type": "text/plain; charset=ISO-8859-1", "content-disposition": `attachment; filename="SPED_EFD_ERP_${m}_${a}.txt"` } });
    }
    // SPED que já está na Contabilidade do mês (vindo do KM / contador): compara nota a nota
    let comparacao = null;
    const doc = await prisma.finContabDoc.findFirst({ where: { competencia, categoria: "SPED", formato: "TXT" }, orderBy: { id: "desc" }, select: { nome: true, conteudo: true } });
    if (doc?.conteudo) {
      const buf = Buffer.from(doc.conteudo, "base64");
      let t = buf.toString("utf8");
      if (t.includes("�") && !buf.includes(Buffer.from([0xef, 0xbf, 0xbd]))) t = buf.toString("latin1");
      comparacao = { arquivo: doc.nome, ...compararEfd(r.texto, t) };
    }
    return Response.json({ competencia, versao: r.versao, resumo: r.resumo, criticas: r.criticas, comparacao });
  } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }); }
}
