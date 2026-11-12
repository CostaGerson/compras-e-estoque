// v798 — correlaciona o histórico do extrato com os freelancers e terceirizados cadastrados (Prestador), pelo nome
import { prisma } from "@/lib/prisma";

const LIGA = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "LTDA", "ME", "EPP", "EIRELI", "SA", "MEI", "FACCAO", "FACCOES", "SERVICOS", "CONFECCAO", "CONFECCOES"]);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const palavras = (s) => norm(s).split(" ").filter((w) => w.length >= 3 && !LIGA.has(w) && !/^\d+$/.test(w));

export async function carregarPrestadores() {
  const ps = await prisma.prestador.findMany({ select: { id: true, tipo: true, nome: true, nomeKm: true, funcao: true, servicos: true, documento: true, ativo: true } }).catch(() => []);
  return ps.map((p) => ({ ...p, pal: palavras(p.nome), km: palavras(p.nomeKm), doc: String(p.documento || "").replace(/\D/g, "") }));
}

// melhor prestador para o texto (histórico + identificação + documento). Exige: CPF/CNPJ igual, ou nome do KM inteiro,
// ou 2+ palavras do nome (o primeiro nome entre elas), ou nome de uma palavra só com 5+ letras
export function prestadorDoHistorico(ps, texto, documento) {
  const t = ` ${norm(texto)} `;
  const doc = String(documento || "").replace(/\D/g, "") + " " + String(texto || "").replace(/\D/g, "");
  let melhor = null;
  for (const p of ps) {
    let s = 0;
    if (p.doc.length >= 11 && doc.includes(p.doc)) s = 1;
    else {
      const achou = p.pal.filter((w) => t.includes(` ${w} `));
      if (p.pal.length >= 2 && achou.length >= 2 && achou.includes(p.pal[0])) s = 0.5 + 0.5 * (achou.length / p.pal.length);
      else if (p.pal.length === 1 && p.pal[0].length >= 5 && achou.length === 1) s = 0.6;
      if (p.km.length && p.km.every((w) => t.includes(` ${w} `)) && p.km.join("").length >= 4) s = Math.max(s, 0.8);
    }
    if (s > 0 && (!melhor || s > melhor.s || (s === melhor.s && p.ativo && !melhor.p.ativo))) melhor = { p, s };
  }
  return melhor ? { ...melhor.p, score: Math.round(melhor.s * 100) / 100 } : null;
}

const servTxt = (p) => (Array.isArray(p.servicos) ? p.servicos : []).map((x) => String(x).replace(":", " ")).join(", ");
export const descPrestador = (p) => `${p.tipo} ${p.nome}${p.funcao ? " · " + p.funcao : ""}${servTxt(p) ? " · " + servTxt(p) : ""}${p.ativo ? "" : " (inativo)"}`;

// conta-caixa provável pelo cadastro (palpite quando o histórico de identificações não decide)
export function contaDoPrestador(p, contas) {
  const at = contas.filter((c) => c.ativo !== false);
  const porNome = (re) => at.find((c) => c.codigo.startsWith("2") && re.test(norm(c.nome)));
  const sv = (Array.isArray(p.servicos) ? p.servicos : []).map((x) => norm(x));
  if (p.tipo === "FREELANCER") {
    const area = norm(`${p.funcao || ""} ${sv.join(" ")}`);
    for (const [re, alvo] of [[/CORT/, /FREELANCER DE CORTE/], [/COSTUR|ARREMAT/, /FREELANCER DE COSTURA/], [/SILK/, /FREELANCER SILK/], [/PRENSA|DTF/, /FREELANCER PRENSA/], [/MOTORIST|LOGIST|EXPEDI|ENTREG/, /FREELANCER DE LOGISTICA/]])
      if (re.test(area)) { const c = porNome(alvo); if (c) return c; }
    return porNome(/^FREELANCER$/) || porNome(/FREELANCER/);
  }
  for (const s of sv) {
    const [g, q] = s.split(" ");
    if (g === "FACCAO") { const c = (q && porNome(new RegExp(`FACCAO ${q}`))) || porNome(/^FACCAO$/); if (c) return c; }
    if (g === "SERVICO" && q) { const c = porNome(new RegExp(`^${q}`)); if (c) return c; }
  }
  return porNome(/OUTROS SERVICOS DE PRODUCAO/) || null;
}
