// v204 — RH › Rescisão pelo TRCT (Termo de Rescisão do Contrato de Trabalho)
// lerTrct: lê o PDF pelas posições (rótulo em cima, valor embaixo; totais à direita)
// analisarTrct: casa com o funcionário da Matriz e calcula a data limite de pagamento
// aplicarTrct: conta a pagar (líquido, na data limite) + término do contrato (desligamento na Matriz)
//              + TRCT nos documentos do funcionário + anexo na conta + aviso ao financeiro
import { prisma } from "@/lib/prisma";
import { dataUTC, mesDe, r2 } from "@/lib/finTitulos";
import { hashB64, jaImportados } from "@/lib/finHash";
import { CONTA_DEPTO } from "@/lib/finMatrizRec";
import { salvarPessoa, notificarFinanceiro, nomeUsuario, empresaDaPessoa } from "@/lib/rh";

export const CNPJ_EMPRESA = { "48011287000181": "MERIDIAN", "55116246000115": "NORT" };
export const ehTrct = (t) => /TERMO\s+DE\s+RESCIS[ÃA]O\s+DO\s+CONTRATO\s+DE\s+TRABALHO/i.test(String(t || ""));

const so = (s) => String(s || "").replace(/\D/g, "");
const num = (s) => { const v = Number(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : null; };
const isoBR = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dBR = (s) => String(s || "").slice(0, 10).split("-").reverse().join("/");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- leitura ----------
async function itensPdf(buf) {
  const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const PDFJS = mod.default || mod;
  PDFJS.disableWorker = true;
  const doc = await PDFJS.getDocument({ data: new Uint8Array(buf) });
  const pg = await doc.getPage(1);
  const c = await pg.getTextContent();
  const out = c.items.filter((x) => String(x.str).trim()).map((x) => ({ x: x.transform[4], y: x.transform[5], s: String(x.str).trim() }));
  doc.destroy();
  return out;
}
// valor logo abaixo do rótulo (mesma coluna)
function abaixo(it, re, { dy = 26, dx = 20, valida } = {}) {
  const r = it.find((x) => re.test(x.s));
  if (!r) return null;
  const c = it.filter((x) => x !== r && x.y < r.y - 2 && x.y >= r.y - dy && Math.abs(x.x - r.x) <= dx && !/^\d{2,3}(\.\d)?\s{2}/.test(x.s) && (!valida || valida(x.s)))
    .sort((a, b) => b.y - a.y || Math.abs(a.x - r.x) - Math.abs(b.x - r.x));
  return c[0]?.s || null;
}
// valor à direita do rótulo (mesma linha)
function aDireita(it, re) {
  const r = it.find((x) => re.test(x.s));
  if (!r) return null;
  const c = it.filter((x) => x !== r && Math.abs(x.y - r.y) <= 3 && x.x > r.x && /^[\d.]+,\d{2}$/.test(x.s)).sort((a, b) => a.x - b.x);
  return c[0]?.s || null;
}

export function lerTrctItens(it) {
  const data = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s);
  const cnpj = so(abaixo(it, /^01\s+CNPJ/i, { valida: (s) => /^\d{14}$/.test(so(s)) }));
  const r = {
    cnpj, empresa: CNPJ_EMPRESA[cnpj] || null,
    razao: abaixo(it, /^02\s+Raz[ãa]o Social/i),
    nome: (abaixo(it, /^11\s+Nome$/i) || "").toUpperCase(),
    cpf: so(abaixo(it, /^18\s+CPF$/i, { valida: (s) => so(s).length === 11 })),
    admissao: isoBR(abaixo(it, /^24\s+Data de Admiss/i, { valida: data })),
    avisoPrevio: isoBR(abaixo(it, /^25\s+Data do Aviso/i, { valida: data })),
    afastamento: isoBR(abaixo(it, /^26\s+Data de Afastamento/i, { valida: data })),
    codigo: abaixo(it, /^27\s+C[óo]d/i, { valida: (s) => /^[A-Z0-9]{2,4}$/.test(s) }),
    causa: (abaixo(it, /^22\s+Causa do Afastamento/i, { dy: 30, dx: 30 }) || "").toUpperCase(),
    remuneracao: num(abaixo(it, /^23\s+Remunera/i, { dx: 60, valida: (s) => /^[\d.]+,\d{2}$/.test(s) })),
    bruto: num(aDireita(it, /^TOTAL BRUTO$/i)),
    deducoes: num(aDireita(it, /^TOTAL DEDU[ÇC][ÕO]ES$/i)),
    liquido: num(aDireita(it, /^VALOR L[ÍI]QUIDO$/i)),
  };
  return r;
}

export async function lerTrct(buf) {
  const it = await itensPdf(buf);
  if (!it.some((x) => ehTrct(x.s))) throw new Error("Não é um Termo de Rescisão do Contrato de Trabalho (TRCT).");
  const r = lerTrctItens(it);
  if (!r.nome) throw new Error("Não achei o nome do trabalhador no TRCT.");
  if (!r.afastamento) throw new Error("Não achei a data de afastamento no TRCT.");
  if (r.liquido == null) throw new Error("Não achei o valor líquido no TRCT.");
  return r;
}

