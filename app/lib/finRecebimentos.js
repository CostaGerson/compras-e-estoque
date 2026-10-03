// Planilha de recebimentos do mês: créditos de terceiros do extrato + boletos recebidos,
// cruzados com as notas de saída (XMLs enviados na Contabilidade) e com o cadastro de clientes.
// Colunas do modelo: DATA · TÍTULO · VALOR (R$) · NF · NOME PAGADOR · CNPJ · OBS
import { prisma } from "@/lib/prisma";
import { formatarCnpj } from "@/lib/finNfSaida";

// Origens que NÃO são recebimento de cliente (vão para o bloco "A confirmar").
export const ORIGENS_PROPRIAS = [
  ["PEDRO", "TAVARES"],
  ["IGOR", "SANTOS", "COSTA"],
  ["NORT", "SPORTS"],
  ["MERIDIAN"],
];
// Antecipação / factoring: entra no bloco "A confirmar" (o recebimento do cliente é outro).
export const ORIGENS_ANTECIPACAO = [["FIDC"], ["CREDX"], ["AZUL", "CAPITAL"], ["ANTECIPA"]];

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const casa = (txt, listas) => { const t = semAcento(txt); return listas.some((ts) => ts.every((x) => t.includes(x))); };
const cent = (v) => Math.round(Number(v) * 100);

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

// ---------------- montagem ----------------
export async function montar(competencia) {
  const [lanc, notas, clientes] = await Promise.all([
    prisma.finLancamento.findMany({
      where: { competencia, desmembrado: false, substituido: false, valor: { gt: 0 } },
      orderBy: [{ data: "asc" }, { ordem: "asc" }],
      select: { id: true, data: true, historico: true, identificacao: true, valor: true, banco: true, grupo: true, origem: true },
    }),
    prisma.finNfSaida.findMany({
      where: { competencia },
      select: { numero: true, valor: true, destNome: true, destCnpj: true, emissao: true },
      orderBy: { emissao: "asc" },
    }),
    prisma.cliente.findMany({ where: { cnpj: { not: null } }, select: { razaoSocial: true, nomeFantasia: true, cnpj: true } }),
  ]);

  // índice das notas por valor exato
  const porValor = new Map();
  for (const n of notas) {
    const k = cent(n.valor);
    if (!porValor.has(k)) porValor.set(k, []);
    porValor.get(k).push(n);
  }
  const notaPorValor = (v) => { const l = porValor.get(cent(v)) || []; return l.length === 1 ? l[0] : null; };
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
  let ordem = 0;

  for (const l of lanc) {
    const h = `${l.historico || ""} ${l.identificacao || ""}`;

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
    const nota = proprio || antecip ? null : notaPorValor(l.valor);
    linhas.push({
      bloco: proprio || antecip ? "CONFIRMAR" : "CREDITO",
      ordem: ordem++,
      data: l.data,
      titulo: tituloDoHistorico(l.historico),
      valor: l.valor,
      nf: nota ? nota.numero : null,
      nomePagador: nota ? nota.destNome : pagador,
      cnpj: nota ? nota.destCnpj : buscarCnpj(pagador),
      obs: proprio ? "ORIGEM PRÓPRIA — CONFERIR" : antecip ? "ANTECIPAÇÃO / FACTORING — CONFERIR" : null,
      origem: "AUTO",
      lancamentoId: l.id,
    });
  }

  return linhas;
}

// Gera/atualiza a planilha preservando as linhas editadas à mão e as manuais.
export async function gerar(competencia) {
  const novas = await montar(competencia);
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
  return { criadas: criar.length, preservadas: travadas.length, total };
}

export const BLOCOS = { CREDITO: "Créditos recebidos", BOLETO: "Boletos (cobrança)", CONFIRMAR: "A confirmar" };
export const ORDEM_BLOCOS = ["CREDITO", "BOLETO", "CONFIRMAR"];
