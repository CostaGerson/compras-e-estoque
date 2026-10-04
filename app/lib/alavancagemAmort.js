// Quanto de cada parcela é juros e quanto é amortização de capital.
// Serve para dois fins: mostrar na tela de alavancagem e abater da dívida só o que de fato
// amortizou — e a partir da BAIXA da conta a pagar, não da data do calendário.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => Number(v || 0);

// Chave que liga contrato → recorrência da Matriz → títulos do contas a pagar.
export const chaveRecorrencia = (contratoId) => `MATRIZ|dividas|CONTRATO:${contratoId}`;
export const contratoDaChave = (chave) => {
  const m = /^MATRIZ\|dividas\|CONTRATO:(\d+)$/.exec(String(chave || ""));
  return m ? Number(m[1]) : null;
};

// Tabela Price: a parcela é fixa, o que muda é a divisão entre juros e amortização.
// O principal é deduzido da própria parcela e do prazo (e não do capital informado), para
// a tabela fechar em zero exatamente na última parcela.
export function cronograma(c) {
  const taxa = num(c.taxaMensal) / 100;

  if (c.tipo === "MUTUO") {
    const capital = r2(c.capital);
    const jurosMes = r2(capital * taxa);
    return {
      tipo: "MUTUO", principal: capital, parcela: jurosMes, prazo: null, taxaMensal: num(c.taxaMensal),
      // no mútuo as "parcelas" são só juros; o capital volta inteiro no vencimento
      linhas: [], jurosTotais: null, bullet: true,
    };
  }

  const parcela = r2(c.parcela);
  const prazo = Number(c.prazoMeses) || 0;
  if (!parcela || !prazo) return { tipo: c.tipo, principal: r2(c.capital), parcela, prazo, linhas: [], jurosTotais: 0 };

  const principal = taxa ? r2((parcela * (1 - Math.pow(1 + taxa, -prazo))) / taxa) : r2(parcela * prazo);
  const linhas = [];
  let saldo = principal;
  for (let n = 1; n <= prazo; n++) {
    const juros = r2(saldo * taxa);
    let amortizacao = r2(parcela - juros);
    if (n === prazo) amortizacao = r2(saldo);            // a última fecha o saldo
    saldo = r2(saldo - amortizacao);
    linhas.push({ n, parcela, juros, amortizacao, saldo: Math.max(0, saldo) });
  }
  return {
    tipo: c.tipo, principal, parcela, prazo, taxaMensal: num(c.taxaMensal), linhas,
    jurosTotais: r2(parcela * prazo - principal),
    capitalInformado: r2(c.capital),
    // o capital que o Igor digitou pode não bater com o que a parcela e o prazo implicam
    diferencaCapital: r2(principal - num(c.capital)),
  };
}

// Posição do contrato depois de N parcelas pagas.
export function posicaoApos(cron, pagas) {
  const n = Math.max(0, Math.min(cron.linhas.length, Number(pagas) || 0));
  if (cron.bullet) {
    return { parcelasPagas: n, jurosPagos: r2(cron.parcela * n), amortizado: 0,
             saldoDevedor: cron.principal, jurosAVencer: null, aVencer: cron.principal };
  }
  const feitas = cron.linhas.slice(0, n);
  const restam = cron.linhas.slice(n);
  return {
    parcelasPagas: n,
    jurosPagos: r2(feitas.reduce((s, l) => s + l.juros, 0)),
    amortizado: r2(feitas.reduce((s, l) => s + l.amortizacao, 0)),
    saldoDevedor: r2(restam.reduce((s, l) => s + l.amortizacao, 0)),   // só principal
    jurosAVencer: r2(restam.reduce((s, l) => s + l.juros, 0)),
    aVencer: r2(cron.parcela * restam.length),                          // principal + juros
    proxima: restam[0] || null,
  };
}

// ---- baixas de verdade: títulos pagos de cada contrato ----
// Devolve { [contratoId]: { pagas: [datas ISO], primeiroVencimento: ISO|null } }
export async function baixasPorContrato() {
  const recs = await prisma.finRecorrencia.findMany({
    where: { chaveOrigem: { startsWith: "MATRIZ|dividas|CONTRATO:" } },
    select: { id: true, chaveOrigem: true },
  });
  if (!recs.length) return {};
  const porRec = Object.fromEntries(recs.map((r) => [r.id, contratoDaChave(r.chaveOrigem)]).filter(([, c]) => c));
  const titulos = await prisma.finTitulo.findMany({
    where: { recorrenciaId: { in: recs.map((r) => r.id) } },
    select: { recorrenciaId: true, status: true, dataPagamento: true, vencimento: true, valorPago: true },
  });
  const out = {};
  for (const t of titulos) {
    const id = porRec[t.recorrenciaId];
    if (!id) continue;
    const o = (out[id] = out[id] || { pagas: [], primeiroVencimento: null, totalPago: 0 });
    const venc = new Date(t.vencimento).toISOString().slice(0, 10);
    if (!o.primeiroVencimento || venc < o.primeiroVencimento) o.primeiroVencimento = venc;
    if (t.status === "PAGO") {
      o.pagas.push(new Date(t.dataPagamento || t.vencimento).toISOString().slice(0, 10));
      o.totalPago = r2(o.totalPago + num(t.valorPago));
    }
  }
  for (const o of Object.values(out)) o.pagas.sort();
  return out;
}

// Quantas parcelas estavam pagas numa data.
// Antes de o contrato entrar no contas a pagar vale o calendário; dali em diante valem as baixas,
// que é o que o Igor pediu: a dívida só cai quando a conta é efetivamente baixada.
// `porData(d)` devolve a contagem pelo calendário numa data qualquer.
export function pagasEm(ref, baixa, porData) {
  const calendario = porData(ref);
  if (!baixa || !baixa.primeiroVencimento) return calendario;
  const inicio = new Date(baixa.primeiroVencimento + "T12:00:00");
  if (ref < inicio) return calendario;
  const jaPagasAntes = porData(new Date(inicio.getTime() - 86400000));   // o que já estava pago quando a ponte nasceu
  const iso = ref.toISOString().slice(0, 10);
  return jaPagasAntes + baixa.pagas.filter((d) => d <= iso).length;
}
