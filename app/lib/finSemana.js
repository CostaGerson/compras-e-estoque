// Contas da semana: toda sexta nascem dois títulos — FREELANCERS DA SEMANA e
// TERCEIRIZADOS DA SEMANA. Cada um é uma casca; o que vale são os itens lançados dentro,
// e é a soma deles que vira o valor e o rateio do título (por isso a DRE já sai certa).
import { prisma } from "@/lib/prisma";
import {
  SETORES_FREELANCER, TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS, GRUPOS_ITEM, GRUPOS_POR_TIPO,
  GRUPO_DESCREVE, ehServico, catalogoDe, contaDoSetor, nomeSetor, garantirContasPrestadores, r2,
} from "@/lib/prestadores";

const MS_DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const dataUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);
const compDe = (s) => String(s).slice(0, 7);
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => String(s).slice(0, 10).split("-").reverse().join("/");

export const TIPOS_SEMANA = {
  FREELANCER: { titulo: "FREELANCERS DA SEMANA", parceiro: "FREELANCERS", grupos: GRUPOS_POR_TIPO.FREELANCER },
  TERCEIRIZADO: { titulo: "TERCEIRIZADOS DA SEMANA", parceiro: "TERCEIRIZADOS", grupos: GRUPOS_POR_TIPO.TERCEIRIZADO },
};
export const chaveSemana = (tipo, data, excepcional) => `SEMANA|${tipo}|${data}${excepcional ? "|EXC" : ""}`;
export const tipoDoGrupo = (grupo) => (grupo === "FREELANCER" ? "FREELANCER" : "TERCEIRIZADO");

