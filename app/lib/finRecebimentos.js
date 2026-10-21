// Planilha de recebimentos do mês: créditos de terceiros do extrato + boletos recebidos,
// cruzados com as notas de saída (XMLs enviados na Contabilidade) e com o cadastro de clientes.
// Colunas do modelo: DATA · TÍTULO · VALOR (R$) · NF · NOME PAGADOR · CNPJ · OBS
import { prisma } from "@/lib/prisma";
import { formatarCnpj } from "@/lib/finNfSaida";

// Crédito da própria Meridian (conciliação entre contas): NÃO é recebimento — fica fora da planilha.
// v361 — Nort Sports também sai da planilha (transferência entre as empresas)
export const ORIGENS_IGNORAR = [["MERIDIAN"], ["NORT", "SPORTS"], ["NORTSPORTS"]];

// Origens que não são recebimento de cliente, mas o Igor confere (vão para o bloco "A confirmar").
export const ORIGENS_PROPRIAS = [
  ["PEDRO", "TAVARES"],
  ["IGOR", "SANTOS", "COSTA"],
];
// Antecipação / factoring: entra no bloco "A confirmar" (o recebimento do cliente é outro).
export const ORIGENS_ANTECIPACAO = [["FIDC"], ["CREDX"], ["AZUL", "CAPITAL"], ["ANTECIPA"]];

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const casa = (txt, listas) => { const t = semAcento(txt); return listas.some((ts) => ts.every((x) => t.includes(x))); };
const cent = (v) => Math.round(Number(v) * 100);
// v361 — CNPJ escrito no histórico/identificação do extrato
const cnpjDoHistorico = (h) => { const m = String(h || "").match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/); return m && m[1].replace(/\D/g, "").length === 14 ? formatarCnpj(m[1]) : null; };

// PIX | TRANSFERÊNCIA ELETRÔNICA | DEPÓSITO
export function tituloDoHistorico(h) {
  const t = semAcento(h);
  if (t.includes("PIX")) return "PIX";
  if (t.includes("TED") || t.includes("TRANSFER") || t.includes("DOC")) return "TRANSFERÊNCIA ELETRÔNICA";
  if (t.includes("DEPOSITO")) return "DEPÓSITO";
  if (t.includes("COBRANCA") || t.includes("BOLETO")) return "LIQ COBRANÇA";
  return (h || "").toUpperCase().slice(0, 40) || "CRÉDITO";
}

// Tira do histórico as palavras de sistema e devolve o provável nome do pagador.
const RUIDO = /\b(PIX|QRS|QR|CODE|DINAMICO|ESTATICO|RECEBIDO|RECEBIDA|TRANSF|TRANSFERENCIA|ELETRONICA|ELETRON|TED|DOC|CP|CREDITO|EM|CONTA|DEPOSITO|REMETENTE|REM|DES)\b/g;
export function pagadorDoHistorico(h, identificacao) {
  const bruto = [h, identificacao].filter(Boolean).join(" ");
  let t = semAcento(bruto).replace(/[^A-Z0-9 .&\/-]/g, " ").replace(RUIDO, " ").replace(/\b\d{2,}\b/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < 3) t = semAcento(bruto).replace(/\s+/g, " ").trim();
  return t.slice(0, 60) || null;
}

// semelhança por palavras (para achar o cliente/nota pelo nome truncado do extrato)
const palavras = (s) => semAcento(s).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 3);
function parecido(a, b) {
  const pa = palavras(a), pb = palavras(b);
  if (!pa.length || !pb.length) return 0;
  const achou = pa.filter((p) => pb.some((q) => q.startsWith(p) || p.startsWith(q))).length;
  return achou / pa.length;
}

