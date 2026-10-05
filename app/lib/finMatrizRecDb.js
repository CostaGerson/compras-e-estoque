// Recorrências da Matriz de custos no banco: montar (comparar com o que existe) e aplicar
import { prisma } from "@/lib/prisma";
import { garantirContas } from "@/lib/fin";
import { MATRIZ_SEED } from "@/lib/matrizSeed";
import { propostasDaMatriz } from "@/lib/finMatrizRec";
import { validarRateio, gerarRecorrencias, r2, mesAtual } from "@/lib/finTitulos";

const mesmoRateio = (a, b) => JSON.stringify((a || []).map((r) => [Number(r.contaId), r2(r.pct)]).sort()) === JSON.stringify((b || []).map((r) => [Number(r.contaId), r2(r.pct)]).sort());

async function matrizOficial() {
  let m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m && !(await prisma.finMatriz.count())) {
    m = await prisma.finMatriz.create({ data: { nome: "MATRIZ OFICIAL", oficial: true, dados: MATRIZ_SEED.oficial, atualizadoPor: "IMPORTAÇÃO DA PLANILHA" } });
    await prisma.finMatriz.create({ data: { nome: "SIMULAÇÃO (PLANILHA)", oficial: false, dados: MATRIZ_SEED.simulacao, atualizadoPor: "IMPORTAÇÃO DA PLANILHA" } });
  }
  return m;
}

export async function montarMatrizRec() {
  await garantirContas();
  const m = await matrizOficial();
  if (!m) return { error: "Matriz oficial não encontrada." };
  const { propostas, totalMatriz } = propostasDaMatriz(m.dados);
  const contas = await prisma.finConta.findMany({ select: { id: true, codigo: true } });
  const id = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
  const existentes = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { not: null } } });
  const porChave = Object.fromEntries(existentes.map((e) => [e.chaveOrigem, e]));
  const chavesProp = new Set(propostas.map((p) => p.chave));
  const lista = propostas.map((p) => {
    const rateio = p.rateio.map((r) => ({ contaId: id[r.codigo] || null, pct: r.pct }));
    const e = porChave[p.chave];
    const difValor = e && (Math.abs(Number(e.valor) - r2(p.valor)) > 0.009
      || e.diaVencimento !== p.dia || !!e.diaUtil !== !!p.util
      || (e.periodicidade || 1) !== Math.max(1, Number(p.periodicidade) || 1));
    const difRateio = e && p.chave.startsWith("MATRIZ|pessoal|") && !mesmoRateio(e.rateio, rateio);
    return { ...p, rateio, jaExiste: !!e, recorrenciaId: e?.id || null, valorAtual: e ? Number(e.valor) : null, mudou: !!(difValor || difRateio) };
  });
  const obsoletas = existentes.filter((e) => e.chaveOrigem.startsWith("MATRIZ|") && !chavesProp.has(e.chaveOrigem))
    .map((e) => ({ id: e.id, chave: e.chaveOrigem, titulo: e.titulo, valor: Number(e.valor) }));
  return { totalMatriz, propostas: lista, obsoletas };
}

// chaves: lista ou "TODAS"; atualizar: lista; encerrar: ids
export async function aplicarMatrizRec({ quem, chaves, atualizar = [], encerrar = [], inicio }) {
  const r = await montarMatrizRec();
  if (r.error) return r;
  const todas = chaves === "TODAS";
  const quero = new Set(todas ? [] : chaves || []), atual = new Set(atualizar);
  const ini = /^\d{4}-\d{2}$/.test(inicio || "") ? inicio : mesAtual();
  let criadas = 0, atualizadas = 0, encerradas = 0;
  const erros = [];
  for (const p of r.propostas) {
    const rt = validarRateio(p.rateio);
    try {
      if (!p.jaExiste && (todas || quero.has(p.chave))) {
        await prisma.finRecorrencia.create({
          data: {
            tipo: "PAGAR", titulo: p.titulo.toUpperCase(), parceiro: p.parceiro.toUpperCase(), valor: r2(p.valor), diaVencimento: p.dia, diaUtil: !!p.util,
            periodicidade: Math.max(1, Number(p.periodicidade) || 1),
            rateio: rt.rateio || [], inicio: /^\d{4}-\d{2}$/.test(p.inicio || "") ? p.inicio : ini,
            observacao: p.obs || "GERADA DA MATRIZ DE CUSTOS", chaveOrigem: p.chave, criadoPorNome: quem,
          },
        });
        criadas++;
      } else if (p.jaExiste && p.mudou && atual.has(p.chave)) {
        const up = { valor: r2(p.valor), diaVencimento: p.dia, diaUtil: !!p.util,
                     periodicidade: Math.max(1, Number(p.periodicidade) || 1), ...(p.obs ? { observacao: p.obs } : {}) };
        if (p.chave.startsWith("MATRIZ|pessoal|") && rt.rateio) up.rateio = rt.rateio;
        await prisma.finRecorrencia.update({ where: { id: p.recorrenciaId }, data: up });
        await prisma.finTitulo.updateMany({ where: { recorrenciaId: p.recorrenciaId, competencia: { gte: mesAtual() }, status: "ABERTO", valorConfirmado: false }, data: { valor: up.valor, ...(up.rateio ? { rateio: up.rateio } : {}) } });
        atualizadas++;
      }
    } catch (e) { erros.push(`${p.titulo}: ${e.message}`); }
  }
  for (const id of encerrar.map(Number)) {
    if (!r.obsoletas.some((o) => o.id === id)) continue;
    await prisma.finTitulo.deleteMany({ where: { recorrenciaId: id, status: "ABERTO", valorConfirmado: false, competencia: { gte: mesAtual() } } });
    await prisma.finRecorrencia.delete({ where: { id } }).catch(() => {});
    encerradas++;
  }
  const geradas = await gerarRecorrencias("PAGAR");
  const vinculadas = await vincularProLaboreAvulso().catch(() => 0);
  return { ok: true, criadas, atualizadas, encerradas, geradas, vinculadas, erros };
}

