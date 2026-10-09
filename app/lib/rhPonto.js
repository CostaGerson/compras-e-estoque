// v168 — RH › Ponto: importação dos cartões, crítica de dias sem registro, justificativas e indicadores
// (assiduidade, pontualidade, horas extras) por funcionário e geral.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { lerCartoesPonto, minutos, inferirHorario } from "@/lib/rhPontoLer";
import { lerPessoal, nomeUsuario } from "@/lib/rh";

export const TOLERANCIA_ATRASO = 5;           // minutos de tolerância na entrada (art. 58 §1º da CLT)
export const LIMITE_HE_MES = 20 * 60;         // alerta acima de 20 h extras no mês
export const MOTIVOS = ["TROCA DE SISTEMA", "PONTO MANUAL", "ATESTADO", "FÉRIAS", "FOLGA", "FALTA", "OUTRO"];
const PRESENCA = new Set(["TROCA DE SISTEMA", "PONTO MANUAL"]);
const NAO_PREVISTO = new Set(["FERIADO", "FOLGA", "FERIAS", "AFASTAMENTO", "DOMINGO", "SABADO", "COMPENSACAO", "ABONO"]);

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dig = (t) => String(t || "").replace(/\D/g, "");
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const somaDia = (s, n) => iso(new Date(dUTC(s).getTime() + n * 86400000));
export const fimDoMes = (c) => { const [a, m] = c.split("-").map(Number); return iso(new Date(Date.UTC(a, m, 0))); };
const r1 = (v) => Math.round(v * 1000) / 10;   // fração → % com 1 casa

// ---------- casar o cartão com o funcionário da Matriz ----------
export async function pessoasParaPonto() {
  const { pessoas } = await lerPessoal();
  const fichas = await prisma.rhFuncionario.findMany({ select: { pessoaId: true, nomeCompleto: true, dados: true } });
  const f = Object.fromEntries(fichas.map((x) => [x.pessoaId, x]));
  return pessoas.map((p) => ({ ...p, cpf: dig(f[p.id]?.dados?.cpf), admissaoFicha: f[p.id]?.dados?.admissao || null }));
}

export function casar(cartao, pessoas) {
  const cpf = dig(cartao.cpf), nome = semAcento(cartao.nome);
  const tok = nome.split(" ").filter((t) => t.length > 2);
  let p = cpf && pessoas.find((x) => x.cpf && x.cpf === cpf);
  if (p) return { pessoaId: p.id, por: "CPF" };
  p = pessoas.find((x) => x.nomeCompleto && semAcento(x.nomeCompleto) === nome);
  if (p) return { pessoaId: p.id, por: "NOME COMPLETO" };
  // nome curto da Matriz contido no nome do cartão ("LEANDRO MELO" ⊂ "LEANDRO GONÇALVES DE MELO")
  const cand = pessoas.filter((x) => { const t = semAcento(x.nome).split(" ").filter((w) => w.length > 2); return t.length && t.every((w) => tok.includes(w)); });
  if (cand.length === 1) return { pessoaId: cand[0].id, por: "NOME" };
  const prim = pessoas.filter((x) => semAcento(x.nome).split(" ")[0] === tok[0]);
  if (prim.length === 1) return { pessoaId: prim[0].id, por: "PRIMEIRO NOME", duvida: true };
  return { pessoaId: null, por: null };
}

const hashCartao = (b64, i) => crypto.createHash("sha256").update(String(b64)).update(`|${i}`).digest("hex");

// ---------- analisar (sem gravar) ----------
export async function analisarArquivos(arquivos) {
  const pessoas = await pessoasParaPonto();
  const out = [];
  for (const a of arquivos) {
    try {
      const cartoes = await lerCartoesPonto(Buffer.from(String(a.conteudo || ""), "base64"));
      for (let i = 0; i < cartoes.length; i++) {
        const c = cartoes[i];
        const hash = hashCartao(a.conteudo, i);
        const ja = await prisma.rhPontoImport.findUnique({ where: { hash }, select: { id: true, createdAt: true, criadoPorNome: true } });
        const m = casar(c, pessoas);
        const crit = criticaCartao(c, pessoas.find((p) => p.id === m.pessoaId));
        out.push({
          arquivo: a.nome, indice: i, hash, jaImportado: ja ? { em: ja.createdAt, por: ja.criadoPorNome } : null,
          nome: c.nome, cpf: c.cpf, cargo: c.cargo, admissao: c.admissao, inicio: c.inicio, fim: c.fim, empresa: c.empresa, horario: c.horario,
          totais: c.totais || c.soma, prova: c.prova, dias: c.dias.length, ...m, critica: crit,
          he: c.dias.reduce((s, d) => s + d.extra + d.exced, 0), faltas: c.dias.filter((d) => d.ocorrencias.includes("FALTA") && !d.marcacoes.length).length,
        });
      }
    } catch (e) { out.push({ arquivo: a.nome, erro: e.message }); }
  }
  return { itens: out, pessoas: pessoas.filter((p) => p.ativo !== false).map((p) => ({ id: p.id, nome: p.nome, nomeCompleto: p.nomeCompleto, empresa: p.empresa })) };
}

