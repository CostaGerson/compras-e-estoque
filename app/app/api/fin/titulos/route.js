export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirContas } from "@/lib/fin";
import { garantirRecorrenciasMatriz } from "@/lib/finMatrizRecDb";
import { separarMutuos, ajustarSalarioSabado } from "@/lib/finAjustes";
import { garantirSemanas, limparSemanasAntigas } from "@/lib/finSemana";
import { gerarRecorrencias, ajustarFinsDeSemana, tituloOut, COM_ANEXOS, validarRateio, nomeU, r2, so, mesAtual, dataUTC, mesDe, somaMes } from "@/lib/finTitulos";

const TIPOS = ["PAGAR", "RECEBER"];

// GET ?u=&tipo=PAGAR&de=AAAA-MM&ate=AAAA-MM[&dIni=AAAA-MM-DD&dFim=AAAA-MM-DD]
//   → títulos do mês (cards) + lista do período de datas + vencido total + críticas + contas + sugestões
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const tipo = TIPOS.includes(sp.get("tipo")) ? sp.get("tipo") : "PAGAR";
  await garantirContas();
  { const { limparExpirados } = await import("@/lib/finLixeira"); await limparExpirados(); }   // lixeira: some o que passou de 30 dias
  // compra lançada em dobro (NF XML + posição/documento/manual): fica só a da NF
  const dedupCompras = tipo === "PAGAR" ? await (await import("@/lib/finDedupCompras")).deduplicarComprasXml().catch(() => null) : null;
  if (tipo === "PAGAR") await separarMutuos().catch(() => null);   // mútuos por sócio (uma vez)
  if (tipo === "PAGAR") await ajustarSalarioSabado().catch(() => null);   // salário: 5º dia útil com sábado (uma vez)
  const autoMatriz = tipo === "PAGAR" ? await garantirRecorrenciasMatriz().catch(() => null) : null;
  if (tipo === "PAGAR") { const { garantirGuiasRecorrentes } = await import("@/lib/finGuias"); await garantirGuiasRecorrentes().catch(() => null); }   // INSS/FGTS mensais = última guia
  await gerarRecorrencias(tipo);
  if (tipo === "PAGAR") { const { lancarLote0910 } = await import("@/lib/finLote0910"); await lancarLote0910().catch((e) => console.log("Lote 09/10:", e.message)); }   // v179 — uma vez
  await ajustarFinsDeSemana().catch(() => null);   // sáb/dom → segunda; folha e adiantamento → sexta
  const de0 = sp.get("de") || mesAtual();
  if (tipo === "PAGAR") await limparSemanasAntigas().catch(() => null);
  { const { padronizarNort } = await import("@/lib/finNort"); await padronizarNort().catch(() => null); }   // "NORT - NOME DA CONTA"
  if (tipo === "PAGAR") { const { separarProLabore } = await import("@/lib/finMatrizRecDb"); await separarProLabore().catch(() => null); }
  if (tipo === "PAGAR") { const { separarEstagio } = await import("@/lib/finMatrizRecDb"); await separarEstagio().catch(() => null); }
  if (tipo === "PAGAR") { const { separarGuiasNort } = await import("@/lib/finMatrizRecDb"); await separarGuiasNort().catch(() => null); }
  if (tipo === "PAGAR") { const { encargosSociosAdm } = await import("@/lib/finMatrizRecDb"); await encargosSociosAdm().catch(() => null); }   // implantação: semanas antes de 09/10/2026 saem (uma vez)
  if (tipo === "PAGAR") await garantirSemanas(de0).catch(() => null);   // as duas contas de cada sexta
  const de = sp.get("de") || mesAtual(), ate = sp.get("ate") || de;
  const hoje = mesAtual();
  const okD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const dIni = okD(sp.get("dIni")) ? sp.get("dIni") : null, dFim = okD(sp.get("dFim")) ? sp.get("dFim") : dIni;
  const hojeD = new Date(); const hojeUTC = new Date(Date.UTC(hojeD.getFullYear(), hojeD.getMonth(), hojeD.getDate()));
  if (dIni && dFim && tipo === "PAGAR") {   // garante as sextas do período (até 24 meses)
    let n = 0;
    for (let c = mesDe(dIni); c <= mesDe(dFim) && n < 24; c = somaMes(c, 1), n++) await garantirSemanas(c).catch(() => null);
  }
  const fora = { status: { notIn: ["EXECUCAO", "PERDA"] } };   // v135: execução e perda têm guias próprias
  const [titulos, atrasados, criticas, contas, parceiros, recs, periodo, vencTot] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo, ...fora, competencia: { gte: de, lte: ate } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], include: COM_ANEXOS }),
    // em aberto de meses anteriores (vencidos) — aparecem sempre
    prisma.finTitulo.findMany({ where: { tipo, status: "ABERTO", competencia: { lt: de } }, orderBy: { vencimento: "asc" }, include: COM_ANEXOS }),
    // recorrências do mês atual (e anteriores em aberto) com valor ainda não conferido
    prisma.finTitulo.findMany({ where: { tipo, recorrenciaId: { not: null }, valorConfirmado: false, status: "ABERTO", competencia: { lte: hoje } }, orderBy: { vencimento: "asc" } }),
    prisma.finConta.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true, ativo: true } }),
    prisma.finTitulo.findMany({ where: { tipo }, distinct: ["parceiro"], select: { parceiro: true, documento: true }, orderBy: { parceiro: "asc" }, take: 2000 }),
    prisma.finRecorrencia.findMany({ where: { tipo }, orderBy: { titulo: "asc" } }),
    // lista do período escolhido (de / até, por vencimento)
    dIni ? prisma.finTitulo.findMany({ where: { tipo, ...fora, vencimento: { gte: dataUTC(dIni), lte: dataUTC(dFim) } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], include: COM_ANEXOS }) : null,
    // vencido total: tudo em aberto com vencimento antes de hoje, de qualquer mês
    prisma.finTitulo.aggregate({ where: { tipo, status: "ABERTO", vencimento: { lt: hojeUTC } }, _sum: { valor: true }, _count: true }),
  ]);
  // crítica: contas em aberto sem conta-caixa (as contas da semana se rateiam pelos itens e ficam fora)
  const abertas = await prisma.finTitulo.findMany({ where: { tipo, status: "ABERTO" }, orderBy: { vencimento: "asc" }, include: COM_ANEXOS });
  const semConta = abertas.filter((t) => !String(t.chaveImport || "").startsWith("SEMANA|")
    && !(Array.isArray(t.rateio) && t.rateio.some((r) => Number(r.contaId) && Number(r.pct) > 0)));
  // contas com crítica a conferir (qualquer data) — filtro "Críticas"
  const comCritica = await prisma.finTitulo.findMany({ where: { tipo, critica: { not: null }, status: { notIn: ["CANCELADO"] } }, orderBy: { vencimento: "asc" }, include: COM_ANEXOS });
  const nfsPendentes = tipo === "PAGAR" ? await prisma.notaFiscal.count({ where: { finIgnorada: false, titulos: { none: {} } } }) : 0;
  return Response.json({
    tipo, de, ate, autoMatriz, dIni, dFim, dedupCompras,
    periodo: periodo ? periodo.map(tituloOut) : null,
    semConta: semConta.map(tituloOut), comCritica: comCritica.map(tituloOut),
    vencidoTotal: Number(vencTot._sum.valor || 0), vencidoTotalQtd: vencTot._count || 0,
    titulos: titulos.map(tituloOut), atrasados: atrasados.map(tituloOut), criticas: criticas.map(tituloOut),
    contas, parceiros, nfsPendentes, recorrencias: recs.map((r) => ({ ...r, valor: Number(r.valor) })),
  });
}

