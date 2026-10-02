import { prisma } from "@/lib/prisma";

// Documentos obrigatórios por mês (1 card cada). qtdEsperada = arquivos esperados.
export const TIPOS_PADRAO = [
  { codigo: "BRADESCO_EXTRATO",  banco: "BRADESCO", documento: "Extrato conta corrente", descricao: "Extrato mensal Net Empresa (PDF)" },
  { codigo: "BRADESCO_COBRANCA", banco: "BRADESCO", documento: "Títulos pagos (cobrança)", descricao: "Boletos recebidos — substitui a LIQUIDACAO DE COBRANCA do extrato" },
  { codigo: "BRADESCO_FOLHA",    banco: "BRADESCO", documento: "Comprovantes de folha", descricao: "Crédito em conta salário — substitui PAGAMENTO FUNCIONARIOS", multiplo: true },
  { codigo: "BRADESCO_FATURA",   banco: "BRADESCO", documento: "Faturas de cartão", descricao: "1 fatura por portador", qtdEsperada: 3, multiplo: true },
  { codigo: "ITAU_EXTRATO",      banco: "ITAÚ", documento: "Extrato conta corrente", descricao: "Extrato do período (PDF)" },
  { codigo: "ITAU_PAGAMENTOS",   banco: "ITAÚ", documento: "Relatório de pagamentos / Pix", descricao: "Detalha o SISPAG do extrato", multiplo: true },
  { codigo: "ITAU_FATURA",       banco: "ITAÚ", documento: "Fatura Mastercard", descricao: "Fatura com todos os portadores" },
  { codigo: "INTER_EXTRATO",     banco: "INTER", documento: "Extrato conta corrente", descricao: "Extrato do período (PDF)" },
  { codigo: "INTER_FATURA",      banco: "INTER", documento: "Fatura de cartão", descricao: "Fatura mensal" },
  { codigo: "C6_EXTRATO",        banco: "C6 BANK", documento: "Extrato conta corrente", descricao: "Extrato do período (PDF)" },
  { codigo: "C6_FATURA",         banco: "C6 BANK", documento: "Fatura de cartão", descricao: "PDF com senha — cadastre em Senhas de PDF" },
  { codigo: "BB_EXTRATO",        banco: "BANCO DO BRASIL", documento: "Extrato conta corrente", descricao: "Extrato do mês (PDF)" },
  { codigo: "BB_FATURA",         banco: "BANCO DO BRASIL", documento: "Faturas de cartão", descricao: "1 fatura por portador", qtdEsperada: 3, multiplo: true },
  { codigo: "CAIXA_EXTRATO",     banco: "CAIXA", documento: "Extrato conta corrente", descricao: "Gerenciador Caixa (PDF)" },
  { codigo: "CAIXA_FATURA",      banco: "CAIXA", documento: "Fatura Elo", descricao: "Fatura com todos os cartões" },
  { codigo: "IFOOD_RECARGA",     banco: "IFOOD BENEFÍCIOS", documento: "Relatórios de recarga", descricao: "Todas as recargas do mês — substituem o PIX global ao iFood", multiplo: true },
];

// Garante que o catálogo existe (sem sobrescrever ajustes feitos depois).
export async function garantirTipos() {
  const n = await prisma.finDocTipo.count();
  if (n >= TIPOS_PADRAO.length) return;
  await prisma.finDocTipo.createMany({
    data: TIPOS_PADRAO.map((t, i) => ({
      codigo: t.codigo, banco: t.banco, documento: t.documento, descricao: t.descricao || null,
      qtdEsperada: t.qtdEsperada || 1, multiplo: !!t.multiplo, ordem: i + 1,
    })),
    skipDuplicates: true,
  });
}

// Só o master (ou setor FINANCEIRO) acessa o financeiro.
export async function usuarioMaster(id) {
  const uid = Number(id);
  if (!uid) return null;
  const u = await prisma.usuario.findUnique({ where: { id: uid }, select: { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true } });
  if (!u || !u.ativo) return null;
  if (!(u.isMaster || u.setor === "FINANCEIRO")) return null;
  return u;
}
export const negado = () => Response.json({ error: "Acesso restrito ao financeiro." }, { status: 403 });