// dias do período que não vieram no cartão, sem marcação em dia de trabalho ou com marcação ímpar
function criticaCartao(c, pessoa) {
  const adm = c.admissao || pessoa?.admissao || null;
  const dem = pessoa?.demissao || null;
  const porData = Object.fromEntries(c.dias.map((d) => [d.data, d]));
  const itens = [];
  for (let d = c.inicio; d <= c.fim; d = somaDia(d, 1)) {
    if (adm && d < adm) continue;
    if (dem && d > dem) continue;
    const x = porData[d];
    const dow = dUTC(d).getUTCDay();
    const trabalha = !!(c.horario && c.horario[dow]);
    if (!x) { if (trabalha) itens.push({ data: d, tipo: "SEM REGISTRO", detalhe: "dia ausente no cartão" }); continue; }
    if (!x.marcacoes.length && !x.ocorrencias.length && trabalha) itens.push({ data: d, tipo: "SEM REGISTRO", detalhe: "dia útil sem marcação" });
    else if (x.marcacoes.length % 2 === 1 && !x.ocorrencias.length) itens.push({ data: d, tipo: "MARCAÇÃO INCOMPLETA", detalhe: `${x.marcacoes.length} marcação(ões): ${x.marcacoes.join(" ")}` });
  }
  return itens;
}

// ---------- gravar ----------
// itens: [{ arquivo, indice, pessoaId }] — arquivos: [{ nome, conteudo }]
export async function gravarCartoes(itens, arquivos, u) {
  const quem = nomeUsuario(u);
  const porNome = Object.fromEntries(arquivos.map((a) => [a.nome, a]));
  const cache = {};
  const res = [];
  for (const it of itens) {
    if (!it.pessoaId) { res.push({ arquivo: it.arquivo, erro: "escolha o funcionário" }); continue; }
    const a = porNome[it.arquivo];
    if (!a) { res.push({ arquivo: it.arquivo, erro: "arquivo não enviado" }); continue; }
    cache[a.nome] ||= await lerCartoesPonto(Buffer.from(String(a.conteudo || ""), "base64"));
    const c = cache[a.nome][it.indice];
    if (!c) { res.push({ arquivo: it.arquivo, erro: "cartão não encontrado" }); continue; }
    const hash = hashCartao(a.conteudo, it.indice);
    const antigo = await prisma.rhPontoImport.findUnique({ where: { hash } });
    if (antigo) await prisma.rhPontoImport.delete({ where: { id: antigo.id } });   // reimportar o mesmo arquivo substitui
    const imp = await prisma.rhPontoImport.create({ data: {
      pessoaId: it.pessoaId, nome: c.nome || "?", cpf: c.cpf, cracha: c.cracha, cargo: c.cargo,
      admissao: c.admissao ? dUTC(c.admissao) : null, empresa: /NORT/i.test(c.empresa || "") ? "NORT" : "MERIDIAN",
      inicio: dUTC(c.inicio), fim: dUTC(c.fim), horario: c.horario || {}, totais: c.totais || c.soma || {},
      arquivo: a.nome, hash, conteudo: String(a.conteudo), criadoPorNome: quem,
    } });
    // os dias do período passam a ser os deste cartão (inclusive os ausentes, marcados como sem registro)
    const porData = Object.fromEntries(c.dias.map((d) => [d.data, d]));
    const linhas = [];
    for (let d = c.inicio; d <= c.fim; d = somaDia(d, 1)) {
      if (c.admissao && d < c.admissao) continue;
      const x = porData[d];
      const dow = dUTC(d).getUTCDay();
      const ent = c.horario?.[dow]?.[0] || null;
      if (!x && !ent) continue;   // fim de semana fora do cartão: nada a registrar
      linhas.push({
        importId: imp.id, pessoaId: it.pessoaId, data: dUTC(d), competencia: d.slice(0, 7), dow, entradaPrevista: ent,
        marcacoes: x?.marcacoes || [], ocorrencias: x?.ocorrencias || [], primeiro: x?.primeiro || null,
        trab: x?.trab || 0, falta: x?.falta || 0, extra: x?.extra || 0, exced: x?.exced || 0, semRegistro: !x,
      });
    }
    await prisma.rhPontoDia.deleteMany({ where: { pessoaId: it.pessoaId, data: { gte: dUTC(c.inicio), lte: dUTC(c.fim) } } });
    await prisma.rhPontoDia.createMany({ data: linhas });
    // completa a ficha do carômetro com o que o cartão traz (sem apagar o que já existe)
    const ficha = await prisma.rhFuncionario.findUnique({ where: { pessoaId: it.pessoaId } });
    const dados = { ...(ficha?.dados || {}) };
    let mudou = false;
    if (c.cpf && !dados.cpf) { dados.cpf = c.cpf; mudou = true; }
    if (c.admissao && !dados.admissao) { dados.admissao = c.admissao; mudou = true; }
    if (c.cracha && !dados.cracha) { dados.cracha = c.cracha; mudou = true; }
    if (!ficha) await prisma.rhFuncionario.create({ data: { pessoaId: it.pessoaId, nomeCompleto: c.nome || null, dados, atualizadoPorNome: quem } });
    else if (mudou || (!ficha.nomeCompleto && c.nome)) await prisma.rhFuncionario.update({ where: { id: ficha.id }, data: { dados, nomeCompleto: ficha.nomeCompleto || c.nome, atualizadoPorNome: quem } });
    res.push({ arquivo: a.nome, nome: c.nome, pessoaId: it.pessoaId, dias: linhas.length, semRegistro: linhas.filter((l) => l.semRegistro).length });
  }
  return res;
}

