// v655 — decisões na agenda e reunião de gestão
//   DECISÃO: tarefa simples com a situação (descrição), os envolvidos e as opções. Cada envolvido marca uma opção.
//     Quando todos marcaram: unanimidade → resultado para quem criou decidir; sem unanimidade → vira pauta da próxima reunião de gestão.
//   REUNIÃO DE GESTÃO: evento mensal às 14h com Igor, Pedro e Maycon (respondem como qualquer evento).
//     Data: 1ª quinta-feira do mês; se o mês começa numa quarta ou quinta, a quinta seguinte.
//     Gerada no início de cada mês (só a do mês). Pautas fixas + decisões não unânimes + pautas que qualquer convidado acrescentar.
import { prisma } from "@/lib/prisma";

const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const avisar = (deId, paraId, texto) => (paraId && deId !== paraId ? prisma.mensagem.create({ data: { deId, paraId, texto: String(texto).slice(0, 2000) } }).catch(() => null) : null);

export const PAUTAS_FIXAS = ["Demonstração de resultados financeiros", "Demonstração de resultados operacionais", "Demonstração de resultados comerciais", "RH"];
export const HORA_REUNIAO = "14:00";

// 1ª quinta-feira; mês que começa na quarta ou na quinta → a quinta seguinte
export function dataReuniao(ano, mes) {
  const d1 = new Date(Date.UTC(ano, mes - 1, 1));
  const dow = d1.getUTCDay();   // 0 dom … 4 qui
  const primeiraQui = 1 + ((4 - dow + 7) % 7);
  const dia = dow === 3 || dow === 4 ? primeiraQui + 7 : primeiraQui;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
const chaveMes = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}`;
const tituloReuniao = (ano, mes) => `REUNIÃO DE GESTÃO · ${String(mes).padStart(2, "0")}/${ano}`;

async function participantes() {
  const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true, login: true }, orderBy: { id: "asc" } });
  const ach = (n, login) => us.find((u) => login && u.login === login) || us.find((u) => sem(u.nome).split(" ")[0] === n);
  return { igor: ach("IGOR", "igor"), pedro: ach("PEDRO"), maycon: ach("MAYCON") || ach("MAICON") };
}

export async function reuniaoDoMes(ano, mes) {
  return prisma.tarefa.findFirst({ where: { titulo: tituloReuniao(ano, mes), modelo: false, status: { not: "CANCELADA" } } });
}

// v684 — reunião de gestão fica sempre no projeto MERIDIAN LTDA
async function projetoMeridian() {
  const l = await prisma.tarefaProjeto.findMany({ where: { ativo: true }, select: { id: true, nome: true } }).catch(() => []);
  return (l.find((p) => sem(p.nome) === "MERIDIAN LTDA") || l.find((p) => sem(p.nome).startsWith("MERIDIAN")))?.id || null;
}
export async function garantirReuniao(ano, mes) {
  const ja = await reuniaoDoMes(ano, mes);
  const projetoId = await projetoMeridian();
  if (ja) { if (projetoId && ja.projetoId !== projetoId) return prisma.tarefa.update({ where: { id: ja.id }, data: { projetoId } }); return ja; }
  const { igor, pedro, maycon } = await participantes();
  if (!igor) return null;
  const t = await prisma.tarefa.create({ data: {
    titulo: tituloReuniao(ano, mes), descricao: "Reunião mensal de gestão. As pautas ficam aqui na tarefa; qualquer convidado pode acrescentar.",
    setor: "GESTAO", responsavelId: igor.id, responsavelNome: nomeU(igor), criadoPorId: igor.id, criadoPorNome: nomeU(igor),
    prazo: dUTC(dataReuniao(ano, mes)), hora: HORA_REUNIAO, tipo: "PADRAO", publica: true, natureza: "FUNCIONAL", evento: true, lembreteMin: 60, projetoId,
    reuniao: { tipo: "GESTAO", mes: chaveMes(ano, mes), pautas: PAUTAS_FIXAS.map((texto) => ({ id: uid(), texto, origem: "FIXA" })) },
  } });
  const conv = [pedro, maycon].filter(Boolean).map((u) => u.id);
  if (conv.length) await (await import("@/lib/tarefas")).sincronizarConvites(t, conv, igor);
  return t;
}

let ultimo = 0;
// início de cada mês: só a reunião do mês corrente
export async function garantirReuniaoDoMes() {
  if (Date.now() - ultimo < 2 * 60e3) return;
  ultimo = Date.now();
  const h = hojeSP();
  await garantirReuniao(Number(h.slice(0, 4)), Number(h.slice(5, 7)));
}

// próxima reunião (a do mês, se ainda não passou; senão a do mês seguinte, criada na hora)
export async function proximaReuniao() {
  const h = hojeSP();
  let ano = Number(h.slice(0, 4)), mes = Number(h.slice(5, 7));
  if (dataReuniao(ano, mes) < h) { mes++; if (mes > 12) { mes = 1; ano++; } }
  return garantirReuniao(ano, mes);
}

// ---------- decisão ----------
// { opcoes, envolvidos } do formulário; mantém os votos de quem continua envolvido
export async function salvarDecisao(t, d, u) {
  if (!d) return;
  const atual = await prisma.tarefa.findUnique({ where: { id: t.id }, select: { decisao: true } });
  const velho = atual?.decisao || {};
  const opcoes = [...new Set((Array.isArray(d.opcoes) ? d.opcoes : []).map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 12);
  const envolvidos = [...new Set((Array.isArray(d.envolvidos) ? d.envolvidos : []).map(Number).filter(Boolean))];
  const votos = Object.fromEntries(Object.entries(velho.votos || {}).filter(([id, v]) => envolvidos.includes(Number(id)) && opcoes.includes(v.opcao)));
  await prisma.tarefa.update({ where: { id: t.id }, data: { decisao: { opcoes, envolvidos, votos, ...(velho.resultado ? { resultado: velho.resultado } : {}) } } });
  // envolvidos veem a decisão na agenda (convite já confirmado, sem pedir presença)
  const ja = await prisma.tarefaConvite.findMany({ where: { tarefaId: t.id } });
  const sair = ja.filter((c) => !envolvidos.includes(c.usuarioId)).map((c) => c.id);
  if (sair.length) await prisma.tarefaConvite.deleteMany({ where: { id: { in: sair } } });
  const novos = envolvidos.filter((id) => id !== t.responsavelId && !ja.some((c) => c.usuarioId === id));
  if (novos.length) {
    const us = await prisma.usuario.findMany({ where: { id: { in: novos }, ativo: true }, select: { id: true, nome: true, sobrenome: true } });
    for (const x of us) {
      await prisma.tarefaConvite.create({ data: { tarefaId: t.id, usuarioId: x.id, usuarioNome: nomeU(x), status: "CONFIRMADO", respondidoEm: new Date() } }).catch(() => null);
      await avisar(u.id, x.id, `🗳️ DECISÃO de ${nomeU(u)}: ${t.titulo} — marque sua opção na Agenda.`);
    }
  }
}

export async function votar(id, u, opcao) {
  const t = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  const d = t?.decisao;
  if (!d) return { error: "Não é uma decisão." };
  if (d.resultado) return { error: "Esta decisão já foi encerrada." };
  if (!(d.envolvidos || []).includes(u.id)) return { error: "Você não está entre os envolvidos." };
  if (!(d.opcoes || []).includes(opcao)) return { error: "Opção inválida." };
  const votos = { ...(d.votos || {}), [u.id]: { opcao, nome: nomeU(u), em: new Date().toISOString() } };
  let nova = { ...d, votos };
  const todos = (d.envolvidos || []).every((x) => votos[x]);
  if (todos) {
    const escolhas = [...new Set(Object.values(votos).map((v) => v.opcao))];
    if (escolhas.length === 1) {
      nova.resultado = { tipo: "UNANIME", opcao: escolhas[0], em: new Date().toISOString() };
      await avisar(u.id, t.responsavelId, `🗳️ DECISÃO UNÂNIME: ${t.titulo} → "${escolhas[0]}". Tome a decisão.`);
      if (t.criadoPorId !== t.responsavelId) await avisar(u.id, t.criadoPorId, `🗳️ DECISÃO UNÂNIME: ${t.titulo} → "${escolhas[0]}".`);
    } else {
      const r = await proximaReuniao();
      if (r) {
        const resumo = (d.opcoes || []).map((o) => `${o}: ${Object.values(votos).filter((v) => v.opcao === o).map((v) => v.nome.split(" ")[0]).join(", ") || "—"}`).join(" · ");
        const R = r.reuniao || { tipo: "GESTAO", pautas: [] };
        await prisma.tarefa.update({ where: { id: r.id }, data: { reuniao: { ...R, pautas: [...(R.pautas || []), { id: uid(), texto: `Decisão #${t.id}: ${t.titulo} (${resumo})`, origem: "DECISAO", decisaoId: t.id, autor: "AUTOMÁTICO" }] } } });
        nova.resultado = { tipo: "PAUTA", reuniaoId: r.id, reuniaoData: iso(r.prazo), em: new Date().toISOString() };
      } else nova.resultado = { tipo: "PAUTA", em: new Date().toISOString() };
      await avisar(u.id, t.responsavelId, `🗳️ DECISÃO SEM UNANIMIDADE: ${t.titulo} — foi para a pauta da próxima reunião de gestão${r ? ` (${iso(r.prazo).split("-").reverse().join("/")})` : ""}.`);
    }
  }
  await prisma.tarefa.update({ where: { id: t.id }, data: { decisao: nova } });
  return { ok: true, resultado: nova.resultado || null };
}

