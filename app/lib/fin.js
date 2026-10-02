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

// ---------- Plano de contas + palavras-chave da base (sistema anterior) ----------
// Cria as contas que faltarem (não altera as que já existem).
export async function garantirContas() {
  const { CONTAS_BASE } = await import("@/lib/finBasePadrao");
  const existentes = new Set((await prisma.finConta.findMany({ select: { codigo: true } })).map((c) => c.codigo));
  const faltam = CONTAS_BASE.filter(([c]) => !existentes.has(c));
  if (faltam.length) {
    await prisma.finConta.createMany({ data: faltam.map(([codigo, nome, ativo]) => ({ codigo, nome, ativo: ativo !== false })), skipDuplicates: true });
  }
}

// Importa as palavras-chave do sistema anterior UMA vez (marca origem = BASE).
export async function garantirRegrasBase() {
  if (await prisma.finRegra.count({ where: { origem: "BASE" } })) return;
  await garantirContas();
  const { REGRAS_BASE, REGRAS_DESATIVADAS } = await import("@/lib/finBasePadrao");
  const contas = await prisma.finConta.findMany();
  const porCod = Object.fromEntries(contas.map((c) => [c.codigo, c]));
  const vistos = new Set();
  const data = [];
  REGRAS_BASE.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
    const [descricao, cmp, termo, campo, banco, cod, dc] = l.split("|");
    const conta = porCod[cod];
    if (!conta || !termo) return;
    const chave = [normRegra(termo), cod, dc, banco, campo].join("|");
    if (vistos.has(chave)) return;
    vistos.add(chave);
    data.push({
      ordem: (i + 1) * 10, descricao: descricao || null,
      comparar: cmp === "T" ? "TERMINA" : "CONTEM",
      termo: termo.toUpperCase(),
      campo: campo === "H" ? "HISTORICO" : campo === "I" ? "IDENTIFICACAO" : "TODOS",
      banco: banco || null, dc: dc || null, contaId: conta.id,
      // regras genéricas demais ou apontando para conta fora do plano atual → desativadas p/ revisão
      ativo: conta.ativo && !REGRAS_DESATIVADAS.includes(termo.toUpperCase()),
      origem: "BASE", criadoPorNome: "SISTEMA ANTERIOR",
    });
  });
  await prisma.finRegra.createMany({ data });
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

// Uma palavra casa se:
//  · CONTEM: aparece no início de uma palavra do texto (POSTO não pega IMPOSTO), ou — se tiver 10+ letras —
//    aparece em qualquer lugar ignorando espaços (TEDTRANSF casa com TED-TRANSF, 00360305LUCIENE com CP 00360305-LUCIENE)
//  · palavras de até 3 letras (99, VR, IOF) só casam com a palavra inteira
//  · INICIA / TERMINA / IGUAL: comparação sem espaços
function casaPalavra(alvo, alvoJunto, palavra, comparar) {
  const p = normRegra(palavra);
  if (!p) return false;
  const pj = p.replace(/ /g, "");
  if (comparar === "TERMINA") return alvoJunto.endsWith(pj);
  if (comparar === "INICIA") return alvoJunto.startsWith(pj);
  if (comparar === "IGUAL") return alvoJunto === pj;
  if (pj.length <= 3) return (" " + alvo + " ").includes(" " + p + " "); // curtas (99, VR, IOF): palavra inteira
  return (" " + alvo).includes(" " + p) || (pj.length >= 10 && alvoJunto.includes(pj));
}

export function regraCasa(r, l) {
  if (!r.ativo) return false;
  if (r.banco && r.banco !== l.banco) return false;
  const v = Number(l.valor);
  if (r.dc === "D" && !(v < 0)) return false;
  if (r.dc === "C" && !(v > 0)) return false;
  const texto = r.campo === "HISTORICO" ? l.historico : r.campo === "IDENTIFICACAO" ? (l.identificacao || "") : `${l.historico} ${l.identificacao || ""}`;
  const alvo = normRegra(texto);
  if (!alvo) return false;
  const alvoJunto = alvo.replace(/ /g, "");
  return String(r.termo || "").split(";").some((p) => casaPalavra(alvo, alvoJunto, p, r.comparar));
}

