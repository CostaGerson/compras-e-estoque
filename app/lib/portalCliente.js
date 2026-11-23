// v699 — Portal do cliente (ex.: Loja Way): o cliente lança pedidos só com os itens padrão cadastrados para ele
// (escolhe o item, informa a grade, anexa as artes e a personalização exclusiva) e vê só os pedidos dele.
// v711 — fluxo do pedido no portal:
//   EM ABERTO (montagem parada no meio) → envio: RECEBENDO DETALHES (data limite para o link) ou LIBERADO PARA PRODUÇÃO
//   → EM PRODUÇÃO (pedido efetivado pela Meridian) → FINALIZADO (faturado).
//   Ao enviar, mostra CMV (valor da FPP × peças), valor vendido (informado por item), MC e despacho pelo lead time da FPP.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { usuarioAtivoFin } from "@/lib/fin";
import { gerencial, tem } from "@/lib/acesso";
import { listarItensPadrao } from "@/lib/itensPadrao";
import { salvarPp } from "@/lib/pedidoEfetivar";
import { paramFora, qtdGrade, num, hojeISO, somaDias } from "@/lib/pedidoLanc";
import { limparDU, temDU, conferirComGrade, gradeDaLista, normTam } from "@/lib/dadosUnitarios";
import { validarClienteFinal, enderecoTxt } from "@/lib/clienteFinal";

