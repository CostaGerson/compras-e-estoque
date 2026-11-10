// v752 — Cronograma PCP: cada solicitação de desenvolvimento de arte (um item ou vários
// pedidos com a mesma arte) abre uma demanda na agenda do Maycon, no modelo que ele definiu:
// Funcional · projeto Meridian LTDA · setor Gestão · colaborador Maycon · data limite hoje ·
// manhã · padrão · privada. Mesma solicitação (chave = grupoId do PCP) não duplica.
import { prisma } from "@/lib/prisma";

const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const txt = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const nome = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);

async function maycon() {
  const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true, diretoria: true } });
  const ms = us.filter((u) => sem(u.nome).split(" ")[0] === "MAYCON");
  return ms.find((u) => u.diretoria) || ms[0] || null;
}
async function projetoMeridian() {
  const ps = await prisma.tarefaProjeto.findMany({ where: { ativo: true }, select: { id: true, nome: true, natureza: true } });
  const alvo = ps.filter((p) => p.natureza !== "PESSOAL");
  return alvo.find((p) => sem(p.nome) === "MERIDIAN LTDA") || alvo.find((p) => sem(p.nome).startsWith("MERIDIAN")) || null;
}

export function montarDemandaArte(b) {
  const itens = (Array.isArray(b?.itens) ? b.itens : []).map((i) => ({
    pedido: txt(i.pedido), cliente: txt(i.cliente), produto: txt(i.produto), qtd: Number(i.qtd) || 0,
    detalhes: (Array.isArray(i.detalhes) ? i.detalhes : []).map(txt).filter(Boolean),
  })).filter((i) => i.pedido || i.produto);
  const pedidos = [...new Set(itens.map((i) => i.pedido).filter(Boolean))];
  const clientes = [...new Set(itens.map((i) => i.cliente).filter(Boolean))];
  const titulo = `DESENVOLVIMENTO DE ARTE - PEDIDO (${[pedidos.join(", "), clientes.join(" / ")].filter(Boolean).join(" - ")})`.slice(0, 200);
  const dets = [...new Set(itens.flatMap((i) => i.detalhes))];
  const partes = [];
  if (dets.length) partes.push(dets.join("\n"));
  if (itens.length > 1) partes.push(`Mesma arte para ${itens.length} itens:\n` + itens.map((i) => `• ${[i.pedido, i.produto].filter(Boolean).join(" · ")}${i.qtd ? ` · ${i.qtd} pç` : ""}`).join("\n"));
  if (txt(b?.responsavel)) partes.push(`Responsável pela arte: ${txt(b.responsavel)}`);
  return { itens, titulo, descricao: partes.join("\n\n").slice(0, 8000) || null };
}

export async function criarDemandaArte(b) {
  const chave = txt(b?.chave).slice(0, 80);
  if (!chave) return { ok: false, error: "Falta a chave da solicitação." };
  const ja = await prisma.tarefa.findUnique({ where: { pcpChave: chave } });
  if (ja) return { ok: true, id: ja.id, jaExistia: true };
  const d = montarDemandaArte(b);
  if (!d.itens.length) return { ok: false, error: "Nenhum item na solicitação." };
  const m = await maycon();
  if (!m) return { ok: false, error: "Não achei o usuário Maycon ativo no ERP." };
  const proj = await projetoMeridian();
  const t = await prisma.tarefa.create({ data: {
    titulo: d.titulo, descricao: d.descricao, setor: "GESTAO",
    responsavelId: m.id, responsavelNome: nome(m), criadoPorId: m.id, criadoPorNome: nome(m),
    prazo: dUTC(hojeSP()), periodo: "MANHA", tipo: "PADRAO", publica: false, natureza: "FUNCIONAL",
    projetoId: proj ? proj.id : null, pcpChave: chave,
  } });
  return { ok: true, id: t.id, jaExistia: false };
}
