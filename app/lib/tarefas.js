// v169 — Tarefas: demandas entre setores, recorrência, subtarefas, arquivos, dependências, play/stop e status das pessoas
import { prisma } from "@/lib/prisma";
import { ehMaster, setorTarefaDe, SETORES_TAREFA, NOME_SETOR_TAREFA } from "@/lib/acesso";
import { normalizarRegra, datasDaSerie, descreverRecorrencia } from "@/lib/recorrencia";

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const somaDia = (s, n) => iso(new Date(dUTC(s).getTime() + n * 86400000));
const nome = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
export const HORIZONTE_DIAS = 60;                       // séries geram ocorrências até 60 dias à frente
export const EXPEDIENTE = { dias: [1, 2, 3, 4, 5], ini: "07:00", fim: "18:00" };   // fora disso a pessoa fica "inativo"
const SEL_U = { id: true, nome: true, sobrenome: true, email: true, setor: true, isMaster: true, ativo: true, diretoria: true, fotoBase64: true, statusManual: true, statusDesde: true, pessoaId: true };

export async function usuarioAtivo(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: SEL_U });
  return u && u.ativo ? u : null;
}
const podeVer = (t, u) => t.publica || t.responsavelId === u.id;
const podeEditar = (t, u) => t.criadoPorId === u.id || t.responsavelId === u.id || ehMaster(u);

async function avisar(deId, paraId, texto) {
  if (!paraId || paraId === deId) return;
  await prisma.mensagem.create({ data: { deId, paraId, texto: String(texto).slice(0, 2000) } }).catch(() => {});
}

// ---------- séries recorrentes ----------
export async function gerarOcorrencias(ate) {
  const limite = ate && ate > somaDia(hojeSP(), HORIZONTE_DIAS) ? ate : somaDia(hojeSP(), HORIZONTE_DIAS);
  const series = await prisma.tarefa.findMany({ where: { modelo: true, status: { not: "CANCELADA" } } });
  for (const s of series) {
    const r = s.recorrencia;
    if (!r) continue;
    const ultima = await prisma.tarefa.findFirst({ where: { serieId: s.id }, orderBy: { prazo: "desc" }, select: { prazo: true } });
    const de = ultima ? somaDia(iso(ultima.prazo), 1) : iso(s.prazo);
    const datas = datasDaSerie(r, iso(s.prazo), de, limite);
    if (!datas.length) continue;
    await prisma.tarefa.createMany({ skipDuplicates: true, data: datas.map((d) => ({
      titulo: s.titulo, descricao: s.descricao, setor: s.setor, responsavelId: s.responsavelId, responsavelNome: s.responsavelNome,
      criadoPorId: s.criadoPorId, criadoPorNome: s.criadoPorNome, prazo: dUTC(d), tipo: "ROTINA", publica: s.publica, serieId: s.id,
      subtarefas: (s.subtarefas || []).map((x) => ({ texto: x.texto, feita: false })), dependencias: [],
    })) });
  }
}

// ---------- leitura ----------
const resumo = (t, abertas = {}) => ({
  id: t.id, titulo: t.titulo, descricao: t.descricao, setor: t.setor, responsavelId: t.responsavelId, responsavelNome: t.responsavelNome,
  criadoPorId: t.criadoPorId, criadoPorNome: t.criadoPorNome, prazo: iso(t.prazo), tipo: t.tipo, publica: t.publica, status: t.status,
  serieId: t.serieId, recorrencia: t.recorrencia || null, subtarefas: t.subtarefas || [], dependencias: t.dependencias || [],
  tempoTotal: t.tempoTotal, emAndamentoDesde: t.emAndamentoDesde, retorno: t.retorno, concluidaEm: t.concluidaEm, concluidaPorNome: t.concluidaPorNome,
  createdAt: t.createdAt, nArquivos: t._count?.arquivos ?? 0, sessaoAberta: abertas[t.id] || null,
});