export const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
export const negadoPortal = () => Response.json({ error: "Acesso restrito ao portal do cliente." }, { status: 403 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const fmtNumPortal = (n) => (n ? String(n).padStart(4, "0") : "");

// v713 — numeração própria do portal por cliente: 0001, 0002… (contador em FinConfig; nº de pedido excluído não volta)
async function proximoNumeroPortal(clienteId) {
  const chave = `PORTAL_NUM|${clienteId}`;
  for (let t = 0; t < 5; t++) {
    const cfg = await prisma.finConfig.findUnique({ where: { chave } });
    const maxPp = await prisma.pp.aggregate({ where: { portalClienteId: clienteId }, _max: { portalNumero: true } });
    const n = Math.max(Number(cfg?.valor) || 0, maxPp._max.portalNumero || 0) + 1;
    try {
      if (cfg) { const r = await prisma.finConfig.updateMany({ where: { chave, valor: cfg.valor }, data: { valor: String(n) } }); if (!r.count) continue; }
      else await prisma.finConfig.create({ data: { chave, valor: String(n) } });
      return n;
    } catch { /* corrida: tenta de novo */ }
  }
  throw new Error("Não consegui numerar o pedido — tente de novo.");
}
// pedidos antigos sem número recebem na ordem de criação
async function numerarAntigos(clienteId) {
  const sem = await prisma.pp.findMany({ where: { portalClienteId: clienteId, portalNumero: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  for (const p of sem) await prisma.pp.update({ where: { id: p.id }, data: { portalNumero: await proximoNumeroPortal(clienteId) } }).catch(() => null);
}

export async function usuarioPortal(req) {
  let id = req.headers.get("x-usuario-id");
  if (!id) { try { id = new URL(req.url).searchParams.get("_u"); } catch {} }
  const u = await usuarioAtivoFin(id);
  // v1076 — acesso interno pelo ERP (Gestão › S › Portal Way): usuário da Meridian com gestão, escolhendo o cliente do portal
  if (u && u.setor !== "CLIENTE") {
    let cid = Number(req.headers.get("x-portal-cliente")) || 0;
    if (!cid) { try { cid = Number(new URL(req.url).searchParams.get("_pc")) || 0; } catch {} }
    if (!cid || !acessoInternoPortal(u)) return null;
    const cliente = await prisma.cliente.findUnique({ where: { id: cid } });
    return cliente ? { u, cliente, interno: true } : null;
  }
  if (!u || u.setor !== "CLIENTE" || !u.portalClienteId) return null;
  const cliente = await prisma.cliente.findUnique({ where: { id: u.portalClienteId } });
  return cliente ? { u, cliente } : null;
}

export const acessoInternoPortal = (u) => !!u && (gerencial(u) || tem(u, "ppStatus"));
// v1076 — clientes que têm portal (usuário CLIENTE ativo ligado a eles), para o acesso interno
export async function clientesComPortal() {
  const us = await prisma.usuario.findMany({ where: { setor: "CLIENTE", portalClienteId: { not: null } }, select: { portalClienteId: true } });
  const ids = [...new Set(us.map((x) => x.portalClienteId))];
  const cs = ids.length ? await prisma.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nomeFantasia: true, razaoSocial: true } }) : [];
  return cs.map((c) => ({ id: c.id, nome: nomeCliente(c) })).sort((a, b) => a.nome.localeCompare(b.nome));
}
// v1076 — interno: troca a data de despacho do pedido do portal (portal + pedido de venda, se já efetivado)
export async function alterarDespacho(cliente, ppId, data, u) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return { error: "Data de despacho inválida." };
  const pp = await prisma.pp.findFirst({ where: { id: Number(ppId) || 0, portalClienteId: cliente.id }, select: { id: true, numero: true, dtDespacho: true, efetivadoEm: true } });
  if (!pp) return { error: "Pedido não encontrado." };
  const br = data.split("-").reverse().join("/");
  await prisma.pp.update({ where: { id: pp.id }, data: { dtDespacho: br } });
  if (pp.efetivadoEm && pp.numero) {
    const pv = await prisma.pedidoVenda.findFirst({ where: { numero: pp.numero }, select: { id: true, obs: true } });
    if (pv) await prisma.pedidoVenda.update({ where: { id: pv.id }, data: { despacho: new Date(`${data}T00:00:00Z`), atualizadoPorNome: nomeU(u) || null,
      obs: [pv.obs, `DESPACHO ALTERADO ${pp.dtDespacho || "—"} → ${br} POR ${nomeU(u) || "—"} (PORTAL)`].filter(Boolean).join(" · ").slice(0, 1000) } });
  }
  return { ok: true };
}
// v1077 — interno: adiciona / remove custo adicional do pedido (soma no CMV)
export async function alterarCustos(cliente, ppId, { adicionar, remover }, u) {
  const pp = await prisma.pp.findFirst({ where: { id: Number(ppId) || 0, portalClienteId: cliente.id }, select: { id: true, custosExtras: true } });
  if (!pp) return { error: "Pedido não encontrado." };
  let l = Array.isArray(pp.custosExtras) ? [...pp.custosExtras] : [];
  if (adicionar) {
    const descricao = String(adicionar.descricao || "").trim().toUpperCase().slice(0, 160);
    const valor = r2(num(adicionar.valor));
    if (!descricao) return { error: "Descreva o custo." };
    if (!valor) return { error: "Informe o valor do custo." };
    l.push({ id: `${Date.now()}${Math.floor(Math.random() * 1000)}`, descricao, valor, por: nomeU(u) || null, em: new Date().toISOString() });
  }
  if (remover) l = l.filter((x) => String(x.id) !== String(remover));
  await prisma.pp.update({ where: { id: pp.id }, data: { custosExtras: l.length ? l : Prisma.DbNull } });
  return { ok: true };
}
// v1078 — NF que a loja emite para o cliente final (PDF): anexo do pedido no ERP, categoria NF_CLIENTE
const PREF_NF = "NF do cliente · ";
export async function anexarNfCliente(cliente, ppId, arquivos, u) {
  const pp = await prisma.pp.findFirst({ where: { id: Number(ppId) || 0, portalClienteId: cliente.id }, select: { id: true } });
  if (!pp) return { error: "Pedido não encontrado." };
  const l = (Array.isArray(arquivos) ? arquivos : []).filter((a) => a && a.base64);
  const { tokenDe, lerMeta } = await import("@/lib/arquivos");
  let n = 0;
  for (const a of l) {
    const nome = String(a.nome || "nf.pdf").slice(0, 160);
    if (!/pdf/i.test(`${a.mime || ""} ${nome}`)) return { error: `${nome}: envie a NF em PDF.` };
    const b64 = String(a.base64).replace(/^data:[^,]+,/, "");
    const t = tokenDe(b64), mt = t ? await lerMeta(t).catch(() => null) : null;
    await prisma.ppAnexo.create({ data: { ppId: pp.id, nome: `${PREF_NF}${nome}`.slice(0, 200), tipo: "application/pdf", categoria: "NF_CLIENTE",
      tamanho: mt ? mt.tamanho : Math.floor(b64.length * 3 / 4), base64: b64, criadoPorNome: `PORTAL · ${nomeU(u)}`.slice(0, 120) } });
    n++;
  }
  if (n) await avisar(u, cliente, pp.id, `${n} NF(s) emitida(s) para o cliente anexada(s) ao pedido`).catch(() => null);
  return { ok: true, n };
}
export async function removerNfCliente(cliente, anexoId) {
  const a = await prisma.ppAnexo.findFirst({ where: { id: Number(anexoId) || 0, categoria: "NF_CLIENTE", pp: { portalClienteId: cliente.id } }, select: { id: true } });
  if (!a) return { error: "NF não encontrada." };
  await prisma.ppAnexo.delete({ where: { id: a.id } });
  return { ok: true };
}
export async function nfClienteArquivo(cliente, anexoId) {
  return prisma.ppAnexo.findFirst({ where: { id: Number(anexoId) || 0, categoria: "NF_CLIENTE", pp: { portalClienteId: cliente.id } } });
}
export const nomeCliente = (c) => String(c?.nomeFantasia || c?.razaoSocial || "").toUpperCase();

// itens padrão do cliente: lead time e CMV (valor da FPP) — sem os nossos custos
export async function itensDoCliente(clienteId) {
  const l = await listarItensPadrao({ cliente: clienteId });
  const fotos = l.length ? await prisma.itemPadrao.findMany({ where: { id: { in: l.map((i) => i.id) } }, select: { id: true, fotoBase64: true } }) : [];
  const foto = Object.fromEntries(fotos.map((f) => [f.id, f.fotoBase64]));
  const fppIds = [...new Set(l.map((i) => i.fppId).filter(Boolean))];
  const fpps = fppIds.length ? await prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, leadTime: true, valorProposto: true } }) : [];
  const F = Object.fromEntries(fpps.map((f) => [f.id, f]));
  return l.map((i) => {
    const f = i.fppId ? F[i.fppId] : null;
    const cmv = f?.valorProposto != null ? r2(f.valorProposto) : i.precoAtual != null ? r2(i.precoAtual) : null;
    return { id: i.id, codigo: i.codigoPadrao || i.codigo || null, nome: i.nomeInterno, nomeNf: i.nomeNf, tipoPeca: i.tipoPecaNome || null, foto: foto[i.id] || null,
      leadTime: Number(f?.leadTime) > 0 ? Number(f.leadTime) : null, cmvUnit: cmv };
  });
}

