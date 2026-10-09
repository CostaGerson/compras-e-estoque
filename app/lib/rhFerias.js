// v169 — Plano de férias: lançamento individual e coletivo, saldo por período aquisitivo e alertas
import { prisma } from "@/lib/prisma";
import { lerPessoal, nomeUsuario } from "@/lib/rh";
import { DEPTOS } from "@/lib/matriz";

export const LIMITE_SETOR = 30;
// períodos cujo prazo para gozar terminou antes da implantação do plano contam como já gozados (não há histórico no sistema)
export const INICIO_PLANO = "2026-01-01";   // alerta quando mais de 30% de um setor está de férias ao mesmo tempo
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const somaDia = (s, n) => iso(new Date(dUTC(s).getTime() + n * 86400000));
const diasEntre = (a, b) => Math.round((dUTC(b) - dUTC(a)) / 86400000) + 1;
const somaAno = (s, n) => { const [a, m, d] = s.split("-").map(Number); const x = new Date(Date.UTC(a + n, m - 1, d)); if (x.getUTCMonth() !== m - 1) x.setUTCDate(0); return iso(x); };
const hoje = () => new Date().toISOString().slice(0, 10);
const dBR = (s) => s.split("-").reverse().join("/");
const nomeDepto = (k) => (DEPTOS.find(([d]) => d === k)?.[1] || k || "—").replace(/^\d+\.\s*/, "");
const DIA_SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// quem tem direito a férias (diretor com pró-labore fica fora; estágio tem recesso de 30 dias)
const temFerias = (p) => p.regime !== "DIRETOR";

function validar(f) {
  if (!f.pessoaId && !f.pessoas?.length) return "Escolha o funcionário.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.inicio || "") || !/^\d{4}-\d{2}-\d{2}$/.test(f.fim || "")) return "Informe início e fim.";
  if (f.fim < f.inicio) return "O fim é antes do início.";
  if (diasEntre(f.inicio, f.fim) > 30) return "Um período de férias tem no máximo 30 dias.";
  return null;
}

export async function listar(ano) {
  const de = dUTC(`${ano - 1}-12-01`), ate = dUTC(`${ano + 1}-01-31`);
  const l = await prisma.rhFerias.findMany({ where: { status: { not: "CANCELADA" }, inicio: { lte: ate }, fim: { gte: de } }, orderBy: { inicio: "asc" } });
  return l.map((f) => ({ ...f, inicio: iso(f.inicio), fim: iso(f.fim) }));
}

export async function salvar(f, u) {
  const e = validar(f); if (e) return { error: e };
  const data = { inicio: dUTC(f.inicio), fim: dUTC(f.fim), dias: diasEntre(f.inicio, f.fim), status: f.status === "CONFIRMADA" ? "CONFIRMADA" : "PLANEJADA",
    abono: Math.max(0, Math.min(10, Number(f.abono) || 0)), obs: String(f.obs || "").toUpperCase().slice(0, 500) || null, criadoPorNome: nomeUsuario(u) };
  if (f.id) {
    const x = await prisma.rhFerias.findUnique({ where: { id: Number(f.id) } });
    if (!x) return { error: "Férias não encontradas." };
    if (x.coletivaId && f.todaColetiva) {
      await prisma.rhFerias.updateMany({ where: { coletivaId: x.coletivaId }, data });
      return { ok: true };
    }
    return { ok: true, ferias: await prisma.rhFerias.update({ where: { id: x.id }, data: { ...data, pessoaId: f.pessoaId || x.pessoaId } }) };
  }
  if (f.coletiva) {
    const pessoas = [...new Set(f.pessoas || [])];
    if (!pessoas.length) return { error: "Escolha quem entra nas férias coletivas." };
    const coletivaId = `C${Date.now()}`;
    await prisma.rhFerias.createMany({ data: pessoas.map((p) => ({ ...data, pessoaId: p, tipo: "COLETIVA", coletivaId })) });
    return { ok: true, n: pessoas.length };
  }
  return { ok: true, ferias: await prisma.rhFerias.create({ data: { ...data, pessoaId: f.pessoaId, tipo: "INDIVIDUAL" } }) };
}

