// v699 — Portal do cliente (ex.: Loja Way): o cliente lança pedidos só com os itens padrão cadastrados para ele
// (escolhe o item, informa a grade, anexa as artes e, se quiser, os dados unitários) e vê só os pedidos dele.
// O pedido entra como rascunho no Lançar pedido (status EM_LANCAMENTO) para o comercial conferir e efetivar.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { usuarioAtivoFin } from "@/lib/fin";
import { listarItensPadrao } from "@/lib/itensPadrao";
import { salvarPp } from "@/lib/pedidoEfetivar";
import { paramFora, qtdGrade, num, hojeISO } from "@/lib/pedidoLanc";
import { limparDU, temDU, conferirComGrade } from "@/lib/dadosUnitarios";
import { validarClienteFinal, enderecoTxt } from "@/lib/clienteFinal";

export const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
export const negadoPortal = () => Response.json({ error: "Acesso restrito ao portal do cliente." }, { status: 403 });

export async function usuarioPortal(req) {
  let id = req.headers.get("x-usuario-id");
  if (!id) { try { id = new URL(req.url).searchParams.get("_u"); } catch {} }
  const u = await usuarioAtivoFin(id);
  if (!u || u.setor !== "CLIENTE" || !u.portalClienteId) return null;
  const cliente = await prisma.cliente.findUnique({ where: { id: u.portalClienteId } });
  return cliente ? { u, cliente } : null;
}

export const nomeCliente = (c) => String(c?.nomeFantasia || c?.razaoSocial || "").toUpperCase();

// itens padrão do cliente (sem preço)
export async function itensDoCliente(clienteId) {
  const l = await listarItensPadrao({ cliente: clienteId });
  const fotos = l.length ? await prisma.itemPadrao.findMany({ where: { id: { in: l.map((i) => i.id) } }, select: { id: true, fotoBase64: true } }) : [];
  const foto = Object.fromEntries(fotos.map((f) => [f.id, f.fotoBase64]));
  // v702 — lead time da FPP do item: entrega prevista ao inserir no pedido
  const fppIds = [...new Set(l.map((i) => i.fppId).filter(Boolean))];
  const lts = fppIds.length ? await prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, leadTime: true } }) : [];
  const lt = Object.fromEntries(lts.map((f) => [f.id, Number(f.leadTime) > 0 ? Number(f.leadTime) : null]));
  return l.map((i) => ({ id: i.id, codigo: i.codigoPadrao || i.codigo || null, nome: i.nomeInterno, nomeNf: i.nomeNf, tipoPeca: i.tipoPecaNome || null, foto: foto[i.id] || null, leadTime: i.fppId ? lt[i.fppId] || null : null }));
}

const dataUrl = (b64, mime) => (/^data:/.test(String(b64)) ? b64 : `data:${mime || "application/octet-stream"};base64,${b64}`);
const LIM_ARTE = 15 * 1024 * 1024;

