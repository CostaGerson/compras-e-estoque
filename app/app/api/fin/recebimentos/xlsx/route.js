export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { gravarDoc, mesAno } from "@/lib/finContab";

const dBR = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "");

async function planilha(competencia) {
  const linhas = await prisma.finRecebimento.findMany({
    where: { competencia },
    orderBy: [{ bloco: "asc" }, { data: "asc" }, { ordem: "asc" }],
    select: { bloco: true, data: true, titulo: true, valor: true, nf: true, nomePagador: true, cnpj: true, obs: true },
  });
  if (!linhas.length) return null;

  const conc = linhas.filter((l) => l.bloco !== "CONFIRMAR");
  const conf = linhas.filter((l) => l.bloco === "CONFIRMAR");

  const linha = (l) => [dBR(l.data), l.titulo || "", Number(l.valor), l.nf || "", l.nomePagador || "", l.cnpj || "", l.obs || ""];
  const soma = (ls) => ls.reduce((s, l) => s + Number(l.valor), 0);

  const wb = XLSX.utils.book_new();

  const aba1 = [["DATA", "TÍTULO", "VALOR (R$)", "NF", "NOME PAGADOR", "CNPJ", "OBS"], ...conc.map(linha)];
  aba1.push(["", "TOTAL", soma(conc), "", "", "", ""]);
  const ws1 = XLSX.utils.aoa_to_sheet(aba1);
  ws1["!cols"] = [{ wch: 11 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 46 }, { wch: 20 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Conciliação");

  if (conf.length) {
    const aba2 = [["DATA", "TÍTULO", "VALOR (R$)", "NF", "NOME PAGADOR", "CNPJ", "OBS"], ...conf.map(linha)];
    aba2.push(["", "TOTAL", soma(conf), "", "", "", ""]);
    const ws2 = XLSX.utils.aoa_to_sheet(aba2);
    ws2["!cols"] = ws1["!cols"];
    XLSX.utils.book_append_sheet(wb, ws2, "A confirmar");
  }

  return {
    buf: Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })),
    nome: `RECEBIMENTOS MERIDIAN ${mesAno(competencia)}.xlsx`,
    n: conc.length, nConfirmar: conf.length, total: soma(conc),
  };
}

// GET ?u=&competencia=            → baixa a planilha
// GET ?u=&competencia=&salvar=1   → gera e já guarda no pacote da contabilidade
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioMaster(sp.get("u"));
  if (!u) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return new Response("Competência inválida.", { status: 400 });

  const p = await planilha(competencia);
  if (!p) return new Response("Nenhum recebimento neste mês — gere a planilha primeiro.", { status: 404 });

  if (sp.get("salvar")) {
    const g = await gravarDoc({
      competencia, categoria: "RECEBIMENTOS", formato: "XLSX", buf: p.buf,
      nomeOriginal: p.nome, usuario: u,
    });
    return Response.json({ ok: true, doc: g.doc, duplicado: !!g.duplicado, linhas: p.n, total: p.total });
  }

  return new Response(p.buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(p.nome)}`,
    },
  });
}
