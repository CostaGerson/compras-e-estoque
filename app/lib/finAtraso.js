// v135 — Contas a receber atrasadas: EM COBRANÇA (padrão) → EM EXECUÇÃO (cobrança judicial) ou PERDA RECONHECIDA.
// - Execução: a conta sai do contas a receber e entra numa execução judicial (várias contas por execução),
//   com anexos do processo e evolução mensal em texto. O que for recuperado entra na DRE como
//   1119000 RECEBIMENTO DE EXECUÇÃO JUDICIAL (receita).
// - Perda: exige justificativa; a conta sai do contas a receber e gera um lançamento na DRE do mês
//   (2143000 PERDA RECONHECIDA DE CLIENTES, abate a receita).
import { prisma } from "@/lib/prisma";
import { garantirContas } from "@/lib/fin";
import { createHash } from "crypto";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const up = (s) => String(s || "").toUpperCase().trim();
const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const mes = (s) => String(s).slice(0, 7);
const dBR = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "");
export const CONTA_EXECUCAO = "1119000";
export const CONTA_PERDA = "2143000";

async function contaId(codigo) {
  await garantirContas();
  const c = await prisma.finConta.findUnique({ where: { codigo }, select: { id: true } });
  if (!c) throw new Error(`Conta-caixa ${codigo} não encontrada.`);
  return c.id;
}
const diasAtraso = (venc) => Math.max(0, Math.floor((dUTC(hojeISO()) - new Date(venc)) / 86400000));
const tOut = (t) => ({
  id: t.id, titulo: t.titulo, parceiro: t.parceiro, documento: t.documento, numeroDoc: t.numeroDoc, valor: Number(t.valor),
  vencimento: t.vencimento.toISOString().slice(0, 10), competencia: t.competencia, status: t.status, diasAtraso: diasAtraso(t.vencimento),
  execucaoId: t.execucaoId, observacao: t.observacao, cobranca: t.cobranca,
  dataPagamento: t.dataPagamento ? t.dataPagamento.toISOString().slice(0, 10) : null, valorPago: t.valorPago != null ? Number(t.valorPago) : null,
  perdaJustificativa: t.perdaJustificativa, perdaData: t.perdaData ? t.perdaData.toISOString().slice(0, 10) : null, perdaPorNome: t.perdaPorNome,
});
const anota = (obs, txt) => [obs, txt].filter(Boolean).join(" · ").slice(0, 1000);

// ---------------- leitura ----------------
export async function visaoAtraso() {
  const hoje = dUTC(hojeISO());
  const [atrasadas, perdas, execs] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "ABERTO", vencimento: { lt: hoje } }, orderBy: { vencimento: "asc" } }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "PERDA" }, orderBy: [{ perdaData: "desc" }, { id: "desc" }] }),
    listarExecucoes(),
  ]);
  return { atrasadas: atrasadas.map(tOut), perdas: perdas.map(tOut), execucoes: execs, mesAtual: mes(hojeISO()) };
}

export async function listarExecucoes() {
  const l = await prisma.finExecucao.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      titulos: { orderBy: { vencimento: "asc" } },
      evolucoes: { orderBy: { competencia: "desc" }, take: 1 },
      _count: { select: { anexos: true, evolucoes: true } },
    },
  });
  const mAt = mes(hojeISO());
  return l.map((e) => {
    const emAberto = e.titulos.filter((t) => t.status === "EXECUCAO");
    const recebidos = e.titulos.filter((t) => t.status === "PAGO");
    return {
      id: e.id, titulo: e.titulo, processo: e.processo, cliente: e.cliente, vara: e.vara, advogado: e.advogado, status: e.status,
      dataAbertura: e.dataAbertura ? e.dataAbertura.toISOString().slice(0, 10) : null, observacao: e.observacao,
      valorEmExecucao: r2(emAberto.reduce((s, t) => s + Number(t.valor), 0)),
      valorRecuperado: r2(recebidos.reduce((s, t) => s + Number(t.valorPago ?? t.valor), 0)),
      qtdTitulos: e.titulos.length, qtdAnexos: e._count.anexos, qtdEvolucoes: e._count.evolucoes,
      ultimaEvolucao: e.evolucoes[0] ? { competencia: e.evolucoes[0].competencia, texto: e.evolucoes[0].texto } : null,
      evolucaoPendente: e.status === "ATIVA" && e.evolucoes[0]?.competencia !== mAt,
      titulos: e.titulos.map(tOut),
    };
  });
}

