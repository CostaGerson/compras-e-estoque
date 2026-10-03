// Ponte Alavancagem → Matriz oficial (aba Dívidas) → Contas a pagar.
// Nada é lançado direto no contas a pagar: os contratos viram itens da aba Dívidas da Matriz e seguem
// pelo caminho que já existe (lib/finMatrizRec.js → lib/finMatrizRecDb.js), sem duplicar parcela.
import { prisma } from "@/lib/prisma";
import { calcular, GRUPOS } from "@/lib/alavancagem";

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
export const chaveItem = (contratoId) => `CONTRATO:${contratoId}`;

// conta-caixa sugerida (mesma lógica da Matriz: sócios/mútuos x bancos x máquinas)
export function contaSugerida(c) {
  const n = String(c.nome || "").toUpperCase();
  if (c.tipo === "MUTUO") return "2131200";
  if (c.tipo === "INVESTIMENTO") return "2133300";
  if (/CONSIGNADO|CDC/.test(n)) return "2131200";
  return "2131100";
}

// o que cada contrato pesa por mês na Matriz
export function itemDaMatriz(contrato, hoje = new Date()) {
  const c = calcular(contrato, hoje);
  const valor = r2(c.mensal);
  if (!valor) return null;
  const sufixo = contrato.tipo === "MUTUO" ? "juros mensais" : `parcela ${c.parcelasPagas + 1}/${c.prazoMeses}`;
  return {
    id: chaveItem(contrato.id),
    contratoId: contrato.id,
    natureza: String(contrato.nome).toUpperCase(),
    valor,
    cdb: false,
    obs: `${GRUPOS[contrato.grupo] || ""} · ${sufixo}`.trim(),
    contaCaixa: contrato.contaCaixa || contaSugerida(contrato),
  };
}

// Sincroniza a aba Dívidas da matriz oficial com os contratos ativos.
// Itens que não vieram de contrato ficam intactos; contrato quitado/inativo sai da lista.
export async function sincronizarMatriz({ usuarioNome } = {}) {
  const matriz = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!matriz) return { ok: false, erro: "Matriz oficial ainda não existe. Abra a Matriz de custos uma vez." };

  const contratos = await prisma.finContrato.findMany({ where: { ativo: true, quitado: false } });
  const novos = contratos.map((c) => itemDaMatriz(c)).filter(Boolean);

  const dados = { ...(matriz.dados || {}) };
  const atuais = Array.isArray(dados.dividas) ? dados.dividas : [];
  const manuais = atuais.filter((i) => !String(i.id || "").startsWith("CONTRATO:"));
  const antesPorId = Object.fromEntries(atuais.filter((i) => String(i.id || "").startsWith("CONTRATO:")).map((i) => [i.id, i]));

  let criados = 0, atualizados = 0;
  const finais = novos.map((i) => {
    const velho = antesPorId[i.id];
    if (!velho) { criados++; return i; }
    if (r2(velho.valor) !== r2(i.valor) || velho.natureza !== i.natureza) atualizados++;
    return { ...velho, ...i };
  });
  const removidos = Object.keys(antesPorId).filter((k) => !novos.some((i) => i.id === k)).length;

  dados.dividas = [...manuais, ...finais];
  await prisma.finMatriz.update({
    where: { id: matriz.id },
    data: { dados, atualizadoPor: usuarioNome || "ALAVANCAGEM" },
  });

  return { ok: true, criados, atualizados, removidos, itens: finais.length, manuais: manuais.length, mensal: r2(finais.reduce((s, i) => s + i.valor, 0)) };
}

// Prévia do que a sincronização faria (sem gravar).
export async function previaMatriz() {
  const [matriz, contratos] = await Promise.all([
    prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } }),
    prisma.finContrato.findMany({ where: { ativo: true, quitado: false } }),
  ]);
  const atuais = Array.isArray(matriz?.dados?.dividas) ? matriz.dados.dividas : [];
  const porId = Object.fromEntries(atuais.map((i) => [i.id, i]));
  return contratos.map((c) => {
    const i = itemDaMatriz(c);
    if (!i) return null;
    const velho = porId[i.id];
    return {
      contratoId: c.id, nome: i.natureza, valor: i.valor, obs: i.obs,
      estado: !velho ? "NOVO" : r2(velho.valor) !== i.valor ? "ATUALIZA" : "IGUAL",
      valorAtual: velho ? r2(velho.valor) : null,
    };
  }).filter(Boolean);
}

// Crédito recebido na contratação → título a receber (opcional, ao cadastrar o contrato).
export async function lancarCreditoContratado(contrato, usuarioNome) {
  const valor = r2(Number(contrato.capital) - Number(contrato.entrada || 0));
  if (!valor || !contrato.dataContrato) return null;
  const chave = `CONTRATO-CREDITO:${contrato.id}`;
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });
  if (ja) return ja;
  return prisma.finTitulo.create({
    data: {
      tipo: "RECEBER",
      titulo: `CRÉDITO CONTRATADO · ${String(contrato.nome).toUpperCase()}`,
      parceiro: String(contrato.credor || contrato.nome).toUpperCase(),
      valor,
      vencimento: new Date(contrato.dataContrato),
      competencia: new Date(contrato.dataContrato).toISOString().slice(0, 7),
      previsao: false,
      status: "ABERTO",
      forma: "MANUAL",
      rateio: [],
      observacao: "CRÉDITO RECEBIDO NA CONTRATAÇÃO (ALAVANCAGEM)",
      chaveImport: chave,
      criadoPorNome: usuarioNome || "ALAVANCAGEM",
    },
  }).catch(() => null);
}