// ---------- prazo de pagamento: 10 dias corridos do término (art. 477 §6º CLT); se cair em dia não útil, antecipa ----------
const FERIADOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
const util = (d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !FERIADOS.includes(d.toISOString().slice(5, 10));
export function dataLimite(afastamento) {
  let d = new Date(new Date(`${afastamento}T00:00:00Z`).getTime() + 10 * 86400000);
  while (!util(d)) d = new Date(d.getTime() - 86400000);
  return d.toISOString().slice(0, 10);
}

// ---------- casar com a Matriz ----------
export async function pessoasRH() {
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  const pessoas = m?.dados?.pessoal || [];
  const fichas = await prisma.rhFuncionario.findMany({ select: { pessoaId: true, nomeCompleto: true, dados: true } });
  const f = Object.fromEntries(fichas.map((x) => [x.pessoaId, x]));
  return pessoas.map((p) => ({ id: p.id, nome: p.nome, depto: p.depto, cargo: p.cargo, ativo: p.ativo !== false, demissao: p.demissao || null,
    empresa: empresaDaPessoa(p), nomeCompleto: f[p.id]?.nomeCompleto || null, cpf: so(f[p.id]?.dados?.cpf) }));
}
export function casarTrct(t, pessoas) {
  const nome = semAcento(t.nome), tok = nome.split(" ").filter((w) => w.length > 2);
  let p = t.cpf && pessoas.find((x) => x.cpf && x.cpf === t.cpf);
  if (p) return { pessoaId: p.id, por: "CPF" };
  p = pessoas.find((x) => x.nomeCompleto && semAcento(x.nomeCompleto) === nome);
  if (p) return { pessoaId: p.id, por: "NOME COMPLETO" };
  const cand = pessoas.filter((x) => { const w = semAcento(x.nome).split(" ").filter((y) => y.length > 2); return w.length && w.every((y) => tok.includes(y)); });
  if (cand.length === 1) return { pessoaId: cand[0].id, por: "NOME" };
  const prim = pessoas.filter((x) => semAcento(x.nome).split(" ")[0] === tok[0]);
  if (prim.length === 1) return { pessoaId: prim[0].id, por: "PRIMEIRO NOME", duvida: true };
  return { pessoaId: null, por: null };
}

const chaveTrct = (t) => `TRCT|${t.cpf || semAcento(t.nome)}|${t.afastamento}`;

// ---------- analisar (sem gravar) ----------
export async function analisarTrct(arquivos) {
  const pessoas = await pessoasRH();
  const out = [];
  for (const a of arquivos || []) {
    try {
      const t = await lerTrct(Buffer.from(String(a.conteudo || ""), "base64"));
      const m = casarTrct(t, pessoas);
      const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chaveTrct(t), status: { not: "CANCELADO" } }, select: { id: true, titulo: true } })
        || Object.values(await jaImportados([hashB64(a.conteudo)]))[0] || null;
      const avisos = [];
      if (!t.empresa) avisos.push(`CNPJ ${t.cnpj || "?"} não é da Meridian nem da NORT.`);
      if (t.bruto != null && t.deducoes != null && Math.abs(r2(t.bruto - t.deducoes) - t.liquido) > 0.02) avisos.push(`Bruto − deduções (${brl(t.bruto - t.deducoes)}) ≠ líquido (${brl(t.liquido)}) — confira.`);
      if (!m.pessoaId) avisos.push("Funcionário não encontrado na Matriz: escolha na lista (sem escolher, a conta é lançada mas ninguém é desligado).");
      if (m.duvida) avisos.push("Casado só pelo primeiro nome — confira o funcionário.");
      out.push({ nome: a.nome, trct: t, pessoaId: m.pessoaId, por: m.por, vencimento: dataLimite(t.afastamento), ja, avisos });
    } catch (e) { out.push({ nome: a.nome, erro: e.message }); }
  }
  return { itens: out, pessoas: pessoas.map(({ id, nome, depto, empresa, ativo, nomeCompleto }) => ({ id, nome, depto, empresa, ativo, nomeCompleto })) };
}

