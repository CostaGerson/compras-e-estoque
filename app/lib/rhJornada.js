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

export async function lerJornadas() {
  const c = await prisma.finConfig.findUnique({ where: { chave: CHAVE } }).catch(() => null);
  if (c) { try { return JSON.parse(c.valor); } catch {} }
  // 1ª vez: Valéria e Brenda mantiveram 08:00 às 18:00
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } }).catch(() => null);
  const exc = (m?.dados?.pessoal || []).filter((p) => /^(VALERIA|BRENDA)\b/.test(semAcento(p.nome)))
    .map((p) => ({ pessoaId: p.id, nome: p.nome, de: null, ate: null, entrada: "08:00", saida: "18:00" }));
  const j = { ...JORNADA_PADRAO, excecoes: exc };
  await prisma.finConfig.create({ data: { chave: CHAVE, valor: JSON.stringify(j) } }).catch(() => {});
  return j;
}

export async function salvarJornadas(j) {
  const limpa = (l, comPessoa) => (Array.isArray(l) ? l : [])
    .map((x) => ({ ...(comPessoa ? { pessoaId: String(x.pessoaId || ""), nome: String(x.nome || "").toUpperCase() } : {}), de: data(x.de), ate: data(x.ate), entrada: hm(x.entrada) ? x.entrada : null, saida: hm(x.saida) ? x.saida : null }))
    .filter((x) => x.entrada && (!comPessoa || x.pessoaId));
  const v = { dias: JORNADA_PADRAO.dias, geral: limpa(j.geral), excecoes: limpa(j.excecoes, true) };
  if (!v.geral.length) return { error: "Informe ao menos uma jornada geral." };
  await prisma.finConfig.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return { ok: true, jornadas: v };
}

const vale = (x, d) => (!x.de || d >= x.de) && (!x.ate || d <= x.ate);
export function jornadaDo(J, pessoaId, d) {
  return (J.excecoes || []).find((x) => x.pessoaId === pessoaId && vale(x, d)) || (J.geral || []).find((x) => vale(x, d)) || null;
}

// troca a entrada prevista dos dias úteis pela jornada do período
export function aplicarJornadas(dias, J, iso) {
  if (!J) return;
  for (const d of dias) {
    if (!(J.dias || [1, 2, 3, 4, 5]).includes(d.dow)) continue;
    const j = jornadaDo(J, d.pessoaId, iso(d.data));
    if (j) d.entradaPrevista = j.entrada;
  }
}
