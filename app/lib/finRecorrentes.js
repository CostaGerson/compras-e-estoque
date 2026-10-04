// Aba de contas recorrentes: lista, crítica contra a Matriz de custos e edição nos dois sentidos.
import { prisma } from "@/lib/prisma";
import { propostasDaMatriz } from "@/lib/finMatrizRec";
import { r2, mesAtual } from "@/lib/finTitulos";

// aceita 1234.56, "1234,56" ou "1.234,56" — a tela manda número, mas não custa garantir
const numBR = (v) => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim().replace(/\s|R\$/g, "");
  if (!t) return 0;
  const x = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

export const FORMAS_PAGAMENTO = {
  PIX: "PIX",
  BOLETO: "Boleto",
  DEBITO_AUTOMATICO: "Débito automático",
  TED: "TED/DOC",
  CARTAO: "Cartão",
  DINHEIRO: "Dinheiro",
  CHEQUE: "Cheque",
};

// Itens da Matriz que são um custo único (dá para escrever o valor de volta).
const AREAS_EDITAVEIS = ["vidaVegetativa", "logistica", "administracao", "sistemas", "dividas"];
export const origemEditavel = (chave) => {
  const p = String(chave || "").split("|");
  return p[0] === "MATRIZ" && AREAS_EDITAVEIS.includes(p[1]) && !!p[2];
};

export async function listar() {
  const [recs, matriz] = await Promise.all([
    prisma.finRecorrencia.findMany({ orderBy: [{ ativo: "desc" }, { diaVencimento: "asc" }, { titulo: "asc" }] }),
    prisma.finMatriz.findFirst({ where: { oficial: true } }),
  ]);

  // valor que a Matriz manda hoje, por chave de origem
  let porChave = {};
  if (matriz) {
    try {
      const { propostas } = propostasDaMatriz(matriz.dados);
      porChave = Object.fromEntries(propostas.map((p) => [p.chave, r2(p.valor)]));
    } catch {}
  }

  const comp = mesAtual();
  const abertos = await prisma.finTitulo.groupBy({
    by: ["recorrenciaId"],
    where: { recorrenciaId: { not: null }, status: "ABERTO" },
    _count: { _all: true },
  }).catch(() => []);
  const nAbertos = Object.fromEntries(abertos.map((a) => [a.recorrenciaId, a._count._all]));

  return {
    competencia: comp,
    formas: FORMAS_PAGAMENTO,
    recorrencias: recs.map((r) => {
      const valor = Number(r.valor);
      const daMatriz = String(r.chaveOrigem || "").startsWith("MATRIZ|");
      const valorMatriz = daMatriz ? porChave[r.chaveOrigem] ?? null : null;
      const divergente = valorMatriz != null && Math.abs(valorMatriz - valor) > 0.009;
      return {
        id: r.id, tipo: r.tipo, titulo: r.titulo, parceiro: r.parceiro, valor,
        diaVencimento: r.diaVencimento, diaUtil: r.diaUtil, formaPagamento: r.formaPagamento,
        inicio: r.inicio, fim: r.fim, ativo: r.ativo, observacao: r.observacao,
        chaveOrigem: r.chaveOrigem, daMatriz,
        valorMatriz, divergente, diferenca: divergente ? r2(valor - valorMatriz) : null,
        podeAtualizarMatriz: divergente && origemEditavel(r.chaveOrigem),
        titulosAbertos: nAbertos[r.id] || 0,
      };
    }),
  };
}

// Escreve o valor da recorrência de volta no item da Matriz oficial.
export async function levarParaMatriz(chaveOrigem, valor, quem) {
  if (!origemEditavel(chaveOrigem)) {
    return { ok: false, erro: "Este valor é calculado pela Matriz (folha, provisão ou cartão) e não pode ser escrito de volta. Ajuste na própria Matriz de custos." };
  }
  const [, area, itemId] = String(chaveOrigem).split("|");
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) return { ok: false, erro: "Matriz oficial não encontrada." };
  const dados = { ...(m.dados || {}) };
  const lista = Array.isArray(dados[area]) ? dados[area] : null;
  if (!lista) return { ok: false, erro: `A Matriz não tem a área ${area}.` };
  const i = lista.findIndex((x) => String(x.id) === String(itemId));
  if (i < 0) return { ok: false, erro: "O item correspondente não existe mais na Matriz." };
  const antes = Number(lista[i].valor);
  dados[area] = lista.map((x, k) => (k === i ? { ...x, valor: r2(valor) } : x));
  await prisma.finMatriz.update({ where: { id: m.id }, data: { dados, atualizadoPor: quem || "CONTAS RECORRENTES" } });
  return { ok: true, item: lista[i].natureza, antes, depois: r2(valor) };
}

// Atualiza a recorrência (e, se pedido, a Matriz e os títulos em aberto deste mês em diante).
export async function atualizar(id, campos, { atualizarMatriz, propagarTitulos = true, quem } = {}) {
  const r = await prisma.finRecorrencia.findUnique({ where: { id: Number(id) } });
  if (!r) return { ok: false, erro: "Recorrência não encontrada." };

  const d = {};
  if ("titulo" in campos) d.titulo = String(campos.titulo || "").toUpperCase();
  if ("parceiro" in campos) d.parceiro = String(campos.parceiro || "").toUpperCase();
  if ("valor" in campos) d.valor = r2(numBR(campos.valor));
  if ("diaVencimento" in campos) d.diaVencimento = Math.min(31, Math.max(1, Number(campos.diaVencimento) || 1));
  if ("diaUtil" in campos) d.diaUtil = !!campos.diaUtil;
  if ("formaPagamento" in campos) d.formaPagamento = campos.formaPagamento ? String(campos.formaPagamento).toUpperCase() : null;
  if ("observacao" in campos) d.observacao = campos.observacao ? String(campos.observacao).toUpperCase() : null;
  if ("ativo" in campos) d.ativo = !!campos.ativo;
  if ("fim" in campos) d.fim = /^\d{4}-\d{2}$/.test(campos.fim || "") ? campos.fim : null;

  await prisma.finRecorrencia.update({ where: { id: r.id }, data: d });

  // títulos em aberto deste mês em diante acompanham o valor/forma (os conferidos à mão ficam)
  let titulos = 0;
  if (propagarTitulos && (d.valor !== undefined || d.formaPagamento !== undefined)) {
    const up = {};
    if (d.valor !== undefined) up.valor = d.valor;
    if (d.formaPagamento !== undefined) up.formaPagamento = d.formaPagamento;
    const res = await prisma.finTitulo.updateMany({
      where: { recorrenciaId: r.id, status: "ABERTO", valorConfirmado: false, competencia: { gte: mesAtual() } },
      data: up,
    });
    titulos = res.count;
  }

  let matriz = null;
  if (atualizarMatriz && d.valor !== undefined) matriz = await levarParaMatriz(r.chaveOrigem, d.valor, quem);

  return { ok: true, titulos, matriz };
}