export async function justificar(chaves, motivo, texto, u) {
  const m = String(motivo || "").toUpperCase();
  if (!MOTIVOS.includes(m)) return { error: "Escolha o motivo." };
  if (m === "OUTRO" && !String(texto || "").trim()) return { error: "Descreva o motivo." };
  const quem = nomeUsuario(u);
  let n = 0;
  for (const ch of chaves || []) {
    const [pessoaId, ref] = String(ch).split("|");
    if (!pessoaId || !/^\d{4}-\d{2}(-\d{2})?$/.test(ref || "")) continue;
    await prisma.rhPontoJust.upsert({
      where: { chave: ch },
      create: { chave: ch, pessoaId, ref, motivo: m, texto: String(texto || "").toUpperCase().slice(0, 500) || null, porNome: quem },
      update: { motivo: m, texto: String(texto || "").toUpperCase().slice(0, 500) || null, porNome: quem },
    });
    n++;
  }
  return { ok: true, n };
}

export async function desfazerJustificativa(chave) {
  await prisma.rhPontoJust.deleteMany({ where: { chave: String(chave) } });
  return { ok: true };
}

// ---------- avaliação de um dia ----------
export function avaliarDia(d, just, emFerias = false) {
  const oc = d.ocorrencias || [], mc = d.marcacoes || [];
  // v169 — dia dentro das férias do plano: não conta para assiduidade, pontualidade nem crítica
  if (emFerias || oc.includes("FERIAS")) return { previsto: false, pendente: false, tipoPend: null, justificado: false, motivo: null, ferias: true,
    falta: false, atestado: false, atraso: false, minAtraso: 0, baseAtraso: false, he: (d.extra || 0) + (d.exced || 0), exced: d.exced || 0, minFalta: 0 };
  const previsto = !!d.entradaPrevista && !oc.some((o) => NAO_PREVISTO.has(o));
  const pendente = d.semRegistro || (previsto && !mc.length && !oc.length) || (mc.length % 2 === 1 && !oc.length);
  const tipoPend = !pendente ? null : (mc.length % 2 === 1 ? "MARCAÇÃO INCOMPLETA" : "SEM REGISTRO");
  const r = { previsto, pendente: pendente && !just, tipoPend, justificado: pendente && !!just, motivo: just?.motivo || null,
    falta: false, atestado: false, atraso: false, minAtraso: 0, baseAtraso: false, he: (d.extra || 0) + (d.exced || 0), exced: d.exced || 0, minFalta: d.falta || 0 };
  if (just) {
    if (just.motivo === "FALTA") r.falta = previsto || !!d.entradaPrevista;
    else if (just.motivo === "ATESTADO") r.atestado = true;
    return r;
  }
  if (!previsto) return r;
  if (!mc.length && oc.includes("FALTA")) r.falta = true;
  if (!mc.length && oc.includes("ATESTADO")) r.atestado = true;
  if (mc.length && d.primeiro === "M") {
    r.baseAtraso = true;
    // pontual: qualquer entrada antes do horário previsto ou até 5 min depois dele; atraso só acima disso
    const atraso = minutos(mc[0]) - minutos(d.entradaPrevista);
    if (atraso > TOLERANCIA_ATRASO) { r.atraso = true; r.minAtraso = atraso; }
  }
  return r;
}

