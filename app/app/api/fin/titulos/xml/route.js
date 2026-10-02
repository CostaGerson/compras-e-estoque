export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { lerXmlTitulo, validarRateio, nomeU, r2, dataUTC, mesDe } from "@/lib/finTitulos";

// POST { usuarioId, tipo, arquivos:[{nome, xml}] }          → leitura (prévia), não grava
// POST { usuarioId, tipo, gravar:true, itens:[...] }         → grava os títulos revisados
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const tipo = b.tipo === "RECEBER" ? "RECEBER" : "PAGAR";

  if (!b.gravar) {
    const lidos = [], erros = [];
    for (const a of b.arquivos || []) {
      try {
        const x = lerXmlTitulo(a.xml, a.nome);
        // parceiro já usado antes: sugere o mesmo nome e o último rateio
        const ant = x.documento ? await prisma.finTitulo.findFirst({ where: { tipo, documento: x.documento }, orderBy: { createdAt: "desc" } }) : null;
        const chaves = x.parcelas.map((p) => `${x.chaveBase}|${p.parcela}`);
        const ja = await prisma.finTitulo.findMany({ where: { chaveImport: { in: chaves } }, select: { chaveImport: true } });
        const jaSet = new Set(ja.map((j) => j.chaveImport));
        lidos.push({
          arquivo: a.nome, ...x, parceiro: ant?.parceiro || x.parceiro, rateioSugerido: ant?.rateio || null,
          parcelas: x.parcelas.map((p) => ({ ...p, chaveImport: `${x.chaveBase}|${p.parcela}`, jaImportada: jaSet.has(`${x.chaveBase}|${p.parcela}`) })),
          xml: a.xml,
        });
      } catch (e) { erros.push(`${a.nome}: ${e.message}`); }
    }
    return Response.json({ lidos, erros });
  }

  let criados = 0, pulados = 0;
  for (const it of b.itens || []) {
    const rt = validarRateio(it.rateio);
    if (rt.erro) return Response.json({ error: `${it.titulo || it.parceiro}: ${rt.erro}` }, { status: 400 });
    if (!it.vencimento || !(r2(it.valor) > 0)) return Response.json({ error: `${it.titulo || it.parceiro}: confira valor e vencimento.` }, { status: 400 });
    try {
      await prisma.finTitulo.create({
        data: {
          tipo, titulo: String(it.titulo || "").toUpperCase(), parceiro: String(it.parceiro || "").toUpperCase(), documento: it.documento || null,
          numeroDoc: it.numeroDoc || null, valor: r2(it.valor), vencimento: dataUTC(it.vencimento), competencia: mesDe(it.vencimento),
          previsao: !!it.previsao, rateio: rt.rateio, observacao: it.observacao || null, forma: "NF_XML", chaveImport: it.chaveImport || null,
          arquivoXml: it.xml || null, criadoPorId: u.id, criadoPorNome: nomeU(u),
        },
      });
      criados++;
    } catch (e) {
      if (String(e.code) === "P2002") pulados++; else throw e;
    }
  }
  return Response.json({ ok: true, criados, pulados });
}