// ---------- pautas da reunião ----------
export async function adicionarPauta(id, u, texto) {
  const t = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!t?.reuniao) return { error: "Não é uma reunião de gestão." };
  const conv = await prisma.tarefaConvite.findFirst({ where: { tarefaId: t.id, usuarioId: u.id } });
  if (!(conv || t.responsavelId === u.id || u.isMaster || u.diretoria)) return { error: "Só os convidados acrescentam pautas." };
  const x = String(texto || "").trim().slice(0, 500);
  if (!x) return { error: "Escreva a pauta." };
  const R = t.reuniao;
  await prisma.tarefa.update({ where: { id: t.id }, data: { reuniao: { ...R, pautas: [...(R.pautas || []), { id: uid(), texto: x, origem: "MANUAL", autor: nomeU(u) }] } } });
  return { ok: true };
}
export async function tirarPauta(id, u, pautaId) {
  const t = await prisma.tarefa.findUnique({ where: { id: Number(id) || 0 } });
  if (!t?.reuniao) return { error: "Não é uma reunião de gestão." };
  const R = t.reuniao;
  const p = (R.pautas || []).find((x) => x.id === pautaId);
  if (!p) return { ok: true };
  if (p.origem === "FIXA") return { error: "Pauta fixa não sai." };
  if (!(p.autor === nomeU(u) || t.responsavelId === u.id || u.isMaster)) return { error: "Só quem incluiu ou o responsável tiram a pauta." };
  await prisma.tarefa.update({ where: { id: t.id }, data: { reuniao: { ...R, pautas: R.pautas.filter((x) => x.id !== pautaId) } } });
  return { ok: true };
}