// ---------------- v361 — base inteira de NFs de saída (XMLs da contabilidade + movimento fiscal) ----------------
const soDig = (s) => String(s || "").replace(/\D/g, "");
export async function baseNfs() {
  const { motivoSemConta } = await import("@/lib/fiscal");
  const [xs, fs] = await Promise.all([
    prisma.finNfSaida.findMany({ select: { chave: true, numero: true, valor: true, destNome: true, destCnpj: true, emissao: true, natureza: true } }),
    prisma.fiscalNota.findMany({ where: { tipo: "SAIDA" }, select: { chave: true, chaveRegistro: true, numero: true, valor: true, parceiro: true, documento: true, emissao: true, natureza: true, acao: true, motivo: true, parcelas: true } }),
  ]);
  const m = new Map();
  for (const f of fs) {
    const k = f.chave || f.chaveRegistro;
    const parc = (Array.isArray(f.parcelas) ? f.parcelas : []).map((x) => Number(x.valor)).filter((v) => v > 0);
    m.set(k, { chave: k, numero: String(f.numero), valor: Number(f.valor), destNome: f.parceiro, destCnpj: f.documento ? formatarCnpj(f.documento) : null,
      cnpjDig: soDig(f.documento), emissao: f.emissao, parcelas: parc,
      semConta: f.acao === "REGISTRADA" || /CANCELAD/i.test(f.motivo || "") });
  }
  for (const x of xs) {
    const k = x.chave;
    if (m.has(k)) { const a = m.get(k); if (!a.cnpjDig && x.destCnpj) { a.cnpjDig = soDig(x.destCnpj); a.destCnpj = x.destCnpj; } continue; }
    m.set(k, { chave: k, numero: String(x.numero), valor: Number(x.valor), destNome: x.destNome, destCnpj: x.destCnpj, cnpjDig: soDig(x.destCnpj),
      emissao: x.emissao, parcelas: [], semConta: !!motivoSemConta(x.natureza, []) });
  }
  return [...m.values()].filter((n) => !n.semConta && n.valor > 0).sort((a, b) => new Date(a.emissao) - new Date(b.emissao));
}

// v362 — quanto de cada NF já foi recebido (todas as competências). TOTAL fecha a NF; ENTRADA/RESTANTE/parcelas abatem até o valor dela.
export const chaveNf = (nf) => String(nf || "").trim().split(/[-\/ ]/)[0].replace(/^0+(?=\d)/, "");
function novoUso() {
  const m = new Map();
  return {
    m,
    add(nf, valor, tipo) { const k = chaveNf(nf); if (!k) return; const u = m.get(k) || { soma: 0, fechada: false }; u.soma += Number(valor) || 0; if (tipo === "TOTAL") u.fechada = true; m.set(k, u); },
    get(nf) { return m.get(chaveNf(nf)) || { soma: 0, fechada: false }; },
  };
}

// v361/v362 — casa um crédito com NFs: valor (total, parcela ou saldo que falta) × CNPJ/nome × data (NF até 1 ano antes / 5 dias depois)
function candidatos(notas, { valor, data, cnpjDig, nome }, uso) {
  const v = cent(valor), dt = new Date(data).getTime();
  const out = [];
  for (const n of notas) {
    const em = n.emissao ? new Date(n.emissao).getTime() : null;
    if (em != null && (em > dt + 5 * 864e5 || em < dt - 366 * 864e5)) continue;
    const u = uso.get(n.numero);
    const resta = cent(n.valor) - cent(u.soma);
    if (u.fechada || resta <= 0 || v > resta + 1) continue;   // NF já recebida (TOTAL) ou sem saldo para este valor
    const doCliente = (cnpjDig && n.cnpjDig && (n.cnpjDig === cnpjDig || (cnpjDig.length === 14 && n.cnpjDig.slice(0, 8) === cnpjDig.slice(0, 8)))) || (nome && parecido(nome, n.destNome) >= 0.6);
    const total = u.soma === 0 && cent(n.valor) === v;
    const rest = u.soma > 0 && Math.abs(resta - v) <= 1;
    const parc = n.parcelas.some((p) => cent(p) === v);
    if (!total && !rest && !parc && !doCliente) continue;
    const tipo = total ? "TOTAL" : rest ? "RESTANTE" : "ENTRADA";
    const score = (total || rest || parc ? 2 : 0) + (doCliente ? 2 : 0) + (total || rest ? 0.5 : 0) + (em != null ? Math.max(0, 1 - (dt - em) / (120 * 864e5)) * 0.5 : 0);
    out.push({ n, total, parc: parc || rest, doCliente, score, tipo, valorBate: total || rest || parc });
  }
  return out.sort((a, b) => b.score - a.score);
}
const descr = (c) => `NF ${c.n.numero} (${[c.total ? "valor" : c.parc ? "parcela" : null, c.doCliente ? "cliente" : null].filter(Boolean).join(" + ")})`;

