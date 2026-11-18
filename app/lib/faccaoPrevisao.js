// PREVISÃO das contas de facção, vinda do Cronograma PCP (/api/ext/faccao/previsao).
// Regras do Gerson (18/11/2026):
//  - uma conta "PREVISÃO" por semana nos TERCEIRIZADOS DA SEMANA: o que tem previsão de entrega na semana
//    (segunda a domingo) é pago na sexta dessa mesma semana; previsão que já passou cai na semana atual;
//  - o valor é o total previsto para fechar naquela semana (OS na rua + programação de costura);
//  - atualiza todo dia (aqui: de hora em hora, das 6h às 22h), porque as datas da programação mudam;
//  - nunca duplica: a previsão de cada semana é UM item (prestador PREVISÃO). A cada leitura a semana é
//    regravada; item a mais é apagado; semana que ficou sem previsão perde o item. Item pago nunca é mexido.
import { prisma } from "@/lib/prisma";
import { getPcp } from "@/lib/cronograma";
import { tituloDaData, recalcular } from "@/lib/finSemana";
import { contaDoSetor, garantirContasPrestadores } from "@/lib/prestadores";
import { tipoDePeca } from "@/lib/faccaoPcp";

const NOME = "PREVISÃO";
const MARCA = "PREVISAO PCP";   // descricao do item: é por ela (e pelo prestador PREVISÃO) que a previsão é achada
const LOCK = 937112;           // trava do Postgres: duas leituras ao mesmo tempo não lançam em dobro
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (v) => r2(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
// sexta da semana de segunda a domingo (domingo é da semana que começou na segunda anterior)
const sextaDaSemanaSD = (s) => { const d = dUTC(s); const w = (d.getUTCDay() + 6) % 7; return iso(d.getTime() + (4 - w) * 86400e3); };

async function prestadorPrevisao() {
  const ts = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" } });
  const p = ts.find((x) => sa(x.nome) === "PREVISAO");
  if (p) return p;
  return prisma.prestador.create({ data: { tipo: "TERCEIRIZADO", nome: NOME, chavePix: "-", servicos: ["FACCAO:CAMISETA"], endereco: "-",
    observacao: "Cadastro automático: previsão das facções vinda do PCP. Não usar em pagamento real.", ativo: false, criadoPorNome: "PCP (automático)" } });
}

// itens do PCP → semanas { sexta: { linhas, sem preço, resumo por facção } }
export function montarSemanas(itens, hoje = hojeSP()) {
  const sem = {};
  for (const x of itens || []) {
    const data = String(x.previsao || "").slice(0, 10) >= hoje ? String(x.previsao).slice(0, 10) : hoje;
    const sexta = sextaDaSemanaSD(data);
    const s = (sem[sexta] ||= { sexta, linhas: [], semPreco: [], fac: {}, ultima: data });
    if (data > s.ultima) s.ultima = data;
    const fac = String(x.faccao || "").trim().toUpperCase() || "FACÇÃO A DEFINIR";
    const qtd = Number(x.quantidade) || 0, unit = r2(x.valorUnitario);
    const ref = `${x.itemCode || x.pedido || "S/ Nº"} ${String(x.produto || "").toUpperCase()}`.trim();
    if (!(qtd > 0 && unit > 0)) { s.semPreco.push(`${fac}: ${ref} (${qtd} PÇ)`); continue; }
    const total = r2(qtd * unit);
    s.linhas.push({ pedido: String(x.pedido || "PREVISAO").trim().toUpperCase() || "PREVISAO",
      item: `${fac} · ${ref}${x.os ? ` · OS ${x.os}` : " · PROGRAMAÇÃO"}`.slice(0, 200),
      ...(x.itemCode ? { itemCode: String(x.itemCode) } : {}), tipo: tipoDePeca(x.produto) || "CAMISETA", qtd, unitario: unit, total });
    const f = (s.fac[fac] ||= { total: 0, refs: [] });
    f.total = r2(f.total + total); f.refs.push(`${ref} R$ ${brl(total)}`);
  }
  for (const s of Object.values(sem)) {
    s.valor = r2(s.linhas.reduce((a, l) => a + l.total, 0));
    const t = {}; for (const l of s.linhas) t[l.tipo] = (t[l.tipo] || 0) + l.total;
    s.setor = Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || "CAMISETA";
  }
  return sem;
}

let rodando = false;
export async function sincronizarPrevisao({ quem = "PCP (automático)" } = {}) {
  if (rodando) return { ok: false, erro: "Já está atualizando." };
  rodando = true;
  try {
    let j;
    try { j = await getPcp("/api/ext/faccao/previsao"); }
    catch (e) { return { ok: false, erro: /HTTP 404/.test(e.message) ? "O Cronograma ainda não publicou a previsão (/api/ext/faccao/previsao)." : e.message }; }
    if (!j || !Array.isArray(j.itens)) return { ok: false, erro: "Resposta do PCP sem itens: não mexi na previsão." };
    const hoje = hojeSP(), sextaAtual = sextaDaSemanaSD(hoje);
    const sem = montarSemanas(j.itens, hoje);
    await garantirContasPrestadores();
    const prest = await prestadorPrevisao();
    // cascas (títulos) das semanas com previsão — idempotente (chaveImport única)
    const titulos = {};
    for (const s of Object.keys(sem)) if (sem[s].valor > 0) titulos[s] = await tituloDaData("TERCEIRIZADO", s, false);
    const cods = [...new Set(Object.values(sem).flatMap((s) => s.linhas.map((l) => contaDoSetor("FACCAO", l.tipo))).filter(Boolean))];
    const contas = Object.fromEntries((await prisma.finConta.findMany({ where: { codigo: { in: cods } }, select: { id: true, codigo: true } })).map((c) => [c.codigo, c.id]));
    const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const mexidos = new Set(), res = { criadas: 0, atualizadas: 0, apagadas: 0, semanas: [] };

    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK})::text AS ok`);
      const existentes = await tx.finSemanaItem.findMany({ where: { OR: [{ prestadorId: prest.id }, { descricao: MARCA }] }, orderBy: { id: "asc" } });
      const porTitulo = {};
      for (const it of existentes) (porTitulo[it.tituloId] ||= []).push(it);
      const usados = new Set();
      for (const s of Object.values(sem)) {
        if (!(s.valor > 0)) continue;
        const t = titulos[s.sexta];
        const doTitulo = porTitulo[t.id] || [];
        if (doTitulo.some((x) => x.pago || x.lancamentoId)) { res.semanas.push({ sexta: s.sexta, valor: s.valor, aviso: "previsão já paga nesta semana: não mexi" }); doTitulo.forEach((x) => usados.add(x.id)); continue; }
        const linhas = s.linhas.map((l) => ({ ...l, contaId: contas[contaDoSetor("FACCAO", l.tipo)] || null }));
        const resumo = Object.entries(s.fac).sort((a, b) => b[1].total - a[1].total).map(([f, v]) => `${f} — R$ ${brl(v.total)} ${v.refs.join(" · ")}`).join(" · ");
        const observacao = [`PREVISÃO AUTOMÁTICA DO PCP · ATUALIZADA EM ${quando}`, resumo,
          s.semPreco.length ? `SEM PREÇO NO PCP (FORA DA SOMA): ${s.semPreco.join(" · ")}` : null].filter(Boolean).join(" · ").toUpperCase().slice(0, 1000);
        const data = {
          grupo: "FACCAO", prestadorId: prest.id, nome: NOME, chavePix: prest.chavePix || "-", setor: s.setor,
          contaId: contas[contaDoSetor("FACCAO", s.setor)] || linhas.find((l) => l.contaId)?.contaId,
          linhas, valor: s.valor, dataRecebimento: dUTC(s.sexta), prazoDias: 0, vencimentoNegociado: dUTC(s.sexta),
          descricao: MARCA, observacao, excepcional: false,
        };
        if (!data.contaId) { res.semanas.push({ sexta: s.sexta, valor: s.valor, aviso: "conta-caixa de facção não encontrada" }); continue; }
        const [fica, ...sobra] = doTitulo;
        if (fica) { await tx.finSemanaItem.update({ where: { id: fica.id }, data }); usados.add(fica.id); res.atualizadas++; }
        else { await tx.finSemanaItem.create({ data: { ...data, tituloId: t.id, criadoPorNome: quem } }); res.criadas++; }
        for (const x of sobra) { await tx.finSemanaItem.delete({ where: { id: x.id } }); usados.add(x.id); res.apagadas++; }   // duplicada: sai
        mexidos.add(t.id);
        res.semanas.push({ sexta: s.sexta, valor: s.valor, linhas: linhas.length, semPreco: s.semPreco.length });
      }
      // semana que não tem mais previsão (ou que já passou): a previsão não paga sai
      for (const it of existentes) {
        if (usados.has(it.id) || it.pago || it.lancamentoId) continue;
        await tx.finSemanaItem.delete({ where: { id: it.id } }); mexidos.add(it.tituloId); res.apagadas++;
      }
    }, { timeout: 60000 });
    for (const t of mexidos) await recalcular(t).catch(() => null);
    globalThis.__prevFaccao = { em: new Date().toISOString(), dia: hoje, ...res };
    return { ok: true, sextaAtual, ...res };
  } finally { rodando = false; }
}

// de hora em hora, das 6h às 22h (horário de Brasília), e 2 min depois de subir
export function agendarPrevisaoFaccao() {
  if (globalThis.__agPrevFaccao) return; globalThis.__agPrevFaccao = true;
  const tick = async () => {
    const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
    if (h < 6 || h > 22) return;
    const r = await sincronizarPrevisao().catch((e) => ({ ok: false, erro: e.message }));
    console.log(`[previsão facção] ${r.ok ? `${r.criadas} criada(s) · ${r.atualizadas} atualizada(s) · ${r.apagadas} apagada(s) · ${r.semanas.map((s) => `${s.sexta} R$ ${brl(s.valor)}`).join(" | ")}` : r.erro}`);
  };
  setInterval(() => tick().catch(() => null), 60 * 60 * 1000);
  setTimeout(() => tick().catch(() => null), 2 * 60 * 1000);
}
