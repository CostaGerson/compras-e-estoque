// v169.2 — jornadas de trabalho por período (o cartão do iPonto traz um horário só; a empresa mudou o horário em 24/08/2026)
// geral: vale para todos; exceções: por funcionário (têm prioridade). A entrada prevista de cada dia útil sai daqui.
import { prisma } from "@/lib/prisma";

const CHAVE = "RH|JORNADAS";
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const hm = (s) => /^\d{2}:\d{2}$/.test(s || "");
const data = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : null);

export const JORNADA_PADRAO = {
  dias: [1, 2, 3, 4, 5],
  geral: [
    { de: null, ate: "2026-08-23", entrada: "08:00", saida: "18:00" },
    { de: "2026-08-24", ate: null, entrada: "07:00", saida: "16:48" },
  ],
  excecoes: [],   // [{ pessoaId, nome, de, ate, entrada, saida }]
};

// ajustes únicos pedidos depois da 1ª gravação (cada um roda uma vez)
const AJUSTES = [["ANTONIO-08H", /^ANTONIO\b/]];   // v169.3 — o motorista Antônio também chega às 08:00
async function ajustar(j) {
  const feitos = new Set(j.ajustes || []);
  const pend = AJUSTES.filter(([k]) => !feitos.has(k));
  if (!pend.length) return j;
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } }).catch(() => null);
  const pessoas = m?.dados?.pessoal || [];
  for (const [k, re] of pend) {
    for (const p of pessoas.filter((p) => p.ativo !== false && re.test(semAcento(p.nome)))) {
      if (!(j.excecoes || []).some((x) => x.pessoaId === p.id)) (j.excecoes ||= []).push({ pessoaId: p.id, nome: p.nome, de: null, ate: null, entrada: "08:00", saida: "18:00" });
    }
    feitos.add(k);
  }
  j.ajustes = [...feitos];
  await prisma.finConfig.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor: JSON.stringify(j) }, update: { valor: JSON.stringify(j) } }).catch(() => {});
  return j;
}

export async function lerJornadas() {
  const c = await prisma.finConfig.findUnique({ where: { chave: CHAVE } }).catch(() => null);
  if (c) { try { return await ajustar(JSON.parse(c.valor)); } catch {} }
  // 1ª vez: Valéria e Brenda mantiveram 08:00 às 18:00
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } }).catch(() => null);
  const exc = (m?.dados?.pessoal || []).filter((p) => /^(VALERIA|BRENDA|ANTONIO)\b/.test(semAcento(p.nome)))
    .map((p) => ({ pessoaId: p.id, nome: p.nome, de: null, ate: null, entrada: "08:00", saida: "18:00" }));
  const j = { ...JORNADA_PADRAO, excecoes: exc, ajustes: AJUSTES.map(([k]) => k) };
  await prisma.finConfig.create({ data: { chave: CHAVE, valor: JSON.stringify(j) } }).catch(() => {});
  return j;
}

export async function salvarJornadas(j) {
  const limpa = (l, comPessoa) => (Array.isArray(l) ? l : [])
    .map((x) => ({ ...(comPessoa ? { pessoaId: String(x.pessoaId || ""), nome: String(x.nome || "").toUpperCase() } : {}), de: data(x.de), ate: data(x.ate), entrada: hm(x.entrada) ? x.entrada : null, saida: hm(x.saida) ? x.saida : null }))
    .filter((x) => x.entrada && (!comPessoa || x.pessoaId));
  const v = { dias: JORNADA_PADRAO.dias, geral: limpa(j.geral), excecoes: limpa(j.excecoes, true), ajustes: AJUSTES.map(([k]) => k) };
  if (!v.geral.length) return { error: "Informe ao menos uma jornada geral." };
  await prisma.finConfig.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return { ok: true, jornadas: v };
}

const vale = (x, d) => (!x.de || d >= x.de) && (!x.ate || d <= x.ate);
export function jornadaDo(J, pessoaId, d) {
  return (J.excecoes || []).find((x) => x.pessoaId === pessoaId && vale(x, d)) || (J.geral || []).find((x) => vale(x, d)) || null;
}

// v169.3 — horário de trabalho cadastrado na ficha do carômetro (com pausas): tem prioridade a partir de "vigente desde"
export async function horariosDaFicha() {
  const l = await prisma.rhFuncionario.findMany({ select: { pessoaId: true, dados: true } }).catch(() => []);
  return Object.fromEntries(l.filter((f) => f.dados?.horario?.entrada).map((f) => [f.pessoaId, f.dados.horario]));
}
export const minutosHM = (s) => { const m = String(s || "").match(/^(\d{2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
// minutos de trabalho por dia: saída − entrada − pausas
export function jornadaDiaria(h) {
  const e = minutosHM(h?.entrada), s = minutosHM(h?.saida);
  if (e == null || s == null) return null;
  const p = (h.pausas || []).reduce((a, x) => { const i = minutosHM(x.ini), f = minutosHM(x.fim); return a + (i != null && f != null && f > i ? f - i : 0); }, 0);
  return s - e - p;
}

// troca a entrada prevista dos dias úteis: ficha do funcionário > exceção > jornada geral do período
export function aplicarJornadas(dias, J, iso, fichas = {}) {
  for (const d of dias) {
    const data = iso(d.data);
    const h = fichas[d.pessoaId];
    if (h && (!h.desde || data >= h.desde)) {
      if ((h.dias || [1, 2, 3, 4, 5]).includes(d.dow)) d.entradaPrevista = h.entrada;
      continue;
    }
    if (!J || !(J.dias || [1, 2, 3, 4, 5]).includes(d.dow)) continue;
    const j = jornadaDo(J, d.pessoaId, data);
    if (j) d.entradaPrevista = j.entrada;
  }
}