// ---------------- montagem ----------------
export async function montar(competencia) {
  const [lanc, notas, clientes] = await Promise.all([
    prisma.finLancamento.findMany({
      where: { competencia, desmembrado: false, substituido: false, valor: { gt: 0 } },
      orderBy: [{ data: "asc" }, { ordem: "asc" }],
      select: { id: true, data: true, historico: true, identificacao: true, valor: true, banco: true, grupo: true, origem: true },
    }),
    baseNfs(),
    prisma.cliente.findMany({ where: { cnpj: { not: null } }, select: { razaoSocial: true, nomeFantasia: true, cnpj: true } }),
  ]);

  // v362 — o que já foi recebido de cada NF (outros meses + linhas deste mês que ficam: editadas e manuais)
  const uso = novoUso();
  const hist = await prisma.finRecebimento.findMany({
    where: { nf: { not: null }, OR: [{ competencia: { not: competencia } }, { editado: true }, { origem: "MANUAL" }] },
    select: { nf: true, valor: true, tipoReceb: true, bloco: true },
  });
  const valorNf = new Map(notas.map((n) => [chaveNf(n.numero), n.valor]));
  for (const r of hist) {
    if (r.bloco === "CONFIRMAR") continue;
    // linha antiga sem tipo: valor cheio da NF conta como TOTAL
    const t = r.tipoReceb || (valorNf.has(chaveNf(r.nf)) && Math.abs(cent(valorNf.get(chaveNf(r.nf))) - cent(r.valor)) <= 1 ? "TOTAL" : null);
    uso.add(r.nf, r.valor, t);
  }

  const buscarCnpj = (nome) => {
    if (!nome) return null;
    let melhor = null, score = 0;
    for (const n of notas) { const s = parecido(nome, n.destNome); if (s > score) { score = s; melhor = n.destCnpj; } }
    for (const c of clientes) {
      const s = Math.max(parecido(nome, c.razaoSocial), parecido(nome, c.nomeFantasia || ""));
      if (s > score) { score = s; melhor = formatarCnpj(c.cnpj); }
    }
    return score >= 0.6 ? melhor : null;
  };

  const linhas = [];
  const ignoradas = [];
  const pendentes = [];
  let ordem = 0;

  for (const l of lanc) {
    const h = `${l.historico || ""} ${l.identificacao || ""}`;

    // crédito da própria Meridian (conciliação entre contas): não entra na planilha
    if (casa(h, ORIGENS_IGNORAR)) { ignoradas.push({ data: l.data, historico: l.historico, valor: Number(l.valor) }); continue; }

    // boleto detalhado pela conciliação (substitui a LIQUIDACAO DE COBRANCA do extrato)
    const ehBoleto = String(l.grupo || "").startsWith("COB|") || /^BOLETO RECEBIDO/i.test(l.historico || "");
    if (ehBoleto) {
      const nome = String(l.historico || "").replace(/^BOLETO RECEBIDO\s*/i, "").trim().toUpperCase();
      const seuNumero = (String(l.identificacao || "").match(/T[ÍI]TULO\s+([^\s·]+)/i) || [])[1] || null;
      const numeroNf = seuNumero ? String(Number(seuNumero.split(/[-\/]/)[0]) || seuNumero.split(/[-\/]/)[0]) : null;
      const nota = numeroNf ? notas.find((n) => n.numero === numeroNf) : null;
      const pm = String(seuNumero || "").match(/(\d+)\s*\/\s*(\d+)\s*$/);
      const tipoReceb = pm ? (Number(pm[2]) <= 1 ? "TOTAL" : `${Number(pm[1])}/${Number(pm[2])}`) : null;   // v362
      if (numeroNf) uso.add(numeroNf, l.valor, tipoReceb === "TOTAL" ? "TOTAL" : "PARCELA");
      linhas.push({
        bloco: "BOLETO", ordem: ordem++, data: l.data, titulo: "LIQ COBRANÇA", valor: l.valor, tipoReceb,
        nf: seuNumero, nomePagador: nota ? nota.destNome : nome || null,
        cnpj: nota ? nota.destCnpj : buscarCnpj(nome), obs: null,
        origem: "AUTO", lancamentoId: l.id,
      });
      continue;
    }

    // consolidado de cobrança que ainda não foi detalhado: avisa em vez de sumir
    if (casa(h, [["LIQUIDACAO", "COBRANCA"]])) {
      linhas.push({
        bloco: "CONFIRMAR", ordem: ordem++, data: l.data, titulo: "LIQ COBRANÇA", valor: l.valor,
        nf: null, nomePagador: null, cnpj: null,
        obs: "COBRANÇA SEM DETALHAMENTO — ENVIE O PDF DE TÍTULOS PAGOS NA IMPORTAÇÃO",
        origem: "AUTO", lancamentoId: l.id,
      });
      continue;
    }

    const proprio = casa(h, ORIGENS_PROPRIAS);
    const antecip = casa(h, ORIGENS_ANTECIPACAO);
    const pagador = pagadorDoHistorico(l.historico, l.identificacao);
    pendentes.push({ i: linhas.length, l, pagador, proprio, antecip });
    linhas.push({
      bloco: proprio || antecip ? "CONFIRMAR" : "CREDITO",
      ordem: ordem++,
      data: l.data,
      titulo: tituloDoHistorico(l.historico),
      valor: l.valor,
      nf: null,
      nomePagador: pagador,
      cnpj: cnpjDoHistorico(h) || buscarCnpj(pagador),
      obs: proprio ? "ORIGEM PRÓPRIA — CONFERIR" : antecip ? "ANTECIPAÇÃO / FACTORING — CONFERIR" : null,
      origem: "AUTO",
      lancamentoId: l.id,
    });
  }

  // v362 — sugestão de NF (amarela, sem OBS): melhores casamentos primeiro, respeitando o saldo de cada NF
  const ops = pendentes.filter((x) => !x.proprio && !x.antecip).map((x) => {
    const lin = linhas[x.i];
    return { x, lin, c: candidatos(notas, { valor: lin.valor, data: lin.data, cnpjDig: soDig(lin.cnpj), nome: x.pagador }, uso) };
  });
  ops.sort((a, b) => (b.c[0]?.score || 0) - (a.c[0]?.score || 0));
  for (const { x, lin } of ops) {
    const c = candidatos(notas, { valor: lin.valor, data: lin.data, cnpjDig: soDig(lin.cnpj), nome: x.pagador }, uso);   // de novo: o saldo muda a cada escolha
    const forte = c.find((k) => k.valorBate && k.doCliente);
    const soValor = c.filter((k) => k.valorBate);
    const escolhido = forte || (soValor.length === 1 ? soValor[0] : null);
    if (escolhido) {
      uso.add(escolhido.n.numero, lin.valor, escolhido.tipo);
      Object.assign(lin, { nf: escolhido.n.numero, nfSugerida: true, tipoReceb: escolhido.tipo, obs: null,
        nomePagador: escolhido.n.destNome || lin.nomePagador, cnpj: escolhido.n.destCnpj || lin.cnpj });
    } else if (c.length) {
      lin.obs = `POSSÍVEIS: ${c.slice(0, 3).map(descr).join(" · ")}`;
      const cli = c.find((k) => k.doCliente);
      if (cli && !lin.cnpj) lin.cnpj = cli.n.destCnpj;
    }
  }
  return { linhas, ignoradas };
}

