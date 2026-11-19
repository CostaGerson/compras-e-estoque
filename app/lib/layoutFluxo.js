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
// v891 — #86: pedido do portal (Loja Way) leva o cliente final no nome: "LOJA WAY - BRIAN SOUZA"
export function clienteRotulo(pp) {
  const n = String(pp?.clienteNome || "").toUpperCase().trim(), cf = pp?.clienteFinal;
  const f = cf && typeof cf === "object" ? String((cf.tipo === "PJ" ? cf.razaoSocial || cf.contato : cf.nome) || "").toUpperCase().replace(/\s+/g, " ").trim() : "";
  return f && !n.includes(f) ? `${n} - ${f}` : n;
}
const itensDoPp = (pp) => (pp.itens || []).map((it, idx) => ({ idx, it })).filter(({ it }) => it.tipoPecaNome !== "SERVIÇO");

// chamada ao efetivar/salvar o pedido: cria a CRIAÇÃO DE LAYOUT se houver item sem layout e ainda não houver uma em aberto
export async function gerarCriacaoLayout(ppId, quem) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" }, select: { id: true, tipoPecaNome: true, descricao: true, codigo: true, fotoBase64: true, dispensaDesign: true } } } });
  if (!pp || !pp.numero || pp.tipoPedido === "SERVIÇO") return null;
  const falta = itensDoPp(pp).filter(({ it }) => !it.fotoBase64 && !it.dispensaDesign);   // v796
  if (!falta.length) return null;
  const abertas = await prisma.tarefa.findMany({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] }, modelo: false, OR: [{ titulo: { startsWith: "CRIAÇÃO DE LAYOUT" } }, { titulo: { startsWith: "APROVAÇÃO DE LAYOUT" } }] }, select: { id: true, layout: true } });
  if (abertas.some((t) => Number(t.layout?.ppId) === pp.id)) return null;   // já tem criação ou aprovação em curso
  const arte = await arteFinalista();
  if (!arte) return null;
  const criador = (quem?.id && await prisma.usuario.findUnique({ where: { id: quem.id } })) || arte;
  const vendU = await vendedorDe(pp.vendedor, null);   // v888 — o vendedor acompanha a criação nas Designadas
  const hoje = hojeSP();
  const cli = clienteRotulo(pp);
  const t = await prisma.tarefa.create({ data: {
    titulo: `CRIAÇÃO DE LAYOUT · PEDIDO ${pp.numero} · ${cli}`.slice(0, 200),
    descricao: `Itens sem layout: ${falta.map(({ idx, it }) => `${idx + 1}. ${it.descricao || it.codigo || "item"}`).join(" · ")}\nAnexe o layout de cada item aqui na tarefa e envie para aprovação do vendedor.`,
    // v733 — a criação é só do arte finalista (criada no nome dele): o vendedor só recebe tarefa quando o layout vai para aprovação
    setor: "COMERCIAL", responsavelId: arte.id, responsavelNome: nomeU(arte), criadoPorId: arte.id, criadoPorNome: nomeU(arte),
    prazo: dUTC(hoje), tipo: "PADRAO", publica: false, natureza: "FUNCIONAL", lembreteMin: null,
    layout: { etapa: "CRIACAO", criadorId: criador.id, ppId: pp.id, numero: pp.numero, cliente: cli, vendedor: pp.vendedor || "", vendedorId: vendU?.id || 0, itens: falta.map(({ idx, it }) => ({ idx, descricao: it.descricao || "", codigo: it.codigo || "" })) },
  } });
  await prisma.mensagem.create({ data: { deId: criador.id, paraId: arte.id, texto: `🎨 CRIAÇÃO DE LAYOUT — pedido ${pp.numero} (${cli}): ${falta.length} item(ns) sem layout. Veja na agenda.`, tarefaId: t.id } }).catch(() => {});
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
    // v949 — todos os arquivos de personalização da OP (de todos os itens, não só dos que estão sem layout) para o arte finalista baixar
    arquivosOp: pp.itens.flatMap((it, idx) => (Array.isArray(it.anexosJson) ? it.anexosJson : []).map((a, k) => ({ idx, k, item: `${idx + 1}. ${it.descricao || it.codigo || it.tipoPecaNome || "item"}`, nome: a.nome, mime: a.mime || null }))),
    itens: (L.itens || []).map((x) => {
      const it = pp.itens[x.idx] || {};
      return { ...x, tipoPecaNome: it.tipoPecaNome || null, codigo: it.codigo || x.codigo, descricao: it.descricao || x.descricao,
        grade: safe(it.gradeJson, []).filter((g) => Number(g.qtd) > 0), parametros: safe(it.parametrosJson, {}), fppNumero: it.fppNumero ?? null,
        temLayout: !!it.fotoBase64, dadosUnitarios: it.dadosUnitarios || null,   // v789 — personalização exclusiva (nome, número… por peça)
        arquivos: idsDe(x).map((id) => A[id]).filter(Boolean),
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
  await prisma.mensagem.create({ data: { deId: u.id, paraId: vend.id, texto: `🎨 APROVAÇÃO DE LAYOUT — pedido ${L.numero} (${L.cliente}). Veja na agenda.`, tarefaId: ap.id } }).catch(() => {});
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
        layout: { ...Lo, etapa: "CRIACAO", motivo: inst, reprovacoes: (Number(Lo.reprovacoes) || 0) + 1, acompanhaId: u.id },   // v756 — quem reprovou acompanha nas Designadas
      } });
    } else {
      nova = await prisma.tarefa.create({ data: {
        titulo: `CRIAÇÃO DE LAYOUT · PEDIDO ${L.numero} · ${String(L.cliente || "").toUpperCase()} (REVISÃO)`.slice(0, 200),
        descricao: `Layout reprovado por ${nomeU(u)}: ${inst}\nRefaça e envie de novo para aprovação.`,
        setor: "COMERCIAL", responsavelId: arte.id, responsavelNome: nomeU(arte), criadoPorId: arte.id, criadoPorNome: nomeU(arte),
        prazo: dUTC(hojeSP()), tipo: "URGENTE", publica: false, natureza: "FUNCIONAL", lembreteMin: null,
        layout: { ...L, etapa: "CRIACAO", origemId: t.id, motivo: inst, acompanhaId: u.id, itens: (L.itens || []).map(({ arquivoId, arquivoIds, ...x }) => x) },
      } });
    }
    await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), retorno: `REPROVADO: ${String(motivo).trim()}`, layout: { ...L, decisao: "REPROVADO" } } });
    await prisma.mensagem.create({ data: { deId: u.id, paraId: arte.id, texto: `🎨 LAYOUT REPROVADO — pedido ${L.numero}: ${String(motivo).trim()}`, tarefaId: nova?.id || t.id } }).catch(() => {});
    return { ok: true, novaId: nova.id };
  }
  // v972 — aprovar responde na hora: a tarefa fecha e os arquivos (foto + anexos dos itens) são gravados em segundo plano.
  //   Antes tudo isso rodava dentro do clique (leitura do pedido inteiro, prévias das imagens, regravar os anexos) e a tela travava.
  const pp = await prisma.pp.findUnique({ where: { id: Number(L.ppId) }, select: { id: true } });
  if (!pp) return { error: "Pedido não encontrado." };
  const agora = new Date().toISOString();
  await prisma.tarefa.update({ where: { id: t.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u),
    retorno: "Layout aprovado — gravando no cadastro dos itens do pedido…", layout: { ...L, decisao: "APROVADO", aprovadoEm: agora, gravacao: "PENDENTE", gravacaoEm: agora } } });   // v755
  if (L.origemId) { const o = await prisma.tarefa.findUnique({ where: { id: L.origemId }, select: { responsavelId: true } }); if (o) await prisma.mensagem.create({ data: { deId: u.id, paraId: o.responsavelId, texto: `✅ LAYOUT APROVADO — pedido ${L.numero} (${L.cliente}).`, tarefaId: t.id } }).catch(() => {}); }
  setTimeout(() => { gravarLayoutAprovado(t.id).catch((e) => console.log("layout/gravação:", e.message)); }, 50);
  return { ok: true, gravando: true };
}

