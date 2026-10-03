// Baixa de contas a partir do extrato: casa os lançamentos lidos com os títulos previstos
// (mesmo valor, data próxima) e devolve uma sugestão por vez para o usuário autorizar.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const MS_DIA = 86400000;
export const JANELA_DIAS = 12;     // quanto o pagamento pode se afastar do vencimento
export const TOLERANCIA = 0.02;    // centavos de diferença aceitos sem ressalva

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const palavras = (t) => semAcento(t).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 4);

// quanto o histórico do extrato lembra o parceiro/título da conta
function parecenca(lanc, titulo) {
  const alvo = palavras(`${titulo.parceiro} ${titulo.titulo}`);
  if (!alvo.length) return 0;
  const texto = semAcento(`${lanc.historico} ${lanc.identificacao || ""}`);
  const achou = alvo.filter((p) => texto.includes(p)).length;
  return achou / alvo.length;
}

// Sugestões para uma competência (ou para os lançamentos de um arquivo recém-enviado).
export async function sugestoes({ competencia, arquivoId } = {}) {
  const where = { desmembrado: false, substituido: false };
  if (arquivoId) where.arquivoId = Number(arquivoId);
  else if (competencia) where.competencia = competencia;

  const lancamentos = await prisma.finLancamento.findMany({
    where, orderBy: [{ data: "asc" }, { ordem: "asc" }],
    select: { id: true, data: true, historico: true, identificacao: true, valor: true, banco: true, competencia: true },
  });
  if (!lancamentos.length) return { sugestoes: [], lancamentos: 0, titulos: 0 };

  // títulos ainda em aberto, no intervalo de datas dos lançamentos ± janela
  const datas = lancamentos.map((l) => new Date(l.data).getTime());
  const de = new Date(Math.min(...datas) - JANELA_DIAS * MS_DIA);
  const ate = new Date(Math.max(...datas) + JANELA_DIAS * MS_DIA);
  const titulos = await prisma.finTitulo.findMany({
    where: { status: "ABERTO", vencimento: { gte: de, lte: ate } },
    select: { id: true, tipo: true, titulo: true, parceiro: true, valor: true, vencimento: true, formaPagamento: true, numeroDoc: true, recorrenciaId: true, competencia: true },
  });
  if (!titulos.length) return { sugestoes: [], lancamentos: lancamentos.length, titulos: 0 };

  // lançamentos que já deram baixa em alguma conta não entram de novo
  const usados = new Set((await prisma.finTitulo.findMany({ where: { lancamentoId: { not: null } }, select: { lancamentoId: true } })).map((t) => t.lancamentoId));

  const out = [];
  const titulosUsados = new Set();
  for (const l of lancamentos) {
    if (usados.has(l.id)) continue;
    const saida = Number(l.valor) < 0;
    const valor = r2(Math.abs(Number(l.valor)));
    const tipo = saida ? "PAGAR" : "RECEBER";
    const dataL = new Date(l.data);

    const candidatos = titulos
      .filter((t) => t.tipo === tipo && !titulosUsados.has(t.id))
      .map((t) => {
        const dif = r2(Math.abs(Number(t.valor) - valor));
        const dias = Math.round((dataL - new Date(t.vencimento)) / MS_DIA);
        return { t, dif, dias, sim: parecenca(l, t) };
      })
      .filter((c) => c.dif <= Math.max(TOLERANCIA, Number(c.t.valor) * 0.005) && Math.abs(c.dias) <= JANELA_DIAS)
      .sort((a, b) => (a.dif - b.dif) || (Math.abs(a.dias) - Math.abs(b.dias)) || (b.sim - a.sim));

    if (!candidatos.length) continue;
    const c = candidatos[0];
    titulosUsados.add(c.t.id);
    const exato = c.dif <= TOLERANCIA;
    const confianca = exato && Math.abs(c.dias) <= 3 && c.sim >= 0.4 ? "ALTA"
      : exato && Math.abs(c.dias) <= 7 ? "MEDIA" : "BAIXA";
    out.push({
      lancamento: { id: l.id, data: l.data, historico: l.historico, identificacao: l.identificacao, valor: Number(l.valor), banco: l.banco },
      titulo: { id: c.t.id, tipo: c.t.tipo, titulo: c.t.titulo, parceiro: c.t.parceiro, valor: Number(c.t.valor), vencimento: c.t.vencimento, formaPagamento: c.t.formaPagamento, numeroDoc: c.t.numeroDoc },
      diferenca: r2(valor - Number(c.t.valor)),
      dias: c.dias,
      semelhanca: r2(c.sim),
      confianca,
      alternativas: candidatos.length - 1,
    });
  }

  const peso = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
  out.sort((a, b) => peso[a.confianca] - peso[b.confianca] || Math.abs(a.dias) - Math.abs(b.dias));
  return { sugestoes: out, lancamentos: lancamentos.length, titulos: titulos.length };
}

// Dá baixa num título a partir de um lançamento do extrato.
export async function baixar({ tituloId, lancamentoId, quem }) {
  const [t, l] = await Promise.all([
    prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } }),
    prisma.finLancamento.findUnique({ where: { id: Number(lancamentoId) } }),
  ]);
  if (!t) return { ok: false, erro: "Conta não encontrada." };
  if (!l) return { ok: false, erro: "Lançamento não encontrado." };
  if (t.status !== "ABERTO") return { ok: false, erro: "Esta conta já foi baixada ou cancelada." };
  const ja = await prisma.finTitulo.findFirst({ where: { lancamentoId: l.id }, select: { id: true, titulo: true } });
  if (ja) return { ok: false, erro: `Este lançamento já baixou a conta "${ja.titulo}".` };

  const valorPago = r2(Math.abs(Number(l.valor)));
  const up = await prisma.finTitulo.update({
    where: { id: t.id },
    data: {
      status: "PAGO", dataPagamento: l.data, valorPago, lancamentoId: l.id,
      atualizadoPorNome: quem || null,
      observacao: [t.observacao, `BAIXA PELO EXTRATO ${l.banco} EM ${new Date(l.data).toISOString().slice(0, 10).split("-").reverse().join("/")}`].filter(Boolean).join(" · "),
    },
    select: { id: true, titulo: true, valor: true, valorPago: true, dataPagamento: true, status: true },
  });
  return { ok: true, titulo: up, diferenca: r2(valorPago - Number(t.valor)) };
}

// Desfaz a baixa (volta a conta para aberta).
export async function desfazer(tituloId) {
  const t = await prisma.finTitulo.update({
    where: { id: Number(tituloId) },
    data: { status: "ABERTO", dataPagamento: null, valorPago: null, lancamentoId: null },
    select: { id: true, titulo: true },
  }).catch(() => null);
  return t ? { ok: true, titulo: t } : { ok: false, erro: "Conta não encontrada." };
}
