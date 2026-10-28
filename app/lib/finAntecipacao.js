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

export const ehAntecipacao = (t) => (/Contratos/.test(t) && /Produto:?\s*DESCONTO|DESCONTO\s+Produto/i.test(t) && /Valor l[ií]quido/i.test(t)) || ehRecebiveis(t);
// v176 — Bradesco "Antecipação de Recebíveis - Duplicatas" (sem nº de contrato, sem nº do título e sem sacado)
export const ehRecebiveis = (t) => /Antecipa[çc][ãa]o de Receb[ií]veis/i.test(t) && /Valor l[ií]quido opera[çc][ãa]o/i.test(t);

function lerRecebiveis(t) {
  const v = (re) => { const m = t.match(re); return m ? num(m[1]) : 0; };
  const data = dISO((t.match(/Data da solicita[çc][ãa]o:?\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || (t.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
  const hora = ((t.match(/Data:\s*\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{2})h(\d{2})/) || []).slice(1).join("")) || "0000";
  const c = {
    formato: "RECEBIVEIS", data,
    valorOperacao: v(/Valor total duplicatas:?\s*R\$\s*([\d.]+,\d{2})/i), juros: v(/Valor total juros:?\s*R\$\s*([\d.]+,\d{2})/i),
    iof: v(/Valor total IOF:?\s*R\$\s*([\d.]+,\d{2})/i), tac: v(/Valor TAC:?\s*R\$\s*([\d.]+,\d{2})/i), tarifa: 0,
    valorLiquido: v(/Valor l[ií]quido opera[çc][ãa]o:?\s*R\$\s*([\d.]+,\d{2})/i),
    taxa: (t.match(/Taxa de juros:?\s*([\d.,]+%\s*a\.?m\.?)/i) || [])[1] || null,
    qtd: Number((t.match(/Quantidade total duplicatas:?\s*(\d+)/i) || [])[1]) || null,
  };
  if (!c.data) throw new Error("Não achei a data da antecipação.");
  // sem nº de contrato no PDF: identifica pela data/hora da solicitação e pelo líquido
  c.contrato = `REC-${c.data.replace(/-/g, "")}-${hora}-${Math.round(c.valorLiquido * 100)}`;
  const itens = [];
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(\d{4})\s+(\d{3})\s+[\d]+\s*-\s*[\dXx]\s+(\d{1,4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  let m;
  while ((m = re.exec(t))) itens.push({ vencimento: dISO(m[1]), parcela: itens.length + 1, prazo: Number(m[4]), nosso: null, seu: null, sacado: "", situacao: "A VENCER", valor: num(m[5]), jurosItem: num(m[6]), iofItem: num(m[7]) });
  const soma = r2(itens.reduce((a, i) => a + i.valor, 0));
  const custo = r2(c.juros + c.iof + c.tac + c.tarifa);
  c.prova = {
    parcelas: { pdf: c.qtd, lido: itens.length, ok: !c.qtd || c.qtd === itens.length },
    valor: { pdf: c.valorOperacao, lido: soma, ok: Math.abs(soma - c.valorOperacao) < 0.02 },
    liquido: { pdf: c.valorLiquido, lido: r2(c.valorOperacao - custo), ok: Math.abs(c.valorOperacao - custo - c.valorLiquido) < 0.02 },
  };
  return { ...c, custo, itens };
}

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
  if (ehRecebiveis(t)) return lerRecebiveis(t);
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
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, numeroDoc: true, nossoNumero: true, observacao: true, cobranca: true, dataPagamento: true,
      antecipacaoPrevista: true, valorBruto: true, vencimentoBoleto: true },
  });
  // v175.2 — boleto com antecipação prevista (sem nº do título ainda): casa pelo valor de face e, no empate, pelo vencimento do boleto
  const previstas = tits.filter((t) => t.antecipacaoPrevista && t.status === "ABERTO" && t.valorBruto);
  const usadas = new Set();
  const prevista = (it) => {
    const cands = previstas.filter((t) => !usadas.has(t.id) && Math.abs(Number(t.valorBruto) - it.valor) <= Math.max(1, Number(t.valorBruto) * 0.01))
      .sort((a, b) => Math.abs(Number(a.valorBruto) - it.valor) - Math.abs(Number(b.valorBruto) - it.valor)
        || Math.abs(+a.vencimentoBoleto - +dUTC(it.vencimento)) - Math.abs(+b.vencimentoBoleto - +dUTC(it.vencimento)));
    if (cands[0]) usadas.add(cands[0].id);
    return cands[0] || null;
  };
  const porDoc = new Map(), porNosso = new Map();
  for (const t of tits) {
    if (t.numeroDoc) porDoc.set(normDoc(t.numeroDoc), t);
    const n = normNosso(t.nossoNumero || nossoObs(t.observacao));
    if (n) { porNosso.set(n, t); if (n.length > 1) porNosso.set(n.slice(0, -1), t); }
  }
  // v176 — sem nº do título (antecipação de recebíveis): casa pelo valor e pelo vencimento do boleto (exato; senão até 5 dias)
  const abertas = tits.filter((t) => t.status === "ABERTO");
  const usadasV = new Set();
  const porValorVenc = (it) => {
    if (it.seu || it.nosso) return null;
    const v = dUTC(it.vencimento);
    const c = abertas.filter((t) => !usadasV.has(t.id) && Math.abs(Number(t.valor) - it.valor) <= 0.01)
      .map((t) => ({ t, d: Math.abs(+t.vencimento - +v) / DIA })).filter((x) => x.d <= 5).sort((a, b) => a.d - b.d)[0];
    if (c) usadasV.add(c.t.id);
    return c?.t || null;
  };
  return (it) => (it.seu && porDoc.get(normDoc(it.seu))) || (it.nosso && porNosso.get(normNosso(it.nosso))) || porValorVenc(it) || prevista(it) || null;
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
    return { ...it, conta: saidaT(t), acao, difValor: t ? r2(Number(t.antecipacaoPrevista && t.valorBruto ? t.valorBruto : t.valor) - it.valor) : null, prevista: !!t?.antecipacaoPrevista };
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
          tipo: "RECEBER", titulo: it.seu ? `NF ${it.seu}` : `DUPLICATA DESCONTADA · VCTO ${dBR(it.vencimento)}`, parceiro: it.sacado || "NÃO IDENTIFICADO", numeroDoc: it.seu, nossoNumero: it.nosso, valor: it.valor,
          vencimento: dUTC(it.vencimento), competencia: it.vencimento.slice(0, 7), status: "PAGO", dataPagamento: dUTC(r.data), valorPago: it.valor,
          cobranca: "DESCONTADO", formaPagamento: "DESCONTO", previsao: false, valorConfirmado: true, antecipadoForma: "BRADESCO", antecipadoEm: dUTC(r.data), antecipacaoId: a.id, rateio: venda ? [{ contaId: venda.id, pct: 100 }] : [],
          forma: "IMPORTACAO", chaveImport: chave, criadoPorNome: quem || null,
          observacao: `DESCONTADA NO CONTRATO ${r.contrato} (${dBR(r.data)}) · PARCELA ${it.parcela}/${r.itens.length}`,
          critica: it.seu ? `Título descontado no contrato ${r.contrato} que NÃO estava no contas a receber — criado pela antecipação. Confira a NF ${nf}, o cliente e o valor.`
            : `Duplicata de ${dBR(it.vencimento)} (R$ ${it.valor.toFixed(2).replace(".", ",")}) descontada na antecipação de ${dBR(r.data)} sem conta a receber com esse valor e vencimento — confira o cliente e a NF.`,
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
        data: { status: "PAGO", dataPagamento: dUTC(r.data), valorPago: it.valor, cobranca: "DESCONTADO", formaPagamento: "DESCONTO", previsao: false, valorConfirmado: true, antecipadoForma: "BRADESCO", antecipadoEm: dUTC(r.data), antecipacaoId: a.id,
          // antecipação prevista: confirma pelo contrato (volta ao valor de face; os encargos entram como contas pagas)
          ...(t.antecipacaoPrevista ? { valor: it.valor, vencimento: dUTC(it.vencimento), competencia: it.vencimento.slice(0, 7), numeroDoc: t.numeroDoc || it.seu, antecipacaoPrevista: false } : {}),
          nossoNumero: t.nossoNumero || it.nosso, observacao: [t.observacao, obs].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem || null },
      });
      out.baixadas++; out.valorBaixado = r2(out.valorBaixado + it.valor);
    } else {
      if (!String(t.observacao || "").includes(`CONTRATO ${r.contrato}`)) await prisma.finTitulo.update({ where: { id: t.id }, data: { observacao: [t.observacao, obs].filter(Boolean).join(" · ").slice(0, 1000) } });
      if (t.cobranca === "DESCONTADO" && !t.antecipacaoId) await prisma.finTitulo.update({ where: { id: t.id }, data: { antecipadoForma: t.antecipadoForma || "BRADESCO", antecipadoEm: t.antecipadoEm || dUTC(r.data), antecipacaoId: a.id } });
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

// v175.2 — custo da antecipação pelos contratos já importados:
// juros + IOF proporcionais a valor × dias até o vencimento; tarifa por título e TAC por contrato pela média.
export async function custoAntecipacao() {
  const cs = await prisma.finAntecipacao.findMany({ select: { data: true, juros: true, iof: true, tac: true, tarifa: true, itens: true } });
  let varC = 0, base = 0, tarifa = 0, nTit = 0, tac = 0;
  for (const c of cs) {
    const its = Array.isArray(c.itens) ? c.itens : [];
    const vd = its.reduce((s, i) => s + (Number(i.valor) || 0) * Math.max(0, Math.round((+dUTC(i.vencimento) - +c.data) / DIA)), 0);
    if (!vd) continue;
    varC += Number(c.juros) + Number(c.iof); base += vd; tarifa += Number(c.tarifa); nTit += its.length; tac += Number(c.tac);
  }
  if (!base) return null;
  return { porValorDia: varC / base, tarifaTitulo: nTit ? tarifa / nTit : 0, tacContrato: tac / cs.length, contratos: cs.length,
    taxaMes: Math.round((varC / base) * 30 * 10000) / 100 };   // % ao mês equivalente (juros + IOF)
}
export function liquidoEstimado(valor, dataAntecipacao, vencimentoBoleto, k) {
  if (!k) return null;
  const dias = Math.max(0, Math.round((+dUTC(vencimentoBoleto) - +dUTC(dataAntecipacao)) / DIA));
  const custo = r2(valor * dias * k.porValorDia + k.tarifaTitulo + k.tacContrato);
  return { liquido: r2(valor - custo), custo, dias };
}


// v260 — comprovante "Antecipação de Recebíveis - Duplicatas" (Bradesco Net Empresa): não traz a lista de títulos.
// Lê os valores do contrato e sugere os títulos a receber em aberto, entre o 1º e o último vencimento, cuja soma bate com o valor da operação.
export async function lerComprovanteAntecipacao(b64) {
  const t = await textoPlano(Buffer.from(String(b64 || ""), "base64"));
  if (!/Antecipa[cç][aã]o de Receb[ií]veis/i.test(t) || !/Valor da Opera[cç][aã]o/i.test(t)) throw new Error("Não é um comprovante de antecipação de recebíveis do Bradesco.");
  // o PDF sai com o valor ANTES do rótulo ("R$ 68,48 IOF:") ou depois ("IOF: R$ 68,48"), conforme a versão do Net Empresa
  const inv = /\d,\d{2}\s*Valor da Opera[cç][aã]o/i.test(t);
  const VAL = "R\\$\\s*([\\d.]+,\\d{2})", DAT = "(\\d{2}\\/\\d{2}\\/\\d{4})", TX = "([\\d.,]+%\\s*a\\.?m\\.?)";
  const pega = (rot, pad) => { const m = t.match(new RegExp(inv ? `${pad}[^\\d%]{0,3}${rot}` : `${rot}\\s*${pad}`, "i")); return m ? m[1] : null; };
  const v = (rot) => num(pega(rot, VAL));
  const c = {
    contrato: (t.match(/Documento:\s*(\d{6,})/i) || [])[1] || null,
    data: dISO((t.match(/Data da Opera[cç][aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1]),
    primeiro: dISO(pega("Data de vencimento do 1[oº°] T[ií]tulo:", DAT) || pega("do 1[oº°] T[ií]tulo:", DAT)),
    ultimo: dISO(pega("Data de vencimento do [uú]ltimo T[ií]tulo:", DAT) || pega("do [uú]ltimo T[ií]tulo:", DAT)),
    valorOperacao: v("Valor da Opera[cç][aã]o:"), iof: v("IOF:"), tarifa: v("Tarifa:"), juros: v("Valor dos juros:"), valorLiquido: v("Valor l[ií]quido:"),
    taxa: (t.match(inv ? /([\d.,]+%\s*a\.?m\.?)[^:]{0,40}?Taxa de juros:/i : /Taxa de juros:\s*([\d.,]+%\s*a\.?m\.?)/i) || [])[1] || null,
  };
  if (!c.valorOperacao) throw new Error("Não achei o valor da operação no comprovante.");
  let sugeridos = [], combinacoes = 0;
  if (c.primeiro && c.ultimo) {
    const tits = await prisma.finTitulo.findMany({
      where: { tipo: "RECEBER", status: "ABERTO", antecipacaoId: null, vencimento: { gte: new Date(`${c.primeiro}T00:00:00Z`), lte: new Date(`${c.ultimo}T00:00:00Z`) } },
      select: { id: true, valor: true, vencimento: true }, orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    });
    const T = Math.round(c.valorOperacao * 100);
    const it = tits.map((x) => ({ id: x.id, c: Math.round(Number(x.valor) * 100) })).filter((x) => x.c > 0 && x.c <= T);
    if (it.length && it.length < 3000 && it.length * T <= 4e8) {
      // soma exata (mochila 0/1): dp[s] = item que alcançou a soma s pela primeira vez; n[s] = nº de combinações (até 2)
      const dp = new Int16Array(T + 1).fill(-1), n = new Uint8Array(T + 1); n[0] = 1;
      it.forEach((x, i) => { for (let s = T; s >= x.c; s--) if (n[s - x.c]) { if (dp[s] === -1) dp[s] = i; n[s] = Math.min(2, n[s] + n[s - x.c]); } });
      combinacoes = n[T];
      // só marca sozinho quando a combinação é única; com várias, quem marca é a pessoa (nosso número da tela do banco)
      if (combinacoes === 1) { let s = T; while (s > 0) { const i = dp[s]; sugeridos.push(it[i].id); s -= it[i].c; } }
    }
  }
  return { ...c, sugeridos, combinacoes };
}

// ==================== v334 — Relatório "Títulos Baixados" (cliente pagou a duplicata descontada) ====================
export const ehTitulosBaixados = (t) => /T[íi]tulos\s+Baixados/i.test(t) && /Produto:?\s*DESCONTO/i.test(t) && /Valor\s+total\s+baixado/i.test(t);

export function parseTitulosBaixados(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const total = num((t.match(/R\$\s*([\d.]+,\d{2})\s*Valor\s+total\s+baixado|Valor\s+total\s+baixado:?\s*R\$\s*([\d.]+,\d{2})/i) || []).slice(1).find(Boolean));
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d{2}\/\d{2}\/\d{4})\s+Nosso\s+N[úu]mero:\s*(\d+)\s+Sacado:\s*(.+?)\s+Valor\s+Baixado:\s*R\$\s*([\d.]+,\d{2})\s+Valor\s+da\s+Nota:\s*R\$\s*([\d.]+,\d{2})/gi;
  const itens = []; let m;
  while ((m = re.exec(t))) {
    itens.push({
      vencimento: dISO(m[1]), parcela: Number(m[2]), contrato: m[3], seuNumero: m[4], dataBaixa: dISO(m[5]),
      nossoNumero: m[6], sacado: m[7].trim().toUpperCase(), valorBaixado: num(m[8]), valorNota: num(m[9]),
    });
  }
  return { total, itens };
}

// v336 — Relatório "Títulos Pagos" (mesmo efeito do Baixados: cliente pagou → liquida). Não traz data por título:
// usa o vencimento, limitado ao "Último movimento".
export const ehTitulosPagos = (t) => /T[íi]tulos\s+Pagos/i.test(t) && /Produto:?\s*DESCONTO/i.test(t) && /Valor\s+total\s+cobrado/i.test(t);

export function parseTitulosPagos(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const total = num((t.match(/R\$\s*([\d.]+,\d{2})\s*Valor\s+total\s+cobrado|Valor\s+total\s+cobrado:?\s*R\$\s*([\d.]+,\d{2})/i) || []).slice(1).find(Boolean));
  const ult = dISO((t.match(/(\d{2}\/\d{2}\/\d{4})\s*[ÚU]ltimo\s+movimento|[ÚU]ltimo\s+movimento:?\s*(\d{2}\/\d{2}\/\d{4})/i) || []).slice(1).find(Boolean));
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s+(\S+)\s+Nosso\s+N[úu]mero:\s*(\d+)\s+Sacado:\s*(.+?)\s+Valor\s+da\s+Nota:\s*R\$\s*([\d.]+,\d{2})\s+Valor\s+Cobrado:\s*R\$\s*([\d.]+,\d{2})/gi;
  const itens = []; let m;
  while ((m = re.exec(t))) {
    const venc = dISO(m[1]);
    itens.push({
      vencimento: venc, parcela: Number(m[2]), contrato: m[3], seuNumero: m[4], dataBaixa: ult && venc > ult ? ult : venc,
      nossoNumero: m[5], sacado: m[6].trim().toUpperCase(), valorNota: num(m[7]), valorBaixado: num(m[8]),
    });
  }
  return { total, itens };
}

const soDig = (s) => String(s || "").replace(/\D/g, "");
const nfDe = (seu) => String(seu || "").split(/[-\/]/)[0];   // "1910-1/2" → "1910"

// casa cada baixa com o título descontado não liquidado
export async function analisarBaixados(b64) {
  const texto = await textoPlano(Buffer.from(String(b64 || ""), "base64"));
  const pagos = ehTitulosPagos(texto);
  if (!pagos && !ehTitulosBaixados(texto)) throw new Error("Não é o relatório de Títulos Baixados / Títulos Pagos (desconto de duplicatas) do Bradesco.");
  const { total, itens } = pagos ? parseTitulosPagos(texto) : parseTitulosBaixados(texto);
  if (!itens.length) throw new Error("Não achei títulos pagos/baixados no relatório.");
  const desc = await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", OR: [{ status: "PAGO", OR: [{ cobranca: "DESCONTADO" }, { antecipadoForma: { not: null } }] }, { cobranca: "RECOMPRADO" }] },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, numeroDoc: true, nossoNumero: true, liquidadoEm: true, liquidacao: true, recompraId: true, status: true, cobranca: true },
  });
  // v540 — recompra de cada título (Títulos Baixados = o banco cobrou da Meridian: baixa a conta a pagar da recompra)
  const recs = Object.fromEntries((await prisma.finTitulo.findMany({ where: { id: { in: desc.map((d) => d.recompraId).filter(Boolean) } }, select: { id: true, status: true } })).map((c) => [c.id, c]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const usados = new Set();
  const casar = (it) => {
    const cand = desc.filter((d) => !usados.has(d.id));
    const nn = soDig(it.nossoNumero), nf = nfDe(it.seuNumero);
    // 1) nosso número bate
    let d = cand.find((x) => soDig(x.nossoNumero) && soDig(x.nossoNumero) === nn);
    // 2) NF (numeroDoc) + valor da nota próximos
    if (!d) d = cand.find((x) => nfDe(x.numeroDoc) === nf && Math.abs(Number(x.valor) - it.valorNota) <= 1);
    // 3) valor exato + nome do sacado
    if (!d) d = cand.find((x) => Math.abs(Number(x.valor) - it.valorNota) <= 0.02 && norm(x.parceiro).includes(norm(it.sacado).split(" ")[0]));
    if (d) usados.add(d.id);
    return d || null;
  };
  const linhas = itens.map((it) => {
    const d = casar(it);
    return {
      ...it,
      titulo: d ? { id: d.id, titulo: d.titulo, parceiro: d.parceiro, valor: Number(d.valor), vencimento: d.vencimento, numeroDoc: d.numeroDoc, nossoNumero: d.nossoNumero, jaLiquidado: !!d.liquidadoEm, temRecompra: !!d.recompraId } : null,
      // v540 — Títulos PAGOS: cliente pagou o boleto → liquida o título.
      //        Títulos BAIXADOS: o banco cobrou da Meridian → baixa a conta a pagar da recompra; o título volta a receber do cliente.
      status: !d ? "SEM_CONTA"
        : pagos ? ((d.status === "PAGO" && !d.liquidadoEm) || (d.status === "ABERTO" && d.cobranca === "RECOMPRADO") ? "LIQUIDAR" : "JA_LIQUIDADO")   // v545 — recomprado em aberto: o banco diz que o cliente pagou o boleto
        : (d.cobranca === "RECOMPRADO" || d.liquidacao === "RECOMPRA" || (d.recompraId && recs[d.recompraId]?.status === "PAGO")) ? "JA_RECOMPRA_PAGA"
        : "RECOMPRA",   // inclusive liquidado como "cliente pagou" por engano (ex.: NF 1964): o banco diz que cobrou da Meridian
    };
  });
  return { tipo: pagos ? "PAGOS" : "BAIXADOS", total, itens: linhas, casados: linhas.filter((l) => ["LIQUIDAR", "RECOMPRA"].includes(l.status)).length, jaLiquidados: linhas.filter((l) => l.status === "JA_LIQUIDADO").length, semConta: linhas.filter((l) => l.status === "SEM_CONTA").length };
}

// liquida (cliente pagou) os títulos baixados selecionados
export async function aplicarBaixados(b64, { ids, quem } = {}) {
  const r = await analisarBaixados(b64);
  const { liquidar, pagarRecompra } = await import("@/lib/finAntecipados");
  const alvo = r.itens.filter((l) => ["LIQUIDAR", "RECOMPRA"].includes(l.status) && l.titulo && (!ids || ids.includes(l.titulo.id)));
  const out = { tipo: r.tipo, liquidados: 0, recompras: 0, valor: 0, linhas: [], erros: [] };
  for (const l of alvo) {
    try {
      if (l.status === "LIQUIDAR") { await liquidar(l.titulo.id, l.dataBaixa, quem); out.liquidados++; out.valor = r2(out.valor + l.titulo.valor); out.linhas.push(`${l.titulo.titulo} · ${l.sacado}: liquidada (cliente pagou em ${dBR(l.dataBaixa)})`); }
      else { const x = await pagarRecompra(l.titulo.id, { data: l.dataBaixa, valor: l.valorBaixado, quem }); out.recompras++; out.valor = r2(out.valor + x.valor); out.linhas.push(`${l.titulo.titulo} · ${l.sacado}: recompra paga em ${dBR(l.dataBaixa)} (R$ ${x.valor.toFixed(2)}) — título volta a receber do cliente`); }
    } catch (e) { out.erros.push(`${l.sacado} (NF ${l.seuNumero}): ${e.message}`); }
  }
  return { ...out, total: r.total, semConta: r.semConta, jaLiquidados: r.jaLiquidados };
}

// ==================== v335 — Relatório "Títulos Vencidos" (duplicata descontada venceu no banco e o cliente não pagou) ====================
// Regra do Igor: um título antecipado só vira conta a pagar de recompra se aparecer NESTE relatório.
export const ehTitulosVencidos = (t) => /T[íi]tulos\s+Vencidos/i.test(t) && /Produto:?\s*DESCONTO/i.test(t) && /Valor\s+total\s+vencidos/i.test(t);

export function parseTitulosVencidos(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const total = num((t.match(/R\$\s*([\d.]+,\d{2})\s*Valor\s+total\s+vencidos|Valor\s+total\s+vencidos:?\s*R\$\s*([\d.]+,\d{2})/i) || []).slice(1).find(Boolean));
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s+(\S+)\s+Nosso\s+N[úu]mero:\s*(\d+)\s+Sacado:\s*(.+?)\s+Valor\s+dos\s+Encargos:\s*R\$\s*([\d.]+,\d{2})\s+Valor\s+da\s+Nota:\s*R\$\s*([\d.]+,\d{2})/gi;
  const itens = []; let m;
  while ((m = re.exec(t))) {
    itens.push({
      vencimento: dISO(m[1]), parcela: Number(m[2]), contrato: m[3], seuNumero: m[4],
      nossoNumero: m[5], sacado: m[6].trim().toUpperCase(), encargos: num(m[7]), valorNota: num(m[8]),
    });
  }
  return { total, itens };
}

// casa cada vencido com o título descontado não liquidado (mesma lógica dos baixados)
export async function analisarVencidos(b64) {
  const texto = await textoPlano(Buffer.from(String(b64 || ""), "base64"));
  if (!ehTitulosVencidos(texto)) throw new Error("Não é o relatório de Títulos Vencidos (desconto de duplicatas) do Bradesco.");
  const { total, itens } = parseTitulosVencidos(texto);
  if (!itens.length) throw new Error("Não achei títulos vencidos no relatório.");
  const desc = await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", status: "PAGO", OR: [{ cobranca: "DESCONTADO" }, { antecipadoForma: { not: null } }] },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, numeroDoc: true, nossoNumero: true, liquidadoEm: true, liquidacao: true, recompraId: true },
  });
  const recompras = await prisma.finTitulo.findMany({ where: { id: { in: desc.map((d) => d.recompraId).filter(Boolean) } }, select: { id: true, status: true } });
  const recStatus = new Map(recompras.map((c) => [c.id, c.status]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const usados = new Set();
  const casar = (it) => {
    const cand = desc.filter((d) => !usados.has(d.id));
    const nn = soDig(it.nossoNumero), nf = nfDe(it.seuNumero);
    let d = cand.find((x) => soDig(x.nossoNumero) && soDig(x.nossoNumero) === nn);
    if (!d) d = cand.find((x) => nfDe(x.numeroDoc) === nf && Math.abs(Number(x.valor) - it.valorNota) <= 1);
    if (!d) d = cand.find((x) => Math.abs(Number(x.valor) - it.valorNota) <= 0.02 && norm(x.parceiro).includes(norm(it.sacado).split(" ")[0]));
    if (d) usados.add(d.id);
    return d || null;
  };
  const linhas = itens.map((it) => {
    const d = casar(it);
    const temRecompraViva = d && d.recompraId && recStatus.get(d.recompraId) && recStatus.get(d.recompraId) !== "CANCELADO";
    return {
      ...it,
      titulo: d ? { id: d.id, titulo: d.titulo, parceiro: d.parceiro, valor: Number(d.valor), vencimento: d.vencimento, numeroDoc: d.numeroDoc, nossoNumero: d.nossoNumero, jaLiquidado: !!d.liquidadoEm, temRecompra: !!temRecompraViva } : null,
      total: r2((it.valorNota || 0) + (it.encargos || 0)),
      status: !d ? "SEM_CONTA" : d.liquidadoEm ? "JA_LIQUIDADO" : temRecompraViva ? "JA_RECOMPRA" : "RECOMPRAR",
    };
  });
  return {
    total, itens: linhas,
    recomprar: linhas.filter((l) => l.status === "RECOMPRAR").length,
    jaRecompra: linhas.filter((l) => l.status === "JA_RECOMPRA").length,
    jaLiquidados: linhas.filter((l) => l.status === "JA_LIQUIDADO").length,
    semConta: linhas.filter((l) => l.status === "SEM_CONTA").length,
  };
}

// cria a conta a pagar de recompra para os títulos vencidos selecionados
export async function aplicarVencidos(b64, { ids, quem } = {}) {
  const r = await analisarVencidos(b64);
  const { recompraPorVencido } = await import("@/lib/finAntecipados");
  const alvo = r.itens.filter((l) => l.status === "RECOMPRAR" && l.titulo && (!ids || ids.includes(l.titulo.id)));
  const out = { recompradas: 0, valor: 0, linhas: [], erros: [] };
  for (const l of alvo) {
    try {
      const res = await recompraPorVencido(l.titulo.id, { encargos: l.encargos, vencBanco: l.vencimento, quem });
      if (!res?.ja) { out.recompradas++; out.valor = r2(out.valor + (res.valor || l.total)); out.linhas.push(`${l.titulo.titulo} · ${l.sacado}: recompra criada (R$ ${(res.valor || l.total).toFixed(2)})`); }
    } catch (e) { out.erros.push(`${l.sacado} (NF ${l.seuNumero}): ${e.message}`); }
  }
  return { ...out, total: r.total, semConta: r.semConta, jaRecompra: r.jaRecompra, jaLiquidados: r.jaLiquidados };
}

// ==================== v541 — Relatório "Títulos a Vencer" (desconto de duplicatas) ====================
// Conferência: todo título do relatório tem de estar no sistema como ANTECIPADO aguardando o cliente.
// Não antecipado no sistema → marcar como antecipado (contrato do relatório). Antecipado no sistema que não está no
// relatório (a vencer) → aviso.
export const ehTitulosAVencer = (t) => /T[íi]tulos\s+a\s+Vencer/i.test(t) && /Produto:?\s*DESCONTO/i.test(t) && /Valor\s+total\s+a\s+vencer/i.test(t);

export function parseTitulosAVencer(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const total = num((t.match(/R\$\s*([\d.]+,\d{2})\s*Valor\s+total\s+a\s+vencer|Valor\s+total\s+a\s+vencer:?\s*R\$\s*([\d.]+,\d{2})/i) || []).slice(1).find(Boolean));
  const consulta = dISO((t.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s*Data\s+da\s+consulta|Data\s+da\s+consulta:?\s*(\d{2}\/\d{2}\/\d{4})/i) || []).slice(1).find(Boolean));
  const re = /(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d{8,})\s+(\S+)\s+Nosso\s+N[úu]mero:\s*(\d+)\s+Sacado:\s*(.*?)\s*Juros:\s*R\$\s*([\d.]+,\d{2})\s+Valor\s+da\s+Nota:\s*R\$\s*([\d.]+,\d{2})/gi;
  const itens = []; let m;
  while ((m = re.exec(t))) {
    itens.push({ vencimento: dISO(m[1]), parcela: Number(m[2]), contrato: m[3], seuNumero: m[4], nossoNumero: m[5],
      sacado: m[6].trim().toUpperCase(), juros: num(m[7]), valorNota: num(m[8]) });
  }
  return { total, consulta, itens };
}

const antPend = (d) => d.status === "PAGO" && (d.antecipadoForma || d.cobranca === "DESCONTADO") && !d.liquidadoEm;
export async function analisarAVencer(b64) {
  const texto = await textoPlano(Buffer.from(String(b64 || ""), "base64"));
  if (!ehTitulosAVencer(texto)) throw new Error("Não é o relatório de Títulos a Vencer (desconto de duplicatas) do Bradesco.");
  const { total, consulta, itens } = parseTitulosAVencer(texto);
  if (!itens.length) throw new Error("Não achei títulos no relatório.");
  const { montarCasador, baseNosso } = await import("@/lib/finRetorno");
  const casar = await montarCasador();
  const todos = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: { not: "CANCELADO" } },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, numeroDoc: true, nossoNumero: true, status: true, cobranca: true, antecipadoForma: true, antecipadoEm: true, antecipacaoId: true, liquidadoEm: true, liquidacao: true, recompraId: true, observacao: true } });
  const porId = new Map(todos.map((x) => [x.id, x]));
  const contratos = Object.fromEntries((await prisma.finAntecipacao.findMany({ where: { contrato: { in: [...new Set(itens.map((i) => i.contrato))] } }, select: { id: true, contrato: true, data: true } })).map((c) => [c.contrato, c]));
  const usados = new Set();
  const linhas = itens.map((it) => {
    const bn = baseNosso(it.nossoNumero);
    let d = todos.find((x) => !usados.has(x.id) && bn && baseNosso(x.nossoNumero) === bn) || null;
    if (!d) { const c = casar({ numeroDoc: it.seuNumero, controle: "", nosso: it.nossoNumero, valor: it.valorNota }); d = c.t && !usados.has(c.t.id) ? porId.get(c.t.id) : null; }
    if (d) usados.add(d.id);
    let status, msg = null;
    if (!d) { status = "SEM_CONTA"; msg = "Não há conta a receber com esse nosso nº / NF no sistema."; }
    else if (antPend(d)) status = "OK";
    else if (d.status === "ABERTO" && d.cobranca !== "RECOMPRADO") { status = "MARCAR"; msg = "Em aberto no sistema, mas está descontado no banco — marcar como antecipado."; }
    else if (d.cobranca === "RECOMPRADO") { status = "DIVERGENTE"; msg = "No sistema está recomprado, mas o banco ainda lista como a vencer."; }
    else if (d.status === "PAGO" && d.liquidadoEm) { status = "DIVERGENTE"; msg = `No sistema já está liquidado (${d.liquidacao === "RECOMPRA" ? "recompra" : "cliente pagou"} em ${dBR(d.liquidadoEm.toISOString())}), mas o banco ainda lista como a vencer.`; }
    else { status = "DIVERGENTE"; msg = `No sistema está ${d.status === "PAGO" ? "recebido (não como antecipado)" : d.status.toLowerCase()} — confira.`; }
    const ctr = contratos[it.contrato] || null;
    return { ...it, status, msg, contratoNoSistema: !!ctr,
      titulo: d ? { id: d.id, titulo: d.titulo, parceiro: d.parceiro, valor: Number(d.valor), vencimento: d.vencimento.toISOString().slice(0, 10), status: d.status } : null };
  });
  // antecipados no sistema, ainda a vencer na data da consulta, que o banco não listou
  const ref = consulta || new Date().toISOString().slice(0, 10);
  const fora = todos.filter((d) => antPend(d) && !usados.has(d.id) && d.vencimento.toISOString().slice(0, 10) >= ref && (d.antecipadoForma || "BRADESCO") === "BRADESCO")
    .map((d) => ({ id: d.id, titulo: d.titulo, parceiro: d.parceiro, valor: Number(d.valor), vencimento: d.vencimento.toISOString().slice(0, 10), nossoNumero: d.nossoNumero }));
  const c = (s) => linhas.filter((l) => l.status === s).length;
  return { tipo: "AVENCER", total, consulta, itens: linhas, fora, ok: c("OK"), marcar: c("MARCAR"), divergentes: c("DIVERGENTE"), semConta: c("SEM_CONTA") };
}

