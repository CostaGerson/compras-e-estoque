// v151 — Desconto (antecipação) de duplicatas: relatório "Contratos" do Bradesco Net Empresa.
// Tratamento:
//  1) cada boleto do contrato que está em aberto no contas a receber é baixado como DESCONTADO pelo valor cheio
//     (a receita é do título inteiro, na data do contrato);
//  2) o custo da operação vira conta a pagar já paga: JUROS (2135000), IOF (2115130), TAC e tarifa (2134000);
//  3) na DRE: o crédito do extrato (valor líquido) é desmembrado em +valor da operação (1118000 ANTECIPAÇÃO DE
//     DUPLICATAS, receita) − juros − IOF − TAC − tarifa — receita bruta e despesa financeira aparecem separadas.
//     Se o extrato ainda não subiu, fica pendente e é feito quando ele entrar.
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { garantirContas } from "@/lib/fin";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (s) => r2(Number(String(s || "0").replace(/\./g, "").replace(",", ".")));
const dISO = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const dBR = (s) => String(s).slice(0, 10).split("-").reverse().join("/");
const DIA = 86400000;
const CONTAS = { receita: "1118000", juros: "2135000", iof: "2115130", tac: "2134000", tarifa: "2134000" };

export const ehAntecipacao = (t) => /Contratos/.test(t) && /Produto:?\s*DESCONTO|DESCONTO\s+Produto/i.test(t) && /Valor l[ií]quido/i.test(t);

// texto na ordem em que o PDF grava (mantém a linha da tabela inteira, mesmo com o sacado quebrado em duas linhas)
async function textoPlano(buf) {
  const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const PDFJS = mod.default || mod;
  PDFJS.disableWorker = true;
  const doc = await PDFJS.getDocument({ data: new Uint8Array(buf) });
  let t = "";
  for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); t += c.items.map((x) => x.str).join(" ") + " "; }
  doc.destroy();
  return t.replace(/\s+/g, " ");
}

export async function lerAntecipacao(buf) {
  const t = await textoPlano(buf);
  if (!ehAntecipacao(t)) throw new Error("Não é um relatório de contrato de desconto de duplicatas (Bradesco › Contratos).");
  const v = (re) => { const m = t.match(re); return m ? num(m[1]) : 0; };
  const ct = t.match(/(\d{8,})\s*\|\s*Data:\s*(\d{2}\/\d{2}\/\d{4})/) || t.match(/Contrato:\s*(\d{8,})\s*\|\s*Data:\s*(\d{2}\/\d{2}\/\d{4})/);
  const c = {
    contrato: ct?.[1] || null, data: dISO(ct?.[2]),
    valorOperacao: v(/Valor opera[cç][aã]o:\s*R\$\s*([\d.]+,\d{2})/i), juros: v(/Juros:\s*R\$\s*([\d.]+,\d{2})/i),
    iof: v(/IOF:\s*R\$\s*([\d.]+,\d{2})/i), tac: v(/TAC:\s*R\$\s*([\d.]+,\d{2})/i), tarifa: v(/Tarifa de registro do t[ií]tulo:\s*R\$\s*([\d.]+,\d{2})/i),
    valorLiquido: v(/Valor l[ií]quido:\s*R\$\s*([\d.]+,\d{2})/i), taxa: (t.match(/Taxa de juros:\s*([\d.,]+%\s*a\.?m\.?)/i) || [])[1] || null,
    qtd: Number((t.match(/Quantidade de parcelas:\s*(\d+)/i) || [])[1]) || null,
  };
  if (!c.contrato || !c.data) throw new Error("Não achei o nº e a data do contrato.");
  const itens = [];
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3})\s+(\d{3,})\s+(\d+-\d+\/\d+)\s+(.*?)\s+([\d.]+,\d{2})(?=\s|$)/g;
  let m;
  while ((m = re.exec(t))) {
    let meio = m[5].trim(), situacao = "A VENCER";
    const s = meio.match(/\s(A\s+VENCER|VENCER|PAGO|VENCIDO|LIQUIDADO|BAIXADO)$/i);
    if (s) { situacao = /PAGO|LIQUIDADO/i.test(s[1]) ? "PAGO" : /VENCIDO/i.test(s[1]) ? "VENCIDO" : /BAIXADO/i.test(s[1]) ? "BAIXADO" : "A VENCER"; meio = meio.slice(0, s.index).trim(); }
    meio = meio.replace(/^A\s+/, "");   // "A" que sobra da quebra de linha de "A VENCER"
    itens.push({ vencimento: dISO(m[1]), parcela: Number(m[2]), nosso: m[3], seu: m[4], sacado: meio.toUpperCase(), situacao, valor: num(m[6]) });
  }
  const soma = r2(itens.reduce((a, i) => a + i.valor, 0));
  const custo = r2(c.juros + c.iof + c.tac + c.tarifa);
  c.prova = {
    parcelas: { pdf: c.qtd, lido: itens.length, ok: !c.qtd || c.qtd === itens.length },
    valor: { pdf: c.valorOperacao, lido: soma, ok: Math.abs(soma - c.valorOperacao) < 0.02 },
    liquido: { pdf: c.valorLiquido, lido: r2(c.valorOperacao - custo), ok: Math.abs(c.valorOperacao - custo - c.valorLiquido) < 0.02 },
  };
  return { ...c, custo, itens };
}

