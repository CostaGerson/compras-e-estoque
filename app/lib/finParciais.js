// v172 — Extratos e faturas PARCIAIS (dias, semanas) x documento MENSAL.
// Parcial: entra pela Transmissão de arquivos; os lançamentos já podem ser identificados e dar baixa nas contas,
//          mas o arquivo não conta como o documento do mês.
// Mensal:  só pelo card da Importação (análise mensal). Ao entrar, cruza com os parciais do mesmo documento:
//          o que já existe nos parciais é mantido (com identificação, desmembramento e baixa) e a linha repetida
//          do mensal é descartada; o que só existe no mensal entra novo.
import { prisma } from "@/lib/prisma";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const dia = (d) => new Date(d).toISOString().slice(0, 10);
const k1 = (l) => `${dia(l.data)}|${Number(l.valor).toFixed(2)}|${norm(l.historico)}`;
const k2 = (l) => `${dia(l.data)}|${Number(l.valor).toFixed(2)}`;

// pareia lançamentos (um para um): 1º data + valor + histórico; depois só data + valor
export function parear(novos, antigos) {
  const pares = [];
  let restoN = [...novos], restoA = [...antigos];
  for (const chave of [k1, k2]) {
    const fila = {};
    restoA.forEach((a) => (fila[chave(a)] = fila[chave(a)] || []).push(a));
    const sobraN = [];
    for (const n of restoN) {
      const a = fila[chave(n)]?.shift();
      if (a) pares.push([n, a]); else sobraN.push(n);
    }
    const usados = new Set(pares.map(([, a]) => a));
    restoN = sobraN; restoA = restoA.filter((a) => !usados.has(a));
  }
  return { pares, sobraNovos: restoN, sobraAntigos: restoA };
}

// competência de cada lançamento do parcial: extrato pela data; fatura pelo mês do arquivo
export const compDoParcial = (codigo, data, compArquivo) => (/_EXTRATO$/.test(codigo) ? String(data).slice(0, 7) : compArquivo);

// linhas novas de um parcial que ainda não existem em outro arquivo do mesmo documento (parcial ou mensal)
export async function filtrarRepetidos(arquivo, linhas) {
  const outros = (await prisma.finArquivo.findMany({ where: { tipoId: arquivo.tipoId, id: { not: arquivo.id } }, select: { id: true, parcial: true } }));
  if (!outros.length) return { novas: linhas, repetidas: 0, noMensal: 0 };
  const comps = [...new Set(linhas.map((l) => l.competencia))];
  const existentes = await prisma.finLancamento.findMany({
    where: { arquivoId: { in: outros.map((o) => o.id) }, competencia: { in: comps }, origem: "EXTRATO" },
    select: { id: true, data: true, valor: true, historico: true, competencia: true, arquivoId: true },
  });
  const mensal = new Set(outros.filter((o) => !o.parcial).map((o) => o.id));
  const novas = []; let repetidas = 0, noMensal = 0;
  for (const c of comps) {
    const { pares, sobraNovos } = parear(linhas.filter((l) => l.competencia === c), existentes.filter((e) => e.competencia === c));
    novas.push(...sobraNovos);
    repetidas += pares.length;
    noMensal += pares.filter(([, a]) => mensal.has(a.arquivoId)).length;
  }
  return { novas, repetidas, noMensal };
}

