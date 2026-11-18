// PREVISÃO das contas de facção, vinda do Cronograma PCP. Regras do Gerson (18/11/2026, v939):
//  - várias contas "PREVISÃO", uma por item de OS (ex.: 820 CACILDA · 26080046-9 CYMI - JAQUETA… · OS 8 × R$ 15 = R$ 12.300),
//    nos TERCEIRIZADOS DA SEMANA, como se fossem contas reais:
//      · item na facção (/api/ext/faccao/previsao): entrega = término previsto da costura no PCP; paga na sexta da
//        semana (segunda a domingo) da entrega; previsão que já passou cai na semana atual;
//      · item da programação (ainda sem OS): uma conta por item também, com o preço combinado / FPP / tabela;
//      · OS acertada no PCP (/api/ext/faccao/apagar) e ainda não lançada aqui: a previsão passa a ter o valor e a
//        sexta reais (a data marcada no acerto); quando a conta real é lançada na conferência, a previsão sai.
//  - v940 — prazo do cadastro da facção (Terceirizados): "paga 1× por mês no dia X" → o que tem entrega até o dia X
//    cai no dia X do mês (depois do dia X → dia X do mês seguinte), como pagamento fora da sexta; "prazo de pagamento"
//    em dias → entrega + prazo, paga na primeira sexta a partir daí; sem nada → sexta da semana da entrega.
//  - a mesma conta é regravada a cada hora (6h–22h): o prazo mudou → a conta muda de sexta, não nasce outra;
//  - nunca duplica: a chave é a descricao ("PREVISÃO PCP · OS 8 · 26080046-9"); conta a mais com a mesma chave é
//    apagada; previsão que deixou de existir é apagada; conta paga nunca é mexida.
import { prisma } from "@/lib/prisma";
import { getPcp } from "@/lib/cronograma";
import { tituloDaData, recalcular } from "@/lib/finSemana";
import { contaDoSetor, garantirContasPrestadores } from "@/lib/prestadores";
import { tipoDePeca, conferirFaccoes } from "@/lib/faccaoPcp";

