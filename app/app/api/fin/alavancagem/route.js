export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { garantirContratos, garantirTributosEmBranco, panorama, calcular, parcelaPrice, TIPOS, GRUPOS, ORDEM_GRUPOS, GRUPOS_TRIBUTO, somaMeses } from "@/lib/alavancagem";
import { previaMatriz, contaSugerida, lancarCreditoContratado } from "@/lib/alavancagemMatriz";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const int = (v) => { const x = dec(v); return x === null ? null : Math.round(x); };
const data = (v) => {
  const t = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00.000Z`) : null;
};
const up = (v) => (v ? String(v).toUpperCase().trim() : null);

// GET ?u= → panorama completo + catálogos
export async function GET(req) {
  const u = await usuarioGerencial(new URL(req.url).searchParams.get("u"));
  if (!u) return negadoGerencial();
  await garantirContratos();
  await garantirTributosEmBranco();
  const [p, previa] = await Promise.all([panorama(), previaMatriz().catch(() => [])]);
  return Response.json({
    ...p, previaMatriz: previa,
    catalogos: { tipos: TIPOS, grupos: GRUPOS, ordemGrupos: ORDEM_GRUPOS, gruposTributo: GRUPOS_TRIBUTO },
  });
}

// POST { usuarioId, contrato:{...}, lancarCredito? } → novo contrato (o sistema completa o resto)
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  const c = b.contrato || {};

  const tipo = up(c.tipo) || "PARCELADO";
  if (!TIPOS[tipo]) return Response.json({ error: "Tipo de contrato inválido." }, { status: 400 });
  const nome = up(c.nome);
  if (!nome) return Response.json({ error: "Dê um nome ao contrato." }, { status: 400 });
  const capital = dec(c.capital);
  if (!capital || capital <= 0) return Response.json({ error: "Informe o capital contratado." }, { status: 400 });
  const taxaMensal = dec(c.taxaMensal);
  const dataContrato = data(c.dataContrato);

  const dados = {
    tipo, nome, capital, taxaMensal, dataContrato,
    credor: up(c.credor), observacao: up(c.observacao),
    grupo: up(c.grupo) || (tipo === "MUTUO" ? "MUTUO_GIRO" : tipo === "INVESTIMENTO" ? "INVESTIMENTO" : "GIRO_LP"),
    criadoPorNome: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase(),
  };

  if (tipo === "MUTUO") {
    // capital no vencimento; o prazo pode vir em dias ou pela data de pagamento
    let venc = data(c.vencimentoUnico);
    let prazoDias = int(c.prazoDias);
    if (!venc && prazoDias && dataContrato) venc = new Date(dataContrato.getTime() + prazoDias * 86400000);
    if (venc && dataContrato && !prazoDias) prazoDias = Math.round((venc - dataContrato) / 86400000);
    if (!venc) return Response.json({ error: "Informe a data de pagamento ou o prazo em dias." }, { status: 400 });
    Object.assign(dados, { vencimentoUnico: venc, prazoDias });
  } else {
    const prazoMeses = int(c.prazoMeses);
    if (!prazoMeses || prazoMeses < 1) return Response.json({ error: "Informe o prazo em meses." }, { status: 400 });
    const entrada = dec(c.entrada);
    const inicio = data(c.inicioPagamento) || (dataContrato ? somaMeses(dataContrato, 1) : null);
    if (!inicio) return Response.json({ error: "Informe a data da 1ª parcela." }, { status: 400 });
    // parcela informada manda; senão o sistema calcula pela Tabela Price
    const parcela = dec(c.parcela) || parcelaPrice(capital - (entrada || 0), taxaMensal || 0, prazoMeses);
    Object.assign(dados, { prazoMeses, entrada, inicioPagamento: inicio, parcela });
  }
  dados.contaCaixa = up(c.contaCaixa) || contaSugerida(dados);

  const novo = await prisma.finContrato.create({ data: dados });
  let credito = null;
  if (b.lancarCredito) credito = await lancarCreditoContratado(novo, dados.criadoPorNome);

  return Response.json({ ok: true, contrato: { ...novo, calculo: calcular(novo) }, credito: credito ? { id: credito.id } : null });
}

// PUT { usuarioId, id, campos:{...} } → corrige um contrato
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  const id = Number(b.id);
  if (!id) return Response.json({ error: "Contrato não informado." }, { status: 400 });

  const c = b.campos || {};
  const d = {};
  for (const k of ["capital", "entrada", "taxaMensal", "parcela", "debitoTotalInformado", "aVencerInformado", "valorAPagarInformado", "jurosTotaisInformado", "jurosMesInformado"]) if (k in c) d[k] = dec(c[k]);
  for (const k of ["prazoMeses", "prazoDias", "parcelasPagas", "parcelasPagasInformadas"]) if (k in c) d[k] = int(c[k]);
  for (const k of ["dataContrato", "inicioPagamento", "vencimentoUnico", "pagarAteInformado"]) if (k in c) d[k] = data(c[k]);
  for (const k of ["nome", "credor", "observacao", "grupo", "contaCaixa"]) if (k in c) d[k] = up(c[k]);
  for (const k of ["ativo", "quitado"]) if (k in c) d[k] = !!c[k];

  const novo = await prisma.finContrato.update({ where: { id }, data: d }).catch(() => null);
  if (!novo) return Response.json({ error: "Contrato não encontrado." }, { status: 404 });
  return Response.json({ ok: true, contrato: { ...novo, calculo: calcular(novo) } });
}

// DELETE ?u=&id=
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  await prisma.finContrato.delete({ where: { id: Number(sp.get("id")) } }).catch(() => null);
  return Response.json({ ok: true });
}
