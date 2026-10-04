// Freelancers e terceirizados: cadastro e os catálogos que ligam cada serviço à sua conta-caixa.
// Tudo que entra aqui é CMV — varia com a produção.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// ---- freelancer: um setor por pessoa, cada setor tem a sua conta-caixa ----
export const SETORES_FREELANCER = [
  { k: "CORTE", n: "Corte", conta: "2117200" },
  { k: "COSTURA", n: "Costura", conta: "2117400" },
  { k: "EXPEDICAO", n: "Expedição", conta: "2117300" },
  { k: "SILK", n: "Silk", conta: "2117510" },
  { k: "BORDADO", n: "Bordado", conta: "2117520" },
  { k: "LOGISTICA", n: "Logística", conta: "2117600" },
];

// ---- facção: uma conta-caixa por tipo de peça ----
export const TIPOS_FACCAO = [
  { k: "CAMISETA", n: "Camiseta", conta: "2114610" },
  { k: "POLO", n: "Polo", conta: "2114620" },
  { k: "MOLETOM", n: "Moletom", conta: "2114630" },
  { k: "JAQUETA", n: "Jaqueta", conta: "2114640" },
  { k: "CAMISA_SOCIAL", n: "Camisa social", conta: "2114650" },
  { k: "JALECO_OPERACIONAL", n: "Jaleco operacional", conta: "2114660" },
  { k: "CALCA_OPERACIONAL", n: "Calça operacional", conta: "2114670" },
  { k: "CALCA_JEANS", n: "Calça jeans", conta: "2114680" },
  { k: "CALCA_SOCIAL", n: "Calça social", conta: "2114690" },
];

// ---- serviço terceirizado: aproveita as contas que já existiam ----
export const SERVICOS_TERCEIRIZADOS = [
  { k: "CORTE", n: "Corte", conta: "2114700" },
  { k: "SILK", n: "Silk", conta: "2114200" },
  { k: "BORDADO", n: "Bordado", conta: "2114100" },
  { k: "SUBLIMACAO", n: "Sublimação", conta: "2114300" },
  { k: "DTF", n: "DTF", conta: "2114930" },
];

// contas-caixa que este módulo precisa que existam (todas CMV)
export const CONTAS_PRESTADORES = [
  ...TIPOS_FACCAO.map((t) => [t.conta, `FACÇÃO ${t.n.toUpperCase()}`]),
  ["2114930", "DTF"],
];

export const GRUPOS_ITEM = {
  FREELANCER: { n: "Freelancer", catalogo: SETORES_FREELANCER },
  FACCAO: { n: "Facção", catalogo: TIPOS_FACCAO },
  SERVICO: { n: "Serviço terceirizado", catalogo: SERVICOS_TERCEIRIZADOS },
};

// catálogo de um grupo, ou todos juntos
export const catalogoDe = (grupo) => (GRUPOS_ITEM[grupo] || {}).catalogo || [];
export function contaDoSetor(grupo, setor) {
  const c = catalogoDe(grupo).find((x) => x.k === setor);
  return c ? c.conta : null;
}
export function nomeSetor(grupo, setor) {
  const c = catalogoDe(grupo).find((x) => x.k === setor);
  return c ? c.n : setor;
}
// o que um terceirizado pode prestar: facção por tipo de peça + serviços
export const SERVICOS_DE_TERCEIRIZADO = [
  ...TIPOS_FACCAO.map((t) => ({ ...t, grupo: "FACCAO", n: `Facção · ${t.n}` })),
  ...SERVICOS_TERCEIRIZADOS.map((t) => ({ ...t, grupo: "SERVICO", n: `Serviço · ${t.n}` })),
];

// ---------------- cadastro ----------------
const TIPOS = ["FREELANCER", "TERCEIRIZADO"];
const limpaPix = (t) => String(t || "").trim();

