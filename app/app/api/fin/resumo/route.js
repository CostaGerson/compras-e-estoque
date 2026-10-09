export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirTipos } from "@/lib/fin";

// GET ?u=&ano=AAAA → números por mês (competência) + dia/mês/ano corrente (pela data do lançamento)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const ano = String(sp.get("ano") || new Date().getFullYear());
  await garantirTipos();
  const conc = await prisma.finConta.findUnique({ where: { codigo: "3000000" }, select: { id: true } });
  const [ls, tipos, arqs, justs] = await Promise.all([
    prisma.finLancamento.findMany({
      where: { competencia: { startsWith: ano }, substituido: false, desmembrado: false },
      select: { competencia: true, data: true, valor: true, contaId: true, origem: true },
    }),
    prisma.finDocTipo.findMany({ where: { ativo: true }, select: { id: true, qtdEsperada: true } }),
    prisma.finArquivo.findMany({ where: { competencia: { startsWith: ano }, parcial: false }, select: { competencia: true, tipoId: true, prova: true } }),
    prisma.finJustificativa.findMany({ where: { competencia: { startsWith: ano } }, select: { competencia: true, tipoId: true } }),
  ]);
  const vazio = () => ({ entradas: 0, saidas: 0, n: 0, pend: 0, valorPend: 0, conciliacao: 0, hist: 0 });
  const add = (o, l) => {
    const v = Number(l.valor);
    o.n++;
    if (l.origem === "HISTORICO") o.hist++;
    if (!l.contaId) { o.pend++; o.valorPend += v; }
    if (conc && l.contaId === conc.id) { o.conciliacao += v; return; }
    if (v > 0) o.entradas += v; else o.saidas += v;
  };
  const meses = {};
  for (let m = 1; m <= 12; m++) meses[`${ano}-${String(m).padStart(2, "0")}`] = vazio();
  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7);
  const periodo = { dia: vazio(), mes: vazio(), ano: vazio() };
  for (const l of ls) {
    if (meses[l.competencia]) add(meses[l.competencia], l);
    const d = l.data.toISOString().slice(0, 10);
    if (d === hoje) add(periodo.dia, l);
    if (d.slice(0, 7) === mesAtual) add(periodo.mes, l);
    add(periodo.ano, l);
  }
  // documentos do mês: quantos cards ok / justificados / pendentes / com erro
  for (const [comp, o] of Object.entries(meses)) {
    let ok = 0, just = 0, pend = 0, erro = 0;
    for (const t of tipos) {
      const as = arqs.filter((a) => a.competencia === comp && a.tipoId === t.id);
      if (as.some((a) => a.prova && a.prova.ok === false)) erro++;
      else if (as.length >= t.qtdEsperada) ok++;
      else if (justs.some((j) => j.competencia === comp && j.tipoId === t.id)) just++;
      else pend++;
    }
    o.docs = { total: tipos.length, ok, just, pend, erro, enviados: arqs.filter((a) => a.competencia === comp).length };
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  const limpa = (o) => { for (const k of ["entradas", "saidas", "valorPend", "conciliacao"]) o[k] = r2(o[k]); o.resultado = r2(o.entradas + o.saidas); return o; };
  Object.values(meses).forEach(limpa); Object.values(periodo).forEach(limpa);
  return Response.json({ ano, hoje, meses, periodo });
}
