// Ajustes pontuais nos dados que já estão no banco (rodam uma vez só, controlados por FinConfig).
// Servem para mudanças combinadas que não podem vir só pelo seed, porque o banco já existe.
import { prisma } from "@/lib/prisma";

const CHAVE_ADIANT = "AJUSTE_ADIANTAMENTO_40";

// Quem passou a receber adiantamento (40% do líquido no dia 20).
export const OPTANTES_ADIANTAMENTO = [
  "BRENDA", "CINTIA", "DAVID", "DORALICE", "FRANKLIN", "HIGLEY",
  "MARIA CLARA", "RAQUEL", "ROSIANE", "SILVIA", "TADEU",
];

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Marca os optantes em todas as matrizes (oficial e cenários). Roda uma vez.
export async function ajustarAdiantamento() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_ADIANT } }).catch(() => null);
  if (ja) return { ok: true, jaFeito: true };

  const matrizes = await prisma.finMatriz.findMany();
  const alvos = OPTANTES_ADIANTAMENTO.map(semAcento);
  let marcados = 0, naoAchados = [...OPTANTES_ADIANTAMENTO];

  for (const m of matrizes) {
    const dados = { ...(m.dados || {}) };
    if (!Array.isArray(dados.pessoal)) continue;
    dados.pessoal = dados.pessoal.map((p) => {
      const nome = semAcento(p.nome);
      const bate = alvos.find((a) => nome.startsWith(a) || nome.includes(` ${a}`) || nome === a);
      if (!bate) return p;
      const i = naoAchados.findIndex((x) => semAcento(x) === bate);
      if (i >= 0) naoAchados.splice(i, 1);
      if (p.adiantamento) return p;
      marcados++;
      return { ...p, adiantamento: true };
    });
    await prisma.finMatriz.update({ where: { id: m.id }, data: { dados } });
  }

  await prisma.finConfig.upsert({
    where: { chave: CHAVE_ADIANT },
    create: { chave: CHAVE_ADIANT, valor: new Date().toISOString() },
    update: {},
  });
  return { ok: true, marcados, naoAchados };
}

// ---------------------------------------------------------------------------
// Cartão de crédito BB caindo em "PGTO DIVIDAS BANCARIAS" (conta 2131100).
// Duas palavras-chave da base antiga mandavam para lá o pagamento da fatura e os estornos.
// Aqui: desligamos essas palavras-chave e desconsideramos os lançamentos que já entraram,
// do mesmo jeito que o sistema já faz com o pagamento de fatura que bate com o cartão.
// ---------------------------------------------------------------------------
const CHAVE_CARTAO_BB = "AJUSTE_CARTAO_BB_DIVIDAS";
const CONTA_DIVIDAS = "2131100";
const CONTA_CONCILIACAO = "3000000";
const BANCOS_BB = ["BB PJ", "CARTÃO BB PJ"];
// A base antiga guarda os termos sem os acentos e sem as letras acentuadas:
// "CARTÃO" virou "CARTO" e "CRÉDITO" virou "CRDITO". O (?![A-Z]) evita pegar CARTONAGEM.
const RE_CARTAO = /CART[AÃ]?O(?![A-Z])|OUROCARD/;
const RE_ESTORNO = /ESTORNO/;

// O que um lançamento de 2131100 realmente é:
// CARTAO  = pagamento ou crédito de cartão → desconsiderado (igual ao pagamento de fatura)
// ESTORNO = estorno que não é de cartão → volta a ser "a identificar", o Igor decide
export function ehCartaoEmDividas(l) {
  const h = semAcento(`${l.historico} ${l.identificacao || ""}`);
  if (RE_CARTAO.test(h)) return "CARTAO";
  if (RE_ESTORNO.test(h)) return "ESTORNO";
  return null;
}

