// v157 — DFC (fluxo de caixa futuro, regime de caixa)
// Caixa atual = saldo dos bancos do último Painel de previsão preenchido (depois: sincronizar com o banco).
// Cada dia: entradas = contas a receber em aberto que vencem no dia; saídas = contas a pagar em aberto que vencem no dia.
// O saldo é projetado a partir de HOJE (o caixa atual é de hoje): um período que começa no futuro já parte com
// o caixa + tudo que entra/sai até lá. Atrasados (vencidos antes de hoje e ainda em aberto) entram em hoje, se marcado.
// Sugestões: com base no saldo projetado, no limite disponível dos bancos (painel) e nas duplicatas a vencer.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const maisDias = (s, n) => iso(new Date(dUTC(s).getTime() + n * 86400000));
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dBR = (s) => s.split("-").reverse().join("/");
const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// último painel com bancos preenchidos
async function caixaAtual() {
  const ps = await prisma.finMesPainel.findMany({ orderBy: { competencia: "desc" }, take: 12, select: { competencia: true, dados: true, updatedAt: true, atualizadoPorNome: true } });
  const p = ps.find((x) => Array.isArray(x.dados?.bancos) && x.dados.bancos.length);
  if (!p) return { saldo: 0, limite: 0, tomado: 0, disponivelLimite: 0, bancos: [], origem: null, antecipacaoDisp: 0 };
  const bancos = p.dados.bancos.map((b) => {
    const saldo = r2(b.saldo), limite = r2(b.limite);
    const tomado = b.tomado == null ? r2(Math.max(0, -saldo)) : r2(b.tomado);
    return { nome: String(b.nome || "").toUpperCase(), saldo, limite, tomado, livre: r2(Math.max(0, limite - tomado)) };
  });
  return {
    saldo: r2(bancos.reduce((s, b) => s + b.saldo, 0)), limite: r2(bancos.reduce((s, b) => s + b.limite, 0)),
    tomado: r2(bancos.reduce((s, b) => s + b.tomado, 0)), disponivelLimite: r2(bancos.reduce((s, b) => s + b.livre, 0)),
    bancos, origem: { competencia: p.competencia, em: p.updatedAt, por: p.atualizadoPorNome }, antecipacaoDisp: r2(p.dados.antecipacaoDisp || 0),
  };
}

const saidaT = (t) => ({ id: t.id, tipo: t.tipo, titulo: t.titulo, parceiro: t.parceiro, valor: r2(t.valor), vencimento: iso(t.vencimento), previsao: t.previsao, cobranca: t.cobranca, numeroDoc: t.numeroDoc });

