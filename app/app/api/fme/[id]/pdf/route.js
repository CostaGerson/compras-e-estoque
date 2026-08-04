export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { jsPDF } from "jspdf";

const fmtN = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// GET /api/fme/[id]/pdf -> devolve o PDF meia folha da FME (inline, abre em nova guia)
export async function GET(req, { params }) {
  const id = Number(params.id);
  const fme = await prisma.fme.findUnique({ where: { id }, include: { itens: { include: { artigo: { select: { nome: true, cor: true, unidade: true } } } } } });
  if (!fme) return Response.json({ error: "FME não encontrada" }, { status: 404 });
  let responsavelNome = "";
  if (fme.responsavelEstoque) {
    const u = await prisma.usuario.findUnique({ where: { id: fme.responsavelEstoque } });
    if (u) responsavelNome = `${u.nome} ${u.sobrenome || ""}`.trim();
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  const W = 210, M = 10;
  let y = 12;
  const data = (() => { try { return new Date(fme.data || fme.createdAt).toLocaleDateString("pt-BR"); } catch { return ""; } })();

  doc.setFillColor(0, 30, 65); doc.rect(0, 0, W, 7, "F");
  doc.setFontSize(14); doc.setTextColor(0, 30, 65); doc.setFont(undefined, "bold");
  doc.text("MERIDIAN", M, y);
  doc.setFontSize(10); doc.setTextColor(90, 90, 90); doc.setFont(undefined, "normal");
  doc.text("Ficha de Movimentação de Estoque", M + 34, y);
  doc.setFontSize(13); doc.setTextColor(255, 107, 26); doc.setFont(undefined, "bold");
  doc.text(String(fme.numero || ""), W - M, y, { align: "right" });
  y += 7;
  doc.setDrawColor(210, 210, 210); doc.line(M, y, W - M, y); y += 6;

  doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(40, 40, 40);
  doc.text(`Data: ${data}`, M, y);
  doc.text(`Setor demandante: ${fme.setorDemandante || ""}`, M + 55, y);
  doc.text(`Solicitante: ${fme.responsavelSetor || "-"}`, M + 130, y);
  y += 5;
  doc.text(`Responsável estoque: ${responsavelNome || "-"}`, M, y);
  y += 5;

  const cols = [
    { t: "Item", x: 10, w: 54 }, { t: "Cor", x: 64, w: 22 }, { t: "PP", x: 86, w: 20 },
    { t: "Un", x: 106, w: 9 }, { t: "Qtd retir.", x: 115, w: 22 }, { t: "Qtd devol.", x: 137, w: 22 },
    { t: "Data dev.", x: 159, w: 22 }, { t: "Obs", x: 181, w: 19 },
  ];
  doc.setFillColor(241, 243, 245); doc.rect(M, y, W - 2 * M, 7, "F");
  doc.setFontSize(7); doc.setTextColor(90, 90, 90); doc.setFont(undefined, "bold");
  cols.forEach((c) => doc.text(c.t, c.x + 1.2, y + 4.6));
  y += 7;
  doc.setFont(undefined, "normal"); doc.setTextColor(30, 30, 30); doc.setFontSize(8);
  (fme.itens || []).forEach((it) => {
    const rowH = 8;
    const nome = it.nomeItem || it.artigo?.nome || "";
    const cor = it.cor || it.artigo?.cor || "";
    const un = it.unidade || it.artigo?.unidade || "";
    doc.setDrawColor(225, 225, 225); doc.rect(M, y, W - 2 * M, rowH);
    cols.forEach((c) => { if (c.x > M) doc.line(c.x, y, c.x, y + rowH); });
    doc.text(doc.splitTextToSize(nome, cols[0].w - 3)[0] || "", cols[0].x + 1.5, y + 5.2);
    doc.text(doc.splitTextToSize(cor, cols[1].w - 3)[0] || "", cols[1].x + 1.5, y + 5.2);
    doc.text(String(it.pedidoProducao || ""), cols[2].x + 1.5, y + 5.2);
    doc.text(String(un), cols[3].x + 1.5, y + 5.2);
    doc.text(fmtN(it.qtdRetirada), cols[4].x + 1.5, y + 5.2);
    y += rowH;
  });
  y += 10;

  const sigY = Math.max(y, 118);
  const half = W / 2;
  doc.setDrawColor(120, 120, 120);
  doc.line(M + 6, sigY, half - 8, sigY);
  doc.line(half + 8, sigY, W - M - 6, sigY);
  doc.setFontSize(8); doc.setTextColor(90, 90, 90);
  doc.text("Assinatura do retirante", (M + 6 + half - 8) / 2, sigY + 5, { align: "center" });
  doc.text("Assinatura do estoque", (half + 8 + W - M - 6) / 2, sigY + 5, { align: "center" });

  const buf = Buffer.from(doc.output("arraybuffer"));
  return new Response(buf, {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fme.numero || "FME"}.pdf"` },
  });
}