export const competenciaValida = (c) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ""));

// Tenta abrir o PDF. Retorna { ok, senha } ou { ok:false, precisaSenha, senhaErrada } ou { ok:false, erro }.
export async function abrirPdf(buf, senhasTentar) {
  const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const PDFJS = mod.default || mod;
  PDFJS.disableWorker = true;
  const tenta = async (password) => {
    try {
      const doc = await PDFJS.getDocument({ data: new Uint8Array(buf), password });
      const paginas = doc.numPages;
      let texto = "";
      for (let i = 1; i <= Math.min(3, paginas); i++) {
        const pg = await doc.getPage(i);
        const c = await pg.getTextContent();
        texto += c.items.map((x) => x.str).join(" ") + "\n";
      }
      doc.destroy();
      return { ok: true, paginas, texto };
    } catch (e) {
      if (e && e.name === "PasswordException") return { ok: false, senha: true };
      return { ok: false, erro: e?.message || "PDF inválido" };
    }
  };
  const r0 = await tenta(undefined);
  if (r0.ok) return { ok: true, senha: null, paginas: r0.paginas, texto: r0.texto };
  if (!r0.senha) return { ok: false, erro: r0.erro };
  for (const s of senhasTentar) {
    if (!s) continue;
    const r = await tenta(s);
    if (r.ok) return { ok: true, senha: s, paginas: r.paginas, texto: r.texto };
  }
  return { ok: false, precisaSenha: true };
}

// ---------- Classificação automática (pelo texto do PDF) ----------
// Texto normalizado: maiúsculo, sem acento e SEM espaços (alguns bancos espaçam letra a letra).
export const normalizarTexto = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, "");

const tem = (n, ...xs) => xs.every((x) => n.includes(x));
const algum = (n, ...xs) => xs.some((x) => n.includes(x));

// Ordem importa: regras mais específicas primeiro.
export const REGRAS_CLASSIFICACAO = [
  ["IFOOD_RECARGA",     (n) => tem(n, "RELATORIODERECARGA", "IFOODBENEFICIOS")],
  ["BRADESCO_COBRANCA", (n) => tem(n, "TITULOSPAGOSPORCONTACREDITO")],
  ["BRADESCO_FOLHA",    (n) => tem(n, "CREDITOEMCONTASALARIO")],
  ["BRADESCO_FATURA",   (n) => tem(n, "NOVACONSULTADEEXTRATO", "NUMERODOCARTAO")],
  ["BRADESCO_EXTRATO",  (n) => tem(n, "EXTRATODE:AG:") || tem(n, "EXTRATOMENSAL/PORPERIODO")],
  ["ITAU_PAGAMENTOS",   (n) => tem(n, "CONSULTADEPAGAMENTOS,TRANSFERENCIASEPIX")],
  ["ITAU_FATURA",       (n) => tem(n, "ITAUEMPRESASMASTERCARD")],
  ["ITAU_EXTRATO",      (n) => tem(n, "LANCAMENTOSDOPERIODO", "RAZAOSOCIAL", "SALDOTOTALDISPONIVELDIA")],
  ["INTER_FATURA",      (n) => algum(n, "BANCOINTERS/A", "SUAFATURACHEGOU") && algum(n, "RESUMODAFATURA", "DESPESASDAFATURA")],
  ["INTER_EXTRATO",     (n) => tem(n, "INSTITUICAO:BANCOINTER")],
  ["C6_EXTRATO",        (n) => tem(n, "EXTRATOEXPORTADONODIA")],
  ["C6_FATURA",         (n) => algum(n, "C6BANK", "C6BUSINESS", "BANCOC6") && algum(n, "VALORDAFATURA", "PAGAMENTODEFATURA", "RESUMODAFATURA")],
  ["BB_FATURA",         (n) => algum(n, "OUROCARD", "BANCODOBRASILS/A") && tem(n, "RESUMODAFATURA")],
  ["BB_EXTRATO",        (n) => tem(n, "EXTRATODECONTACORRENTE", "MOVIMENTACAOEM")],
  ["CAIXA_FATURA",      (n) => tem(n, "CARTOESCAIXA")],
  ["CAIXA_EXTRATO",     (n) => tem(n, "PRODUTO:", "DATADEMOVIMENTO", "HISTORICO")],
];

