// Recorrências da Matriz de custos no banco: montar (comparar com o que existe) e aplicar
import { prisma } from "@/lib/prisma";
import { garantirContas } from "@/lib/fin";
import { MATRIZ_SEED } from "@/lib/matrizSeed";
import { propostasDaMatriz } from "@/lib/finMatrizRec";
import { validarRateio, gerarRecorrencias, r2, mesAtual, vencNoMes, ajustaFds, contaSabado, ehFolha } from "@/lib/finTitulos";
const ESPELHO = /^(MATRIZ|NORT|CARTAO)\|/;   // v192: recorrências que espelham a Matriz de custos
const SEM_PARCEIRO = (p) => !p || /^A DEFINIR$/i.test(String(p).trim());
import { ehGuia, guiasComValor } from "@/lib/finGuias";

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
  const pelaGuia = await guiasComValor();   // INSS/FGTS: o valor é o da última guia lançada, não o da Matriz
  const lista = propostas.map((p) => {
    const rateio = p.rateio.map((r) => ({ contaId: id[r.codigo] || null, pct: r.pct }));
    const e = porChave[p.chave];
    const valorGuia = !!(e && ehGuia(p.chave) && pelaGuia[p.chave]);
    const difValor = e && ((!valorGuia && Math.abs(Number(e.valor) - r2(p.valor)) > 0.009)
      || e.diaVencimento !== p.dia || !!e.diaUtil !== !!p.util
      || (e.periodicidade || 1) !== Math.max(1, Number(p.periodicidade) || 1));
    const difRateio = e && p.chave.startsWith("MATRIZ|pessoal|") && !mesmoRateio(e.rateio, rateio);
    // v192 — nome e fornecedor também espelham (fornecedor "A DEFINIR" na Matriz não apaga o que foi informado na conta)
    const difNome = e && (String(e.titulo) !== String(p.titulo).toUpperCase() || (!SEM_PARCEIRO(p.parceiro) && String(e.parceiro) !== String(p.parceiro).toUpperCase()));
    return { ...p, rateio, jaExiste: !!e, recorrenciaId: e?.id || null, valorAtual: e ? Number(e.valor) : null, mudou: !!(difValor || difRateio || difNome), valorGuia };
  });
  const obsoletas = existentes.filter((e) => ESPELHO.test(e.chaveOrigem) && !ehGuia(e.chaveOrigem) && !chavesProp.has(e.chaveOrigem))
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
        const up = { ...(p.valorGuia ? {} : { valor: r2(p.valor) }), diaVencimento: p.dia, diaUtil: !!p.util,
                     periodicidade: Math.max(1, Number(p.periodicidade) || 1), ...(p.obs ? { observacao: p.obs } : {}),
                     titulo: String(p.titulo).toUpperCase(), ...(SEM_PARCEIRO(p.parceiro) ? {} : { parceiro: String(p.parceiro).toUpperCase() }) };
        if (p.chave.startsWith("MATRIZ|pessoal|") && rt.rateio) up.rateio = rt.rateio;
        const rec = await prisma.finRecorrencia.update({ where: { id: p.recorrenciaId }, data: up });
        // v192 — as contas em aberto deste mês em diante espelham a Matriz (nome, fornecedor, valor, rateio e vencimento),
        // menos as alteradas pontualmente no contas a pagar
        const tits = await prisma.finTitulo.findMany({ where: { recorrenciaId: p.recorrenciaId, competencia: { gte: mesAtual() }, status: "ABERTO", pontual: false, vencimentoOriginal: null } });
        for (const t of tits) {
          await prisma.finTitulo.update({ where: { id: t.id }, data: {
            titulo: rec.titulo, parceiro: rec.parceiro, ...(up.valor !== undefined ? { valor: up.valor } : {}), ...(up.rateio ? { rateio: up.rateio } : {}),
            vencimento: ajustaFds(vencNoMes(t.competencia, rec.diaVencimento, rec.diaUtil, contaSabado(rec)), ehFolha(rec)),
          } });
        }
        atualizadas++;
      }
    } catch (e) { erros.push(`${p.titulo}: ${e.message}`); }
  }
  for (const id of encerrar.map(Number)) {
    if (!r.obsoletas.some((o) => o.id === id)) continue;
    await prisma.finTitulo.deleteMany({ where: { recorrenciaId: id, status: "ABERTO", pontual: false, competencia: { gte: mesAtual() } } });
    await prisma.finTitulo.updateMany({ where: { recorrenciaId: id }, data: { recorrenciaId: null } });   // pagas e pontuais ficam no histórico
    await prisma.finRecorrencia.delete({ where: { id } }).catch(() => {});
    encerradas++;
  }
  const geradas = await gerarRecorrencias("PAGAR");
  const vinculadas = await vincularProLaboreAvulso().catch(() => 0);
  return { ok: true, criadas, atualizadas, encerradas, geradas, vinculadas, erros };
}