// Pró-labore lançado à mão / importado (sem recorrência) no mesmo mês da previsão do sócio:
// a conta avulsa assume o lugar da previsão (não fica em dobro).
const APELIDOS = { PEDRO: ["PEDRO", "TAVARES"] };
const nrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
export async function vincularProLaboreAvulso() {
  const recs = await prisma.finRecorrencia.findMany({ where: { OR: [
    { chaveOrigem: { startsWith: "MATRIZ|pessoal|PROLABORE|" } }, { chaveOrigem: { startsWith: "MATRIZ|pessoal|ESTAGIO|" } }] } });
  let n = 0;
  for (const r of recs) {
    const estagio = r.chaveOrigem.includes("|ESTAGIO|");
    const nomes = APELIDOS[nrm(r.parceiro)] || [nrm(r.parceiro)];
    const temNome = (x) => nomes.some((w) => w && new RegExp(`(^| )${w}( |$)`).test(x));
    const gerados = await prisma.finTitulo.findMany({ where: { recorrenciaId: r.id, status: "ABERTO", valorConfirmado: false, competencia: { gte: mesAtual() } } });
    for (const g of gerados) {
      const avulsos = await prisma.finTitulo.findMany({ where: { tipo: "PAGAR", recorrenciaId: null, competencia: g.competencia, status: { not: "CANCELADO" } } });
      const a = avulsos.find((t) => {
        const x = nrm(`${t.titulo} ${t.parceiro}`);
        return temNome(x) && (estagio ? /ESTAGI|RECIBO|BOLSA/.test(x) || temNome(nrm(t.parceiro)) : /PRO ?LABORE/.test(x));
      });
      if (!a) continue;
      // anexos da prevista (se houver) passam para a avulsa
      await prisma.finTituloAnexo.updateMany({ where: { tituloId: g.id }, data: { tituloId: a.id } }).catch(() => null);
      await prisma.finTitulo.delete({ where: { id: g.id } });
      await prisma.finTitulo.update({ where: { id: a.id }, data: {
        recorrenciaId: r.id, ...(Array.isArray(a.rateio) && a.rateio.length ? {} : { rateio: r.rateio }),
      } });
      n++;
    }
  }
  return n;
}

// v112: separa o pró-labore dos sócios do SALÁRIO (uma vez) — cria as contas próprias e tira os sócios do salário
const CHAVE_PROLABORE = "AJUSTE|prolabore-separado-v112";
export async function separarProLabore() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_PROLABORE } }).catch(() => null);
  if (ja) return null;
  if (!(await prisma.finRecorrencia.count({ where: { chaveOrigem: { startsWith: "MATRIZ|" } } }))) return null;   // a Matriz ainda não gerou contas
  await prisma.finConfig.create({ data: { chave: CHAVE_PROLABORE, valor: new Date().toISOString() } });
  const m = await montarMatrizRec();
  if (m.error) return null;
  const pro = m.propostas.filter((p) => p.chave.startsWith("MATRIZ|pessoal|PROLABORE|") && !p.jaExiste).map((p) => p.chave);
  const sal = m.propostas.filter((p) => p.chave === "MATRIZ|pessoal|SALARIO" && p.mudou).map((p) => p.chave);
  return aplicarMatrizRec({ quem: "AUTOMÁTICO (PRÓ-LABORE SEPARADO)", chaves: pro, atualizar: sal });
}

// Primeira vez: se nenhuma recorrência da matriz existe, lança todas automaticamente
export async function garantirRecorrenciasMatriz() {
  const ja = await prisma.finRecorrencia.count({ where: { chaveOrigem: { not: null } } });
  if (ja) return null;
  const r = await aplicarMatrizRec({ quem: "AUTOMÁTICO (MATRIZ DE CUSTOS)", chaves: "TODAS" });
  return r.error ? null : r;
}

// v113: estagiário fora do SALÁRIO, com conta própria (recibo) — uma vez
const CHAVE_ESTAGIO = "AJUSTE|estagio-separado-v113";
export async function separarEstagio() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_ESTAGIO } }).catch(() => null);
  if (ja) return null;
  if (!(await prisma.finRecorrencia.count({ where: { chaveOrigem: { startsWith: "MATRIZ|" } } }))) return null;
  await prisma.finConfig.create({ data: { chave: CHAVE_ESTAGIO, valor: new Date().toISOString() } });
  const m = await montarMatrizRec();
  if (m.error) return null;
  const novas = m.propostas.filter((p) => /^MATRIZ\|pessoal\|(ESTAGIO|PROLABORE)\|/.test(p.chave) && !p.jaExiste).map((p) => p.chave);
  const mudar = m.propostas.filter((p) => ["MATRIZ|pessoal|SALARIO", "MATRIZ|pessoal|IFOOD"].includes(p.chave) && p.mudou).map((p) => p.chave);
  return aplicarMatrizRec({ quem: "AUTOMÁTICO (ESTÁGIO SEPARADO)", chaves: novas, atualizar: mudar });
}