// v972 — grava o layout aprovado nos itens do pedido (idempotente: arquivo que já está no item não entra de novo)
const _gravando = new Set();
export async function gravarLayoutAprovado(tarefaId) {
  if (_gravando.has(tarefaId)) return;
  _gravando.add(tarefaId);
  try {
    const t = await prisma.tarefa.findUnique({ where: { id: Number(tarefaId) }, select: { id: true, layout: true } });
    const L = t?.layout || {};
    if (!t || L.decisao !== "APROVADO" || L.gravacao === "OK") return;
    try {
      const its = await prisma.ppItem.findMany({ where: { ppId: Number(L.ppId) || 0 }, orderBy: { id: "asc" }, select: { id: true } });
      // v736 — a 1ª imagem vira a foto do item; os demais arquivos (qualquer formato) entram nos anexos do item
      for (const x of L.itens || []) {
        const it0 = its[x.idx];
        if (!it0) continue;
        const ids = idsDe(x);
        if (!ids.length) continue;
        const arqs = (await prisma.tarefaArquivo.findMany({ where: { id: { in: ids }, tarefaId: t.id } })).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        if (!arqs.length) continue;
        const it = await prisma.ppItem.findUnique({ where: { id: it0.id }, select: { id: true, anexosJson: true } });
        const l = Array.isArray(it.anexosJson) ? it.anexosJson : [];
        const jaTem = new Set(l.map((a) => a?.nome));
        const { paraDisco } = await import("@/lib/arquivos");
        const foto = arqs.find((a) => ehImg(a.mime, a.nome));
        const novos = [];
        const b64De = async (c) => (/^(arq|gdrive):/.test(String(c || "")) ? (await (await import("@/lib/arquivos")).lerBase64(c)) || "" : c);   // v1003 — disco/Drive viram o conteúdo
        for (const a of arqs) {
          if (a === foto) continue;
          const nome = `Layout aprovado · ${a.nome}`;
          if (jaTem.has(nome)) continue;
          novos.push({ nome, mime: a.mime, base64: await paraDisco(`data:${a.mime || "application/octet-stream"};base64,${await b64De(a.conteudo)}`, { nome: a.nome, mime: a.mime }) });   // grande vai direto para o disco
        }
        // v919 — imagem grande vira foto em versão leve (o original segue nos anexos do item)
        let fotoUrl = foto && !/^(arq|gdrive):/.test(String(foto.conteudo || "")) ? `data:${foto.mime || "image/png"};base64,${foto.conteudo}` : null;
        if (foto) {
          try {
            const { precisaPrevia, previa } = await import("@/lib/imgPrevia");
            const { lerBase64 } = await import("@/lib/arquivos");
            if (precisaPrevia(foto.mime, foto.nome, foto.tamanho) || /^(arq|gdrive):/.test(String(foto.conteudo || ""))) {
              const out = await previa(`tarefaArquivo|${foto.id}|${foto.tamanho}`, async () => Buffer.from(await lerBase64(foto.conteudo), "base64"));
              fotoUrl = `data:image/webp;base64,${out.toString("base64")}`;
              const nome = `Layout aprovado · ${foto.nome}`;
              if (!jaTem.has(nome)) novos.unshift({ nome, mime: foto.mime, base64: await paraDisco(`data:${foto.mime || "application/octet-stream"};base64,${await b64De(foto.conteudo)}`, { nome: foto.nome, mime: foto.mime }) });
            }
          } catch (e) { console.log("layout/prévia da foto:", e.message); }
        }
        await prisma.ppItem.update({ where: { id: it.id }, data: { ...(fotoUrl ? { fotoBase64: fotoUrl } : {}), ...(novos.length ? { anexosJson: [...l, ...novos] } : {}) } });
      }
      try { await (await import("@/lib/arquivos")).enxugarItensPp(L.ppId); } catch (e) { console.log("enxugar anexos:", e.message); }   // v868
      await prisma.tarefa.update({ where: { id: t.id }, data: { retorno: "Layout aprovado — gravado no cadastro dos itens do pedido.", layout: { ...L, gravacao: "OK", gravacaoEm: new Date().toISOString() } } });
    } catch (e) {
      await prisma.tarefa.update({ where: { id: t.id }, data: { retorno: `Layout aprovado — falhou ao gravar nos itens (${String(e.message).slice(0, 120)}); o sistema tenta de novo.`, layout: { ...L, gravacao: "ERRO", gravacaoErro: String(e.message).slice(0, 300), gravacaoEm: new Date().toISOString() } } }).catch(() => {});
      throw e;
    }
  } finally { _gravando.delete(tarefaId); }
}
// v972 — retoma gravações que ficaram pela metade (servidor reiniciado no meio, erro): chamado ao abrir a tarefa e a cada 10 min
export async function retomarGravacoesLayout() {
  const l = await prisma.tarefa.findMany({ where: { status: "CONCLUIDA", titulo: { startsWith: "APROVAÇÃO DE LAYOUT" }, concluidaEm: { gte: new Date(Date.now() - 30 * 86400e3) } }, select: { id: true, layout: true } }).catch(() => []);
  for (const t of l) {
    const L = t.layout || {};
    if (L.decisao !== "APROVADO" || !["PENDENTE", "ERRO"].includes(L.gravacao)) continue;
    if (L.gravacao === "PENDENTE" && Date.now() - new Date(L.gravacaoEm || 0).getTime() < 3 * 60e3) continue;   // ainda gravando
    await gravarLayoutAprovado(t.id).catch((e) => console.log("layout/retomar:", e.message));
  }
}

