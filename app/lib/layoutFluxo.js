// v654 — demanda de layout
//   Todo item do pedido deve ter layout (o antigo campo "foto" do item). Pedido efetivado com item sem layout segue normal,
//   mas gera para o ARTE FINALISTA a tarefa "CRIAÇÃO DE LAYOUT" (prazo no mesmo dia). Na tarefa ele vê a OP dos itens,
//   anexa o layout de cada um e envia para aprovação → tarefa "APROVAÇÃO DE LAYOUT" para o vendedor do pedido.
//   Aprovado: o layout vai para o cadastro do item no pedido. Reprovado: volta uma nova criação para o arte finalista com o motivo.
import { prisma } from "@/lib/prisma";

const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
const safe = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };
// v736 — vários arquivos por item (qualquer formato): arquivoIds; arquivoId = o principal (1ª imagem, senão o 1º)
export const idsDe = (x) => (Array.isArray(x?.arquivoIds) && x.arquivoIds.length ? x.arquivoIds.map(Number) : x?.arquivoId ? [Number(x.arquivoId)] : []);
const ehImg = (m, n) => /^image\//i.test(m || "") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(n || "");

export async function arteFinalista() {
  return (await prisma.usuario.findFirst({ where: { setor: "ARTE", ativo: true }, orderBy: { id: "asc" } }))
    || (await prisma.usuario.findFirst({ where: { login: "ayrllon", ativo: true } }));
}
// vendedor do pedido (texto) → usuário ativo com o mesmo nome; sem casar, quem efetivou o pedido
async function vendedorDe(vendedor, fallbackId) {
  const v = sem(vendedor);
  if (v) {
    const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true } });
    const u = us.find((x) => sem(`${x.nome} ${x.sobrenome}`) === v) || us.find((x) => sem(x.nome) === v) || us.find((x) => v.split(" ")[0] && sem(x.nome) === v.split(" ")[0]);
    if (u) return u;
  }
  return fallbackId ? prisma.usuario.findUnique({ where: { id: fallbackId }, select: { id: true, nome: true, sobrenome: true } }) : null;
}
const itensDoPp = (pp) => (pp.itens || []).map((it, idx) => ({ idx, it })).filter(({ it }) => it.tipoPecaNome !== "SERVIÇO");

// chamada ao efetivar/salvar o pedido: cria a CRIAÇÃO DE LAYOUT se houver item sem layout e ainda não houver uma em aberto
export async function gerarCriacaoLayout(ppId, quem) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" }, select: { id: true, tipoPecaNome: true, descricao: true, codigo: true, fotoBase64: true } } } });
  if (!pp || !pp.numero || pp.tipoPedido === "SERVIÇO") return null;
  const falta = itensDoPp(pp).filter(({ it }) => !it.fotoBase64);
  if (!falta.length) return null;
  const abertas = await prisma.tarefa.findMany({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] }, modelo: false, OR: [{ titulo: { startsWith: "CRIAÇÃO DE LAYOUT" } }, { titulo: { startsWith: "APROVAÇÃO DE LAYOUT" } }] }, select: { id: true, layout: true } });
  if (abertas.some((t) => Number(t.layout?.ppId) === pp.id)) return null;   // já tem criação ou aprovação em curso
  const arte = await arteFinalista();
  if (!arte) return null;
  const criador = (quem?.id && await prisma.usuario.findUnique({ where: { id: quem.id } })) || arte;
  const hoje = hojeSP();
  const t = await prisma.tarefa.create({ data: {
    titulo: `CRIAÇÃO DE LAYOUT · PEDIDO ${pp.numero} · ${String(pp.clienteNome || "").toUpperCase()}`.slice(0, 200),
    descricao: `Itens sem layout: ${falta.map(({ idx, it }) => `${idx + 1}. ${it.descricao || it.codigo || "item"}`).join(" · ")}\nAnexe o layout de cada item aqui na tarefa e envie para aprovação do vendedor.`,
    // v733 — a criação é só do arte finalista (criada no nome dele): o vendedor só recebe tarefa quando o layout vai para aprovação
    setor: "COMERCIAL", responsavelId: arte.id, responsavelNome: nomeU(arte), criadoPorId: arte.id, criadoPorNome: nomeU(arte),
    prazo: dUTC(hoje), tipo: "PADRAO", publica: false, natureza: "FUNCIONAL", lembreteMin: null,
    layout: { etapa: "CRIACAO", criadorId: criador.id, ppId: pp.id, numero: pp.numero, cliente: pp.clienteNome || "", vendedor: pp.vendedor || "", itens: falta.map(({ idx, it }) => ({ idx, descricao: it.descricao || "", codigo: it.codigo || "" })) },
  } });
  await prisma.mensagem.create({ data: { deId: criador.id, paraId: arte.id, texto: `🎨 CRIAÇÃO DE LAYOUT — pedido ${pp.numero} (${pp.clienteNome || ""}): ${falta.length} item(ns) sem layout. Veja na agenda.` } }).catch(() => {});
  return t.id;
}

