export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { usuarioMaster, negado } from "@/lib/fin";
import { tituloOut, validarRateio, nomeU, r2, so, dataUTC, mesDe } from "@/lib/finTitulos";
import { excluirTitulo } from "@/lib/finLote";

// v823 — GET ?u= → uma conta (abrir pela conferência com o banco)
export async function GET(req, { params }) {
  const sp0 = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp0.get("u")))) return negado();
  if (sp0.get("origem")) return Response.json(await (await import("@/lib/finOrigem")).origemDoTitulo(params.id, sp0.get("u")));   // v828
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(params.id) } });
  return t ? Response.json(tituloOut(t)) : Response.json({ error: "Conta não encontrada." }, { status: 404 });
}

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

  // v186 — título antecipado: "baixar" = cliente pagou (liquida); "estornar" = desfaz a liquidação ou a antecipação
  const ant = t.tipo === "RECEBER" && t.status === "PAGO" && (t.antecipadoForma || t.cobranca === "DESCONTADO");
  if (ant && ["baixar", "liquidar", "estornar", "desliquidar"].includes(b.acao)) {
    const A = await import("@/lib/finAntecipados");
    try {
      if (b.acao === "baixar" || b.acao === "liquidar") await A.liquidar(id, b.dataPagamento || b.data, nomeU(u));
      else if (t.liquidadoEm) await A.desfazerLiquidacao(id);
      else await A.desfazerAntecipacao(id, nomeU(u));
    } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    return Response.json(tituloOut(await prisma.finTitulo.findUnique({ where: { id } })));
  }
  // v189 — observações (OBS): acrescenta / apaga uma nota visível na lista
  if (b.acao === "nota" || b.acao === "nota-excluir") {
    const notas = Array.isArray(t.notas) ? [...t.notas] : [];
    if (b.acao === "nota") {
      const texto = String(b.texto || "").trim();
      if (!texto) return Response.json({ error: "Escreva a observação." }, { status: 400 });
      notas.push({ texto: texto.slice(0, 1000), por: nomeU(u), em: new Date().toISOString() });
    } else notas.splice(Number(b.indice), 1);
    const n = await prisma.finTitulo.update({ where: { id }, data: { notas, ...quem } });
    return Response.json(tituloOut(n));
  }
  // v830 — conta da NORT já paga: corrigir quem pagou (Meridian = empréstimo à NORT · NORT = só baixa)
  if (b.acao === "pagoPor") {
    if (!["MERIDIAN", "NORT"].includes(b.pagoPor)) return Response.json({ error: "Escolha Meridian ou NORT." }, { status: 400 });
    const n2 = await prisma.finTitulo.update({ where: { id }, data: { pagoPor: b.pagoPor, ...quem } });
    return Response.json(tituloOut(n2));
  }
  // v1065 — protesto (conta a pagar vencida): cartório, data máxima de pagamento e valor total a pagar.
  //   Valor da conta = total; rateio = conta original proporcional ao principal + TAXAS DE PROTESTO (2134100) com as taxas.
  //   "sustar" volta valor, rateio e vencimento de antes.
  if (b.acao === "protesto") {
    if (t.tipo !== "PAGAR") return Response.json({ error: "Protesto é só para contas a pagar." }, { status: 400 });
    if (t.status !== "ABERTO") return Response.json({ error: "Só conta em aberto." }, { status: 400 });
    const ant = t.protesto && typeof t.protesto === "object" ? t.protesto : null;
    const notas = Array.isArray(t.notas) ? [...t.notas] : [];
    const em = new Date().toISOString(), por = nomeU(u);
    const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (b.sustar) {
      if (!ant) return Response.json({ error: "A conta não está protestada." }, { status: 400 });
      const hist = Array.isArray(t.reprogramacoes) ? [...t.reprogramacoes] : [];
      const dVolta = ant.vencAntes ? dataUTC(ant.vencAntes) : t.vencimento;
      if (ant.vencAntes && ant.vencAntes !== t.vencimento.toISOString().slice(0, 10)) hist.push({ de: t.vencimento.toISOString().slice(0, 10), para: ant.vencAntes, em, por, desfeito: true });
      notas.push({ texto: `PROTESTO SUSTADO/RETIRADO (${ant.cartorio}º Tabelionato). Valor volta a ${brl(ant.principal)}.`, por, em });
      const n = await prisma.finTitulo.update({ where: { id }, data: { protesto: Prisma.DbNull, valor: ant.principal, rateio: ant.rateioOrig || t.rateio, vencimento: dVolta,
        ...(t.recorrenciaId ? {} : { competencia: mesDe(dVolta.toISOString().slice(0, 10)) }), ...(ant.vencOrigAntes === null ? { vencimentoOriginal: null } : {}), reprogramacoes: hist, notas, ...quem } });
      return Response.json(tituloOut(n));
    }
    const cart = Number(b.cartorio);
    if (![1, 2, 3, 4].includes(cart)) return Response.json({ error: "Escolha o tabelionato (1º a 4º)." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.prazo || ""))) return Response.json({ error: "Informe a data máxima de pagamento." }, { status: 400 });
    const principal = r2(ant ? ant.principal : Number(t.valor));
    const total = r2(Number(String(b.total ?? "").replace(/\./g, "").replace(",", ".")) || Number(b.total) || 0);
    if (!(total > 0)) return Response.json({ error: "Informe o valor total a pagar no cartório." }, { status: 400 });
    if (total + 0.001 < principal) return Response.json({ error: `O total (${brl(total)}) é menor que o valor da conta (${brl(principal)}).` }, { status: 400 });
    const taxas = r2(total - principal);
    const conta = await prisma.finConta.findUnique({ where: { codigo: "2134100" } }) || await prisma.finConta.create({ data: { codigo: "2134100", nome: "TAXAS DE PROTESTO" } });
    const rateioOrig = ant?.rateioOrig || (Array.isArray(t.rateio) ? t.rateio : []);
    const base = rateioOrig.filter((x) => Number(x.contaId) !== conta.id);
    const somaBase = base.reduce((s0, x) => s0 + Number(x.pct || 0), 0) || 100;
    const r6 = (v) => Math.round(v * 1e6) / 1e6;   // % com 6 casas: principal e taxas fecham no centavo
    let rateio = base.map((x) => ({ contaId: Number(x.contaId), pct: r6((Number(x.pct) / somaBase) * (principal / total) * 100) }));
    if (taxas > 0) rateio.push({ contaId: conta.id, pct: r6((taxas / total) * 100) });
    rateio = rateio.filter((x) => x.pct > 0);
    const dif = r6(100 - rateio.reduce((s0, x) => s0 + x.pct, 0));
    if (rateio.length && dif) rateio[0].pct = r6(rateio[0].pct + dif);   // arredondamento fecha em 100%
    const vAtual = t.vencimento.toISOString().slice(0, 10);
    const hist = Array.isArray(t.reprogramacoes) ? [...t.reprogramacoes] : [];
    if (b.prazo !== vAtual) hist.push({ de: vAtual, para: b.prazo, em, por, motivo: "protesto" });
    const protesto = { cartorio: cart, prazo: b.prazo, total, principal, taxas, rateioOrig, em, por,
      vencAntes: ant ? ant.vencAntes : vAtual, vencOrigAntes: ant ? ant.vencOrigAntes : (t.vencimentoOriginal ? t.vencimentoOriginal.toISOString().slice(0, 10) : null) };
    notas.push({ texto: `PROTESTADO no ${cart}º Tabelionato de Protesto de Títulos de BH · pagar até ${b.prazo.split("-").reverse().join("/")} · total ${brl(total)} (principal ${brl(principal)} + taxas ${brl(taxas)}).`, por, em });
    const n = await prisma.finTitulo.update({ where: { id }, data: { protesto, valor: total, rateio, vencimento: dataUTC(b.prazo),
      ...(t.recorrenciaId ? {} : { competencia: mesDe(b.prazo) }), ...(t.vencimentoOriginal ? {} : { vencimentoOriginal: t.vencimento }), reprogramacoes: hist, notas, ...quem } });
    return Response.json(tituloOut(n));
  }
  if (b.acao === "baixar") {
    const vp = r2(b.valorPago ?? t.valor);
    if (!b.dataPagamento) return Response.json({ error: "Informe a data do pagamento." }, { status: 400 });
    data = { status: "PAGO", dataPagamento: dataUTC(b.dataPagamento), valorPago: vp, previsao: false, valorConfirmado: true,
      ...(["MERIDIAN", "NORT"].includes(b.pagoPor) ? { pagoPor: b.pagoPor } : {}) };   // v829
  } else if (b.acao === "estornar") {
    // v203 — "Excluir pagamento": a conta volta a ficar em aberto e o que veio com a baixa sai
    if (t.status !== "PAGO") return Response.json({ error: "Esta conta não está paga." }, { status: 400 });
    const br = (d) => d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "—";
    const nota = `PAGAMENTO EXCLUÍDO EM ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} POR ${quem.atualizadoPorNome || "—"} (ERA ${br(t.dataPagamento)} · R$ ${Number(t.valorPago ?? t.valor).toFixed(2).replace(".", ",")})`;
    const obs = String(t.observacao || "").split(" · ").filter((x) => !/^BAIXA (PELO EXTRATO|POR COMPROVANTE)\b/.test(x) && !/^CONTA [\d.,]+ .*= PAGO /.test(x));
    data = { status: "ABERTO", dataPagamento: null, valorPago: null, lancamentoId: null, pagoPor: null, observacao: [...obs, nota].filter(Boolean).join(" · ").slice(0, 4000) };
    // comprovante anexado pela baixa: sai, para poder ser usado de novo
    await prisma.finTituloAnexo.deleteMany({ where: { tituloId: id, nome: { startsWith: "COMPROVANTE " } } }).catch(() => null);
    // conta da semana: os itens voltam a ficar em aberto
    await prisma.finSemanaItem.updateMany({ where: { tituloId: id, pago: true }, data: { pago: false, dataPagamento: null, lancamentoId: null } }).catch(() => null);
  } else if (b.acao === "cancelar") {
    data = { status: "CANCELADO" };
  } else if (b.acao === "reabrir") {
    data = { status: "ABERTO" };
  } else if (b.acao === "confirmar") {
    const v = r2(b.valor ?? t.valor);
    if (!(v >= 0)) return Response.json({ error: "Valor inválido." }, { status: 400 });
    data = { valor: v, valorConfirmado: true };
    b.aplicarFuturos = false;   // v211 — regra: o contas a pagar não mexe na Matriz nem nas Recorrentes (ajuste só desta conta)
    // v192 — conta da Matriz: "aplicar aos próximos" grava na Matriz (custo único) e o espelho leva aos meses seguintes
    const rec0 = b.aplicarFuturos && t.recorrenciaId ? await prisma.finRecorrencia.findUnique({ where: { id: t.recorrenciaId }, select: { chaveOrigem: true } }) : null;
    if (rec0 && /^(MATRIZ|NORT)\|/.test(String(rec0.chaveOrigem || ""))) {
      const { alterarItemMatriz } = await import("@/lib/finRecorrentes");
      const res = await alterarItemMatriz(rec0.chaveOrigem, { valor: v }, nomeU(u));
      if (!res.ok) return Response.json({ error: res.erro }, { status: 400 });
      b.aplicarFuturos = false;
    }
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
    if (b.chavePix !== undefined) data.chavePix = String(b.chavePix || "").trim() || null;   // v521
    if (data.chavePix && t.tipo === "PAGAR") { const { lembrarPix } = await import("@/lib/finPix"); await lembrarPix(data.parceiro || t.parceiro, b.documento ?? t.documento, data.chavePix); }   // v698
    if (b.formaPagamento !== undefined) data.formaPagamento = b.formaPagamento ? String(b.formaPagamento).toUpperCase() : null;
    if (b.previsao !== undefined) data.previsao = !!b.previsao;
    if (b.critica !== undefined) data.critica = b.critica ? String(b.critica).slice(0, 500) : null;
    if (b.valor !== undefined) {
      const v = r2(b.valor);
      if (!(v >= 0) || (v === 0 && !t.recorrenciaId)) return Response.json({ error: "Valor inválido." }, { status: 400 });
      data.valor = v;
      if (t.recorrenciaId) data.valorConfirmado = true;
      // v543 — parcela de nota: as demais em aberto são refeitas para a soma continuar igual ao valor da nota
      if (Math.abs(v - Number(t.valor)) > 0.009 && !t.recorrenciaId && t.status === "ABERTO") {
        const P = await import("@/lib/finParcelas");
        const rb = await P.rebalancear(t, v, quem.atualizadoPorNome);
        if (rb.erro) return Response.json({ error: rb.erro }, { status: 400 });
        const fmt = (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
        data.alteracoes = P.registro({ alteracoes: data.alteracoes ?? t.alteracoes }, "valor", `Valor alterado de ${fmt(t.valor)} para ${fmt(v)} por ${quem.atualizadoPorNome || "—"} em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}${rb.ajustes?.length ? ` · parcela(s) ${rb.ajustes.map((a) => `${a.parcela} ${fmt(a.de)}→${fmt(a.para)}`).join(", ")} ajustada(s) para a soma ficar em ${fmt(rb.total)}` : ""}.`, quem.atualizadoPorNome, true);
      }
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
    // v543 — vencimento alterado: "i" amarelo na data
    const vNovo = data.vencimento ? data.vencimento.toISOString().slice(0, 10) : null, vAnt = t.vencimento.toISOString().slice(0, 10);
    if (vNovo && vNovo !== vAnt) {
      const P = await import("@/lib/finParcelas");
      data.alteracoes = P.registro({ alteracoes: data.alteracoes ?? t.alteracoes }, "vencimento", `Vencimento alterado de ${vAnt.split("-").reverse().join("/")} para ${vNovo.split("-").reverse().join("/")} por ${quem.atualizadoPorNome || "—"} em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`, quem.atualizadoPorNome, true);
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
  // v192 — mexeu numa conta de recorrência pelo contas a pagar: ajuste pontual (a Matriz não sobrescreve este mês)
  if (t.recorrenciaId && (b.acao === "editar" || b.acao === undefined || (b.acao === "confirmar" && data.valor !== undefined && Math.abs(Number(data.valor) - Number(t.valor)) > 0.009))
      && ["titulo", "parceiro", "valor", "vencimento", "rateio", "documento", "numeroDoc"].some((k) => data[k] !== undefined && JSON.stringify(data[k]) !== JSON.stringify(t[k]))) data.pontual = true;
  const n = await prisma.finTitulo.update({ where: { id }, data: { ...data, ...quem } });
  // INSS/FGTS: o último valor lançado vira o valor da recorrência (e dos meses seguintes)
  if (data.valor !== undefined || b.acao === "baixar") { const { registrarValorGuia } = await import("@/lib/finGuias"); await registrarValorGuia(id, quem.atualizadoPorNome).catch(() => null); }
  // v186 — cobrança de antecipação: pagar/estornar baixa/volta o título original
  if (String(t.chaveImport || "").startsWith("RECOMPRA|")) { const { sincronizarAntecipados } = await import("@/lib/finAntecipados"); await sincronizarAntecipados(quem.atualizadoPorNome).catch(() => null); }
  // v824 — parcela de pedido recebida com valor diferente: devolve a proposta de ajuste das próximas parcelas
  let ajustePedido = null;
  if (b.acao === "baixar" || b.acao === "editar" || b.acao === undefined) { try { ajustePedido = await (await import("@/lib/finAjustePedido")).ajusteParcelasPedido(n); } catch (e) { console.log("ajustePedido:", e.message); } }
  return Response.json({ ...tituloOut(n), ...(ajustePedido ? { ajustePedido } : {}) });
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