export async function detalheExecucao(id) {
  const e = await prisma.finExecucao.findUnique({
    where: { id: Number(id) },
    include: {
      titulos: { orderBy: { vencimento: "asc" } },
      evolucoes: { orderBy: { competencia: "desc" } },
      anexos: { orderBy: { createdAt: "desc" }, select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true } },
    },
  });
  if (!e) return null;
  const resumo = (await listarExecucoes()).find((x) => x.id === e.id);
  return {
    ...resumo,
    evolucoes: e.evolucoes.map((v) => ({ id: v.id, competencia: v.competencia, texto: v.texto, criadoPorNome: v.criadoPorNome, updatedAt: v.updatedAt })),
    anexos: e.anexos,
  };
}

// ---------------- mover ----------------
async function abertasVencidas(ids) {
  const l = await prisma.finTitulo.findMany({ where: { id: { in: ids.map(Number) } } });
  for (const t of l) {
    if (t.tipo !== "RECEBER") throw new Error(`${t.titulo}: não é conta a receber.`);
    if (t.status !== "ABERTO") throw new Error(`${t.titulo}: só contas em aberto (em cobrança) podem ser movidas.`);
  }
  if (!l.length) throw new Error("Escolha ao menos uma conta.");
  return l;
}

// destino: { execucaoId } ou { nova: { titulo, processo, cliente, vara, advogado, dataAbertura, observacao } }
export async function moverParaExecucao(ids, destino, quem) {
  const l = await abertasVencidas(ids);
  let exId = Number(destino?.execucaoId) || null;
  if (!exId) {
    const n = destino?.nova || {};
    const titulo = up(n.titulo) || up(`EXECUÇÃO ${l[0].parceiro}`);
    const e = await prisma.finExecucao.create({
      data: {
        titulo, processo: up(n.processo) || null, cliente: up(n.cliente) || up(l[0].parceiro), vara: up(n.vara) || null,
        advogado: up(n.advogado) || null, dataAbertura: n.dataAbertura ? dUTC(n.dataAbertura) : dUTC(hojeISO()),
        observacao: n.observacao ? String(n.observacao) : null, criadoPorNome: quem || null,
      },
    });
    exId = e.id;
  } else if (!(await prisma.finExecucao.findUnique({ where: { id: exId }, select: { id: true } }))) throw new Error("Execução não encontrada.");
  for (const t of l) {
    await prisma.finTitulo.update({
      where: { id: t.id },
      data: { status: "EXECUCAO", execucaoId: exId, atualizadoPorNome: quem || null, observacao: anota(t.observacao, `EM EXECUÇÃO JUDICIAL DESDE ${dBR(dUTC(hojeISO()))}`) },
    });
  }
  await prisma.finExecucao.update({ where: { id: exId }, data: { updatedAt: new Date() } });
  return { execucaoId: exId, movidas: l.length };
}

export async function reconhecerPerda(ids, { justificativa, data }, quem) {
  const just = String(justificativa || "").trim();
  if (just.length < 10) throw new Error("Escreva a justificativa da perda (mínimo de 10 caracteres).");
  const l = await abertasVencidas(ids);
  const cId = await contaId(CONTA_PERDA);
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(String(data || "")) ? data : hojeISO();
  for (const t of l) {
    const lanc = await prisma.finLancamento.create({
      data: {
        competencia: mes(dt), banco: "PERDAS RECONHECIDAS", data: dUTC(dt),
        historico: up(`PERDA RECONHECIDA · ${t.titulo} · ${t.parceiro}`).slice(0, 300), documento: t.numeroDoc || null,
        identificacao: up(just).slice(0, 300), valor: -r2(t.valor), contaId: cId, origem: "PERDA", identificadoPor: quem || null,
      },
    });
    await prisma.finTitulo.update({
      where: { id: t.id },
      data: { status: "PERDA", perdaJustificativa: just, perdaData: dUTC(dt), perdaPorNome: quem || null, perdaLancamentoId: lanc.id, atualizadoPorNome: quem || null },
    });
  }
  return { perdas: l.length, valor: r2(l.reduce((s, t) => s + Number(t.valor), 0)), competencia: mes(dt) };
}

// volta para EM COBRANÇA (desfaz execução ou perda)
export async function voltarParaCobranca(id, quem) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!t || !["EXECUCAO", "PERDA"].includes(t.status)) throw new Error("Só contas em execução ou em perda podem voltar para cobrança.");
  if (t.status === "PERDA" && t.perdaLancamentoId) await prisma.finLancamento.delete({ where: { id: t.perdaLancamentoId } }).catch(() => null);
  await prisma.finTitulo.update({
    where: { id: t.id },
    data: {
      status: "ABERTO", execucaoId: null, perdaJustificativa: null, perdaData: null, perdaPorNome: null, perdaLancamentoId: null,
      atualizadoPorNome: quem || null, observacao: anota(t.observacao, `VOLTOU PARA COBRANÇA EM ${dBR(dUTC(hojeISO()))}`),
    },
  });
  return { ok: true };
}

