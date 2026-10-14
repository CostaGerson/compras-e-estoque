// v187 — Exportar para Excel o que está na tela do contas a pagar / receber (e da guia Antecipações).
// Uma linha por conta com tudo o que o sistema sabe dela; aba "Rateio" com uma linha por conta-caixa
// e aba "Itens da semana" com freelancers/terceirizados das contas da semana.
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const FORMAS_ANT = { BRADESCO: "BRADESCO", AZUL_CAPITAL: "FACTORING AZUL CAPITAL", PORTAL_PROPRIO: "PORTAL PRÓPRIO" };
const ORIGEM = { RH: "LANÇADA PELO RH", MANUAL: "MANUAL", NF_XML: "IMPORTAÇÃO NF (XML)", EXCEL: "IMPORTAÇÃO (PLANILHA)", IMPORTACAO: "IMPORTAÇÃO", RECORRENCIA: "RECORRÊNCIA", SEMANAL: "CONTA DA SEMANA" };
const PGTO = { PIX: "PIX", BOLETO: "BOLETO", DEBITO_AUTOMATICO: "DÉBITO AUTOMÁTICO", TED: "TED/DOC", CARTAO: "CARTÃO", DINHEIRO: "DINHEIRO", CHEQUE: "CHEQUE", DESCONTO: "DESCONTO (ANTECIPAÇÃO)", RH: "RH" };
const PERIODO = { 1: "MENSAL", 2: "BIMESTRAL", 3: "TRIMESTRAL", 4: "QUADRIMESTRAL", 6: "SEMESTRAL", 12: "ANUAL" };
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dt = (d) => { const s = iso(d); return s ? new Date(`${s}T12:00:00Z`) : null; };   // célula de data no Excel
const dth = (d) => (d ? new Date(d) : null);
const n = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const hoje = () => new Date().toISOString().slice(0, 10);

export function situacaoTexto(t) {
  const P = t.tipo === "PAGAR";
  if (t.status === "CANCELADO") return "CANCELADO";
  if (t.status === "EXECUCAO") return "EM EXECUÇÃO JUDICIAL";
  if (t.status === "PERDA") return "PERDA";
  if (t.status === "PAGO" && (t.antecipadoForma || t.cobranca === "DESCONTADO") && !P) {
    if (t.liquidadoEm) return t.liquidacao === "RECOMPRA" ? "ANTECIPADO · RECOMPRADO (CONTA A PAGAR PAGA)" : "ANTECIPADO · LIQUIDADO PELO CLIENTE";
    if (t.recompraId) return "ANTECIPADO · BANCO COBROU (VIROU CONTA A PAGAR)";
    return iso(t.vencimento) < hoje() ? "ANTECIPADO · AGUARDA CLIENTE (VENCIDO)" : "ANTECIPADO · A VENCER";
  }
  if (t.status === "PAGO") return P ? "PAGO" : "RECEBIDO";
  if (iso(t.vencimento) < hoje()) return "VENCIDO";
  if (t.previsao) return "PREVISÃO";
  return "EM ABERTO";
}

