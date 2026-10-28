// v186 — Títulos antecipados (contas a receber)
// O título antecipado fica PAGO (cobranca DESCONTADO) desde o dia da antecipação — o dinheiro veio do banco/factoring.
// Falta saber se o CLIENTE pagou quem antecipou: isso é a "liquidação" (liquidadoEm).
//  - liquidado pelo retorno do banco, pela baixa manual ou em lote;
//  - não liquidado até 3 dias úteis depois do vencimento → vira conta a PAGAR (em vermelho): quem antecipou cobra da Meridian;
//  - pagou a conta a pagar → o título original fica liquidado (RECOMPRA); estornou → volta a pendente;
//  - cliente pagou depois e a conta a pagar ainda está em aberto → a conta a pagar é cancelada.
import { prisma } from "@/lib/prisma";
import { garantirContas } from "@/lib/fin";
import { somaDiasUteis, subtraiDiasUteis, dataUTC, mesDe, r2, tituloOut, COM_ANEXOS } from "@/lib/finTitulos";

export const FORMAS_ANT = { BRADESCO: "Bradesco", AZUL_CAPITAL: "Factoring Azul Capital", PORTAL_PROPRIO: "Portal próprio" };
const PARCEIRO = { BRADESCO: ["BANCO BRADESCO S.A.", "60746948000112"], AZUL_CAPITAL: ["AZUL CAPITAL", null], PORTAL_PROPRIO: ["PORTAL PRÓPRIO DE ANTECIPAÇÃO", null] };
export const DIAS_TOLERANCIA = 3;
// cobrança automática só para vencimentos a partir da implantação (o que venceu antes não tem confirmação no sistema)
export const INICIO_COBRANCA = "2026-10-01";
const DIA = 86400000;
const dBR = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10).split("-").reverse().join("/");
const hojeUTC = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
export const ehAntecipado = (t) => !!t && t.tipo === "RECEBER" && (!!t.antecipadoForma || t.cobranca === "DESCONTADO");
export const prazoCobranca = (venc) => somaDiasUteis(venc, DIAS_TOLERANCIA);
// v544 — críticas do ciclo da antecipação (não pagou / vencidos / recompra): saem quando o caso se resolve
const RE_CRIT_ANT = /Banco informa que o cliente pagou o boleto|Cliente não pagou o título antecipado|Apareceu nos Títulos Vencidos|Recompra solicitada|virou conta a pagar|Título antecipado .* apareceu no relatório/i;
export const limparCriticaAnt = (c) => { const l = String(c || "").split(" · ").filter((x) => x.trim() && !RE_CRIT_ANT.test(x)); return l.length ? l.join(" · ").slice(0, 500) : null; };
async function limparCriticasResolvidas() {
  const l = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", critica: { not: null }, OR: [{ liquidadoEm: { not: null } }, { cobranca: "RECOMPRADO" }, { status: "PAGO", cobranca: { not: "DESCONTADO" }, antecipadoForma: { not: null } }] }, select: { id: true, critica: true } });
  for (const t of l) { const n = limparCriticaAnt(t.critica); if (n !== t.critica) await prisma.finTitulo.update({ where: { id: t.id }, data: { critica: n } }); }
}

// títulos descontados antes da v186: forma Bradesco e o contrato pela observação / pelos itens do contrato
async function completarAntigos() {
  const sem = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", cobranca: "DESCONTADO", antecipadoForma: null }, select: { id: true, observacao: true, dataPagamento: true } });
  if (!sem.length) return 0;
  const cts = await prisma.finAntecipacao.findMany({ select: { id: true, contrato: true, itens: true, data: true } });
  const porConta = new Map();
  for (const c of cts) for (const i of Array.isArray(c.itens) ? c.itens : []) if (i.contaId) porConta.set(Number(i.contaId), c);
  for (const t of sem) {
    const m = String(t.observacao || "").match(/CONTRATO ([A-Z0-9\-]+)/);
    const c = (m && cts.find((x) => x.contrato === m[1])) || porConta.get(t.id) || null;
    await prisma.finTitulo.update({ where: { id: t.id }, data: { antecipadoForma: "BRADESCO", antecipacaoId: c?.id || null, antecipadoEm: c?.data || t.dataPagamento || null } });
  }
  return sem.length;
}

