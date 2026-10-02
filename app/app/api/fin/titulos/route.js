export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirContas } from "@/lib/fin";
import { gerarRecorrencias, tituloOut, validarRateio, nomeU, r2, so, mesAtual, dataUTC, mesDe, somaMes } from "@/lib/finTitulos";

const TIPOS = ["PAGAR", "RECEBER"];

// GET ?u=&tipo=PAGAR&de=AAAA-MM&ate=AAAA-MM  → títulos do período + críticas + contas + sugestões
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const tipo = TIPOS.includes(sp.get("tipo")) ? sp.get("tipo") : "PAGAR";
  await garantirContas();
  await gerarRecorrencias(tipo);
  const de = sp.get("de") || mesAtual(), ate = sp.get("ate") || de;
  const hoje = mesAtual();
  const [titulos, atrasados, criticas, contas, parceiros, recs] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo, competencia: { gte: de, lte: ate } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }] }),
    // em aberto de meses anteriores (vencidos) — aparecem sempre
    prisma.finTitulo.findMany({ where: { tipo, status: "ABERTO", competencia: { lt: de } }, orderBy: { vencimento: "asc" } }),
    // recorrências do mês atual (e anteriores em aberto) com valor ainda não conferido
    prisma.finTitulo.findMany({ where: { tipo, recorrenciaId: { not: null }, valorConfirmado: false, status: "ABERTO", competencia: { lte: hoje } }, orderBy: { vencimento: "asc" } }),
    prisma.finConta.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true, ativo: true } }),
    prisma.finTitulo.findMany({ where: { tipo }, distinct: ["parceiro"], select: { parceiro: true, documento: true }, orderBy: { parceiro: "asc" }, take: 2000 }),
    prisma.finRecorrencia.findMany({ where: { tipo }, orderBy: { titulo: "asc" } }),
  ]);
  return Response.json({
    tipo, de, ate,
    titulos: titulos.map(tituloOut), atrasados: atrasados.map(tituloOut), criticas: criticas.map(tituloOut),
    contas, parceiros, recorrencias: recs.map((r) => ({ ...r, valor: Number(r.valor) })),
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
  const base = { tipo, titulo, parceiro, documento: so(b.documento) || null, rateio: rt.rateio, observacao: b.observacao || null };

  if (b.recorrente) {
    const inicio = mesDe(b.vencimento);
    const fim = b.fim ? String(b.fim).slice(0, 7) : null;
    if (fim && fim < inicio) return Response.json({ error: "O fim da recorrência é antes do início." }, { status: 400 });
    const dia = Number(String(b.vencimento).slice(8, 10));
    const r = await prisma.finRecorrencia.create({ data: { ...base, valor, diaVencimento: dia, inicio, fim, criadoPorNome: nomeU(u) } });
    const n = await gerarRecorrencias(tipo);
    // o 1º mês é o que foi lançado agora: já nasce conferido e respeita a chave de previsão
    await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id, competencia: inicio }, data: { valorConfirmado: true, previsao: !!b.previsao, numeroDoc: b.numeroDoc || null, criadoPorId: u.id } });
    return Response.json({ ok: true, recorrenciaId: r.id, gerados: n });
  }
  const t = await prisma.finTitulo.create({
    data: { ...base, numeroDoc: b.numeroDoc || null, valor, vencimento: dataUTC(b.vencimento), competencia: mesDe(b.vencimento), previsao: !!b.previsao, forma: "MANUAL", criadoPorId: u.id, criadoPorNome: nomeU(u) },
  });
  return Response.json(tituloOut(t));
}