// marca como antecipados os títulos que estão no relatório e em aberto no sistema
export async function aplicarAVencer(b64, { ids, quem } = {}) {
  const r = await analisarAVencer(b64);
  const alvo = r.itens.filter((l) => l.status === "MARCAR" && l.titulo && (!ids || ids.includes(l.titulo.id)));
  const out = { marcados: 0, valor: 0, linhas: [], erros: [] };
  for (const l of alvo) {
    try {
      const t = await prisma.finTitulo.findUnique({ where: { id: l.titulo.id } });
      if (!t || t.status !== "ABERTO") continue;
      const ctr = await prisma.finAntecipacao.findUnique({ where: { contrato: l.contrato } }).catch(() => null);
      const dt = ctr?.data || dUTC(r.consulta || new Date().toISOString().slice(0, 10));
      await prisma.finTitulo.update({ where: { id: t.id }, data: {
        status: "PAGO", dataPagamento: dt, valorPago: t.valor, previsao: false, valorConfirmado: true, cobranca: "DESCONTADO", formaPagamento: "DESCONTO",
        antecipadoForma: "BRADESCO", antecipadoEm: dt, antecipacaoId: ctr?.id || null, nossoNumero: t.nossoNumero || l.nossoNumero,
        observacao: [t.observacao, `ANTECIPADO — CONFIRMADO NO RELATÓRIO TÍTULOS A VENCER (BRADESCO, ${dBR(r.consulta || "")}) · CONTRATO ${l.contrato} · PARCELA ${l.parcela}`].filter(Boolean).join(" · ").slice(0, 1000),
        atualizadoPorNome: quem || null } });
      out.marcados++; out.valor = r2(out.valor + Number(t.valor));
      out.linhas.push(`${t.titulo} · ${l.sacado}: marcado como antecipado (contrato ${l.contrato})`);
    } catch (e) { out.erros.push(`${l.sacado} (NF ${l.seuNumero}): ${e.message}`); }
  }
  return { ...out, total: r.total, ok: r.ok, divergentes: r.divergentes, semConta: r.semConta, fora: r.fora.length };
}