// Gera/atualiza a planilha preservando as linhas editadas à mão e as manuais.
export async function gerar(competencia) {
  const { linhas: novas, ignoradas } = await montar(competencia);
  const antigas = await prisma.finRecebimento.findMany({ where: { competencia } });
  const travadas = antigas.filter((r) => r.editado || r.origem === "MANUAL");

  // remove só o que foi gerado automaticamente e não foi mexido
  await prisma.finRecebimento.deleteMany({ where: { competencia, editado: false, origem: { not: "MANUAL" } } });

  const jaTem = (n) => travadas.some((t) =>
    (n.lancamentoId && t.lancamentoId === n.lancamentoId) ||
    (!n.lancamentoId && cent(t.valor) === cent(n.valor) && String(t.nf || "") === String(n.nf || "") && t.bloco === n.bloco));

  const criar = novas.filter((n) => !jaTem(n));
  if (criar.length) {
    await prisma.finRecebimento.createMany({
      data: criar.map((n) => ({ ...n, competencia, valor: n.valor })),
    });
  }
  const total = await prisma.finRecebimento.count({ where: { competencia } });
  return {
    criadas: criar.length, preservadas: travadas.length, total,
    ignoradas: ignoradas.length,
    ignoradasValor: ignoradas.reduce((s, i) => s + i.valor, 0),
  };
}

export const BLOCOS = { CREDITO: "Créditos recebidos", BOLETO: "Boletos (cobrança)", CONFIRMAR: "A confirmar" };
export const ORDEM_BLOCOS = ["CREDITO", "BOLETO", "CONFIRMAR"];