export async function dfc({ dIni, dFim, atrasadosPagar = true, atrasadosReceber = false }) {
  const hoje = hojeSP();
  const ini = dIni || hoje, fim = dFim && dFim >= ini ? dFim : ini;
  const base = ini < hoje ? ini : hoje;   // a projeção corre a partir de hoje (ou do início, se for passado)
  const caixa = await caixaAtual();
  const tits = await prisma.finTitulo.findMany({
    where: { status: "ABERTO", vencimento: { lte: dUTC(fim) } },
    select: { id: true, tipo: true, titulo: true, parceiro: true, valor: true, vencimento: true, previsao: true, cobranca: true, numeroDoc: true },
    orderBy: { vencimento: "asc" },
  });
  // por dia
  const dias = new Map();
  const dia = (k) => { if (!dias.has(k)) dias.set(k, { data: k, entradas: 0, saidas: 0, receber: [], pagar: [] }); return dias.get(k); };
  const atrasados = { pagar: 0, receber: 0, qtdPagar: 0, qtdReceber: 0 };
  for (const t of tits) {
    let k = iso(t.vencimento);
    if (k < hoje) {   // vencido e em aberto
      if (t.tipo === "PAGAR") { atrasados.pagar = r2(atrasados.pagar + Number(t.valor)); atrasados.qtdPagar++; if (!atrasadosPagar) continue; }
      else { atrasados.receber = r2(atrasados.receber + Number(t.valor)); atrasados.qtdReceber++; if (!atrasadosReceber) continue; }
      k = hoje;
    }
    if (k < base) continue;
    const d = dia(k);
    if (t.tipo === "RECEBER") { d.entradas = r2(d.entradas + Number(t.valor)); d.receber.push({ ...saidaT(t), atrasado: iso(t.vencimento) < hoje }); }
    else { d.saidas = r2(d.saidas + Number(t.valor)); d.pagar.push({ ...saidaT(t), atrasado: iso(t.vencimento) < hoje }); }
  }
  // corre os dias de base até fim
  let saldo = caixa.saldo, saldoInicial = null;
  const linhas = [];
  for (let k = base; k <= fim; k = maisDias(k, 1)) {
    if (k === ini) saldoInicial = saldo;
    const d = dias.get(k) || { data: k, entradas: 0, saidas: 0, receber: [], pagar: [] };
    saldo = r2(saldo + d.entradas - d.saidas);
    if (k >= ini) linhas.push({ ...d, resultado: r2(d.entradas - d.saidas), saldo, fimDeSemana: [0, 6].includes(dUTC(k).getUTCDay()) });
  }
  if (saldoInicial == null) saldoInicial = caixa.saldo;
  const entradas = r2(linhas.reduce((s, l) => s + l.entradas, 0)), saidas = r2(linhas.reduce((s, l) => s + l.saidas, 0));
  const menor = linhas.reduce((m, l) => (!m || l.saldo < m.saldo ? l : m), null);
  const primeiroNegativo = linhas.find((l) => l.saldo < 0) || null;
  const resumo = {
    ini, fim, hoje, saldoInicial: r2(saldoInicial), entradas, saidas, resultado: r2(entradas - saidas), saldoFinal: r2(saldo),
    menorSaldo: menor ? { data: menor.data, valor: menor.saldo } : null, primeiroNegativo: primeiroNegativo ? { data: primeiroNegativo.data, valor: primeiroNegativo.saldo } : null,
    diasNegativos: linhas.filter((l) => l.saldo < 0).length, atrasados,
  };
  resumo.sugestoes = await sugerir(resumo, caixa, linhas);
  return { resumo, caixa, dias: linhas };
}

