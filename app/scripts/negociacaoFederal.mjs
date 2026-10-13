// v198 — Negociação dos passivos tributários federais (out/2026)
//  1) lança as parcelas de cada parcelamento/transação até a última, como PREVISÃO, com o DARF/DAS de outubro anexado
//  2) Matriz › Dívidas: uma linha por dívida (sem gerar recorrência) e sai a estimativa "TRIBUTÁRIO"
//  3) cancela as contas da Receita Federal vencidas antes de 13/10/2026 (menos FGTS e NORT), que entraram na negociação
// Rodar na VPS:  docker exec ce-app node scripts/negociacaoFederal.mjs
// Pode rodar de novo: não duplica nada.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "negociacao-federal");
const QUEM = "SISTEMA · NEGOCIAÇÃO FEDERAL";
const CORTE = "2026-10-13";   // vencidas antes disso entram na negociação

// ---------- datas ----------
const FERIADOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
const util = (d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !FERIADOS.includes(d.toISOString().slice(5, 10));
function ultimoDiaUtil(comp) {
  const [a, m] = comp.split("-").map(Number);
  let d = new Date(Date.UTC(a, m, 0));
  while (!util(d)) d = new Date(d.getTime() - 86400000);
  return d;
}
const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7); };
const br = (d) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mesAno = (c) => { const [a, m] = c.split("-"); return `${m}/${a}`; };

// ---------- as dívidas ----------
// fases: [[nº de parcelas, valor]]; venc1: vencimento da 1ª (as outras no último dia útil do mês)
const DIVIDAS = [
  { id: "0132127533", nome: "PARCELAMENTO RFB 0132127533", numero: "0211.00012.0132127533.26-73", parceiro: "RECEITA FEDERAL", conta: "2115110",
    consolidado: 83621.21, fases: [[60, 1393.68]], venc1: "2026-10-09", selic: true,
    arquivo: "DARF RFB 0132127533 OUT-26.pdf", doc1: "07.03.26279.8165165-1" },
  { id: "0076410593", nome: "PARCELAMENTO RFB 0076410593", numero: "0211.00012.0076410593.26-73", parceiro: "RECEITA FEDERAL", conta: "2115110",
    consolidado: 161941.64, fases: [[60, 2891.81]], venc1: "2026-10-30", selic: true,
    arquivo: "DARF RFB 0076410593 OUT-26.pdf", doc1: "07.03.26279.7806055-9" },
  { id: "17503166", nome: "TRANSAÇÃO PGFN 17503166 (SIMPLES NACIONAL)", numero: "17503166", parceiro: "PGFN", conta: "2115110",
    consolidado: 448558.39, fases: [[12, 2499.60], [133, 3147.09]], venc1: "2026-10-30",
    arquivo: "DAS PGFN 17503166 OUT-26.pdf", doc1: "07.17.26279.8223602-1" },
  { id: "17503168", nome: "TRANSAÇÃO PGFN 17503168 (PIS/COFINS)", numero: "17503168", parceiro: "PGFN", conta: "2115110",
    consolidado: 54046.11, fases: [[12, 301.17], [133, 379.18]], venc1: "2026-10-30",
    arquivo: "DARF PGFN 17503168 OUT-26.pdf", doc1: "07.17.26279.8223731-1" },
  { id: "17503167", nome: "TRANSAÇÃO PGFN 17503167 (PREVIDENCIÁRIO)", numero: "17503167", parceiro: "PGFN", conta: "2115120",
    consolidado: 19006.31, fases: [[12, 105.91], [48, 369.48]], venc1: "2026-10-30",
    arquivo: "DARF PGFN 17503167 OUT-26.pdf", doc1: "07.17.26279.8223619-6" },
];
const AVULSA = { chave: "PARCFED|EXIGIBILIDADE-SUSPENSA", titulo: "RFB · EXIGIBILIDADE SUSPENSA", parceiro: "RECEITA FEDERAL", conta: "2115110",
  valor: 1500.94, venc: "2026-10-20", obs: "NEGOCIAÇÃO FEDERAL OUT/2026 · DÉBITO COM EXIGIBILIDADE SUSPENSA · PAGAMENTO ÚNICO." };

const faseTxt = (d) => d.fases.map(([n, v]) => `${n}x ${brl(v)}`).join(" + ");

