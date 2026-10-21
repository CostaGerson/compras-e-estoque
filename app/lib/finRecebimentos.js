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

// v361 — casa um crédito com NFs: valor (total ou parcela) × CNPJ/nome do cliente × data (NF emitida até 5 dias depois do crédito, até 1 ano antes)
function candidatos(notas, { valor, data, cnpjDig, nome }) {
  const v = cent(valor), dt = new Date(data).getTime();
  const out = [];
  for (const n of notas) {
    const em = n.emissao ? new Date(n.emissao).getTime() : null;
    if (em != null && (em > dt + 5 * 864e5 || em < dt - 366 * 864e5)) continue;
    const doCliente = (cnpjDig && n.cnpjDig && (n.cnpjDig === cnpjDig || (cnpjDig.length === 14 && n.cnpjDig.slice(0, 8) === cnpjDig.slice(0, 8)))) || (nome && parecido(nome, n.destNome) >= 0.6);
    const total = cent(n.valor) === v, parc = n.parcelas.some((p) => cent(p) === v);
    if (!total && !parc && !doCliente) continue;
    const chaveUso = `${n.numero}|${v}`;
    const cap = Math.max(1, n.parcelas.filter((p) => cent(p) === v).length);   // 2 parcelas iguais podem casar 2 créditos
    const score = (total || parc ? 2 : 0) + (doCliente ? 2 : 0) + (total ? 0.5 : 0) + (em != null ? Math.max(0, 1 - (dt - em) / (120 * 864e5)) * 0.5 : 0);
    out.push({ n, total, parc, doCliente, score, chaveUso, cap });
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
      linhas.push({
        bloco: "BOLETO", ordem: ordem++, data: l.data, titulo: "LIQ COBRANÇA", valor: l.valor,
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

  // v361 — sugestão de NF para cada crédito de cliente: melhores casamentos primeiro, cada NF/valor usado uma vez
  const outros = await prisma.finRecebimento.findMany({ where: { competencia: { not: competencia }, nf: { not: null } }, select: { nf: true, valor: true } });
  const usados = new Map();
  const usar = (k) => usados.set(k, (usados.get(k) || 0) + 1);
  for (const r of [...outros, ...linhas.filter((x) => x.nf)]) usar(`${String(r.nf).split(/[-\/ ]/)[0].replace(/^0+/, "")}|${cent(r.valor)}`);
  const ops = pendentes.filter((x) => !x.proprio && !x.antecip).map((x) => {
    const lin = linhas[x.i];
    const c = candidatos(notas, { valor: lin.valor, data: lin.data, cnpjDig: soDig(lin.cnpj), nome: x.pagador });
    return { x, lin, c };
  });
  ops.sort((a, b) => (b.c[0]?.score || 0) - (a.c[0]?.score || 0));
  for (const { lin, c } of ops) {
    const livres = c.filter((k) => (usados.get(k.chaveUso) || 0) < k.cap);
    const forte = livres.find((k) => (k.total || k.parc) && k.doCliente);
    const soValor = livres.filter((k) => k.total || k.parc);
    const escolhido = forte || (soValor.length === 1 ? soValor[0] : null);
    if (escolhido) {
      usar(escolhido.chaveUso);
      lin.nf = escolhido.n.numero;
      lin.nomePagador = escolhido.n.destNome || lin.nomePagador;
      lin.cnpj = escolhido.n.destCnpj || lin.cnpj;
      lin.obs = forte ? `NF SUGERIDA: valor${escolhido.parc && !escolhido.total ? " (parcela)" : ""} e cliente batem` : "NF SUGERIDA SÓ PELO VALOR — CONFERIR O CLIENTE";
    } else if (livres.length) {
      lin.obs = `POSSÍVEIS: ${livres.slice(0, 3).map(descr).join(" · ")}`;
      const cli = livres.find((k) => k.doCliente);
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
