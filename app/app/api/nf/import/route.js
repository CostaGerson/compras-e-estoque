import { prisma } from "@/lib/prisma";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { parseXmlNfe, parsePdfNfe, validarVenda, camposDoTexto, unidadeDoUCom } from "@/lib/nf";
import { lerXmlTitulo } from "@/lib/finTitulos";
import { fornecedorDoEmitente, gerarContasNf } from "@/lib/nfEntrada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const up = (v) => (v ? String(v).toUpperCase() : v);

// NFS-e: fornecedor pelo CNPJ do prestador + registro da nota (sem itens/estoque)
async function gravarServico(sv, xml, pdfBase64) {
  if (!sv.documento) return Response.json({ error: "NFS-e sem CNPJ/CPF do prestador." }, { status: 422 });
  let fornecedorId;
  const cnpjRow = await prisma.fornecedorCnpj.findUnique({ where: { cnpj: sv.documento } });
  if (cnpjRow) fornecedorId = cnpjRow.fornecedorId;
  else {
    const forn = await prisma.fornecedor.create({ data: { nome: "", razaoSocial: sv.razao || null, cnpjs: { create: [{ cnpj: sv.documento, razaoSocial: sv.razao || null }] } } });
    fornecedorId = forn.id;
  }
  const numero = sv.numero || "S/N";
  const existe = await prisma.notaFiscal.findFirst({ where: { modelo: "NFSE", fornecedorId, numero } });
  if (existe) return Response.json({ ok: true, jaExistia: true, numero, natureza: "SERVIÇO (NFS-e)", origem: "XML", itensCriados: 0, artigosCriados: 0, artigosVinculados: 0, artigosReativados: 0 }, { status: 201 });
  await prisma.notaFiscal.create({
    data: {
      numero, chave: null, fornecedorId, modelo: "NFSE", status: "LANCADA", arquivoXml: xml, temXml: true,
      arquivoPdf: pdfBase64 || null, temPdf: !!pdfBase64, dataEmissao: sv.emissao ? new Date(sv.emissao + "T12:00:00Z") : null, valorTotal: sv.total || null,
    },
  });
  return Response.json({ ok: true, jaExistia: false, numero, natureza: "SERVIÇO (NFS-e)", origem: "XML", itensCriados: 0, artigosCriados: 0, artigosVinculados: 0, artigosReativados: 0 }, { status: 201 });
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const { tipo, conteudo, pdfBase64, perfil, usuarioId } = body || {};
  const criadoPorId = usuarioId ? Number(usuarioId) : null;
  if (!(await usuarioSoMaster(criadoPorId))) return soMaster();   // v167 — importação: só o master
  if (!tipo || !conteudo) return Response.json({ error: "Envie o arquivo (tipo e conteúdo)." }, { status: 400 });

  // 1) parse
  let nf, arquivoXml = null, arquivoPdf = null;
  try {
    if (tipo === "xml") {
      try { nf = parseXmlNfe(conteudo); }
      catch (eNfe) {
        // não é NF-e: tenta NFS-e (nota de serviço) — fica registrada para o financeiro, sem estoque
        let sv;
        try { sv = lerXmlTitulo(conteudo); } catch { throw eNfe; }
        if (sv.modelo !== "NFS-e") throw eNfe;
        return await gravarServico(sv, conteudo, pdfBase64);
      }
      arquivoXml = conteudo;
      arquivoPdf = pdfBase64 || null;
    } else if (tipo === "pdf") {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const buf = Buffer.from(conteudo, "base64");
      const data = await pdfParse(buf);
      nf = parsePdfNfe(data.text);
      arquivoPdf = conteudo;
    } else {
      return Response.json({ error: "Tipo deve ser xml ou pdf." }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: "Não consegui ler o arquivo: " + e.message }, { status: 422 });
  }

  // 2) valida VENDA
  const v = validarVenda(nf);
  if (!v.ok) return Response.json({ error: v.motivo, natureza: nf.natOp }, { status: 422 });

  try {
  // 3) fornecedor pelo CNPJ do emitente
  let fornecedorId = await fornecedorDoEmitente(nf);

  // 4) NF: usa a existente (anexando arquivos) ou cria nova
  const dataEmissao = nf.dataEmissao ? new Date(nf.dataEmissao) : null;
  let notaFiscal = await prisma.notaFiscal.findUnique({
    where: { chave: nf.chave },
    select: { id: true, numero: true, fornecedorId: true, arquivoXml: true, arquivoPdf: true },
  });
  let jaExistia = false;

  if (notaFiscal) {
    jaExistia = true;
    if (!fornecedorId) fornecedorId = notaFiscal.fornecedorId;
    const upd = {};
    if (arquivoPdf && !notaFiscal.arquivoPdf) { upd.arquivoPdf = arquivoPdf; upd.temPdf = true; }
    if (arquivoXml && !notaFiscal.arquivoXml) { upd.arquivoXml = arquivoXml; upd.temXml = true; }
    if (Object.keys(upd).length) await prisma.notaFiscal.update({ where: { id: notaFiscal.id }, data: upd });
  } else {
    notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: nf.numero || nf.chave.slice(25, 34).replace(/^0+/, "") || nf.chave,
        chave: nf.chave, fornecedorId, status: "LANCADA",
        arquivoXml, arquivoPdf, temPdf: !!arquivoPdf, temXml: !!arquivoXml,
        dataEmissao, valorTotal: nf.valorTotal ?? null,
      },
    });
  }

  // 5) itens + artigos — garante que existam (recria os que faltam, reativa inativados)
  const dataCompra = dataEmissao;
  const resumo = { itensCriados: 0, artigosCriados: 0, artigosVinculados: 0, artigosReativados: 0 };
  const jaTemItens = (await prisma.nfItem.count({ where: { nfId: notaFiscal.id } })) > 0;

  if (jaTemItens) {
    // NF já tinha itens: só reativa os artigos ligados (caso estivessem inativados)
    const itens = await prisma.nfItem.findMany({ where: { nfId: notaFiscal.id, artigoId: { not: null } }, select: { artigoId: true } });
    const ids = [...new Set(itens.map((i) => i.artigoId))];
    if (ids.length) {
      const r = await prisma.artigo.updateMany({ where: { id: { in: ids }, ativo: false }, data: { ativo: true } });
      resumo.artigosReativados = r.count;
    }
  } else {
    for (const it of nf.itens) {
      const qtd = it.qCom ?? 0;
      let artigoId = null;
      if (fornecedorId && it.cProd) {
        const existe = await prisma.artigo.findFirst({ where: { fornecedorId, codigoFornecedor: it.cProd } });
        if (existe) {
          artigoId = existe.id; resumo.artigosVinculados++;
          const saldoNovo = (Number(existe.quantidade) || 0) + Number(qtd || 0);
          await prisma.artigo.update({
            where: { id: existe.id },
            data: { ativo: true, nfId: notaFiscal.id, quantidade: saldoNovo, ...(it.vUn != null ? { valorUnitario: it.vUn } : {}), ...(dataCompra ? { dataCompra } : {}) },
          });
        }
      }
      if (!artigoId) {
        const campos = camposDoTexto(it.infAdProd || it.xProd);
        const art = await prisma.artigo.create({
          data: {
            categoria: campos.categoria, fornecedorId, nfId: notaFiscal.id,
            codigoFornecedor: it.cProd || null, nome: up(it.xProd) || "ARTIGO SEM NOME",
            composicao: up(campos.composicao), largura: campos.largura, gramatura: campos.gramatura,
            unidade: unidadeDoUCom(it.uCom), quantidade: qtd, valorUnitario: it.vUn, dataCompra, criadoPorId,
          },
        });
        artigoId = art.id; resumo.artigosCriados++;
      }
      // movimentação de ENTRADA (origem: NF)
      await prisma.estoqueMovimentacao.create({
        data: { artigoId, tipo: "ENTRADA", quantidade: qtd, nfId: notaFiscal.id, perfil: perfil || null },
      });
      await prisma.nfItem.create({
        data: { nfId: notaFiscal.id, artigoId, descricaoNf: it.xProd, quantidade: qtd, valorUnitario: it.vUn },
      });
      resumo.itensCriados++;
    }
  }

  // 6) v138: duplicatas viram contas a pagar em aberto (precisa do XML)
  let contas = null;
  if (arquivoXml) {
    const u = criadoPorId ? await prisma.usuario.findUnique({ where: { id: criadoPorId }, select: { nome: true, sobrenome: true } }) : null;
    const quem = u ? [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() : null;
    contas = await gerarContasNf({ xml: arquivoXml, nfId: notaFiscal.id, historico: false, quem, quemId: criadoPorId }).catch(() => null);
  }
  return Response.json({
    ok: true, jaExistia, chave: nf.chave, numero: notaFiscal.numero,
    natureza: nf.natOp, origem: nf.origem, temPdf: !!(arquivoPdf), ...resumo, contas,
  }, { status: 201 });
  } catch (e) {
    return Response.json({ error: "Falha ao gravar: " + (e?.message || String(e)) }, { status: 500 });
  }
}