// cria as contas a pagar dos antecipados que o cliente não pagou
async function cobrarVencidos(quem) {
  const hoje = hojeUTC();
  const pend = await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", antecipadoForma: { not: null }, status: "PAGO", liquidadoEm: null, recompraId: null, vencimento: { gte: dataUTC(INICIO_COBRANCA), lt: hoje } },
  });
  let n = 0;
  for (const t of pend) {
    const prazo = prazoCobranca(t.vencimento);
    if (!(prazo < hoje)) continue;   // ainda dentro dos 3 dias úteis
    const chave = `RECOMPRA|${t.id}`;
    let p = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });
    if (!p) {
      await garantirContas();
      const conta = await prisma.finConta.findUnique({ where: { codigo: "2131300" }, select: { id: true } });
      const [parc, doc] = PARCEIRO[t.antecipadoForma] || PARCEIRO.BRADESCO;
      const venc = prazo;
      p = await prisma.finTitulo.create({
        data: {
          tipo: "PAGAR", titulo: `RECOMPRA DE ANTECIPAÇÃO · ${t.titulo} · ${t.parceiro}`.slice(0, 190), parceiro: parc, documento: doc,
          numeroDoc: t.numeroDoc, valor: t.valor, vencimento: venc, competencia: mesDe(venc), previsao: false, status: "ABERTO",
          rateio: conta ? [{ contaId: conta.id, pct: 100 }] : [], forma: "MANUAL", formaPagamento: "DEBITO_AUTOMATICO", chaveImport: chave, valorConfirmado: true,
          observacao: `TÍTULO A RECEBER #${t.id} ANTECIPADO (${FORMAS_ANT[t.antecipadoForma] || t.antecipadoForma}) VENCIDO EM ${dBR(t.vencimento)} SEM PAGAMENTO DO CLIENTE`,
          critica: `O cliente ${t.parceiro} não pagou o título antecipado ${t.titulo} (venc. ${dBR(t.vencimento)}) até ${dBR(prazo)}: ${FORMAS_ANT[t.antecipadoForma] || "quem antecipou"} cobra da Meridian. Pagando esta conta, o título volta a ficar em aberto para receber do cliente.`,
          criadoPorNome: quem || "SISTEMA",
        },
      });
    }
    await prisma.finTitulo.update({ where: { id: t.id }, data: { recompraId: p.id,
      critica: [t.critica, `Cliente não pagou o título antecipado até ${dBR(prazo)} — virou conta a pagar (cobrança de ${FORMAS_ANT[t.antecipadoForma] || "quem antecipou"}).`].filter(Boolean).join(" · ").slice(0, 500) } });
    n++;
  }
  return n;
}

// conta a pagar da cobrança paga → título original liquidado; estornada → volta; cliente pagou → cancela a cobrança
async function amarrarCobrancas(quem) {
  const ligados = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", recompraId: { not: null } }, select: { id: true, recompraId: true, liquidadoEm: true, liquidacao: true, titulo: true, status: true, cobranca: true, valor: true, antecipadoEm: true, dataPagamento: true, observacao: true, critica: true } });
  if (!ligados.length) return;
  const cobs = await prisma.finTitulo.findMany({ where: { id: { in: ligados.map((t) => t.recompraId) } }, select: { id: true, status: true, dataPagamento: true, observacao: true } });
  const porId = new Map(cobs.map((c) => [c.id, c]));
  for (const t of ligados) {
    const c = porId.get(t.recompraId);
    if (!c) continue;
    // v539 — recompra paga: a antecipação acabou (Meridian devolveu ao banco), mas o CLIENTE ainda deve:
    // o título volta a ser conta a receber EM ABERTO (cobranca RECOMPRADO) até o cliente pagar
    if (c.status === "PAGO" && t.status === "PAGO" && (t.cobranca === "DESCONTADO" || !t.cobranca) && (!t.liquidadoEm || t.liquidacao === "RECOMPRA")) {
      const dr = c.dataPagamento || hojeUTC();
      await prisma.finTitulo.update({ where: { id: t.id }, data: {
        status: "ABERTO", dataPagamento: null, valorPago: null, cobranca: "RECOMPRADO", formaPagamento: "BOLETO", critica: limparCriticaAnt(t.critica),
        liquidadoEm: t.liquidadoEm || dr, liquidacao: "RECOMPRA", liquidadoPorNome: quem || "SISTEMA",
        observacao: [t.observacao, `RECOMPRADO EM ${dBR(dr)} (CONTA A PAGAR #${c.id}) — VOLTOU A RECEBER DO CLIENTE`].filter(Boolean).join(" · ").slice(0, 1000) } });
    } else if (c.status !== "PAGO" && t.liquidacao === "RECOMPRA") {
      // recompra estornada: volta a ser antecipado aguardando o cliente (se o cliente ainda não pagou)
      await prisma.finTitulo.update({ where: { id: t.id }, data: { liquidadoEm: null, liquidacao: null, liquidadoPorNome: null,
        ...(t.status === "ABERTO" && t.cobranca === "RECOMPRADO" ? { status: "PAGO", dataPagamento: t.antecipadoEm || hojeUTC(), valorPago: t.valor, cobranca: "DESCONTADO", formaPagamento: "DESCONTO" } : {}) } });
    } else if (c.status === "ABERTO" && t.liquidadoEm && t.liquidacao === "CLIENTE") {
      await prisma.finTitulo.update({ where: { id: c.id }, data: { status: "CANCELADO", critica: null,
        observacao: [c.observacao, `CANCELADA: O CLIENTE PAGOU O TÍTULO (${dBR(t.liquidadoEm)})`].filter(Boolean).join(" · ").slice(0, 1000) } });
    }
  }
}