const vazio = () => ({ previstos: 0, faltas: 0, atestados: 0, pendentes: 0, justificados: 0, atrasos: 0, baseAtraso: 0, minAtraso: 0, he: 0, exced: 0, diasAcima2h: 0, minFalta: 0, dias: 0, diasFerias: 0 });
function soma(a, r) {
  a.dias++;
  if (r.ferias) a.diasFerias = (a.diasFerias || 0) + 1;
  if (r.previsto) a.previstos++;
  if (r.falta) a.faltas++;
  if (r.atestado) a.atestados++;
  if (r.pendente) a.pendentes++;
  if (r.justificado) a.justificados++;
  if (r.baseAtraso) a.baseAtraso++;
  if (r.atraso) { a.atrasos++; a.minAtraso += r.minAtraso; }
  a.he += r.he; a.exced += r.exced; if (r.exced > 0) a.diasAcima2h++;
  a.minFalta += r.minFalta;
  return a;
}
export function indices(a) {
  const base = a.previstos - a.pendentes;
  return {
    ...a,
    assiduidade: base > 0 ? r1(1 - a.faltas / base) : null,
    pontualidade: a.baseAtraso > 0 ? r1(1 - a.atrasos / a.baseAtraso) : null,
  };
}

// ---------- leitura agregada ----------
export async function competenciasComPonto() {
  const l = await prisma.rhPontoDia.groupBy({ by: ["competencia"], _count: { _all: true }, orderBy: { competencia: "asc" } });
  return l.map((x) => x.competencia);
}

// v169 — dias de férias do plano (RhFerias) por pessoa: { pid: Set("AAAA-MM-DD") }
export async function feriasPorPessoa(pessoaIds = null) {
  const l = await prisma.rhFerias.findMany({ where: { status: { not: "CANCELADA" }, ...(pessoaIds ? { pessoaId: { in: pessoaIds } } : {}) } }).catch(() => []);
  const out = {};
  for (const f of l) {
    const s = (out[f.pessoaId] ||= new Set());
    for (let d = iso(f.inicio); d <= iso(f.fim); d = somaDia(d, 1)) s.add(d);
  }
  return out;
}

async function completarHorario(dias) {
  const semHorario = [...new Set(dias.filter((d) => !d.entradaPrevista && (d.trab || 0) + (d.falta || 0) > 0).map((d) => d.pessoaId))];
  if (!semHorario.length) return;
  const todos = await prisma.rhPontoDia.findMany({ where: { pessoaId: { in: semHorario } }, select: { pessoaId: true, dow: true, trab: true, falta: true, primeiro: true, marcacoes: true } });
  const inf = {};
  for (const pid of semHorario) inf[pid] = inferirHorario(todos.filter((x) => x.pessoaId === pid));
  for (const d of dias) if (!d.entradaPrevista && inf[d.pessoaId]?.[d.dow]) d.entradaPrevista = inf[d.pessoaId][d.dow][0];
}

// v169 — período livre (carômetro): { porPessoa: { pid: acumulado com índices } } e, para uma pessoa, a síntese dia a dia
export async function apurarPeriodo(de, ate, pessoaId = null) {
  const where = { data: { gte: dUTC(de), lte: dUTC(ate) }, ...(pessoaId ? { pessoaId } : {}) };
  const [dias, justs, fer] = await Promise.all([
    prisma.rhPontoDia.findMany({ where, orderBy: { data: "asc" } }),
    prisma.rhPontoJust.findMany(pessoaId ? { where: { pessoaId } } : undefined),
    feriasPorPessoa(pessoaId ? [pessoaId] : null),
  ]);
  await completarHorario(dias);
  const J = Object.fromEntries(justs.map((j) => [j.chave, j]));
  const acc = {}, det = { faltas: [], atestados: [], atrasos: [], extras: [], pendentes: [], ferias: [], justificados: [], horasFalta: [] };
  for (const d of dias) {
    const data = iso(d.data);
    const just = J[`${d.pessoaId}|${data}`];
    const r = avaliarDia(d, just, !!fer[d.pessoaId]?.has(data));
    soma((acc[d.pessoaId] ||= vazio()), r);
    if (!pessoaId) continue;
    if (r.ferias) det.ferias.push(data);
    if (r.falta) det.faltas.push({ data, motivo: just?.motivo || null });
    if (r.atestado) det.atestados.push({ data });
    if (r.atraso) det.atrasos.push({ data, entrada: (d.marcacoes || [])[0], previsto: d.entradaPrevista, min: r.minAtraso });
    if (r.he > 0) det.extras.push({ data, dow: d.dow, min: r.he, exced: r.exced, marcacoes: d.marcacoes || [] });
    if (r.pendente) det.pendentes.push({ data, tipo: r.tipoPend });
    if (r.justificado) det.justificados.push({ data, motivo: just.motivo, texto: just.texto });
    if (r.previsto && !r.falta && r.minFalta > 0 && (d.marcacoes || []).length) det.horasFalta.push({ data, min: r.minFalta });
  }
  const porPessoa = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, indices(v)]));
  return pessoaId ? { total: porPessoa[pessoaId] || null, ...det } : { porPessoa };
}