export async function limparCartaoBBdeDividas({ forcar = false } = {}) {
  if (!forcar) {
    const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_CARTAO_BB } }).catch(() => null);
    if (ja) return { ok: true, jaFeito: true };
  }

  const [dividas, conciliacao] = await Promise.all([
    prisma.finConta.findUnique({ where: { codigo: CONTA_DIVIDAS } }),
    prisma.finConta.findUnique({ where: { codigo: CONTA_CONCILIACAO } }),
  ]);
  if (!dividas) return { ok: false, erro: "Conta 2131100 não encontrada." };

  // 1. desliga as palavras-chave que mandavam cartão e estorno para dívidas bancárias
  const regras = await prisma.finRegra.findMany({ where: { contaId: dividas.id, ativo: true } });
  const desligar = regras.filter((r) => RE_CARTAO.test(semAcento(r.termo)) || RE_ESTORNO.test(semAcento(r.termo)));
  if (desligar.length) {
    await prisma.finRegra.updateMany({ where: { id: { in: desligar.map((r) => r.id) } }, data: { ativo: false } });
  }
  // o pagamento da fatura passa a ser conciliação (entra e sai: não é despesa nem dívida)
  if (conciliacao) {
    const paraConciliar = desligar.filter((r) => RE_CARTAO.test(semAcento(r.termo)));
    for (const r of paraConciliar) {
      const igual = await prisma.finRegra.findFirst({ where: { contaId: conciliacao.id, termo: r.termo } });
      if (!igual) await prisma.finRegra.create({ data: { ...semId(r), contaId: conciliacao.id, ativo: true, usos: 0, descricao: r.descricao || "CARTÃO" } });
    }
  }

  // 2. desconsidera o que já foi lançado em 2131100 e é cartão
  const lancs = await prisma.finLancamento.findMany({
    where: { contaId: dividas.id, substituido: false, desmembrado: false },
    select: { id: true, banco: true, historico: true, identificacao: true, valor: true, competencia: true },
  });
  const alvo = lancs.map((l) => ({ l, k: ehCartaoEmDividas(l) })).filter((x) => x.k);
  const doBB = (x) => BANCOS_BB.includes(x.l.banco);
  const cartao = alvo.filter((x) => x.k === "CARTAO" && doBB(x));
  const estornos = alvo.filter((x) => x.k === "ESTORNO" && doBB(x));
  const outros = alvo.filter((x) => x.k === "CARTAO" && !doBB(x));

  // cartão: desconsiderado, do mesmo jeito que o pagamento de fatura que bate
  for (const { l } of cartao) {
    await prisma.finLancamento.update({
      where: { id: l.id },
      data: { substituido: true, substGrupo: "CARTAOBB|CARTAO", contaId: null },
    });
  }
  // estorno que não é de cartão: só sai da conta e volta a pedir identificação
  for (const { l } of estornos) {
    await prisma.finLancamento.update({ where: { id: l.id }, data: { contaId: null } });
  }

  await prisma.finConfig.upsert({
    where: { chave: CHAVE_CARTAO_BB },
    create: { chave: CHAVE_CARTAO_BB, valor: new Date().toISOString() },
    update: { valor: new Date().toISOString() },
  });

  const soma = (l) => Math.round(l.reduce((s, x) => s + Number(x.l.valor), 0) * 100) / 100;
  return {
    ok: true,
    regrasDesligadas: desligar.map((r) => r.termo),
    descartados: cartao.length,
    valorDescartado: soma(cartao),
    estornosAbertos: estornos.length,
    valorEstornos: soma(estornos),
    // mesmo defeito em outros bancos: não mexo sem o Igor mandar, só aviso
    outrosBancos: [...new Set(outros.map((x) => x.l.banco))],
    outrosLancamentos: outros.length,
    valorOutros: soma(outros),
  };
}
const semId = (r) => ({ ordem: r.ordem, descricao: r.descricao, comparar: r.comparar, termo: r.termo, campo: r.campo, banco: r.banco, dc: r.dc, origem: r.origem });

// ---------------------------------------------------------------------------
// Renomes de conta-caixa combinados com o Igor. garantirContas() só cria o que falta,
// nunca renomeia, então o banco que já existe precisa deste ajuste.
// ---------------------------------------------------------------------------
const RENOMES = [
  ["2128100", "BENEFÍCIOS TRABALHISTAS", "BENEFÍCIOS PESSOAL DE ADMINISTRAÇÃO"],
];

export async function renomearContas() {
  const feitos = [];
  for (const [codigo, de, para] of RENOMES) {
    const c = await prisma.finConta.findUnique({ where: { codigo } }).catch(() => null);
    if (!c || c.nome === para) continue;
    // só renomeia se ainda estiver com o nome antigo (não atropela um nome que o Igor tenha mudado)
    if (semAcento(c.nome) !== semAcento(de)) continue;
    await prisma.finConta.update({ where: { id: c.id }, data: { nome: para } });
    feitos.push({ codigo, de: c.nome, para });
  }
  return { ok: true, renomeadas: feitos };
}