// v333 — padroniza o nome das recompras/cobranças antigas (uma por fonte, prefixos diferentes) para "RECOMPRA DE ANTECIPAÇÃO · …"
async function padronizarNomes() {
  const antigos = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", OR: [{ titulo: { startsWith: "COBRANÇA DE ANTECIPAÇÃO NÃO PAGA · " } }, { titulo: { startsWith: "RECOMPRA DE TÍTULO ANTECIPADO · " } }] },
    select: { id: true, titulo: true },
  }).catch(() => []);
  for (const t of antigos) {
    const novo = t.titulo.replace(/^COBRANÇA DE ANTECIPAÇÃO NÃO PAGA · /, "RECOMPRA DE ANTECIPAÇÃO · ").replace(/^RECOMPRA DE TÍTULO ANTECIPADO · /, "RECOMPRA DE ANTECIPAÇÃO · ");
    if (novo !== t.titulo) await prisma.finTitulo.update({ where: { id: t.id }, data: { titulo: novo.slice(0, 190) } }).catch(() => null);
  }
  return antigos.length;
}

export async function sincronizarAntecipados(quem) {
  await padronizarNomes().catch((e) => console.log("antecipados/nomes:", e.message));
  await completarAntigos().catch((e) => console.log("antecipados/antigos:", e.message));
  try { const { corrigirCriticasDesconto } = await import("@/lib/finRetorno"); await corrigirCriticasDesconto(quem); } catch (e) { console.log("antecipados/retorno-desconto:", e.message); }   // v538
  await amarrarCobrancas(quem).catch((e) => console.log("antecipados/amarrar:", e.message));
  await limparCriticasResolvidas().catch((e) => console.log("antecipados/criticas:", e.message));   // v544
  // v335 — a recompra NÃO é mais criada automaticamente por data. Um título antecipado só vira
  // conta a pagar de recompra quando aparece no relatório "Títulos Vencidos" do Bradesco (aplicarVencidos)
  // ou por recompra manual. Antes disso, o título fica apenas como ATRASADO.
}