export function classificarTexto(texto) {
  const n = normalizarTexto(texto);
  if (n.length < 30) return { codigo: null, semTexto: true };
  for (const [codigo, f] of REGRAS_CLASSIFICACAO) if (f(n)) return { codigo };
  return { codigo: null };
}

// ---------- Plano de contas (base atual da Meridian) ----------
export const CONTAS_PADRAO = [
  ["1111000","VENDA DE UNIFORMES"],["1115000","VENDA LICITAÇÕES"],["1121000","VENDA DE PATRIMÔNIO"],
  ["1122000","RENDIMENTO OU RESGATE DE CAPITAL"],["1132000","EMPRÉSTIMO SÓCIO"],["1133000","ANTECIPAÇÃO FACTORING"],
  ["2111100","COMBUSTÍVEL"],["2111210","FRETE COMPRA"],["2111220","FRETE ENTREGA"],["2111310","LALAMOVE"],
  ["2111320","FRETEBRAS"],["2111330","PEDÁGIO"],["2111400","UBER"],["2111500","CORREIO"],
  ["2112100","TECIDO"],["2112200","AVIAMENTO"],["2112300","EMBALAGEM"],["2112600","INSUMO SILK"],
  ["2113100","PESSOAL DE CORTE"],["2113200","PESSOAL DE EXPEDIÇÃO"],["2113400","VT PRODUÇÃO"],
  ["2113500","PESSOAL DE COSTURA"],["2113600","PESSOAL DE LOGÍSTICA"],["2113700","BENEFICIOS PESSOAL DE PRODUÇÃO"],
  ["2114100","BORDADO"],["2114200","SILK"],["2114300","SUBLIMAÇÃO"],["2114600","FACÇÃO"],["2115100","IMPOSTO"],
  ["2116100","SV MANUTENÇÃO MÁQUINAS"],["2116200","SV MANUTENÇÃO VIATURAS"],["2116300","PEÇAS DE MÁQUINAS"],
  ["2117200","FREELANCER DE CORTE"],["2117300","FREELANCER DE EXPEDIÇÃO"],["2117400","FREELANCER DE COSTURA"],
  ["2117510","FREELANCER SILK"],["2117520","FREELANCER BORDADO"],["2118000","PRODUTO REVENDA"],
  ["2121000","VIDA VEGETATIVA"],["2122000","SISTEMAS E SERVIÇOS ADM"],["2123300","MATERIAL DE EXPEDIENTE"],
  ["2124000","CONFRATERNIZAÇÃO"],["2125000","EDUCAÇÃO"],["2126000","PRO LABORE"],["2128100","BENEFÍCIOS TRABALHISTAS"],
  ["2128200","PESSOAL DE ADMINISTRAÇÃO"],["2131100","PGTO DIVIDAS BANCARIAS"],["2131200","PGTO DIVIDAS C/ SÓCIOS"],
  ["2131300","PGTO ANTECIPAÇÃO FACTORING"],["2133100","RESERVA CAPITAL"],["2133200","PATRIMÔNIO"],
  ["2133300","MAQUINÁRIO"],["2133400","INVESTIMENTO NA PLANTA"],["2134000","TAXAS"],["2135000","JUROS"],
  ["2220000","DESPESA ADMINISTRATIVA"],["2240000","DESPESA COMERCIAL"],["3000000","CONCILIAÇÃO"],
];
export async function garantirContas() {
  const n = await prisma.finConta.count();
  if (n > 0) return;
  await prisma.finConta.createMany({ data: CONTAS_PADRAO.map(([codigo, nome]) => ({ codigo, nome })), skipDuplicates: true });
}