// v192 — espelho completo da Matriz: cria o que é novo, atualiza o que mudou e encerra o que saiu da Matriz
let sincronizando = null;
export async function sincronizarMatriz(quem) {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    await marcarPontuaisAntigos().catch(() => null);
    await fornecedoresParaMatriz().catch(() => null);
    const m = await montarMatrizRec();
    if (m.error) return m;
    const novas = m.propostas.filter((p) => !p.jaExiste), mud = m.propostas.filter((p) => p.mudou);
    if (!novas.length && !mud.length && !m.obsoletas.length) return { ok: true, criadas: 0, atualizadas: 0, encerradas: 0 };
    return aplicarMatrizRec({ quem: quem || "MATRIZ DE CUSTOS", chaves: "TODAS", atualizar: mud.map((p) => p.chave), encerrar: m.obsoletas.map((o) => o.id) });
  })();
  try { return await sincronizando; } finally { sincronizando = null; }
}
// v193 — uma vez: o fornecedor já informado nas recorrências vai para o item da Matriz que ainda não tem fornecedor
const CHAVE_FORN = "AJUSTE|fornecedores-matriz-v193";
const AREAS_FORN = ["vidaVegetativa", "logistica", "administracao", "sistemas", "dividas"];
async function fornecedoresParaMatriz() {
  if (await prisma.finConfig.findUnique({ where: { chave: CHAVE_FORN } }).catch(() => null)) return;
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) return;
  await prisma.finConfig.create({ data: { chave: CHAVE_FORN, valor: new Date().toISOString() } });
  const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { startsWith: "MATRIZ|" } }, select: { chaveOrigem: true, parceiro: true } });
  const forn = new Map(recs.filter((r) => !SEM_PARCEIRO(r.parceiro)).map((r) => [r.chaveOrigem, r.parceiro]));
  const dados = { ...(m.dados || {}) };
  let n = 0;
  for (const a of AREAS_FORN) {
    if (!Array.isArray(dados[a])) continue;
    dados[a] = dados[a].map((it) => {
      const f = forn.get(`MATRIZ|${a}|${it.id}`);
      if (f && SEM_PARCEIRO(it.parceiro)) { n++; return { ...it, parceiro: f }; }
      return it;
    });
  }
  if (n) await prisma.finMatriz.update({ where: { id: m.id }, data: { dados } });
}

// uma vez: contas de recorrência já ajustadas à mão (valor diferente da recorrência ou reprogramadas) ficam como pontuais
const CHAVE_PONTUAL = "AJUSTE|pontuais-v192";
async function marcarPontuaisAntigos() {
  if (await prisma.finConfig.findUnique({ where: { chave: CHAVE_PONTUAL } }).catch(() => null)) return;
  await prisma.finConfig.create({ data: { chave: CHAVE_PONTUAL, valor: new Date().toISOString() } });
  const recs = await prisma.finRecorrencia.findMany({ select: { id: true, valor: true } });
  const val = new Map(recs.map((r) => [r.id, Number(r.valor)]));
  const tits = await prisma.finTitulo.findMany({ where: { recorrenciaId: { not: null }, status: "ABERTO", competencia: { gte: mesAtual() } }, select: { id: true, recorrenciaId: true, valor: true, valorConfirmado: true, vencimentoOriginal: true } });
  const ids = tits.filter((t) => t.vencimentoOriginal || (t.valorConfirmado && Math.abs(Number(t.valor) - (val.get(t.recorrenciaId) ?? Number(t.valor))) > 0.009)).map((t) => t.id);
  if (ids.length) await prisma.finTitulo.updateMany({ where: { id: { in: ids } }, data: { pontual: true } });
}