// casa a parcela com a conta a receber: seu número (nº do título) ou nosso número
const normDoc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const normNosso = (s) => String(s || "").replace(/\D/g, "").replace(/^0+/, "");
const nossoObs = (o) => (String(o || "").match(/NOSSO N[ºO°.]*\s*:?\s*([\d.\-\/ ]{4,})/i) || [])[1] || null;

async function indice() {
  const tits = await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", status: { notIn: ["CANCELADO"] } },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, numeroDoc: true, nossoNumero: true, observacao: true, cobranca: true, dataPagamento: true },
  });
  const porDoc = new Map(), porNosso = new Map();
  for (const t of tits) {
    if (t.numeroDoc) porDoc.set(normDoc(t.numeroDoc), t);
    const n = normNosso(t.nossoNumero || nossoObs(t.observacao));
    if (n) { porNosso.set(n, t); if (n.length > 1) porNosso.set(n.slice(0, -1), t); }
  }
  return (it) => porDoc.get(normDoc(it.seu)) || porNosso.get(normNosso(it.nosso)) || null;
}

const saidaT = (t) => t && ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: t.vencimento.toISOString().slice(0, 10), status: t.status, cobranca: t.cobranca });

// crédito do extrato com o valor líquido, perto da data do contrato, ainda inteiro
async function acharCredito(c) {
  const d = dUTC(c.data);
  const l = await prisma.finLancamento.findMany({
    where: { valor: c.valorLiquido, data: { gte: new Date(d - DIA), lte: new Date(+d + 5 * DIA) }, desmembrado: false, paiId: null, substituido: false },
    orderBy: { data: "asc" }, take: 3,
  });
  return l[0] || null;
}

export async function analisarAntecipacao(nome, b64) {
  const buf = Buffer.from(String(b64 || ""), "base64");
  const c = await lerAntecipacao(buf);
  const hash = createHash("sha256").update(buf).digest("hex");
  const ja = await prisma.finAntecipacao.findFirst({ where: { OR: [{ contrato: c.contrato }, { hash }] }, select: { id: true, createdAt: true, lancamentoId: true } });
  const achar = await indice();
  const itens = c.itens.map((it) => {
    const t = achar(it);
    const acao = !t ? "CRIAR" : t.status === "ABERTO" ? "BAIXAR" : "JA_BAIXADA";
    return { ...it, conta: saidaT(t), acao, difValor: t ? r2(Number(t.valor) - it.valor) : null };
  });
  const credito = await acharCredito(c);
  return {
    nome, ...c, itens, jaImportado: ja ? { em: ja.createdAt } : null,
    credito: credito ? { id: credito.id, data: credito.data.toISOString().slice(0, 10), banco: credito.banco, historico: credito.historico, valor: Number(credito.valor) } : null,
  };
}