// todas as sextas-feiras de um mês (AAAA-MM)
export function sextasDoMes(competencia) {
  const [a, m] = String(competencia).split("-").map(Number);
  const out = [];
  const d = new Date(Date.UTC(a, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    if (d.getUTCDay() === 5) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// a sexta da semana de uma data qualquer (segunda a domingo)
export function sextaDaSemana(data) {
  const d = new Date(data);
  const dia = d.getUTCDay();
  const ate = dia === 0 ? 5 : 5 - dia;
  d.setUTCDate(d.getUTCDate() + ate);
  return iso(d);
}

// a primeira sexta a partir da data (a própria data, se já for sexta)
export function sextaAPartirDe(data) {
  const d = new Date(data);
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

// prazo em dias corridos: aceita 0 (à vista), recusa vazio e lixo
export function prazoEmDias(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

// Serviço recebido em tal dia, com tanto de prazo: quando vence e em que sexta se paga.
export function programacao(dataRecebimento, prazoDias) {
  if (!dataRecebimento || prazoEmDias(prazoDias) === null) return null;
  const venc = new Date(dataUTC(dataRecebimento).getTime() + prazoEmDias(prazoDias) * MS_DIA);
  const sexta = sextaAPartirDe(venc);
  return {
    recebimento: iso(dataUTC(dataRecebimento)),
    prazoDias: prazoEmDias(prazoDias),
    vencimento: iso(venc),
    sexta,
    aviso: `Pagamento programado para ${dBR(sexta)}, a primeira sexta-feira a partir do vencimento (${dBR(iso(venc))}). Confirma ciência?`,
  };
}

// Cria as duas contas de cada sexta do mês (se ainda não existirem).
export async function garantirSemanas(competencia) {
  const sextas = sextasDoMes(competencia);
  if (!sextas.length) return { criados: 0, sextas: [] };
  const chaves = [];
  for (const s of sextas) for (const t of Object.keys(TIPOS_SEMANA)) chaves.push(chaveSemana(t, s));
  const tem = new Set((await prisma.finTitulo.findMany({ where: { chaveImport: { in: chaves } }, select: { chaveImport: true } })).map((x) => x.chaveImport));

  const novos = [];
  for (const s of sextas) {
    for (const [t, cfg] of Object.entries(TIPOS_SEMANA)) {
      const chave = chaveSemana(t, s);
      if (tem.has(chave)) continue;
      novos.push(cascaDaSemana(t, cfg, s, false));
    }
  }
  if (novos.length) await prisma.finTitulo.createMany({ data: novos, skipDuplicates: true });
  return { criados: novos.length, sextas };
}

const cascaDaSemana = (tipo, cfg, data, excepcional) => ({
  tipo: "PAGAR",
  titulo: excepcional ? `${cfg.titulo.replace(" DA SEMANA", "")} · PAGAMENTO EXCEPCIONAL` : cfg.titulo,
  parceiro: cfg.parceiro, valor: 0, vencimento: dataUTC(data), competencia: compDe(data),
  previsao: true, valorConfirmado: false, rateio: [], forma: "SEMANAL",
  chaveImport: chaveSemana(tipo, data, excepcional),
  observacao: excepcional ? `PAGAMENTO EXCEPCIONAL EM ${dBR(data)}` : `SEMANA FECHADA EM ${dBR(data)}`,
});

// Acha (ou cria) o título de um tipo numa data — a casca da sexta, ou a do pagamento excepcional.
export async function tituloDaData(tipo, data, excepcional = false) {
  const cfg = TIPOS_SEMANA[tipo];
  if (!cfg) return null;
  const chave = chaveSemana(tipo, String(data).slice(0, 10), excepcional);
  const existe = await prisma.finTitulo.findFirst({ where: { chaveImport: chave } });
  if (existe) return existe;
  return prisma.finTitulo.create({ data: cascaDaSemana(tipo, cfg, data, excepcional) });
}

// ---------------- itens ----------------
// Freelancer: (diária + transporte) × dias + custo extra. Facção e serviço somam as linhas.
export function valorDoItem(item) {
  if (item.grupo === "FREELANCER") {
    const dia = (Number(item.diaria) || 0) + (Number(item.transporte) || 0);
    return r2(dia * (Number(item.dias) || 0) + (Number(item.custoExtra) || 0));
  }
  return r2((item.linhas || []).reduce((s, l) => s + (Number(l.qtd) || 0) * (Number(l.unitario) || 0), 0));
}

export function validarItem(item) {
  if (!GRUPOS_ITEM[item.grupo]) return "Grupo inválido.";
  if (!String(item.nome || "").trim()) return "Escolha o prestador.";
  if (!String(item.chavePix || "").trim()) return "A chave PIX é obrigatória.";
  if (!catalogoDe(item.grupo).some((c) => c.k === item.setor)) {
    return item.grupo === "FREELANCER" ? "Escolha o setor." : "Escolha o tipo de peça ou o serviço.";
  }
  if (item.grupo === "FREELANCER") {
    if (!(Number(item.diaria) > 0)) return "Informe o valor da diária.";
    if (!(Number(item.dias) > 0)) return "Informe quantos dias ele trabalhou.";
    if (Number(item.custoExtra) > 0 && !String(item.justificativa || "").trim()) {
      return "Com custo extra, a justificativa é obrigatória.";
    }
    return null;
  }
  if (item.grupo === GRUPO_DESCREVE && !String(item.descricao || "").trim()) {
    return "Descreva o serviço prestado.";
  }
  const linhas = item.linhas || [];
  if (!linhas.length) return "Lance pelo menos um pedido.";
  for (const [i, l] of linhas.entries()) {
    const n = i + 1;
    if (!String(l.pedido || "").trim()) return `Linha ${n}: informe o nº do pedido.`;
    if (!(Number(l.qtd) > 0)) return `Linha ${n}: informe a quantidade.`;
    if (!(Number(l.unitario) > 0)) return `Linha ${n}: informe o valor unitário.`;
  }
  if (ehServico(item.grupo) || item.grupo === "FACCAO") {
    if (!item.dataRecebimento) return "Informe a data em que o serviço foi recebido.";
    if (prazoEmDias(item.prazoDias) === null) return "Informe o prazo de pagamento negociado, em dias corridos.";
    if (item.excepcional) {
      if (!item.dataPagamento) return "No pagamento excepcional, escolha a data de pagamento.";
      if (!String(item.justificativa || "").trim()) return "No pagamento excepcional, a justificativa é obrigatória.";
    }
  }
  return null;
}

const normLinhas = (linhas) => (linhas || []).map((l) => ({
  pedido: String(l.pedido || "").trim().toUpperCase(),
  item: String(l.item || "").trim().toUpperCase() || null,
  qtd: Number(l.qtd) || 0,
  unitario: r2(l.unitario),
  total: r2((Number(l.qtd) || 0) * (Number(l.unitario) || 0)),
}));

// Em que título o item deve cair.
export async function destinoDoItem(item, tituloAtual) {
  const tipo = tipoDoGrupo(item.grupo);
  if (item.grupo === "FREELANCER") {
    // o freelancer é pago na semana em que trabalhou
    const data = item.sexta || (tituloAtual ? iso(new Date(tituloAtual.vencimento)) : sextaDaSemana(new Date()));
    return { titulo: await tituloDaData(tipo, sextaAPartirDe(data), false), excepcional: false, programado: null };
  }
  if (item.excepcional && item.dataPagamento) {
    return { titulo: await tituloDaData(tipo, item.dataPagamento, true), excepcional: true, programado: programacao(item.dataRecebimento, item.prazoDias) };
  }
  const prog = programacao(item.dataRecebimento, item.prazoDias);
  if (prog) return { titulo: await tituloDaData(tipo, prog.sexta, false), excepcional: false, programado: prog };
  const data = item.sexta || (tituloAtual ? iso(new Date(tituloAtual.vencimento)) : sextaDaSemana(new Date()));
  return { titulo: await tituloDaData(tipo, sextaAPartirDe(data), false), excepcional: false, programado: null };
}

// Refaz valor e rateio do título a partir dos seus itens.
export async function recalcular(tituloId) {
  const itens = await prisma.finSemanaItem.findMany({ where: { tituloId: Number(tituloId) } });
  const total = r2(itens.reduce((s, i) => s + Number(i.valor), 0));
  const porConta = {};
  for (const i of itens) if (i.contaId) porConta[i.contaId] = r2((porConta[i.contaId] || 0) + Number(i.valor));
  const ents = Object.entries(porConta).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  let acc = 0;
  const rateio = total
    ? ents.map(([contaId, v], k) => {
        const pct = k === ents.length - 1 ? r2(100 - acc) : r2((v / total) * 100);
        acc = r2(acc + pct);
        return { contaId: Number(contaId), pct };
      })
    : [];
  await prisma.finTitulo.update({ where: { id: Number(tituloId) }, data: { valor: total, rateio, previsao: total === 0 } });
  return { total, itens: itens.length, rateio };
}

export async function listarItens(tituloId) {
  const itens = await prisma.finSemanaItem.findMany({ where: { tituloId: Number(tituloId) }, orderBy: [{ grupo: "asc" }, { nome: "asc" }] });
  return itens.map((i) => ({
    ...i,
    valor: Number(i.valor),
    diaria: i.diaria == null ? null : Number(i.diaria),
    transporte: i.transporte == null ? null : Number(i.transporte),
    custoExtra: i.custoExtra == null ? null : Number(i.custoExtra),
    setorNome: nomeSetor(i.grupo, i.setor),
    grupoNome: (GRUPOS_ITEM[i.grupo] || {}).n || i.grupo,
  }));
}

// Avisa o financeiro quando alguém marca um pagamento como excepcional.
async function avisarFinanceiro(texto, deId) {
  const destinos = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { setor: "FINANCEIRO" }] }, select: { id: true } });
  if (!destinos.length) return 0;
  const de = deId || destinos[0].id;
  await prisma.mensagem.createMany({ data: destinos.map((u) => ({ deId: de, paraId: u.id, texto })) });
  return destinos.length;
}

export async function salvarItem(tituloId, item, { id, quem, usuarioId } = {}) {
  const erro = validarItem(item);
  if (erro) return { ok: false, erro };
  await garantirContasPrestadores();
  const codigo = contaDoSetor(item.grupo, item.setor);
  const conta = await prisma.finConta.findUnique({ where: { codigo } });
  if (!conta) return { ok: false, erro: `A conta-caixa ${codigo} não existe.` };

  const atual = tituloId ? await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } }) : null;
  const destino = await destinoDoItem(item, atual);
  if (!destino.titulo) return { ok: false, erro: "Não consegui achar a conta da semana." };

  const linhas = item.grupo === "FREELANCER" ? [] : normLinhas(item.linhas);
  const free = item.grupo === "FREELANCER";
  const data = {
    tituloId: destino.titulo.id,
    grupo: item.grupo,
    prestadorId: item.prestadorId ? Number(item.prestadorId) : null,
    nome: String(item.nome).trim().toUpperCase(),
    chavePix: String(item.chavePix).trim(),
    setor: item.setor,
    contaId: conta.id,
    diaria: free ? r2(item.diaria) : null,
    dias: free ? Number(item.dias) || 0 : null,
    transporte: free ? r2(item.transporte) : null,
    custoExtra: free ? r2(item.custoExtra) : null,
    justificativa: item.justificativa ? String(item.justificativa).trim().toUpperCase() : null,
    descricao: item.descricao ? String(item.descricao).trim().toUpperCase() : null,
    dataRecebimento: !free && item.dataRecebimento ? dataUTC(item.dataRecebimento) : null,
    prazoDias: free ? null : prazoEmDias(item.prazoDias),
    vencimentoNegociado: destino.programado ? dataUTC(destino.programado.vencimento) : null,
    excepcional: !!destino.excepcional,
    linhas,
    valor: valorDoItem({ ...item, linhas }),
    observacao: item.observacao ? String(item.observacao).trim().toUpperCase() : null,
  };

  const antes = id ? await prisma.finSemanaItem.findUnique({ where: { id: Number(id) } }) : null;
  const salvo = id
    ? await prisma.finSemanaItem.update({ where: { id: Number(id) }, data })
    : await prisma.finSemanaItem.create({ data: { ...data, criadoPorNome: quem || null } });

  // o item pode ter mudado de semana: as duas contas precisam ser refeitas
  const refazer = new Set([destino.titulo.id, ...(antes ? [antes.tituloId] : []), ...(tituloId ? [Number(tituloId)] : [])]);
  let tot = null;
  for (const t of refazer) tot = (await recalcular(t)) || tot;

  let avisados = 0;
  if (destino.excepcional && (!antes || !antes.excepcional)) {
    avisados = await avisarFinanceiro(
      `PAGAMENTO EXCEPCIONAL · ${data.nome} · R$ ${brl(data.valor)} programado para ${dBR(destino.titulo.vencimento.toISOString?.() || destino.titulo.vencimento)}`
      + (destino.programado ? ` (a sexta normal seria ${dBR(destino.programado.sexta)})` : "")
      + `. Justificativa: ${data.justificativa || "—"}. Lançado por ${quem || "—"}.`,
      usuarioId,
    ).catch(() => 0);
  }

  return {
    ok: true,
    item: { ...salvo, valor: Number(salvo.valor) },
    tituloId: destino.titulo.id,
    mudouDeSemana: !!tituloId && destino.titulo.id !== Number(tituloId),
    programado: destino.programado,
    excepcional: destino.excepcional,
    avisados,
    ...(tot || {}),
  };
}