// ---------------------------------------------------------------------------
// Mútuos: a Matriz tinha uma linha única "MUTUOS" de R$ 21.680. Vira quatro, uma por sócio,
// com o dia certo — e o do Emanuel é trimestral (R$ 8.100 a cada 3 meses, peso mensal 2.700).
// ---------------------------------------------------------------------------
const CHAVE_MUTUOS = "AJUSTE_MUTUOS_POR_SOCIO";
export const MUTUOS_POR_SOCIO = [
  { id: "i67a", natureza: "MUTUO LAEL", parceiro: "LAEL", valor: 3000, dia: 10, obs: "todo dia 10" },
  { id: "i67b", natureza: "MUTUO ISABEL", parceiro: "ISABEL", valor: 3500, dia: 5, obs: "todo dia 05" },
  { id: "i67c", natureza: "MUTUO GABRIEL", parceiro: "GABRIEL", valor: 3300, dia: 27, obs: "todo dia 27" },
  { id: "i67d", natureza: "MUTUO EMANUEL", parceiro: "EMANUEL", valor: 2700, valorParcela: 8100,
    periodicidade: 3, inicio: "2026-11", dia: 10,
    obs: "R$ 8.100 a cada 3 meses, dia 10 — na Matriz entra o peso mensal de 2.700" },
];
const ehMutuoAntigo = (it) => semAcento(it?.natureza) === "MUTUOS";

export async function separarMutuos() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_MUTUOS } }).catch(() => null);
  if (ja) return { ok: true, jaFeito: true };

  const matrizes = await prisma.finMatriz.findMany();
  let trocadas = 0, antigos = [];
  for (const m of matrizes) {
    const dados = { ...(m.dados || {}) };
    if (!Array.isArray(dados.dividas)) continue;
    const velho = dados.dividas.find(ehMutuoAntigo);
    if (!velho) continue;
    antigos.push({ id: velho.id, valor: Number(velho.valor) });
    // tira o item único e põe os quatro no lugar, sem mexer no resto da lista
    const i = dados.dividas.findIndex(ehMutuoAntigo);
    dados.dividas = [
      ...dados.dividas.slice(0, i),
      ...MUTUOS_POR_SOCIO.map((x) => ({ ...x, cdb: false })),
      ...dados.dividas.slice(i + 1).filter((x) => !ehMutuoAntigo(x)),
    ];
    await prisma.finMatriz.update({ where: { id: m.id }, data: { dados } });
    trocadas++;
  }

  // a recorrência do item antigo some junto com as previsões em aberto deste mês em diante
  let recorrenciasApagadas = 0, previsoesApagadas = 0;
  for (const a of antigos) {
    const r = await prisma.finRecorrencia.findUnique({ where: { chaveOrigem: `MATRIZ|dividas|${a.id}` } }).catch(() => null);
    if (!r) continue;
    const comp = new Date().toISOString().slice(0, 7);
    const apagar = await prisma.finTitulo.findMany({
      where: { recorrenciaId: r.id, status: "ABERTO", valorConfirmado: false, competencia: { gte: comp } },
      select: { id: true },
    });
    if (apagar.length) await prisma.finTitulo.deleteMany({ where: { id: { in: apagar.map((t) => t.id) } } });
    await prisma.finTitulo.updateMany({ where: { recorrenciaId: r.id }, data: { recorrenciaId: null } });
    await prisma.finRecorrencia.delete({ where: { id: r.id } }).catch(() => {});
    previsoesApagadas += apagar.length;
    recorrenciasApagadas++;
  }

  await prisma.finConfig.upsert({
    where: { chave: CHAVE_MUTUOS },
    create: { chave: CHAVE_MUTUOS, valor: new Date().toISOString() },
    update: {},
  });
  const mensal = MUTUOS_POR_SOCIO.reduce((s, x) => s + x.valor, 0);
  return { ok: true, matrizesTrocadas: trocadas, antigos, recorrenciasApagadas, previsoesApagadas, mensal, criados: MUTUOS_POR_SOCIO.length };
}
