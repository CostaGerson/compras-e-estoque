// v272 — Parâmetros da FPP alimentados pelas Análises operacionais (média dos últimos meses completos — v286: janela de 6 meses):
//   corte e expedição/acabamento por tipo de peça = valor bruto médio (valor de mercado ponderado pelas peças) de cada categoria;
//   costura por tipo de peça = valor terceirizado registrado na análise da costura; silk = R$ por cor da análise do silk.
// Mês completo = mês já encerrado com análise de CORTE e de EXPEDIÇÃO com peças. A cada mês novo completo os parâmetros são refeitos.
import { prisma } from "@/lib/prisma";
import { calcularCorte, calcularReal, SETORES_CUSTO_REAL, CATEGORIAS_BORDADO, CATEGORIAS_CORTE, CATEGORIAS_EXPEDICAO, CATEGORIAS_COSTURA, SILK_POR_COR, janelaMeses, JANELA_MESES } from "@/lib/opAnalise";
// v288 — corte e expedição: valor por tipo de peça = custo REAL do setor rateado pelo peso de mercado de cada tipo (valorInterno);
//   costura: valor de mercado (terceirizado); silk: R$ por cor.
const calcDe = async (a) => (SETORES_CUSTO_REAL.includes(a.setor) ? calcularReal(a) : calcularCorte(a, 0, 0));
const valorDe = (a, c) => (SETORES_CUSTO_REAL.includes(a.setor) ? c.valorInterno : c.mercado);
import { tipoDaPeca } from "@/lib/finOsKm";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
export const CHAVE_JANELA = "FPP|ANALISES|JANELA";

// tipo de peça da FPP → categoria das análises
export function categoriaFpp(chave) {
  const d = sa(chave);
  if (/AVENTAL/.test(d)) return "AVENTAL";
  if (/BERMUDA|SHORT/.test(d)) return "CALCA_OPERACIONAL";
  if (/BLUSAO|AGASALHO/.test(d) && /BRIM|TACTEL|NYLON/.test(d)) return "JAQUETA";   // plano: jaqueta/blusão de trabalho
  return tipoDaPeca(chave);
}

const mesAtualISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export async function janelaFpp() {
  const J = janelaMeses();   // v286 — só os últimos 6 meses encerrados
  const rows = await prisma.opAnalise.findMany({ where: { setor: { in: ["CORTE", "EXPEDICAO"] }, competencia: { gte: J.de, lte: J.ate } }, select: { setor: true, competencia: true, qtds: true } });
  const tem = (setor, c) => rows.some((r) => r.setor === setor && r.competencia === c && Object.values(r.qtds || {}).some((v) => Number(v) > 0));
  const comps = [...new Set(rows.map((r) => r.competencia))].filter((c) => tem("CORTE", c) && tem("EXPEDICAO", c)).sort().slice(-JANELA_MESES);
  return comps;
}

// média ponderada por peças do valor de mercado de cada categoria, nos meses da janela
async function mediaPorCategoria(setor, meses, cats) {
  const rows = await prisma.opAnalise.findMany({ where: { setor, competencia: { in: meses } } });
  const calcs = [];
  for (const a of rows.sort((x, y) => x.competencia.localeCompare(y.competencia))) calcs.push([a, await calcDe(a)]);
  const out = {};
  for (const [k] of cats) {
    let q = 0, v = 0, ultimo = null;
    for (const [a, calc] of calcs) {
      const c = calc.categorias.find((x) => x.k === k);
      if (!c) continue;
      const val = valorDe(a, c);
      if (val) ultimo = val;
      q += c.qtd; v += c.qtd * val;
    }
    const m = q ? v / q : ultimo;
    if (m != null && m > 0) out[k] = r4(m);
  }
  return out;
}

export async function mediasOperacionais() {
  const meses = await janelaFpp();
  if (!meses.length) return { meses: [], corte: {}, expedicao: {}, costura: [], silkPorCor: SILK_POR_COR };
  const [corte, expedicao, costura] = await Promise.all([
    mediaPorCategoria("CORTE", meses, CATEGORIAS_CORTE), mediaPorCategoria("EXPEDICAO", meses, CATEGORIAS_EXPEDICAO),
    mediaPorCategoria("COSTURA", meses, CATEGORIAS_COSTURA),
  ]);
  // silk: R$ por cor = contribuição bruta ÷ cores aplicadas (sem dado, R$ 0,80)
  const silks = await prisma.opAnalise.findMany({ where: { setor: "SILK", competencia: { in: meses } } });
  let vol = 0, cores = 0;
  for (const a of silks) { const c = calcularCorte(a, 0, 0); vol += c.terceirizado; cores += c.unidades || 0; }
  return {
    meses, corte, expedicao,
    costura: CATEGORIAS_COSTURA.filter(([k]) => costura[k] > 0).map(([k, n]) => ({ k, n, valor: costura[k] })),
    silkPorCor: cores ? r4(vol / cores) : SILK_POR_COR,
  };
}