// { [pessoaId]: { [comp]: acumulado } } nas competências pedidas + lista de pendências
export async function apurar(comps, pessoaIds = null) {
  if (!comps.length) return { porPessoa: {}, pendencias: [] };
  const where = { competencia: { in: comps } };
  if (pessoaIds) where.pessoaId = { in: pessoaIds };
  const [dias, justs] = await Promise.all([
    prisma.rhPontoDia.findMany({ where, orderBy: { data: "asc" } }),
    prisma.rhPontoJust.findMany(pessoaIds ? { where: { pessoaId: { in: pessoaIds } } } : undefined),
  ]);
  const J = Object.fromEntries(justs.map((j) => [j.chave, j]));
  // v168.3 — cartões gravados sem horário (quadro não lido): deduz a entrada prevista pelos próprios dias
  await completarHorario(dias);
  const fer = await feriasPorPessoa(pessoaIds);
  const porPessoa = {}, pendencias = [];
  for (const d of dias) {
    const data = iso(d.data);
    const just = J[`${d.pessoaId}|${data}`];
    const r = avaliarDia(d, just, !!fer[d.pessoaId]?.has(data));
    const p = (porPessoa[d.pessoaId] ||= {});
    soma((p[d.competencia] ||= vazio()), r);
    if (r.pendente || r.justificado) pendencias.push({ chave: `${d.pessoaId}|${data}`, pessoaId: d.pessoaId, data, competencia: d.competencia, tipo: r.tipoPend,
      detalhe: d.semRegistro ? "dia ausente no cartão" : (d.marcacoes || []).length ? `marcações: ${(d.marcacoes || []).join(" ")}` : "dia útil sem marcação",
      justificativa: just ? { motivo: just.motivo, texto: just.texto, por: just.porNome } : null });
  }
  return { porPessoa, pendencias, justs: J, ferias: fer };
}

// mês inteiro sem cartão para quem estava ativo (diretores com pró-labore não batem ponto)
export function mesesSemCartao(pessoas, comps, porPessoa, J, ferias = {}) {
  const out = [];
  for (const c of comps) {
    const ini = `${c}-01`, fim = fimDoMes(c);
    for (const p of pessoas) {
      if (p.regime === "DIRETOR") continue;
      const adm = p.admissao || p.admissaoFicha;
      if (adm && adm > fim) continue;
      if (p.demissao && p.demissao < ini) continue;
      if (p.ativo === false && !p.demissao) continue;
      if (porPessoa[p.id]?.[c]) continue;
      // mês todo de férias (dias úteis) não pede cartão
      const fs = ferias[p.id];
      if (fs) { let todos = true; for (let d = ini; d <= fim; d = somaDia(d, 1)) { const w = dUTC(d).getUTCDay(); if (w && w < 6 && !fs.has(d)) { todos = false; break; } } if (todos) continue; }
      const just = J[`${p.id}|${c}`];
      out.push({ chave: `${p.id}|${c}`, pessoaId: p.id, competencia: c, tipo: "MÊS SEM CARTÃO", detalhe: "nenhum dia de ponto importado no mês",
        justificativa: just ? { motivo: just.motivo, texto: just.texto, por: just.porNome } : null });
    }
  }
  return out;
}

export async function listarImportacoes() {
  const l = await prisma.rhPontoImport.findMany({ orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, pessoaId: true, nome: true, cpf: true, inicio: true, fim: true, arquivo: true, totais: true, criadoPorNome: true, createdAt: true, _count: { select: { dias: true } } } });
  return l.map((x) => ({ ...x, inicio: iso(x.inicio), fim: iso(x.fim), dias: x._count.dias }));
}