export async function excluir(id, todaColetiva) {
  const x = await prisma.rhFerias.findUnique({ where: { id: Number(id) || 0 } });
  if (!x) return { ok: true };
  if (x.coletivaId && todaColetiva) await prisma.rhFerias.deleteMany({ where: { coletivaId: x.coletivaId } });
  else await prisma.rhFerias.delete({ where: { id: x.id } });
  return { ok: true };
}

// períodos aquisitivos e saldo (dias usados vão para o período mais antigo)
export function saldoPessoa(p, ferias, ref = hoje()) {
  const adm = p.admissao || p.admissaoFicha;
  if (!adm) return null;
  const periodos = [];
  for (let i = 0; ; i++) {
    const ini = somaAno(adm, i), fimAq = somaDia(somaAno(adm, i + 1), -1);
    if (ini > ref) break;
    periodos.push({ n: i + 1, inicio: ini, fim: fimAq, completo: fimAq <= ref, limite: somaDia(somaAno(adm, i + 2), -1), direito: 30, usados: 0 });
    if (i > 60) break;
  }
  for (const per of periodos) if (per.limite < INICIO_PLANO) { per.presumido = true; per.usados = per.direito; }
  const usos = ferias.filter((f) => f.pessoaId === p.id).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  for (const f of usos) {
    let resto = f.dias + (f.abono || 0);
    for (const per of periodos) {
      if (!per.completo || resto <= 0) continue;
      const cabe = per.direito - per.usados;
      const usa = Math.min(cabe, resto);
      per.usados += usa; resto -= usa;
    }
    if (resto > 0) { const aberto = periodos.find((x) => !x.completo); if (aberto) aberto.usados += resto; }   // antecipadas
  }
  for (const per of periodos) {
    if (per.limite < INICIO_PLANO && per.usados < per.direito) { per.presumido = true; per.usados = per.direito; }
    per.saldo = per.direito - per.usados;
  }
  const completos = periodos.filter((x) => x.completo);
  return { admissao: adm, periodos, saldo: completos.reduce((a, x) => a + x.saldo, 0), vencidas: completos.filter((x) => x.limite < ref && x.saldo > 0) };
}