// v189 — "seta vermelha": título antecipado que não deveria ter ido ao banco (ex.: cancelado e enviado por engano).
// Cria a conta a PAGAR de recompra vencendo 2 dias úteis antes do vencimento original, com os dados do título.
// Pagar essa conta liquida o título (RECOMPRA), como na cobrança automática.
export async function recomprar(id, motivo, quem) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!ehAntecipado(t) || t.status !== "PAGO") throw new Error("Só título antecipado pode ser recomprado.");
  if (t.liquidadoEm) throw new Error("O título já está liquidado.");
  if (t.recompraId) {
    const c = await prisma.finTitulo.findUnique({ where: { id: t.recompraId }, select: { status: true } });
    if (c && c.status !== "CANCELADO") throw new Error("Este título já tem conta a pagar de recompra/cobrança.");
  }
  await garantirContas();
  const conta = await prisma.finConta.findUnique({ where: { codigo: "2131300" }, select: { id: true } });
  const forma = t.antecipadoForma || "BRADESCO";
  const [parc, doc] = PARCEIRO[forma] || PARCEIRO.BRADESCO;
  const hoje = hojeUTC();
  let venc = subtraiDiasUteis(t.vencimento, 2);
  if (venc < hoje) venc = hoje;
  const ctr = t.antecipacaoId ? await prisma.finAntecipacao.findUnique({ where: { id: t.antecipacaoId }, select: { contrato: true } }) : null;
  const mot = String(motivo || "").trim().toUpperCase();
  const chave = `RECOMPRA|${t.id}`;
  const velha = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });
  if (velha) await prisma.finTitulo.update({ where: { id: velha.id }, data: { chaveImport: `${chave}|CANC|${velha.id}` } });   // libera a chave da cobrança cancelada
  const p = await prisma.finTitulo.create({ data: {
    tipo: "PAGAR", titulo: `RECOMPRA DE ANTECIPAÇÃO · ${t.titulo} · ${t.parceiro}`.slice(0, 190), parceiro: parc, documento: doc,
    numeroDoc: t.numeroDoc, nossoNumero: t.nossoNumero, valor: t.valor, vencimento: venc, competencia: mesDe(venc), previsao: false, status: "ABERTO",
    rateio: conta ? [{ contaId: conta.id, pct: 100 }] : [], forma: "MANUAL", formaPagamento: t.formaPagamento && t.formaPagamento !== "DESCONTO" ? t.formaPagamento : "BOLETO",
    chaveImport: chave, valorConfirmado: true, criadoPorNome: quem || null,
    observacao: [`TÍTULO A RECEBER #${t.id} · ${t.titulo} · CLIENTE ${t.parceiro}${t.documento ? ` (${t.documento})` : ""} · NF/DOC ${t.numeroDoc || "—"}${t.nossoNumero ? ` · NOSSO Nº ${t.nossoNumero}` : ""}`,
      `VENC. ORIGINAL ${dBR(t.vencimento)} · ANTECIPADO EM ${dBR(t.antecipadoEm || t.dataPagamento || t.vencimento)} (${FORMAS_ANT[forma]}${ctr ? ` · CONTRATO ${ctr.contrato}` : ""})`,
      mot ? `MOTIVO: ${mot}` : null].filter(Boolean).join(" · ").slice(0, 1000),
    critica: `Recompra do título antecipado ${t.titulo} (${t.parceiro}) — pagar até ${dBR(venc)}, 2 dias úteis antes do vencimento original (${dBR(t.vencimento)}), para não gerar problema com ${FORMAS_ANT[forma]}.`,
  } });
  await prisma.finTitulo.update({ where: { id: t.id }, data: { recompraId: p.id, atualizadoPorNome: quem || null,
    critica: [t.critica, `Recompra solicitada${mot ? ` (${mot})` : ""} — conta a pagar até ${dBR(venc)}.`].filter(Boolean).join(" · ").slice(0, 500) } });
  return { id: p.id, vencimento: venc.toISOString().slice(0, 10), valor: Number(t.valor) };
}

