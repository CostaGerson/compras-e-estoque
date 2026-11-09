// Aba de contas recorrentes: lista, crítica contra a Matriz de custos e edição nos dois sentidos.
import { prisma } from "@/lib/prisma";
import { propostasDaMatriz } from "@/lib/finMatrizRec";
import { r2, mesAtual, vencNoMes, ajustaFds, contaSabado, ehFolha, gerarRecorrencias } from "@/lib/finTitulos";

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
      const daMatriz = ehEspelho(r.chaveOrigem);
      const valorMatriz = daMatriz ? porChave[r.chaveOrigem] ?? null : null;
      // v195 — vistada: aceita como está enquanto o valor da conta e o da Matriz não mudarem
      const vistada = !!r.vistoEm && r.vistoValor != null && Math.abs(Number(r.vistoValor) - valor) < 0.01
        && (valorMatriz == null ? r.vistoMatriz == null : r.vistoMatriz != null && Math.abs(Number(r.vistoMatriz) - valorMatriz) < 0.01);
      const divergente = !vistada && valorMatriz != null && Math.abs(valorMatriz - valor) > 0.009;
      return {
        id: r.id, tipo: r.tipo, titulo: r.titulo, parceiro: r.parceiro, valor,
        diaVencimento: r.diaVencimento, diaUtil: r.diaUtil, periodicidade: r.periodicidade || 1, formaPagamento: r.formaPagamento,
        inicio: r.inicio, fim: r.fim, ativo: r.ativo, observacao: r.observacao,
        chaveOrigem: r.chaveOrigem, daMatriz,
        valorMatriz, divergente, diferenca: divergente ? r2(valor - valorMatriz) : null,
        podeAtualizarMatriz: false,   // v697 — a recorrente não mexe na Matriz
        titulosAbertos: nAbertos[r.id] || 0,
        foraMatriz: false,   // v697 — recorrente fora da Matriz é permitida (eventual, com prazo)   // v200: impostos sobre vendas têm regra própria   // v194: recorrente lançada à mão (não vem da Matriz)
        extraMatriz: r.tipo === "PAGAR" && !ehEspelho(r.chaveOrigem),
        vistada, vistoEm: r.vistoEm, vistoPor: r.vistoPor,
      };
    }),
  };
}

export const ehEspelho = (chave) => /^(MATRIZ|NORT)\|/.test(String(chave || ""));   // v212: cartão fora

// v192 — escreve nome, fornecedor, valor, dia, periodicidade e ativo no item da Matriz oficial (itens de custo único)
export async function alterarItemMatriz(chaveOrigem, campos, quem) {
  if (!origemEditavel(chaveOrigem)) return { ok: false, erro: "Esta conta é calculada pela Matriz (folha, provisão, NORT ou cartão) — altere na própria Matriz de custos." };
  const [, area, itemId] = String(chaveOrigem).split("|");
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) return { ok: false, erro: "Matriz oficial não encontrada." };
  const dados = { ...(m.dados || {}) };
  const lista = Array.isArray(dados[area]) ? dados[area] : null;
  const i = lista ? lista.findIndex((x) => String(x.id) === String(itemId)) : -1;
  if (i < 0) return { ok: false, erro: "O item correspondente não existe mais na Matriz." };
  const it = { ...lista[i] };
  if (campos.titulo !== undefined && String(campos.titulo).trim()) it.natureza = String(campos.titulo).toUpperCase();
  if (campos.parceiro !== undefined) it.parceiro = String(campos.parceiro || "").toUpperCase() || undefined;
  if (campos.diaVencimento !== undefined) it.dia = Math.min(31, Math.max(1, Number(campos.diaVencimento) || 1));
  if (campos.periodicidade !== undefined) it.periodicidade = Math.max(1, Math.min(12, Number(campos.periodicidade) || 1));
  if (campos.valor !== undefined) {
    const v = r2(numBR(campos.valor)), per = Math.max(1, Number(it.periodicidade) || 1);
    if (per > 1) { it.valorParcela = v; it.valor = r2(v / per); } else { it.valor = v; delete it.valorParcela; }
  }
  if (campos.ativo !== undefined) it.ativo = !!campos.ativo;
  dados[area] = lista.map((x, k) => (k === i ? it : x));
  await prisma.finMatriz.update({ where: { id: m.id }, data: { dados, atualizadoPor: quem || "CONTAS RECORRENTES" } });
  const { sincronizarMatriz } = await import("@/lib/finMatrizRecDb");
  const sinc = await sincronizarMatriz(quem).catch((e) => ({ erro: e.message }));
  return { ok: true, item: it.natureza, sinc };
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