// POST → novo título manual (ou recorrência, que gera as previsões)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : "PAGAR";
  const titulo = String(b.titulo || "").trim().toUpperCase();
  const parceiro = String(b.parceiro || "").trim().toUpperCase();
  const valor = r2(b.valor);
  if (!titulo || !parceiro) return Response.json({ error: "Informe título e " + (tipo === "PAGAR" ? "fornecedor." : "cliente.") }, { status: 400 });
  if (!(valor > 0)) return Response.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  if (!b.vencimento) return Response.json({ error: "Informe o vencimento." }, { status: 400 });
  const rt = validarRateio(b.rateio);
  if (rt.erro) return Response.json({ error: rt.erro }, { status: 400 });
  const base = { tipo, titulo, parceiro, documento: so(b.documento) || null, rateio: rt.rateio, observacao: b.observacao || null, formaPagamento: b.formaPagamento ? String(b.formaPagamento).toUpperCase() : null };

  if (b.recorrente) {
    const inicio = mesDe(b.vencimento);
    const fim = b.fim ? String(b.fim).slice(0, 7) : null;
    if (fim && fim < inicio) return Response.json({ error: "O fim da recorrência é antes do início." }, { status: 400 });
    const dia = Number(String(b.vencimento).slice(8, 10));
    const r = await prisma.finRecorrencia.create({ data: { ...base, valor, diaVencimento: dia, inicio, fim, criadoPorNome: nomeU(u) } });
    const n = await gerarRecorrencias(tipo);
    // o 1º mês é o que foi lançado agora: já nasce conferido e respeita a chave de previsão
    await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id, competencia: inicio }, data: { valorConfirmado: true, previsao: !!b.previsao, numeroDoc: b.numeroDoc || null, criadoPorId: u.id } });
    const primeiro = await prisma.finTitulo.findFirst({ where: { recorrenciaId: r.id }, orderBy: { competencia: "asc" }, select: { id: true } });
    return Response.json({ ok: true, recorrenciaId: r.id, gerados: n, id: primeiro?.id || null });
  }
  const t = await prisma.finTitulo.create({
    data: { ...base, numeroDoc: b.numeroDoc || null, valor, vencimento: dataUTC(b.vencimento), competencia: mesDe(b.vencimento), previsao: !!b.previsao, forma: "MANUAL", criadoPorId: u.id, criadoPorNome: nomeU(u) },
  });
  return Response.json(tituloOut(t));
}
