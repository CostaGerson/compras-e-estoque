// v158 — ADM › Demandas: o financeiro cria tarefas administrativas; a auxiliar administrativa cumpre e dá o retorno.
import { prisma } from "@/lib/prisma";
import { nomeU, dataUTC } from "@/lib/finTitulos";

export const STATUS = ["A_FAZER", "FAZENDO", "CONCLUIDA"];
const up = (s) => String(s ?? "").toUpperCase().trim();
export const ehGestor = (u) => !!u && (u.isMaster || !!u.diretoria);   // v167 — diretoria também

export async function usuarioAdm(id) {
  const uid = Number(id);
  if (!uid) return null;
  const u = await prisma.usuario.findUnique({ where: { id: uid }, select: { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true, diretoria: true } });
  if (!u || !u.ativo) return null;
  return ehGestor(u) || u.setor === "ADMINISTRATIVO" ? u : null;
}
export const negadoAdm = () => Response.json({ error: "Acesso restrito ao financeiro e ao administrativo." }, { status: 403 });

async function avisar(paraIds, texto, deId) {
  const para = [...new Set(paraIds.filter((x) => x && x !== deId))];
  if (!para.length) return 0;
  await prisma.mensagem.createMany({ data: para.map((paraId) => ({ deId: deId || para[0], paraId, texto: String(texto).slice(0, 2000) })) });
  return para.length;
}
const equipeAdm = async () => (await prisma.usuario.findMany({ where: { ativo: true, setor: "ADMINISTRATIVO" }, select: { id: true } })).map((x) => x.id);
const gestores = async () => (await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { diretoria: true }] }, select: { id: true } })).map((x) => x.id);
const dBR = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "SEM PRAZO");

export const demandaOut = (d) => {
  const { anexo, ...cot } = d.cotacao || {};   // v425 — o arquivo da cotação sai por download
  return { ...d, prazo: d.prazo ? new Date(d.prazo).toISOString().slice(0, 10) : null, cotacao: d.cotacao ? { ...cot, temAnexo: !!anexo } : null };
};

export async function listar(u) {
  // v450 — tarefas automáticas do faturamento/entrega (FATURAR, PROGRAMAR ENTREGA…) ficam em dia ao abrir as demandas
  try { const { fluxoFaturamento } = await import("@/lib/faturamentoFluxo"); await fluxoFaturamento(); } catch (e) { console.log("adm/fluxo:", e.message); }
  import("@/lib/cronograma").then(({ sincronizar }) => sincronizar()).catch(() => null);
  const where = ehGestor(u) ? {} : { OR: [{ responsavelId: null }, { responsavelId: u.id }] };
  const l = await prisma.admDemanda.findMany({ where, orderBy: [{ status: "asc" }, { prazo: "asc" }, { id: "desc" }] });
  const equipe = await prisma.usuario.findMany({ where: { ativo: true, setor: "ADMINISTRATIVO" }, select: { id: true, nome: true, sobrenome: true }, orderBy: { nome: "asc" } });
  return { demandas: l.map(demandaOut), equipe: equipe.map((x) => ({ id: x.id, nome: nomeU(x) })) };
}

function dadosDe(b) {
  const titulo = up(b.titulo);
  if (!titulo) return { erro: "Informe o que precisa ser feito." };
  if (b.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.prazo))) return { erro: "Prazo inválido." };
  return {
    dados: {
      titulo: titulo.slice(0, 200), descricao: b.descricao ? String(b.descricao).trim().slice(0, 4000) : null,
      prazo: b.prazo ? dataUTC(b.prazo) : null, prioridade: b.prioridade === "URGENTE" ? "URGENTE" : "NORMAL",
    },
  };
}

export async function criar(b, u) {
  if (!ehGestor(u)) return { error: "Só o financeiro cria demandas." };
  const { erro, dados } = dadosDe(b);
  if (erro) return { error: erro };
  let resp = null;
  if (b.responsavelId) resp = await prisma.usuario.findUnique({ where: { id: Number(b.responsavelId) }, select: { id: true, nome: true, sobrenome: true } });
  const d = await prisma.admDemanda.create({ data: { ...dados, responsavelId: resp?.id || null, responsavelNome: resp ? nomeU(resp) : null, criadoPorId: u.id, criadoPorNome: nomeU(u) } });
  await avisar(resp ? [resp.id] : await equipeAdm(),
    `NOVA DEMANDA ADM${d.prioridade === "URGENTE" ? " (URGENTE)" : ""}: ${d.titulo} · PRAZO ${dBR(d.prazo)}${d.descricao ? ` · ${d.descricao}` : ""} — VER EM ADM › DEMANDAS ADM.`, u.id).catch(() => 0);
  return { ok: true, demanda: demandaOut(d) };
}