export async function listar(u, { de, ate, escopo, incluirConcluidas = true }) {
  await gerarOcorrencias(ate);
  const where = { modelo: false, status: { not: "CANCELADA" } };
  if (de || ate) where.prazo = { ...(de ? { gte: dUTC(de) } : {}), ...(ate ? { lte: dUTC(ate) } : {}) };
  if (!incluirConcluidas) where.status = { notIn: ["CANCELADA", "CONCLUIDA"] };
  if (escopo === "minhas") where.responsavelId = u.id;
  else if (escopo === "criadas") where.AND = [{ criadoPorId: u.id }, { OR: [{ publica: true }, { responsavelId: u.id }] }];
  else where.OR = [{ publica: true }, { responsavelId: u.id }];
  const l = await prisma.tarefa.findMany({ where, orderBy: [{ prazo: "asc" }, { id: "asc" }], take: 3000, include: { _count: { select: { arquivos: true } } } });
  return enriquecer(l, u);
}

async function enriquecer(l, u) {
  const abertas = Object.fromEntries((await prisma.tarefaSessao.findMany({ where: { fim: null, tarefaId: { in: l.map((t) => t.id) } } })).map((s) => [s.tarefaId, { usuarioId: s.usuarioId, inicio: s.inicio }]));
  const depIds = [...new Set(l.flatMap((t) => t.dependencias || []))];
  const deps = depIds.length ? await prisma.tarefa.findMany({ where: { id: { in: depIds } }, select: { id: true, titulo: true, status: true, responsavelNome: true, prazo: true, publica: true } }) : [];
  const D = Object.fromEntries(deps.map((x) => [x.id, { ...x, prazo: iso(x.prazo) }]));
  const serieIds = [...new Set(l.map((t) => t.serieId).filter(Boolean))];
  const series = serieIds.length ? await prisma.tarefa.findMany({ where: { id: { in: serieIds } }, select: { id: true, recorrencia: true } }) : [];
  const S = Object.fromEntries(series.map((x) => [x.id, x.recorrencia]));
  return l.map((t) => {
    const r = resumo(t, abertas);
    r.recorrencia = t.serieId ? S[t.serieId] || null : null;
    r.recorrenciaTexto = descreverRecorrencia(r.recorrencia);
    r.deps = (t.dependencias || []).map((id) => D[id] || { id, titulo: "(demanda removida)", status: "CONCLUIDA" });
    r.bloqueada = r.deps.some((x) => x.status !== "CONCLUIDA" && x.status !== "CANCELADA");
    r.podeEditar = podeEditar(t, u);
    return r;
  });
}

export async function detalhe(id, u) {
  const t = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 }, include: { arquivos: { select: { id: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true } }, sessoes: { orderBy: { inicio: "desc" }, take: 50 } } });
  if (!t || !podeVer(t, u)) return null;
  const [r] = await enriquecer([{ ...t, _count: { arquivos: t.arquivos.length } }], u);
  const users = await prisma.usuario.findMany({ where: { id: { in: [...new Set(t.sessoes.map((s) => s.usuarioId))] } }, select: { id: true, nome: true } });
  const U = Object.fromEntries(users.map((x) => [x.id, x.nome]));
  return { ...r, arquivos: t.arquivos, sessoes: t.sessoes.map((s) => ({ ...s, usuarioNome: U[s.usuarioId] || "?" })),
    dependentes: (await prisma.tarefa.findMany({ where: { status: { not: "CANCELADA" }, modelo: false }, select: { id: true, titulo: true, dependencias: true, responsavelNome: true, publica: true } }))
      .filter((x) => (x.dependencias || []).includes(t.id) && (x.publica)).map((x) => ({ id: x.id, titulo: x.titulo, responsavelNome: x.responsavelNome })) };
}