// abre o crédito do extrato em receita cheia − encargos (desmembramento)
async function abrirCredito(a, quem) {
  if (a.lancamentoId) return true;
  const c = { data: a.data.toISOString().slice(0, 10), valorLiquido: Number(a.valorLiquido) };
  const o = await acharCredito(c);
  if (!o) return false;
  await garantirContas();
  const contas = await prisma.finConta.findMany({ where: { codigo: { in: Object.values(CONTAS) } }, select: { id: true, codigo: true } });
  const id = (k) => contas.find((x) => x.codigo === CONTAS[k])?.id || null;
  const partes = [
    { valor: Number(a.valorOperacao), contaId: id("receita"), historico: `DESCONTO DE DUPLICATAS · CONTRATO ${a.contrato} · VALOR DOS TÍTULOS` },
    { valor: -Number(a.juros), contaId: id("juros"), historico: `JUROS · DESCONTO CONTRATO ${a.contrato}` },
    { valor: -Number(a.iof), contaId: id("iof"), historico: `IOF · DESCONTO CONTRATO ${a.contrato}` },
    { valor: -Number(a.tac), contaId: id("tac"), historico: `TAC · DESCONTO CONTRATO ${a.contrato}` },
    { valor: -Number(a.tarifa), contaId: id("tarifa"), historico: `TARIFA DE REGISTRO · DESCONTO CONTRATO ${a.contrato}` },
  ].filter((p) => Math.abs(p.valor) >= 0.005);
  const soma = r2(partes.reduce((s, p) => s + p.valor, 0));
  if (Math.abs(soma - Number(o.valor)) > 0.01) return false;
  await prisma.$transaction([
    prisma.finLancamento.update({ where: { id: o.id }, data: { desmembrado: true } }),
    prisma.finLancamento.createMany({
      data: partes.map((p) => ({
        competencia: o.competencia, arquivoId: o.arquivoId, banco: o.banco, data: o.data, historico: p.historico.toUpperCase(), documento: o.documento,
        identificacao: `CONTRATO DE DESCONTO ${a.contrato}`, valor: p.valor, origem: "PARTE", paiId: o.id, ordem: o.ordem, contaId: p.contaId, identificadoPor: quem || "SISTEMA",
      })),
    }),
    prisma.finAntecipacao.update({ where: { id: a.id }, data: { lancamentoId: o.id } }),
  ]);
  return true;
}

export async function aplicarAntecipacao(nome, b64, { quem } = {}) {
  const r = await analisarAntecipacao(nome, b64);
  const buf = Buffer.from(String(b64), "base64");
  // contrato já importado: REPROCESSA (cada passo é idempotente) — completa o que faltou numa importação anterior
  const existente = await prisma.finAntecipacao.findUnique({ where: { contrato: r.contrato } });
  const a = existente || await prisma.finAntecipacao.create({
    data: {
      contrato: r.contrato, data: dUTC(r.data), valorOperacao: r.valorOperacao, juros: r.juros, iof: r.iof, tac: r.tac, tarifa: r.tarifa,
      valorLiquido: r.valorLiquido, taxa: r.taxa, itens: r.itens.map(({ conta, ...i }) => ({ ...i, contaId: conta?.id || null })),
      nome: String(nome || "contrato.pdf"), hash: createHash("sha256").update(buf).digest("hex"), conteudo: String(b64), criadoPorNome: quem || null,
    },
  });
  const out = { reprocessado: !!existente, contrato: r.contrato, baixadas: 0, valorBaixado: 0, jaBaixadas: 0, semConta: 0, criadas: 0, valorCriado: 0, encargos: 0, valorEncargos: 0, dre: false };
  const anexo = { nome: `CONTRATO DESCONTO ${r.contrato}.pdf`, mime: "application/pdf", tamanho: buf.length, conteudo: String(b64), hash: a.hash, criadoPorNome: quem || null };
  // 1) baixa os boletos pelo valor cheio
  for (const it of r.itens) {
    if (!it.conta) {   // boleto descontado que não existe no contas a receber: cria já recebido (descontado) e com crítica
      const chave = `DESCONTO|237|${r.contrato}|P${it.parcela}`;
      if (await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } })) { out.jaBaixadas++; continue; }
      await garantirContas();
      const venda = await prisma.finConta.findUnique({ where: { codigo: "1111000" }, select: { id: true } });
      const nf = String(it.seu).split("-")[0];
      const t = await prisma.finTitulo.create({
        data: {
          tipo: "RECEBER", titulo: `NF ${it.seu}`, parceiro: it.sacado, numeroDoc: it.seu, nossoNumero: it.nosso, valor: it.valor,
          vencimento: dUTC(it.vencimento), competencia: it.vencimento.slice(0, 7), status: "PAGO", dataPagamento: dUTC(r.data), valorPago: it.valor,
          cobranca: "DESCONTADO", formaPagamento: "DESCONTO", previsao: false, valorConfirmado: true, rateio: venda ? [{ contaId: venda.id, pct: 100 }] : [],
          forma: "IMPORTACAO", chaveImport: chave, criadoPorNome: quem || null,
          observacao: `DESCONTADA NO CONTRATO ${r.contrato} (${dBR(r.data)}) · PARCELA ${it.parcela}/${r.itens.length}`,
          critica: `Título descontado no contrato ${r.contrato} que NÃO estava no contas a receber — criado pela antecipação. Confira a NF ${nf}, o cliente e o valor.`,
        },
      });
      await prisma.finTituloAnexo.create({ data: { ...anexo, tituloId: t.id } });
      out.criadas++; out.valorCriado = r2(out.valorCriado + it.valor);
      continue;
    }
    const t = await prisma.finTitulo.findUnique({ where: { id: it.conta.id } });
    if (!t) continue;
    const obs = `DESCONTADA NO CONTRATO ${r.contrato} (${dBR(r.data)}) · PARCELA ${it.parcela}/${r.itens.length}`;
    if (t.status === "ABERTO") {
      await prisma.finTitulo.update({
        where: { id: t.id },
        data: { status: "PAGO", dataPagamento: dUTC(r.data), valorPago: it.valor, cobranca: "DESCONTADO", formaPagamento: "DESCONTO", previsao: false, valorConfirmado: true,
          nossoNumero: t.nossoNumero || it.nosso, observacao: [t.observacao, obs].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem || null },
      });
      out.baixadas++; out.valorBaixado = r2(out.valorBaixado + it.valor);
    } else {
      if (!String(t.observacao || "").includes(`CONTRATO ${r.contrato}`)) await prisma.finTitulo.update({ where: { id: t.id }, data: { observacao: [t.observacao, obs].filter(Boolean).join(" · ").slice(0, 1000) } });
      out.jaBaixadas++;
    }
    if (!(await prisma.finTituloAnexo.findFirst({ where: { tituloId: t.id, hash: a.hash }, select: { id: true } }))) await prisma.finTituloAnexo.create({ data: { ...anexo, tituloId: t.id } });
  }
  // 2) encargos como contas a pagar já pagas
  await garantirContas();
  const contas = await prisma.finConta.findMany({ where: { codigo: { in: Object.values(CONTAS) } }, select: { id: true, codigo: true } });
  const idDe = (cod) => contas.find((x) => x.codigo === cod)?.id;
  for (const [k, rot] of [["juros", "JUROS"], ["iof", "IOF"], ["tac", "TAC"], ["tarifa", "TARIFA DE REGISTRO"]]) {
    const val = r2(r[k]);
    if (!(val > 0)) continue;
    const chave = `DESCONTO|237|${r.contrato}|${k.toUpperCase()}`;
    if (await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } })) continue;
    const t = await prisma.finTitulo.create({
      data: {
        tipo: "PAGAR", titulo: `${rot} · DESCONTO DE DUPLICATAS · CONTRATO ${r.contrato}`, parceiro: "BANCO BRADESCO S.A.", documento: "60746948000112",
        numeroDoc: r.contrato, valor: val, vencimento: dUTC(r.data), competencia: r.data.slice(0, 7), status: "PAGO", dataPagamento: dUTC(r.data), valorPago: val,
        previsao: false, valorConfirmado: true, rateio: idDe(CONTAS[k]) ? [{ contaId: idDe(CONTAS[k]), pct: 100 }] : [], forma: "IMPORTACAO", formaPagamento: "DEBITO_AUTOMATICO",
        chaveImport: chave, observacao: `ENCARGO DO DESCONTO DE ${r.itens.length} DUPLICATA(S) · VALOR DA OPERAÇÃO ${r.valorOperacao.toFixed(2)} · LÍQUIDO ${r.valorLiquido.toFixed(2)}${r.taxa ? ` · TAXA ${r.taxa}` : ""}`,
        criadoPorNome: quem || null,
      },
    });
    await prisma.finTituloAnexo.create({ data: { ...anexo, tituloId: t.id } });
    out.encargos++; out.valorEncargos = r2(out.valorEncargos + val);
  }
  // 3) DRE: abre o crédito do extrato
  out.dre = await abrirCredito(a, quem).catch(() => false);
  return out;
}