// v335 — cria a conta a pagar de recompra a partir do relatório "Títulos Vencidos" do Bradesco.
// Só títulos que aparecem nesse relatório viram recompra. Valor = nota + encargos (o que o banco vai debitar).
export async function recompraPorVencido(id, { encargos = 0, vencBanco, quem } = {}) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!ehAntecipado(t) || t.status !== "PAGO") throw new Error("Só título antecipado pode ser recomprado.");
  if (t.liquidadoEm) throw new Error("O título já está liquidado (cliente pagou).");
  const chave = `RECOMPRA|${t.id}`;
  if (t.recompraId) {
    const c = await prisma.finTitulo.findUnique({ where: { id: t.recompraId }, select: { status: true } });
    if (c && c.status !== "CANCELADO") return { ja: true, id: t.recompraId };
  }
  await garantirContas();
  const conta = await prisma.finConta.findUnique({ where: { codigo: "2131300" }, select: { id: true } });
  const forma = t.antecipadoForma || "BRADESCO";
  const [parc, doc] = PARCEIRO[forma] || PARCEIRO.BRADESCO;
  const enc = r2(Number(encargos) || 0);
  const valor = r2(Number(t.valor) + enc);
  const venc = somaDiasUteis(t.vencimento, 5);   // v540 — regra do Igor: 5 dias úteis após o vencimento original
  const ctr = t.antecipacaoId ? await prisma.finAntecipacao.findUnique({ where: { id: t.antecipacaoId }, select: { contrato: true } }) : null;
  const velha = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });
  if (velha) await prisma.finTitulo.update({ where: { id: velha.id }, data: { chaveImport: `${chave}|CANC|${velha.id}` } });
  const p = await prisma.finTitulo.create({ data: {
    tipo: "PAGAR", titulo: `RECOMPRA DE ANTECIPAÇÃO · ${t.titulo} · ${t.parceiro}`.slice(0, 190), parceiro: parc, documento: doc,
    numeroDoc: t.numeroDoc, nossoNumero: t.nossoNumero, valor, vencimento: venc, competencia: mesDe(venc), previsao: false, status: "ABERTO",
    rateio: conta ? [{ contaId: conta.id, pct: 100 }] : [], forma: "MANUAL", formaPagamento: "DEBITO_AUTOMATICO", chaveImport: chave, valorConfirmado: true, criadoPorNome: quem || "SISTEMA",
    observacao: [`TÍTULO A RECEBER #${t.id} · ${t.titulo} · CLIENTE ${t.parceiro}${t.documento ? ` (${t.documento})` : ""} · NF/DOC ${t.numeroDoc || "—"}${t.nossoNumero ? ` · NOSSO Nº ${t.nossoNumero}` : ""}`,
      `VENCIDO NO BANCO · VENC. ORIGINAL ${dBR(t.vencimento)}${vencBanco ? ` · VENCIMENTO BRADESCO ${dBR(vencBanco)}` : ""} (${FORMAS_ANT[forma]}${ctr ? ` · CONTRATO ${ctr.contrato}` : ""})`,
      enc ? `NOTA R$ ${Number(t.valor).toFixed(2)} + ENCARGOS R$ ${enc.toFixed(2)}` : null,
      `ORIGEM: RELATÓRIO TÍTULOS VENCIDOS (BRADESCO)`].filter(Boolean).join(" · ").slice(0, 1000),
    critica: `Título antecipado ${t.titulo} (${t.parceiro}) apareceu no relatório de Títulos Vencidos do Bradesco — virou recompra${enc ? ` (nota + encargos de R$ ${enc.toFixed(2)})` : ""}. Pagando esta conta, o título volta a ficar em aberto para receber do cliente.`,
  } });
  await prisma.finTitulo.update({ where: { id: t.id }, data: { recompraId: p.id, atualizadoPorNome: quem || null,
    critica: [t.critica, `Apareceu nos Títulos Vencidos do Bradesco — virou conta a pagar de recompra (${dBR(venc)}).`].filter(Boolean).join(" · ").slice(0, 500) } });
  return { id: p.id, valor, vencimento: venc.toISOString().slice(0, 10) };
}

// v540 — relatório "Títulos Baixados": o banco cobrou a recompra da Meridian. Baixa a conta a pagar da recompra
// (cria, se ainda não existir) e o título volta a ficar em aberto para receber do cliente (amarrarCobrancas).
export async function pagarRecompra(id, { data, valor, quem } = {}) {
  let t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!t) throw new Error("Título não encontrado.");
  if (t.liquidadoEm && t.liquidacao === "CLIENTE" && t.status === "PAGO") {   // liquidado como "cliente pagou" por engano: o banco cobrou a recompra
    t = await prisma.finTitulo.update({ where: { id: t.id }, data: { liquidadoEm: null, liquidacao: null, liquidadoPorNome: null,
      observacao: [t.observacao, "LIQUIDAÇÃO 'CLIENTE PAGOU' DESFEITA: O BANCO COBROU A RECOMPRA (TÍTULOS BAIXADOS)"].filter(Boolean).join(" · ").slice(0, 1000) } });
  }
  let c = t.recompraId ? await prisma.finTitulo.findUnique({ where: { id: t.recompraId } }) : null;
  if (!c || c.status === "CANCELADO") {
    const enc = valor && Number(valor) > Number(t.valor) ? r2(Number(valor) - Number(t.valor)) : 0;
    const x = await recompraPorVencido(t.id, { encargos: enc, quem });
    c = await prisma.finTitulo.findUnique({ where: { id: x.id } });
  }
  const dt = dataUTC(data || new Date().toISOString().slice(0, 10));
  const v = r2(Number(valor) || Number(c.valor));
  if (c.status !== "PAGO") await prisma.finTitulo.update({ where: { id: c.id }, data: { status: "PAGO", dataPagamento: dt, valorPago: v, valorConfirmado: true, critica: null, atualizadoPorNome: quem || null,
    observacao: [c.observacao, `PAGA PELO RELATÓRIO TÍTULOS BAIXADOS (BRADESCO) EM ${dBR(dt)}`].filter(Boolean).join(" · ").slice(0, 1000) } });
  await amarrarCobrancas(quem);
  return { ok: true, id: c.id, valor: v };
}