// ---------- criar / editar ----------
function limpar(b) {
  const t = {
    titulo: String(b.titulo || "").trim().toUpperCase().slice(0, 200),
    descricao: String(b.descricao || "").trim().slice(0, 8000) || null,
    setor: SETORES_TAREFA.some(([k]) => k === b.setor) ? b.setor : null,
    responsavelId: Number(b.responsavelId) || null,
    prazo: /^\d{4}-\d{2}-\d{2}$/.test(b.prazo || "") ? b.prazo : null,
    tipo: b.tipo === "URGENTE" ? "URGENTE" : b.tipo === "ROTINA" ? "ROTINA" : "PADRAO",
    publica: b.publica !== false,
    subtarefas: (Array.isArray(b.subtarefas) ? b.subtarefas : []).map((x) => ({ texto: String(x.texto || "").trim().slice(0, 300), feita: !!x.feita })).filter((x) => x.texto),
    dependencias: [...new Set((Array.isArray(b.dependencias) ? b.dependencias : []).map(Number).filter(Boolean))],
  };
  return t;
}

async function validarDeps(ids, proprioId) {
  if (!ids.length) return null;
  if (proprioId && ids.includes(proprioId)) return "Uma demanda não pode depender dela mesma.";
  const l = await prisma.tarefa.findMany({ where: { id: { in: ids } }, select: { id: true, publica: true, dependencias: true } });
  if (l.length !== ids.length) return "Alguma dependência não existe mais.";
  if (l.some((x) => !x.publica)) return "Só dá para depender de demandas públicas.";
  if (proprioId && l.some((x) => (x.dependencias || []).includes(proprioId))) return "Dependência circular: a outra demanda já depende desta.";
  return null;
}

export async function criar(b, u) {
  const t = limpar(b);
  if (!t.titulo) return { error: "Escreva a demanda." };
  if (!t.setor) return { error: "Escolha o setor." };
  if (!t.responsavelId) return { error: "Escolha o colaborador." };
  if (!t.prazo) return { error: "Informe a data limite." };
  const resp = await prisma.usuario.findUnique({ where: { id: t.responsavelId }, select: { id: true, nome: true, sobrenome: true, ativo: true } });
  if (!resp?.ativo) return { error: "Colaborador inválido." };
  const e = await validarDeps(t.dependencias); if (e) return { error: e };
  const regra = normalizarRegra(b.recorrencia, t.prazo);
  const base = { ...t, prazo: dUTC(t.prazo), responsavelNome: nome(resp), criadoPorId: u.id, criadoPorNome: nome(u) };
  let criada;
  if (regra) {
    // a série guarda a regra; as ocorrências (rotina) aparecem na lista/agenda
    const serie = await prisma.tarefa.create({ data: { ...base, tipo: "ROTINA", modelo: true, recorrencia: regra, dependencias: [] } });
    await gerarOcorrencias();
    criada = await prisma.tarefa.findFirst({ where: { serieId: serie.id }, orderBy: { prazo: "asc" } });
    if (criada && t.dependencias.length) await prisma.tarefa.update({ where: { id: criada.id }, data: { dependencias: t.dependencias } });
  } else criada = await prisma.tarefa.create({ data: base });
  await avisar(u.id, t.responsavelId, `📌 NOVA DEMANDA${t.tipo === "URGENTE" ? " URGENTE" : ""} de ${nome(u)} para ${t.prazo.split("-").reverse().join("/")}: ${t.titulo}${regra ? ` (${descreverRecorrencia(regra)})` : ""} — veja em Tarefas.`);
  return { ok: true, tarefa: criada };
}

