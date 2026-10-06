export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { tituloOut, validarRateio, nomeU, r2, so, dataUTC, mesDe } from "@/lib/finTitulos";
import { excluirTitulo } from "@/lib/finLote";

// PATCH { usuarioId, acao, ... }
//  acao "editar"    → campos do título (valor de recorrência editado = conferido)
//  acao "baixar"    → { dataPagamento, valorPago }
//  acao "estornar"  → volta para ABERTO
//  acao "confirmar" → { valor, aplicarFuturos } confere o valor do mês da recorrência
//  acao "cancelar" / "reabrir"
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const id = Number(params.id);
  const t = await prisma.finTitulo.findUnique({ where: { id } });
  if (!t) return Response.json({ error: "Título não encontrado." }, { status: 404 });
  const quem = { atualizadoPorNome: nomeU(u) };
  let data = {};

  if (b.acao === "baixar") {
    const vp = r2(b.valorPago ?? t.valor);
    if (!b.dataPagamento) return Response.json({ error: "Informe a data do pagamento." }, { status: 400 });
    data = { status: "PAGO", dataPagamento: dataUTC(b.dataPagamento), valorPago: vp, previsao: false, valorConfirmado: true };
  } else if (b.acao === "estornar") {
    data = { status: "ABERTO", dataPagamento: null, valorPago: null };
  } else if (b.acao === "cancelar") {
    data = { status: "CANCELADO" };
  } else if (b.acao === "reabrir") {
    data = { status: "ABERTO" };
  } else if (b.acao === "confirmar") {
    const v = r2(b.valor ?? t.valor);
    if (!(v >= 0)) return Response.json({ error: "Valor inválido." }, { status: 400 });
    data = { valor: v, valorConfirmado: true };
    if (b.aplicarFuturos && t.recorrenciaId) {
      await prisma.finTitulo.updateMany({ where: { recorrenciaId: t.recorrenciaId, competencia: { gt: t.competencia }, valorConfirmado: false, status: "ABERTO" }, data: { valor: v } });
      await prisma.finRecorrencia.update({ where: { id: t.recorrenciaId }, data: { valor: v } });
    }
  } else {
    // editar
    if (b.titulo !== undefined) data.titulo = String(b.titulo).trim().toUpperCase();
    if (b.parceiro !== undefined) data.parceiro = String(b.parceiro).trim().toUpperCase();
    if (b.documento !== undefined) data.documento = so(b.documento) || null;
    if (b.numeroDoc !== undefined) data.numeroDoc = b.numeroDoc || null;
    if (b.observacao !== undefined) data.observacao = b.observacao || null;
    if (b.previsao !== undefined) data.previsao = !!b.previsao;
    if (b.critica !== undefined) data.critica = b.critica ? String(b.critica).slice(0, 500) : null;
    if (b.valor !== undefined) {
      const v = r2(b.valor);
      if (!(v >= 0) || (v === 0 && !t.recorrenciaId)) return Response.json({ error: "Valor inválido." }, { status: 400 });
      data.valor = v;
      if (t.recorrenciaId) data.valorConfirmado = true;
    }
    if (b.vencimento && !t.vencimentoOriginal) { data.vencimento = dataUTC(b.vencimento); data.competencia = mesDe(b.vencimento); }
    // REPROGRAMADO: o vencimento passa a ser a data nova; o original e cada mudança ficam no histórico.
    // Recorrência mantém a competência (o mês da parcela); as demais contas vão para o mês da data nova.
    if (b.reprogramado !== undefined) {
      const atual = (data.vencimento || t.vencimento).toISOString().slice(0, 10);
      const hist = Array.isArray(t.reprogramacoes) ? [...t.reprogramacoes] : [];
      const por = quem.atualizadoPorNome || null, em = new Date().toISOString();
      if (b.reprogramado && /^\d{4}-\d{2}-\d{2}$/.test(b.reprogramado) && b.reprogramado !== atual) {
        if (!t.vencimentoOriginal) data.vencimentoOriginal = dataUTC(atual);
        data.vencimento = dataUTC(b.reprogramado);
        if (!t.recorrenciaId) data.competencia = mesDe(b.reprogramado);
        hist.push({ de: atual, para: b.reprogramado, em, por });
        data.reprogramacoes = hist;
      } else if (!b.reprogramado && t.vencimentoOriginal) {   // desfaz: volta ao vencimento original
        const orig = t.vencimentoOriginal.toISOString().slice(0, 10);
        data.vencimento = t.vencimentoOriginal; data.vencimentoOriginal = null;
        if (!t.recorrenciaId) data.competencia = mesDe(orig);
        hist.push({ de: atual, para: orig, em, por, desfeito: true });
        data.reprogramacoes = hist;
      }
    }
    if (b.rateio !== undefined) {
      const rt = validarRateio(b.rateio);
      if (rt.erro) return Response.json({ error: rt.erro }, { status: 400 });
      data.rateio = rt.rateio;
    }
    if (data.competencia && t.recorrenciaId && data.competencia !== t.competencia) {
      const choque = await prisma.finTitulo.findFirst({ where: { recorrenciaId: t.recorrenciaId, competencia: data.competencia, id: { not: id } } });
      if (choque) return Response.json({ error: "Já existe uma parcela desta recorrência nesse mês." }, { status: 400 });
    }
  }
  const n = await prisma.finTitulo.update({ where: { id }, data: { ...data, ...quem } });
  // INSS/FGTS: o último valor lançado vira o valor da recorrência (e dos meses seguintes)
  if (data.valor !== undefined || b.acao === "baixar") { const { registrarValorGuia } = await import("@/lib/finGuias"); await registrarValorGuia(id, quem.atualizadoPorNome).catch(() => null); }
  return Response.json(tituloOut(n));
}

// DELETE { usuarioId } → exclui o título (de recorrência: o mês não é recriado — vira cancelado)
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(params.id) } });
  if (!t) return Response.json({ ok: true });
  await excluirTitulo(t, nomeU(u));
  return Response.json({ ok: true });
}