// marca o título como liquidado (cliente pagou quem antecipou)
export async function liquidar(id, data, quem, { relatorio = false } = {}) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  // v545 — título recomprado (voltou a receber) que aparece nos Títulos Pagos: o cliente pagou o boleto no banco → recebido.
  // A recompra também foi paga: fica a crítica para conferir a devolução/estorno com o banco.
  if (t && t.tipo === "RECEBER" && t.status === "ABERTO" && t.cobranca === "RECOMPRADO") {
    const dt = dataUTC(data);
    await prisma.finTitulo.update({ where: { id: t.id }, data: { status: "PAGO", dataPagamento: dt, valorPago: t.valor, valorConfirmado: true, previsao: false, cobranca: "DESCONTADO", formaPagamento: "DESCONTO",
      liquidadoEm: dt, liquidacao: "CLIENTE", liquidadoPorNome: quem || null,
      critica: limparCriticaAnt(t.critica),   // v547 — cliente pagou: sem crítica
      observacao: [t.observacao, relatorio ? `CLIENTE PAGOU O BOLETO NO BANCO (RELATÓRIO TÍTULOS PAGOS, ${dBR(dt)}) APÓS A RECOMPRA` : `CLIENTE PAGOU APÓS A RECOMPRA (${dBR(dt)}, BAIXA POR ${quem || "—"})`].filter(Boolean).join(" · ").slice(0, 1000) } });
    return { ok: true };
  }
  if (!ehAntecipado(t) || t.status !== "PAGO") throw new Error("Só título antecipado pode ser liquidado.");
  if (t.liquidadoEm) return { ja: true };
  await prisma.finTitulo.update({ where: { id: t.id }, data: { liquidadoEm: dataUTC(data), liquidacao: "CLIENTE", liquidadoPorNome: quem || null,
    critica: limparCriticaAnt(t.critica) } });   // v544 — cliente pagou: sai a crítica de "não pagou / vencidos / recompra"
  await amarrarCobrancas(quem);
  return { ok: true };
}
export async function desfazerLiquidacao(id) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!t?.liquidadoEm) return { ja: true };
  if (t.liquidacao === "RECOMPRA") throw new Error("Liquidado pela conta a pagar da cobrança — estorne a conta a pagar.");
  await prisma.finTitulo.update({ where: { id: t.id }, data: { liquidadoEm: null, liquidacao: null, liquidadoPorNome: null } });
  if (t.recompraId) {   // a cobrança tinha sido cancelada porque o cliente pagou: volta a valer
    const c = await prisma.finTitulo.findUnique({ where: { id: t.recompraId }, select: { status: true } });
    if (c?.status === "CANCELADO") await prisma.finTitulo.update({ where: { id: t.recompraId }, data: { status: "ABERTO" } });
  }
  return { ok: true };
}

