import { prisma } from "@/lib/prisma";
import { parseXmlNfe, parsePdfNfe, validarVenda, camposDoTexto, unidadeDoUCom } from "@/lib/nf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const { tipo, conteudo } = body || {};
  if (!tipo || !conteudo) return Response.json({ error: "Envie o arquivo (tipo e conteúdo)." }, { status: 400 });

  // 1) parse
  let nf;
  try {
    if (tipo === "xml") {
      nf = parseXmlNfe(conteudo);
    } else if (tipo === "pdf") {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const buf = Buffer.from(conteudo, "base64");
      const data = await pdfParse(buf);
      nf = parsePdfNfe(data.text);
    } else {
      return Response.json({ error: "Tipo deve ser xml ou pdf." }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: "Não consegui ler o arquivo: " + e.message }, { status: 422 });
  }

  // 2) valida VENDA
  const v = validarVenda(nf);
  if (!v.ok) return Response.json({ error: v.motivo, natureza: nf.natOp }, { status: 422 });

  // 3) dedupe pela chave
  const existente = await prisma.notaFiscal.findUnique({ where: { chave: nf.chave } });
  if (existente) return Response.json({ error: "Esta NF já foi importada (chave já existe).", chave: nf.chave }, { status: 409 });

  // 4) fornecedor pelo CNPJ do emitente
  let fornecedorId = null;
  if (nf.emit?.cnpj) {
    const cnpjRow = await prisma.fornecedorCnpj.findUnique({ where: { cnpj: nf.emit.cnpj } });
    if (cnpjRow) fornecedorId = cnpjRow.fornecedorId;
    else {
      const forn = await prisma.fornecedor.create({
        data: {
          nome: nf.emit.nome || nf.emit.razaoSocial || `Fornecedor ${nf.emit.cnpj}`,
          cnpjs: { create: [{ cnpj: nf.emit.cnpj, razaoSocial: nf.emit.razaoSocial || null }] },
        },
      });
      fornecedorId = forn.id;
    }
  }

  // 5) cria NF
  const notaFiscal = await prisma.notaFiscal.create({
    data: { numero: nf.numero || nf.chave.slice(25, 34).replace(/^0+/, "") || nf.chave, chave: nf.chave, fornecedorId, status: "LANCADA" },
  });

  // 6) itens + artigos (autopreenchimento, tudo editável depois)
  const dataCompra = nf.dataEmissao ? new Date(nf.dataEmissao) : null;
  const resumo = { itensCriados: 0, artigosCriados: 0, artigosVinculados: 0 };
  for (const it of nf.itens) {
    let artigoId = null;
    if (fornecedorId && it.cProd) {
      const existe = await prisma.artigo.findFirst({ where: { fornecedorId, codigoFornecedor: it.cProd } });
      if (existe) { artigoId = existe.id; resumo.artigosVinculados++;
        await prisma.artigo.update({ where: { id: existe.id }, data: { ...(it.vUn != null ? { valorUnitario: it.vUn } : {}), ...(dataCompra ? { dataCompra } : {}) } });
      }
    }
    if (!artigoId) {
      const campos = camposDoTexto(it.infAdProd || it.xProd);
      const art = await prisma.artigo.create({
        data: {
          categoria: campos.categoria,
          fornecedorId,
          codigoFornecedor: it.cProd || null,
          nome: it.xProd || "Artigo sem nome",
          composicao: campos.composicao,
          largura: campos.largura,
          gramatura: campos.gramatura,
          unidade: unidadeDoUCom(it.uCom),
          valorUnitario: it.vUn,
          dataCompra,
        },
      });
      artigoId = art.id; resumo.artigosCriados++;
    }
    await prisma.nfItem.create({
      data: { nfId: notaFiscal.id, artigoId, descricaoNf: it.xProd, quantidade: it.qCom ?? 0, valorUnitario: it.vUn },
    });
    resumo.itensCriados++;
  }

  return Response.json({ ok: true, chave: nf.chave, numero: notaFiscal.numero, natureza: nf.natOp, origem: nf.origem, ...resumo }, { status: 201 });
}
