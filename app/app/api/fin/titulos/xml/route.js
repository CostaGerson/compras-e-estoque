export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { lerXmlTitulo, validarRateio, nomeU, r2, dataUTC, mesDe, previaNota } from "@/lib/finTitulos";

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
        // se o Compras já lançou essa NF, liga a conta a ela
        const nfC = x.chave ? await prisma.notaFiscal.findUnique({ where: { chave: x.chave }, select: { id: true } }) : null;
        lidos.push(await previaNota(tipo, x, { arquivo: a.nome, xml: a.xml, nfId: nfC?.id || null }));
      } catch (e) { erros.push(`${a.nome}: ${e.message}`); }
    }
    return Response.json({ lidos, erros });
  }

  let criados = 0, pulados = 0;
  for (const it of b.itens || []) {
    const rt = validarRateio(it.rateio);
    if (rt.erro) return Response.json({ error: `${it.titulo || it.parceiro}: ${rt.erro}` }, { status: 400 });
    if (!it.vencimento || !(r2(it.valor) > 0)) return Response.json({ error: `${it.titulo || it.parceiro}: confira valor e vencimento.` }, { status: 400 });
    if (it.chaveImport) {   // conta antiga cancelada com a mesma chave: libera a chave
      const velha = await prisma.finTitulo.findFirst({ where: { chaveImport: it.chaveImport }, select: { id: true, status: true } });
      if (velha?.status === "CANCELADO") await prisma.finTitulo.update({ where: { id: velha.id }, data: { chaveImport: `${it.chaveImport}|CANCELADA|${velha.id}`.slice(0, 190) } });
    }
    try {
      await prisma.finTitulo.create({
        data: {
          tipo, titulo: String(it.titulo || "").toUpperCase(), parceiro: String(it.parceiro || "").toUpperCase(), documento: it.documento || null,
          numeroDoc: it.numeroDoc || null, valor: r2(it.valor), vencimento: dataUTC(it.vencimento), competencia: mesDe(it.vencimento),
          previsao: !!it.previsao, rateio: rt.rateio, observacao: it.observacao || null, forma: "NF_XML", chaveImport: it.chaveImport || null,
          arquivoXml: it.nfId ? null : it.xml || null, nfId: it.nfId ? Number(it.nfId) : null, criadoPorId: u.id, criadoPorNome: nomeU(u),
        },
      });
      criados++;
    } catch (e) {
      if (String(e.code) === "P2002") pulados++; else throw e;
    }
  }
  return Response.json({ ok: true, criados, pulados });
}