// conta em execução recebida (acordo / bloqueio judicial): baixa com a conta-caixa da execução
export async function receberNaExecucao(id, { data, valor }, quem) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!t || t.status !== "EXECUCAO") throw new Error("A conta não está em execução.");
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(String(data || "")) ? data : hojeISO();
  const v = r2(valor) > 0 ? r2(valor) : r2(t.valor);
  const cId = await contaId(CONTA_EXECUCAO);
  await prisma.finTitulo.update({
    where: { id: t.id },
    data: {
      status: "PAGO", dataPagamento: dUTC(dt), valorPago: v, rateio: [{ contaId: cId, pct: 100 }], atualizadoPorNome: quem || null,
      observacao: anota(t.observacao, `RECEBIDO NA EXECUÇÃO EM ${dBR(dUTC(dt))}`),
    },
  });
  if (t.execucaoId) await prisma.finExecucao.update({ where: { id: t.execucaoId }, data: { updatedAt: new Date() } });
  return { ok: true };
}

// ---------------- execução: dados, evolução e anexos ----------------
export async function salvarExecucao(id, d) {
  const data = {};
  for (const k of ["titulo", "processo", "cliente", "vara", "advogado"]) if (d[k] !== undefined) data[k] = up(d[k]) || (k === "titulo" ? undefined : null);
  if (d.observacao !== undefined) data.observacao = d.observacao ? String(d.observacao) : null;
  if (d.dataAbertura !== undefined) data.dataAbertura = d.dataAbertura ? dUTC(d.dataAbertura) : null;
  if (d.status !== undefined) data.status = d.status === "ENCERRADA" ? "ENCERRADA" : "ATIVA";
  if (data.titulo === undefined) delete data.titulo;
  await prisma.finExecucao.update({ where: { id: Number(id) }, data });
  return detalheExecucao(id);
}

export async function salvarEvolucao(execucaoId, competencia, texto, quem) {
  if (!/^\d{4}-\d{2}$/.test(String(competencia || ""))) throw new Error("Mês inválido.");
  const tx = String(texto || "").trim();
  if (!tx) throw new Error("Escreva a evolução do mês.");
  await prisma.finExecucaoEvolucao.upsert({
    where: { execucaoId_competencia: { execucaoId: Number(execucaoId), competencia } },
    create: { execucaoId: Number(execucaoId), competencia, texto: tx, criadoPorNome: quem || null },
    update: { texto: tx, criadoPorNome: quem || null },
  });
  await prisma.finExecucao.update({ where: { id: Number(execucaoId) }, data: { updatedAt: new Date() } });
  return detalheExecucao(execucaoId);
}

export async function anexarExecucao(execucaoId, arquivos, quem) {
  let n = 0;
  for (const a of arquivos || []) {
    if (!a?.conteudo) continue;
    const hash = createHash("sha256").update(Buffer.from(a.conteudo, "base64")).digest("hex");
    const ja = await prisma.finExecucaoAnexo.findFirst({ where: { execucaoId: Number(execucaoId), hash }, select: { id: true } });
    if (ja) continue;
    await prisma.finExecucaoAnexo.create({
      data: { execucaoId: Number(execucaoId), nome: String(a.nome || "arquivo"), mime: a.mime || null, tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, hash, criadoPorNome: quem || null },
    });
    n++;
  }
  return n;
}

// ---------------- painel de previsão ----------------
export async function numerosPainel(competencia) {
  const [exec, perdas] = await Promise.all([
    prisma.finTitulo.aggregate({ where: { tipo: "RECEBER", status: "EXECUCAO" }, _sum: { valor: true }, _count: true }),
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: "PERDA" }, select: { valor: true, perdaData: true } }),
  ]);
  const doMes = perdas.filter((p) => p.perdaData && p.perdaData.toISOString().slice(0, 7) === competencia);
  return {
    receberEmExecucao: r2(exec._sum.valor || 0), receberEmExecucaoQtd: exec._count || 0,
    perdasMes: r2(doMes.reduce((s, p) => s + Number(p.valor), 0)),
    perdasTotal: r2(perdas.reduce((s, p) => s + Number(p.valor), 0)),
  };
}
