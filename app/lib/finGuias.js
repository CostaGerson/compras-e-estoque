// Guias de INSS e FGTS (Meridian e NORT) — v123
// São contas recorrentes mensais (dia 20) e o valor da recorrência é sempre o ÚLTIMO valor lançado
// (guia importada, valor editado/conferido, posição de títulos). Fica assim até a próxima atualização;
// a Matriz de custos não sobrescreve mais esse valor depois que uma guia foi lançada.
import { prisma } from "@/lib/prisma";
import { r2, mesAtual, gerarRecorrencias } from "@/lib/finTitulos";

export const GUIAS = {
  "MATRIZ|pessoal|INSS": { titulo: "INSS (GPS) — PATRONAL + FUNCIONÁRIOS", parceiro: "RECEITA FEDERAL", conta: "2115120", guia: "INSS", nort: false },
  "MATRIZ|pessoal|FGTS": { titulo: "FGTS", parceiro: "CAIXA ECONÔMICA FEDERAL", conta: "2115120", guia: "FGTS", nort: false },
  "NORT|INSS": { titulo: "NORT - INSS", parceiro: "RECEITA FEDERAL", conta: "2157000", guia: "INSS", nort: true },
  "NORT|FGTS": { titulo: "NORT - FGTS", parceiro: "CAIXA ECONÔMICA FEDERAL", conta: "2157000", guia: "FGTS", nort: true },
};
export const ehGuia = (k) => !!GUIAS[k];
const FLAG = (k) => `GUIA_VALOR|${k}`;

// chaves cujo valor já vem da última guia lançada → { chave: { comp, valor } }
export async function guiasComValor() {
  const l = await prisma.finConfig.findMany({ where: { chave: { startsWith: "GUIA_VALOR|" } } }).catch(() => []);
  const o = {};
  for (const c of l) { try { o[c.chave.slice(11)] = JSON.parse(c.valor); } catch { o[c.chave.slice(11)] = {}; } }
  return o;
}

// Depois de lançar um valor numa conta: se ela é de uma recorrência de guia, o valor vira o da recorrência
// e dos meses seguintes ainda não conferidos. Um lançamento de mês mais antigo não volta o valor para trás.
export async function registrarValorGuia(tituloId, quem) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) }, include: { recorrencia: true } });
  const r = t?.recorrencia;
  if (!r || !ehGuia(r.chaveOrigem) || t.status === "CANCELADO") return null;
  const valor = r2(t.valor);
  if (!(valor > 0)) return null;
  const f = await prisma.finConfig.findUnique({ where: { chave: FLAG(r.chaveOrigem) } }).catch(() => null);
  let ant = null; try { ant = f ? JSON.parse(f.valor) : null; } catch {}
  if (ant?.comp && ant.comp > t.competencia) return null;
  const reg = JSON.stringify({ comp: t.competencia, valor, tituloId: t.id, quem: quem || null, em: new Date().toISOString() });
  await prisma.finConfig.upsert({ where: { chave: FLAG(r.chaveOrigem) }, create: { chave: FLAG(r.chaveOrigem), valor: reg }, update: { valor: reg } });
  await prisma.finRecorrencia.update({ where: { id: r.id }, data: { valor } });
  const n = await prisma.finTitulo.updateMany({
    where: { recorrenciaId: r.id, competencia: { gt: t.competencia }, status: "ABERTO", valorConfirmado: false },
    data: { valor },
  });
  return { chave: r.chaveOrigem, valor, futuros: n.count };
}

// Garante as 4 recorrências (INSS e FGTS, Meridian e NORT) e, uma vez, puxa o último valor já lançado.
const CHAVE_AJUSTE = "AJUSTE|guias-recorrentes-v123";
export async function garantirGuiasRecorrentes() {
  if (!(await prisma.finRecorrencia.count({ where: { chaveOrigem: { not: null } } }))) return null;   // a Matriz ainda não gerou contas
  const existentes = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: Object.keys(GUIAS) } } });
  const tem = new Set(existentes.map((e) => e.chaveOrigem));
  const faltam = Object.keys(GUIAS).filter((k) => !tem.has(k));
  let criadas = 0;
  if (faltam.length) {
    // primeiro pela Matriz (valor e rateio por setor); o que a Matriz não propõe entra com a conta padrão
    const { montarMatrizRec, aplicarMatrizRec } = await import("@/lib/finMatrizRecDb");
    const m = await montarMatrizRec().catch(() => null);
    const daMatriz = (m?.propostas || []).filter((p) => faltam.includes(p.chave) && !p.jaExiste).map((p) => p.chave);
    if (daMatriz.length) { await aplicarMatrizRec({ quem: "AUTOMÁTICO (GUIAS INSS/FGTS)", chaves: daMatriz }); criadas += daMatriz.length; }
    const contas = await prisma.finConta.findMany({ select: { id: true, codigo: true } });
    const idC = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
    for (const k of faltam.filter((x) => !daMatriz.includes(x))) {
      const g = GUIAS[k];
      await prisma.finRecorrencia.create({ data: {
        tipo: "PAGAR", titulo: g.titulo, parceiro: g.parceiro, valor: 0, diaVencimento: 20, diaUtil: false, periodicidade: 1,
        rateio: idC[g.conta] ? [{ contaId: idC[g.conta], pct: 100 }] : [], inicio: mesAtual(),
        observacao: "GUIA MENSAL — VALOR = ÚLTIMA GUIA LANÇADA", chaveOrigem: k, criadoPorNome: "AUTOMÁTICO (GUIAS INSS/FGTS)",
      } });
      criadas++;
    }
    if (criadas) {
      await gerarRecorrencias("PAGAR");
      const { vincularProLaboreAvulso } = await import("@/lib/finMatrizRecDb");
      await vincularProLaboreAvulso().catch(() => 0);   // guia já lançada avulsa no mês assume o lugar da previsão
    }
  }
  // uma vez: o valor da recorrência passa a ser o da última guia já lançada
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_AJUSTE } }).catch(() => null);
  if (!ja) {
    await prisma.finConfig.create({ data: { chave: CHAVE_AJUSTE, valor: new Date().toISOString() } });
    const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: Object.keys(GUIAS) } }, select: { id: true } });
    for (const r of recs) {
      const ult = await prisma.finTitulo.findFirst({
        where: { recorrenciaId: r.id, status: { not: "CANCELADO" }, valor: { gt: 0 }, OR: [{ valorConfirmado: true }, { previsao: false }, { status: "PAGO" }] },
        orderBy: [{ competencia: "desc" }, { id: "desc" }], select: { id: true },
      });
      if (ult) await registrarValorGuia(ult.id, "AUTOMÁTICO (ÚLTIMA GUIA)").catch(() => null);
    }
  }
  return { criadas };
}