// contratos importados antes do extrato: tenta abrir o crédito de novo (roda quando um extrato entra)
export async function conciliarAntecipacoesPendentes(quem) {
  const pend = await prisma.finAntecipacao.findMany({ where: { lancamentoId: null }, select: { id: true, contrato: true, data: true, valorOperacao: true, juros: true, iof: true, tac: true, tarifa: true, valorLiquido: true, lancamentoId: true } });
  let n = 0;
  for (const a of pend) if (await abrirCredito(a, quem).catch(() => false)) n++;
  return n;
}

export async function listarAntecipacoes() {
  const l = await prisma.finAntecipacao.findMany({ orderBy: { data: "desc" }, select: { id: true, contrato: true, data: true, valorOperacao: true, juros: true, iof: true, tac: true, tarifa: true, valorLiquido: true, taxa: true, lancamentoId: true, itens: true, criadoPorNome: true, createdAt: true } });
  return l.map((a) => ({ ...a, data: a.data.toISOString().slice(0, 10), valorOperacao: Number(a.valorOperacao), juros: Number(a.juros), iof: Number(a.iof), tac: Number(a.tac), tarifa: Number(a.tarifa), valorLiquido: Number(a.valorLiquido), qtd: Array.isArray(a.itens) ? a.itens.length : 0, itens: undefined }));
}