// monta o pedido (formato do editor) e grava como rascunho
export async function enviarPedido({ u, cliente }, b) {
  const pedidos = Array.isArray(b?.itens) ? b.itens : [];
  if (!pedidos.length) return { error: "Escolha ao menos um item." };
  const vcf = validarClienteFinal(b.clienteFinal);   // v709 — dados do cliente e envio
  if (vcf.erros) return { error: `Dados do cliente e envio — preencha: ${vcf.erros.join(" ")}` };
  const cf = vcf.dados;
  const catalogo = await itensDoCliente(cliente.id);
  const permitidos = new Set(catalogo.map((i) => i.id));
  const leadMax = Math.max(0, ...pedidos.map((p) => catalogo.find((c) => c.id === Number(p.itemPadraoId))?.leadTime || 0));
  const itens = [];
  for (const [k, p] of pedidos.entries()) {
    const id = Number(p.itemPadraoId);
    if (!permitidos.has(id)) return { error: `Item ${k + 1}: item não disponível para este cliente.` };
    const d = await prisma.itemPadrao.findUnique({ where: { id }, include: { anexos: true } });
    const grade = (Array.isArray(p.grade) ? p.grade : []).map((g) => ({ tam: String(g.tam || "").slice(0, 12), qtd: String(Math.max(0, Math.round(num(g.qtd))) || "") })).filter((g) => g.tam);
    if (!(qtdGrade(grade) > 0)) return { error: `Item ${k + 1} (${d.nomeInterno}): informe a grade.` };
    const du = limparDU(p.dadosUnitarios);
    if (temDU(du) && du.linhas.length) {   // v707 — sem lista: será preenchida pelo link (pedido em "recebendo detalhes")
      const cf = conferirComGrade(du, grade);
      if (!cf.ok) return { error: `Item ${k + 1}: a lista de dados unitários não bate com a grade (${Object.entries(cf.dif).map(([t, x]) => `${t} ${x > 0 ? "+" : ""}${x}`).join(", ")}).` };
    }
    const artes = (Array.isArray(p.artes) ? p.artes : []).filter((a) => a && a.base64).slice(0, 20);
    for (const a of artes) if (String(a.base64).length * 0.75 > LIM_ARTE) return { error: `${a.nome}: arquivo maior que 15 MB.` };
    const anexos = [
      ...artes.map((a) => ({ nome: `Arte do cliente · ${String(a.nome || "arte").slice(0, 150)}`, mime: a.mime || null, base64: dataUrl(a.base64, a.mime) })),
      ...d.anexos.map((a) => ({ nome: `${a.tipo === "MEDIDAS" ? "Tabela de medidas" : "Layout"} · ${a.nome}`, mime: a.mime || null, base64: dataUrl(a.base64, a.mime) })),
    ];
    itens.push({
      tipoPecaNome: d.tipoPecaNome || "", codigo: d.codigo || "", descricao: d.nomeNf || d.nomeInterno, itemPadraoId: d.id,
      valorUnitario: d.precoAtual != null ? String(Number(d.precoAtual).toFixed(2)).replace(".", ",") : "",
      grade, parametros: Object.fromEntries(Object.entries(d.parametros || {}).filter(([kk, v]) => v && !paramFora(kk) && kk !== "TECIDO")),
      fotoBase64: d.fotoBase64 || "", fppId: d.fppId || null, fppNumero: d.fppNumero ?? null,
      anexos, dadosUnitarios: du,
    });
  }
  const quem = nomeU(u);
  const end = [cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro, cliente.municipio && `${cliente.municipio}${cliente.uf ? "/" + cliente.uf : ""}`, cliente.cep].filter(Boolean).join(", ");
  const obsCli = String(b.obs || "").trim().slice(0, 2000);
  const payload = {
    emissao: hojeISO(), clienteNome: cliente.razaoSocial || cliente.nomeFantasia, clienteCnpj: cliente.cnpj || "", clienteIe: cliente.inscricaoEstadual || "",
    clienteEndereco: end, clienteContato: [cliente.preposto, cliente.telefones, cliente.emailNf].filter(Boolean).join(" · "),
    oc: String(b.oc || "").trim().slice(0, 60), vendedor: "",
    obs: [`PEDIDO ENVIADO PELO PORTAL DO CLIENTE (${nomeCliente(cliente)}) POR ${quem}`,
      `CLIENTE FINAL: ${cf.tipo === "PJ" ? `${cf.razaoSocial} (${cf.cnpj})` : `${cf.nome} (${cf.cpf})`} · ENTREGA: ${enderecoTxt(cf)} · ${cf.whatsapp}`,
      obsCli && `OBS DO CLIENTE: ${obsCli}`].filter(Boolean).join(" · "),
    entregaModo: "UNICA", entregas: [], pagamento: null, itens,
    ...(leadMax > 0 ? { prazoDias: leadMax, prazoTipo: "CORRIDOS" } : {}),   // v702 — entrega pelo maior lead time dos itens
  };
  const id = await salvarPp(null, payload, quem);
  await prisma.pp.update({ where: { id }, data: { portalClienteId: cliente.id, portalEnviadoPor: quem, clienteFinal: cf } });
  // avisa o comercial e a gestão
  const para = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { diretoria: true }, { setor: "COMERCIAL" }] }, select: { id: true } }).catch(() => []);
  const pecas = itens.reduce((s, it) => s + qtdGrade(it.grade), 0);
  if (para.length) await prisma.mensagem.createMany({ data: para.filter((x) => x.id !== u.id).map((x) => ({ deId: u.id, paraId: x.id,
    texto: `🛒 NOVO PEDIDO DO PORTAL — ${nomeCliente(cliente)}: ${itens.length} item(ns), ${pecas} peça(s)${itens.some((i) => i.dadosUnitarios) ? " · com dados unitários" : ""}. Confira e efetive em Pedidos › Lançar pedido.` })) }).catch(() => null);
  return { ok: true, id, pecas };
}