// ---------- Regras (palavra-chave → conta) ----------
// normalização para comparar: maiúsculo, sem acento, só letras/números com 1 espaço
export const normRegra = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ").trim();

// Sugere o termo de uma regra a partir do histórico (tira datas, horas e números soltos)
export function sugerirTermo(historico) {
  return normRegra(historico)
    .replace(/\b\d{2} \d{2}( \d{2,4})?\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

// escolhe a regra mais específica (termo mais longo) que casa com o lançamento
export function acharRegra(regras, l) {
  const base = normRegra(`${l.historico} ${l.identificacao || ""}`);
  const alvo = " " + base + " ";
  const alvoJunto = base.replace(/ /g, ""); // tolera banco que "cola" palavras (TEDTRANSF x TED-TRANSF)
  let melhor = null;
  for (const r of regras) {
    if (r.banco && r.banco !== l.banco) continue;
    if (!r.termo) continue;
    const junto = r.termo.replace(/ /g, "");
    const casa = alvo.includes(" " + r.termo + " ") || (junto.length >= 8 && alvoJunto.includes(junto));
    if (!casa) continue;
    if (!melhor || r.termo.length > melhor.termo.length) melhor = r;
  }
  return melhor;
}

// aplica regras nos lançamentos SEM conta da competência (ou nos ids informados)
export async function aplicarRegras(competencia, ids) {
  const regras = await prisma.finRegra.findMany();
  if (!regras.length) return 0;
  const where = { competencia, contaId: null, desmembrado: false };
  if (ids) where.id = { in: ids };
  const ls = await prisma.finLancamento.findMany({ where });
  let n = 0;
  const usos = {};
  for (const l of ls) {
    const r = acharRegra(regras, l);
    if (!r) continue;
    await prisma.finLancamento.update({ where: { id: l.id }, data: { contaId: r.contaId, regraId: r.id, identificadoPor: "REGRA" } });
    usos[r.id] = (usos[r.id] || 0) + 1;
    n++;
  }
  for (const [id, q] of Object.entries(usos)) await prisma.finRegra.update({ where: { id: Number(id) }, data: { usos: { increment: q } } });
  return n;
}

// ---------- Processa um arquivo (PDF → lançamentos) ----------
export async function processarArquivo(arquivoId) {
  const { lerArquivo, LEITORES } = await import("@/lib/finParse");
  const a = await prisma.finArquivo.findUnique({ where: { id: arquivoId }, include: { tipo: true } });
  if (!a || a.processado) return { ok: true, n: 0 };
  if (!LEITORES[a.tipo.codigo]) return { ok: true, n: 0, semLeitor: true };
  const r = await lerArquivo(a.tipo.codigo, Buffer.from(a.conteudo, "base64"), a.senhaPdf);
  await prisma.$transaction([
    prisma.finLancamento.deleteMany({ where: { arquivoId: a.id } }),
    prisma.finLancamento.createMany({
      data: r.lancamentos.map((l, i) => ({
        competencia: a.competencia, arquivoId: a.id, banco: r.banco,
        data: new Date(l.data + "T00:00:00Z"), historico: String(l.historico || "").toUpperCase(),
        documento: l.documento || null, identificacao: l.identificacao ? String(l.identificacao).toUpperCase() : null,
        valor: l.valor, ordem: i,
      })),
    }),
    prisma.finArquivo.update({ where: { id: a.id }, data: { processado: true, saldoAnterior: r.saldoAnterior } }),
  ]);
  const auto = await aplicarRegras(a.competencia);
  return { ok: true, n: r.lancamentos.length, auto };
}

// ---------- serialização ----------
const num = (d) => (d == null ? null : Number(d));
export const lancOut = (l) => ({
  id: l.id, banco: l.banco, data: l.data.toISOString().slice(0, 10), historico: l.historico, documento: l.documento,
  identificacao: l.identificacao, valor: num(l.valor), contaId: l.contaId, regraId: l.regraId, origem: l.origem,
  paiId: l.paiId, desmembrado: l.desmembrado, identificadoPor: l.identificadoPor, arquivoId: l.arquivoId, ordem: l.ordem,
});