export async function editar(id, b, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x || !podeVer(x, u)) return { error: "Demanda não encontrada." };
  if (!podeEditar(x, u)) return { error: "Só quem criou, o responsável ou o master editam." };
  const t = limpar({ ...x, prazo: iso(x.prazo), ...b });
  if (!t.titulo || !t.setor || !t.responsavelId || !t.prazo) return { error: "Preencha setor, colaborador, demanda e data limite." };
  const e = await validarDeps(t.dependencias, x.id); if (e) return { error: e };
  const resp = t.responsavelId !== x.responsavelId ? await prisma.usuario.findUnique({ where: { id: t.responsavelId }, select: { nome: true, sobrenome: true, ativo: true } }) : null;
  if (resp && !resp.ativo) return { error: "Colaborador inválido." };
  const data = { ...t, prazo: dUTC(t.prazo), tipo: x.serieId ? (t.tipo === "URGENTE" ? "URGENTE" : "ROTINA") : t.tipo, ...(resp ? { responsavelNome: nome(resp) } : {}) };
  const up = await prisma.tarefa.update({ where: { id: x.id }, data });
  // alterar também as próximas da série (e a própria série)
  if (x.serieId && b.aplicarSerie) {
    const comuns = { titulo: data.titulo, descricao: data.descricao, setor: data.setor, responsavelId: data.responsavelId, publica: data.publica, ...(resp ? { responsavelNome: nome(resp) } : {}) };
    await prisma.tarefa.update({ where: { id: x.serieId }, data: { ...comuns, subtarefas: data.subtarefas.map((s) => ({ texto: s.texto, feita: false })) } });
    await prisma.tarefa.updateMany({ where: { serieId: x.serieId, prazo: { gt: x.prazo }, status: "ABERTA" }, data: comuns });
  }
  if (resp) await avisar(u.id, t.responsavelId, `📌 DEMANDA PASSADA PARA VOCÊ por ${nome(u)}: ${t.titulo} — prazo ${t.prazo.split("-").reverse().join("/")}.`);
  return { ok: true, tarefa: up };
}

export async function encerrarSerie(id, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x?.serieId) return { error: "Esta demanda não é recorrente." };
  if (!podeEditar(x, u)) return { error: "Sem permissão." };
  await prisma.tarefa.update({ where: { id: x.serieId }, data: { status: "CANCELADA" } });
  const r = await prisma.tarefa.updateMany({ where: { serieId: x.serieId, prazo: { gt: x.prazo }, status: "ABERTA" }, data: { status: "CANCELADA" } });
  return { ok: true, n: r.count };
}

export async function excluir(id, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x) return { ok: true };
  if (!(x.criadoPorId === u.id || ehMaster(u))) return { error: "Só quem criou ou o master excluem." };
  await fecharSessoes({ tarefaId: x.id });
  // ocorrência de série vira cancelada (senão a série recria); avulsa é apagada
  if (x.serieId) await prisma.tarefa.update({ where: { id: x.id }, data: { status: "CANCELADA" } });
  else await prisma.tarefa.delete({ where: { id: x.id } });
  return { ok: true };
}

// ---------- play / stop / concluir ----------
async function fecharSessoes(where) {
  const abertas = await prisma.tarefaSessao.findMany({ where: { ...where, fim: null } });
  const agora = new Date();
  for (const s of abertas) {
    const seg = Math.max(0, Math.round((agora - s.inicio) / 1000));
    await prisma.tarefaSessao.update({ where: { id: s.id }, data: { fim: agora, segundos: seg } });
    const t = await prisma.tarefa.update({ where: { id: s.tarefaId }, data: { tempoTotal: { increment: seg }, emAndamentoDesde: null } });
    if (t.status === "EM_ANDAMENTO") await prisma.tarefa.update({ where: { id: t.id }, data: { status: "ABERTA" } });
  }
  return abertas.length;
}

