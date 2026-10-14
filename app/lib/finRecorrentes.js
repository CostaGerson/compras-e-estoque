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
        podeAtualizarMatriz: divergente && origemEditavel(r.chaveOrigem),
        titulosAbertos: nAbertos[r.id] || 0,
        foraMatriz: r.tipo === "PAGAR" && !ehEspelho(r.chaveOrigem) && !/^(IMPOSTO|CARTAO)\|/.test(String(r.chaveOrigem || "")) && !vistada,   // v200: impostos sobre vendas têm regra própria   // v194: recorrente lançada à mão (não vem da Matriz)
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

// Atualiza a recorrência (e, se pedido, a Matriz e os títulos em aberto deste mês em diante).
export async function atualizar(id, campos, { atualizarMatriz, propagarTitulos = true, quem } = {}) {
  const r = await prisma.finRecorrencia.findUnique({ where: { id: Number(id) } });
  if (!r) return { ok: false, erro: "Recorrência não encontrada." };

  // v192 — conta que espelha a Matriz: nome/fornecedor/valor/dia/periodicidade/ativo vão para a Matriz (e voltam pelo espelho);
  // aqui ficam só forma de pagamento e observação
  if (ehEspelho(r.chaveOrigem)) {
    const loc = {};
    if ("formaPagamento" in campos) loc.formaPagamento = campos.formaPagamento ? String(campos.formaPagamento).toUpperCase() : null;
    if ("observacao" in campos) loc.observacao = campos.observacao ? String(campos.observacao).toUpperCase() : null;
    if (Object.keys(loc).length) {
      await prisma.finRecorrencia.update({ where: { id: r.id }, data: loc });
      if (loc.formaPagamento !== undefined) await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id, status: "ABERTO", pontual: false, competencia: { gte: mesAtual() } }, data: { formaPagamento: loc.formaPagamento } });
    }
    const chaves = ["titulo", "parceiro", "valor", "diaVencimento", "periodicidade", "ativo"];
    const mudou = chaves.filter((k) => k in campos && String(campos[k] ?? "") !== String(k === "valor" ? Number(r.valor) : r[k] ?? ""));
    if (!mudou.length) return { ok: true, titulos: 0, matriz: null };
    if (!origemEditavel(r.chaveOrigem)) return { ok: false, erro: "Esta conta é calculada pela Matriz (folha, provisão, NORT ou cartão). Nome, valor e vencimento se alteram na Matriz de custos; aqui só forma de pagamento e observação." };
    const res = await alterarItemMatriz(r.chaveOrigem, Object.fromEntries(mudou.map((k) => [k, campos[k]])), quem);
    if (!res.ok) return res;
    return { ok: true, titulos: res.sinc?.atualizadas || 0, matriz: { ok: true, item: res.item, depois: "ajustada" } };
  }
  const d = {};
  if ("titulo" in campos) d.titulo = String(campos.titulo || "").toUpperCase();
  if ("parceiro" in campos) d.parceiro = String(campos.parceiro || "").toUpperCase();
  if ("valor" in campos) d.valor = r2(numBR(campos.valor));
  if ("diaVencimento" in campos) d.diaVencimento = Math.min(31, Math.max(1, Number(campos.diaVencimento) || 1));
  if ("diaUtil" in campos) d.diaUtil = !!campos.diaUtil;
  if ("periodicidade" in campos) d.periodicidade = Math.max(1, Math.min(12, Number(campos.periodicidade) || 1));
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
      where: { recorrenciaId: r.id, status: "ABERTO", valorConfirmado: false, pontual: false, competencia: { gte: mesAtual() } },
      data: up,
    });
    titulos = res.count;
  }

  let matriz = null;
  if (atualizarMatriz && d.valor !== undefined) matriz = await levarParaMatriz(r.chaveOrigem, d.valor, quem);

  return { ok: true, titulos, matriz };
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
    if (origemEditavel(r.chaveOrigem)) {
      const res = await alterarItemMatriz(r.chaveOrigem, { valor: novo }, quem);
      if (!res.ok) return res;
    } else if (!ehEspelho(r.chaveOrigem) || ehGuia(r.chaveOrigem)) {
      await prisma.finRecorrencia.update({ where: { id: r.id }, data: { valor: novo } });
      const u = await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id, status: "ABERTO", pontual: false, valorConfirmado: false, competencia: { gte: mesAtual() } }, data: { valor: novo } });
      titulos = u.count;
      if (ehGuia(r.chaveOrigem)) {   // a guia passa a valer este valor (a Matriz não sobrescreve)
        const reg = JSON.stringify({ comp: mesAtual(), valor: novo, quem: quem || null, em: new Date().toISOString(), visto: true });
        const k = `GUIA_VALOR|${r.chaveOrigem}`;
        await prisma.finConfig.upsert({ where: { chave: k }, create: { chave: k, valor: reg }, update: { valor: reg } });
      }
    } else {
      return { ok: false, erro: "Valor calculado pela Matriz (folha, provisão, NORT ou cartão): para mudar, altere a Matriz de custos. Para mudar só um mês, edite a conta no contas a pagar. Vistar sem mudar o valor aceita a conta como está." };
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
    if (!origemEditavel(r.chaveOrigem)) return { ok: false, erro: "Esta conta é calculada pela Matriz (folha, provisão, NORT ou cartão) — para tirá-la, altere a Matriz de custos." };
    const res = await alterarItemMatriz(r.chaveOrigem, { ativo: false }, quem);
    if (!res.ok) return res;
    return { ok: true, titulo: r.titulo, daMatriz: true, previsoesApagadas: 0, valorApagado: 0, titulosMantidos: 0, pelaMatriz: true };
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
