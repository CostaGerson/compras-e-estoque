// Ações em lote nas contas a pagar/receber: baixar e excluir várias de uma vez.
import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/finTitulos";
import { ehCascaSemana, INICIO_SEMANAS } from "@/lib/finSemana";

// Excluir uma conta:
//  - de recorrência → CANCELADA (o mês não é recriado);
//  - conta da semana a partir da implantação → CANCELADA (senão a sexta seria recriada);
//  - o resto sai de vez (anexos e itens da semana vão junto).
export async function excluirTitulo(t, quem) {
  const vencISO = new Date(t.vencimento).toISOString().slice(0, 10);
  if (t.recorrenciaId || (ehCascaSemana(t) && vencISO >= INICIO_SEMANAS)) {
    await prisma.finTitulo.update({ where: { id: t.id }, data: { status: "CANCELADO", atualizadoPorNome: quem || null } });
    return "CANCELADO";
  }
  await prisma.finTitulo.delete({ where: { id: t.id } });
  return "EXCLUIDO";
}

// acao: "baixar" (cada conta pelo próprio valor, na data informada) | "excluir"
// Só mexe em contas ABERTAS; as outras são puladas e contadas.
export async function acaoEmLote({ acao, ids, dataPagamento, quem }) {
  const lista = [...new Set((ids || []).map(Number).filter((x) => x > 0))];
  if (!lista.length) return { error: "Selecione ao menos uma conta." };
  if (!["baixar", "excluir"].includes(acao)) return { error: "Ação inválida." };
  if (acao === "baixar" && !/^\d{4}-\d{2}-\d{2}$/.test(String(dataPagamento || ""))) return { error: "Informe a data do pagamento." };
  const ts = await prisma.finTitulo.findMany({ where: { id: { in: lista } } });
  const abertos = ts.filter((t) => t.status === "ABERTO");
  const r = { ok: true, acao, total: lista.length, feitos: 0, cancelados: 0, excluidos: 0, pulados: lista.length - abertos.length, semValor: 0 };
  for (const t of abertos) {
    if (acao === "baixar") {
      if (!(Number(t.valor) > 0)) { r.semValor++; r.pulados++; continue; }   // casca da semana zerada não se baixa
      await prisma.finTitulo.update({
        where: { id: t.id },
        data: { status: "PAGO", dataPagamento: dataUTC(dataPagamento), valorPago: t.valor, previsao: false, valorConfirmado: true, atualizadoPorNome: quem || null },
      });
      r.feitos++;
    } else {
      const x = await excluirTitulo(t, quem);
      if (x === "CANCELADO") r.cancelados++; else r.excluidos++;
      r.feitos++;
    }
  }
  return r;
}