export async function play(id, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x || !podeVer(x, u)) return { error: "Demanda não encontrada." };
  if (x.responsavelId !== u.id) return { error: "Só o responsável inicia o trabalho na demanda." };
  if (x.status === "CONCLUIDA") return { error: "Demanda já concluída." };
  const deps = (x.dependencias || []).length ? await prisma.tarefa.findMany({ where: { id: { in: x.dependencias }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } }, select: { id: true, titulo: true } }) : [];
  if (deps.length) return { error: `Aguardando a conclusão de: ${deps.map((d) => `#${d.id} ${d.titulo}`).join(", ")}.` };
  await fecharSessoes({ usuarioId: u.id });   // uma coisa de cada vez
  await prisma.tarefaSessao.create({ data: { tarefaId: x.id, usuarioId: u.id } });
  await prisma.tarefa.update({ where: { id: x.id }, data: { status: "EM_ANDAMENTO", emAndamentoDesde: new Date() } });
  await prisma.usuario.update({ where: { id: u.id }, data: { statusManual: null, statusDesde: new Date() } });
  return { ok: true };
}

export async function stop(id, u) {
  await fecharSessoes({ tarefaId: Number(id) || 0, usuarioId: u.id });
  await prisma.usuario.update({ where: { id: u.id }, data: { statusDesde: new Date() } });
  return { ok: true };
}

export async function concluir(id, retorno, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x || !podeVer(x, u)) return { error: "Demanda não encontrada." };
  if (!(x.responsavelId === u.id || podeEditar(x, u))) return { error: "Sem permissão." };
  await fecharSessoes({ tarefaId: x.id });
  await prisma.tarefa.update({ where: { id: x.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nome(u), retorno: String(retorno || "").trim().slice(0, 4000) || null, emAndamentoDesde: null } });
  await avisar(u.id, x.criadoPorId, `✅ DEMANDA CONCLUÍDA por ${nome(u)}: ${x.titulo}${retorno ? ` — ${String(retorno).slice(0, 300)}` : ""}`);
  // libera quem dependia desta
  if (x.publica) {
    const dep = await prisma.tarefa.findMany({ where: { modelo: false, status: { notIn: ["CONCLUIDA", "CANCELADA"] } }, select: { id: true, titulo: true, responsavelId: true, dependencias: true } });
    for (const d of dep.filter((d) => (d.dependencias || []).includes(x.id))) await avisar(u.id, d.responsavelId, `🔓 A demanda "${x.titulo}" foi concluída — "${d.titulo}" (#${d.id}) pode seguir.`);
  }
  return { ok: true };
}

export async function reabrir(id, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x || !podeEditar(x, u)) return { error: "Sem permissão." };
  await prisma.tarefa.update({ where: { id: x.id }, data: { status: "ABERTA", concluidaEm: null, concluidaPorNome: null } });
  return { ok: true };
}

export async function marcarSubtarefa(id, i, feita, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x || !podeVer(x, u) || !(x.responsavelId === u.id || podeEditar(x, u))) return { error: "Sem permissão." };
  const l = [...(x.subtarefas || [])];
  if (!l[i]) return { error: "Subtarefa não encontrada." };
  l[i] = { ...l[i], feita: !!feita };
  await prisma.tarefa.update({ where: { id: x.id }, data: { subtarefas: l } });
  return { ok: true };
}

// ---------- arquivos ----------
export async function anexar(id, a, u) {
  const x = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!x || !podeVer(x, u) || !(x.responsavelId === u.id || podeEditar(x, u))) return { error: "Sem permissão." };
  const tam = Buffer.byteLength(String(a.conteudo || ""), "base64");
  if (!tam) return { error: "Arquivo vazio." };
  if (tam > 15 * 1048576) return { error: "Arquivo acima de 15 MB." };
  const f = await prisma.tarefaArquivo.create({ data: { tarefaId: x.id, nome: String(a.nome || "arquivo").slice(0, 200), mime: a.mime || null, tamanho: tam, conteudo: String(a.conteudo), criadoPorNome: nome(u) } });
  return { ok: true, arquivo: { id: f.id, nome: f.nome, tamanho: f.tamanho } };
}