export async function excluirItem(id) {
  const i = await prisma.finSemanaItem.findUnique({ where: { id: Number(id) } });
  if (!i) return { ok: false, erro: "Lançamento não encontrado." };
  await prisma.finSemanaItem.delete({ where: { id: i.id } });
  const tot = await recalcular(i.tituloId);
  return { ok: true, ...tot };
}

// Tudo que a tela da semana precisa.
export async function abrirSemana(tituloId) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } });
  if (!t) return { ok: false, erro: "Conta da semana não encontrada." };
  const partes = String(t.chaveImport || "").split("|");
  const tipo = partes[1] || null;
  const cfg = TIPOS_SEMANA[tipo];
  const [itens, prestadores] = await Promise.all([
    listarItens(t.id),
    prisma.prestador.findMany({ where: { ativo: true, tipo: tipo === "FREELANCER" ? "FREELANCER" : "TERCEIRIZADO" }, orderBy: { nome: "asc" } }),
  ]);
  const porGrupo = {};
  for (const i of itens) porGrupo[i.grupo] = r2((porGrupo[i.grupo] || 0) + i.valor);
  const catalogos = Object.fromEntries(Object.entries(GRUPOS_ITEM).map(([k, v]) => [k, v.catalogo]));
  return {
    ok: true,
    titulo: { id: t.id, nome: t.titulo, vencimento: t.vencimento, competencia: t.competencia, status: t.status, valor: Number(t.valor) },
    tipo, grupos: cfg ? cfg.grupos : [],
    excepcional: partes[3] === "EXC",
    nomesGrupo: Object.fromEntries(Object.entries(GRUPOS_ITEM).map(([k, v]) => [k, v.n])),
    grupoDescreve: GRUPO_DESCREVE,
    catalogos, itens, prestadores,
    total: r2(itens.reduce((s, i) => s + i.valor, 0)),
    porGrupo,
  };
}

export { SETORES_FREELANCER, TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS };
