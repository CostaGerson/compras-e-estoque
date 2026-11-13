// v828 — "Conferir origem" de uma conta a pagar/receber: devolve os links do que gerou a conta
//   NF (PDF/XML do Movimento fiscal ou da NF do Compras) · pedido (tela do pedido na Produção) · OS do PCP · anexos
import { prisma } from "@/lib/prisma";

export async function origemDoTitulo(id, u) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) }, select: { id: true, titulo: true, numeroDoc: true, chaveImport: true, nfId: true, forma: true, recorrenciaId: true, observacao: true } });
  if (!t) return { opcoes: [] };
  const ck = String(t.chaveImport || "");
  const op = [];
  const add = (rotulo, url, tipo) => { if (url && !op.some((o) => o.url === url)) op.push({ rotulo, url, tipo }); };
  // NF pelo Movimento fiscal (chave NFE|chave|parcela ou NFSE|doc|numero|parcela)
  if (/^(NFE|NFSE)\|/.test(ck)) {
    const reg = ck.split("|").slice(0, -1).join("|");
    const n = await prisma.fiscalNota.findUnique({ where: { chaveRegistro: reg }, select: { id: true, numero: true, temPdf: true, temXml: true } }).catch(() => null);
    if (n?.temPdf) add(`PDF da NF ${n.numero}`, `/api/fiscal/${n.id}?u=${u}&arq=pdf`, "NF");
    if (n?.temXml) add(`XML da NF ${n.numero}`, `/api/fiscal/${n.id}?u=${u}&arq=xml`, "NF");
  }
  // NF do Compras
  if (t.nfId) {
    const nf = await prisma.notaFiscal.findUnique({ where: { id: t.nfId }, select: { id: true, numero: true, temPdf: true } }).catch(() => null);
    if (nf?.temPdf) add(`PDF da NF ${nf.numero} (Compras)`, `/api/nf/${nf.id}/pdf`, "NF");
  }
  // NF achada pelo número (conta lançada à mão ou importada sem chave)
  if (!op.length) {
    const num = (String(t.numeroDoc || "").match(/NF-?e?\s*0*(\d{3,})/i) || String(t.titulo || "").match(/\bNF\s*0*(\d{3,})/i) || [])[1];
    if (num) {
      const n = await prisma.fiscalNota.findFirst({ where: { numero: num, OR: [{ temPdf: true }, { temXml: true }] }, orderBy: { id: "desc" }, select: { id: true, numero: true, temPdf: true, temXml: true } }).catch(() => null);
      if (n) add(n.temPdf ? `PDF da NF ${n.numero}` : `XML da NF ${n.numero}`, `/api/fiscal/${n.id}?u=${u}&arq=${n.temPdf ? "pdf" : "xml"}`, "NF");
    }
  }
  // pedido (PED|numero|… · PV:numero:… · "PEDIDO 26115011" no título)
  const ped = (ck.match(/^PED\|(\d+)\|/) || ck.match(/^PV:(\d+):/) || String(t.titulo || "").match(/PEDIDO\s+(\d{8})/) || [])[1];
  if (ped) add(`Pedido ${ped} na Produção`, `/?v=pedido&numero=${ped}`, "PEDIDO");
  // OS do PCP (facção / terceirizados): linhas com o nº da OS
  if (/^SEMANA\|/.test(ck) || t.forma === "SEMANAL") {
    const itens = await prisma.finSemanaItem.findMany({ where: { tituloId: t.id }, select: { linhas: true } }).catch(() => []);
    const oss = [...new Set(itens.flatMap((i) => (Array.isArray(i.linhas) ? i.linhas : []).map((l) => l.os).filter(Boolean)))];
    const base = process.env.PCP_OS_URL || "";   // ex.: https://pcp.meridianpro.com.br/os/{os}
    for (const os of oss) if (base) add(`OS ${os} no PCP`, base.replace("{os}", encodeURIComponent(os)), "OS");
    const peds = [...new Set(itens.flatMap((i) => (Array.isArray(i.linhas) ? i.linhas : []).map((l) => String(l.pedido || "").match(/\d{8}/)?.[0]).filter(Boolean)))];
    for (const p of peds.slice(0, 8)) add(`Pedido ${p} na Produção`, `/?v=pedido&numero=${p}`, "PEDIDO");
    if (oss.length && !base) op.push({ rotulo: `OS ${oss.join(", ")} (link do PCP ainda não configurado)`, url: null, tipo: "OS" });
  }
  // anexos da conta (boleto, NF, OS em PDF…)
  const anexos = await prisma.finTituloAnexo.findMany({ where: { tituloId: t.id }, select: { id: true, nome: true }, orderBy: { id: "asc" } }).catch(() => []);
  for (const a of anexos) add(`Anexo: ${a.nome}`, `/api/fin/titulos/${t.id}/anexos?u=${u}&anexo=${a.id}`, "ANEXO");
  if (t.recorrenciaId && !op.length) op.push({ rotulo: "Conta recorrente (guia Recorrentes / Matriz de custos)", url: null, tipo: "RECORRENCIA" });
  return { opcoes: op };
}
