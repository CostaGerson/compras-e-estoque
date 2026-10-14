// v217 — cenário × oficial: o que a oficial tem e o cenário não (itens novos, dívidas reais atualizadas)
export const LISTAS = [["pessoal", "Pessoal"], ["vidaVegetativa", "Vida vegetativa"], ["logistica", "Logística"], ["administracao", "Administração"], ["sistemas", "Sistemas"], ["dividas", "Dívidas"]];
const chave = (i) => `${i.ofId ?? i.id}|${String(i.natureza ?? i.nome ?? "").trim().toUpperCase()}`;   // ofId: item trazido da oficial com id trocado
// dívida real (contrato da Alavancagem ou parcelamento): vem do mundo real, não é simulação
export const ehDividaReal = (i) => /^(CONTRATO|PARCFED|PARCEST):/.test(String(i?.id || ""));
const CAMPOS_DIVIDA = ["natureza", "parceiro", "valor", "valorParcela", "periodicidade", "dia", "ativo", "semRecorrencia", "obs", "contaCaixa", "contratoId"];
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function compararComOficial(cen, of) {
  if (!cen || !of) return null;
  const faltam = [], sobram = [], dividas = [], desligados = [];
  for (const [k, rot] of LISTAS) {
    const lc = Array.isArray(cen[k]) ? cen[k] : [], lo = Array.isArray(of[k]) ? of[k] : [];
    const kc = new Set(lc.map(chave)), ko = new Set(lo.map(chave));
    for (const i of lo) if (!kc.has(chave(i))) faltam.push({ area: k, rot, item: i });
    for (const i of lc) if (!ko.has(chave(i))) sobram.push({ area: k, rot, item: i });
    // desligado na oficial (RH/TRCT) e ainda ativo no cenário: é dado real
    if (k === "pessoal") for (const i of lo.filter((x) => x.ativo === false)) { const c = lc.find((x) => chave(x) === chave(i)); if (c && c.ativo !== false) desligados.push({ item: i }); }
    if (k === "dividas") {
      for (const i of lo.filter(ehDividaReal)) {
        const c = lc.find((x) => x.id === i.id);
        if (c && CAMPOS_DIVIDA.some((f) => !igual(c[f], i[f]))) dividas.push({ item: i, antes: c });
      }
    }
  }
  // dívida real que saiu da oficial (quitada) e continua no cenário
  const idsOf = new Set((of.dividas || []).map((x) => x.id));
  const quitadas = sobram.filter((s) => s.area === "dividas" && ehDividaReal(s.item) && !idsOf.has(s.item.id));
  const trocadas = sobram.filter((s) => s.area === "dividas" && ehDividaReal(s.item) && idsOf.has(s.item.id));
  const parametros = Object.keys({ ...(of.parametros || {}), ...(cen.parametros || {}) }).filter((p) => !igual(cen.parametros?.[p], of.parametros?.[p]));
  return { faltam, sobram: sobram.filter((s) => !quitadas.includes(s) && !trocadas.includes(s)), dividas, quitadas, desligados, parametros };
}

// traz o que falta + atualiza as dívidas reais + tira as quitadas (o que é simulação do cenário fica)
export function trazerDaOficial(cen, of, { parametros = false } = {}) {
  const d = compararComOficial(cen, of);
  const novo = JSON.parse(JSON.stringify(cen));
  for (const f of d.faltam) {
    const l = (novo[f.area] = Array.isArray(novo[f.area]) ? novo[f.area] : []);
    const it = JSON.parse(JSON.stringify(f.item));
    if (l.some((x) => x.id === it.id) && !ehDividaReal(it)) it.ofId = it.id, it.id = `${it.id}-of${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    if (ehDividaReal(it)) { const j = l.findIndex((x) => x.id === it.id); if (j >= 0) { l[j] = it; continue; } }
    l.push(it);
  }
  novo.dividas = (novo.dividas || []).map((x) => { const o = d.dividas.find((y) => y.item.id === x.id); return o ? { ...x, ...JSON.parse(JSON.stringify(o.item)) } : x; })
    .filter((x) => !d.quitadas.some((q) => q.item.id === x.id));
  novo.pessoal = (novo.pessoal || []).map((x) => (d.desligados.some((y) => chave(y.item) === chave(x)) ? { ...x, ativo: false } : x));
  if (parametros) novo.parametros = { ...(novo.parametros || {}), ...(of.parametros || {}) };
  return { dados: novo, resumo: d };
}