const ST_PORTAL = { EM_LANCAMENTO: "Recebido — em conferência", LANCADO: "Confirmado — em produção", FATURADO: "Faturado", CANCELADO: "Cancelado" };
export async function pedidosDoCliente(clienteId) {
  const pps = await prisma.pp.findMany({ where: { portalClienteId: clienteId, status: { not: "EXCLUIDO" } }, orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, numero: true, status: true, createdAt: true, efetivadoEm: true, dtDespacho: true, oc: true, portalEnviadoPor: true, clienteFinal: true,
      itens: { select: { descricao: true, gradeJson: true, dadosUnitarios: true, quantidade: true }, orderBy: { id: "asc" } } } });
  const js = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
  const { ppsRecebendoDetalhes } = await import("@/lib/dadosLink");   // v707
  const rec = await ppsRecebendoDetalhes(pps.filter((p) => !p.efetivadoEm).map((p) => p.id));
  return pps.map((p) => ({
    id: p.id, numero: p.efetivadoEm ? p.numero : null, situacao: !p.efetivadoEm && rec[p.id] ? "Recebendo detalhes" : ST_PORTAL[p.status] || p.status, status: p.status,
    recebendoDetalhes: !p.efetivadoEm && !!rec[p.id], editavel: !p.efetivadoEm && p.status === "EM_LANCAMENTO", clienteFinal: p.clienteFinal || null, enviadoEm: p.createdAt, despacho: p.dtDespacho, oc: p.oc, enviadoPor: p.portalEnviadoPor,
    itens: p.itens.map((it) => ({ descricao: it.descricao, pecas: Number(it.quantidade) || 0, grade: js(it.gradeJson).filter((g) => num(g.qtd) > 0), gradeToda: js(it.gradeJson),
      dadosUnitarios: it.dadosUnitarios && it.dadosUnitarios.linhas ? it.dadosUnitarios : null })),
  }));
}

// v707 — pedido já enviado (ainda não na produção): o cliente ajusta os dados unitários do item e gera/acompanha o link
export async function salvarItemPortal({ cliente }, { ppId, idx, dadosUnitarios, grade }) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp || pp.portalClienteId !== cliente.id) return { error: "Pedido não encontrado." };
  if (pp.efetivadoEm || pp.status !== "EM_LANCAMENTO") return { error: "Este pedido já foi confirmado pela nossa equipe: fale com seu vendedor para alterar." };
  const it = pp.itens[Number(idx)];
  if (!it) return { error: "Item não encontrado." };
  const g = (Array.isArray(grade) ? grade : []).map((x) => ({ tam: String(x.tam || "").slice(0, 12), qtd: String(Math.max(0, Math.round(num(x.qtd))) || "") })).filter((x) => x.tam);
  const q = qtdGrade(g);
  if (!(q > 0)) return { error: "A grade do item não pode ficar vazia." };
  const du = limparDU(dadosUnitarios);
  const vu = Number(it.valorUnitario) || 0;
  await prisma.ppItem.update({ where: { id: it.id }, data: { dadosUnitarios: du || Prisma.DbNull, gradeJson: JSON.stringify(g), quantidade: q, valorTotal: vu ? Math.round(q * vu * 100) / 100 : null } });
  const itens = await prisma.ppItem.findMany({ where: { ppId: pp.id }, select: { valorTotal: true } });
  await prisma.pp.update({ where: { id: pp.id }, data: { valorTotal: Math.round(itens.reduce((s, x) => s + (Number(x.valorTotal) || 0), 0) * 100) / 100 } });
  return { ok: true };
}