const dataUrl = (b64, mime) => (/^data:/.test(String(b64)) ? b64 : `data:${mime || "application/octet-stream"};base64,${b64}`);
const LIM_ARTE = 15 * 1024 * 1024;
const PREF_ARTE = "Arte do cliente · ";
const limparGrade = (grade) => (Array.isArray(grade) ? grade : []).map((g) => ({ tam: String(g.tam || "").slice(0, 12), qtd: String(Math.max(0, Math.round(num(g.qtd))) || "") })).filter((g) => g.tam);

async function pedidoDoCliente(cliente, ppId) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp || pp.portalClienteId !== cliente.id) return { error: "Pedido não encontrado." };
  if (pp.efetivadoEm || pp.status !== "EM_LANCAMENTO") return { error: "Este pedido já está na produção: fale com seu vendedor para alterar." };
  return { pp };
}

// grava o pedido como está (rascunho = EM ABERTO). Devolve { id, itens (formato editor), catalogo, leadMax }
async function gravar({ u, cliente }, b, ppId) {
  const pedidos = Array.isArray(b?.itens) ? b.itens : [];
  const catalogo = await itensDoCliente(cliente.id);
  const cat = Object.fromEntries(catalogo.map((i) => [i.id, i]));
  const itens = [];
  for (const [k, p] of pedidos.entries()) {
    const id = Number(p.itemPadraoId);
    if (!cat[id]) return { error: `Item ${k + 1}: item não disponível para este cliente.` };
    const d = await prisma.itemPadrao.findUnique({ where: { id }, include: { anexos: true } });
    const artes = (Array.isArray(p.artes) ? p.artes : []).filter((a) => a && a.base64).slice(0, 20);
    for (const a of artes) if (String(a.base64).length * 0.75 > LIM_ARTE) return { error: `${a.nome}: arquivo maior que 15 MB.` };
    itens.push({
      tipoPecaNome: d.tipoPecaNome || "", codigo: d.codigo || "", descricao: d.nomeNf || d.nomeInterno, itemPadraoId: d.id,
      valorUnitario: d.precoAtual != null ? String(Number(d.precoAtual).toFixed(2)).replace(".", ",") : "",
      valorVenda: num(p.valorVenda) > 0 ? r2(num(p.valorVenda)) : "",
      grade: limparGrade(p.grade), parametros: Object.fromEntries(Object.entries(d.parametros || {}).filter(([kk, v]) => v && !paramFora(kk) && kk !== "TECIDO")),
      fotoBase64: d.fotoBase64 || "", fppId: d.fppId || null, fppNumero: d.fppNumero ?? null,
      anexos: [
        ...artes.map((a) => ({ nome: PREF_ARTE + String(a.nome || "arte").replace(PREF_ARTE, "").slice(0, 150), mime: a.mime || null, base64: dataUrl(a.base64, a.mime) })),
        ...d.anexos.map((a) => ({ nome: `${a.tipo === "MEDIDAS" ? "Tabela de medidas" : "Layout"} · ${a.nome}`, mime: a.mime || null, base64: dataUrl(a.base64, a.mime) })),
      ],
      dadosUnitarios: limparDU(p.dadosUnitarios),
    });
  }
  const leadMax = Math.max(0, ...itens.map((it) => cat[it.itemPadraoId]?.leadTime || 0));
  const quem = nomeU(u);
  const cfv = validarClienteFinal(b.clienteFinal);
  const cfTxt = cfv.dados ? `CLIENTE FINAL: ${cfv.dados.tipo === "PJ" ? `${cfv.dados.razaoSocial} (${cfv.dados.cnpj})` : `${cfv.dados.nome} (${cfv.dados.cpf})`} · ENTREGA: ${enderecoTxt(cfv.dados)} · ${cfv.dados.whatsapp}` : "";
  const obsCli = String(b.obs || "").trim().slice(0, 2000);
  const end = [cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro, cliente.municipio && `${cliente.municipio}${cliente.uf ? "/" + cliente.uf : ""}`, cliente.cep].filter(Boolean).join(", ");
  const payload = {
    emissao: hojeISO(), clienteNome: cliente.razaoSocial || cliente.nomeFantasia, clienteCnpj: cliente.cnpj || "", clienteIe: cliente.inscricaoEstadual || "",
    clienteEndereco: end, clienteContato: [cliente.preposto, cliente.telefones, cliente.emailNf].filter(Boolean).join(" · "),
    oc: String(b.oc || "").trim().slice(0, 60), vendedor: "",
    obs: [`PEDIDO DO PORTAL DO CLIENTE (${nomeCliente(cliente)}) · ${quem}`, cfTxt, obsCli && `OBS DO CLIENTE: ${obsCli}`].filter(Boolean).join(" · "),
    entregaModo: "UNICA", entregas: [], pagamento: null, itens,
    ...(leadMax > 0 ? { prazoDias: leadMax, prazoTipo: "CORRIDOS" } : {}),   // despacho pelo maior lead time das FPPs
  };
  const id = await salvarPp(ppId || null, payload, quem);
  const ja = ppId ? await prisma.pp.findUnique({ where: { id }, select: { portalNumero: true } }) : null;
  const portalNumero = ja?.portalNumero || await proximoNumeroPortal(cliente.id);
  await prisma.pp.update({ where: { id }, data: { portalNumero, portalClienteId: cliente.id, portalEnviadoPor: quem, portalObs: obsCli || null,
    clienteFinal: b.clienteFinal && typeof b.clienteFinal === "object" ? (cfv.dados || b.clienteFinal) : Prisma.DbNull, portalStatus: "EM_ABERTO" } });
  return { id, itens, catalogo, cat, leadMax, cf: cfv };
}

