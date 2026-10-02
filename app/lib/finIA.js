// Análise de identificação com base no histórico + IA (Claude).
// 1) o sistema monta, do histórico, os candidatos de cada lançamento (rápido e sem custo);
// 2) a IA decide a conta, explica e aponta incongruências. Sem chave de API, vale só o passo 1.
import { prisma } from "@/lib/prisma";
import { sugerirTermo } from "@/lib/fin";

// palavras genéricas de extrato que não ajudam a reconhecer quem é quem
const GENERICAS = new Set(("PIX TRANSFERENCIA TRANSF DES REM RECEBIDO RECEBIDA ENVIADO ENVIADA PAGTO PAGAMENTO PAGTOS PGTO ELETRON " +
  "COMPRA COMPRAS CARTAO DEBITO CREDITO ELO VISA MASTER MASTERCARD TED DOC CP QR CODE DINAMICO ESTATICO DE DA DO DAS DOS E EM " +
  "PARA COM LTDA ME EPP EIRELI SA S A CONTA CORRENTE TARIFA BANCARIA VALOR REF REFERENTE PARC PARCELA NACIONAL INTERNACIONAL " +
  "BR BRA BRASIL SAO PAULO BELO HORIZONTE BH MG SP RJ").split(" "));

// separa códigos grudados em nomes (00360305MAURA → MAURA) e tira números soltos
export const chaveHist = (h) => sugerirTermo(String(h || "").replace(/(\d)([A-Za-zÀ-ÿ])/g, "$1 $2").replace(/([A-Za-zÀ-ÿ])(\d)/g, "$1 $2"));
export const tokens = (h) => [...new Set(chaveHist(h).split(" ").filter((t) => t.length >= 3 && !GENERICAS.has(t)))];

const jaccard = (a, b) => {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  const i = a.filter((t) => sb.has(t)).length;
  return i / (a.length + b.length - i);
};

// Índice do histórico: todas as identificações fora do mês analisado.
export async function indiceHistorico(competencia) {
  const ls = await prisma.finLancamento.findMany({
    where: { contaId: { not: null }, desmembrado: false, substituido: false, competencia: { not: competencia } },
    select: { historico: true, identificacao: true, contaId: true, valor: true, banco: true },
  });
  const porChave = new Map(); // chave → { exemplo, tokens, contas: {id: n}, n }
  for (const l of ls) {
    const sinal = Number(l.valor) > 0 ? "C" : "D";
    const k = `${sinal}|${chaveHist(l.historico)}`;
    let o = porChave.get(k);
    if (!o) { o = { k, sinal, exemplo: l.historico, tokens: tokens(l.historico), contas: {}, n: 0 }; porChave.set(k, o); }
    o.contas[l.contaId] = (o.contas[l.contaId] || 0) + 1;
    o.n++;
  }
  return { total: ls.length, chaves: [...porChave.values()], porChave };
}

// Distribuição de contas do histórico para um lançamento: chave exata + parecidos.
export function candidatos(idx, l, max = 5) {
  const sinal = Number(l.valor) > 0 ? "C" : "D";
  const exata = idx.porChave.get(`${sinal}|${chaveHist(l.historico)}`) || null;
  const tk = tokens(`${l.historico} ${l.identificacao || ""}`);
  const parecidos = tk.length
    ? idx.chaves.filter((c) => c.sinal === sinal && c !== exata).map((c) => ({ c, s: jaccard(tk, c.tokens) })).filter((x) => x.s >= 0.34)
      .sort((a, b) => b.s - a.s || b.c.n - a.c.n).slice(0, max)
    : [];
  return { exata, parecidos };
}

export const topConta = (contas) => {
  const tot = Object.values(contas).reduce((s, n) => s + n, 0);
  const [id, n] = Object.entries(contas).sort((a, b) => b[1] - a[1])[0] || [];
  return id ? { contaId: Number(id), n, tot, share: n / tot } : null;
};

// ---------- chamada à API da Anthropic ----------
export const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY;

// Chama o Claude. Com { web: true } a IA pode pesquisar na internet (ferramenta web_search da Anthropic).
// A resposta deve vir como lista JSON, de preferência entre <json></json>.
export async function perguntarIA(system, conteudo, { web = false, maxBuscas = 12 } = {}) {
  const messages = [{ role: "user", content: conteudo }];
  const body = { model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 16000, system, messages };
  if (web) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: maxBuscas, user_location: { type: "approximate", country: "BR", region: "Minas Gerais", city: "Belo Horizonte", timezone: "America/Sao_Paulo" } }];
  let txt = "";
  for (let volta = 0; volta < 4; volta++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `API da IA respondeu ${r.status}`);
    txt += (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    if (j.stop_reason !== "pause_turn") break;
    // pesquisa longa: devolve o que já veio e pede para continuar
    messages.push({ role: "assistant", content: j.content });
  }
  const tag = txt.match(/<json>([\s\S]*?)<\/json>/i);
  const limpo = (tag ? tag[1] : txt).replace(/```json|```/g, "").trim();
  const ini = limpo.indexOf("["), fim = limpo.lastIndexOf("]");
  if (ini < 0 || fim < ini) throw new Error("A IA não devolveu uma lista válida.");
  return JSON.parse(limpo.slice(ini, fim + 1));
}

// ---------- CNPJ: razão social e atividade (BrasilAPI, gratuita) ----------
const cacheCnpj = new Map();
export const acharCnpj = (t) => {
  const m = String(t || "").replace(/[.\/-]/g, "").match(/(?<!\d)\d{14}(?!\d)/);
  return m ? m[0] : null;
};
export async function consultarCnpj(cnpj) {
  if (cacheCnpj.has(cnpj)) return cacheCnpj.get(cnpj);
  let out = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctl.signal });
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      out = { razao: j.razao_social, fantasia: j.nome_fantasia || null, atividade: j.cnae_fiscal_descricao, cidade: [j.municipio, j.uf].filter(Boolean).join("/") };
    }
  } catch {}
  cacheCnpj.set(cnpj, out);
  return out;
}