export async function gerarXlsxTitulos(ids, { titulo = "" } = {}) {
  const lista = [...new Set((ids || []).map(Number).filter((x) => x > 0))].slice(0, 20000);
  const ts = await prisma.finTitulo.findMany({
    where: { id: { in: lista } },
    include: {
      recorrencia: { select: { titulo: true, periodicidade: true, diaVencimento: true, diaUtil: true, inicio: true, fim: true, ativo: true } },
      nf: { select: { numero: true, chave: true, dataEmissao: true } },
      execucao: { select: { titulo: true, processo: true } },
      anexos: { select: { nome: true } },
      semanaItens: true,
    },
  });
  const ordem = new Map(lista.map((id, i) => [id, i]));
  ts.sort((a, b) => ordem.get(a.id) - ordem.get(b.id));
  const [contas, cts, lancs, recs] = await Promise.all([
    prisma.finConta.findMany({ select: { id: true, codigo: true, nome: true } }),
    prisma.finAntecipacao.findMany({ where: { id: { in: ts.map((t) => t.antecipacaoId).filter(Boolean) } }, select: { id: true, contrato: true, data: true, forma: true, valorLiquido: true, taxa: true } }),
    prisma.finLancamento.findMany({ where: { id: { in: ts.map((t) => t.lancamentoId).filter(Boolean) } }, select: { id: true, banco: true, data: true, historico: true, valor: true } }),
    prisma.finTitulo.findMany({ where: { id: { in: ts.map((t) => t.recompraId).filter(Boolean) } }, select: { id: true, status: true, vencimento: true, dataPagamento: true } }),
  ]);
  const conta = new Map(contas.map((c) => [c.id, c]));
  const ctr = new Map(cts.map((c) => [c.id, c]));
  const lan = new Map(lancs.map((l) => [l.id, l]));
  const rec = new Map(recs.map((r) => [r.id, r]));
  const nomeConta = (id) => { const c = conta.get(Number(id)); return c ? `${c.codigo} ${c.nome}` : `#${id}`; };

  const cab = [
    "ID", "TIPO", "EMISSÃO DA NF", "VENCIMENTO", "VENC. ORIGINAL (REPROGRAMADO)", "COMPETÊNCIA", "TÍTULO", "FORNECEDOR / CLIENTE", "CPF / CNPJ", "Nº DOCUMENTO", "NOSSO NÚMERO",
    "VALOR (R$)", "VALOR PAGO / RECEBIDO (R$)", "DIFERENÇA (R$)", "DATA PAGAMENTO / RECEBIMENTO", "SITUAÇÃO", "STATUS NO SISTEMA", "PREVISÃO", "FORMA DE PAGAMENTO",
    "CONTA-CAIXA (RATEIO)", "Nº DE CONTAS NO RATEIO",
    "BAIXA PELO EXTRATO · BANCO", "BAIXA PELO EXTRATO · DATA", "BAIXA PELO EXTRATO · HISTÓRICO",
    "COBRANÇA (RETORNO DO BANCO)", "ANTECIPAÇÃO · FORMA", "ANTECIPAÇÃO · DATA", "ANTECIPAÇÃO · CONTRATO", "ANTECIPAÇÃO · LÍQUIDO DO CONTRATO", "ANTECIPAÇÃO · TAXA",
    "LIQUIDADO PELO CLIENTE EM", "LIQUIDAÇÃO", "LIQUIDADO POR", "COBRANÇA DO BANCO (CONTA A PAGAR)", "COBRANÇA · VENCIMENTO", "COBRANÇA · SITUAÇÃO",
    "RECORRÊNCIA", "RECORRÊNCIA · PERIODICIDADE", "RECORRÊNCIA · VENCIMENTO", "VALOR DO MÊS CONFERIDO",
    "ORIGEM", "CHAVE DE IMPORTAÇÃO", "NF DE COMPRA (Nº)", "NF DE COMPRA (CHAVE)", "TEM XML",
    "EXECUÇÃO JUDICIAL", "PERDA · JUSTIFICATIVA", "PERDA · DATA",
    "REPROGRAMAÇÕES", "CRÍTICA", "OBS (NOTAS)", "OBSERVAÇÃO", "ANEXOS (QTD)", "ANEXOS (ARQUIVOS)",
    "ITENS DA SEMANA (QTD)", "ITENS DA SEMANA PAGOS", "ITENS DA SEMANA (RESUMO)",
    "CRIADO POR", "CRIADO EM", "ALTERADO POR", "ATUALIZADO EM",
  ];
  const linhas = ts.map((t) => {
    const r = Array.isArray(t.rateio) ? t.rateio.filter((x) => Number(x.contaId)) : [];
    const c = ctr.get(t.antecipacaoId), l = lan.get(t.lancamentoId), rc = rec.get(t.recompraId);
    const repro = Array.isArray(t.reprogramacoes) ? t.reprogramacoes.map((x) => `${iso(x.de)?.split("-").reverse().join("/")} → ${iso(x.para)?.split("-").reverse().join("/")}${x.por ? ` (${x.por})` : ""}${x.desfeito ? " desfeito" : ""}`).join(" | ") : "";
    const its = t.semanaItens || [];
    return [
      t.id, t.tipo === "PAGAR" ? "A PAGAR" : "A RECEBER", dt(t.emissao), dt(t.vencimento), dt(t.vencimentoOriginal), t.competencia, t.titulo, t.parceiro, t.documento || "", t.numeroDoc || "", t.nossoNumero || "",
      n(t.valor), n(t.valorPago), t.valorPago != null ? n(Number(t.valorPago) - Number(t.valor)) : null, dt(t.dataPagamento), situacaoTexto(t), t.status, t.previsao ? "SIM" : "NÃO", PGTO[t.formaPagamento] || t.formaPagamento || "",
      r.map((x) => `${nomeConta(x.contaId)}${r.length > 1 ? ` (${Number(x.pct).toLocaleString("pt-BR")}%)` : ""}`).join(" | ") || "SEM CONTA-CAIXA", r.length,
      l?.banco || "", dt(l?.data), l?.historico || "",
      t.cobranca || "", t.antecipadoForma ? FORMAS_ANT[t.antecipadoForma] || t.antecipadoForma : t.cobranca === "DESCONTADO" ? "BRADESCO" : "", dt(t.antecipadoEm), c?.contrato || "", n(c?.valorLiquido), c?.taxa || "",
      dt(t.liquidadoEm), t.liquidacao === "RECOMPRA" ? "CONTA A PAGAR DA COBRANÇA PAGA" : t.liquidacao === "CLIENTE" ? "CLIENTE PAGOU" : "", t.liquidadoPorNome || "",
      t.recompraId ? `#${t.recompraId}` : "", dt(rc?.vencimento), rc ? (rc.status === "PAGO" ? `PAGA ${iso(rc.dataPagamento)?.split("-").reverse().join("/") || ""}` : rc.status) : "",
      t.recorrencia?.titulo || "", t.recorrencia ? PERIODO[t.recorrencia.periodicidade] || `A CADA ${t.recorrencia.periodicidade} MESES` : "",
      t.recorrencia ? (t.recorrencia.diaUtil ? `${t.recorrencia.diaVencimento}º DIA ÚTIL` : `DIA ${t.recorrencia.diaVencimento}`) : "", t.recorrenciaId ? (t.valorConfirmado ? "SIM" : "NÃO") : "",
      ORIGEM[t.forma] || t.forma || "", t.chaveImport || "", t.nf?.numero || "", t.nf?.chave || "", t.arquivoXml ? "SIM" : "NÃO",
      t.execucao ? [t.execucao.titulo, t.execucao.processo].filter(Boolean).join(" · ") : "", t.perdaJustificativa || "", dt(t.perdaData),
      repro, t.critica || "", (Array.isArray(t.notas) ? t.notas : []).map((x) => `${x.texto} (${x.por || "—"} ${iso(x.em)?.split("-").reverse().join("/") || ""})`).join(" | "), t.observacao || "", (t.anexos || []).length, (t.anexos || []).map((a) => a.nome).join(" | "),
      its.length || null, its.length ? its.filter((i) => i.pago).length : null,
      its.map((i) => `${i.nome} · ${i.setor} · ${Number(i.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${i.pago ? " · PAGO" : ""}`).join(" | "),
      t.criadoPorNome || "", dth(t.createdAt), t.atualizadoPorNome || "", dth(t.updatedAt),
    ];
  });
  const totalCol = (i) => Math.round(linhas.reduce((s, l) => s + (Number(l[i]) || 0), 0) * 100) / 100;
  const iV = cab.indexOf("VALOR (R$)"), iP = cab.indexOf("VALOR PAGO / RECEBIDO (R$)");
  const rodape = cab.map((_, i) => (i === 0 ? "TOTAL" : i === iV ? totalCol(iV) : i === iP ? totalCol(iP) : null));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas, [], rodape], { cellDates: true });
  formatar(ws, cab, linhas.length + 2);
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, linhas.length), c: cab.length - 1 } }) };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");

  // rateio: uma linha por conta-caixa, com o valor proporcional
  const cabR = ["ID", "TIPO", "VENCIMENTO", "TÍTULO", "FORNECEDOR / CLIENTE", "SITUAÇÃO", "CÓDIGO", "CONTA-CAIXA", "%", "VALOR DA CONTA (R$)", "VALOR PAGO PROPORCIONAL (R$)", "DATA PAGAMENTO"];
  const linR = [];
  for (const t of ts) {
    const its = t.semanaItens || [];
    if (its.length) {   // conta da semana: o rateio são os itens
      for (const i of its) { const c = conta.get(i.contaId); linR.push([t.id, t.tipo === "PAGAR" ? "A PAGAR" : "A RECEBER", dt(t.vencimento), `${t.titulo} · ${i.nome}`, t.parceiro, i.pago ? "PAGO" : situacaoTexto(t), c?.codigo || "", c?.nome || "", Number(t.valor) ? n((Number(i.valor) / Number(t.valor)) * 100) : null, n(i.valor), i.pago ? n(i.valor) : null, dt(i.dataPagamento)]); }
      continue;
    }
    const r = Array.isArray(t.rateio) ? t.rateio.filter((x) => Number(x.contaId)) : [];
    if (!r.length) { linR.push([t.id, t.tipo === "PAGAR" ? "A PAGAR" : "A RECEBER", dt(t.vencimento), t.titulo, t.parceiro, situacaoTexto(t), "", "SEM CONTA-CAIXA", null, n(t.valor), n(t.valorPago), dt(t.dataPagamento)]); continue; }
    for (const x of r) {
      const c = conta.get(Number(x.contaId)), p = Number(x.pct) / 100;
      linR.push([t.id, t.tipo === "PAGAR" ? "A PAGAR" : "A RECEBER", dt(t.vencimento), t.titulo, t.parceiro, situacaoTexto(t), c?.codigo || "", c?.nome || "", n(x.pct), n(Number(t.valor) * p), t.valorPago != null ? n(Number(t.valorPago) * p) : null, dt(t.dataPagamento)]);
    }
  }
  const wsR = XLSX.utils.aoa_to_sheet([cabR, ...linR], { cellDates: true });
  formatar(wsR, cabR, linR.length + 1);
  wsR["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, linR.length), c: cabR.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsR, "Rateio");

  // itens da semana (freelancers / terceirizados) em detalhe
  const its = ts.flatMap((t) => (t.semanaItens || []).map((i) => [t.id, t.titulo, dt(t.vencimento), i.grupo, i.nome, i.chavePix, i.setor, conta.get(i.contaId) ? `${conta.get(i.contaId).codigo} ${conta.get(i.contaId).nome}` : "",
    n(i.diaria), i.dias, n(i.transporte), n(i.custoExtra), i.justificativa || "", i.descricao || "", dt(i.dataRecebimento), i.prazoDias, dt(i.vencimentoNegociado), i.excepcional ? "SIM" : "NÃO",
    n(i.valor), i.pago ? "SIM" : "NÃO", dt(i.dataPagamento), i.observacao || "", i.criadoPorNome || ""]));
  if (its.length) {
    const cabI = ["ID DA CONTA", "CONTA DA SEMANA", "SEXTA", "GRUPO", "PRESTADOR", "PIX", "SETOR / SERVIÇO", "CONTA-CAIXA", "DIÁRIA", "DIAS", "TRANSPORTE/DIA", "CUSTO EXTRA", "JUSTIFICATIVA", "DESCRIÇÃO",
      "RECEBIMENTO DO SERVIÇO", "PRAZO (DIAS)", "VENCIMENTO NEGOCIADO", "EXCEPCIONAL", "VALOR (R$)", "PAGO", "DATA PAGAMENTO", "OBSERVAÇÃO", "LANÇADO POR"];
    const wsI = XLSX.utils.aoa_to_sheet([cabI, ...its], { cellDates: true });
    formatar(wsI, cabI, its.length + 1);
    XLSX.utils.book_append_sheet(wb, wsI, "Itens da semana");
  }

  // capa com o filtro usado
  const wsF = XLSX.utils.aoa_to_sheet([["EXPORTADO EM", new Date()], ["TELA", titulo || ""], ["CONTAS", ts.length], ["VALOR TOTAL (R$)", totalCol(iV)]], { cellDates: true });
  wsF["!cols"] = [{ wch: 20 }, { wch: 70 }];
  if (wsF.B1) wsF.B1.z = "dd/mm/yyyy hh:mm";
  if (wsF.B4) wsF.B4.z = "#,##0.00";
  XLSX.utils.book_append_sheet(wb, wsF, "Filtro");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// larguras + formato de data e de valor pelas palavras do cabeçalho
function formatar(ws, cab, nLin) {
  ws["!cols"] = cab.map((h) => ({ wch: /TÍTULO|OBSERVAÇÃO|OBS \(NOTAS\)|CRÍTICA|RESUMO|ARQUIVOS|HISTÓRICO|RATEIO|REPROGRAMA|CONTA-CAIXA|PRESTADOR|CONTA DA SEMANA/.test(h) ? 42 : /FORNECEDOR|CHAVE/.test(h) ? 32 : Math.max(10, Math.min(24, h.length + 2)) }));
  cab.forEach((h, c) => {
    const ehValor = /\(R\$\)|DIÁRIA|TRANSPORTE|CUSTO EXTRA|LÍQUIDO|^%$/.test(h);
    const ehHora = /CRIADO EM|ATUALIZADO EM/.test(h);
    for (let r = 1; r <= nLin; r++) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cel) continue;
      if (cel.t === "d") cel.z = ehHora ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy";
      else if (cel.t === "n" && ehValor) cel.z = "#,##0.00";
    }
  });
}