// rascunho: "em aberto" (montagem parada no meio)
export async function salvarRascunho(ctx, b) {
  if (b.ppId) { const x = await pedidoDoCliente(ctx.cliente, b.ppId); if (x.error) return x; }
  if (!(Array.isArray(b?.itens) && b.itens.length) && !b.clienteFinal) return { error: "Nada para salvar ainda." };
  const g = await gravar(ctx, b, b.ppId);
  if (g.error) return g;
  if (Array.isArray(b.nfs) && b.nfs.length) { const r = await anexarNfCliente(ctx.cliente, g.id, b.nfs, ctx.u); if (r.error) return r; }   // v1078
  const pn = await prisma.pp.findUnique({ where: { id: g.id }, select: { portalNumero: true } });
  return { ok: true, id: g.id, numero: fmtNumPortal(pn?.portalNumero) };
}

// envio: modo "LIMITE" (abre o recebimento de dados até a data limite) ou "PRODUCAO" (liberado para produção)
export async function enviarPedido(ctx, b) {
  const { u, cliente } = ctx;
  if (b.ppId) { const x = await pedidoDoCliente(cliente, b.ppId); if (x.error) return x; }
  const lista = Array.isArray(b?.itens) ? b.itens : [];
  if (!lista.length) return { error: "Escolha ao menos um item." };
  const vcf = validarClienteFinal(b.clienteFinal);
  if (vcf.erros) return { error: `Dados do cliente e envio — preencha: ${vcf.erros.join(" ")}` };
  const modo = b.modo === "LIMITE" ? "LIMITE" : "PRODUCAO";
  for (const [k, p] of lista.entries()) {
    const grade = limparGrade(p.grade);
    if (!(qtdGrade(grade) > 0)) return { error: `Item ${k + 1}: informe a grade.` };
    if (!(num(p.valorVenda) > 0)) return { error: `Item ${k + 1}: informe o valor vendido por peça.` };
    const du = limparDU(p.dadosUnitarios);
    if (temDU(du) && du.campos.some((c) => !c.local)) return { error: `Item ${k + 1}: escolha o local da personalização.` };   // v718
    if (temDU(du) && du.linhas.length) {
      const cf = conferirComGrade(du, grade);
      if (!cf.ok) return { error: `Item ${k + 1}: a lista de personalização exclusiva não bate com a grade (${Object.entries(cf.dif).map(([t, x]) => `${t} ${x > 0 ? "+" : ""}${x}`).join(", ")}).` };
    } else if (temDU(du) && modo === "PRODUCAO") {
      return { error: `Item ${k + 1}: a personalização exclusiva está sem a lista. Preencha/cole a lista ou escolha "inserir data limite" para receber os dados pelo link.` };
    }
  }
  const comPE = lista.map((p, k) => [k, limparDU(p.dadosUnitarios)]).filter(([, du]) => temDU(du));
  let limite = null;
  if (modo === "LIMITE") {
    if (!comPE.length) return { error: "Nenhum item tem personalização exclusiva: não há dados a receber. Envie direto para a produção." };
    limite = new Date(b.limite || "");
    if (!Number.isFinite(limite.getTime()) || limite.getTime() < Date.now()) return { error: "Escolha um dia e horário limite no futuro." };
  }
  const g = await gravar(ctx, b, b.ppId);
  if (g.error) return g;
  const id = g.id;
  if (Array.isArray(b.nfs) && b.nfs.length) { const r = await anexarNfCliente(cliente, id, b.nfs, u); if (r.error) return r; }   // v1078
  // links de preenchimento (um por item com personalização exclusiva)
  if (modo === "LIMITE") {
    const { criarLink, mudarLimite } = await import("@/lib/dadosLink");
    const ppItens = await prisma.ppItem.findMany({ where: { ppId: id }, orderBy: { id: "asc" } });
    for (const [k, du] of comPE) {
      const it = ppItens[k];
      if (!it) continue;
      let novo = { ...du };
      const existe = du.linkId ? await prisma.dadoUnitarioLink.findUnique({ where: { id: du.linkId }, select: { id: true, ppId: true } }) : null;
      if (existe && existe.ppId === id) { const r = await mudarLimite(existe.id, limite.toISOString()); if (r.error) return r; }
      else {
        const tams = [...new Set([...(g.itens[k].grade || []).map((x) => normTam(x.tam)), "PP", "P", "M", "G", "GG", "XG"])];
        const r = await criarLink({ titulo: `${nomeCliente(cliente)} · ${g.cat[g.itens[k].itemPadraoId]?.nome || it.descricao}`, clienteNome: nomeCliente(cliente), campos: du.campos, tamanhos: tams, limite: limite.toISOString(), ppId: id, itemIdx: k },
          { u, portalClienteId: cliente.id });
        if (r.error) return r;
        novo = { ...du, linkId: r.id, linkToken: r.token };
      }
      await prisma.ppItem.update({ where: { id: it.id }, data: { dadosUnitarios: novo } });
    }
  }
  const agora = new Date();
  await prisma.pp.update({ where: { id }, data: { portalStatus: modo === "LIMITE" ? "RECEBENDO_DETALHES" : "LIBERADO", portalEnviadoEm: agora, portalLiberadoEm: null } });
  const lanc = modo === "PRODUCAO" ? await liberar(id, cliente) : null;
  await avisar(u, cliente, id, modo === "LIMITE" ? `recebendo detalhes até ${limite.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : textoLancamento(lanc));
  const pecas = g.itens.reduce((s, it) => s + qtdGrade(it.grade), 0);
  const pn = await prisma.pp.findUnique({ where: { id }, select: { portalNumero: true } });
  return { ok: true, id, numero: fmtNumPortal(pn?.portalNumero), pecas, modo, links: modo === "LIMITE" ? await linksDoPedido(id) : [] };
}

// v714 — liberado para produção: o despacho passa a contar o maior lead time das FPPs a partir de agora
// v727 — mensagem para a equipe: lançado na produção (nº do pedido) ou o motivo de ter ficado em Lançar pedido
const textoLancamento = (r) => (r?.ok ? `LIBERADO E LANÇADO NA PRODUÇÃO: PEDIDO ${r.numero} (anexos e personalização em Excel no pedido)`
  : `LIBERADO PARA PRODUÇÃO, MAS NÃO FOI LANÇADO SOZINHO — conferir e efetivar pelo aviso no topo da Produção. Motivo: ${(r?.erros || ["?"]).join(" ")}`);
async function liberar(ppId, cliente) {
  const its = await prisma.ppItem.findMany({ where: { ppId }, select: { fppId: true } });
  const ids = [...new Set(its.map((i) => i.fppId).filter(Boolean))];
  const fs = ids.length ? await prisma.fpp.findMany({ where: { id: { in: ids } }, select: { leadTime: true } }) : [];
  const lead = Math.max(0, ...fs.map((f) => Number(f.leadTime) || 0));
  const hoje = hojeISO();
  const desp = lead > 0 ? somaDias(hoje, lead, "CORRIDOS") : null;
  await prisma.pp.update({ where: { id: ppId }, data: { portalStatus: "LIBERADO", portalLiberadoEm: new Date(), emissao: hoje,
    ...(lead > 0 ? { prazoDias: lead, prazoTipo: "CORRIDOS", prazoEntrega: `${lead} DIAS CORRIDOS`, dtDespacho: String(desp).slice(0, 10).split("-").reverse().join("/") } : {}) } });
  // v727 — lança sozinho no sistema de produção (efetiva com anexos e a personalização em Excel)
  try { const { lancarNaProducao } = await import("@/lib/portalProducao"); return await lancarNaProducao(ppId, cliente ? nomeCliente(cliente) : ""); }
  catch (e) { console.log("portal/lançar:", e.message); return { ok: false, erros: [e.message] }; }
}

async function avisar(u, cliente, ppId, txt) {
  const para = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { diretoria: true }, { setor: "COMERCIAL" }] }, select: { id: true } }).catch(() => []);
  const pp = ppId > 0 ? await prisma.pp.findUnique({ where: { id: ppId }, select: { portalNumero: true, itens: { select: { quantidade: true } } } }) : null;
  const pecas = (pp?.itens || []).reduce((s, x) => s + (Number(x.quantidade) || 0), 0);
  if (para.length) await prisma.mensagem.createMany({ data: para.filter((x) => x.id !== u?.id).map((x) => ({ deId: u?.id || x.id, paraId: x.id,
    texto: `🛒 PEDIDO DO PORTAL${pp?.portalNumero ? ` Nº ${fmtNumPortal(pp.portalNumero)}` : ""} — ${nomeCliente(cliente)}: ${pp ? `${pecas} peça(s) · ` : ""}${txt}.${pp ? " Veja em Produção." : ""}` })) }).catch(() => null);
}

export async function linksDoPedido(ppId) {
  const l = await prisma.dadoUnitarioLink.findMany({ where: { ppId: Number(ppId) }, orderBy: { id: "asc" }, select: { id: true, token: true, titulo: true, itemIdx: true, limite: true, aberto: true } });
  return l;
}

// recebimento encerrado (prazo vencido ou links fechados): as respostas viram a lista dos itens que ainda não têm lista e o pedido fica LIBERADO
async function concluirRecebimento(pp, cliente) {
  const { verLink } = await import("@/lib/dadosLink");
  const itens = await prisma.ppItem.findMany({ where: { ppId: pp.id }, orderBy: { id: "asc" } });
  for (const it of itens) {
    const du = it.dadosUnitarios;
    if (!temDU(du) || !du.linkId || (du.linhas || []).length) continue;
    const l = await verLink(du.linkId);
    if (!l || !l.linhas.length) continue;
    const cs = new Set(du.campos.map((c) => c.id));
    const linhas = l.linhas.map((x) => ({ tam: normTam(x.tam), valores: Object.fromEntries(Object.entries(x.valores || {}).filter(([k]) => cs.has(k))) }));
    let grade = []; try { grade = JSON.parse(it.gradeJson || "[]"); } catch {}
    const g = gradeDaLista(grade, linhas);
    const q = qtdGrade(g);
    await prisma.ppItem.update({ where: { id: it.id }, data: { dadosUnitarios: { ...du, linhas }, gradeJson: JSON.stringify(g), quantidade: q,
      valorTotal: Number(it.valorUnitario) ? r2(q * Number(it.valorUnitario)) : null } });
  }
  const tot = await prisma.ppItem.findMany({ where: { ppId: pp.id }, select: { valorTotal: true } });
  await prisma.pp.update({ where: { id: pp.id }, data: { valorTotal: r2(tot.reduce((s, x) => s + (Number(x.valorTotal) || 0), 0)) } });
  const lanc = await liberar(pp.id, cliente);
  await avisar(null, cliente, pp.id, `recebimento de dados encerrado: ${textoLancamento(lanc)}`);
}

export const ST_PORTAL = {
  EM_ABERTO: "Em aberto", RECEBENDO_DETALHES: "Recebendo detalhes", LIBERADO: "Liberado para produção", EM_PRODUCAO: "Em produção", FINALIZADO: "Finalizado",
  DESPACHADO: "Despachado", ENTREGUE: "Entregue", CANCELADO: "Cancelado",
};
// v1074 — faturado (ou sem NF) → FINALIZADO; com código de rastreio → DESPACHADO; o cliente marca → ENTREGUE
const statusDe = (p, pv) => (p.status === "CANCELADO" ? "CANCELADO" : p.entregueEm ? "ENTREGUE" : p.rastreio ? "DESPACHADO"
  : p.status === "FATURADO" || pv?.status === "FATURADO" || pv?.semNota ? "FINALIZADO" : p.efetivadoEm ? "EM_PRODUCAO" : p.portalStatus || "LIBERADO");

// v1074 — interno: grava (ou apaga) o código de rastreio do pedido do portal
export async function gravarRastreio(numero, codigo, quem) {
  const pp = await prisma.pp.findFirst({ where: { numero: String(numero), portalClienteId: { not: null }, status: { not: "EXCLUIDO" } }, orderBy: { id: "desc" },
    select: { id: true, portalClienteId: true, rastreio: true } });
  if (!pp) return { error: "Este pedido não é do portal do cliente." };
  const cod = String(codigo || "").trim().toUpperCase().slice(0, 120);
  await prisma.pp.update({ where: { id: pp.id }, data: cod
    ? { rastreio: cod, despachadoEm: new Date(), despachadoPor: quem || null }
    : { rastreio: null, despachadoEm: null, despachadoPor: null, entregueEm: null, entreguePor: null } });
  return { ok: true, rastreio: cod || null };
}
// v1074 — portal: o cliente (Loja Way) marca o pedido despachado como entregue ao cliente final (ou desfaz)
export async function marcarEntregue(cliente, ppId, u, valor = true) {
  const pp = await prisma.pp.findFirst({ where: { id: Number(ppId) || 0, portalClienteId: cliente.id }, select: { id: true, rastreio: true, status: true, numero: true, portalNumero: true } });
  if (!pp) return { error: "Pedido não encontrado." };
  if (valor) {
    const pv = pp.numero ? await prisma.pedidoVenda.findFirst({ where: { numero: pp.numero }, select: { status: true, semNota: true } }) : null;
    if (!pp.rastreio && pp.status !== "FATURADO" && pv?.status !== "FATURADO" && !pv?.semNota) return { error: "O pedido ainda não foi despachado." };
  }
  await prisma.pp.update({ where: { id: pp.id }, data: valor ? { entregueEm: new Date(), entreguePor: nomeU(u) || null } : { entregueEm: null, entreguePor: null } });
  if (valor) await avisar(u, cliente, pp.id, `pedido marcado como ENTREGUE ao cliente final${pp.numero ? ` (pedido Meridian ${pp.numero})` : ""}`).catch(() => null);
  return { ok: true };
}

// valores do pedido: CMV = valor da FPP × peças · vendido = valor vendido × peças · MC = vendido − CMV
export function valoresPedido(itens, fppValor) {
  let cmv = 0, venda = 0, pecas = 0;
  const lin = itens.map((it) => {
    const q = Number(it.quantidade) || 0;
    const cu = it.fppId && fppValor[it.fppId] != null ? Number(fppValor[it.fppId]) : Number(it.valorUnitario) || 0;
    const vv = Number(it.valorVenda) || 0;
    cmv += q * cu; venda += q * vv; pecas += q;
    return { cmvUnit: r2(cu), cmv: r2(q * cu), valorVenda: vv ? r2(vv) : null, venda: r2(q * vv) };
  });
  const mc = r2(venda - cmv);
  return { pecas, cmv: r2(cmv), venda: r2(venda), mc, mcPct: venda > 0 ? Math.round((mc / venda) * 1000) / 10 : null, linhas: lin };
}

export async function pedidosDoCliente(clienteId, cliente) {
  await numerarAntigos(clienteId).catch(() => null);
  const sel = { id: true, numero: true, portalNumero: true, portalLiberadoEm: true, status: true, createdAt: true, efetivadoEm: true, dtDespacho: true, oc: true, portalEnviadoPor: true, clienteFinal: true, portalStatus: true, portalEnviadoEm: true, portalObs: true, custosExtras: true, rastreio: true, despachadoEm: true, entregueEm: true, entreguePor: true,
    itens: { select: { descricao: true, gradeJson: true, dadosUnitarios: true, quantidade: true, valorUnitario: true, valorVenda: true, fppId: true, itemPadraoId: true }, orderBy: { id: "asc" } } };
  let pps = await prisma.pp.findMany({ where: { portalClienteId: clienteId, status: { not: "EXCLUIDO" } }, orderBy: { createdAt: "desc" }, take: 300, select: sel });
  const { ppsRecebendoDetalhes } = await import("@/lib/dadosLink");
  const abertos = pps.filter((p) => !p.efetivadoEm && p.portalStatus === "RECEBENDO_DETALHES").map((p) => p.id);
  const rec = abertos.length ? await ppsRecebendoDetalhes(abertos) : {};
  // prazo vencido / links fechados → conclui o recebimento sozinho
  const vencidos = abertos.filter((id) => !rec[id]);
  if (vencidos.length && cliente) {
    for (const id of vencidos) await concluirRecebimento({ id }, cliente).catch((e) => console.log("portal concluir:", e.message));
    pps = await prisma.pp.findMany({ where: { portalClienteId: clienteId, status: { not: "EXCLUIDO" } }, orderBy: { createdAt: "desc" }, take: 300, select: sel });
  }
  const fppIds = [...new Set(pps.flatMap((p) => p.itens.map((i) => i.fppId)).filter(Boolean))];
  const fpps = fppIds.length ? await prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, valorProposto: true, leadTime: true } }) : [];
  const leadDe = Object.fromEntries(fpps.map((f) => [f.id, Number(f.leadTime) || 0]));
  const fppValor = Object.fromEntries(fpps.filter((f) => f.valorProposto != null).map((f) => [f.id, f.valorProposto]));
  const links = await prisma.dadoUnitarioLink.findMany({ where: { ppId: { in: pps.map((p) => p.id) } }, select: { ppId: true, itemIdx: true, limite: true, token: true, aberto: true, id: true } });
  const js = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
  const nums = pps.filter((p) => p.efetivadoEm && p.numero).map((p) => p.numero);   // v1074 — faturado / sem NF vem do pedido de venda
  const nfsAll = pps.length ? await prisma.ppAnexo.findMany({ where: { ppId: { in: pps.map((p) => p.id) }, categoria: "NF_CLIENTE" }, select: { id: true, ppId: true, nome: true, tamanho: true, createdAt: true }, orderBy: { id: "asc" } }) : [];   // v1078
  const pvs = nums.length ? await prisma.pedidoVenda.findMany({ where: { numero: { in: nums } }, select: { numero: true, status: true, semNota: true } }) : [];
  const pvDe = Object.fromEntries(pvs.map((v) => [v.numero, v]));
  return pps.map((p) => {
    const st = statusDe(p, p.numero ? pvDe[p.numero] : null);
    const v = valoresPedido(p.itens, fppValor);
    // v1077 — custos adicionais lançados pela Meridian: entram no CMV e reduzem a MC
    const extras = Array.isArray(p.custosExtras) ? p.custosExtras.filter((x) => x && Number(x.valor)) : [];
    const somaExtras = r2(extras.reduce((a, x) => a + Number(x.valor), 0));
    if (somaExtras) { v.cmvItens = v.cmv; v.cmv = r2(v.cmv + somaExtras); v.mc = r2(v.venda - v.cmv); v.mcPct = v.venda > 0 ? Math.round((v.mc / v.venda) * 1000) / 10 : null; }
    const cf = p.clienteFinal || null;
    const lks = links.filter((l) => l.ppId === p.id);
    return {
      id: p.id, numero: fmtNumPortal(p.portalNumero), numeroMeridian: p.efetivadoEm ? p.numero : null, status: st, situacao: ST_PORTAL[st] || st,
      lancadoEm: p.portalEnviadoEm || p.createdAt, criadoEm: p.createdAt,
      despacho: ["LIBERADO", "EM_PRODUCAO", "FINALIZADO", "DESPACHADO", "ENTREGUE"].includes(st) ? p.dtDespacho : null,
      despachoISO: p.dtDespacho && /^\d{2}\/\d{2}\/\d{4}$/.test(p.dtDespacho) ? p.dtDespacho.split("/").reverse().join("-") : null,
      custosExtras: extras, custosExtrasTotal: somaExtras,
      nfsCliente: nfsAll.filter((a) => a.ppId === p.id).map((a) => ({ id: a.id, nome: a.nome.replace(PREF_NF, ""), tamanho: a.tamanho, em: a.createdAt })),
      rastreio: p.rastreio || null, despachadoEm: p.despachadoEm || null, entregueEm: p.entregueEm || null, entreguePor: p.entreguePor || null,   // v1074   // v714 — só depois de ir para a produção
      liberadoEm: p.portalLiberadoEm || null, leadTime: Math.max(0, ...p.itens.map((i) => (i.fppId && leadDe[i.fppId]) || 0)), oc: p.oc, obs: p.portalObs, enviadoPor: p.portalEnviadoPor,
      cliente: cf ? (cf.tipo === "PJ" ? cf.razaoSocial : cf.nome) || "" : "", clienteFinal: cf,
      editavel: !p.efetivadoEm && p.status === "EM_LANCAMENTO", recebendoDetalhes: st === "RECEBENDO_DETALHES",
      limite: lks.reduce((m, l) => (l.limite && (!m || new Date(l.limite) > new Date(m)) ? l.limite : m), null),
      ...v,
      itens: p.itens.map((it, k) => ({ descricao: it.descricao, pecas: Number(it.quantidade) || 0, grade: js(it.gradeJson).filter((g) => num(g.qtd) > 0), gradeToda: js(it.gradeJson),
        dadosUnitarios: it.dadosUnitarios && it.dadosUnitarios.campos ? it.dadosUnitarios : null, ...v.linhas[k],
        link: (() => { const l = lks.find((x) => x.itemIdx === k); return l ? { id: l.id, token: l.token, limite: l.limite } : null; })() })),
    };
  });
}

// pedido para editar no "Novo pedido" (antes de ir para a produção)
export async function pedidoParaEditar(cliente, ppId) {
  const x = await pedidoDoCliente(cliente, ppId);
  if (x.error) return x;
  const pp = x.pp;
  const catalogo = await itensDoCliente(cliente.id);
  const cat = Object.fromEntries(catalogo.map((i) => [i.id, i]));
  const itens = [];
  for (const it of pp.itens) {
    const padrao = it.itemPadraoId ? cat[it.itemPadraoId] : null;
    if (!padrao) continue;   // item que deixou de ser padrão do cliente
    let grade = []; try { grade = JSON.parse(it.gradeJson || "[]"); } catch {}
    const artes = (Array.isArray(it.anexosJson) ? it.anexosJson : []).filter((a) => String(a.nome || "").startsWith(PREF_ARTE))
      .map((a) => ({ nome: String(a.nome).slice(PREF_ARTE.length), mime: a.mime || null, base64: a.base64 }));
    itens.push({ padrao, grade, artes, dadosUnitarios: it.dadosUnitarios && it.dadosUnitarios.campos ? it.dadosUnitarios : null, valorVenda: it.valorVenda != null ? String(Number(it.valorVenda).toFixed(2)).replace(".", ",") : "" });
  }
  return { ok: true, ppId: pp.id, numero: fmtNumPortal(pp.portalNumero), status: pp.portalStatus, clienteFinal: pp.clienteFinal || null, oc: pp.oc || "", obs: pp.portalObs || "", itens };
}

// v707 — pedido já enviado (ainda não na produção): o cliente ajusta a personalização exclusiva do item e acompanha o link
export async function salvarItemPortal({ cliente }, { ppId, idx, dadosUnitarios, grade }) {
  const x = await pedidoDoCliente(cliente, ppId);
  if (x.error) return x;
  const pp = x.pp;
  const it = pp.itens[Number(idx)];
  if (!it) return { error: "Item não encontrado." };
  const g = limparGrade(grade);
  const q = qtdGrade(g);
  if (!(q > 0)) return { error: "A grade do item não pode ficar vazia." };
  const du = limparDU(dadosUnitarios);
  const vu = Number(it.valorUnitario) || 0;
  await prisma.ppItem.update({ where: { id: it.id }, data: { dadosUnitarios: du || Prisma.DbNull, gradeJson: JSON.stringify(g), quantidade: q, valorTotal: vu ? r2(q * vu) : null } });
  const itens = await prisma.ppItem.findMany({ where: { ppId: pp.id }, select: { valorTotal: true } });
  await prisma.pp.update({ where: { id: pp.id }, data: { valorTotal: r2(itens.reduce((s, y) => s + (Number(y.valorTotal) || 0), 0)) } });
  return { ok: true };
}

// v712 — exclui o pedido enquanto não estiver na produção (em aberto, recebendo detalhes ou liberado); os links param de funcionar
export async function excluirRascunho(cliente, ppId, u) {
  const x = await pedidoDoCliente(cliente, ppId);
  if (x.error) return { error: x.error.replace("para alterar", "para cancelar") };
  const st = x.pp.portalStatus;
  const nPortal = fmtNumPortal(x.pp.portalNumero);
  await prisma.dadoUnitarioLink.deleteMany({ where: { ppId: x.pp.id } }).catch(() => null);
  const nn = (await prisma.pp.findUnique({ where: { id: x.pp.id }, select: { numero: true } }))?.numero;
  if (nn) { const { excluirPpNumerado } = await import("@/lib/pedidoLixeira"); await excluirPpNumerado(x.pp.id, { motivo: "EXCLUÍDO PELO CLIENTE NO PORTAL", quem: "PORTAL" }); }   // v793 — com número, nunca some
  else await prisma.pp.delete({ where: { id: x.pp.id } });
  if (st && st !== "EM_ABERTO") await avisar(u, cliente, -1, `pedido${nPortal ? ` nº ${nPortal}` : ""} ${st === "LIBERADO" ? "liberado para produção" : "em recebimento de detalhes"} foi EXCLUÍDO pelo cliente`).catch(() => null);
  return { ok: true };
}

// para o lado interno: pedidos do portal cujo recebimento de dados venceu viram LIBERADO (com as respostas na lista)
export async function concluirVencidosPortal() {
  const pps = await prisma.pp.findMany({ where: { portalStatus: "RECEBENDO_DETALHES", efetivadoEm: null }, select: { id: true, portalClienteId: true } });
  if (!pps.length) return 0;
  const { ppsRecebendoDetalhes } = await import("@/lib/dadosLink");
  const rec = await ppsRecebendoDetalhes(pps.map((p) => p.id));
  let n = 0;
  for (const p of pps.filter((x) => !rec[x.id])) {
    const cliente = await prisma.cliente.findUnique({ where: { id: p.portalClienteId || 0 } });
    if (cliente) { await concluirRecebimento({ id: p.id }, cliente).catch(() => null); n++; }
  }
  return n;
}