// v888 — criações de layout antigas: grava o vendedorId (usuário do vendedor do pedido) para ele acompanhar nas Designadas
export async function ajustarVendedorLayout() {
  const l = await prisma.tarefa.findMany({ where: { modelo: false, titulo: { startsWith: "CRIAÇÃO DE LAYOUT" } }, select: { id: true, layout: true } }).catch(() => []);
  for (const t of l) {
    if (!t.layout || t.layout.vendedorId != null) continue;
    const pp = t.layout.ppId ? await prisma.pp.findUnique({ where: { id: Number(t.layout.ppId) }, select: { vendedor: true } }).catch(() => null) : null;
    const v = await vendedorDe(pp?.vendedor || t.layout.vendedor, null);
    await prisma.tarefa.update({ where: { id: t.id }, data: { layout: { ...t.layout, vendedorId: v?.id || 0 } } }).catch(() => {});
  }
}

// v891 — #86: tarefas de layout em aberto de pedidos do portal passam a mostrar o cliente final no título (uma vez por processo)
export async function ajustarClienteFinalLayout() {
  if (globalThis.__cfLayout) return; globalThis.__cfLayout = true;
  const l = await prisma.tarefa.findMany({ where: { modelo: false, status: { notIn: ["CANCELADA"] }, OR: [{ titulo: { startsWith: "CRIAÇÃO DE LAYOUT" } }, { titulo: { startsWith: "APROVAÇÃO DE LAYOUT" } }] }, select: { id: true, titulo: true, layout: true } }).catch(() => []);
  const ids = [...new Set(l.map((t) => Number(t.layout?.ppId)).filter(Boolean))];
  if (!ids.length) return;
  const pps = await prisma.pp.findMany({ where: { id: { in: ids }, OR: [{ portalClienteId: { not: null } }, { extRef: { startsWith: "NORT|" } }] }, select: { id: true, clienteNome: true, clienteFinal: true } }).catch(() => []);
  const P = Object.fromEntries(pps.map((p) => [p.id, clienteRotulo(p)]));
  for (const t of l) {
    const novo = P[Number(t.layout?.ppId)];
    if (!novo || t.layout?.cliente === novo) continue;
    const velho = String(t.layout?.cliente || "").toUpperCase();
    const titulo = velho && t.titulo.includes(` · ${velho}`) ? t.titulo.replace(` · ${velho}`, ` · ${novo}`) : t.titulo;
    await prisma.tarefa.update({ where: { id: t.id }, data: { titulo: titulo.slice(0, 200), layout: { ...t.layout, cliente: novo } } }).catch(() => {});
  }
}