export function validar(tipo, c) {
  if (!TIPOS.includes(tipo)) return "Tipo inválido.";
  if (!String(c.nome || "").trim()) return "O nome é obrigatório.";
  if (!limpaPix(c.chavePix)) return "A chave PIX é obrigatória.";
  if (!Array.isArray(c.servicos) || !c.servicos.length) {
    return tipo === "FREELANCER" ? "Escolha o setor em que ele trabalha." : "Escolha pelo menos um serviço prestado.";
  }
  const validos = tipo === "FREELANCER" ? SETORES_FREELANCER.map((s) => s.k) : SERVICOS_DE_TERCEIRIZADO.map((s) => `${s.grupo}:${s.k}`);
  const fora = c.servicos.filter((s) => !validos.includes(s));
  if (fora.length) return `Serviço desconhecido: ${fora.join(", ")}.`;
  if (tipo === "TERCEIRIZADO" && !String(c.endereco || "").trim()) return "O endereço do terceirizado é obrigatório.";
  return null;
}

const saida = (p) => ({ ...p, capacidade: p.capacidade == null ? null : Number(p.capacidade) });

export async function listar(tipo) {
  const where = TIPOS.includes(tipo) ? { tipo } : {};
  const l = await prisma.prestador.findMany({ where, orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
  return l.map(saida);
}

export async function salvar(tipo, campos, { id, quem } = {}) {
  const erro = validar(tipo, campos);
  if (erro) return { ok: false, erro };
  const data = {
    tipo,
    nome: String(campos.nome).trim().toUpperCase(),
    telefone: campos.telefone ? String(campos.telefone).trim() : null,
    chavePix: limpaPix(campos.chavePix),
    servicos: campos.servicos,
    capacidade: campos.capacidade == null || campos.capacidade === "" ? null : Math.max(0, Number(campos.capacidade) || 0),
    endereco: campos.endereco ? String(campos.endereco).trim().toUpperCase() : null,
    documento: campos.documento ? String(campos.documento).replace(/\D/g, "") || null : null,
    observacao: campos.observacao ? String(campos.observacao).trim().toUpperCase() : null,
    ...(campos.ativo === undefined ? {} : { ativo: !!campos.ativo }),
  };
  // mesmo nome e mesmo tipo = a mesma pessoa; não deixo cadastrar duas vezes
  const igual = await prisma.prestador.findFirst({ where: { tipo, nome: data.nome, ...(id ? { NOT: { id: Number(id) } } : {}) } });
  if (igual) return { ok: false, erro: `Já existe um ${tipo === "FREELANCER" ? "freelancer" : "terceirizado"} chamado ${data.nome}.` };

  const p = id
    ? await prisma.prestador.update({ where: { id: Number(id) }, data })
    : await prisma.prestador.create({ data: { ...data, criadoPorNome: quem || null } });
  return { ok: true, prestador: saida(p), novo: !id };
}

export async function excluir(id) {
  const n = await prisma.finSemanaItem.count({ where: { prestadorId: Number(id) } }).catch(() => 0);
  if (n) {
    // já tem lançamento no nome dele: desativa em vez de apagar, para não perder histórico
    const p = await prisma.prestador.update({ where: { id: Number(id) }, data: { ativo: false } });
    return { ok: true, desativado: true, prestador: saida(p), lancamentos: n };
  }
  await prisma.prestador.delete({ where: { id: Number(id) } }).catch(() => null);
  return { ok: true, desativado: false };
}

// garante as contas-caixa dos tipos de facção e do DTF
export async function garantirContasPrestadores() {
  const codigos = CONTAS_PRESTADORES.map(([c]) => c);
  const tem = new Set((await prisma.finConta.findMany({ where: { codigo: { in: codigos } }, select: { codigo: true } })).map((c) => c.codigo));
  const faltam = CONTAS_PRESTADORES.filter(([c]) => !tem.has(c));
  if (faltam.length) {
    await prisma.finConta.createMany({ data: faltam.map(([codigo, nome]) => ({ codigo, nome })), skipDuplicates: true });
  }
  return faltam.length;
}

export { r2 };
