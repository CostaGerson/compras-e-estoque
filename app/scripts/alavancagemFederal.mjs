// v199 — Alavancagem › Passivo tributário: troca as estimativas federais (RFB/PGFN) pela negociação de out/2026.
// Rodar na VPS:  docker exec ce-app node scripts/alavancagemFederal.mjs   (pode rodar de novo)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const d = (s) => new Date(s + "T00:00:00Z");
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NOVOS = [
  { grupo: "RFB", descricao: "PARCELAMENTO RFB 0132127533", valor: 83621.21, parcelado: true, parcelaMensal: 1393.68, parcelas: 60, inicio: d("2026-10-09"),
    observacao: "Nº 0211.00012.0132127533.26-73 · 60X · PARCELA CORRIGIDA PELA SELIC" },
  { grupo: "RFB", descricao: "PARCELAMENTO RFB 0076410593", valor: 161941.64, parcelado: true, parcelaMensal: 2891.81, parcelas: 60, inicio: d("2026-10-30"),
    observacao: "Nº 0211.00012.0076410593.26-73 · 60X · PARCELA CORRIGIDA PELA SELIC" },
  { grupo: "RFB", descricao: "RFB EXIGIBILIDADE SUSPENSA", valor: 1500.94, parcelado: false, inicio: d("2026-10-20"),
    observacao: "PAGAMENTO ÚNICO EM 20/10/2026" },
  { grupo: "PGFN", descricao: "TRANSAÇÃO PGFN 17503166 (SIMPLES NACIONAL)", valor: 448558.39, parcelado: true, parcelaMensal: 2499.60, parcelas: 145, inicio: d("2026-10-30"),
    fases: [{ n: 12, valor: 2499.60 }, { n: 133, valor: 3147.09 }], observacao: "12X 2.499,60 + 133X 3.147,09" },
  { grupo: "PGFN", descricao: "TRANSAÇÃO PGFN 17503168 (PIS/COFINS)", valor: 54046.11, parcelado: true, parcelaMensal: 301.17, parcelas: 145, inicio: d("2026-10-30"),
    fases: [{ n: 12, valor: 301.17 }, { n: 133, valor: 379.18 }], observacao: "12X 301,17 + 133X 379,18" },
  { grupo: "PGFN", descricao: "TRANSAÇÃO PGFN 17503167 (PREVIDENCIÁRIO)", valor: 19006.31, parcelado: true, parcelaMensal: 105.91, parcelas: 60, inicio: d("2026-10-30"),
    fases: [{ n: 12, valor: 105.91 }, { n: 48, valor: 369.48 }], observacao: "12X 105,91 + 48X 369,48" },
];

try {
  const nomes = NOVOS.map((t) => t.descricao);
  const velhos = await prisma.finTributo.findMany({ where: { grupo: { in: ["RFB", "PGFN"] }, descricao: { notIn: nomes } } });
  for (const v of velhos) {
    await prisma.finTributo.delete({ where: { id: v.id } });
    console.log(`− saiu: ${v.grupo} · ${v.descricao} · R$ ${brl(v.valor)}`);
  }
  for (const t of NOVOS) {
    const ja = await prisma.finTributo.findFirst({ where: { descricao: t.descricao } });
    const data = { exigivel: true, competencia: "2026-10", ...t };
    if (ja) await prisma.finTributo.update({ where: { id: ja.id }, data });
    else await prisma.finTributo.create({ data });
    console.log(`${ja ? "= atualizado" : "+ entrou"}: ${t.grupo} · ${t.descricao} · R$ ${brl(t.valor)}`);
  }
  const total = NOVOS.reduce((s, t) => s + t.valor, 0);
  console.log(`\nPassivo federal: R$ ${brl(total)}`);
} catch (e) {
  console.log("ERRO:", e?.message || e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