// o mensal absorve os parciais do mesmo documento no mês
export async function consolidarParciais(mensalId) {
  const m = await prisma.finArquivo.findUnique({ where: { id: mensalId }, include: { tipo: true } });
  if (!m || m.parcial) return null;
  const parciais = await prisma.finArquivo.findMany({ where: { tipoId: m.tipoId, parcial: true }, select: { id: true } });
  if (!parciais.length) return null;
  const idsP = parciais.map((p) => p.id);
  const [antigos, novos] = await Promise.all([
    prisma.finLancamento.findMany({ where: { arquivoId: { in: idsP }, competencia: m.competencia, origem: "EXTRATO" }, select: { id: true, data: true, valor: true, historico: true, arquivoId: true } }),
    prisma.finLancamento.findMany({ where: { arquivoId: m.id, origem: "EXTRATO" }, select: { id: true, data: true, valor: true, historico: true, ordem: true } }),
  ]);
  if (!antigos.length) return null;
  const { pares, sobraAntigos } = parear(novos, antigos);
  // o lançamento do parcial (já identificado) passa a ser do mensal; a cópia do mensal sai
  for (const [n, a] of pares) {
    await prisma.finLancamento.update({ where: { id: a.id }, data: { arquivoId: m.id, ordem: n.ordem } });
    await prisma.finLancamento.updateMany({ where: { paiId: a.id }, data: { arquivoId: m.id } });
  }
  if (pares.length) await prisma.finLancamento.deleteMany({ where: { id: { in: pares.map(([n]) => n.id) } } });
  // sobras do parcial que não constam no mensal: o mensal manda (em documento com vários arquivos, como faturas
  // por portador, ficam até o último mensal chegar e podem ser descartadas no card)
  let descartadas = 0;
  if (!m.tipo.multiplo && sobraAntigos.length) descartadas = await descartarLancamentos(sobraAntigos.map((a) => a.id));
  // parcial sem mais nenhum lançamento: absorvido
  const agora = new Date();
  for (const id of idsP) {
    const resta = await prisma.finLancamento.count({ where: { arquivoId: id } });
    if (!resta) await prisma.finArquivo.update({ where: { id }, data: { consolidadoNoId: m.id, consolidadoEm: agora } });
  }
  return { aproveitados: pares.length, novos: novos.length - pares.length, sobras: m.tipo.multiplo ? sobraAntigos.length : 0, descartadas };
}

// exclui lançamentos (e partes) de parciais; a conta que tinha baixa por eles continua paga, só perde o vínculo
export async function descartarLancamentos(ids) {
  if (!ids.length) return 0;
  const partes = await prisma.finLancamento.findMany({ where: { paiId: { in: ids } }, select: { id: true } });
  const todos = [...ids, ...partes.map((p) => p.id)];
  await prisma.finTitulo.updateMany({ where: { lancamentoId: { in: todos } }, data: { lancamentoId: null } });
  await prisma.finLancamento.deleteMany({ where: { id: { in: todos } } });
  return ids.length;
}

// card da Importação: sobras de parciais de um documento no mês → descartar
export async function descartarSobras(competencia, tipoId) {
  const idsP = (await prisma.finArquivo.findMany({ where: { tipoId: Number(tipoId), parcial: true }, select: { id: true } })).map((p) => p.id);
  if (!idsP.length) return 0;
  const ls = await prisma.finLancamento.findMany({ where: { arquivoId: { in: idsP }, competencia, origem: "EXTRATO" }, select: { id: true } });
  const n = await descartarLancamentos(ls.map((l) => l.id));
  const agora = new Date();
  for (const id of idsP) if (!(await prisma.finLancamento.count({ where: { arquivoId: id } }))) await prisma.finArquivo.update({ where: { id }, data: { consolidadoEm: agora } });
  return n;
}

// resumo dos parciais com lançamentos no mês (para os cards da Importação)
export async function parciaisDoMes(competencia) {
  const arqs = await prisma.finArquivo.findMany({ where: { parcial: true }, select: { id: true, tipoId: true, nome: true, createdAt: true, enviadoPorNome: true } });
  if (!arqs.length) return [];
  const ls = await prisma.finLancamento.findMany({ where: { competencia, arquivoId: { in: arqs.map((a) => a.id) }, origem: "EXTRATO" }, select: { arquivoId: true, data: true, contaId: true } });
  const out = [];
  for (const a of arqs) {
    const meus = ls.filter((l) => l.arquivoId === a.id);
    if (!meus.length) continue;
    const ds = meus.map((l) => dia(l.data)).sort();
    out.push({ ...a, n: meus.length, identificados: meus.filter((l) => l.contaId).length, de: ds[0], ate: ds[ds.length - 1] });
  }
  return out;
}