// OP dos itens da tarefa (sem valores) — para o arte finalista e o vendedor
export async function opDaTarefa(t) {
  const L = t.layout || {};
  const pp = await prisma.pp.findUnique({ where: { id: Number(L.ppId) || 0 }, include: { itens: { orderBy: { id: "asc" } }, anexos: { select: { id: true, nome: true, tipo: true, categoria: true }, orderBy: { id: "asc" } } } });
  if (!pp) return { erro: "Pedido não encontrado." };
  const arqs = await prisma.tarefaArquivo.findMany({ where: { tarefaId: t.id }, select: { id: true, nome: true, mime: true } });
  const A = Object.fromEntries(arqs.map((a) => [a.id, a]));
  return {
    pedido: { id: pp.id, numero: pp.numero, cliente: pp.clienteNome, vendedor: pp.vendedor, oc: pp.oc, emissao: pp.emissao, prazoDias: pp.prazoDias, prazoTipo: pp.prazoTipo, obs: pp.obs, tipoPedido: pp.tipoPedido },
    anexosPedido: pp.anexos,
    itens: (L.itens || []).map((x) => {
      const it = pp.itens[x.idx] || {};
      return { ...x, tipoPecaNome: it.tipoPecaNome || null, codigo: it.codigo || x.codigo, descricao: it.descricao || x.descricao,
        grade: safe(it.gradeJson, []).filter((g) => Number(g.qtd) > 0), parametros: safe(it.parametrosJson, {}), fppNumero: it.fppNumero ?? null,
        temLayout: !!it.fotoBase64, arquivos: idsDe(x).map((id) => A[id]).filter(Boolean),
        arquivo: (() => { const l = idsDe(x).map((id) => A[id]).filter(Boolean); return l.find((a) => ehImg(a.mime, a.nome)) || l[0] || null; })(), anexosItem: (Array.isArray(it.anexosJson) ? it.anexosJson : []).map((a, k) => ({ k, nome: a.nome, mime: a.mime })) };
    }),
  };
}

// o arte finalista liga um arquivo da tarefa a um item ({ idx, arquivoId })
// v736 — marcar acrescenta o arquivo ao item; remover tira (o arquivo continua na tarefa)
export async function marcarLayout(t, idx, arquivoId, remover = false) {
  const L = { ...(t.layout || {}) };
  const id = Number(arquivoId) || null;
  L.itens = (L.itens || []).map((x) => {
    if (x.idx !== Number(idx)) return x;
    let ids = idsDe(x);
    ids = remover ? ids.filter((k) => k !== id) : id && !ids.includes(id) ? [...ids, id] : ids;
    return { ...x, arquivoIds: ids, arquivoId: ids[0] || null };
  });
  await prisma.tarefa.update({ where: { id: t.id }, data: { layout: L } });
  return { ok: true };
}

// envia para aprovação: conclui a criação e cria a APROVAÇÃO para o vendedor (com os mesmos arquivos)
export async function enviarAprovacao(t, u) {
  const L = t.layout || {};
  if (L.etapa !== "CRIACAO") return { error: "Esta tarefa não é de criação de layout." };
  const falta = (L.itens || []).filter((x) => !idsDe(x).length);
  if (falta.length) return { error: `Falta o layout de: ${falta.map((x) => `${x.idx + 1}. ${x.descricao}`).join(", ")}.` };
  const pp = await prisma.pp.findUnique({ where: { id: Number(L.ppId) }, select: { vendedor: true, efetivadoPorNome: true } });
  const vend = await vendedorDe(pp?.vendedor || L.vendedor, L.criadorId || t.criadoPorId);
  if (!vend) return { error: "Não achei o vendedor do pedido entre os usuários." };
  const hoje = hojeSP();
  const ap = await prisma.tarefa.create({ data: {
    titulo: `APROVAÇÃO DE LAYOUT · PEDIDO ${L.numero} · ${String(L.cliente || "").toUpperCase()}`.slice(0, 200),
    descricao: `Layout criado por ${nomeU(u)}. Confira cada item e aprove ou reprove (com o motivo).`,
    setor: "COMERCIAL", responsavelId: vend.id, responsavelNome: nomeU(vend), criadoPorId: u.id, criadoPorNome: nomeU(u),
    prazo: dUTC(hoje), tipo: "PADRAO", publica: true, natureza: "FUNCIONAL", lembreteMin: null, layout: { ...L, etapa: "APROVACAO", origemId: t.id, itens: [] },
  } });
  // copia os arquivos dos layouts para a aprovação
  const itens = [];
  for (const x of L.itens) {
    const novos = [];
    for (const id of idsDe(x)) {
      const a = await prisma.tarefaArquivo.findFirst({ where: { id, tarefaId: t.id } });
      const n = a ? await prisma.tarefaArquivo.create({ data: { tarefaId: ap.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, conteudo: a.conteudo, criadoPorNome: a.criadoPorNome } }) : null;
      if (n) novos.push(n.id);
    }
    itens.push({ ...x, arquivoIds: novos, arquivoId: novos[0] || null });
  }
  await prisma.tarefa.update({ where: { id: ap.id }, data: { layout: { ...L, etapa: "APROVACAO", origemId: t.id, itens } } });
  await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: `Enviado para aprovação de ${nomeU(vend)}.` } });
  await prisma.mensagem.create({ data: { deId: u.id, paraId: vend.id, texto: `🎨 APROVAÇÃO DE LAYOUT — pedido ${L.numero} (${L.cliente}). Veja na agenda.` } }).catch(() => {});
  return { ok: true, aprovacaoId: ap.id };
}