// ---------------- sugestões de operação ----------------
async function sugerir(r, caixa, linhas) {
  const s = [];
  const falta = r.menorSaldo && r.menorSaldo.valor < 0 ? r2(-r.menorSaldo.valor) : 0;
  if (!caixa.origem) s.push({ nivel: "AVISO", titulo: "Caixa atual não informado", texto: "Preencha os bancos (saldo, limite e limite tomado) no Painel de previsão da análise mensal — o DFC parte desse caixa." });
  if (falta > 0) {
    const d1 = r.primeiroNegativo.data;
    s.push({ nivel: "ALERTA", titulo: `Caixa fica negativo em ${dBR(d1)}`, texto: `O menor saldo do período é ${brl(r.menorSaldo.valor)} em ${dBR(r.menorSaldo.data)} — faltam ${brl(falta)} para não ficar no vermelho.` });
    // duplicatas que dá para antecipar: a receber em aberto, a vencer depois do dia negativo, ainda não descontadas
    const dup = await prisma.finTitulo.findMany({
      where: { tipo: "RECEBER", status: "ABERTO", vencimento: { gt: dUTC(d1) }, NOT: { cobranca: "DESCONTADO" } },
      select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, cobranca: true }, orderBy: { valor: "desc" }, take: 200,
    });
    const registradas = dup.filter((t) => t.cobranca === "REGISTRADO");
    const totDup = r2(dup.reduce((a, t) => a + Number(t.valor), 0)), totReg = r2(registradas.reduce((a, t) => a + Number(t.valor), 0));
    const limiteAntec = caixa.antecipacaoDisp || 0;
    let restante = falta;
    if (totDup > 0) {
      const podeAntecipar = limiteAntec ? Math.min(limiteAntec, totDup) : totDup;
      const usar = r2(Math.min(restante * 1.03, podeAntecipar));   // ~3% de folga para juros/IOF/TAC
      s.push({
        nivel: "OPERACAO", titulo: "Antecipar duplicatas",
        texto: `Há ${brl(totDup)} a receber depois de ${dBR(d1)} (${dup.length} título(s); ${brl(totReg)} já registrados no banco)${limiteAntec ? ` e limite de antecipação de ${brl(limiteAntec)} informado no painel` : ""}. Antecipar cerca de ${brl(usar)} antes de ${dBR(d1)} cobre o furo (considere ~3% de custo de juros, IOF e TAC).`,
        valor: usar, titulos: dup.slice(0, 8).map((t) => ({ titulo: t.titulo, parceiro: t.parceiro, valor: r2(t.valor), vencimento: iso(t.vencimento) })),
      });
      restante = r2(Math.max(0, restante - podeAntecipar));
    }
    if (caixa.disponivelLimite > 0) {
      const usar = r2(Math.min(falta, caixa.disponivelLimite));
      const dias = linhas.filter((l) => l.saldo < 0).length;
      s.push({
        nivel: "OPERACAO", titulo: "Usar limite / cheque especial",
        texto: `Os bancos têm ${brl(caixa.disponivelLimite)} de limite livre (${caixa.bancos.filter((b) => b.livre > 0).map((b) => `${b.nome} ${brl(b.livre)}`).join(", ")}). Cobre ${brl(usar)} do furo por ${dias} dia(s) — é o dinheiro mais caro: use só como ponte curta${totDup ? ", de preferência depois de antecipar" : ""}.`,
        valor: usar,
      });
      restante = r2(Math.max(0, restante - caixa.disponivelLimite));
    }
    // pagamentos grandes nos dias críticos: renegociar / reprogramar
    const criticos = linhas.filter((l) => l.saldo < 0).flatMap((l) => l.pagar).sort((a, b) => b.valor - a.valor).slice(0, 5);
    if (criticos.length) s.push({
      nivel: "OPERACAO", titulo: "Reprogramar pagamentos dos dias críticos",
      texto: `Maiores pagamentos nos dias negativos: ${criticos.map((t) => `${t.titulo} (${t.parceiro}) ${brl(t.valor)} em ${dBR(t.vencimento)}`).join("; ")}. Negociar nova data e usar o campo Reprogramado.`,
    });
    if (restante > 0) s.push({ nivel: "ALERTA", titulo: "Furo sem cobertura", texto: `Mesmo antecipando o possível e usando o limite livre, faltam ${brl(restante)}. Avaliar capital de giro, aporte ou cortar/adiar saídas.` });
  } else if (caixa.origem) {
    s.push({ nivel: "OK", titulo: "Caixa positivo no período", texto: `O menor saldo é ${brl(r.menorSaldo?.valor || r.saldoInicial)}${r.menorSaldo ? ` em ${dBR(r.menorSaldo.data)}` : ""}. Não há necessidade de antecipar ou usar limite.` });
    if (caixa.tomado > 0) s.push({ nivel: "OPERACAO", titulo: "Cobrir o limite já tomado", texto: `Há ${brl(caixa.tomado)} de limite/cheque especial em uso. Com o caixa positivo, cobrir esse saldo primeiro reduz juros.` });
    const sobra = r.menorSaldo ? r.menorSaldo.valor : 0;
    if (sobra > 50000) s.push({ nivel: "OPERACAO", titulo: "Sobra de caixa", texto: `O caixa nunca fica abaixo de ${brl(sobra)} no período — avaliar amortizar a dívida mais cara ou aplicar a sobra com liquidez diária.` });
  }
  if (r.atrasados.qtdPagar && !linhas.length) { /* nada */ }
  if (r.atrasados.pagar > 0) s.push({ nivel: "AVISO", titulo: "Contas a pagar atrasadas", texto: `${r.atrasados.qtdPagar} conta(s) a pagar vencida(s) em aberto somam ${brl(r.atrasados.pagar)} — confira se já foram pagas (baixa por comprovante) ou entram no caixa de hoje.` });
  if (r.atrasados.receber > 0) s.push({ nivel: "AVISO", titulo: "Contas a receber atrasadas", texto: `${r.atrasados.qtdReceber} conta(s) a receber vencida(s) somam ${brl(r.atrasados.receber)} — cobrar; não contam como entrada certa (marque a opção para incluí-las).` });
  return s;
}
