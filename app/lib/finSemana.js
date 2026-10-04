// Contas da semana: toda sexta nascem dois títulos — FREELANCERS DA SEMANA e
// TERCEIRIZADOS DA SEMANA. Cada um é uma casca; o que vale são os itens lançados dentro,
// e é a soma deles que vira o valor e o rateio do título (por isso a DRE já sai certa).
import { prisma } from "@/lib/prisma";
import {
  SETORES_FREELANCER, TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS, GRUPOS_ITEM,
  catalogoDe, contaDoSetor, nomeSetor, garantirContasPrestadores, r2,
} from "@/lib/prestadores";

const MS_DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const dataUTC = (s) => new Date(`${s}T00:00:00.000Z`);

export const TIPOS_SEMANA = {
  FREELANCER: { titulo: "FREELANCERS DA SEMANA", parceiro: "FREELANCERS", grupos: ["FREELANCER"] },
  TERCEIRIZADO: { titulo: "TERCEIRIZADOS DA SEMANA", parceiro: "TERCEIRIZADOS", grupos: ["FACCAO", "SERVICO"] },
};
export const chaveSemana = (tipo, sexta) => `SEMANA|${tipo}|${sexta}`;

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
  const dia = d.getUTCDay();                       // 0 dom … 5 sex
  const ate = dia === 0 ? 5 : 5 - dia;             // domingo pertence à semana que acabou
  d.setUTCDate(d.getUTCDate() + ate);
  return iso(d);
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
      novos.push({
        tipo: "PAGAR", titulo: cfg.titulo, parceiro: cfg.parceiro,
        valor: 0, vencimento: dataUTC(s), competencia, previsao: true, valorConfirmado: false,
        rateio: [], forma: "SEMANAL", chaveImport: chave,
        observacao: `SEMANA FECHADA EM ${s.split("-").reverse().join("/")}`,
      });
    }
  }
  if (novos.length) await prisma.finTitulo.createMany({ data: novos, skipDuplicates: true });
  return { criados: novos.length, sextas };
}

// ---------------- itens ----------------
// O valor de um item: freelancer é diária × dias; facção e serviço somam as linhas de pedido.
export function valorDoItem(item) {
  if (item.grupo === "FREELANCER") return r2((Number(item.diaria) || 0) * (Number(item.dias) || 0));
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
    return null;
  }
  const linhas = item.linhas || [];
  if (!linhas.length) return "Lance pelo menos um pedido.";
  for (const [i, l] of linhas.entries()) {
    const n = i + 1;
    if (!String(l.pedido || "").trim()) return `Linha ${n}: informe o nº do pedido.`;
    if (!(Number(l.qtd) > 0)) return `Linha ${n}: informe a quantidade.`;
    if (!(Number(l.unitario) > 0)) return `Linha ${n}: informe o valor unitário.`;
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

// Refaz valor e rateio do título a partir dos seus itens.
export async function recalcular(tituloId) {
  const [itens, contas] = await Promise.all([
    prisma.finSemanaItem.findMany({ where: { tituloId: Number(tituloId) } }),
    prisma.finConta.findMany({ select: { id: true, codigo: true } }),
  ]);
  const total = r2(itens.reduce((s, i) => s + Number(i.valor), 0));

  // rateio proporcional por conta-caixa, fechando 100 na maior
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

  await prisma.finTitulo.update({
    where: { id: Number(tituloId) },
    data: { valor: total, rateio, previsao: total === 0 },
  });
  return { total, itens: itens.length, rateio };
}

export async function listarItens(tituloId) {
  const itens = await prisma.finSemanaItem.findMany({ where: { tituloId: Number(tituloId) }, orderBy: [{ grupo: "asc" }, { nome: "asc" }] });
  return itens.map((i) => ({
    ...i,
    valor: Number(i.valor),
    diaria: i.diaria == null ? null : Number(i.diaria),
    setorNome: nomeSetor(i.grupo, i.setor),
  }));
}

export async function salvarItem(tituloId, item, { id, quem } = {}) {
  const erro = validarItem(item);
  if (erro) return { ok: false, erro };
  await garantirContasPrestadores();
  const codigo = contaDoSetor(item.grupo, item.setor);
  const conta = await prisma.finConta.findUnique({ where: { codigo } });
  if (!conta) return { ok: false, erro: `A conta-caixa ${codigo} não existe.` };

  const linhas = item.grupo === "FREELANCER" ? [] : normLinhas(item.linhas);
  const data = {
    tituloId: Number(tituloId),
    grupo: item.grupo,
    prestadorId: item.prestadorId ? Number(item.prestadorId) : null,
    nome: String(item.nome).trim().toUpperCase(),
    chavePix: String(item.chavePix).trim(),
    setor: item.setor,
    contaId: conta.id,
    diaria: item.grupo === "FREELANCER" ? r2(item.diaria) : null,
    dias: item.grupo === "FREELANCER" ? Number(item.dias) || 0 : null,
    linhas,
    valor: valorDoItem({ ...item, linhas }),
    observacao: item.observacao ? String(item.observacao).trim().toUpperCase() : null,
  };
  const salvo = id
    ? await prisma.finSemanaItem.update({ where: { id: Number(id) }, data })
    : await prisma.finSemanaItem.create({ data: { ...data, criadoPorNome: quem || null } });
  const tot = await recalcular(tituloId);
  return { ok: true, item: { ...salvo, valor: Number(salvo.valor) }, ...tot };
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
  const tipo = String(t.chaveImport || "").split("|")[1] || null;
  const cfg = TIPOS_SEMANA[tipo];
  const [itens, prestadores] = await Promise.all([
    listarItens(t.id),
    prisma.prestador.findMany({
      where: { ativo: true, tipo: tipo === "FREELANCER" ? "FREELANCER" : "TERCEIRIZADO" },
      orderBy: { nome: "asc" },
    }),
  ]);
  const porGrupo = {};
  for (const i of itens) porGrupo[i.grupo] = r2((porGrupo[i.grupo] || 0) + i.valor);
  return {
    ok: true,
    titulo: { id: t.id, nome: t.titulo, vencimento: t.vencimento, competencia: t.competencia, status: t.status, valor: Number(t.valor) },
    tipo, grupos: cfg ? cfg.grupos : [],
    catalogos: { FREELANCER: SETORES_FREELANCER, FACCAO: TIPOS_FACCAO, SERVICO: SERVICOS_TERCEIRIZADOS },
    itens, prestadores,
    total: r2(itens.reduce((s, i) => s + i.valor, 0)),
    porGrupo,
  };
}