// Atualiza a recorrência e as contas em aberto deste mês em diante (menos as alteradas pontualmente ou conferidas).
// v697 — regra: a Matriz mexe nas recorrentes, a recorrente NÃO mexe na Matriz. Conta que vem da Matriz pode ser
// ajustada aqui (fica até a Matriz mudar aquele item); só não pode ser encerrada/desativada, porque todo item da Matriz é recorrente.
export async function atualizar(id, campos, { quem } = {}) {
  const r = await prisma.finRecorrencia.findUnique({ where: { id: Number(id) } });
  if (!r) return { ok: false, erro: "Recorrência não encontrada." };
  const espelho = ehEspelho(r.chaveOrigem);
  const d = {};
  if ("titulo" in campos && String(campos.titulo || "").trim()) d.titulo = String(campos.titulo).trim().toUpperCase();
  if ("parceiro" in campos && String(campos.parceiro || "").trim()) d.parceiro = String(campos.parceiro).trim().toUpperCase();
  if ("valor" in campos) { d.valor = r2(numBR(campos.valor)); if (!(d.valor >= 0)) return { ok: false, erro: "Valor inválido." }; }
  if ("diaVencimento" in campos) d.diaVencimento = Math.min(31, Math.max(1, Number(campos.diaVencimento) || 1));
  if ("diaUtil" in campos) d.diaUtil = !!campos.diaUtil;
  if ("periodicidade" in campos) d.periodicidade = Math.max(1, Math.min(12, Number(campos.periodicidade) || 1));
  if ("formaPagamento" in campos) d.formaPagamento = campos.formaPagamento ? String(campos.formaPagamento).toUpperCase() : null;
  if ("observacao" in campos) d.observacao = campos.observacao ? String(campos.observacao).toUpperCase() : null;
  if ("ativo" in campos) d.ativo = !!campos.ativo;
  if ("fim" in campos) d.fim = /^\d{4}-\d{2}$/.test(campos.fim || "") ? campos.fim : null;
  if (espelho && ((d.ativo === false && r.ativo) || (d.fim && d.fim !== r.fim))) {
    return { ok: false, erro: "Esta conta vem da Matriz de custos: para encerrar ou desativar, tire o item da Matriz (toda conta da Matriz fica nas recorrentes)." };
  }
  if (espelho) { delete d.ativo; delete d.fim; }
  if (d.fim && d.fim < r.inicio) return { ok: false, erro: "O fim é antes do início da recorrência." };
  // nada mudou?
  const igual = (k) => String(k === "valor" ? r2(Number(r.valor)) : r[k] ?? "") === String(d[k] ?? "");
  for (const k of Object.keys(d)) if (igual(k)) delete d[k];
  if (!Object.keys(d).length) return { ok: true, titulos: 0 };

  if (espelho) { const { garantirSnap } = await import("@/lib/finMatrizRecDb"); await garantirSnap(r).catch(() => null); }
  const rec = await prisma.finRecorrencia.update({ where: { id: r.id }, data: d });

  const comp = mesAtual();
  const livres = { recorrenciaId: r.id, status: "ABERTO", valorConfirmado: false, pontual: false, competencia: { gte: comp } };
  // encerrou / desativou / mudou a periodicidade → apaga as previsões livres e gera de novo
  let apagadas = 0;
  if (d.ativo === false || d.periodicidade !== undefined || ("fim" in d && d.fim)) {
    const where = d.ativo === false || d.periodicidade !== undefined ? livres : { ...livres, competencia: { gt: d.fim } };
    apagadas = (await prisma.finTitulo.deleteMany({ where: { ...where, vencimentoOriginal: null } })).count;
  }
  // as previsões que ficaram acompanham nome, fornecedor, valor, forma e vencimento
  let titulos = 0;
  const tits = await prisma.finTitulo.findMany({ where: livres });
  for (const t of tits) {
    const up = {};
    if (d.titulo) up.titulo = rec.titulo;
    if (d.parceiro) up.parceiro = rec.parceiro;
    if (d.valor !== undefined) up.valor = rec.valor;
    if (d.formaPagamento !== undefined) up.formaPagamento = rec.formaPagamento;
    if ((d.diaVencimento !== undefined || d.diaUtil !== undefined) && !t.vencimentoOriginal) up.vencimento = ajustaFds(vencNoMes(t.competencia, rec.diaVencimento, rec.diaUtil, contaSabado(rec)), ehFolha(rec));
    if (Object.keys(up).length) { await prisma.finTitulo.update({ where: { id: t.id }, data: up }); titulos++; }
  }
  const geradas = rec.ativo ? await gerarRecorrencias(rec.tipo) : 0;
  return { ok: true, titulos, apagadas, geradas, quem };
}

// v195 — vistar: considera a conta conferida, mantendo ou mudando o valor.
//  · custo único da Matriz → o valor novo vai para a Matriz (e o espelho leva às contas)
//  · guia INSS/FGTS ou conta fora da Matriz → muda a recorrência e as contas em aberto deste mês em diante (menos as pontuais)
//  · calculada pela Matriz (folha, provisão, NORT, cartão) → só aceita como está (valor se muda na Matriz)
export async function vistar(id, valor, { quem } = {}) {
  let r = await prisma.finRecorrencia.findUnique({ where: { id: Number(id) } });
  if (!r) return { ok: false, erro: "Recorrência não encontrada." };
  const novo = valor === undefined || valor === null || valor === "" ? Number(r.valor) : r2(numBR(valor));
  if (!(novo >= 0)) return { ok: false, erro: "Valor inválido." };
  let titulos = 0;
  if (Math.abs(novo - Number(r.valor)) > 0.009) {
    const { ehGuia } = await import("@/lib/finGuias");
    if (ehEspelho(r.chaveOrigem)) { const { garantirSnap } = await import("@/lib/finMatrizRecDb"); await garantirSnap(r).catch(() => null); }
    {   // v697 — vale só para a recorrência (e as contas em aberto); a Matriz não muda
      await prisma.finRecorrencia.update({ where: { id: r.id }, data: { valor: novo } });
      const u = await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id, status: "ABERTO", pontual: false, valorConfirmado: false, competencia: { gte: mesAtual() } }, data: { valor: novo } });
      titulos = u.count;
      if (ehGuia(r.chaveOrigem)) {   // a guia passa a valer este valor (a Matriz não sobrescreve)
        const reg = JSON.stringify({ comp: mesAtual(), valor: novo, quem: quem || null, em: new Date().toISOString(), visto: true });
        const k = `GUIA_VALOR|${r.chaveOrigem}`;
        await prisma.finConfig.upsert({ where: { chave: k }, create: { chave: k, valor: reg }, update: { valor: reg } });
      }
    }
    r = await prisma.finRecorrencia.findUnique({ where: { id: r.id } });
  }
  let valorMatriz = null;
  if (ehEspelho(r.chaveOrigem)) {
    const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
    try { valorMatriz = (propostasDaMatriz(m.dados).propostas.find((p) => p.chave === r.chaveOrigem) || {}).valor ?? null; } catch { valorMatriz = null; }
  }
  await prisma.finRecorrencia.update({ where: { id: r.id }, data: { vistoEm: new Date(), vistoPor: quem || null, vistoValor: r.valor, vistoMatriz: valorMatriz == null ? null : r2(valorMatriz) } });
  return { ok: true, titulo: r.titulo, valor: Number(r.valor), titulos };
}

// Exclui a recorrência e as previsões futuras que ela gerou.
// Conta já paga ou com valor conferido à mão fica — ela é histórico, não previsão.
export async function excluir(id, { quem } = {}) {
  const r = await prisma.finRecorrencia.findUnique({ where: { id: Number(id) } });
  if (!r) return { ok: false, erro: "Recorrência não encontrada." };
  // v192 — conta da Matriz: exclui na Matriz (item desativado) e o espelho encerra a recorrência
  if (ehEspelho(r.chaveOrigem) && !(r.chaveOrigem === "MATRIZ|pessoal|INSS" || r.chaveOrigem === "MATRIZ|pessoal|FGTS" || /^NORT\|(INSS|FGTS)$/.test(r.chaveOrigem))) {
    // v697 — recorrente não mexe na Matriz: conta da Matriz sai tirando o item da própria Matriz
    return { ok: false, erro: `"${r.titulo}" vem da Matriz de custos — para excluir, tire o item da Matriz (a recorrente sai junto).` };
  }

  const titulos = await prisma.finTitulo.findMany({
    where: { recorrenciaId: r.id },
    select: { id: true, status: true, valorConfirmado: true, competencia: true, valor: true },
  });
  const comp = mesAtual();
  const apagar = titulos.filter((t) => t.status === "ABERTO" && !t.valorConfirmado && t.competencia >= comp);
  const ficam = titulos.length - apagar.length;

  if (apagar.length) await prisma.finTitulo.deleteMany({ where: { id: { in: apagar.map((t) => t.id) } } });
  // o que sobrou perde o vínculo, senão a exclusão da recorrência é barrada
  if (ficam) await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id }, data: { recorrenciaId: null } });
  await prisma.finRecorrencia.delete({ where: { id: r.id } });

  return {
    ok: true,
    titulo: r.titulo,
    daMatriz: String(r.chaveOrigem || "").startsWith("MATRIZ|"),
    previsoesApagadas: apagar.length,
    valorApagado: r2(apagar.reduce((s, t) => s + Number(t.valor), 0)),
    titulosMantidos: ficam,
  };
}
