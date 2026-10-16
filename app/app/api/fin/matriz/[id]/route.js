export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";

const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const MAX_VERSOES = 60;

export async function GET(req, { params }) {
  if (!(await usuarioGerencial(new URL(req.url).searchParams.get("u")))) return negadoGerencial();
  const m = await prisma.finMatriz.findUnique({ where: { id: Number(params.id) } });
  if (!m) return Response.json({ error: "Matriz não encontrada." }, { status: 404 });
  // v173 — crítica: freelancer do mês passado acima do % previsto na Matriz
  let critica = null;
  if (m.oficial) {
    try {
      const { freelancerXFolha } = await import("@/lib/rhPainel");
      const { mesAtual, somaMes } = await import("@/lib/finTitulos");
      critica = (await freelancerXFolha(somaMes(mesAtual(), -1))).critica;
    } catch { critica = null; }
  }
  // v212 — a oficial puxa as metas do botão METAS da Gestão (mês da análise)
  // v249 — a oficial é o HISTÓRICO do ano (realizado + previsão pela média); metas só nas simulações
  if (m.oficial) { const { dadosHistoricos } = await import("@/lib/matrizMetas"); m.dados = await dadosHistoricos(m.dados); }
  // v270 — oficial e simulações: contribuição bruta por peça e % freelancer da realidade atual (Análises operacionais)
  { const { comOperacaoReal } = await import("@/lib/matrizReal"); m.dados = await comOperacaoReal(m.dados); }
  return Response.json({ ...m, critica });
}

// PUT { usuarioId, dados, resumo, versaoBase } → grava (guarda a versão anterior)
export async function PUT(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioGerencial(b.usuarioId);
  if (!u) return negadoGerencial();
  const id = Number(params.id);
  const atual = await prisma.finMatriz.findUnique({ where: { id } });
  if (!atual) return Response.json({ error: "Matriz não encontrada." }, { status: 404 });
  if (b.versaoBase && new Date(atual.updatedAt).getTime() !== new Date(b.versaoBase).getTime())
    return Response.json({ error: `Esta matriz foi alterada por ${atual.atualizadoPor || "outra pessoa"} enquanto você editava. Recarregue antes de salvar.` }, { status: 409 });
  if (!b.dados || !Array.isArray(b.dados.pessoal)) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  await prisma.finMatrizVersao.create({ data: { matrizId: id, dados: atual.dados, usuarioNome: atual.atualizadoPor, resumo: "antes de: " + String(b.resumo || "alteração").slice(0, 300) } });
  const velhas = await prisma.finMatrizVersao.findMany({ where: { matrizId: id }, orderBy: { createdAt: "desc" }, skip: MAX_VERSOES, select: { id: true } });
  if (velhas.length) await prisma.finMatrizVersao.deleteMany({ where: { id: { in: velhas.map((v) => v.id) } } });
  if (atual.oficial) { const { dadosHistoricos } = await import("@/lib/matrizMetas"); b.dados = await dadosHistoricos(b.dados); }   // v249
  const m = await prisma.finMatriz.update({ where: { id }, data: { dados: b.dados, atualizadoPor: nomeU(u) } });
  // v192 — a oficial é a base das recorrências: o contas a pagar espelha na hora
  let contas = null;
  if (atual.oficial) { const { sincronizarMatriz } = await import("@/lib/finMatrizRecDb"); contas = await sincronizarMatriz(nomeU(u)).catch((e) => ({ erro: e.message })); }
  return Response.json({ ok: true, updatedAt: m.updatedAt, atualizadoPor: m.atualizadoPor, contas });
}

// v270 — POST { usuarioId, acao: "capacidade", cenario: "ATUAL" | "A" | "B" } → refaz a simulação a partir da oficial
//   com a meta, o ticket, a margem e as peças mês a mês DESTA simulação, ajustada à capacidade real:
//   ATUAL = equipe e % freelancer de hoje · A = a necessidade extra vira freelancer · B = acima de 1 freelancer/dia vira contratação
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioGerencial(b.usuarioId);
  if (!u) return negadoGerencial();
  if (b.acao === "freelancers") return ajustarFreelancers(b, u, Number(params.id));
  if (b.acao !== "capacidade") return Response.json({ error: "Ação inválida." }, { status: 400 });
  if (!["ATUAL", "A", "B"].includes(b.cenario)) return Response.json({ error: "Escolha: equipe atual, A ou B." }, { status: 400 });
  const id = Number(params.id);
  const atual = await prisma.finMatriz.findUnique({ where: { id } });
  if (!atual) return Response.json({ error: "Matriz não encontrada." }, { status: 404 });
  if (atual.oficial) return Response.json({ error: "A oficial é o histórico real: ajuste a capacidade numa simulação." }, { status: 400 });
  try {
    const d = atual.dados || {}, pr = d.producao || {};
    const f = d.fechamento;
    const pecasMes = Array.isArray(f?.pcsMeses) && f.pcsMeses.length === 12 ? f.pcsMeses.map((x) => Number(x) || 0) : null;
    const fech = f?.fechados || [];
    const abertos = pecasMes ? pecasMes.filter((_, i) => !fech[i]) : [];
    const alvo = Math.round(abertos.length ? abertos.reduce((t, x) => t + x, 0) / abertos.length : Number(pr.metaPecas) || 0);
    if (!alvo) return Response.json({ error: "Informe a meta de peças da simulação antes de ajustar à capacidade." }, { status: 400 });
    const { analisarCapacidade } = await import("@/lib/gestaoCapacidade");
    const { montarSimulacao } = await import("@/lib/capacidadeSimulacao");
    const ano = Number(f?.ano || d.simulacaoCapacidade?.ano) || new Date().getFullYear();
    const analise = await analisarCapacidade({ meses: 3, alvo, ano });
    const r = await montarSimulacao({ analise, cenario: b.cenario, ano, mes: d.simulacaoCapacidade?.mes || null, pecasMes,
      metas: { ticket: pr.ticketMedio, margem: pr.margemContribuicao } });
    if (!pecasMes) r.dados.producao.metaPecas = Number(pr.metaPecas) || alvo;
    await prisma.finMatrizVersao.create({ data: { matrizId: id, dados: atual.dados, usuarioNome: atual.atualizadoPor, resumo: `antes de: ajustar à capacidade (${b.cenario})` } });
    await prisma.finMatriz.update({ where: { id }, data: { dados: r.dados, atualizadoPor: nomeU(u) } });
    return Response.json({ ok: true, cenario: b.cenario, pct: r.pct, contratados: r.criados.length, alvo });
  } catch (e) { return Response.json({ error: e.message || "Erro ao ajustar." }, { status: 400 }); }
}