// ---------- status das pessoas ----------
function agoraSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dow, hm: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`, data: `${p.year}-${p.month}-${p.day}` };
}
export const noExpediente = (a = agoraSP()) => EXPEDIENTE.dias.includes(a.dow) && a.hm >= EXPEDIENTE.ini && a.hm < EXPEDIENTE.fim;

// liga usuário ↔ funcionário da Matriz (para as férias): campo pessoaId ou nome
function casarPessoa(u, pessoas) {
  if (u.pessoaId) return pessoas.find((p) => p.id === u.pessoaId) || null;
  const nu = semAcento(nome(u)).split(" ");
  const c = pessoas.filter((p) => {
    const t = semAcento(p.nomeCompleto || p.nome).split(" ").filter((w) => w.length > 2);
    const tn = semAcento(p.nome).split(" ").filter((w) => w.length > 2);
    return (tn.length && tn.every((w) => nu.includes(w))) || (t.length >= 2 && nu.filter((w) => w.length > 2).every((w) => t.includes(w)));
  });
  return c.length === 1 ? c[0] : null;
}

export async function statusEquipe(u) {
  const a = agoraSP();
  const [users, sessoes, m, ferias] = await Promise.all([
    prisma.usuario.findMany({ where: { ativo: true }, select: SEL_U, orderBy: { nome: "asc" } }),
    prisma.tarefaSessao.findMany({ where: { fim: null }, include: { tarefa: { select: { id: true, titulo: true, publica: true, responsavelId: true, setor: true } } } }),
    prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } }),
    prisma.rhFerias.findMany({ where: { status: { not: "CANCELADA" }, inicio: { lte: dUTC(a.data) }, fim: { gte: dUTC(a.data) } } }).catch(() => []),
  ]);
  const fichas = await prisma.rhFuncionario.findMany({ select: { pessoaId: true, nomeCompleto: true } }).catch(() => []);
  const F = Object.fromEntries(fichas.map((f) => [f.pessoaId, f.nomeCompleto]));
  const pessoas = (m?.dados?.pessoal || []).map((p) => ({ ...p, nomeCompleto: F[p.id] || null }));
  const deFerias = new Set(ferias.map((f) => f.pessoaId));
  const exp = noExpediente(a);
  return users.map((x) => {
    const s = sessoes.find((s) => s.usuarioId === x.id);
    const p = casarPessoa(x, pessoas);
    let status = "DISPONIVEL", detalhe = null;
    if (p && deFerias.has(p.id)) { status = "INATIVO"; detalhe = "de férias"; }
    else if (s) {
      status = "OCUPADO";
      const vis = s.tarefa.publica || s.tarefa.responsavelId === u.id;
      detalhe = { tarefaId: vis ? s.tarefa.id : null, titulo: vis ? s.tarefa.titulo : "demanda privada", setor: s.tarefa.setor, desde: s.inicio };
    } else if (x.statusManual === "REUNIAO") { status = "REUNIAO"; detalhe = { desde: x.statusDesde }; }
    else if (!exp) { status = "INATIVO"; detalhe = "fora do expediente"; }
    return { id: x.id, nome: nome(x), setor: x.setor, setorTarefa: setorTarefaDe(x), foto: x.fotoBase64 || null, status, detalhe, pessoaId: p?.id || null };
  });
}

export async function mudarStatus(u, status) {
  if (status === "REUNIAO") {
    await fecharSessoes({ usuarioId: u.id });   // pausa a demanda em andamento
    await prisma.usuario.update({ where: { id: u.id }, data: { statusManual: "REUNIAO", statusDesde: new Date() } });
  } else await prisma.usuario.update({ where: { id: u.id }, data: { statusManual: null, statusDesde: new Date() } });
  return { ok: true };
}

export async function usuariosParaTarefa() {
  const l = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true, setor: true, isMaster: true, diretoria: true }, orderBy: { nome: "asc" } });
  return l.map((x) => ({ id: x.id, nome: nome(x), setor: x.setor, setorTarefa: setorTarefaDe(x) }));
}

export { SETORES_TAREFA, NOME_SETOR_TAREFA };
