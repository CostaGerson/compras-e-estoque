// v203 — Data de emissão da NF em toda conta que veio de nota fiscal.
// Preenche FinTitulo.emissao (só onde está vazia) a partir de, nesta ordem:
//  1) "EMISSÃO dd/mm/aaaa" na observação (posição de títulos, movimento fiscal)
//  2) NF de entrada lançada pelo Compras (NotaFiscal.dataEmissao)
//  3) XML guardado na conta (<dhEmi>/<dEmi>/DataEmissao)
//  4) conta a receber "NF <nº>": NF de saída (FinNfSaida) com o mesmo número (e CNPJ do cliente, quando houver)
// Roda ao abrir o contas a pagar/receber; não mexe em data já preenchida.
import { prisma } from "@/lib/prisma";

const dia = (s) => new Date(`${s}T00:00:00Z`);
const so = (s) => String(s || "").replace(/\D/g, "");
const semZero = (s) => String(Number(so(s)) || "");

export function emissaoDaObs(obs) {
  const m = String(obs || "").match(/EMISS[ÃA]O:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function emissaoDoXml(xml) {
  const m = String(xml || "").match(/<(?:\w+:)?(?:dhEmi|dEmi|DataEmissao|DataEmissaoNfse|dhProc)>\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
// nº da NF pelo título ("NF 1991", "NF 1793-2/2") ou pelo documento ("NF-e 123 · PARC 1", "NFS-e 45")
export function numeroNf(t) {
  const a = String(t.titulo || "").match(/^NF[\s-]*(?:E\s*)?(\d+)/i);
  if (a) return semZero(a[1]);
  const b = String(t.numeroDoc || "").match(/\bNFS?-?e?\s*(\d+)/i);
  return b ? semZero(b[1]) : null;
}

export async function preencherEmissao() {
  const cands = await prisma.finTitulo.findMany({
    where: {
      emissao: null,
      OR: [
        { nfId: { not: null } }, { arquivoXml: { not: null } }, { forma: "NF_XML" },
        { observacao: { contains: "EMISS", mode: "insensitive" } },
        { titulo: { startsWith: "NF" } }, { numeroDoc: { startsWith: "NF" } },
      ],
    },
    select: { id: true, tipo: true, titulo: true, numeroDoc: true, observacao: true, nfId: true, documento: true },
    take: 5000,
  });
  if (!cands.length) return { preenchidas: 0 };

  const nfIds = [...new Set(cands.map((t) => t.nfId).filter(Boolean))];
  const nfs = nfIds.length ? await prisma.notaFiscal.findMany({ where: { id: { in: nfIds } }, select: { id: true, dataEmissao: true } }) : [];
  const nfEm = Object.fromEntries(nfs.filter((n) => n.dataEmissao).map((n) => [n.id, n.dataEmissao.toISOString().slice(0, 10)]));

  // NFs de saída pelo número (contas a receber)
  const numsRec = [...new Set(cands.filter((t) => t.tipo === "RECEBER").map(numeroNf).filter(Boolean))];
  const saidas = numsRec.length ? await prisma.finNfSaida.findMany({ select: { numero: true, emissao: true, destCnpj: true } }) : [];
  const porNum = {};
  for (const n of saidas) (porNum[semZero(n.numero)] ||= []).push(n);

  const achadas = {};
  const semAinda = [];
  for (const t of cands) {
    let e = emissaoDaObs(t.observacao) || (t.nfId && nfEm[t.nfId]) || null;
    if (!e && t.tipo === "RECEBER") {
      const l = porNum[numeroNf(t)] || [];
      const doc = so(t.documento);
      const n = (doc && l.find((x) => so(x.destCnpj) === doc)) || (l.length === 1 ? l[0] : null);
      if (n) e = n.emissao.toISOString().slice(0, 10);
    }
    if (e) achadas[t.id] = e; else semAinda.push(t.id);
  }
  // XML só de quem ainda não achou (o XML é pesado: um a um)
  if (semAinda.length) {
    const xs = await prisma.finTitulo.findMany({ where: { id: { in: semAinda }, arquivoXml: { not: null } }, select: { id: true, arquivoXml: true } });
    for (const x of xs) { const e = emissaoDoXml(x.arquivoXml); if (e) achadas[x.id] = e; }
  }
  let preenchidas = 0;
  for (const [id, e] of Object.entries(achadas)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) continue;
    await prisma.finTitulo.update({ where: { id: Number(id) }, data: { emissao: dia(e) } }).catch(() => null);
    preenchidas++;
  }
  return { preenchidas };
}