export async function planoFerias(ano) {
  const { pessoas } = await lerPessoal();
  const fichas = await prisma.rhFuncionario.findMany({ select: { pessoaId: true, dados: true } });
  const fd = Object.fromEntries(fichas.map((f) => [f.pessoaId, f.dados || {}]));
  const ativos = pessoas.filter((p) => p.ativo !== false && temFerias(p)).map((p) => ({ id: p.id, nome: p.nome, nomeCompleto: p.nomeCompleto, depto: p.depto, empresa: p.empresa, regime: p.regime, admissao: p.admissao || fd[p.id]?.admissao || null, foto: p.foto }));
  const todas = await prisma.rhFerias.findMany({ where: { status: { not: "CANCELADA" } }, orderBy: { inicio: "asc" } });
  const ferias = todas.map((f) => ({ ...f, inicio: iso(f.inicio), fim: iso(f.fim) }));
  const doAno = ferias.filter((f) => f.inicio <= `${ano}-12-31` && f.fim >= `${ano}-01-01`);
  const H = hoje();
  const alertas = [];
  const saldos = {};
  for (const p of ativos) {
    const s = saldoPessoa(p, ferias);
    saldos[p.id] = s;
    if (!s) { alertas.push({ nivel: "BAIXO", pessoaId: p.id, texto: `${p.nome}: sem data de admissão — não dá para calcular o período aquisitivo` }); continue; }
    for (const v of s.vencidas) alertas.push({ nivel: "ALTO", pessoaId: p.id, texto: `${p.nome}: ${v.saldo} dia(s) do ${v.n}º período (${dBR(v.inicio)}–${dBR(v.fim)}) passaram do limite ${dBR(v.limite)} — férias em dobro` });
    for (const per of s.periodos.filter((x) => x.completo && x.saldo > 0 && x.limite >= H && x.limite <= somaDia(H, 120))) {
      const ate = somaDia(per.limite, -per.saldo + 1);
      alertas.push({ nivel: "ALTO", pessoaId: p.id, texto: ate >= H
        ? `${p.nome}: ${per.saldo} dia(s) do ${per.n}º período precisam começar até ${dBR(ate)} (limite ${dBR(per.limite)})`
        : `${p.nome}: ${per.saldo} dia(s) do ${per.n}º período não cabem mais antes do limite ${dBR(per.limite)} — os dias que passarem saem em dobro; programe já` });
    }
  }
  // regras de cada período lançado
  for (const f of doAno) {
    const p = ativos.find((x) => x.id === f.pessoaId);
    if (!p) continue;
    const w = dUTC(f.inicio).getUTCDay();
    if (w === 5 || w === 6 || w === 0) alertas.push({ nivel: "MEDIO", pessoaId: p.id, texto: `${p.nome}: férias começam numa ${DIA_SEM[w]} (${dBR(f.inicio)}) — a CLT proíbe iniciar nos 2 dias antes do repouso semanal ou feriado` });
    if (f.dias < 5) alertas.push({ nivel: "MEDIO", pessoaId: p.id, texto: `${p.nome}: período de ${f.dias} dia(s) a partir de ${dBR(f.inicio)} — nenhum período pode ter menos de 5 dias` });
  }
  for (const p of ativos) {
    const doPeriodo = doAno.filter((f) => f.pessoaId === p.id);
    if (doPeriodo.length > 3) alertas.push({ nivel: "MEDIO", pessoaId: p.id, texto: `${p.nome}: ${doPeriodo.length} períodos no ano — a CLT permite dividir em até 3` });
    if (doPeriodo.length > 1 && !doPeriodo.some((f) => f.dias >= 14)) alertas.push({ nivel: "MEDIO", pessoaId: p.id, texto: `${p.nome}: férias divididas sem nenhum período de 14 dias ou mais` });
  }
  // sobreposição no mesmo setor
  const porDepto = {};
  for (const p of ativos) (porDepto[p.depto] ||= []).push(p.id);
  const sobre = [];
  for (const [depto, ids] of Object.entries(porDepto)) {
    if (ids.length < 2) continue;
    let atual = null;
    for (let d = `${ano}-01-01`; d <= `${ano}-12-31`; d = somaDia(d, 1)) {
      const fora = ids.filter((id) => doAno.some((f) => f.tipo !== "COLETIVA" && f.pessoaId === id && f.inicio <= d && f.fim >= d));   // coletiva é de propósito
      const pct = Math.round((fora.length / ids.length) * 100);
      if (pct > LIMITE_SETOR && fora.length >= 2) {
        const chave = fora.sort().join(",");
        if (atual && atual.chave === chave && atual.fim === somaDia(d, -1)) atual.fim = d;
        else { atual = { depto, nomeDepto: nomeDepto(depto), chave, inicio: d, fim: d, n: fora.length, total: ids.length, pct, nomes: fora.map((id) => ativos.find((x) => x.id === id)?.nome) }; sobre.push(atual); }
      } else atual = null;
    }
  }
  for (const s of sobre) alertas.push({ nivel: "ALTO", texto: `${s.nomeDepto}: ${s.n} de ${s.total} (${s.pct}%) de férias de ${dBR(s.inicio)} a ${dBR(s.fim)} — ${s.nomes.join(", ")}` });
  // quem ainda não tem férias planejadas no ano e já tem saldo
  for (const p of ativos) {
    const s = saldos[p.id];
    if (s && s.saldo > 0 && !doAno.some((f) => f.pessoaId === p.id)) alertas.push({ nivel: "BAIXO", pessoaId: p.id, texto: `${p.nome}: ${s.saldo} dia(s) de saldo e nenhuma férias planejada em ${ano}` });
  }
  const coletivas = Object.values(doAno.filter((f) => f.coletivaId).reduce((a, f) => { (a[f.coletivaId] ||= { coletivaId: f.coletivaId, inicio: f.inicio, fim: f.fim, dias: f.dias, pessoas: [] }).pessoas.push(f.pessoaId); return a; }, {}));
  const peso = { ALTO: 0, MEDIO: 1, BAIXO: 2 };
  alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  // de férias agora e nos próximos 30 dias
  const agora = doAno.filter((f) => f.inicio <= H && f.fim >= H).map((f) => f.pessoaId);
  const proximas = doAno.filter((f) => f.inicio > H && f.inicio <= somaDia(H, 30));
  return { ano, pessoas: ativos, ferias: doAno, saldos, alertas, coletivas, sobreposicoes: sobre, agora, proximas, limiteSetor: LIMITE_SETOR, deptos: Object.fromEntries(DEPTOS) };
}