// Pró-labore lançado à mão / importado (sem recorrência) no mesmo mês da previsão do sócio:
// a conta avulsa assume o lugar da previsão (não fica em dobro).
const APELIDOS = { PEDRO: ["PEDRO", "TAVARES"] };
const nrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
export async function vincularProLaboreAvulso() {
  const recs = await prisma.finRecorrencia.findMany({ where: { OR: [
    { chaveOrigem: { startsWith: "MATRIZ|pessoal|PROLABORE|" } }, { chaveOrigem: { startsWith: "MATRIZ|pessoal|ESTAGIO|" } },
    { chaveOrigem: { in: ["NORT|INSS", "NORT|FGTS", "MATRIZ|pessoal|INSS", "MATRIZ|pessoal|FGTS"] } }] } });
  let n = 0;
  for (const r of recs) {
    const estagio = r.chaveOrigem.includes("|ESTAGIO|");
    const guiaNort = r.chaveOrigem.startsWith("NORT|") ? r.chaveOrigem.split("|")[1] : null;   // INSS NORT / FGTS NORT avulsos
    const guiaMer = /^MATRIZ\|pessoal\|(INSS|FGTS)$/.test(r.chaveOrigem) ? r.chaveOrigem.split("|")[2] : null;   // INSS / FGTS Meridian avulsos
    const nomes = APELIDOS[nrm(r.parceiro)] || [nrm(r.parceiro)];
    const temNome = (x) => nomes.some((w) => w && new RegExp(`(^| )${w}( |$)`).test(x));
    const gerados = await prisma.finTitulo.findMany({ where: { recorrenciaId: r.id, status: "ABERTO", valorConfirmado: false, competencia: { gte: mesAtual() } } });
    for (const g of gerados) {
      const avulsos = await prisma.finTitulo.findMany({ where: { tipo: "PAGAR", recorrenciaId: null, competencia: g.competencia, status: { not: "CANCELADO" } } });
      const a = avulsos.find((t) => {
        const x = nrm(`${t.titulo} ${t.parceiro}`);
        if (guiaNort) return / NORT( |$)|^NORT /.test(` ${x} `) && new RegExp(`(^| )${guiaNort}( |$)`).test(x);
        if (guiaMer) return !/(^| )NORT( |$)/.test(x) && !/RESCIS/.test(x) && new RegExp(`(^| )${guiaMer}( |$)`).test(x);
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

// v115: NORT — INSS e FGTS em contas separadas (uma guia cada); a antiga NORT|ENCARGOS sai
const CHAVE_NORT_GUIAS = "AJUSTE|nort-inss-fgts-v115";
export async function separarGuiasNort() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_NORT_GUIAS } }).catch(() => null);
  if (ja) return null;
  await prisma.finConfig.create({ data: { chave: CHAVE_NORT_GUIAS, valor: new Date().toISOString() } });
  const velha = await prisma.finRecorrencia.findUnique({ where: { chaveOrigem: "NORT|ENCARGOS" } });
  if (!velha) return null;
  await prisma.finTitulo.deleteMany({ where: { recorrenciaId: velha.id, status: "ABERTO", valorConfirmado: false } });
  await prisma.finTitulo.updateMany({ where: { recorrenciaId: velha.id }, data: { recorrenciaId: null } });
  await prisma.finRecorrencia.delete({ where: { id: velha.id } });
  const m = await montarMatrizRec();
  if (m.error) return null;
  const novas = m.propostas.filter((p) => ["NORT|INSS", "NORT|FGTS"].includes(p.chave) && !p.jaExiste).map((p) => p.chave);
  return novas.length ? aplicarMatrizRec({ quem: "AUTOMÁTICO (NORT INSS/FGTS)", chaves: novas }) : null;
}

// v116: INSS/FGTS dos sócios saem do PRO LABORE e vão para IMPOSTOS SOBRE PESSOAL ADM — atualiza o rateio (uma vez)
const CHAVE_ENC_SOCIOS = "AJUSTE|encargos-socios-v116";
export async function encargosSociosAdm() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_ENC_SOCIOS } }).catch(() => null);
  if (ja) return null;
  if (!(await prisma.finRecorrencia.count({ where: { chaveOrigem: { startsWith: "MATRIZ|" } } }))) return null;
  await prisma.finConfig.create({ data: { chave: CHAVE_ENC_SOCIOS, valor: new Date().toISOString() } });
  await garantirContas();
  const m = await montarMatrizRec();
  if (m.error) return null;
  const mudar = m.propostas.filter((p) => ["MATRIZ|pessoal|INSS", "MATRIZ|pessoal|FGTS"].includes(p.chave) && p.mudou).map((p) => p.chave);
  return mudar.length ? aplicarMatrizRec({ quem: "AUTOMÁTICO (ENCARGOS DOS SÓCIOS)", chaves: [], atualizar: mudar }) : null;
}

// Depois de mexer no pessoal da Matriz (RH ou importação da folha): cria as contas novas de pessoal,
// atualiza as que mudaram e encerra as que não existem mais (ex.: estágio/pró-labore de quem saiu).
const ehPessoal = (k) => k.startsWith("MATRIZ|pessoal|") || /^NORT\|(FOLHA5|ADIANTAMENTO|BENEFICIOS|INSS|FGTS)$/.test(k);
export async function sincronizarPessoal(quem) {
  const m = await montarMatrizRec();
  if (m.error) return m;
  const pes = (m.propostas || []).filter((p) => ehPessoal(p.chave));
  return aplicarMatrizRec({
    quem, chaves: pes.filter((p) => !p.jaExiste).map((p) => p.chave), atualizar: pes.filter((p) => p.mudou).map((p) => p.chave),
    encerrar: (m.obsoletas || []).filter((o) => o.chave.startsWith("MATRIZ|pessoal|")).map((o) => o.id),
  });
}
