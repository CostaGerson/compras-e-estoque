import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { parseClienteXml, mapPlanilha, normNome } from "../../../../lib/cliente";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const vazio = (v) => v === null || v === undefined || String(v).trim() === "";

export async function POST(req) {
  const body = await req.json();

  // ---------------- IMPORTAÇÃO DE XMLS ----------------
  if (body.tipo === "xml") {
    const arquivos = Array.isArray(body.xmls) ? body.xmls : [];
    let clientesNovos = 0, clientesAtualizados = 0, notasNovas = 0, notasDup = 0, erros = 0;
    const detalhes = [];

    for (const a of arquivos) {
      try {
        const p = parseClienteXml(a.conteudo);
        const c = p.cliente;

        const existente = await prisma.cliente.findUnique({ where: { cnpj: c.cnpj } });
        if (!existente) {
          await prisma.cliente.create({
            data: {
              cnpj: c.cnpj,
              razaoSocial: c.razaoSocial || "",
              inscricaoEstadual: c.inscricaoEstadual,
              logradouro: c.logradouro, numero: c.numero, complemento: c.complemento,
              bairro: c.bairro, municipio: c.municipio, uf: c.uf, cep: c.cep,
              telefones: c.telefones, emailNf: c.emailNf,
            },
          });
          clientesNovos++;
        } else {
          const upd = {};
          if (c.razaoSocial && vazio(existente.razaoSocial)) upd.razaoSocial = c.razaoSocial;
          for (const campo of ["inscricaoEstadual", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "cep", "telefones", "emailNf"]) {
            if (!vazio(c[campo]) && vazio(existente[campo])) upd[campo] = c[campo];
          }
          if (Object.keys(upd).length) {
            await prisma.cliente.update({ where: { id: existente.id }, data: upd });
            clientesAtualizados++;
          }
        }

        const cli = await prisma.cliente.findUnique({ where: { cnpj: c.cnpj } });
        // nota (dedupe por chave)
        if (p.chave) {
          const jaTem = await prisma.clienteNota.findUnique({ where: { chave: p.chave } });
          if (jaTem) { notasDup++; }
          else {
            await prisma.clienteNota.create({
              data: {
                clienteId: cli.id,
                chave: p.chave,
                numero: p.numero,
                pedidoVenda: p.pedido,
                dataEmissao: p.dataEmissao ? new Date(p.dataEmissao) : null,
                valorTotal: p.valorTotal,
              },
            });
            notasNovas++;
          }
        }
      } catch (e) {
        erros++;
        detalhes.push({ arquivo: a.name, erro: e.message });
      }
    }
    return NextResponse.json({ clientesNovos, clientesAtualizados, notasNovas, notasDup, erros, detalhes });
  }

  // ---------------- CRUZAMENTO COM PLANILHA ----------------
  if (body.tipo === "planilha") {
    let rows;
    try {
      const buf = Buffer.from(body.base64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    } catch (e) {
      return NextResponse.json({ error: "Não foi possível ler a planilha: " + e.message }, { status: 400 });
    }

    const mapeado = mapPlanilha(rows);
    const linhas = mapeado.linhas || [];
    const clientes = await prisma.cliente.findMany();
    const porCnpj = new Map(clientes.map((c) => [c.cnpj, c]));
    const porNome = new Map(clientes.map((c) => [normNome(c.razaoSocial), c]));

    let atualizados = 0, semMatch = 0;
    const naoEncontrados = [];

    for (const l of linhas) {
      let alvo = null;
      if (l.cnpj && porCnpj.has(l.cnpj)) alvo = porCnpj.get(l.cnpj);
      else if (l.matchNome && porNome.has(l.matchNome)) alvo = porNome.get(l.matchNome);
      if (!alvo) { semMatch++; naoEncontrados.push(l.razaoSocial || l.cnpj); continue; }

      const upd = {};
      // planilha é a fonte destes campos (não vêm do XML): sobrescreve quando tem valor
      for (const campo of ["nomeFantasia", "preposto", "telefones", "emailNf", "obs"]) {
        if (!vazio(l[campo])) upd[campo] = l[campo];
      }
      // estes só preenchem se estiverem vazios no cadastro
      for (const campo of ["inscricaoEstadual", "logradouro", "municipio", "uf", "razaoSocial"]) {
        if (!vazio(l[campo]) && vazio(alvo[campo])) upd[campo] = l[campo];
      }
      if (Object.keys(upd).length) {
        await prisma.cliente.update({ where: { id: alvo.id }, data: upd });
        atualizados++;
      }
    }
    return NextResponse.json({
      atualizados, semMatch,
      colunasDetectadas: Object.keys(mapeado.colMap || {}),
      naoEncontrados: naoEncontrados.slice(0, 30),
    });
  }

  return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
}
