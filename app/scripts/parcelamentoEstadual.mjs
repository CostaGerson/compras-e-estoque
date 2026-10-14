// v202 — Parcelamento estadual de ICMS (SEF/MG) nº 62.084931500-29
//  1) lança as parcelas que faltam (005 a 015) como PREVISÃO, valor médio R$ 2.744,08
//  2) Matriz › Dívidas: uma linha para o parcelamento (sem gerar recorrência). As estimativas de ICMS FICAM:
//     são das guias que ainda virão; o parcelamento é só dos débitos antigos
//  3) Alavancagem › Estadual: o parcelamento entra com o saldo; sai o "PARCELAMENTO ESTADUAL 1" em branco
//  4) cancela as contas de ICMS em aberto vencidas ANTES de 10/10/2026 (a guia de outubro, vencida em 12/10, fica)
// Rodar na VPS:  docker exec ce-app node scripts/parcelamentoEstadual.mjs
// Pode rodar de novo: não duplica nada.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const QUEM = "SISTEMA · PARCELAMENTO ESTADUAL";
const HOJE = "2026-10-14";
const MANTER = "2026-10-10";   // a guia do dia 10 deste mês (caiu no sábado e foi para 12/10) fica: só cancela o que venceu ANTES de 10/10

const P = {
  id: "62084931500-29", numero: "62.084931500-29", nome: "PARCELAMENTO ICMS 62.084931500-29",
  parceiro: "SECRETARIA DA FAZENDA ESTADUAL", conta: "2115110", ie: "0044450590058",
  data: "28/05/2026", ptas: "03.000601518-16 · 03.000603946-20",
  total: 16, primeira: 5, valor: 2744.08, venc1: "2026-10-29",
};

// ---------- datas: o parcelamento vence no PENÚLTIMO dia útil do mês (31/12 não conta) ----------
// conferido com o portal: 29/10/26 · 27/11/26 · 29/12/26 · 28/01/27 · 25/02/27 · 30/03/27 · 29/04/27
const FERIADOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25", "12-31"];
const util = (d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !FERIADOS.includes(d.toISOString().slice(5, 10));
export function penultimoDiaUtil(comp) {
  const [a, m] = comp.split("-").map(Number);
  let d = new Date(Date.UTC(a, m, 0)), achados = 0;
  for (;;) { if (util(d)) { achados++; if (achados === 2) return d; } d = new Date(d.getTime() - 86400000); }
}
const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7); };
const br = (d) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (v) => Math.round(v * 100) / 100;

const restantes = P.total - P.primeira;          // 11
const saldo = r2(restantes * P.valor);            // 30.184,88
const ultimaComp = somaMes(P.venc1.slice(0, 7), restantes - 1);

