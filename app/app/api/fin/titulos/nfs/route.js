export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { notaParaLeitura, previaNota } from "@/lib/finTitulos";

// GET ?u=&ver=pendentes|ignoradas → notas lançadas pelo Compras ainda sem conta a pagar
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const ign = sp.get("ver") === "ignoradas";
  const l = await prisma.notaFiscal.findMany({
    where: { finIgnorada: ign, titulos: { none: {} } },
    select: {
      id: true, numero: true, modelo: true, dataEmissao: true, valorTotal: true, temXml: true, temPdf: true, createdAt: true,
      fornecedor: { select: { nome: true, nomeFantasia: true, razaoSocial: true, cnpjs: { select: { cnpj: true }, take: 1 } } },
    },
    orderBy: [{ dataEmissao: "desc" }, { id: "desc" }], take: 500,
  });
  return Response.json(l.map((n) => ({
    ...n, valorTotal: n.valorTotal != null ? Number(n.valorTotal) : null,
    fornecedor: (n.fornecedor?.nome || n.fornecedor?.nomeFantasia || n.fornecedor?.razaoSocial || "").toUpperCase(), cnpj: n.fornecedor?.cnpjs?.[0]?.cnpj || "",
  })));
}

// POST { usuarioId, acao: "ler", ids }            → prévia para lançar (mesmo formato da importação de XML)
// POST { usuarioId, acao: "ignorar"|"reativar", ids }
// POST { usuarioId, acao: "ignorarAntes", data }  → ignora as pendentes emitidas antes da data
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const ids = (b.ids || []).map(Number).filter(Boolean);
  if (b.acao === "ignorar" || b.acao === "reativar") {
    const r = await prisma.notaFiscal.updateMany({ where: { id: { in: ids } }, data: { finIgnorada: b.acao === "ignorar" } });
    return Response.json({ ok: true, n: r.count });
  }
  if (b.acao === "ignorarAntes") {
    if (!b.data) return Response.json({ error: "Informe a data." }, { status: 400 });
    const r = await prisma.notaFiscal.updateMany({ where: { finIgnorada: false, titulos: { none: {} }, dataEmissao: { lt: new Date(b.data + "T00:00:00Z") } }, data: { finIgnorada: true } });
    return Response.json({ ok: true, n: r.count });
  }
  // ler
  const nfs = await prisma.notaFiscal.findMany({
    where: { id: { in: ids } },
    include: { fornecedor: { select: { nome: true, nomeFantasia: true, razaoSocial: true, cnpjs: { select: { cnpj: true }, take: 1 } } } },
  });
  const lidos = [];
  for (const nf of nfs) lidos.push(await previaNota("PAGAR", notaParaLeitura(nf), { arquivo: `NF ${nf.numero}`, nfId: nf.id }));
  return Response.json({ lidos, erros: [] });
}
