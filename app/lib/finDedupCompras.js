// v148 — Contas a pagar duplicadas de compra: quando a mesma parcela entrou pela NF (XML) e também por outro caminho
// (importar posição, importar documento, manual), fica só a da NF. A outra vai para a Lixeira (30 dias).
// Se a outra já estava paga, a baixa (data, valor, forma, anexos) passa para a conta da NF antes.
// Roda sempre que o contas a pagar abre — vale para as contas antigas e para as próximas.
import { prisma } from "@/lib/prisma";
import { paraLixeira } from "@/lib/finLixeira";

const DIA = 86400000;
const so = (s) => String(s || "").replace(/\D/g, "");
const GEN = new Set("LTDA ME EPP EIRELI SA DE DA DO DAS DOS E EM COMERCIO INDUSTRIA IND COM TEXTIL TEXTEIS TECIDOS".split(" "));
const tk = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 3 && !GEN.has(p));
const ehXml = (t) => t.forma === "NF_XML" || String(t.chaveImport || "").startsWith("NFE|");
const nfDe = (t) => (String(t.numeroDoc || "").match(/NF-?e\s*0*(\d+)/i) || String(t.titulo || "").match(/NF\s*0*(\d+)/i) || [])[1] || null;

export async function deduplicarComprasXml(quem = "SISTEMA") {
  const todas = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", status: { not: "CANCELADO" } },
    select: { id: true, titulo: true, parceiro: true, documento: true, numeroDoc: true, valor: true, vencimento: true, status: true, forma: true,
      chaveImport: true, recorrenciaId: true, nfId: true, rateio: true, dataPagamento: true, valorPago: true, formaPagamento: true, lancamentoId: true, observacao: true },
  });
  const xmls = todas.filter(ehXml);
  if (!xmls.length) return { removidas: 0, linhas: [] };
  const outras = todas.filter((t) => !ehXml(t) && !t.nfId && !t.recorrenciaId && !String(t.chaveImport || "").startsWith("SEMANA|"));
  // índice por valor (centavos) para não comparar tudo com tudo
  const porValor = new Map();
  for (const o of outras) { const k = Math.round(Number(o.valor) * 100); if (!porValor.has(k)) porValor.set(k, []); porValor.get(k).push(o); }
  const usadas = new Set(), r = { removidas: 0, baixasMovidas: 0, linhas: [] };
  for (const x of xmls) {
    const nf = nfDe(x);
    const cand = (porValor.get(Math.round(Number(x.valor) * 100)) || []).filter((o) => !usadas.has(o.id));
    let melhor = null;
    for (const o of cand) {
      const dias = Math.abs(Math.round((new Date(o.vencimento) - new Date(x.vencimento)) / DIA));
      if (dias > 5) continue;
      const dx = so(x.documento), dob = so(o.documento);
      const cnpjOk = dx.length >= 11 && dob.length >= 11 && dx.slice(0, 8) === dob.slice(0, 8);
      const tx = tk(x.parceiro), to = new Set(tk(`${o.parceiro} ${o.titulo}`));
      const nomeOk = tx.length > 0 && tx.filter((p) => to.has(p)).length / tx.length >= 0.5;
      const nfOk = !!nf && new RegExp(`(^|\\D)0*${nf}(\\D|$)`).test(`${o.titulo} ${o.numeroDoc || ""}`);
      if (!(cnpjOk || nomeOk)) continue;
      if (!(nfOk || (cnpjOk && dias === 0))) continue;
      const pontos = (nfOk ? 10 : 0) + (cnpjOk ? 5 : 0) - dias;
      if (!melhor || pontos > melhor.pontos) melhor = { o, pontos };
    }
    if (!melhor) continue;
    const o = melhor.o;
    usadas.add(o.id);
    // a baixa feita na outra conta passa para a da NF
    const dados = {};
    if (o.status === "PAGO" && x.status !== "PAGO") {
      Object.assign(dados, { status: "PAGO", dataPagamento: o.dataPagamento, valorPago: o.valorPago, formaPagamento: x.formaPagamento || o.formaPagamento, lancamentoId: x.lancamentoId || o.lancamentoId, valorConfirmado: true, previsao: false });
      r.baixasMovidas++;
    }
    const temRateio = Array.isArray(x.rateio) && x.rateio.some((q) => Number(q.contaId) && Number(q.pct) > 0);
    if (!temRateio && Array.isArray(o.rateio) && o.rateio.length) dados.rateio = o.rateio;
    dados.observacao = [x.observacao, `UNIFICADA COM "${o.titulo}" (DUPLICADA, LANÇADA POR OUTRO CAMINHO)`].filter(Boolean).join(" · ").slice(0, 1000);
    dados.atualizadoPorNome = quem;
    await prisma.finTitulo.update({ where: { id: x.id }, data: dados });
    await prisma.finTituloAnexo.updateMany({ where: { tituloId: o.id }, data: { tituloId: x.id } });   // anexos vão junto
    const cheia = await prisma.finTitulo.findUnique({ where: { id: o.id } });
    if (cheia) { await paraLixeira(cheia, `${quem} (DUPLICADA DA NF ${nf || ""})`.trim(), "EXCLUIDA"); await prisma.finTitulo.delete({ where: { id: o.id } }); }
    r.removidas++;
    r.linhas.push(`${o.titulo} → ficou ${x.titulo}`);
  }
  return r;
}