// vendedor decide: aprovar (layout vai para o item do pedido) ou reprovar (nova criação para o arte finalista)
export async function decidirLayout(t, u, aprovar, motivo) {
  const L = t.layout || {};
  if (L.etapa !== "APROVACAO") return { error: "Esta tarefa não é de aprovação de layout." };
  if (t.status === "CONCLUIDA") return { error: "Aprovação já decidida." };
  if (!aprovar) {
    if (String(motivo || "").trim().length < 3) return { error: "Escreva as instruções para o arte finalista." };
    const arte = await arteFinalista();
    if (!arte) return { error: "Sem arte finalista cadastrado." };
    // v733 — reprovado: a própria tarefa de criação volta a ficar em aberto para o arte finalista (com as instruções)
    const inst = String(motivo).trim();
    const orig = L.origemId ? await prisma.tarefa.findUnique({ where: { id: Number(L.origemId) } }) : null;
    let nova;
    if (orig && orig.status !== "CANCELADA") {
      const Lo = orig.layout || {};
      nova = await prisma.tarefa.update({ where: { id: orig.id }, data: {
        status: "ABERTA", concluidaEm: null, concluidaPorNome: null, retorno: null, prazo: dUTC(hojeSP()), tipo: "URGENTE",
        descricao: `${String(orig.descricao || "").split("\n⚠ REPROVADO")[0]}\n⚠ REPROVADO por ${nomeU(u)}: ${inst}`.slice(0, 5000),
        layout: { ...Lo, etapa: "CRIACAO", motivo: inst, reprovacoes: (Number(Lo.reprovacoes) || 0) + 1 },
      } });
    } else {
      nova = await prisma.tarefa.create({ data: {
        titulo: `CRIAÇÃO DE LAYOUT · PEDIDO ${L.numero} · ${String(L.cliente || "").toUpperCase()} (REVISÃO)`.slice(0, 200),
        descricao: `Layout reprovado por ${nomeU(u)}: ${inst}\nRefaça e envie de novo para aprovação.`,
        setor: "COMERCIAL", responsavelId: arte.id, responsavelNome: nomeU(arte), criadoPorId: arte.id, criadoPorNome: nomeU(arte),
        prazo: dUTC(hojeSP()), tipo: "URGENTE", publica: false, natureza: "FUNCIONAL", lembreteMin: null,
        layout: { ...L, etapa: "CRIACAO", origemId: t.id, motivo: inst, itens: (L.itens || []).map(({ arquivoId, arquivoIds, ...x }) => x) },
      } });
    }
    await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: `REPROVADO: ${String(motivo).trim()}` } });
    await prisma.mensagem.create({ data: { deId: u.id, paraId: arte.id, texto: `🎨 LAYOUT REPROVADO — pedido ${L.numero}: ${String(motivo).trim()}` } }).catch(() => {});
    return { ok: true, novaId: nova.id };
  }
  const pp = await prisma.pp.findUnique({ where: { id: Number(L.ppId) }, include: { itens: { orderBy: { id: "asc" }, select: { id: true, anexosJson: true } } } });
  if (!pp) return { error: "Pedido não encontrado." };
  // v736 — a 1ª imagem vira a foto do item; os demais arquivos (qualquer formato) entram nos anexos do item
  for (const x of L.itens || []) {
    const it = pp.itens[x.idx];
    if (!it) continue;
    const arqs = (await prisma.tarefaArquivo.findMany({ where: { id: { in: idsDe(x) }, tarefaId: t.id } })).sort((a, b) => idsDe(x).indexOf(a.id) - idsDe(x).indexOf(b.id));
    if (!arqs.length) continue;
    const foto = arqs.find((a) => ehImg(a.mime, a.nome));
    const novos = arqs.filter((a) => a !== foto).map((a) => ({ nome: `Layout aprovado · ${a.nome}`, mime: a.mime, base64: `data:${a.mime || "application/octet-stream"};base64,${a.conteudo}` }));
    const l = Array.isArray(it.anexosJson) ? it.anexosJson : [];
    await prisma.ppItem.update({ where: { id: it.id }, data: { ...(foto ? { fotoBase64: `data:${foto.mime || "image/png"};base64,${foto.conteudo}` } : {}), ...(novos.length ? { anexosJson: [...l, ...novos] } : {}) } });
  }
  await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: "Layout aprovado — gravado no cadastro dos itens do pedido." } });
  if (L.origemId) { const o = await prisma.tarefa.findUnique({ where: { id: L.origemId }, select: { responsavelId: true } }); if (o) await prisma.mensagem.create({ data: { deId: u.id, paraId: o.responsavelId, texto: `✅ LAYOUT APROVADO — pedido ${L.numero} (${L.cliente}).` } }).catch(() => {}); }
  return { ok: true };
}