// regras já ordenadas por prioridade → a primeira que casar vence
export function acharRegra(regras, l) {
  for (const r of regras) if (regraCasa(r, l)) return r;
  return null;
}
export const regrasOrdenadas = () => prisma.finRegra.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }] });

// aplica regras nos lançamentos SEM conta da competência (ou nos ids informados)
export async function aplicarRegras(competencia, ids) {
  await garantirRegrasBase();
  const regras = await regrasOrdenadas();
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

// ---------- Processa um arquivo (PDF → lançamentos ou itens de detalhamento) ----------
export async function processarArquivo(arquivoId, { conciliarDepois = true } = {}) {
  const { lerArquivo, LEITORES, lerDetalhe, LEITORES_DETALHE } = await import("@/lib/finParse");
  const a = await prisma.finArquivo.findUnique({ where: { id: arquivoId }, include: { tipo: true } });
  if (!a || a.processado) return { ok: true, n: 0 };
  const buf = Buffer.from(a.conteudo, "base64");

  if (LEITORES_DETALHE[a.tipo.codigo]) {
    const r = await lerDetalhe(a.tipo.codigo, buf, a.senhaPdf);
    await prisma.finArquivo.update({ where: { id: a.id }, data: { processado: true, itens: r } });
    const conf = conciliarDepois ? await conciliarCompetencia(a.competencia) : null;
    const minha = conf?.find((c) => c.arquivoIds.includes(a.id));
    return { ok: true, n: r.itens.length, detalhe: true, total: r.total, conciliado: minha ? minha.ok : null };
  }
  if (!LEITORES[a.tipo.codigo]) return { ok: true, n: 0, semLeitor: true };

  const r = await lerArquivo(a.tipo.codigo, buf, a.senhaPdf);
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
  if (conciliarDepois) await conciliarCompetencia(a.competencia);
  const auto = await aplicarRegras(a.competencia);
  return { ok: true, n: r.lancamentos.length, auto };
}

// ---------- Conferência: detalhamento x consolidado do extrato ----------
const dIso = (d) => d.toISOString().slice(0, 10);
async function docsDetalhe(competencia) {
  const { LEITORES_DETALHE } = await import("@/lib/finParse");
  const arqs = await prisma.finArquivo.findMany({
    where: { competencia, processado: true, tipo: { codigo: { in: Object.keys(LEITORES_DETALHE) } } },
    select: { id: true, nome: true, itens: true, conciliacao: true, tipo: { select: { codigo: true } } },
  });
  return arqs.map((a) => ({ arquivoId: a.id, codigo: a.tipo.codigo, nome: a.nome, r: a.itens, conciliacao: a.conciliacao }));
}

export async function conciliarCompetencia(competencia) {
  const { montarGrupos, conciliar } = await import("@/lib/finConcilia");
  const docs = await docsDetalhe(competencia);
  const grupos = montarGrupos(docs);
  const chaves = new Set(grupos.map((g) => g.chave));

  // 1) limpa grupos que deixaram de existir (arquivo apagado, fatura nova no grupo…)
  const det = await prisma.finLancamento.findMany({ where: { competencia, origem: "DETALHE" }, select: { id: true, grupo: true } });
  const subst = await prisma.finLancamento.findMany({ where: { competencia, substituido: true }, select: { id: true, substGrupo: true } });
  const lancPorGrupo = {}, substPorGrupo = {};
  det.forEach((l) => (lancPorGrupo[l.grupo] = (lancPorGrupo[l.grupo] || 0) + 1));
  subst.forEach((l) => (substPorGrupo[l.substGrupo] = (substPorGrupo[l.substGrupo] || 0) + 1));
  const todos = new Set([...Object.keys(lancPorGrupo), ...Object.keys(substPorGrupo)]);
  const jaFeitos = new Set();
  for (const k of todos) {
    const valido = chaves.has(k) && lancPorGrupo[k] > 0 && substPorGrupo[k] > 0;
    if (valido) { jaFeitos.add(k); continue; }
    await prisma.$transaction([
      prisma.finLancamento.deleteMany({ where: { competencia, origem: "DETALHE", grupo: k } }),
      prisma.finLancamento.updateMany({ where: { competencia, substGrupo: k }, data: { substituido: false, substGrupo: null } }),
    ]);
  }

  // 2) concilia o que falta
  const disp = await prisma.finLancamento.findMany({
    where: { competencia, origem: "EXTRATO", substituido: false, desmembrado: false },
    select: { id: true, banco: true, data: true, historico: true, documento: true, valor: true },
  });
  const extrato = disp.map((l) => ({ ...l, data: dIso(l.data), valor: Number(l.valor) }));
  const res = conciliar(grupos, extrato, jaFeitos);

  for (const r of res) {
    if (!r.ok || !r.vinculos.length) continue;
    const g = grupos.find((x) => x.chave === r.chave);
    await prisma.$transaction([
      prisma.finLancamento.createMany({
        data: r.itens.map((it, i) => ({
          competencia, arquivoId: g.arquivoIds[0], banco: it.banco, data: new Date(it.data + "T00:00:00Z"),
          historico: String(it.historico).toUpperCase(), identificacao: it.identificacao ? String(it.identificacao).toUpperCase() : null,
          valor: it.valor, origem: "DETALHE", grupo: r.chave, ordem: i,
        })),
      }),
      prisma.finLancamento.updateMany({ where: { id: { in: r.vinculos } }, data: { substituido: true, substGrupo: r.chave } }),
    ]);
  }

  // 3) grava o resultado em cada arquivo de detalhamento
  const resultado = grupos.map((g) => {
    const r = res.find((x) => x.chave === g.chave);
    const anterior = docs.flatMap((d) => d.conciliacao || []).find((c) => c.chave === g.chave);
    return {
      chave: g.chave, rotulo: g.rotulo, codigo: g.codigo, arquivoIds: g.arquivoIds, total: g.total, dataRef: g.dataRef,
      ok: r ? r.ok : true, aviso: r?.aviso || false,
      msg: r ? r.msg : (anterior?.ok ? anterior.msg : "Conciliado."), candidatos: r?.candidatos || [],
    };
  });
  for (const d of docs) {
    await prisma.finArquivo.update({ where: { id: d.arquivoId }, data: { conciliacao: resultado.filter((x) => x.arquivoIds.includes(d.arquivoId)) } });
  }
  await aplicarRegras(competencia);
  return resultado;
}

// Vínculo manual (quando não bate): troca os lançamentos escolhidos pelo detalhamento + linha de diferença
export async function forcarVinculo(competencia, chave, ids, quem) {
  const { montarGrupos } = await import("@/lib/finConcilia");
  const grupos = montarGrupos(await docsDetalhe(competencia));
  const g = grupos.find((x) => x.chave === chave);
  if (!g) throw new Error("Grupo não encontrado — recarregue a tela.");
  const linhas = await prisma.finLancamento.findMany({ where: { id: { in: ids }, competencia, substituido: false, desmembrado: false } });
  if (!linhas.length) throw new Error("Escolha ao menos um lançamento do extrato.");
  const somaLinhas = Math.round(linhas.reduce((a, l) => a + Number(l.valor), 0) * 100) / 100;
  const dif = Math.round((somaLinhas - g.total) * 100) / 100;
  const data = new Date(linhas.map((l) => dIso(l.data)).sort().pop() + "T00:00:00Z");
  const banco = g.bancoItens || linhas[0].banco;
  const itens = g.itens.map((it, i) => ({
    competencia, arquivoId: g.arquivoIds[0], banco, data: g.modo === "FOLHA" ? new Date(it.data + "T00:00:00Z") : data,
    historico: String(it.historico).toUpperCase(), identificacao: it.identificacao ? String(it.identificacao).toUpperCase() : null,
    valor: it.valor, origem: "DETALHE", grupo: chave, ordem: i,
  }));
  if (Math.abs(dif) >= 0.005) itens.push({
    competencia, arquivoId: g.arquivoIds[0], banco, data, historico: `DIFERENÇA ENTRE EXTRATO E DETALHAMENTO · ${String(g.rotulo || "").toUpperCase()}`,
    identificacao: `VÍNCULO MANUAL · ${quem}`, valor: dif, origem: "DETALHE", grupo: chave, ordem: itens.length,
  });
  await prisma.$transaction([
    prisma.finLancamento.createMany({ data: itens }),
    prisma.finLancamento.updateMany({ where: { id: { in: linhas.map((l) => l.id) } }, data: { substituido: true, substGrupo: chave } }),
  ]);
  const docs = await docsDetalhe(competencia);
  for (const d of docs) {
    if (!g.arquivoIds.includes(d.arquivoId)) continue;
    const conc = (d.conciliacao || []).map((c) => c.chave === chave ? { ...c, ok: true, aviso: false, candidatos: [],
      msg: `Vinculado manualmente por ${quem}${Math.abs(dif) >= 0.005 ? ` · diferença de R$ ${Math.abs(dif).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} lançada à parte` : ""}.` } : c);
    await prisma.finArquivo.update({ where: { id: d.arquivoId }, data: { conciliacao: conc } });
  }
  await aplicarRegras(competencia);
  return { ok: true, diferenca: dif };
}

export async function desfazerVinculo(competencia, chave) {
  await prisma.$transaction([
    prisma.finLancamento.deleteMany({ where: { competencia, origem: "DETALHE", grupo: chave } }),
    prisma.finLancamento.updateMany({ where: { competencia, substGrupo: chave }, data: { substituido: false, substGrupo: null } }),
  ]);
  return conciliarCompetencia(competencia);
}

// ---------- serialização ----------
const num = (d) => (d == null ? null : Number(d));
export const lancOut = (l) => ({
  id: l.id, banco: l.banco, data: l.data.toISOString().slice(0, 10), historico: l.historico, documento: l.documento,
  identificacao: l.identificacao, valor: num(l.valor), contaId: l.contaId, regraId: l.regraId, origem: l.origem,
  paiId: l.paiId, desmembrado: l.desmembrado, identificadoPor: l.identificadoPor, arquivoId: l.arquivoId, ordem: l.ordem,
  grupo: l.grupo, substituido: l.substituido, substGrupo: l.substGrupo, revisado: l.revisado,
});


// campos editáveis de uma palavra-chave
export const dadosRegra = (b) => {
  const d = {};
  if (b.descricao !== undefined) d.descricao = b.descricao ? String(b.descricao).trim().toUpperCase() : null;
  if (b.comparar !== undefined) d.comparar = ["CONTEM", "INICIA", "TERMINA", "IGUAL"].includes(b.comparar) ? b.comparar : "CONTEM";
  if (b.termo !== undefined) d.termo = String(b.termo).split(";").map((t) => t.trim().toUpperCase()).filter(Boolean).join(";");
  if (b.campo !== undefined) d.campo = ["TODOS", "HISTORICO", "IDENTIFICACAO"].includes(b.campo) ? b.campo : "TODOS";
  if (b.banco !== undefined) d.banco = b.banco ? String(b.banco).toUpperCase() : null;
  if (b.dc !== undefined) d.dc = b.dc === "D" || b.dc === "C" ? b.dc : null;
  if (b.contaId !== undefined) d.contaId = Number(b.contaId);
  if (b.ativo !== undefined) d.ativo = !!b.ativo;
  return d;
};