// gestor altera tudo; o administrativo só muda o andamento (e conclui com o retorno)
export async function atualizar(id, b, u) {
  const d = await prisma.admDemanda.findUnique({ where: { id: Number(id) } });
  if (!d) return { error: "Demanda não encontrada." };
  if (!ehGestor(u) && d.responsavelId && d.responsavelId !== u.id) return { error: "Demanda de outra pessoa." };
  const data = {};
  if (ehGestor(u) && b.titulo !== undefined) {
    const { erro, dados } = dadosDe({ ...d, prazo: d.prazo ? new Date(d.prazo).toISOString().slice(0, 10) : null, ...b });
    if (erro) return { error: erro };
    Object.assign(data, dados);
    if (b.responsavelId !== undefined) {
      const resp = b.responsavelId ? await prisma.usuario.findUnique({ where: { id: Number(b.responsavelId) }, select: { id: true, nome: true, sobrenome: true } }) : null;
      data.responsavelId = resp?.id || null; data.responsavelNome = resp ? nomeU(resp) : null;
    }
  }
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return { error: "Andamento inválido." };
    if (b.status === "CONCLUIDA" && d.tipo === "COTACAO_FRETE") {
      // v425 — cotação de frete: anexo + valor + prazo de entrega + transportadoras cotadas
      const c = b.cotacao || {};
      const valor = Number(String(c.valor ?? "").replace(/\./g, "").replace(",", ".")) || 0;
      if (!c.anexo && !d.cotacao?.anexo) return { error: "Anexe o documento da cotação." };
      if (!(valor > 0)) return { error: "Informe o valor do frete." };
      if (!String(c.prazo || "").trim()) return { error: "Informe o prazo de entrega." };
      if (!String(c.transportadoras || "").trim()) return { error: "Informe as transportadoras cotadas." };
      const cot = { valor, prazo: String(c.prazo).trim().slice(0, 100), transportadoras: String(c.transportadoras).trim().slice(0, 500),
        anexoNome: c.anexo ? String(c.anexoNome || "cotacao").slice(0, 150) : d.cotacao?.anexoNome, anexoMime: c.anexo ? String(c.anexoMime || "application/pdf") : d.cotacao?.anexoMime, anexo: c.anexo || d.cotacao?.anexo };
      const ret = String(b.retorno || "").trim() || `COTAÇÃO: R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · PRAZO ${cot.prazo} · ${cot.transportadoras}`;
      Object.assign(data, { status: "CONCLUIDA", retorno: ret.slice(0, 4000), cotacao: cot, concluidaEm: new Date(), concluidaPorNome: nomeU(u) });
    } else if (b.status === "CONCLUIDA") {
      const ret = String(b.retorno ?? d.retorno ?? "").trim();
      if (!ret) return { error: "Escreva o retorno: o que foi feito." };
      Object.assign(data, { status: "CONCLUIDA", retorno: ret.slice(0, 4000), concluidaEm: new Date(), concluidaPorNome: nomeU(u) });
    } else Object.assign(data, { status: b.status, concluidaEm: null, concluidaPorNome: null });
  }
  const n = await prisma.admDemanda.update({ where: { id: d.id }, data });
  if (data.status === "CONCLUIDA" && d.status !== "CONCLUIDA")
    await avisar(d.criadoPorId ? [d.criadoPorId] : await gestores(), `DEMANDA ADM CONCLUÍDA: ${n.titulo} — POR ${nomeU(u)} · RETORNO: ${n.retorno}`, u.id).catch(() => 0);
  return { ok: true, demanda: demandaOut(n) };
}

export async function excluir(id, u) {
  if (!ehGestor(u)) return { error: "Só o financeiro exclui demandas." };
  await prisma.admDemanda.delete({ where: { id: Number(id) } }).catch(() => null);
  return { ok: true };
}