// desfaz a antecipação do título (volta a ser conta a receber em aberto)
export async function desfazerAntecipacao(id, quem) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) } });
  if (!ehAntecipado(t)) throw new Error("O título não está antecipado.");
  if (t.recompraId) {
    const c = await prisma.finTitulo.findUnique({ where: { id: t.recompraId }, select: { status: true } });
    if (c?.status === "PAGO") throw new Error("A cobrança desta antecipação já foi paga — estorne a conta a pagar antes.");
    if (c) await prisma.finTitulo.update({ where: { id: t.recompraId }, data: { status: "CANCELADO", critica: null } });
  }
  await prisma.finTitulo.update({ where: { id: t.id }, data: {
    status: "ABERTO", dataPagamento: null, valorPago: null, cobranca: null, formaPagamento: t.formaPagamento === "DESCONTO" ? "BOLETO" : t.formaPagamento,
    antecipadoForma: null, antecipadoEm: null, antecipacaoId: null, liquidadoEm: null, liquidacao: null, liquidadoPorNome: null, recompraId: null, critica: null,
    observacao: [t.observacao, `ANTECIPAÇÃO DESFEITA POR ${quem || "—"}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem || null,
  } });
  return { ok: true };
}

// antecipação registrada à mão (factoring Azul Capital, portal próprio ou Bradesco sem PDF)
export async function registrarManual({ forma, data, contrato, ids, liquido, arquivo, juros, iof, tarifa, taxa }, quem) {
  if (!FORMAS_ANT[forma]) throw new Error("Escolha a forma de antecipação.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) throw new Error("Informe a data da antecipação.");
  const tits = await prisma.finTitulo.findMany({ where: { id: { in: (ids || []).map(Number) }, tipo: "RECEBER", status: "ABERTO" } });
  if (!tits.length) throw new Error("Selecione os títulos em aberto que foram antecipados.");
  const total = r2(tits.reduce((s, t) => s + Number(t.valor), 0));
  const liq = liquido != null && liquido !== "" ? r2(liquido) : total;
  if (liq > total + 0.01) throw new Error("O valor líquido é maior que a soma dos títulos.");
  // v260 — juros, IOF e tarifa separados (comprovante); sem eles, todo o custo fica como juros
  const vIof = r2(iof || 0), vTar = r2(tarifa || 0);
  const vJur = juros != null && juros !== "" ? r2(juros) : r2(total - liq - vIof - vTar);
  if (Math.abs(r2(total - liq) - r2(vJur + vIof + vTar)) > 0.05) throw new Error(`Juros + IOF + tarifa (${r2(vJur + vIof + vTar)}) não fecham com títulos − líquido (${r2(total - liq)}). Confira os títulos marcados.`);
  const { createHash } = await import("crypto");
  const num = String(contrato || "").trim().toUpperCase() || `${forma === "AZUL_CAPITAL" ? "AZUL" : forma === "PORTAL_PROPRIO" ? "PORTAL" : "BRAD"}-${data.replace(/-/g, "")}-${Math.round(liq * 100)}`;
  if (await prisma.finAntecipacao.findUnique({ where: { contrato: num }, select: { id: true } })) throw new Error(`Já existe o contrato ${num}.`);
  const b64 = arquivo?.conteudo ? String(arquivo.conteudo) : "";
  const a = await prisma.finAntecipacao.create({ data: {
    forma, banco: forma === "BRADESCO" ? "237" : forma, contrato: num, data: dataUTC(data), valorOperacao: total, juros: vJur, iof: vIof, tac: 0, tarifa: vTar, valorLiquido: liq, ...(taxa ? { taxa: String(taxa) } : {}),
    itens: tits.map((t, i) => ({ parcela: i + 1, vencimento: t.vencimento.toISOString().slice(0, 10), valor: Number(t.valor), seu: t.numeroDoc, sacado: t.parceiro, contaId: t.id })),
    nome: arquivo?.nome || `${num} (sem arquivo)`, hash: createHash("sha256").update(b64 || `MANUAL|${num}|${Date.now()}`).digest("hex"), conteudo: b64, criadoPorNome: quem || null,
  } });
  for (const t of tits) {
    await prisma.finTitulo.update({ where: { id: t.id }, data: {
      status: "PAGO", dataPagamento: dataUTC(data), valorPago: t.valor, cobranca: "DESCONTADO", formaPagamento: t.formaPagamento || "BOLETO", previsao: false, valorConfirmado: true,
      antecipadoForma: forma, antecipadoEm: dataUTC(data), antecipacaoId: a.id, atualizadoPorNome: quem || null,
      observacao: [t.observacao, `ANTECIPADA (${FORMAS_ANT[forma]}) · CONTRATO ${num} (${dBR(data)})`].filter(Boolean).join(" · ").slice(0, 1000),
    } });
    if (b64) await prisma.finTituloAnexo.create({ data: { tituloId: t.id, nome: arquivo.nome || `CONTRATO ${num}.pdf`, mime: arquivo.mime || "application/pdf", tamanho: Math.floor(b64.length * 3 / 4), conteudo: b64, criadoPorNome: quem || null } });
  }
  return { contrato: num, titulos: tits.length, valor: total, liquido: liq };
}

// situação do título antecipado
// v546 — LIQUIDADO = pago pelo cliente · COBRADO = recompra solicitada (conta a pagar em aberto) ·
// RECOMPRADO = recompra paga, título em aberto esperando o cliente · VENCIDO / A_VENCER = aguardando o cliente
export function situacaoAntecipado(t, hoje = hojeUTC()) {
  if (t.cobranca === "RECOMPRADO") return t.status === "PAGO" ? "LIQUIDADO" : "RECOMPRADO";
  if (t.liquidadoEm) return t.liquidacao === "RECOMPRA" ? "RECOMPRADO" : "LIQUIDADO";
  if (t.recompraId) return "COBRADO";
  const v = t.vencimento instanceof Date ? t.vencimento : dataUTC(t.vencimento);
  if (v < hoje) return "VENCIDO";   // atrasado: só vira recompra pelo relatório Títulos Vencidos (v335)
  return "A_VENCER";
}

const contratoOut = (a) => a && ({ id: a.id, forma: a.forma, banco: a.banco, contrato: a.contrato, data: a.data.toISOString().slice(0, 10), valorOperacao: Number(a.valorOperacao),
  juros: Number(a.juros), iof: Number(a.iof), tac: Number(a.tac), tarifa: Number(a.tarifa), valorLiquido: Number(a.valorLiquido), taxa: a.taxa, nome: a.nome,
  temArquivo: a.conteudo !== undefined ? !!a.conteudo : !/\(sem arquivo\)$/.test(String(a.nome || "")), criadoPorNome: a.criadoPorNome, lancamentoId: a.lancamentoId,
  qtd: Array.isArray(a.itens) ? a.itens.length : 0 });

// guia Antecipações: títulos antecipados com vencimento no período + % antecipado do contas a receber
export async function listarAntecipados({ dIni, dFim }) {
  const per = { vencimento: { gte: dataUTC(dIni), lte: dataUTC(dFim) } };
  const [tits, todos] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo: "RECEBER", OR: [{ antecipadoForma: { not: null } }, { cobranca: "DESCONTADO" }], status: { not: "CANCELADO" }, ...per }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], include: COM_ANEXOS }),
    prisma.finTitulo.aggregate({ where: { tipo: "RECEBER", status: { notIn: ["CANCELADO"] }, ...per }, _sum: { valor: true }, _count: true }),
  ]);
  const ids = [...new Set(tits.map((t) => t.antecipacaoId).filter(Boolean))];
  const recIds = tits.map((t) => t.recompraId).filter(Boolean);
  const [cts, recs] = await Promise.all([
    ids.length ? prisma.finAntecipacao.findMany({ where: { id: { in: ids } }, select: { id: true, forma: true, banco: true, contrato: true, data: true, valorOperacao: true, juros: true, iof: true, tac: true, tarifa: true, valorLiquido: true, taxa: true, nome: true, criadoPorNome: true, lancamentoId: true, itens: true } }) : [],
    recIds.length ? prisma.finTitulo.findMany({ where: { id: { in: recIds } }, select: { id: true, status: true, vencimento: true, valor: true, dataPagamento: true } }) : [],
  ]);
  const contratos = cts.map(contratoOut);
  const recPor = new Map(recs.map((r) => [r.id, { id: r.id, status: r.status, vencimento: r.vencimento.toISOString().slice(0, 10), valor: Number(r.valor), dataPagamento: r.dataPagamento?.toISOString().slice(0, 10) || null }]));
  const hoje = hojeUTC();
  const lista = tits.map((t) => ({ ...tituloOut(t), antecipadoForma: t.antecipadoForma || "BRADESCO", sitAnt: situacaoAntecipado(t, hoje), prazoCobranca: prazoCobranca(t.vencimento).toISOString().slice(0, 10), recompra: recPor.get(t.recompraId) || null }));
  const totalReceber = Number(todos._sum.valor || 0);
  const antecipado = r2(lista.reduce((s, t) => s + t.valor, 0));
  return { titulos: lista, contratos, totalReceber, antecipado, pct: totalReceber ? Math.round((antecipado / totalReceber) * 10000) / 100 : 0, qtdReceber: todos._count || 0 };
}

// contrato de um título (ao clicar no A)
export async function contratoDoTitulo(tituloId) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } });
  if (!t) throw new Error("Título não encontrado.");
  const a = t.antecipacaoId ? await prisma.finAntecipacao.findUnique({ where: { id: t.antecipacaoId } }) : null;
  return contratoComTitulos(a, t);
}
export async function contratoPorId(id) {
  const a = await prisma.finAntecipacao.findUnique({ where: { id: Number(id) } });
  if (!a) throw new Error("Contrato não encontrado.");
  return contratoComTitulos(a, null);
}
async function contratoComTitulos(a, t) {
  const tits = a ? await prisma.finTitulo.findMany({ where: { antecipacaoId: a.id }, orderBy: { vencimento: "asc" } }) : t ? [t] : [];
  const hoje = hojeUTC();
  return {
    contrato: a ? contratoOut(a) : null,
    forma: a?.forma || t?.antecipadoForma || "BRADESCO",
    semContrato: !a ? (t ? `Título antecipado sem contrato vinculado${t.observacao ? ` — ${t.observacao}` : ""}.` : "") : null,
    titulos: tits.map((x) => ({ ...tituloOut(x), sitAnt: situacaoAntecipado(x, hoje), prazoCobranca: prazoCobranca(x.vencimento).toISOString().slice(0, 10) })),
  };
}
export async function arquivoContrato(id) {
  const a = await prisma.finAntecipacao.findUnique({ where: { id: Number(id) }, select: { nome: true, conteudo: true } });
  if (!a?.conteudo) return null;
  return { nome: /\.pdf$/i.test(a.nome) ? a.nome : `${a.nome}.pdf`, buf: Buffer.from(a.conteudo, "base64") };
}