// v275 — POST { acao: "freelancers", ajustes: { SETOR: freelancersDia } } → grava os freelancers/dia escolhidos
//   e o % freelancer recalculado (razão interna manual = 1 − %) na simulação
async function ajustarFreelancers(b, u, id) {
  const atual = await prisma.finMatriz.findUnique({ where: { id } });
  if (!atual) return Response.json({ error: "Matriz não encontrada." }, { status: 404 });
  if (atual.oficial) return Response.json({ error: "A oficial é o histórico real: ajuste numa simulação." }, { status: 400 });
  try {
    const d = JSON.parse(JSON.stringify(atual.dados || {})), pr = d.producao || (d.producao = {});
    const f = d.fechamento;
    const pecasMes = Array.isArray(f?.pcsMeses) && f.pcsMeses.length === 12 ? f.pcsMeses.map((x) => Number(x) || 0) : [];
    const fech = f?.fechados || [];
    const abertos = pecasMes.filter((_, i) => !fech[i]);
    const alvo = Math.round(abertos.length ? abertos.reduce((t, x) => t + x, 0) / abertos.length : Number(pr.metaPecas) || 0);
    if (!alvo) return Response.json({ error: "A simulação não tem meta de peças." }, { status: 400 });
    const ano = Number(f?.ano || d.simulacaoCapacidade?.ano) || new Date().getFullYear();
    const { analisarCapacidade } = await import("@/lib/gestaoCapacidade");
    const { calcularAjuste } = await import("@/lib/capAjuste");
    const cap = await analisarCapacidade({ meses: 3, alvo, ano });
    const cen = d.simulacaoCapacidade?.cenario || "ATUAL";
    const ajustes = {};
    for (const [k, v] of Object.entries(b.ajustes || {})) ajustes[k] = Math.max(0, Math.round(Number(v) || 0));
    const r = calcularAjuste(cap, cen, ajustes);
    if (d.metasGestao) delete d.metasGestao.pctFreelancer;   // o % ajustado é o que vale nesta simulação
    pr.razaoInternaAuto = false;
    pr.razaoInternaManual = Math.round((1 - r.pct) * 10000) / 10000;
    d.simulacaoCapacidade = { ...(d.simulacaoCapacidade || { cenario: cen }), pctFreelancer: r.pct, freeDiaAjustado: ajustes,
      freelancerMes: r.freelancer, ajustadoEm: new Date().toISOString() };
    await prisma.finMatrizVersao.create({ data: { matrizId: id, dados: atual.dados, usuarioNome: atual.atualizadoPor, resumo: "antes de: ajustar freelancers/dia" } });
    await prisma.finMatriz.update({ where: { id }, data: { dados: d, atualizadoPor: nomeU(u) } });
    return Response.json({ ok: true, pct: r.pct, freelancer: r.freelancer });
  } catch (e) { return Response.json({ error: e.message || "Erro ao salvar." }, { status: 400 }); }
}

// PATCH { usuarioId, nome } → renomeia
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioGerencial(b.usuarioId))) return negadoGerencial();
  await prisma.finMatriz.update({ where: { id: Number(params.id) }, data: { nome: String(b.nome || "").toUpperCase() || "SEM NOME" } });
  return Response.json({ ok: true });
}

// DELETE { usuarioId } → apaga cenário (a oficial não pode)
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioGerencial(b.usuarioId))) return negadoGerencial();
  const m = await prisma.finMatriz.findUnique({ where: { id: Number(params.id) } });
  if (!m) return Response.json({ ok: true });
  if (m.oficial) return Response.json({ error: "A matriz oficial não pode ser apagada." }, { status: 400 });
  await prisma.finMatriz.delete({ where: { id: m.id } });
  return Response.json({ ok: true });
}
