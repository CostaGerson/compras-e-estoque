// v1122 — pedido com desconto: justificativa obrigatória e aprovação do financeiro antes de seguir para a produção.
//   Gerar pedido → status AGUARDANDO_APROVACAO + tarefa para o financeiro. Aprovar → efetiva (layout, compras…). Reprovar → volta a RASCUNHO com a crítica.
import { prisma } from "@/lib/prisma";
import { valorDesconto } from "@/lib/pedidoLanc";

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const dUTC = (s) => new Date(`${s}T12:00:00Z`);
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

const totItem = (it) => {
  const q = Array.isArray(it.grade) ? it.grade.reduce((s, g) => s + num(g.qtd), 0) : num(it.quantidade);
  return r2(q * num(it.valorUnitario));
};
export function resumoDesconto(pp) {
  const itens = pp.itens || [];
  const descItens = itens.filter((it) => it.desconto && num(it.desconto.valor) > 0).map((it) => {
    const q = Array.isArray(it.grade) ? it.grade.reduce((s, g) => s + num(g.qtd), 0) : num(it.quantidade);
    const base = num(it.desconto.base), unit = num(it.valorUnitario);
    return { descricao: it.descricao || it.codigo || "item", tipo: it.desconto.tipo, valor: num(it.desconto.valor), de: base, por: unit, total: r2(Math.max(0, base - unit) * q) };
  });
  const valorItens = r2(itens.reduce((s, it) => s + totItem(it), 0));
  const descPedido = valorDesconto(pp.desconto, valorItens);
  const descTotal = r2(descPedido + descItens.reduce((s, x) => s + x.total, 0));
  return { tem: descPedido > 0 || descItens.length > 0, descPedido, descPedidoCfg: pp.desconto, descItens, descTotal, valorItens, total: r2(valorItens - descPedido) };
}
const assinatura = (pp, R) => JSON.stringify([R.descPedido, R.descItens.map((x) => [x.descricao, x.de, x.por]), R.total]);

// chamado antes de efetivar: null = pode seguir · objeto = resposta para a tela
export async function portaoDesconto(ppId, u, criticas) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp || pp.efetivadoEm || pp.interno || String(pp.extRef || "").startsWith("NORT|LOJA")) return null;
  const R = resumoDesconto(pp);
  if (!R.tem) return null;
  const sig = assinatura(pp, R), A = pp.descontoAprov || {};
  if (A.status === "APROVADO" && A.sig === sig) return null;
  if (!String(pp.descontoObs || "").trim()) return { ok: false, erros: ["Pedido com desconto: preencha a observação do desconto (obrigatória) no card de desconto."], avisos: [] };
  const { erros, avisos } = criticas(pp);
  if (erros.length) return { ok: false, erros, avisos };
  if (A.status === "PENDENTE" && A.sig === sig && pp.status === "AGUARDANDO_APROVACAO") return { ok: false, aguardandoAprovacao: true, numero: pp.numero };
  // aprovador: o financeiro master (Igor)
  const fin = await prisma.usuario.findFirst({ where: { ativo: true, nome: { startsWith: "IGOR", mode: "insensitive" } }, orderBy: { id: "asc" } })
    || await prisma.usuario.findFirst({ where: { ativo: true, setor: "FINANCEIRO" }, orderBy: { id: "asc" } });
  if (!fin) return { ok: false, erros: ["Não encontrei o usuário do financeiro para aprovar o desconto."], avisos: [] };
  if (A.tarefaId) await prisma.tarefa.updateMany({ where: { id: A.tarefaId, status: { in: ["ABERTA", "EM_ANDAMENTO"] } }, data: { status: "CANCELADA" } }).catch(() => null);
  const brl = (v) => `R$ ${r2(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const t = await prisma.tarefa.create({ data: {
    titulo: `APROVAR DESCONTO · PEDIDO ${pp.numero || ""} · ${pp.clienteNome || ""}`.slice(0, 200),
    descricao: `Vendedor: ${pp.vendedor || "—"} · pedido por ${nomeU(u)}\nItens ${brl(R.valorItens)} · desconto ${brl(R.descTotal)} · total ${brl(R.total)}\nJustificativa: ${pp.descontoObs}\n\nAprovar: o pedido segue para layout, compras e produção. Reprovar: volta para rascunho com o motivo.`,
    setor: "FINANCEIRO", responsavelId: fin.id, responsavelNome: nomeU(fin), criadoPorId: u.id, criadoPorNome: nomeU(u),
    prazo: dUTC(hojeISO()), tipo: "URGENTE", publica: false, natureza: "FUNCIONAL", lembreteMin: null,
    descontoPp: { ppId: pp.id, numero: pp.numero },
  } }).catch(async () => prisma.tarefa.create({ data: {
    titulo: `APROVAR DESCONTO · PEDIDO ${pp.numero || ""} · ${pp.clienteNome || ""}`.slice(0, 200), descricao: `Justificativa: ${pp.descontoObs}`,
    setor: "FINANCEIRO", responsavelId: fin.id, responsavelNome: nomeU(fin), criadoPorId: u.id, criadoPorNome: nomeU(u),
    prazo: dUTC(hojeISO()), tipo: "PADRAO", publica: false, natureza: "FUNCIONAL", lembreteMin: null, descontoPp: { ppId: pp.id, numero: pp.numero } } }));
  await prisma.pp.update({ where: { id: pp.id }, data: { status: "AGUARDANDO_APROVACAO",
    descontoAprov: { status: "PENDENTE", sig, tarefaId: t.id, solicitadoPor: nomeU(u), em: new Date().toISOString() } } });
  return { ok: false, aguardandoAprovacao: true, numero: pp.numero, tarefaId: t.id };
}

// decisão do financeiro
export async function decidirDesconto(ppId, u, aprovar, motivo) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp) return { error: "Pedido não encontrado." };
  const A = pp.descontoAprov || {};
  if (A.status !== "PENDENTE") return { error: A.status === "APROVADO" ? "Esse desconto já foi aprovado." : A.status === "REPROVADO" ? "Esse desconto já foi reprovado." : "Não há desconto aguardando aprovação neste pedido." };
  if (!aprovar && String(motivo || "").trim().length < 3) return { error: "Escreva o motivo da reprovação." };
  const R = resumoDesconto(pp), agora = new Date().toISOString();
  const fecharTarefa = (ret) => A.tarefaId ? prisma.tarefa.updateMany({ where: { id: A.tarefaId }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: ret } }).catch(() => null) : null;
  if (!aprovar) {
    await prisma.pp.update({ where: { id: pp.id }, data: { status: "RASCUNHO", descontoAprov: { ...A, status: "REPROVADO", por: nomeU(u), decididoEm: agora, motivo: String(motivo).trim().slice(0, 1000) } } });
    await fecharTarefa(`REPROVADO: ${String(motivo).trim()}`);
    return { ok: true, reprovado: true };
  }
  await prisma.pp.update({ where: { id: pp.id }, data: { status: "RASCUNHO", descontoAprov: { ...A, status: "APROVADO", sig: assinatura(pp, R), por: nomeU(u), decididoEm: agora } } });
  await fecharTarefa("APROVADO");
  const { efetivarPedido } = await import("@/lib/pedidoEfetivar");
  const r = await efetivarPedido(pp.id, nomeU(u));
  if (r?.ok) { try { const { gerarCriacaoLayout } = await import("@/lib/layoutFluxo"); r.tarefaLayout = await gerarCriacaoLayout(pp.id, u); } catch (e) { console.log("desconto/layout:", e.message); } }
  return { ok: true, aprovado: true, efetivacao: r };
}
