// v1035 — SPED Fiscal (EFD ICMS/IPI) gerado pelo ERP
// GET ?u=&competencia=AAAA-MM            → prévia: resumo, críticas e comparação com o SPED guardado na Contabilidade (o do KM)
// GET ?u=&competencia=AAAA-MM&baixar=1   → arquivo TXT (ISO-8859-1)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { gerarEfd, latin1, compararEfd, datasEntradaEfd } from "@/lib/spedEfd";

// v1036 — SPED do período guardado na Contabilidade (o do KM / contador). O de um mês vai no pacote do mês seguinte
// (SET/26 fica em OUT/26): procura no mês e nos dois seguintes e escolhe pelo período do 0000 (DT_INI).
async function spedGuardado(competencia) {
  const [a0, m0] = competencia.split("-").map(Number);
  const comps = [0, 1, 2].map((k) => new Date(Date.UTC(a0, m0 - 1 + k, 1)).toISOString().slice(0, 7));
  const docs = await prisma.finContabDoc.findMany({ where: { competencia: { in: comps }, categoria: "SPED" }, orderBy: { id: "desc" }, select: { nome: true, competencia: true, conteudo: true } });
  const ini = `01${String(m0).padStart(2, "0")}${a0}`;
  for (const doc of docs) {
    if (!doc?.conteudo) continue;
    const buf = Buffer.from(doc.conteudo, "base64");
    let t = buf.toString("utf8");
    if (!/^\|0000\|/.test(t.trimStart())) continue;   // ZIP/XML: não compara
    if (t.includes("�") && !buf.includes(Buffer.from([0xef, 0xbf, 0xbd]))) t = buf.toString("latin1");
    if (t.trimStart().split("|")[4] !== ini) continue;   // 0000|COD_VER|COD_FIN|DT_INI
    return { nome: `${doc.nome} (Contabilidade ${doc.competencia.split("-").reverse().join("/")})`, texto: t };
  }
  return null;
}

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  try {
    const guardado = await spedGuardado(competencia);
    // v1037 — a data de entrada de cada nota segue a do SPED já entregue (quando a nota está nele)
    const r = await gerarEfd(competencia, { datasEntrada: guardado ? datasEntradaEfd(guardado.texto) : {} });
    if (sp.get("baixar")) {
      const [a, m] = competencia.split("-");
      return new Response(latin1(r.texto), { headers: { "content-type": "text/plain; charset=ISO-8859-1", "content-disposition": `attachment; filename="SPED_EFD_ERP_${m}_${a}.txt"` } });
    }
    const comparacao = guardado ? { arquivo: guardado.nome, ...compararEfd(r.texto, guardado.texto) } : null;
    return Response.json({ competencia, versao: r.versao, resumo: r.resumo, criticas: r.criticas, comparacao });
  } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }); }
}