// aplica nos parâmetros da FPP (com histórico) quando a janela de meses muda
export async function atualizarParamsFpp({ forcar = false } = {}) {
  { const { atualizarLogisticaFpp } = await import("@/lib/opLogistica"); await atualizarLogisticaFpp().catch(() => null); }   // v279
  const m = await mediasOperacionais();
  if (!m.meses.length) return { ok: false, motivo: "sem mês completo nas análises" };
  const chave = `v288|${m.meses.join(",")}`;   // v288 — regra nova (custo real no corte/expedição) força reaplicar uma vez
  const cfg = await prisma.finConfig.findUnique({ where: { chave: CHAVE_JANELA } }).catch(() => null);
  if (!forcar && cfg?.valor === chave) return { ok: true, janela: m.meses, alterados: 0, jaAplicado: true };
  const quem = `SISTEMA · ANÁLISES OPERACIONAIS (${m.meses.map((c) => c.slice(5, 7) + "/" + c.slice(2, 4)).join(", ")})`;
  const pecas = await prisma.fppParam.findMany({ where: { grupo: "PECA", tipo: { in: ["MALHA", "PLANO"] } } });
  let alterados = 0;
  const semCategoria = [];
  for (const p of pecas) {
    const cat = categoriaFpp(p.chave);
    if (!cat) { semCategoria.push(p.chave); continue; }
    const extra = { ...(p.extra || {}) };
    const campoExp = p.tipo === "MALHA" ? "exped" : "acab";
    const novos = [["corte", m.corte[cat]], [campoExp, m.expedicao[cat]]].filter(([, v]) => v != null && v > 0);
    const mud = novos.filter(([k, v]) => Math.abs((Number(extra[k]) || 0) - v) > 0.004);
    if (!mud.length) continue;
    for (const [k, v] of mud) {
      await prisma.fppParamHist.create({ data: { paramId: p.id, campo: k, deNum: Number(extra[k]) || 0, paraNum: r2(v), usuarioNome: quem } }).catch(() => null);
      extra[k] = r2(v);
    }
    await prisma.fppParam.update({ where: { id: p.id }, data: { extra } });
    alterados++;
  }
  await prisma.finConfig.upsert({ where: { chave: CHAVE_JANELA }, create: { chave: CHAVE_JANELA, valor: chave }, update: { valor: chave } }).catch(() => null);
  return { ok: true, janela: m.meses, alterados, semCategoria };
}

// v285 — valor cobrado na FPP por setor (mesma janela dos parâmetros): média por peça ponderada pelas quantidades + por tipo de peça
async function fppDoSetor(setor, meses, cats) {
  const rows = await prisma.opAnalise.findMany({ where: { setor, competencia: { in: meses } } });
  let Q = 0, V = 0;
  const por = {};
  for (const a of rows) for (const c of (await calcDe(a)).categorias || []) {
    const val = valorDe(a, c);
    if (!c.qtd || !(val > 0)) continue;
    Q += c.qtd; V += c.qtd * val;
    const p = (por[c.k] ||= { q: 0, v: 0 }); p.q += c.qtd; p.v += c.qtd * val;
  }
  return { porPeca: Q ? V / Q : null, pecas: Q,
    categorias: cats.filter(([k]) => por[k]?.q).map(([k, n]) => ({ k, n, valor: r4(por[k].v / por[k].q), qtd: por[k].q, total: r2(por[k].v) })).sort((a, b) => b.qtd - a.qtd) };
}
export async function fppPorSetor() {
  const meses = await janelaFpp();
  const out = { meses };
  if (meses.length) {
    [out.CORTE, out.EXPEDICAO, out.COSTURA, out.BORDADO] = await Promise.all([
      fppDoSetor("CORTE", meses, CATEGORIAS_CORTE), fppDoSetor("EXPEDICAO", meses, CATEGORIAS_EXPEDICAO), fppDoSetor("COSTURA", meses, CATEGORIAS_COSTURA),
      fppDoSetor("BORDADO", meses, CATEGORIAS_BORDADO)]);   // v291 — bordado: terceirizado médio por peça (referência)
    const silks = await prisma.opAnalise.findMany({ where: { setor: "SILK", competencia: { in: meses } } });
    let vol = 0, cores = 0;
    for (const a of silks) { const c = calcularCorte(a, 0, 0); vol += c.terceirizado; cores += c.unidades || 0; }
    out.SILK = { porCor: cores ? r4(vol / cores) : SILK_POR_COR, cores };
  } else out.SILK = { porCor: SILK_POR_COR, cores: 0 };
  return out;
}
