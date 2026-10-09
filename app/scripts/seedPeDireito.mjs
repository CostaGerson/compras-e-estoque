// v174 — Pé Direito (status de 09/10/2026): contas a receber previstas dos lotes 03/04, 06 e 07/08
// e demandas para o IGOR: no dia de cada entrega dos lotes 06 e 07/08, confirmar a entrega e emitir o boleto de
// antecipação; no lote 03/04, cobrar à vista na entrega final. Roda uma vez (idempotente).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CONTAS = [
  { chave: "PEDIREITO|LOTE03-04|SALDO", titulo: "PÉ DIREITO · LOTES 03 E 04 · SALDO FINAL (93 PEÇAS)", valor: 2315.70, venc: "2026-10-16", forma: null, tarefas: [["2026-10-16", "ENTREGA FINAL (65 PEÇAS)"]],
    obs: "STATUS 09/10/2026: APÓS A ENTREGA FINAL DE 16/10 (NF 1986 · 52, NF 1988 · 41 E 65 PENDENTES), À VISTA. JÁ PAGO: 1.202 PEÇAS · R$ 29.929,80." },
  { chave: "PEDIREITO|LOTE06|80", titulo: "PÉ DIREITO · LOTE 06 · RESTANTE 80% (2.000 CAMISAS)", valor: 39840.00, venc: "2026-11-30", forma: "BOLETO", tarefas: [["2026-10-13", "NF 2005 · 351 PEÇAS"]],
    obs: "STATUS 09/10/2026: ENTRADA 20% R$ 9.960,00 PAGA EM 29/09. ENTREGAS: NF 1993 (1.627 EM 08/10), NF 2005 (351 EM 13/10), REPOSIÇÃO 22 EM 14/10." },
  { chave: "PEDIREITO|LOTE07-08|80", titulo: "PÉ DIREITO · LOTES 07 E 08 · RESTANTE 80% (1.700 CAMISAS)", valor: 33506.05, venc: "2026-12-04", forma: "BOLETO", tarefas: [["2026-10-16", "ENTREGA 1 · 1.200 PEÇAS"], ["2026-10-20", "ENTREGA 2 · 500 PEÇAS"]],
    obs: "STATUS 09/10/2026: ENTRADA 20% R$ 8.823,95 PAGA EM 07/10. ENTREGAS: 1.200 PEÇAS EM 16/10 E 500 PEÇAS EM 20/10." },
];
const brl = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const br = (d) => d.split("-").reverse().join("/");

try {
  const igor = await prisma.usuario.findUnique({ where: { login: "igor" } });
  const conta = await prisma.finConta.findUnique({ where: { codigo: "1111000" } });   // VENDA DE UNIFORMES
  const cli = await prisma.cliente.findFirst({ where: { OR: [{ nomeFantasia: { contains: "DIREITO", mode: "insensitive" } }, { razaoSocial: { contains: "DIREITO", mode: "insensitive" } }] } }).catch(() => null);
  const parceiro = (cli?.nomeFantasia || cli?.razaoSocial || "PÉ DIREITO").toUpperCase();
  const documento = cli?.cnpj ? String(cli.cnpj).replace(/\D/g, "") : null;
  let nC = 0, nT = 0;
  for (const c of CONTAS) {
    const venc = new Date(c.venc + "T00:00:00Z");
    if (!(await prisma.finTitulo.findUnique({ where: { chaveImport: c.chave } }))) {
      // já lançada à mão (mesmo valor e vencimento próximo)? não duplica
      const ja = await prisma.finTitulo.findFirst({ where: { tipo: "RECEBER", status: { not: "CANCELADO" }, valor: c.valor,
        vencimento: { gte: new Date(+venc - 20 * 86400000), lte: new Date(+venc + 20 * 86400000) } } });
      if (!ja) {
        await prisma.finTitulo.create({ data: {
          tipo: "RECEBER", titulo: c.titulo, parceiro, documento, valor: c.valor, vencimento: venc, competencia: c.venc.slice(0, 7),
          previsao: true, status: "ABERTO", rateio: conta ? [{ contaId: conta.id, pct: 100 }] : [], observacao: c.obs, forma: "MANUAL",
          formaPagamento: c.forma, chaveImport: c.chave, criadoPorId: igor?.id || null, criadoPorNome: "SISTEMA · STATUS PÉ DIREITO",
        } });
        nC++;
      }
    }
    if (!igor) continue;
    const lote = c.titulo.replace("PÉ DIREITO · ", "");
    for (const [dia, entrega] of c.tarefas) {
      const prazo = new Date(dia + "T00:00:00Z");
      const titulo = c.forma === "BOLETO"
        ? `PÉ DIREITO · CONFIRMAR ENTREGA E EMITIR BOLETO DE ANTECIPAÇÃO · ${lote} · ${entrega}`
        : `PÉ DIREITO · CONFIRMAR ENTREGA E COBRAR À VISTA · ${lote} · ${entrega}`;
      if (await prisma.tarefa.findFirst({ where: { titulo, prazo } })) continue;
      await prisma.tarefa.create({ data: {
        titulo, setor: "FINANCEIRO", responsavelId: igor.id, responsavelNome: [igor.nome, igor.sobrenome].filter(Boolean).join(" ").toUpperCase(),
        criadoPorId: igor.id, criadoPorNome: "SISTEMA", prazo, tipo: "PADRAO", publica: true,
        descricao: `Entrega de ${br(dia)} (${entrega.toLowerCase()}). Conta: R$ ${brl(c.valor)} · vencimento ${br(c.venc)}. ${c.obs}`,
        subtarefas: c.forma === "BOLETO"
          ? [{ texto: "Confirmar a entrega com o cliente", feita: false }, { texto: "Emitir o boleto e enviar para antecipação", feita: false }, { texto: "Tirar a conta de previsão no contas a receber", feita: false }]
          : [{ texto: "Confirmar a entrega com o cliente", feita: false }, { texto: "Cobrar à vista", feita: false }, { texto: "Tirar a conta de previsão no contas a receber", feita: false }],
      } });
      nT++;
    }
  }
  if (nC || nT) console.log(`Seed Pé Direito: ${nC} conta(s) a receber e ${nT} demanda(s) criadas.`);
} catch (e) {
  console.log("Seed Pé Direito: ignorado (" + (e?.message || e) + ")");
} finally {
  await prisma.$disconnect();
}