// ---------- aplicar ----------
// b: { arquivo: { nome, conteudo }, pessoaId?, vencimento, valor, desligar (default true) }
export async function aplicarTrct(b, u) {
  const quem = nomeUsuario(u);
  const a = b.arquivo || {};
  if (!a.conteudo) return { error: "Arquivo do TRCT não veio." };
  const t = await lerTrct(Buffer.from(String(a.conteudo), "base64"));
  const valor = r2(b.valor ?? t.liquido);
  const venc = /^\d{4}-\d{2}-\d{2}$/.test(b.vencimento || "") ? b.vencimento : dataLimite(t.afastamento);
  if (!(valor > 0)) return { error: "Valor líquido inválido." };
  const chave = chaveTrct(t);
  if (await prisma.finTitulo.findFirst({ where: { chaveImport: chave, status: { not: "CANCELADO" } } })) return { error: `A rescisão de ${t.nome} com afastamento em ${dBR(t.afastamento)} já foi lançada.` };
  const velha = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });   // cancelada: libera a chave
  if (velha) await prisma.finTitulo.update({ where: { id: velha.id }, data: { chaveImport: `${chave}|CANCELADA|${velha.id}`.slice(0, 190) } });

  const pessoas = await pessoasRH();
  const p = b.pessoaId ? pessoas.find((x) => x.id === b.pessoaId) : null;
  const empresa = t.empresa || p?.empresa || "MERIDIAN";
  const nort = empresa === "NORT";
  const contas = await prisma.finConta.findMany({ select: { id: true, codigo: true } });
  const idC = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
  const cod = nort ? "2154000" : CONTA_DEPTO[p?.depto] || null;
  const rateio = cod && idC[cod] ? [{ contaId: idC[cod], pct: 100 }] : [];
  const obs = [`TRCT · ${t.causa || "RESCISÃO"}${t.codigo ? ` (${t.codigo})` : ""}`, t.admissao && `ADMISSÃO ${dBR(t.admissao)}`,
    `AFASTAMENTO ${dBR(t.afastamento)}`, t.bruto != null && `BRUTO ${brl(t.bruto)}`, t.deducoes != null && `DEDUÇÕES ${brl(t.deducoes)}`,
    `LÍQUIDO ${brl(t.liquido)}`, `PRAZO: 10 DIAS DO TÉRMINO (ART. 477 CLT)`, `LANÇADA PELO RH (${quem})`].filter(Boolean).join(" · ");
  const tit = await prisma.finTitulo.create({ data: {
    tipo: "PAGAR", titulo: `${nort ? "NORT - " : ""}RESCISÃO ${t.nome}`.slice(0, 190), parceiro: t.nome, documento: t.cpf || null, numeroDoc: "TRCT",
    valor, vencimento: dataUTC(venc), competencia: mesDe(venc), previsao: false, valorConfirmado: true, rateio, formaPagamento: "PIX",
    observacao: obs.slice(0, 1000), forma: "RH", chaveImport: chave, criadoPorId: u.id, criadoPorNome: quem,
  } });
  const hash = hashB64(a.conteudo);
  const nomeArq = String(a.nome || `TRCT ${t.nome}.pdf`).slice(0, 200);
  await prisma.finTituloAnexo.create({ data: { tituloId: tit.id, nome: nomeArq, mime: "application/pdf", tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, hash, criadoPorNome: quem } });
  await prisma.rhEnvio.create({ data: { competencia: mesDe(venc), empresa, categoria: "RESCISAO", arquivo: nomeArq, tituloId: tit.id, valor, hash, criadoPorNome: quem } }).catch(() => null);

  let desligado = null, documento = false;
  if (p) {
    // documento nos arquivos do funcionário
    const f = await prisma.rhFuncionario.upsert({ where: { pessoaId: p.id }, create: { pessoaId: p.id }, update: {} });
    await prisma.rhDocumento.create({ data: { funcionarioId: f.id, tipo: "RESCISÃO", nome: nomeArq, mime: "application/pdf", tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, criadoPorNome: quem } });
    documento = true;
    // ficha: CPF e admissão se estavam vazios; data de término
    const dados = { ...(f.dados || {}) };
    if (t.cpf && !dados.cpf) dados.cpf = t.cpf;
    if (t.admissao && !dados.admissao) dados.admissao = t.admissao;
    dados.rescisao = { afastamento: t.afastamento, causa: t.causa, codigo: t.codigo, liquido: t.liquido, tituloId: tit.id };
    await prisma.rhFuncionario.update({ where: { id: f.id }, data: { dados, ...(f.nomeCompleto ? {} : { nomeCompleto: t.nome }), atualizadoPorNome: quem } });
    // término do contrato: desliga na Matriz na data de afastamento (o card vai para os desligados)
    if (b.desligar !== false) {
      const r = await salvarPessoa({ acao: "DESLIGAR", pessoa: { id: p.id, demissao: t.afastamento } }, u);
      if (r.error) return { error: `Conta lançada, mas o desligamento falhou: ${r.error}`, tituloId: tit.id };
      desligado = p.nome;
    }
  }
  await notificarFinanceiro(`RH · RESCISÃO de ${t.nome} (${empresa}) · afastamento ${dBR(t.afastamento)} · líquido R$ ${brl(valor)} · vence ${dBR(venc)}`
    + `${rateio.length ? "" : " · falta a conta-caixa (rateio)"}. TRCT anexado. Por ${quem}.`, u.id);
  return { ok: true, tituloId: tit.id, titulo: tit.titulo, vencimento: venc, valor, desligado, documento };
}