async function main() {
  const conta = await prisma.finConta.findFirst({ where: { codigo: P.conta } });
  const rateio = conta ? [{ contaId: conta.id, pct: 100 }] : [];

  // ===== 1) parcelas =====
  console.log("\n== PARCELAS ==");
  let criadas = 0;
  for (let i = 0; i < restantes; i++) {
    const k = P.primeira + i;                       // nº da parcela no portal (005…015)
    const comp = somaMes(P.venc1.slice(0, 7), i);
    const venc = penultimoDiaUtil(comp);
    const nn = `PARC. ${String(k).padStart(3, "0")} (${k + 1}/${P.total})`;
    const chave = `PARCEST|${P.id}|${String(k).padStart(3, "0")}`;
    if (!(await prisma.finTitulo.findUnique({ where: { chaveImport: chave } }))) {
      await prisma.finTitulo.create({ data: {
        tipo: "PAGAR", titulo: `${P.nome} · ${nn}`, parceiro: P.parceiro, numeroDoc: nn,
        valor: P.valor, vencimento: venc, competencia: venc.toISOString().slice(0, 7), previsao: true, status: "ABERTO",
        rateio, forma: "MANUAL", formaPagamento: "BOLETO", chaveImport: chave, criadoPorNome: QUEM,
        observacao: `PARCELAMENTO ESTADUAL (ICMS) · Nº ${P.numero} · IE ${P.ie} · DE ${P.data} · PTA ${P.ptas} · `
          + `${P.total} PARCELAS (000 A 015), 5 QUITADAS ATÉ OUT/2026 · VALOR MÉDIO R$ ${brl(P.valor)} · `
          + `PARCELA CORRIGIDA TODO MÊS: ATUALIZE O VALOR PELO DAE DO MÊS.`,
      } });
      criadas++;
    }
    console.log(`${nn} · ${br(venc)} · R$ ${brl(P.valor)}`);
  }
  console.log(`→ ${criadas} conta(s) criada(s) · saldo R$ ${brl(saldo)}`);

  // ===== 2) Matriz =====
  console.log("\n== MATRIZ › DÍVIDAS ==");
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) console.log("Matriz oficial não encontrada — pulei.");
  else {
    const dados = { ...(m.dados || {}) };
    const atuais = Array.isArray(dados.dividas) ? dados.dividas : [];
    const id = `PARCEST:${P.id}`;
    const novo = atuais.some((i) => i.id === id) ? null : {
      id, natureza: P.nome, parceiro: P.parceiro, valor: P.valor, cdb: false, ativo: true, semRecorrencia: true,
      obs: `${restantes}x ~${brl(P.valor)} · ${br(new Date(P.venc1 + "T00:00:00Z")).slice(3)} a ${ultimaComp.slice(5)}/${ultimaComp.slice(0, 4)} · débitos antigos · corrigida todo mês · parcelas lançadas no contas a pagar`,
    };
    if (novo) {
      await prisma.finMatrizVersao.create({ data: { matrizId: m.id, dados: m.dados, usuarioNome: m.atualizadoPor, resumo: "antes de: parcelamento estadual (ICMS)" } });
      dados.dividas = [...atuais, novo];
      await prisma.finMatriz.update({ where: { id: m.id }, data: { dados, atualizadoPor: QUEM } });
      console.log(`+ entrou: ${novo.natureza} (R$ ${brl(novo.valor)}) · estimativas de ICMS mantidas`);
    } else console.log("já estava atualizada.");
  }

  // ===== 3) Alavancagem =====
  console.log("\n== ALAVANCAGEM › ESTADUAL ==");
  const desc = P.nome;
  const velhos = await prisma.finTributo.findMany({ where: { grupo: "ESTADUAL", descricao: { not: desc } } });
  for (const v of velhos) {
    if (Number(v.valor) > 0) { console.log(`! mantido (tem valor, confira): ${v.descricao} · R$ ${brl(v.valor)}`); continue; }
    await prisma.finTributo.delete({ where: { id: v.id } });
    console.log(`− saiu: ${v.descricao} (em branco)`);
  }
  const dataT = {
    grupo: "ESTADUAL", descricao: desc, valor: saldo, exigivel: true, parcelado: true, parcelaMensal: P.valor, parcelas: restantes,
    inicio: new Date(P.venc1 + "T00:00:00Z"), competencia: "2026-10",
    observacao: `Nº ${P.numero} · ${P.total} PARCELAS, 5 QUITADAS · RESTAM ${restantes}X ~${brl(P.valor)} (CORRIGIDA TODO MÊS)`,
  };
  const ja = await prisma.finTributo.findFirst({ where: { descricao: desc } });
  if (ja) await prisma.finTributo.update({ where: { id: ja.id }, data: dataT });
  else await prisma.finTributo.create({ data: dataT });
  console.log(`${ja ? "= atualizado" : "+ entrou"}: ${desc} · saldo R$ ${brl(saldo)}`);

  // ===== 4) contas antigas de ICMS =====
  console.log("\n== CONTAS DE ICMS VENCIDAS (canceladas: entraram no parcelamento) ==");
  const ICMS = /\bICMS\b|\bDAE\b|\bGNRE\b|\bDIFAL\b|\bSEF\b|FAZENDA ESTADUAL|SECRETARIA DE ESTADO DE FAZENDA|ESTADUA/;
  const cands = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", status: "ABERTO", vencimento: { lt: new Date(HOJE + "T00:00:00Z") } },
    orderBy: { vencimento: "asc" },
  });
  const nota = `CANCELADA EM ${br(new Date())}: INCLUÍDA NO PARCELAMENTO ESTADUAL DE ICMS Nº ${P.numero}.`;
  let n = 0, soma = 0;
  const nort = [], mantidas = [];
  for (const t of cands) {
    if (/^PARC(EST|FED)\|/.test(String(t.chaveImport || ""))) continue;
    const txt = `${t.titulo || ""} ${t.parceiro || ""}`.toUpperCase();
    if (!ICMS.test(txt)) continue;
    if (/^NORT\b/.test(String(t.titulo || "").toUpperCase())) { nort.push(t); continue; }
    if (t.vencimento.toISOString().slice(0, 10) >= MANTER) { mantidas.push(t); continue; }
    await prisma.finTitulo.update({ where: { id: t.id }, data: {
      status: "CANCELADO", atualizadoPorNome: QUEM,
      observacao: [t.observacao, nota].filter(Boolean).join(" · ").slice(0, 4000),
    } });
    n++; soma += Number(t.valor);
    console.log(`#${t.id} · ${br(t.vencimento)} · ${t.titulo} · ${t.parceiro || ""} · R$ ${brl(t.valor)}`);
  }
  console.log(`→ ${n} conta(s) cancelada(s) · total R$ ${brl(soma)}`);
  for (const t of mantidas) console.log(`= mantida (guia de out/2026): #${t.id} · ${t.titulo} · R$ ${brl(t.valor)}`);
  if (nort.length) {
    console.log("\nNÃO MEXI (NORT — outra inscrição estadual):");
    for (const t of nort) console.log(`#${t.id} · ${br(t.vencimento)} · ${t.titulo} · R$ ${brl(t.valor)}`);
  }
  console.log("\nPronto.");
}

if (process.argv[1]?.endsWith("parcelamentoEstadual.mjs")) {
  main().catch((e) => { console.log("ERRO:", e?.message || e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