try {
  const contas = await prisma.finConta.findMany({ where: { codigo: { in: ["2115110", "2115120"] } } });
  const contaId = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
  const rateio = (cod) => (contaId[cod] ? [{ contaId: contaId[cod], pct: 100 }] : []);

  // ===== 1) parcelas =====
  let criadas = 0, anexos = 0;
  console.log("\n== PARCELAS ==");
  for (const d of DIVIDAS) {
    const total = d.fases.reduce((s, [n]) => s + n, 0);
    let k = 0, ultima = null;
    for (const [n, valor] of d.fases) {
      for (let i = 0; i < n; i++) {
        k++;
        const comp = somaMes(d.venc1.slice(0, 7), k - 1);
        const venc = k === 1 ? new Date(d.venc1 + "T00:00:00Z") : ultimoDiaUtil(comp);
        const chave = `PARCFED|${d.id}|${String(k).padStart(3, "0")}`;
        const nn = `${String(k).padStart(total > 99 ? 3 : 2, "0")}/${total}`;
        ultima = venc;
        let t = await prisma.finTitulo.findUnique({ where: { chaveImport: chave } });
        if (!t) {
          t = await prisma.finTitulo.create({ data: {
            tipo: "PAGAR", titulo: `${d.nome} · ${nn}`, parceiro: d.parceiro, numeroDoc: k === 1 ? d.doc1 : nn,
            valor, vencimento: venc, competencia: venc.toISOString().slice(0, 7), previsao: true, status: "ABERTO",
            rateio: rateio(d.conta), forma: "MANUAL", formaPagamento: "BOLETO", chaveImport: chave, criadoPorNome: QUEM,
            observacao: `NEGOCIAÇÃO FEDERAL OUT/2026 · Nº ${d.numero} · CONSOLIDADO R$ ${brl(d.consolidado)} · ${faseTxt(d)}`
              + (d.selic ? " · PARCELA CORRIGIDA PELA SELIC: ATUALIZE O VALOR PELO DARF DO MÊS." : "")
              + (k === 1 ? ` · DOC. ${d.doc1}` : ""),
          } });
          criadas++;
        }
        if (k === 1) {
          const buf = readFileSync(path.join(DIR, d.arquivo));
          const hash = createHash("sha256").update(buf).digest("hex");
          if (!(await prisma.finTituloAnexo.findFirst({ where: { tituloId: t.id, hash } }))) {
            await prisma.finTituloAnexo.create({ data: { tituloId: t.id, nome: d.arquivo, mime: "application/pdf", tamanho: buf.length, conteudo: buf.toString("base64"), hash, criadoPorNome: QUEM } });
            anexos++;
          }
        }
      }
    }
    console.log(`${d.nome}: ${total} parcelas (${faseTxt(d)}) · ${br(new Date(d.venc1 + "T00:00:00Z"))} a ${br(ultima)}`);
  }
  if (!(await prisma.finTitulo.findUnique({ where: { chaveImport: AVULSA.chave } }))) {
    await prisma.finTitulo.create({ data: {
      tipo: "PAGAR", titulo: AVULSA.titulo, parceiro: AVULSA.parceiro, valor: AVULSA.valor, vencimento: new Date(AVULSA.venc + "T00:00:00Z"),
      competencia: AVULSA.venc.slice(0, 7), previsao: true, status: "ABERTO", rateio: rateio(AVULSA.conta), forma: "MANUAL", formaPagamento: "BOLETO",
      chaveImport: AVULSA.chave, criadoPorNome: QUEM, observacao: AVULSA.obs,
    } });
    criadas++;
  }
  console.log(`${AVULSA.titulo}: R$ ${brl(AVULSA.valor)} em ${br(new Date(AVULSA.venc + "T00:00:00Z"))}`);
  console.log(`→ ${criadas} conta(s) criada(s), ${anexos} guia(s) anexada(s).`);

  // ===== 2) Matriz =====
  console.log("\n== MATRIZ › DÍVIDAS ==");
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) console.log("Matriz oficial não encontrada — pulei.");
  else {
    const dados = { ...(m.dados || {}) };
    const atuais = Array.isArray(dados.dividas) ? dados.dividas : [];
    const ESTIMADA = /TRIBUT|RECEITA FEDERAL|PGFN|PARCELAMENTO (RFB|SIMPLES|INSS|FEDERAL)/i;
    const sai = atuais.filter((i) => !String(i.id).startsWith("PARCFED:") && ESTIMADA.test(String(i.natureza || "")));
    const ja = new Set(atuais.map((i) => i.id));
    const novos = DIVIDAS.filter((d) => !ja.has(`PARCFED:${d.id}`)).map((d) => {
      const [n1, v1] = d.fases[0], seg = d.fases[1];
      const fim = somaMes(d.venc1.slice(0, 7), d.fases.reduce((s, [n]) => s + n, 0) - 1);
      return {
        id: `PARCFED:${d.id}`, natureza: d.nome, parceiro: d.parceiro, valor: v1, cdb: false, ativo: true, semRecorrencia: true,
        obs: `${faseTxt(d)} · ${mesAno(d.venc1.slice(0, 7))} a ${mesAno(fim)}`
          + (seg ? ` · a partir de ${mesAno(somaMes(d.venc1.slice(0, 7), n1))} passa a ${brl(seg[1])}` : "")
          + (d.selic ? " · corrigida pela Selic" : "") + " · parcelas lançadas no contas a pagar",
      };
    });
    if (sai.length || novos.length) {
      await prisma.finMatrizVersao.create({ data: { matrizId: m.id, dados: m.dados, usuarioNome: m.atualizadoPor, resumo: "antes de: negociação federal out/2026" } });
      dados.dividas = [...atuais.filter((i) => !sai.includes(i)), ...novos];
      await prisma.finMatriz.update({ where: { id: m.id }, data: { dados, atualizadoPor: QUEM } });
    }
    for (const i of sai) console.log(`− saiu: ${i.natureza} (R$ ${brl(i.valor)})`);
    for (const i of novos) console.log(`+ entrou: ${i.natureza} (R$ ${brl(i.valor)})`);
    if (!sai.length && !novos.length) console.log("já estava atualizada.");
  }

  // ===== 3) contas antigas da Receita =====
  console.log("\n== CONTAS DA RECEITA VENCIDAS (canceladas: entraram na negociação) ==");
  const FED_PARC = /RECEITA FEDERAL|\bRFB\b|PGFN|FAZENDA NACIONAL|SIMPLES NACIONAL|SECRETARIA DA RECEITA/;
  const FED_TIT = /(^DAS\b|\bDARF\b|\bINSS\b|\bGPS\b|\bIRRF\b|\bIRPJ\b|\bCSLL\b|\bPIS\b|\bCOFINS\b|SIMPLES NACIONAL|PARCELAMENTO|TRIBUT|PGFN|RECEITA FEDERAL)/;
  const ESTADUAL = /\b(ICMS|DAE|GNRE|ISS|ISSQN|IPTU|IPVA|TFLF|TFLS|SINDICAL)\b/;
  const FGTS = /FGTS|\bGFD\b|CAIXA ECON/;
  const cands = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", status: "ABERTO", vencimento: { lt: new Date(CORTE + "T00:00:00Z") } },
    orderBy: { vencimento: "asc" },
  });
  const nota = `CANCELADA EM ${br(new Date())}: INCLUÍDA NA NEGOCIAÇÃO FEDERAL DE OUT/2026 (PARCELAMENTOS RFB 0132127533 E 0076410593 · TRANSAÇÕES PGFN 17503166, 17503167 E 17503168).`;
  let nCanc = 0, soma = 0;
  const nort = [];
  for (const t of cands) {
    if (String(t.chaveImport || "").startsWith("PARCFED|")) continue;
    const tit = String(t.titulo || "").toUpperCase(), par = String(t.parceiro || "").toUpperCase();
    if (FGTS.test(tit) || FGTS.test(par)) continue;
    const fedParc = FED_PARC.test(par);
    if (!fedParc && !(FED_TIT.test(tit) && !ESTADUAL.test(tit))) continue;
    if (/^NORT\b/.test(tit)) { nort.push(t); continue; }   // outra empresa: não mexe
    await prisma.finTitulo.update({ where: { id: t.id }, data: {
      status: "CANCELADO", atualizadoPorNome: QUEM,
      observacao: [t.observacao, nota].filter(Boolean).join(" · ").slice(0, 4000),
    } });
    nCanc++; soma += Number(t.valor);
    console.log(`#${t.id} · ${br(t.vencimento)} · ${t.titulo} · ${t.parceiro} · R$ ${brl(t.valor)}`);
  }
  console.log(`→ ${nCanc} conta(s) cancelada(s) · total R$ ${brl(soma)}`);
  if (nort.length) {
    console.log("\nNÃO MEXI (NORT — confira se também entra):");
    for (const t of nort) console.log(`#${t.id} · ${br(t.vencimento)} · ${t.titulo} · R$ ${brl(t.valor)}`);
  }
  console.log("\nPronto. Abra o contas a pagar para a Matriz encerrar a recorrência estimada antiga.");
} catch (e) {
  console.log("ERRO:", e?.message || e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