const NOME = "PREVISÃO";
const MARCA = "PREVISÃO PCP";
const LOCK = 937112;           // trava do Postgres: duas leituras ao mesmo tempo não lançam em dobro
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (v) => r2(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const dBR = (s) => String(s).slice(0, 10).split("-").reverse().join("/");
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
// sexta da semana de segunda a domingo (domingo é da semana que começou na segunda anterior)
const sextaDaSemanaSD = (s) => { const d = dUTC(s); const w = (d.getUTCDay() + 6) % 7; return iso(d.getTime() + (4 - w) * 86400e3); };
const facNome = (f) => String(f || "").trim().replace(/\s+/g, " ").toUpperCase() || "FACÇÃO A DEFINIR";

async function prestadorPrevisao() {
  const ts = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" } });
  const p = ts.find((x) => sa(x.nome) === "PREVISAO");
  if (p) return p;
  return prisma.prestador.create({ data: { tipo: "TERCEIRIZADO", nome: NOME, chavePix: "-", servicos: ["FACCAO:CAMISETA"], endereco: "-",
    observacao: "Cadastro automático: previsão das facções vinda do PCP. Não usar em pagamento real.", ativo: false, criadoPorNome: "PCP (automático)" } });
}

const totalDe = (linhas) => r2(linhas.reduce((a, l) => a + l.total, 0));
const setorDe = (linhas) => { const t = {}; for (const l of linhas) if (!l.desconto) t[l.tipo] = (t[l.tipo] || 0) + l.total; return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || "CAMISETA"; };

// v940 — data de pagamento pela regra do cadastro da facção
const ultimoDia = (a, m) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
export function pagamentoDe(entrega, p) {
  const dia = Number(p?.pagamentoDiaMes) || 0;
  if (dia >= 1) {
    const d = dUTC(entrega); let a = d.getUTCFullYear(), m = d.getUTCMonth();
    if (d.getUTCDate() > Math.min(dia, ultimoDia(a, m))) { m++; if (m > 11) { m = 0; a++; } }
    return { data: iso(Date.UTC(a, m, Math.min(dia, ultimoDia(a, m)))), mensal: dia };
  }
  const prazo = Number(p?.prazoDias) || 0;
  if (prazo > 0) { const v = dUTC(entrega); v.setUTCDate(v.getUTCDate() + prazo); while (v.getUTCDay() !== 5) v.setUTCDate(v.getUTCDate() + 1); return { data: iso(v), prazo }; }
  return { data: sextaDaSemanaSD(entrega) };
}
const achaPrest = (lista, nome) => { const n = sa(nome); return n ? lista.find((p) => sa(p.nome) === n || sa(p.nomeKm) === n)
  || lista.find((p) => sa(p.nome).startsWith(n + " ") || n.startsWith(sa(p.nome) + " ")) || null : null; };

// 1) itens do PCP (na facção + programação) → uma conta prevista por item { chave, faccao, entrega, sexta, linhas, texto }
export function montarPrevistas(itens, hoje = hojeSP(), prests = []) {
  const out = {};
  for (const x of itens || []) {
    const fac = facNome(x.faccao);
    const entrega = String(x.previsao || "").slice(0, 10) >= hoje ? String(x.previsao).slice(0, 10) : hoje;
    const os = Number(x.os) || 0;
    const cod = String(x.itemCode || x.pedido || "S/ Nº");
    const chave = os ? `${MARCA} · OS ${os} · ${cod}` : `${MARCA} · PROGRAMAÇÃO · ${cod}`;
    const qtd = Number(x.quantidade) || 0, unit = r2(x.valorUnitario);
    const ref = `${qtd} ${fac} · ${cod} ${String(x.produto || "").toUpperCase()}${os ? ` · OS ${os}` : " · PROGRAMAÇÃO"}`;
    const c = (out[chave] ||= { chave, faccao: fac, os, entrega, linhas: [], semPreco: [], refs: [] });
    if (entrega > c.entrega) c.entrega = entrega;
    if (!(qtd > 0 && unit > 0)) { c.semPreco.push(ref); continue; }
    c.linhas.push({ pedido: String(x.pedido || "PREVISAO").trim().toUpperCase() || "PREVISAO", item: ref.slice(0, 200),
      ...(x.itemCode ? { itemCode: String(x.itemCode) } : {}), tipo: tipoDePeca(x.produto) || "CAMISETA", qtd, unitario: unit, total: r2(qtd * unit) });
    c.refs.push(`${ref} × R$ ${brl(unit)}${x.origem === "OS_RETORNADA" ? " (VOLTOU, FALTA ACERTAR NO PCP)" : ""}`);
  }
  for (const c of Object.values(out)) {
    const pg = pagamentoDe(c.entrega, achaPrest(prests, c.faccao));
    c.sexta = pg.data; c.mensal = pg.mensal || 0; c.pix = achaPrest(prests, c.faccao)?.chavePix || "";
    c.texto = `${c.os ? "NA FACÇÃO" : "AINDA SEM OS"} · ENTREGA PREVISTA ${dBR(c.entrega)}${pg.mensal ? ` · PAGA 1× POR MÊS, DIA ${pg.mensal}` : pg.prazo ? ` · PRAZO ${pg.prazo} DIAS` : ""}`;
  }
  return out;
}

// 2) OS acertada no PCP e ainda não lançada aqui: a previsão fica com o valor e a sexta reais do acerto
function previstasDoAcerto(contas, hoje = hojeSP()) {
  const out = {};
  for (const c of contas || []) {
    if (c.lancada || c.descartada || c.pagaNaPrevisao || c.previsaoDesconsiderada || !(Number(c.valorLiquido) > 0)) continue;   // paga adiantada / desconsiderada no PCP: não volta   // paga adiantada pela previsão: não volta
    const linhas = (c.linhas || []).map((l) => ({ ...l, tipo: l.tipo || tipoDePeca(l.item) || "CAMISETA", total: r2(l.total) }));
    if (!linhas.length) continue;
    const fac = facNome(c.prestador?.nome || c.faccao);
    const chave = `${MARCA} · ACERTO ${c.lancamento}`;
    // facção paga 1× por mês: vale a data marcada no PCP (como a conta real vai cair), não a sexta
    const mensal = Number(c.prestador?.pagamentoDiaMes) || 0;
    const alvo = mensal && c.vencimento ? String(c.vencimento).slice(0, 10) : c.sexta;
    const sexta = alvo && alvo >= hoje ? alvo : sextaDaSemanaSD(hoje);
    out[chave] = { chave, faccao: fac, prestadorId: c.prestador?.id || null, os: Number(c.os) || 0, entrega: c.recebimento || hoje, sexta, mensal: mensal && alvo >= hoje ? mensal : 0, semPreco: [],
      linhas: linhas.map((l) => ({ ...l, item: l.desconto ? l.item : `${l.qtd} ${fac} · ${l.itemCode || l.pedido} ${l.item || ""} · OS ${c.os}`.slice(0, 200) })),
      refs: [], texto: `OS ${c.os} ACERTADA NO PCP (ACERTO ${c.lancamento}) · FALTA LANÇAR NA CONFERÊNCIA DE FACÇÕES · VENC. ${c.vencimento ? dBR(c.vencimento) : "-"}` };
  }
  return out;
}

// "Desconsiderar previsão": adiantou para a facção por uma conta manual e a OS segue aberta no PCP.
// A previsão sai e não volta: OS → todas as previsões daquela OS (itens e acerto); programação → aquele item.
const chaveIgnorar = (descricao) => { const n = (String(descricao || "").match(/· (?:OS|ACERTO) (\d+)/) || [])[1]; return n ? `PREV-OS-${n}` : String(descricao || "").slice(0, 190); };
export async function ignorarPrevisao(itemId, quem, motivo) {
  if (String(motivo || "").trim().length < 3) return { error: "Escreva o motivo (ex.: adiantei R$ 2.000 pela conta manual)." };
  const it = await prisma.finSemanaItem.findUnique({ where: { id: Number(itemId) } });
  if (!it || !/^PREVIS[AÃ]O PCP/.test(String(it.descricao || ""))) return { error: "Essa conta não é uma previsão do PCP." };
  if (it.pago || it.lancamentoId) return { error: "Essa previsão já tem baixa: desfaça a baixa antes." };
  const k = chaveIgnorar(it.descricao);
  const os = Number((k.match(/^PREV-OS-(\d+)$/) || [])[1]) || 0;
  const ja = await prisma.faccaoOsPcp.findFirst({ where: { lancamento: k, status: "PREVISAO_IGNORADA" } });
  if (!ja) await prisma.faccaoOsPcp.create({ data: { os, lancamento: k, parcela: null, status: "PREVISAO_IGNORADA", dados: { descricao: it.descricao, nome: it.nome, valor: Number(it.valor) },
    valor: it.valor, motivo: String(motivo).trim().slice(0, 500), descartadoPorNome: quem || null, descartadoEm: new Date() } });
  const r = await sincronizarPrevisao({ quem });
  if (!r.ok) { await prisma.finSemanaItem.deleteMany({ where: { descricao: it.descricao, pago: false, lancamentoId: null } }); await recalcular(it.tituloId).catch(() => null); }
  return { ok: true, chave: k, os };
}
// volta a considerar (desfaz o "desconsiderar")
export async function reconsiderarPrevisao(chave, quem) {
  const r = await prisma.faccaoOsPcp.updateMany({ where: { lancamento: String(chave), status: "PREVISAO_IGNORADA" }, data: { status: "PREVISAO_REATIVADA", estornadoPorNome: quem || null, estornadoEm: new Date() } });
  if (r.count) await sincronizarPrevisao({ quem }).catch(() => null);
  return { ok: true, total: r.count };
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
    const conf = await conferirFaccoes();
    if (conf.erro) return { ok: false, erro: `Contas a pagar de facção do PCP: ${conf.erro}. Não mexi na previsão.` };
    const hoje = hojeSP();
    await garantirContasPrestadores();
    const prests = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" } });
    const prev0 = { ...montarPrevistas(j.itens, hoje, prests), ...previstasDoAcerto(conf.contas, hoje) };
    const ign = new Set((await prisma.faccaoOsPcp.findMany({ where: { status: "PREVISAO_IGNORADA" }, select: { lancamento: true } })).map((x) => x.lancamento));
    const prev = Object.fromEntries(Object.entries(prev0).filter(([k]) => !ign.has(chaveIgnorar(k))));   // desconsideradas não voltam
    const prest = await prestadorPrevisao();
    const titulos = {};
    for (const c of Object.values(prev)) { const k = `${c.sexta}|${c.mensal ? 1 : 0}`; if (totalDe(c.linhas) > 0 && !titulos[k]) titulos[k] = await tituloDaData("TERCEIRIZADO", c.sexta, !!c.mensal); }   // mensal: pagamento fora da sexta
    const cods = [...new Set(Object.values(prev).flatMap((c) => c.linhas.map((l) => contaDoSetor("FACCAO", l.tipo))).filter(Boolean))];
    const contas = Object.fromEntries((await prisma.finConta.findMany({ where: { codigo: { in: cods } }, select: { id: true, codigo: true } })).map((c) => [c.codigo, c.id]));
    const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const mexidos = new Set(), res = { criadas: 0, atualizadas: 0, apagadas: 0, contas: [] };

    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK})::text AS ok`);
      const existentes = await tx.finSemanaItem.findMany({ where: { OR: [{ prestadorId: prest.id }, { descricao: { startsWith: MARCA } }, { descricao: { startsWith: "PREVISAO PCP" } }] }, orderBy: { id: "asc" } });
      const porChave = {};
      for (const it of existentes) (porChave[it.descricao || ""] ||= []).push(it);
      const usados = new Set();
      for (const c of Object.values(prev)) {
        const valor = totalDe(c.linhas);
        if (!(valor > 0)) continue;
        const t = titulos[`${c.sexta}|${c.mensal ? 1 : 0}`];
        const mesmas = porChave[c.chave] || [];
        if (mesmas.some((x) => x.pago || x.lancamentoId)) { mesmas.forEach((x) => usados.add(x.id)); res.contas.push({ chave: c.chave, aviso: "previsão já paga: não mexi" }); continue; }
        const linhas = c.linhas.map((l) => ({ ...l, contaId: contas[contaDoSetor("FACCAO", l.tipo)] || null }));
        const setor = setorDe(linhas);
        const contaId = contas[contaDoSetor("FACCAO", setor)] || linhas.find((l) => l.contaId)?.contaId;
        if (!contaId) { res.contas.push({ chave: c.chave, aviso: "conta-caixa de facção não encontrada" }); continue; }
        const observacao = [`PREVISÃO AUTOMÁTICA DO PCP · ATUALIZADA EM ${quando}`, c.texto, ...c.refs,
          c.semPreco.length ? `SEM PREÇO NO PCP (FORA DA SOMA): ${c.semPreco.join(" · ")}` : null].filter(Boolean).join(" · ").toUpperCase().slice(0, 1000);
        const receb = c.entrega <= c.sexta ? c.entrega : c.sexta;
        const data = {
          tituloId: t.id, grupo: "FACCAO", prestadorId: prest.id, nome: `${NOME} · ${c.faccao}`.slice(0, 190), chavePix: c.pix || prests.find((x) => x.id === c.prestadorId)?.chavePix || prest.chavePix || "-",   // PIX da facção: dá para pagar adiantado pela própria previsão
          setor, contaId, linhas, valor, dataRecebimento: dUTC(receb), prazoDias: Math.max(0, Math.round((dUTC(c.sexta) - dUTC(receb)) / 86400e3)),
          vencimentoNegociado: dUTC(c.sexta), descricao: c.chave, observacao, excepcional: !!c.mensal,
          justificativa: c.mensal ? `PAGAMENTO MENSAL NO DIA ${c.mensal} (CADASTRO DA FACÇÃO)` : null,
        };
        const [fica, ...sobra] = mesmas;
        if (fica) { await tx.finSemanaItem.update({ where: { id: fica.id }, data }); usados.add(fica.id); mexidos.add(fica.tituloId); res.atualizadas++; }
        else { await tx.finSemanaItem.create({ data: { ...data, criadoPorNome: quem } }); res.criadas++; }
        for (const x of sobra) { await tx.finSemanaItem.delete({ where: { id: x.id } }); usados.add(x.id); mexidos.add(x.tituloId); res.apagadas++; }   // duplicada: sai
        mexidos.add(t.id);
        res.contas.push({ chave: c.chave, faccao: c.faccao, sexta: c.sexta, valor });
      }
      // previsão que não existe mais (conta real lançada, item saiu da programação, formato antigo): sai, se não estiver paga
      for (const it of existentes) {
        if (usados.has(it.id) || it.pago || it.lancamentoId) continue;
        await tx.finSemanaItem.delete({ where: { id: it.id } }); mexidos.add(it.tituloId); res.apagadas++;
      }
    }, { timeout: 120000 });
    for (const t of mexidos) await recalcular(t).catch(() => null);
    globalThis.__prevFaccao = { em: new Date().toISOString(), dia: hoje, ...res };
    return { ok: true, ...res };
  } finally { rodando = false; }
}

// de hora em hora, das 6h às 22h (horário de Brasília), e 2 min depois de subir
export function agendarPrevisaoFaccao() {
  if (globalThis.__agPrevFaccao) return; globalThis.__agPrevFaccao = true;
  const tick = async () => {
    const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
    if (h < 6 || h > 22) return;
    const r = await sincronizarPrevisao().catch((e) => ({ ok: false, erro: e.message }));
    console.log(`[previsão facção] ${r.ok ? `${r.criadas} criada(s) · ${r.atualizadas} atualizada(s) · ${r.apagadas} apagada(s) · ${r.contas.length} conta(s)` : r.erro}`);
  };
  setInterval(() => tick().catch(() => null), 60 * 60 * 1000);
  setTimeout(() => tick().catch(() => null), 2 * 60 * 1000);
}
